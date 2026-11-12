"use client";

/**
 * Panneau de détail d'un parc : occupation par zone, santé capteurs,
 * devis calculé en direct et réservation atomique (un clic).
 * Gère les trois issues métier : succès (QR), conflit (alternatives),
 * blocage anti-fraude (429).
 */
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BadgeCheck,
  Clock4,
  Hourglass,
  MapPinned,
  Route,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Waypoints,
} from "lucide-react";
import { formatDA, quoteParking } from "@/lib/pricing";
import { cx, postJSON } from "@/lib/client";
import QRBadge from "@/components/QRBadge";

export interface LotDetailData {
  lot: {
    id: number;
    name: string;
    address: string;
    hourlyRate: number;
    features: string[];
    openHour: number;
    closeHour: number;
    stats: {
      total: number;
      free: number;
      occupied: number;
      reserved: number;
      maintenance: number;
      defective: number;
      assignable: number;
    };
  };
  zones: Record<string, { free: number; total: number; assignable: number }>;
}

interface Props {
  detail: LotDetailData | null;
  loading: boolean;
  durationMin: number;
  onDurationChange: (v: number) => void;
  rush: boolean;
  onTrace: () => void;
  onSelectLot: (id: number) => void;
  onChanged: () => void;
}

interface Success {
  code: string;
  spotCode: string;
  zone: string;
  expiresAt: string;
  total: number;
}

interface Conflict {
  error: string;
  lotName: string;
  alternatives: { id: number; name: string; assignable: number; hourlyRate: number }[];
}

const DURATIONS = [
  { v: 30, l: "30 min" },
  { v: 60, l: "1 h" },
  { v: 120, l: "2 h" },
  { v: 180, l: "3 h" },
  { v: 300, l: "5 h" },
];

function useCountdown(target: string | null) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!target) return;
    const t = () => setLeft(Math.max(0, new Date(target).getTime() - Date.now()));
    t();
    const id = setInterval(t, 1000);
    return () => clearInterval(id);
  }, [target]);
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function LotDetails({
  detail,
  loading,
  durationMin,
  onDurationChange,
  rush,
  onTrace,
  onSelectLot,
  onChanged,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<Success | null>(null);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [fraud, setFraud] = useState<string | null>(null);
  const countdown = useCountdown(success?.expiresAt ?? null);

  // réinitialise les états lors du changement de parc
  useEffect(() => {
    setSuccess(null);
    setConflict(null);
    setFraud(null);
  }, [detail?.lot.id]);

  if (!detail && loading) {
    return (
      <div className="glass animate-pulse rounded-2xl p-6">
        <div className="h-5 w-2/3 rounded bg-white/10" />
        <div className="mt-3 h-3 w-1/2 rounded bg-white/5" />
        <div className="mt-6 h-24 rounded-xl bg-white/5" />
      </div>
    );
  }
  if (!detail) return null;

  const { lot } = detail;
  const st = lot.stats;
  const quote = quoteParking(lot.hourlyRate, durationMin, rush, null);
  const cardQuote = quoteParking(lot.hourlyRate, durationMin, rush, "cib");

  async function reserve() {
    setBusy(true);
    setConflict(null);
    setFraud(null);
    try {
      const res = await postJSON<{
        reservation: { code: string; spotCode: string; zone: string; expiresAt: string };
        quote: { total: number };
      }>("/api/reservations", { lotId: lot.id, durationMin });
      setSuccess({
        code: res.reservation.code,
        spotCode: res.reservation.spotCode,
        zone: res.reservation.zone,
        expiresAt: res.reservation.expiresAt,
        total: res.quote.total,
      });
      onChanged();
    } catch (e) {
      const err = e as Error & { status?: number; payload?: Record<string, unknown> };
      if (err.status === 409 && err.payload?.alternatives) {
        setConflict(err.payload as unknown as Conflict);
      } else if (err.status === 429) {
        setFraud(err.message);
      } else {
        setFraud(err.message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass flex h-full flex-col rounded-2xl p-5">
      <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
        <MapPinned className="h-3.5 w-3.5 text-emerald-400" />
        {lot.address}
      </p>
      <h3 className="font-display mt-1 text-xl font-bold text-slate-50">{lot.name}</h3>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
        <span className="flex items-center gap-1">
          <Clock4 className="h-3 w-3" /> {String(lot.openHour).padStart(2, "0")}:00 – {String(lot.closeHour).padStart(2, "0")}:00
        </span>
        {lot.features.map((f) => (
          <span key={f} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
            {f}
          </span>
        ))}
      </div>

      {/* Occupation */}
      <div className="mt-4">
        <div className="flex h-2.5 overflow-hidden rounded-full bg-white/5">
          <span className="bg-rose-400/80" style={{ width: `${(st.occupied / st.total) * 100}%` }} />
          <span className="bg-amber-400/80" style={{ width: `${(st.reserved / st.total) * 100}%` }} />
          <span className="bg-violet-400/70" style={{ width: `${(st.maintenance / st.total) * 100}%` }} />
          <span className="bg-emerald-400/80" style={{ width: `${(st.free / st.total) * 100}%` }} />
        </div>
        <div className="num-tick mt-2 grid grid-cols-4 gap-1 text-center text-[10px] text-slate-500">
          <span><b className="block text-sm text-emerald-300">{st.free}</b>libres</span>
          <span><b className="block text-sm text-rose-300">{st.occupied}</b>occupées</span>
          <span><b className="block text-sm text-amber-300">{st.reserved}</b>réservées</span>
          <span><b className="block text-sm text-violet-300">{st.maintenance}</b>maintenance</span>
        </div>
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-cyan-400/20 bg-cyan-400/5 px-3 py-2 text-[11px] text-cyan-200">
          <ShieldCheck className="h-4 w-4 shrink-0 text-cyan-300" />
          <span>
            <b className="num-tick">{st.assignable}</b> places certifiées fiables
            {st.defective > 0 && (
              <> — {st.defective} capteur(s) en panne : places exclues de l'assignation</>
            )}
          </span>
        </div>
      </div>

      {/* Zones */}
      <div className="mt-4 flex flex-wrap gap-2">
        {Object.entries(detail.zones).map(([zone, z]) => (
          <span
            key={zone}
            className={cx(
              "rounded-lg border px-2.5 py-1.5 text-[11px]",
              z.assignable > 0
                ? "border-emerald-400/20 bg-emerald-400/5 text-emerald-200"
                : "border-white/10 bg-white/5 text-slate-500",
            )}
          >
            Zone {zone} · <b className="num-tick">{z.assignable}</b>/{z.total} fiables
          </span>
        ))}
      </div>

      {/* Durée + devis */}
      <div className="mt-5">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-500">Durée prévue</p>
        <div className="flex gap-1.5">
          {DURATIONS.map((d) => (
            <button
              key={d.v}
              onClick={() => onDurationChange(d.v)}
              className={cx(
                "flex-1 rounded-lg px-1 py-1.5 text-[11px] font-medium transition-colors",
                durationMin === d.v
                  ? "bg-emerald-400/20 text-emerald-200 ring-1 ring-emerald-400/40"
                  : "bg-white/5 text-slate-400 hover:bg-white/10",
              )}
            >
              {d.l}
            </button>
          ))}
        </div>
        <div className="num-tick mt-3 space-y-1 rounded-xl border border-white/10 bg-black/30 p-3 text-[12px] text-slate-400">
          <p className="flex justify-between">
            <span>{formatDA(lot.hourlyRate)} × {durationMin / 60} h</span>
            <span>{formatDA(quote.base)}</span>
          </p>
          {rush && (
            <p className="flex justify-between text-amber-300">
              <span>Heure de pointe (+25 %)</span>
              <span>+{formatDA(quote.rushSurcharge)}</span>
            </p>
          )}
          <p className="flex justify-between border-t border-white/10 pt-1.5 font-display text-sm font-bold text-slate-100">
            <span>Estimation</span>
            <span>{formatDA(quote.total)}</span>
          </p>
          <p className="text-[10px] text-emerald-300/80">
            Soit {formatDA(cardQuote.total)} en payant par CIB / Edahabia (−5 %)
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => void reserve()}
          disabled={busy || st.assignable === 0}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-500 px-4 py-3 font-display text-sm font-bold text-slate-950 shadow-[0_8px_30px_rgba(52,211,153,0.35)] transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <BadgeCheck className="h-4 w-4" />
          {busy ? "Attribution…" : st.assignable === 0 ? "Aucune place fiable" : "Réserver une place fiable"}
        </button>
        <button
          onClick={onTrace}
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-200 transition-colors hover:bg-white/10"
        >
          <Route className="h-4 w-4 text-cyan-300" />
          Itinéraire
        </button>
      </div>

      {/* États */}
      <AnimatePresence mode="wait">
        {success && (
          <motion.div
            key="ok"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 flex items-start gap-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4"
          >
            <QRBadge code={success.code} size={86} />
            <div className="text-[12px] leading-relaxed text-emerald-100">
              <p className="font-display font-bold">Place {success.spotCode} bloquée pour vous</p>
              <p className="mt-1 text-emerald-200/80">Zone {success.zone} · estimation {formatDA(success.total)}</p>
              <p className="num-tick mt-2 flex items-center gap-1.5 font-semibold text-amber-300">
                <Hourglass className="h-3.5 w-3.5" />
                Activation dans {countdown} sinon expiration (no-show −10 pts)
              </p>
              <a href="/reservations" className="mt-2 inline-block rounded-lg bg-emerald-400 px-3 py-1.5 font-semibold text-slate-950 transition-transform hover:scale-105">
                Gérer ma réservation
              </a>
            </div>
          </motion.div>
        )}
        {conflict && (
          <motion.div
            key="ko"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-[12px] text-amber-100"
          >
            <p className="flex items-center gap-2 font-display font-bold">
              <Siren className="h-4 w-4" />
              Conflit évité — pas de fausse promesse
            </p>
            <p className="mt-1 text-amber-200/80">{conflict.error}</p>
            <p className="mt-2 font-semibold text-amber-200">Alternatives fiables :</p>
            <div className="mt-1.5 space-y-1.5">
              {conflict.alternatives.map((a) => (
                <button
                  key={a.id}
                  onClick={() => onSelectLot(a.id)}
                  className="flex w-full items-center justify-between rounded-lg border border-amber-400/20 bg-black/30 px-3 py-2 text-left transition-colors hover:bg-amber-400/10"
                >
                  <span>{a.name}</span>
                  <span className="num-tick text-emerald-300">{a.assignable} places · {a.hourlyRate} DA/h</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
        {fraud && (
          <motion.div
            key="fraud"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 flex items-start gap-3 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-[12px] text-rose-200"
          >
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" />
            <div>
              <p className="font-display font-bold">Anti-fausse demande</p>
              <p className="mt-1 leading-relaxed text-rose-200/85">{fraud}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="mt-4 flex items-center gap-1.5 border-t border-white/5 pt-3 text-[10px] text-slate-600">
        <Waypoints className="h-3 w-3" />
        Attribution transactionnelle avec verrou de ligne — deux conducteurs ne peuvent jamais recevoir la même place.
      </p>
    </div>
  );
}
