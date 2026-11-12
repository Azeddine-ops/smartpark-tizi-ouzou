/**
 * PATCH /api/reservations/[id] — cycle de vie (EF-08, EF-09) :
 *
 *  - action "checkin"  : scan au portail (QR) — pending → active ;
 *  - action "extend"   : prolongation +60 min ;
 *  - action "cancel"   : annulation (pénalité de confiance + anti-flood) ;
 *  - action "checkout" : sortie + paiement CIB / Edahabia / espèces.
 *
 * Le paiement par carte est validé par Luhn côté serveur ; une carte
 * invalide génère un paiement « failed » historisé (audit).
 */
import { and, eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import {
  auditEvents,
  parkingLots,
  parkingSpots,
  payments,
  reservations,
} from "@/db/schema";
import { ensureSeeded } from "@/db/seed";
import { rushInfo } from "@/lib/geo";
import {
  luhnCheck,
  maskCard,
  paymentReference,
  quoteParking,
  type PaymentMethod,
} from "@/lib/pricing";
import {
  MAX_CANCELS_PER_HOUR,
  trustDeltaForEvent,
} from "@/lib/reliability";
import { cancelsLastHour } from "@/lib/server";

export const dynamic = "force-dynamic";

async function adjustTrust(userId: number, delta: number) {
  await db.execute(sql`
    UPDATE users SET trust_score = GREATEST(0, LEAST(100, trust_score + ${delta}))
    WHERE id = ${userId}
  `);
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  await ensureSeeded();
  const { id } = await ctx.params;
  const resId = Number(id);
  if (!Number.isFinite(resId)) {
    return Response.json({ error: "Identifiant invalide" }, { status: 400 });
  }

  let body: { action?: string; method?: string; cardNumber?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Requête illisible" }, { status: 400 });
  }
  const action = body.action;

  const rows = await db
    .select({
      reservation: reservations,
      lot: parkingLots,
      spot: parkingSpots,
    })
    .from(reservations)
    .innerJoin(parkingLots, eq(reservations.lotId, parkingLots.id))
    .innerJoin(parkingSpots, eq(reservations.spotId, parkingSpots.id))
    .where(eq(reservations.id, resId))
    .limit(1);

  const row = rows[0];
  if (!row) return Response.json({ error: "Réservation introuvable" }, { status: 404 });
  const { reservation: r, lot, spot } = row;
  const now = new Date();

  // ---------- CHECK-IN (scan portail / QR) ----------
  if (action === "checkin") {
    if (r.status !== "pending") {
      return Response.json({ error: "Seule une réservation en attente peut être activée." }, { status: 409 });
    }
    if (now > new Date(r.expiresAt)) {
      await db.update(reservations).set({ status: "expired" }).where(eq(reservations.id, r.id));
      await db
        .update(parkingSpots)
        .set({ status: "free", updatedAt: now })
        .where(and(eq(parkingSpots.id, r.spotId), eq(parkingSpots.status, "reserved")));
      await adjustTrust(r.userId, trustDeltaForEvent("no-show"));
      await db.insert(auditEvents).values({
        kind: "reservation.noshow",
        userId: r.userId,
        lotId: r.lotId,
        message: `No-show : ${r.code} expirée au moment du scan. Score −10.`,
      });
      return Response.json(
        { error: "Réservation expirée (plus de 15 min sans check-in). Elle a été libérée.", expired: true },
        { status: 410 },
      );
    }
    // Le capteur confirme l'occupation physique de la place
    await db.update(parkingSpots).set({ status: "occupied", updatedAt: now }).where(eq(parkingSpots.id, r.spotId));
    await db.update(reservations).set({ status: "active", checkedInAt: now }).where(eq(reservations.id, r.id));
    await db.insert(auditEvents).values({
      kind: "reservation.checkin",
      userId: r.userId,
      lotId: r.lotId,
      message: `Check-in ${r.code} au ${lot.name} — place ${spot.code} occupée (capteur confirmé).`,
    });
    return Response.json({ ok: true, status: "active", checkedInAt: now });
  }

  // ---------- PROLONGATION +60 min ----------
  if (action === "extend") {
    if (r.status !== "pending" && r.status !== "active") {
      return Response.json({ error: "Réservation clôturée : prolongation impossible." }, { status: 409 });
    }
    const newDuration = Math.min(720, r.durationMin + 60);
    const quote = quoteParking(lot.hourlyRate, newDuration, r.rushApplied, null);
    await db
      .update(reservations)
      .set({ durationMin: newDuration, amountEstimated: quote.total })
      .where(eq(reservations.id, r.id));
    await db.insert(auditEvents).values({
      kind: "reservation.extend",
      userId: r.userId,
      lotId: r.lotId,
      message: `Réservation ${r.code} prolongée à ${Math.floor(newDuration / 60)} h — nouveau devis ${quote.total} DA.`,
    });
    return Response.json({ ok: true, durationMin: newDuration, amountEstimated: quote.total });
  }

  // ---------- ANNULATION ----------
  if (action === "cancel") {
    if (r.status !== "pending" && r.status !== "active") {
      return Response.json({ error: "Réservation déjà clôturée." }, { status: 409 });
    }
    // libère la place (sauf si maintenance capteur)
    await db.execute(sql`
      UPDATE parking_spots SET status = CASE WHEN sensor_ok THEN 'free' ELSE 'maintenance' END, updated_at = now()
      WHERE id = ${r.spotId} AND status IN ('reserved', 'occupied')
    `);
    await db.update(reservations).set({ status: "cancelled" }).where(eq(reservations.id, r.id));
    const cancels = (await cancelsLastHour(r.userId)) + 1;
    const flood = cancels > MAX_CANCELS_PER_HOUR;
    await adjustTrust(r.userId, trustDeltaForEvent(flood ? "cancel-flood" : "cancel"));
    await db.insert(auditEvents).values({
      kind: flood ? "fraud.flag" : "reservation.cancel",
      userId: r.userId,
      lotId: r.lotId,
      message: flood
        ? `Annulation #${cancels} en 1 h (${r.code}) — comportement suspect, score pénalisé.`
        : `Réservation ${r.code} annulée, place ${spot.code} relâchée.`,
    });
    return Response.json({ ok: true, status: "cancelled", floodWarning: flood });
  }

  // ---------- CHECK-OUT + PAIEMENT ----------
  if (action === "checkout") {
    if (r.status !== "active") {
      return Response.json({ error: "Le paiement requiert un stationnement en cours (check-in fait)." }, { status: 409 });
    }
    const method = body.method as PaymentMethod | undefined;
    if (!method || !["cib", "edahabia", "especes"].includes(method)) {
      return Response.json({ error: "Mode de paiement requis : cib | edahabia | especes" }, { status: 400 });
    }

    const minutesParked = Math.max(
      1,
      Math.ceil((now.getTime() - new Date(r.checkedInAt ?? r.createdAt).getTime()) / 60_000),
    );
    const rush = rushInfo(now).rush;
    const quote = quoteParking(lot.hourlyRate, minutesParked, rush, method);

    // Carte bancaire : validation Luhn côté serveur
    let cardLast4: string | null = null;
    if (method !== "especes") {
      const cardNumber = String(body.cardNumber ?? "");
      if (!luhnCheck(cardNumber)) {
        await db.insert(payments).values({
          reservationId: r.id,
          method,
          amount: quote.total,
          status: "failed",
          reference: paymentReference("SP-REFUSE"),
        });
        await db.insert(auditEvents).values({
          kind: "payment.failed",
          userId: r.userId,
          lotId: r.lotId,
          message: `Carte ${method.toUpperCase()} refusée pour ${r.code} (contrôle Luhn).`,
        });
        return Response.json(
          { error: "Carte refusée : numéro invalide. Vérifiez votre carte CIB/Edahabia." },
          { status: 422 },
        );
      }
      cardLast4 = cardNumber.replace(/\D/g, "").slice(-4);
    }

    const reference = paymentReference(method === "especes" ? "SP-GUICHET" : "SP-SATIM");
    const receipt = await db.transaction(async (tx) => {
      await tx.insert(payments).values({
        reservationId: r.id,
        method,
        amount: quote.total,
        status: "success",
        reference,
        cardLast4,
      });
      await tx
        .update(reservations)
        .set({
          status: "completed",
          amountFinal: quote.total,
          paymentMethod: method,
          completedAt: now,
        })
        .where(eq(reservations.id, r.id));
      await tx.execute(sql`
        UPDATE parking_spots SET status = CASE WHEN sensor_ok THEN 'free' ELSE 'maintenance' END, updated_at = now()
        WHERE id = ${r.spotId}
      `);
      await tx.insert(auditEvents).values({
        kind: "payment.success",
        userId: r.userId,
        lotId: r.lotId,
        message: `Paiement ${quote.total} DA (${method.toUpperCase()}) pour ${r.code} — réf. ${reference}.`,
        meta: { minutesParked, rush },
      });
      return { reference, quote };
    });

    await adjustTrust(r.userId, trustDeltaForEvent("completed"));

    return Response.json({
      ok: true,
      status: "completed",
      receipt: {
        reference,
        amount: receipt.quote.total,
        minutesParked,
        rushApplied: rush,
        method,
        card: cardLast4 ? maskCard(body.cardNumber ?? "") : null,
        lotName: lot.name,
        spotCode: spot.code,
      },
    });
  }

  return Response.json({ error: "Action inconnue" }, { status: 400 });
}
