/**
 * GET /api/parkings — état temps réel de tous les parcs (EF-01, EF-02).
 * Chaque appel : balaie les no-shows expirés et fait vivre la simulation
 * (tick paresseux) — la ville bouge tant qu'on la regarde.
 */
import { ensureSeeded } from "@/db/seed";
import { rushInfo } from "@/lib/geo";
import { listLotsWithStats, getDemoUser } from "@/lib/server";
import {
  effectiveRush,
  getSimState,
  maybeAutoTick,
  sweepExpired,
} from "@/lib/simulation";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSeeded();
  await sweepExpired();
  await maybeAutoTick();
  await Promise.resolve(); // laisse le tick se propager avant la lecture

  const [lots, sim, user] = await Promise.all([
    listLotsWithStats(),
    getSimState(),
    getDemoUser(),
  ]);
  const rush = effectiveRush(sim);
  const now = new Date();

  return Response.json({
    lots: lots.map((l) => ({
      id: l.id,
      slug: l.slug,
      name: l.name,
      address: l.address,
      nodeKey: l.nodeKey,
      lat: l.lat,
      lng: l.lng,
      hourlyRate: l.hourlyRate,
      openHour: l.openHour,
      closeHour: l.closeHour,
      features: l.features,
      stats: l.stats,
      occupancyPct: l.stats.total
        ? Math.round(((l.stats.occupied + l.stats.reserved) / l.stats.total) * 100)
        : 0,
    })),
    totals: {
      capacity: lots.reduce((a, l) => a + l.stats.total, 0),
      free: lots.reduce((a, l) => a + l.stats.free, 0),
      assignable: lots.reduce((a, l) => a + l.stats.assignable, 0),
      occupied: lots.reduce((a, l) => a + l.stats.occupied, 0),
      reserved: lots.reduce((a, l) => a + l.stats.reserved, 0),
      defectiveSensors: lots.reduce((a, l) => a + l.stats.defective, 0),
    },
    sim: {
      tick: sim.tick,
      rushMode: sim.rushMode,
      rush,
      rushLabel: rushInfo(now).label,
      lastTickAt: sim.lastTickAt,
    },
    user: { name: user.name, plate: user.plate, trustScore: user.trustScore },
    serverTime: now.toISOString(),
  });
}
