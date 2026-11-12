/**
 * GET /api/parkings/[id] — détail d'un parc : places, zones, santé capteurs.
 * La santé (ok | stale | defective) est calculée côté serveur pour éviter
 * toute dérive d'horloge entre client et serveur (fiabilité ENF-03).
 */
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { parkingLots, parkingSpots } from "@/db/schema";
import { ensureSeeded } from "@/db/seed";
import { sensorHealth } from "@/lib/reliability";
import { lotStatsById } from "@/lib/server";
import { sweepExpired } from "@/lib/simulation";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  await ensureSeeded();
  await sweepExpired();
  const { id } = await ctx.params;
  const lotId = Number(id);
  if (!Number.isFinite(lotId)) {
    return Response.json({ error: "Identifiant invalide" }, { status: 400 });
  }

  const lot = await db.select().from(parkingLots).where(eq(parkingLots.id, lotId)).limit(1);
  if (!lot[0]) return Response.json({ error: "Parking introuvable" }, { status: 404 });

  const spots = await db
    .select()
    .from(parkingSpots)
    .where(eq(parkingSpots.lotId, lotId))
    .orderBy(asc(parkingSpots.code));

  const now = new Date();
  const statsMap = await lotStatsById();

  const zones: Record<string, { free: number; total: number; assignable: number }> = {};
  const spotDtos = spots.map((s) => {
    const health = sensorHealth(s, now);
    const z = (zones[s.zone] ??= { free: 0, total: 0, assignable: 0 });
    z.total++;
    if (s.status === "free") z.free++;
    if (s.status === "free" && health === "ok") z.assignable++;
    return {
      id: s.id,
      code: s.code,
      zone: s.zone,
      status: s.status,
      health,
      faultReason: s.sensorFaultReason,
      lastHeartbeat: s.lastHeartbeat,
    };
  });

  return Response.json({
    lot: { ...lot[0], stats: statsMap.get(lotId) },
    zones,
    spots: spotDtos,
    serverTime: now.toISOString(),
  });
}
