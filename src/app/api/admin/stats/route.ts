/**
 * GET /api/admin/stats — tableau de bord décisionnel (EF-12 / entrepôt BI).
 *
 * Fournit : totaux temps réel, recettes par mode de paiement, historique
 * d'occupation (snapshots), capteurs défectueux/muets, journal d'audit,
 * métriques anti-fraude.
 */
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  auditEvents,
  parkingLots,
  parkingSpots,
  payments,
  reservations,
  snapshots,
} from "@/db/schema";
import { ensureSeeded } from "@/db/seed";
import { sensorHealth } from "@/lib/reliability";
import {
  cancelsLastHour,
  getDemoUser,
  listLotsWithStats,
  recentAudit,
} from "@/lib/server";
import { effectiveRush, getSimState, sweepExpired } from "@/lib/simulation";
import { rushInfo } from "@/lib/geo";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSeeded();
  await sweepExpired();

  const [lots, sim, user] = await Promise.all([
    listLotsWithStats(),
    getSimState(),
    getDemoUser(),
  ]);

  const revenue = await db.execute<{ method: string; total: number; n: number }>(sql`
    SELECT method, COALESCE(SUM(amount), 0)::int AS total, COUNT(*)::int AS n
    FROM payments WHERE status = 'success'
    GROUP BY method ORDER BY total DESC
  `);

  const resCounts = await db.execute<{ status: string; n: number }>(sql`
    SELECT status, COUNT(*)::int AS n FROM reservations GROUP BY status
  `);

  const history = await db
    .select()
    .from(snapshots)
    .orderBy(desc(snapshots.tick))
    .limit(36);

  // Capteurs à problème (défectueux ou muets) — surveillance proactive
  const now = new Date();
  const flaggedSpots = await db
    .select({
      id: parkingSpots.id,
      code: parkingSpots.code,
      zone: parkingSpots.zone,
      status: parkingSpots.status,
      sensorOk: parkingSpots.sensorOk,
      sensorFaultReason: parkingSpots.sensorFaultReason,
      lastHeartbeat: parkingSpots.lastHeartbeat,
      lotName: parkingLots.name,
    })
    .from(parkingSpots)
    .innerJoin(parkingLots, eq(parkingSpots.lotId, parkingLots.id))
    .where(eq(parkingSpots.sensorOk, false))
    .orderBy(desc(parkingSpots.updatedAt))
    .limit(40);

  const defective = flaggedSpots.map((s) => ({
    ...s,
    health: sensorHealth({ sensorOk: s.sensorOk, lastHeartbeat: s.lastHeartbeat }, now),
    silentMin: Math.round((now.getTime() - new Date(s.lastHeartbeat).getTime()) / 60_000),
  }));

  const events = await recentAudit(25);
  const cancels = await cancelsLastHour(user.id);

  const totals = {
    capacity: lots.reduce((a, l) => a + l.stats.total, 0),
    free: lots.reduce((a, l) => a + l.stats.free, 0),
    occupied: lots.reduce((a, l) => a + l.stats.occupied, 0),
    reserved: lots.reduce((a, l) => a + l.stats.reserved, 0),
    maintenance: lots.reduce((a, l) => a + l.stats.maintenance, 0),
    defectiveSensors: lots.reduce((a, l) => a + l.stats.defective, 0),
    assignable: lots.reduce((a, l) => a + l.stats.assignable, 0),
  };

  const totalRevenue = revenue.rows.reduce((a, r) => a + Number(r.total), 0);

  return Response.json({
    totals,
    lots: lots.map((l) => ({ id: l.id, name: l.name, slug: l.slug, hourlyRate: l.hourlyRate, stats: l.stats })),
    revenue: {
      byMethod: revenue.rows.map((r) => ({ method: r.method, total: Number(r.total), n: Number(r.n) })),
      total: totalRevenue,
    },
    reservationsByStatus: resCounts.rows.map((r) => ({ status: r.status, n: Number(r.n) })),
    history: history
      .map((h) => ({
        tick: h.tick,
        free: h.free,
        occupied: h.occupied,
        reserved: h.reserved,
        maintenance: h.maintenance,
        defective: h.defective,
        revenue: h.revenue,
        at: h.createdAt,
        occupancyPct: Math.round(((h.occupied + h.reserved) / Math.max(1, h.free + h.occupied + h.reserved + h.maintenance)) * 100),
      }))
      .reverse(),
    defective,
    events: events as (typeof auditEvents.$inferSelect)[],
    fraud: { cancelsLastHour: cancels, trustScore: user.trustScore, userName: user.name },
    sim: {
      tick: sim.tick,
      rushMode: sim.rushMode,
      rush: effectiveRush(sim),
      rushLabel: rushInfo().label,
      lastTickAt: sim.lastTickAt,
    },
    serverTime: now.toISOString(),
  });
}
