"use client";

/**
 * Salle de contrôle — pilote la simulation temps réel (EF-12).
 * Partagé entre la carte (démonstration) et l'administration.
 */
import { useState } from "react";
import { Activity, Clock, FlaskConical, HeartPulse, RefreshCw, Zap } from "lucide-react";
import { cx, postJSON } from "@/lib/client";

interface Props {
  sim: { tick: number; rushMode: "auto" | "on" | "off"; rush: boolean; rushLabel: string };
  onDone?: () => void;
  compact?: boolean;
}

export default function SimPanel({ sim, onDone, compact = false }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action);
    try {
      const res = await postJSON<Record<string, unknown>>("/api/simulate", { action, ...extra });
      if (action === "tick" && res.summary) {
        const s = res.summary as { changed: number; faults: number; healed: number; occupancyPct: number };
        setNote(`Cycle ${s.changed > 0 ? `${s.changed} mouvement(s)` : "calme"} · ${s.faults} panne · ${s.healed} réparation · occupation ${s.occupancyPct} %`);
      } else if (action === "break") {
        setNote(res.broken ? `Panne provoquée sur ${res.broken} — place retirée de l'assignation` : "Aucun capteur sain à casser");
      } else if (action === "heal") {
        setNote(`${res.healed} capteur(s) réparé(s) — places remises en service`);
      } else if (action === "reset") {
        setNote("Nouvelle journée simulée : occupation réamorcée");
      } else if (action === "rush") {
        setNote("Mode heure de pointe mis à jour");
      }
      onDone?.();
    } catch {
      setNote("Échec de la simulation");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={cx("glass rounded-2xl p-4", !compact && "shadow-xl")}>
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-widest text-slate-400">
          <FlaskConical className="h-4 w-4 text-cyan-300" />
          Salle de contrôle
        </p>
        <span className="num-tick rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-slate-500">
          cycle n°{sim.tick}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => void act("tick")}
          disabled={busy !== null}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-400 to-cyan-500 px-3 py-1.5 text-[12px] font-semibold text-slate-950 transition-transform hover:scale-[1.03] disabled:opacity-50"
        >
          <Activity className={cx("h-3.5 w-3.5", busy === "tick" && "animate-spin")} />
          Vivre 1 cycle
        </button>
        <button
          onClick={() => void act("break")}
          disabled={busy !== null}
          className="flex items-center gap-1.5 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-1.5 text-[12px] font-medium text-rose-300 transition-colors hover:bg-rose-500/20 disabled:opacity-50"
        >
          <Zap className="h-3.5 w-3.5" />
          Casser un capteur
        </button>
        <button
          onClick={() => void act("heal")}
          disabled={busy !== null}
          className="flex items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-[12px] font-medium text-emerald-300 transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
        >
          <HeartPulse className="h-3.5 w-3.5" />
          Réparer capteurs
        </button>
        <button
          onClick={() => void act("reset")}
          disabled={busy !== null}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] font-medium text-slate-300 transition-colors hover:bg-white/10 disabled:opacity-50"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Nouveau jour
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <Clock className="h-3.5 w-3.5" />
          Heure de pointe :
        </span>
        {(["auto", "on", "off"] as const).map((m) => (
          <button
            key={m}
            onClick={() => void act("rush", { mode: m })}
            disabled={busy !== null}
            className={cx(
              "rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition-colors",
              sim.rushMode === m
                ? "bg-amber-400/20 text-amber-300 ring-1 ring-amber-400/40"
                : "bg-white/5 text-slate-500 hover:text-slate-300",
            )}
          >
            {m === "auto" ? "Auto" : m === "on" ? "Forcée" : "Creuse"}
          </button>
        ))}
        <span
          className={cx(
            "rounded-full px-2.5 py-1 text-[11px] font-medium",
            sim.rush ? "bg-amber-400/15 text-amber-300" : "bg-emerald-400/10 text-emerald-300",
          )}
        >
          {sim.rush ? "Trafic dense (+25 % DA, ×1,5 temps)" : sim.rushLabel}
        </span>
      </div>

      {note && (
        <p className="mt-3 rounded-lg border border-white/5 bg-black/30 px-3 py-2 text-[11px] leading-relaxed text-slate-400">
          {note}
        </p>
      )}
    </div>
  );
}
