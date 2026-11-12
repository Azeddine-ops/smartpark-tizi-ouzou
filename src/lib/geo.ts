/**
 * SIG — Système d'Information Géographique de SmartPark.
 *
 * Graphe routier simplifié de la ville de Tizi-Ouzou (porte Nord/Bouira,
 * porte Est/Azazga, porte Sud/Ouacifs, porte Ouest/Boghni) et optimisation
 * d'itinéraire par l'algorithme de Dijkstra, pondéré par le temps de trajet
 * (classe de route × vitesse × facteur d'heure de pointe, avec prise en
 * compte du vendredi midi — spécificité locale).
 *
 * Coordonnées cartographiques : plan local 1000×730 px (rendu SVG),
 * ≈ 3,4 km de large — échelle {@link PX_TO_KM}.
 *
 * Traçabilité : EF-04 (itinéraire optimisé), EF-05 (recommandation), ENF-02 (perf).
 */

export type RoadClass = "express" | "urban" | "local" | "access";
export type NodeKind = "gate" | "junction" | "lot";

export interface GraphNode {
  key: string;
  label: string;
  x: number;
  y: number;
  kind: NodeKind;
}

export interface EdgeDef {
  a: string;
  b: string;
  klass: RoadClass;
  name?: string;
}

/** Échelle du plan : 1 px ≈ 3,4 m. */
export const PX_TO_KM = 0.0034;

/** Vitesses de base (km/h) par classe de route. */
export const BASE_SPEED: Record<RoadClass, number> = {
  express: 40,
  urban: 27,
  local: 18,
  access: 12,
};

/** Facteur de congestion en heure de pointe (multiplicateur de temps). */
export const RUSH_SLOWDOWN: Record<RoadClass, number> = {
  express: 1.35,
  urban: 1.6,
  local: 1.45,
  access: 1.1,
};

export const NODES: GraphNode[] = [
  // Portes de la ville (origines possibles)
  { key: "gN", label: "Porte Nord · RN-12 (Bouira)", x: 520, y: 36, kind: "gate" },
  { key: "gE", label: "Porte Est · RN-33 (Azazga)", x: 962, y: 270, kind: "gate" },
  { key: "gS", label: "Porte Sud · CW-8 (Ouacifs)", x: 520, y: 694, kind: "gate" },
  { key: "gW", label: "Porte Ouest · CW-147 (Boghni)", x: 38, y: 430, kind: "gate" },
  // Épine nord-sud : Boulevard Abane Ramdane
  { key: "j_spn", label: "Blvd A. Ramdane (Nord)", x: 520, y: 150, kind: "junction" },
  { key: "j_sp2", label: "Carrefour de la Mairie", x: 520, y: 252, kind: "junction" },
  { key: "j_place", label: "Place du 1er Novembre", x: 520, y: 390, kind: "junction" },
  { key: "j_sp4", label: "Carrefour des Écoles", x: 520, y: 500, kind: "junction" },
  { key: "j_sps", label: "Blvd A. Ramdane (Sud)", x: 520, y: 620, kind: "junction" },
  // Quadrant nord-ouest
  { key: "j_nw1", label: "Rue des Frères Ouahab", x: 228, y: 262, kind: "junction" },
  { key: "j_nw2", label: "Rue Aït Ahmed", x: 392, y: 262, kind: "junction" },
  // Quadrant nord-est
  { key: "j_ne1", label: "Rue Colonel Amirouche", x: 658, y: 262, kind: "junction" },
  { key: "j_ne2", label: "RN-33 · Entrée Est", x: 832, y: 262, kind: "junction" },
  // Cercle ouest / est
  { key: "j_w1", label: "Rue de Boghni", x: 142, y: 392, kind: "junction" },
  { key: "j_w2", label: "Rue des Oliviers", x: 322, y: 382, kind: "junction" },
  { key: "j_e1", label: "Rue Si Mohand", x: 722, y: 382, kind: "junction" },
  { key: "j_e2", label: "Sortie Est", x: 902, y: 358, kind: "junction" },
  // Sud
  { key: "j_sw2", label: "Rue de Boukhalfa", x: 392, y: 502, kind: "junction" },
  { key: "j_e3", label: "Rue du Stade", x: 862, y: 472, kind: "junction" },
  { key: "j_s1", label: "Chemin de Tadert", x: 302, y: 622, kind: "junction" },
  { key: "j_s2", label: "Rue de l'Indépendance", x: 742, y: 602, kind: "junction" },
  // Ancrages des parkings (nœuds métier du SIG)
  { key: "L_campus", label: "Campus UMMO · Hasnaoua", x: 300, y: 148, kind: "lot" },
  { key: "L_hopital", label: "Hôpital Nedir Mohamed", x: 742, y: 148, kind: "lot" },
  { key: "L_central", label: "Parking Central", x: 612, y: 338, kind: "lot" },
  { key: "L_stade", label: "Stade du 1er Novembre", x: 928, y: 442, kind: "lot" },
  { key: "L_nouvelle", label: "Nouvelle Ville", x: 222, y: 522, kind: "lot" },
  { key: "L_gare", label: "Gare Routière", x: 700, y: 502, kind: "lot" },
];

export const EDGES: EdgeDef[] = [
  // Épine nord-sud — Boulevard Abane Ramdane (express)
  { a: "gN", b: "j_spn", klass: "express", name: "Boulevard Abane Ramdane" },
  { a: "j_spn", b: "j_sp2", klass: "express", name: "Boulevard Abane Ramdane" },
  { a: "j_sp2", b: "j_place", klass: "express", name: "Boulevard Abane Ramdane" },
  { a: "j_place", b: "j_sp4", klass: "express", name: "Boulevard Abane Ramdane" },
  { a: "j_sp4", b: "j_sps", klass: "express", name: "Boulevard Abane Ramdane" },
  { a: "j_sps", b: "gS", klass: "express", name: "Boulevard Abane Ramdane" },
  // Axe ouest-est — Boulevard du 1er Novembre (express)
  { a: "gW", b: "j_w1", klass: "express", name: "CW-147 (Boghni)" },
  { a: "j_w1", b: "j_w2", klass: "express", name: "Boulevard du 1er Novembre" },
  { a: "j_w2", b: "j_place", klass: "express", name: "Boulevard du 1er Novembre" },
  { a: "j_place", b: "j_e1", klass: "express", name: "Boulevard du 1er Novembre" },
  { a: "j_e1", b: "j_e2", klass: "express", name: "Boulevard du 1er Novembre" },
  { a: "j_e2", b: "gE", klass: "express", name: "RN-33 (Azazga)" },
  // Quadrant nord-ouest (urban)
  { a: "j_spn", b: "L_campus", klass: "urban", name: "Avenue Aïssat Idir" },
  { a: "L_campus", b: "j_nw1", klass: "urban", name: "Rue du Campus" },
  { a: "j_nw1", b: "j_nw2", klass: "urban", name: "Rue des Frères Ouahab" },
  { a: "j_nw2", b: "j_sp2", klass: "urban", name: "Rue Aït Ahmed" },
  // Quadrant nord-est (urban)
  { a: "j_spn", b: "L_hopital", klass: "urban", name: "Rue Colonel Amirouche" },
  { a: "L_hopital", b: "j_ne1", klass: "urban", name: "Rue de l'Hôpital" },
  { a: "j_ne1", b: "j_sp2", klass: "urban", name: "Rue Colonel Amirouche" },
  { a: "j_ne1", b: "j_ne2", klass: "urban", name: "Rue Colonel Amirouche" },
  { a: "j_ne2", b: "gE", klass: "urban", name: "RN-33 (Azazga)" },
  { a: "j_ne2", b: "j_e2", klass: "urban", name: "Rue de la Résistance" },
  // Connexions verticales ouest (urban)
  { a: "j_nw1", b: "j_w1", klass: "urban", name: "Rue de Boghni" },
  { a: "j_nw2", b: "j_w2", klass: "urban", name: "Rue des Oliviers" },
  { a: "j_w1", b: "L_nouvelle", klass: "urban", name: "Rue de la Nouvelle Ville" },
  // Sud (urban)
  { a: "L_nouvelle", b: "j_sw2", klass: "urban", name: "Rue de Boukhalfa" },
  { a: "j_sw2", b: "j_sp4", klass: "urban", name: "Rue de Boukhalfa" },
  { a: "j_sp4", b: "L_gare", klass: "urban", name: "Rue de la Gare" },
  { a: "L_gare", b: "j_e1", klass: "urban", name: "Rue Si Mohand" },
  { a: "L_gare", b: "j_e3", klass: "urban", name: "Rue du Stade" },
  { a: "j_e3", b: "j_e2", klass: "urban", name: "Rue du Stade" },
  { a: "L_nouvelle", b: "j_s1", klass: "urban", name: "Chemin de Tadert" },
  { a: "j_s1", b: "j_sps", klass: "urban", name: "Chemin de Tadert" },
  { a: "j_sps", b: "j_s2", klass: "urban", name: "Rue de l'Indépendance" },
  { a: "j_s2", b: "L_gare", klass: "urban", name: "Rue de l'Indépendance" },
  // Accès parkings (local/access)
  { a: "j_place", b: "L_central", klass: "access", name: "Accès Parking Central" },
  { a: "L_central", b: "j_e1", klass: "access", name: "Accès Parking Central" },
  { a: "j_e3", b: "L_stade", klass: "access", name: "Accès Stade" },
];

const nodeByKey = new Map(NODES.map((n) => [n.key, n]));

export function getNode(key: string): GraphNode | undefined {
  return nodeByKey.get(key);
}

export const GATES = NODES.filter((n) => n.kind === "gate");
export const LOT_NODES = NODES.filter((n) => n.kind === "lot");

interface AdjItem {
  to: string;
  km: number;
  klass: RoadClass;
  name?: string;
}

let adjacency: Map<string, AdjItem[]> | null = null;

/** Construit (mémoïsé) la liste d'adjacence du graphe routier. */
export function buildAdjacency(): Map<string, AdjItem[]> {
  if (adjacency) return adjacency;
  adjacency = new Map();
  const push = (from: string, item: AdjItem) => {
    const arr = adjacency!.get(from) ?? [];
    arr.push(item);
    adjacency!.set(from, arr);
  };
  for (const e of EDGES) {
    const na = nodeByKey.get(e.a);
    const nb = nodeByKey.get(e.b);
    if (!na || !nb) continue;
    const km = Math.hypot(na.x - nb.x, na.y - nb.y) * PX_TO_KM;
    push(e.a, { to: e.b, km, klass: e.klass, name: e.name });
    push(e.b, { to: e.a, km, klass: e.klass, name: e.name });
  }
  return adjacency;
}

export interface RushInfo {
  rush: boolean;
  friday: boolean;
  label: string;
}

/**
 * Heures de pointe à Tizi-Ouzou : 07:30–09:30, 12:00–14:00, 16:30–19:00.
 * Le vendredi, la prière de midi concentre le trafic entre 11:30 et 13:30.
 */
export function rushInfo(now: Date = new Date()): RushInfo {
  const h = now.getHours() + now.getMinutes() / 60;
  const friday = now.getDay() === 5;
  const bands: Array<[number, number]> = [
    [7.5, 9.5],
    [12, 14],
    [16.5, 19],
  ];
  if (friday) bands.push([11.5, 13.5]);
  const rush = bands.some(([s, e]) => h >= s && h < e);
  const label = rush
    ? friday && h >= 11.5 && h < 13.5
      ? "Pic du vendredi midi"
      : "Heure de pointe"
    : "Trafic fluide";
  return { rush, friday, label };
}

/** Temps de parcours d'un tronçon (minutes), congestion comprise. */
export function edgeMinutes(item: AdjItem, rush: boolean): number {
  const speed = BASE_SPEED[item.klass] / (rush ? RUSH_SLOWDOWN[item.klass] : 1);
  return (item.km / speed) * 60;
}

export interface RouteResult {
  /** Clés des nœuds, de l'origine vers la destination. */
  pathKeys: string[];
  /** Nœuds avec coordonnées (pour le rendu SVG). */
  points: GraphNode[];
  km: number;
  minutes: number;
  /** Noms de voies empruntées (dédoublonnés, dans l'ordre). */
  roadNames: string[];
  rushApplied: boolean;
}

/**
 * Optimisation d'itinéraire — algorithme de Dijkstra (coût : minutes).
 * @returns itinéraire optimal ou `null` si destination inaccessible.
 */
export function findRoute(
  fromKey: string,
  toKey: string,
  opts: { rush?: boolean } = {},
): RouteResult | null {
  const rush = opts.rush ?? rushInfo().rush;
  const adj = buildAdjacency();
  if (!adj.has(fromKey) || !adj.has(toKey)) return null;

  const dist = new Map<string, number>([[fromKey, 0]]);
  const kmMap = new Map<string, number>([[fromKey, 0]]);
  const prev = new Map<string, { from: string; name?: string }>();
  const visited = new Set<string>();

  while (true) {
    // Sélection du sommet le plus proche (file de priorité naïve — graphe petit).
    let current: string | null = null;
    let best = Infinity;
    for (const [k, d] of dist) {
      if (!visited.has(k) && d < best) {
        best = d;
        current = k;
      }
    }
    if (current === null) break;
    if (current === toKey) break;
    visited.add(current);

    for (const it of adj.get(current) ?? []) {
      const w = edgeMinutes(it, rush);
      const nd = best + w;
      if (nd < (dist.get(it.to) ?? Infinity)) {
        dist.set(it.to, nd);
        kmMap.set(it.to, (kmMap.get(current) ?? 0) + it.km);
        prev.set(it.to, { from: current, name: it.name });
      }
    }
  }

  if (!dist.has(toKey)) return null;

  const pathKeys: string[] = [];
  const roadNames: string[] = [];
  let cur: string | undefined = toKey;
  while (cur) {
    pathKeys.unshift(cur);
    const p = prev.get(cur);
    if (p?.name && roadNames[0] !== p.name) roadNames.unshift(p.name);
    cur = p?.from;
  }

  return {
    pathKeys,
    points: pathKeys.map((k) => nodeByKey.get(k)!),
    km: Math.round((kmMap.get(toKey) ?? 0) * 100) / 100,
    minutes: Math.round((dist.get(toKey) ?? 0) * 10) / 10,
    roadNames,
    rushApplied: rush,
  };
}

/** Chaîne `d` SVG (polyline) pour un itinéraire. */
export function routeToSvgPath(route: RouteResult): string {
  return route.points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");
}

/** Longueur cumulée px d'une polyline (pour animation du véhicule). */
export function pathLengthPx(points: GraphNode[]): number {
  let sum = 0;
  for (let i = 1; i < points.length; i++) {
    sum += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return sum;
}
