"use client";

/**
 * Carte SIG interactive de Tizi-Ouzou — rendu vectoriel 100 % local
 * (aucune tuile externe requise : démonstration portable hors-ligne).
 *
 * Couches : relief stylisé → routes (RN/CW/urbaines) → toponymes →
 * portes d'entrée → parcs (anneau d'occupation temps réel) → itinéraire
 * optimal animé (véhicule en animateMotion SMIL).
 */
import { motion } from "framer-motion";
import { EDGES, NODES, getNode } from "@/lib/geo";
import { cx } from "@/lib/client";

export interface MapLotStat {
  total: number;
  free: number;
  assignable: number;
  defective: number;
}

export interface MapLot {
  id: number;
  name: string;
  shortName: string;
  nodeKey: string;
  hourlyRate: number;
  occupancyPct: number;
  stats: MapLotStat;
}

export interface MapRoute {
  pathSvg: string;
  points: { x: number; y: number }[];
  minutes: number;
  km: number;
}

interface Props {
  lots: MapLot[];
  originKey: string;
  selectedLotId: number | null;
  route: MapRoute | null;
  previewSvg?: string | null;
  onSelectLot: (id: number) => void;
  onSelectOrigin: (key: string) => void;
}

const ROAD_STYLE: Record<string, { stroke: string; width: number }> = {
  express: { stroke: "#3b4c68", width: 8 },
  urban: { stroke: "#26334c", width: 5 },
  local: { stroke: "#1c2740", width: 3.5 },
  access: { stroke: "#1a2740", width: 3 },
};

function occColor(pct: number): string {
  if (pct < 40) return "#34d399";
  if (pct < 75) return "#fbbf24";
  return "#fb7185";
}

export default function ParkingMap({
  lots,
  originKey,
  selectedLotId,
  route,
  previewSvg,
  onSelectLot,
  onSelectOrigin,
}: Props) {
  const lotByNode = new Map(lots.map((l) => [l.nodeKey, l]));

  // Libellés de voies : une occurrence (la plus longue) par nom unique.
  const labelByName = new Map<string, { x: number; y: number; angle: number; len: number }>();
  for (const e of EDGES) {
    if (!e.name) continue;
    const a = getNode(e.a)!;
    const b = getNode(e.b)!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    let angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    if (angle > 90 || angle < -90) angle += 180;
    const cur = labelByName.get(e.name);
    if (!cur || len > cur.len) {
      labelByName.set(e.name, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, angle, len });
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="relative overflow-hidden rounded-3xl border border-white/10 shadow-[0_20px_80px_rgba(2,8,23,0.6)]"
    >
      <svg viewBox="0 0 1000 730" className="block h-auto w-full select-none">
        <defs>
          <radialGradient id="land" cx="50%" cy="42%" r="80%">
            <stop offset="0%" stopColor="#0c1526" />
            <stop offset="70%" stopColor="#080e1c" />
            <stop offset="100%" stopColor="#060a14" />
          </radialGradient>
          <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
            <circle cx="1.2" cy="1.2" r="1.2" fill="#16223c" />
          </pattern>
          <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="routeGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
        </defs>

        {/* Fond + relief stylisé (montagnes de Kabylie) */}
        <rect x="0" y="0" width="1000" height="730" fill="url(#land)" />
        <rect x="0" y="0" width="1000" height="730" fill="url(#grid)" opacity="0.55" />
        <ellipse cx="120" cy="60" rx="260" ry="90" fill="#0d1830" opacity="0.8" />
        <ellipse cx="900" cy="700" rx="300" ry="100" fill="#0c1730" opacity="0.7" />
        <ellipse cx="60" cy="690" rx="180" ry="70" fill="#0b1428" opacity="0.8" />

        {/* Routes */}
        {EDGES.map((e, i) => {
          const a = getNode(e.a)!;
          const b = getNode(e.b)!;
          const st = ROAD_STYLE[e.klass];
          return (
            <g key={i} pointerEvents="none">
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={st.stroke} strokeWidth={st.width} strokeLinecap="round" />
              {e.klass === "express" && (
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="rgba(148,197,255,0.35)"
                  strokeWidth={1.4}
                  className="road-dash"
                />
              )}
            </g>
          );
        })}

        {/* Toponymes */}
        {Array.from(labelByName.entries()).map(([name, l]) => (
          <text
            key={name}
            x={l.x}
            y={l.y - 6}
            transform={`rotate(${l.angle} ${l.x} ${l.y - 6})`}
            textAnchor="middle"
            fontSize="9.5"
            fill="#64748b"
            pointerEvents="none"
            style={{ letterSpacing: 0.4 }}
          >
            {name}
          </text>
        ))}

        {/* Jonctions */}
        {NODES.filter((n) => n.kind === "junction").map((n) => (
          <circle key={n.key} cx={n.x} cy={n.y} r="2.4" fill="#3b4c68" pointerEvents="none" />
        ))}

        {/* Prévisualisation d'itinéraire (survol recommandation) */}
        {previewSvg && !route && (
          <path
            d={previewSvg}
            fill="none"
            stroke="rgba(148,163,184,0.5)"
            strokeWidth={3.5}
            strokeDasharray="3 9"
            strokeLinecap="round"
            pointerEvents="none"
          />
        )}

        {/* Itinéraire optimal animé */}
        {route && (
          <g pointerEvents="none">
            <path d={route.pathSvg} fill="none" stroke="rgba(34,211,238,0.18)" strokeWidth={13} strokeLinecap="round" filter="url(#glow)" />
            <path
              d={route.pathSvg}
              fill="none"
              stroke="url(#routeGrad)"
              strokeWidth={4.5}
              strokeLinecap="round"
              className="road-dash"
            />
            <circle r={6.5} fill="#ecfeff" stroke="#0891b2" strokeWidth={2.5} filter="url(#glow)">
              <animateMotion dur={`${Math.max(4, route.minutes * 1.4)}s`} repeatCount="indefinite" path={route.pathSvg} />
            </circle>
          </g>
        )}

        {/* Portes d'entrée */}
        {NODES.filter((n) => n.kind === "gate").map((g) => {
          const active = originKey === g.key;
          return (
            <g
              key={g.key}
              onClick={() => onSelectOrigin(g.key)}
              className="cursor-pointer"
              role="button"
              aria-label={`Origine : ${g.label}`}
            >
              {active && (
                <circle cx={g.x} cy={g.y} r={16} fill="none" stroke="#34d399" strokeWidth={1.4} className="animate-ping-slow" style={{ transformBox: "fill-box", transformOrigin: "center" }} />
              )}
              <rect
                x={g.x - 7}
                y={g.y - 7}
                width={14}
                height={14}
                rx={3}
                transform={`rotate(45 ${g.x} ${g.y})`}
                fill={active ? "#064e3b" : "#101a2c"}
                stroke={active ? "#34d399" : "#475569"}
                strokeWidth={active ? 2 : 1.2}
              />
              <circle cx={g.x} cy={g.y} r={2.4} fill={active ? "#6ee7b7" : "#94a3b8"} />
              <text
                x={g.x}
                y={g.y + (g.y < 60 ? 30 : g.y > 660 ? -22 : -20)}
                textAnchor="middle"
                fontSize="9.5"
                fontWeight={600}
                fill={active ? "#6ee7b7" : "#7d8aa5"}
              >
                {g.label}
              </text>
            </g>
          );
        })}

        {/* Parcs de stationnement — anneau d'occupation */}
        {lots.map((lot) => {
          const node = lotByNode.get(lot.nodeKey) ? getNode(lot.nodeKey)! : null;
          if (!node) return null;
          const pct = Math.min(100, Math.max(2, lot.occupancyPct));
          const R = 20;
          const C = 2 * Math.PI * R;
          const color = occColor(lot.occupancyPct);
          const selected = selectedLotId === lot.id;
          return (
            <g
              key={lot.id}
              onClick={() => onSelectLot(lot.id)}
              className="lot-pin cursor-pointer"
              role="button"
              aria-label={lot.name}
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
            >
              {selected && (
                <circle cx={node.x} cy={node.y} r={26} fill="none" stroke="#22d3ee" strokeWidth={1.5} className="animate-ping-slow" style={{ transformBox: "fill-box", transformOrigin: "center" }} />
              )}
              {/* anneau d'occupation */}
              <circle
                cx={node.x}
                cy={node.y}
                r={R}
                fill="none"
                stroke="#152238"
                strokeWidth={5}
              />
              <circle
                cx={node.x}
                cy={node.y}
                r={R}
                fill="none"
                stroke={color}
                strokeWidth={5}
                strokeLinecap="round"
                strokeDasharray={`${(C * pct) / 100} ${C}`}
                transform={`rotate(-90 ${node.x} ${node.y})`}
                style={{ transition: "stroke-dasharray .6s ease, stroke .6s ease" }}
              />
              {/* pastille centrale */}
              <circle
                cx={node.x}
                cy={node.y}
                r={14.5}
                fill={selected ? "#0e2a3a" : "#0c1424"}
                stroke={selected ? "#22d3ee" : "rgba(255,255,255,0.14)"}
                strokeWidth={selected ? 1.8 : 1.1}
              />
              <text x={node.x} y={node.y - 1.5} textAnchor="middle" fontSize="9.5" fontWeight={800} fill={color}>
                P
              </text>
              <text x={node.x} y={node.y + 8.5} textAnchor="middle" fontSize="8.5" fontWeight={700} fill="#e2e8f0" className="num-tick">
                {lot.stats.assignable}
              </text>
              {/* badge capteurs */}
              {lot.stats.defective > 0 && (
                <g>
                  <circle cx={node.x + 14} cy={node.y - 14} r={6.5} fill="#451a03" stroke="#fbbf24" strokeWidth={1.2} />
                  <text x={node.x + 14} y={node.y - 11} textAnchor="middle" fontSize="8" fontWeight={800} fill="#fbbf24">
                    !
                  </text>
                </g>
              )}
              {/* étiquette */}
              <text
                x={node.x}
                y={node.y + 40}
                textAnchor="middle"
                fontSize="9.5"
                fontWeight={selected ? 700 : 600}
                fill={selected ? "#a5f3fc" : "#93a4bf"}
              >
                {lot.shortName}
              </text>
              <text x={node.x} y={node.y + 51} textAnchor="middle" fontSize="8" fill="#5b6b8c" className="num-tick">
                {lot.hourlyRate} DA/h
              </text>
            </g>
          );
        })}

        {/* Boussole */}
        <g transform="translate(952 60)" opacity={0.8} pointerEvents="none">
          <circle r={15} fill="none" stroke="#334155" strokeWidth={1} />
          <path d="M0 -10 L4 4 L0 1 L-4 4 Z" fill="#34d399" />
          <text y={26} textAnchor="middle" fontSize="8.5" fill="#64748b" fontWeight={700}>
            N
          </text>
        </g>

        <text x={16} y={716} fontSize="9" fill="#3f4c66" pointerEvents="none">
          Tizi-Ouzou · plan simplifié — données SIG locales · échelle ≈ 3,4 km
        </text>
      </svg>

      <style jsx>{`
        .lot-pin {
          transition: transform 0.25s ease;
        }
        .lot-pin:hover {
          transform: scale(1.14);
        }
      `}</style>
    </motion.div>
  );
}
