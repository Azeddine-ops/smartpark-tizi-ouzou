/**
 * /api/reservations
 *
 * GET  — réservations du conducteur démo + métriques anti-fraude.
 * POST — création atomique d'une réservation (EF-06) :
 *
 *   1. contrôle anti-fraude (annulations/h, réservations simultanées, score) ;
 *   2. sélection transactionnelle `SELECT … FOR UPDATE SKIP LOCKED` d'une
 *      place libre à capteur sain ⇒ il est IMPOSSIBLE d'envoyer deux
 *      automobilistes sur la même place ou vers une place occupée (ENF-03) ;
 *   3. passage de la place à « reserved » et fenêtre d'activation 15 min.
 *
 * En cas de conflit (parc complet entre-temps) : 409 + alternatives
 * recommandées sur les autres parcs.
 */
import { desc, eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { auditEvents, parkingLots, parkingSpots, reservations } from "@/db/schema";
import { ensureSeeded } from "@/db/seed";
import { quoteParking } from "@/lib/pricing";
import {
  assessFraud,
  reservationCode,
  trustDeltaForEvent,
} from "@/lib/reliability";
import {
  activeReservationsCount,
  cancelsLastHour,
  getDemoUser,
  listLotsWithStats,
} from "@/lib/server";
import { effectiveRush, getSimState, sweepExpired } from "@/lib/simulation";

export const dynamic = "force-dynamic";

const HOLD_MINUTES = 15; // fenêtre d'activation avant expiration (no-show)

export async function GET() {
  await ensureSeeded();
  await sweepExpired();
  const user = await getDemoUser();

  const rows = await db
    .select({
      id: reservations.id,
      code: reservations.code,
      status: reservations.status,
      durationMin: reservations.durationMin,
      amountEstimated: reservations.amountEstimated,
      amountFinal: reservations.amountFinal,
      paymentMethod: reservations.paymentMethod,
      rushApplied: reservations.rushApplied,
      expiresAt: reservations.expiresAt,
      checkedInAt: reservations.checkedInAt,
      completedAt: reservations.completedAt,
      createdAt: reservations.createdAt,
      lotId: reservations.lotId,
      spotId: reservations.spotId,
      lotName: parkingLots.name,
      spotCode: parkingSpots.code,
      zone: parkingSpots.zone,
    })
    .from(reservations)
    .innerJoin(parkingLots, eq(reservations.lotId, parkingLots.id))
    .innerJoin(parkingSpots, eq(reservations.spotId, parkingSpots.id))
    .where(eq(reservations.userId, user.id))
    .orderBy(desc(reservations.createdAt))
    .limit(40);

  const [cancels, actives] = await Promise.all([
    cancelsLastHour(user.id),
    activeReservationsCount(user.id),
  ]);

  return Response.json({
    user: { id: user.id, name: user.name, plate: user.plate, trustScore: user.trustScore },
    reservations: rows,
    stats: { cancelsLastHour: cancels, activeReservations: actives },
    serverTime: new Date().toISOString(),
  });
}

export async function POST(req: Request) {
  await ensureSeeded();
  await sweepExpired();

  let body: { lotId?: number; durationMin?: number; zone?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Requête illisible" }, { status: 400 });
  }
  const lotId = Number(body.lotId);
  const durationMin = Math.max(30, Math.min(720, Number(body.durationMin ?? 60)));
  const zone = body.zone && typeof body.zone === "string" ? body.zone : null;

  const lot = await db.select().from(parkingLots).where(eq(parkingLots.id, lotId)).limit(1);
  if (!lot[0]) return Response.json({ error: "Parking introuvable" }, { status: 404 });

  const user = await getDemoUser();
  const [cancels, actives] = await Promise.all([
    cancelsLastHour(user.id),
    activeReservationsCount(user.id),
  ]);

  // — Anti-fraude (EF-10) —
  const fraud = assessFraud({
    cancelsLastHour: cancels,
    activeReservations: actives,
    trustScore: user.trustScore,
  });
  if (fraud.blocked) {
    await db.insert(auditEvents).values({
      kind: "fraud.block",
      userId: user.id,
      lotId,
      message: `Réservation bloquée (${fraud.flags.join(", ")}) — ${fraud.reason}`,
    });
    return Response.json(
      { error: fraud.reason, fraud },
      { status: 429 },
    );
  }

  const sim = await getSimState();
  const rush = effectiveRush(sim);
  const quote = quoteParking(lot[0].hourlyRate, durationMin, rush, null);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + HOLD_MINUTES * 60_000);

  // — Attribution atomique (verrou de ligne) —
  type Pick = { id: number; code: string; zone: string };
  type TxResult = { created: typeof reservations.$inferSelect; picked: Pick } | null;

  const result: TxResult = await db.transaction(async (tx): Promise<TxResult> => {
    const pickRes = await tx.execute<Pick>(sql`
      SELECT id, code, zone FROM parking_spots
      WHERE lot_id = ${lotId}
        AND status = 'free'
        AND sensor_ok = true
        AND last_heartbeat > now() - interval '10 minutes'
        ${zone ? sql`AND zone = ${zone}` : sql``}
      ORDER BY random()
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `);
    const spot = pickRes.rows[0];
    if (!spot) return null; // conflit traité après la transaction

    await tx.execute(sql`
      UPDATE parking_spots SET status = 'reserved', updated_at = now()
      WHERE id = ${spot.id}
    `);

    let code = reservationCode();
    for (let attempt = 0; attempt < 3; attempt++) {
      const exists = await tx
        .select({ id: reservations.id })
        .from(reservations)
        .where(eq(reservations.code, code))
        .limit(1);
      if (!exists.length) break;
      code = reservationCode();
    }

    const inserted = await tx
      .insert(reservations)
      .values({
        code,
        userId: user.id,
        spotId: spot.id,
        lotId,
        status: "pending",
        durationMin,
        amountEstimated: quote.total,
        rushApplied: rush,
        expiresAt,
      })
      .returning();

    await tx.insert(auditEvents).values({
      kind: "reservation.create",
      userId: user.id,
      lotId,
      message: `Réservation ${code} : place ${spot.code} bloquée ${HOLD_MINUTES} min au ${lot[0].name}.`,
      meta: { reservationId: inserted[0].id, zone: spot.zone, durationMin },
    });

    return { created: inserted[0], picked: spot };
  });

  if (!result) {
    // Parc complet ou capteurs indisponibles ⇒ recommander des alternatives
    const lots = await listLotsWithStats();
    const alternatives = lots
      .filter((l) => l.id !== lotId && l.stats.assignable > 0)
      .sort((a, b) => b.stats.assignable - a.stats.assignable)
      .slice(0, 3)
      .map((l) => ({
        id: l.id,
        name: l.name,
        assignable: l.stats.assignable,
        hourlyRate: l.hourlyRate,
      }));
    await db.insert(auditEvents).values({
      kind: "reservation.conflict",
      userId: user.id,
      lotId,
      message: `Conflit évité : aucune place fiable au ${lot[0].name} au moment de la réservation. Alternatives proposées.`,
    });
    return Response.json(
      {
        error: `Plus de place attribuable au ${lot[0].name} à l'instant (occupation réelle ou capteurs en panne).`,
        alternatives,
        lotName: lot[0].name,
      },
      { status: 409 },
    );
  }

  return Response.json(
    {
      reservation: {
        ...result.created,
        lotName: lot[0].name,
        spotCode: result.picked.code,
        zone: result.picked.zone,
      },
      quote,
      holdMinutes: HOLD_MINUTES,
      trustDeltaPreview: {
        completed: trustDeltaForEvent("completed"),
        noShow: trustDeltaForEvent("no-show"),
      },
    },
    { status: 201 },
  );
}
