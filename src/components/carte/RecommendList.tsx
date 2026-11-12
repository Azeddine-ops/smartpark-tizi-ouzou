"use client";

/** Classement des parcs recommandés (score multi-critères explicable). */
import { motion } from "framer-motion";
import { Navigation, Route as RouteIcon, Trophy } from "lucide-react";
import { formatDA } from "@/lib/pricing";
import { cx } from "@/lib/client";

export interface RecItem {
  lot: { id: number; name: string; address: string; nodeKey: string; hourlyRate: number };
  score: number;
  minutes: number;
  km: number;
  roadNames: string[];
  pathSvg: string;
  assignable: number;
  occupancyPct: number;
  defective: number;
  reasons: string[];
}

interface Props {
  items: RecItem[];
  selectedId: number | null;
  loading: boolean;
  originLabel: string;
  onSelect: (id: number) => void;
  onTrace: (item: RecItem) => void;
  onHover: (pathSvg: string | null) => void;
}

export default function RecommendList({
  items,
  selectedId,
  loading,
  originLabel,
  onSelect,
  onTrace,
  onHover,
}: Props) {
  if (loading && items.length === 0) {
    return (
      <div className="glass animate-pulse space-y-3 rounded-2xl p-5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 rounded-xl bg-white/5" />
        ))}
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-4">
      <p className="mb-3 flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
        <Navigation className="h-3.5 w-3.5 text-cyan-300" />
        Depuis {originLabel}
      </p>
      <div className="space-y-2.5">
        {items.map((it, i) => {
          const top = i === 0;
          const selected = selectedId === it.lot.id;
          return (
            <motion.button
              key={it.lot.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => onSelect(it.lot.id)}
              onMouseEnter={() => onHover(it.pathSvg)}
              onMouseLeave={() => onHover(null)}
              className={cx(
                "w-full rounded-xl border p-3.5 text-left transition-all",
                selected
                  ? "border-cyan-400/50 bg-cyan-400/10 shadow-[0_0_24px_rgba(34,211,238,0.15)]"
                  : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <span
                    className={cx(
                      "grid h-7 w-7 shrink-0 place-items-center rounded-lg font-display text-xs font-bold",
                      top ? "bg-gradient-to-br from-amber-300 to-amber-500 text-slate-950" : "bg-white/10 text-slate-300",
                    )}
                  >
                    {top ? <Trophy className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <div>
                    <p className="font-display text-[13px] font-bold text-slate-100">{it.lot.name}</p>
                    <p className="num-tick mt-0.5 text-[11px] text-slate-400">
                      {Math.round(it.minutes)} min · {it.km} km · {formatDA(it.lot.hourlyRate)}/h
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-display text-lg font-bold leading-none text-emerald-300">{it.score}</p>
                  <p className="mt-0.5 text-[9px] uppercase tracking-wider text-slate-600">score</p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {it.reasons.slice(0, 3).map((r) => (
                  <span key={r} className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">
                    {r}
                  </span>
                ))}
              </div>
              <div className="mt-2.5 flex items-center justify-between">
                <span
                  className={cx(
                    "num-tick text-[11px] font-semibold",
                    it.assignable > 0 ? "text-emerald-300" : "text-rose-300",
                  )}
                >
                  {it.assignable > 0 ? `${it.assignable} places fiables` : "Aucune place fiable"}
                  {it.defective > 0 && <span className="ml-1.5 text-amber-400">· {it.defective} capteur(s) HS</span>}
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onTrace(it);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.stopPropagation();
                      onTrace(it);
                    }
                  }}
                  className="flex items-center gap-1 rounded-lg bg-cyan-400/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-200 transition-colors hover:bg-cyan-400/20"
                >
                  <RouteIcon className="h-3 w-3" />
                  Tracer
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
