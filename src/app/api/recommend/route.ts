/**
 * GET /api/recommend?origin=gN&duration=60
 *
 * Recommandation multi-critères (EF-05) : pour chaque parc, calcul de
 * l'itinéraire optimal (Dijkstra depuis la porte d'entrée), de la
 * disponibilité fiable, du devis et d'un score composite :
 *
 *   score = 100 − 30·t̂ − 20·p̂ − 30·(1−dispo) − 20·défauts
 *
 * (t̂/p̂ normalisés sur l'ensemble des parcs). Chaque recommandation est
 * justifiée en langage naturel — explicabilité pour l'utilisateur final.
 */
import { routeToSvgPath, findRoute, getNode, rushInfo } from "@/lib/geo";
import { quoteParking } from "@/lib/pricing";
import { ensureSeeded } from "@/db/seed";
import { listLotsWithStats } from "@/lib/server";
import { effectiveRush, getSimState } from "@/lib/simulation";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await ensureSeeded();
  const url = new URL(req.url);
  const origin = url.searchParams.get("origin") ?? "gN";
  const duration = Math.max(30, Math.min(720, Number(url.searchParams.get("duration") ?? 60)));

  if (!getNode(origin)) {
    return Response.json({ error: "Origine inconnue" }, { status: 400 });
  }

  const sim = await getSimState();
  const rush = effectiveRush(sim);
  const lots = await listLotsWithStats();

  const routes = lots.map((l) => findRoute(origin, l.nodeKey, { rush }));
  const maxMin = Math.max(...routes.map((r) => r?.minutes ?? 1), 1);
  const maxPrice = Math.max(...lots.map((l) => l.hourlyRate), 1);

  const items = lots
    .map((lot, i) => {
      const route = routes[i];
      if (!route) return null;
      const st = lot.stats;
      const availRatio = st.total ? st.assignable / st.total : 0;
      const defectRatio = st.total ? st.defective / st.total : 0;
      const quote = quoteParking(lot.hourlyRate, duration, rush, null);
      const score = Math.round(
        100 -
          30 * (route.minutes / maxMin) -
          20 * (lot.hourlyRate / maxPrice) -
          30 * (1 - availRatio) -
          20 * defectRatio,
      );

      const reasons: string[] = [];
      reasons.push(`À ${Math.round(route.minutes)} min via ${route.roadNames[0] ?? "le centre"}`);
      if (st.assignable > 0) reasons.push(`${st.assignable} place(s) fiables (capteurs OK)`);
      if (lot.hourlyRate === Math.min(...lots.map((x) => x.hourlyRate)))
        reasons.push(`Le moins cher : ${lot.hourlyRate} DA/h`);
      if (st.defective > 0) reasons.push(`${st.defective} capteur(s) en panne — surveillés`);
      if (st.assignable === 0) reasons.unshift("Complet ou capteurs indisponibles");

      return {
        lot: {
          id: lot.id,
          slug: lot.slug,
          name: lot.name,
          address: lot.address,
          nodeKey: lot.nodeKey,
          hourlyRate: lot.hourlyRate,
          features: lot.features,
        },
        score: Math.max(1, score),
        minutes: route.minutes,
        km: route.km,
        roadNames: route.roadNames,
        pathSvg: routeToSvgPath(route),
        quote,
        assignable: st.assignable,
        occupancyPct: st.total ? Math.round(((st.occupied + st.reserved) / st.total) * 100) : 0,
        defective: st.defective,
        reasons,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b!.score - a!.score);

  return Response.json({
    origin,
    duration,
    rush,
    rushLabel: rushInfo().label,
    items,
  });
}
