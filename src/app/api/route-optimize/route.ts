/**
 * GET /api/route-optimize?origin=gN&lotId=3
 *
 * Itinéraire optimal porte d'entrée → parking (EF-04) via Dijkstra sur le
 * graphe routier SIG, pondéré par la congestion active (heure de pointe).
 */
import { parkingLots } from "@/db/schema";
import { db } from "@/db";
import { eq } from "drizzle-orm";
import { ensureSeeded } from "@/db/seed";
import { findRoute, getNode, routeToSvgPath } from "@/lib/geo";
import { effectiveRush, getSimState } from "@/lib/simulation";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await ensureSeeded();
  const url = new URL(req.url);
  const origin = url.searchParams.get("origin") ?? "gN";
  const lotId = Number(url.searchParams.get("lotId"));

  if (!getNode(origin) || !Number.isFinite(lotId)) {
    return Response.json({ error: "Paramètres invalides" }, { status: 400 });
  }

  const lot = await db.select().from(parkingLots).where(eq(parkingLots.id, lotId)).limit(1);
  if (!lot[0]) return Response.json({ error: "Parking introuvable" }, { status: 404 });

  const sim = await getSimState();
  const rush = effectiveRush(sim);
  const route = findRoute(origin, lot[0].nodeKey, { rush });
  if (!route) {
    return Response.json({ error: "Aucun itinéraire trouvé" }, { status: 404 });
  }

  return Response.json({
    origin,
    lot: { id: lot[0].id, name: lot[0].name, nodeKey: lot[0].nodeKey },
    pathKeys: route.pathKeys,
    pathSvg: routeToSvgPath(route),
    points: route.points.map((p) => ({ x: p.x, y: p.y, label: p.label })),
    km: route.km,
    minutes: route.minutes,
    roadNames: route.roadNames,
    rushApplied: route.rushApplied,
  });
}
