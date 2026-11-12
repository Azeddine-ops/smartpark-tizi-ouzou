/** Helpers serveur partagés entre les routes API. */
import { and, count, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditEvents, parkingLots, reservations, users } from "@/db/schema";
import { ensureSeeded } from "@/db/seed";

export type UserRow = typeof users.$inferSelect;
export type LotRow = typeof parkingLots.$inferSelect;

export async function getDemoUser(): Promise<UserRow> {
  await ensureSeeded();
  const rows = await db.select().from(users).orderBy(users.id).limit(1);
  return rows[0];
}

/** Nombre d'annulations du conducteur sur la dernière heure (anti-fraude). */
export async function cancelsLastHour(userId: number): Promise<number> {
  const rows = await db
    .select({ n: count() })
    .from(auditEvents)
    .where(
      and(
        eq(auditEvents.userId, userId),
        eq(auditEvents.kind, "reservation.cancel"),
        gte(auditEvents.createdAt, new Date(Date.now() - 3_600_000)),
      ),
    );
  return rows[0]?.n ?? 0;
}

/** Réservations simultanées (en attente ou actives). */
export async function activeReservationsCount(userId: number): Promise<number> {
  const rows = await db
    .select({ n: count() })
    .from(reservations)
    .where(
      and(
        eq(reservations.userId, userId),
        inArray(reservations.status, ["pending", "active"]),
      ),
    );
  return rows[0]?.n ?? 0;
}

export interface LotStats {
  total: number;
  free: number;
  occupied: number;
  reserved: number;
  maintenance: number;
  defective: number;
  /** Places libres ET à capteur fiable — seules celles-ci sont proposées. */
  assignable: number;
}

const AGG_SQL = sql<{
  lot_id: number;
  total: number;
  free: number;
  occupied: number;
  reserved: number;
  maintenance: number;
  defective: number;
  assignable: number;
}>`
  SELECT
    lot_id,
    COUNT(*)::int                                        AS total,
    COUNT(*) FILTER (WHERE status = 'free')::int         AS free,
    COUNT(*) FILTER (WHERE status = 'occupied')::int     AS occupied,
    COUNT(*) FILTER (WHERE status = 'reserved')::int     AS reserved,
    COUNT(*) FILTER (WHERE status = 'maintenance')::int  AS maintenance,
    COUNT(*) FILTER (WHERE sensor_ok = false)::int       AS defective,
    COUNT(*) FILTER (
      WHERE status = 'free' AND sensor_ok = true
        AND last_heartbeat > now() - interval '10 minutes'
    )::int                                               AS assignable
  FROM parking_spots
  GROUP BY lot_id
`;

export async function lotStatsById(): Promise<Map<number, LotStats>> {
  const res = await db.execute(AGG_SQL);
  const map = new Map<number, LotStats>();
  for (const r of res.rows) {
    map.set(Number(r.lot_id), {
      total: Number(r.total),
      free: Number(r.free),
      occupied: Number(r.occupied),
      reserved: Number(r.reserved),
      maintenance: Number(r.maintenance),
      defective: Number(r.defective),
      assignable: Number(r.assignable),
    });
  }
  return map;
}

export async function listLotsWithStats() {
  const lots = await db.select().from(parkingLots).orderBy(parkingLots.id);
  const stats = await lotStatsById();
  return lots.map((l) => ({
    ...l,
    stats:
      stats.get(l.id) ?? {
        total: 0,
        free: 0,
        occupied: 0,
        reserved: 0,
        maintenance: 0,
        defective: 0,
        assignable: 0,
      },
  }));
}

export async function recentAudit(limit = 25) {
  return db.select().from(auditEvents).orderBy(desc(auditEvents.createdAt)).limit(limit);
}

export { desc };
