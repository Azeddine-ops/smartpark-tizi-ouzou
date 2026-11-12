/**
 * Moteur de simulation temps réel (salle de contrôle).
 *
 * Simule le parc de capteurs IoT de la ville :
 *  - transitions d'occupation (voitures qui arrivent / partent) ;
 *  - pannes capteurs aléatoires + auto-réparation partielle ;
 *  - battements (heartbeat) des capteurs sains — les défectueux se taisent ;
 *  - snapshots vers l'entrepôt de données (table `snapshots`) ;
 *  - balayage des réservations expirées (no-show) avec pénalité de confiance.
 *
 * Traçabilité : ENF-03 (fiabilité / pas de place fantôme), EF-12 (monitoring).
 */
import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  auditEvents,
  parkingSpots,
  reservations,
  simState,
  snapshots,
  users,
} from "@/db/schema";
import { rushInfo } from "@/lib/geo";
import { trustDeltaForEvent } from "@/lib/reliability";

const AUTO_TICK_MS = 18_000; // la ville « vit » dès qu'on la regarde
const FAULT_REASONS = [
  "Capteur sans signal",
  "Batterie faible",
  "État incohérent (capteur/barrière)",
];

export interface SimRow {
  id: number;
  tick: number;
  rushMode: "auto" | "on" | "off";
  lastTickAt: Date;
}

export async function getSimState(): Promise<SimRow> {
  const rows = await db.select().from(simState).limit(1);
  if (rows[0]) return rows[0];
  const inserted = await db.insert(simState).values({}).returning();
  return inserted[0];
}

export function effectiveRush(sim: SimRow, now: Date = new Date()): boolean {
  if (sim.rushMode === "on") return true;
  if (sim.rushMode === "off") return false;
  return rushInfo(now).rush;
}

async function takeSnapshot(tick: number) {
  const agg = await db.execute<{
    st: string;
    n: string;
    def: string;
  }>(sql`
    SELECT status AS st, COUNT(*)::text AS n,
           COUNT(*) FILTER (WHERE sensor_ok = false)::text AS def
    FROM parking_spots GROUP BY status
  `);
  let free = 0,
    occupied = 0,
    reserved = 0,
    maintenance = 0,
    defective = 0;
  for (const r of agg.rows) {
    const n = Number(r.n);
    defective += Number(r.def);
    if (r.st === "free") free = n;
    else if (r.st === "occupied") occupied = n;
    else if (r.st === "reserved") reserved = n;
    else maintenance = n;
  }
  const rev = await db.execute<{ total: string }>(
    sql`SELECT COALESCE(SUM(amount), 0)::text AS total FROM payments WHERE status = 'success'`,
  );
  await db.insert(snapshots).values({
    tick,
    free,
    occupied,
    reserved,
    maintenance,
    defective,
    revenue: Number(rev.rows[0]?.total ?? 0),
  });
}

export interface TickSummary {
  tick: number;
  changed: number;
  faults: number;
  healed: number;
  rush: boolean;
  occupancyPct: number;
}

/** Un cycle de vie de la ville : arrivées, départs, pannes, battements. */
export async function runTick(): Promise<TickSummary> {
  const sim = await getSimState();
  const rush = effectiveRush(sim);
  const spots = await db.select().from(parkingSpots);

  let changed = 0;
  let faults = 0;
  let healed = 0;
  const now = new Date();

  const arrivalP = rush ? 0.14 : 0.07;
  const departP = rush ? 0.1 : 0.09;

  for (const s of spots) {
    const r = Math.random();
    let nextStatus = s.status;
    if (s.status === "free" && r < arrivalP) nextStatus = "occupied";
    else if (s.status === "occupied" && r < departP) nextStatus = "free";

    // auto-réparation partielle des capteurs (maintenance terrain)
    let sensorOk = s.sensorOk;
    let faultReason = s.sensorFaultReason;
    if (!s.sensorOk && Math.random() < 0.22) {
      sensorOk = true;
      faultReason = null;
      healed++;
      if (s.status === "maintenance" && Math.random() < 0.5) nextStatus = "free";
    }

    const beatFresh =
      sensorOk && now.getTime() - new Date(s.lastHeartbeat).getTime() > 4000;

    if (nextStatus !== s.status || sensorOk !== s.sensorOk || beatFresh) {
      await db
        .update(parkingSpots)
        .set({
          status: nextStatus,
          sensorOk,
          sensorFaultReason: faultReason,
          lastHeartbeat: sensorOk ? now : s.lastHeartbeat,
          updatedAt: now,
        })
        .where(eq(parkingSpots.id, s.id));
      if (nextStatus !== s.status || sensorOk !== s.sensorOk) changed++;
    }
  }

  // panne aléatoire (probabilité modérée, une panne max par tick)
  if (Math.random() < 0.45) {
    const healthy = spots.filter((s) => s.sensorOk);
    if (healthy.length) {
      const victim = healthy[Math.floor(Math.random() * healthy.length)];
      const reason = FAULT_REASONS[Math.floor(Math.random() * FAULT_REASONS.length)];
      const maintenance = reason.includes("incohérent");
      await db
        .update(parkingSpots)
        .set({
          sensorOk: false,
          sensorFaultReason: reason,
          status: maintenance ? "maintenance" : victim.status,
          updatedAt: now,
        })
        .where(eq(parkingSpots.id, victim.id));
      faults++;
      await db.insert(auditEvents).values({
        kind: "sensor.fault",
        lotId: victim.lotId,
        message: `Capteur défectueux sur la place ${victim.code} — ${reason}. Place retirée de l'assignation.`,
        meta: { spotId: victim.id },
      });
    }
  }

  const tick = sim.tick + 1;
  await db
    .update(simState)
    .set({ tick, lastTickAt: now })
    .where(eq(simState.id, sim.id));
  await takeSnapshot(tick);

  const occ = spots.filter((s) => s.status === "occupied").length;
  return {
    tick,
    changed,
    faults,
    healed,
    rush,
    occupancyPct: Math.round((occ / Math.max(1, spots.length)) * 100),
  };
}

/**
 * Auto-tick paresseux : si la simulation dort depuis > {@link AUTO_TICK_MS},
 * un tick s'exécute au premier appel (verrou par update conditionnel).
 */
export async function maybeAutoTick(): Promise<boolean> {
  try {
    const res = await db.execute<{ id: number }>(sql`
      UPDATE sim_state
      SET last_tick_at = now()
      WHERE id = (SELECT id FROM sim_state LIMIT 1)
        AND last_tick_at < now() - (${AUTO_TICK_MS} || ' milliseconds')::interval
      RETURNING id
    `);
    if (res.rows.length > 0) {
      await runTick();
      return true;
    }
  } catch {
    // silencieux — la simulation est un bonus, pas un point de défaillance
  }
  return false;
}

/**
 * Balayage des réservations « pending » expirées : la place est libérée et
 * le conducteur reçoit une pénalité no-show (anti-fausse demande).
 */
export async function sweepExpired(now: Date = new Date()): Promise<number> {
  const stale = await db
    .select()
    .from(reservations)
    .where(and(eq(reservations.status, "pending"), lt(reservations.expiresAt, now)));
  for (const r of stale) {
    await db
      .update(reservations)
      .set({ status: "expired" })
      .where(eq(reservations.id, r.id));
    await db
      .update(parkingSpots)
      .set({ status: "free", updatedAt: now })
      .where(and(eq(parkingSpots.id, r.spotId), eq(parkingSpots.status, "reserved")));
    await db.execute(sql`
      UPDATE users
      SET trust_score = GREATEST(0, LEAST(100, trust_score + ${trustDeltaForEvent("no-show")}))
      WHERE id = ${r.userId}
    `);
    await db.insert(auditEvents).values({
      kind: "reservation.noshow",
      userId: r.userId,
      lotId: r.lotId,
      message: `No-show : réservation ${r.code} expirée sans check-in. Score de confiance −10.`,
      meta: { reservationId: r.id },
    });
  }
  return stale.length;
}

export async function setRushMode(mode: "auto" | "on" | "off") {
  const sim = await getSimState();
  await db.update(simState).set({ rushMode: mode }).where(eq(simState.id, sim.id));
}

export async function breakRandomSensor(): Promise<string | null> {
  const healthy = await db.select().from(parkingSpots).where(eq(parkingSpots.sensorOk, true));
  if (!healthy.length) return null;
  const victim = healthy[Math.floor(Math.random() * healthy.length)];
  const reason = FAULT_REASONS[Math.floor(Math.random() * FAULT_REASONS.length)];
  await db
    .update(parkingSpots)
    .set({ sensorOk: false, sensorFaultReason: reason, updatedAt: new Date() })
    .where(eq(parkingSpots.id, victim.id));
  await db.insert(auditEvents).values({
    kind: "sensor.fault",
    lotId: victim.lotId,
    message: `Panne provoquée (démo) sur ${victim.code} — ${reason}.`,
    meta: { spotId: victim.id },
  });
  return victim.code;
}

export async function healAllSensors(): Promise<number> {
  const broken = await db.select().from(parkingSpots).where(eq(parkingSpots.sensorOk, false));
  const now = new Date();
  for (const s of broken) {
    await db
      .update(parkingSpots)
      .set({
        sensorOk: true,
        sensorFaultReason: null,
        lastHeartbeat: now,
        status: s.status === "maintenance" ? "free" : s.status,
        updatedAt: now,
      })
      .where(eq(parkingSpots.id, s.id));
  }
  if (broken.length) {
    await db.insert(auditEvents).values({
      kind: "sensor.heal",
      message: `Maintenance terminée : ${broken.length} capteur(s) réparé(s), places remises en service.`,
    });
  }
  return broken.length;
}
