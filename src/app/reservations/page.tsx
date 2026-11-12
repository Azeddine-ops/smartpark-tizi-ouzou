"use client";

/**
 * /reservations — gestion du cycle de vie : check-in (scan portail),
 * prolongation, annulation (anti-flood), check-out + paiement, historique.
 * Affiche le score de confiance anti-fraude du conducteur.
 */
import { useMemo, useState } from "react";
import useSWR from "swr";
import { AnimatePresence, motion } from "framer-motion";
import {
  BadgeCheck,
  DoorOpen,
  Hourglass,
  Plus,
  ShieldCheck,
  Ticket,
  Trash2,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { formatDA, type PaymentMethod } from "@/lib/pricing";
import { fetcher, postJSON, cx } from "@/lib/client";
import QRBadge from "@/components/QRBadge";
import PaymentDialog, { type Receipt } from "@/components/PaymentDialog";

interface ResRow {
  id: number;
  code: string;
  status: "pending" | "active" | "completed" | "cancelled" | "expired";
  durationMin: number;
  amountEstimated: number;
  amountFinal: number | null;
  paymentMethod: PaymentMethod | null;
  rushApplied: boolean;
  expiresAt: string;
  checkedInAt: string | null;
  completedAt: string | null;
  createdAt: string;
  lotId: number;
  lotName: string;
  spotCode: string;
  zone: string;
}

interface Resp {
  user: { id: number; name: string; plate: string; trustScore: number };
  reservations: ResRow[];
  stats: { cancelsLastHour: number; activeReservations: number };
  serverTime: string;
}

const STATUS_META: Record<ResRow["status"], { label: string; cls: string }> = {
  pending: { label: "Activation en attente", cls: "bg-amber-400/15 text-amber-300 ring-amber-400/30" },
  active: { label: "Stationnement en cours", cls: "bg-emerald-400/15 text-emerald-300 ring-emerald-400/30" },
  completed: { label: "Terminé — payé", cls: "bg-cyan-400/10 text-cyan-300 ring-cyan-400/25" },
  cancelled: { label: "Annulé", cls: "bg-slate-400/10 text-slate-400 ring-slate-400/20" },
  expired: { label: "Expiré (no-show)", cls: "bg-rose-400/10 text-rose-300 ring-rose-400/25" },
};

export default function ReservationsPage() {
  const { data, mutate, isLoading } = useSWR<Resp>("/api/reservations", fetcher, {
    refreshInterval: 5000,
  });
  const [busyId, setBusyId] = useState<number | null>(null);
  const [payFor, setPayFor] = useState<ResRow | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const active = useMemo(
    () => (data?.reservations ?? []).filter((r) => r.status === "pending" || r.status === "active"),
    [data],
  );
  const history = useMemo(
    () => (data?.reservations ?? []).filter((r) => !["pending", "active"].includes(r.status)),
    [data],
  );

  async function act(id: number, action: string, extra: Record<string, unknown> = {}) {
    setBusyId(id);
    setNote(null);
    try {
      await postJSON(`/api/reservations/${id}`, { action, ...extra }, "PATCH");
      await mutate();
      if (action === "checkin") setNote("Check-in confirmé par le capteur — bon stationnement !");
      if (action === "cancel") setNote("Réservation annulée, place relâchée immédiatement.");
      if (action === "extend") setNote("Durée prolongée de 60 minutes.");
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function pay(method: PaymentMethod, cardNumber?: string) {
    if (!payFor) return { ok: false };
    try {
      const res = await postJSON<{ ok: boolean; receipt: Receipt }>(
        `/api/reservations/${payFor.id}`,
        { action: "checkout", method, cardNumber },
        "PATCH",
      );
      await mutate();
      return { ok: true, receipt: res.receipt };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }

  const trust = data?.user.trustScore ?? 0;
  const trustColor = trust >= 70 ? "#34d399" : trust >= 40 ? "#fbbf24" : "#fb7185";

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-50 lg:text-3xl">
            Mes <span className="text-gradient">réservations</span>
          </h1>
          <p className="mt-1 text-[13px] text-slate-500">
            {data?.user.name} · véhicule {data?.user.plate}
          </p>
        </div>
        <a
          href="/carte"
          className="rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-500 px-4 py-2.5 font-display text-sm font-bold text-slate-950 transition-transform hover:scale-[1.03]"
        >
          + Nouvelle réservation
        </a>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_330px]">
        <div className="space-y-4">
          {note && (
            <p className="glass flex items-center gap-2 rounded-xl px-4 py-3 text-[13px] text-slate-300">
              <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-400" />
              {note}
            </p>
          )}

          {/* Actives */}
          {isLoading ? (
            <div className="glass h-48 animate-pulse rounded-2xl" />
          ) : active.length === 0 ? (
            <div className="glass rounded-2xl p-10 text-center">
              <Ticket className="mx-auto h-10 w-10 text-slate-600" />
              <p className="font-display mt-3 text-lg font-bold text-slate-300">Aucune réservation en cours</p>
              <p className="mx-auto mt-1 max-w-sm text-[13px] text-slate-500">
                Ouvrez la carte, choisissez votre porte d'entrée et laissez l'optimiseur vous garer
                au meilleur endroit.
              </p>
            </div>
          ) : (
            <AnimatePresence>
              {active.map((r) => (
                <motion.article
                  key={r.id}
                  layout
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  className="glass relative overflow-hidden rounded-2xl p-5"
                >
                  <div
                    className={cx(
                      "pointer-events-none absolute inset-x-0 top-0 h-[3px]",
                      r.status === "active"
                        ? "bg-gradient-to-r from-emerald-400 to-cyan-400"
                        : "bg-gradient-to-r from-amber-400 to-orange-400",
                    )}
                  />
                  <div className="flex flex-wrap items-start gap-5">
                    <QRBadge code={r.code} size={92} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-lg font-bold text-slate-50">{r.lotName}</h3>
                        <span className={cx("rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ring-1", STATUS_META[r.status].cls)}>
                          {STATUS_META[r.status].label}
                        </span>
                      </div>
                      <p className="num-tick mt-1 text-[13px] text-slate-400">
                        Place <b className="text-slate-200">{r.spotCode}</b> · zone {r.zone} ·{" "}
                        {Math.floor(r.durationMin / 60) > 0 ? `${Math.floor(r.durationMin / 60)} h ` : ""}
                        {r.durationMin % 60 > 0 ? `${r.durationMin % 60} min` : ""} · estimation{" "}
                        <b className="text-emerald-300">{formatDA(r.amountEstimated)}</b>
                        {r.rushApplied && <span className="ml-1 text-amber-400">(tarif pointe)</span>}
                      </p>
                      {r.status === "pending" && (
                        <p className="mt-2 flex items-center gap-1.5 text-[12px] text-amber-300">
                          <Hourglass className="h-3.5 w-3.5" />
                          Présentez-vous au portail avant expiration — sinon no-show (−10 pts de confiance).
                        </p>
                      )}
                      {r.status === "active" && (
                        <p className="mt-2 flex items-center gap-1.5 text-[12px] text-emerald-300">
                          <DoorOpen className="h-3.5 w-3.5" />
                          Check-in fait {r.checkedInAt ? new Date(r.checkedInAt).toLocaleTimeString("fr-DZ", { hour: "2-digit", minute: "2-digit" }) : ""} — le chrono tourne.
                        </p>
                      )}

                      <div className="mt-4 flex flex-wrap gap-2">
                        {r.status === "pending" && (
                          <button
                            onClick={() => void act(r.id, "checkin")}
                            disabled={busyId === r.id}
                            className="rounded-lg bg-gradient-to-r from-emerald-400 to-cyan-500 px-4 py-2 text-[12px] font-bold text-slate-950 transition-transform hover:scale-105 disabled:opacity-50"
                          >
                            Scanner au portail (check-in)
                          </button>
                        )}
                        {r.status === "active" && (
                          <button
                            onClick={() => setPayFor(r)}
                            disabled={busyId === r.id}
                            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-400 to-cyan-500 px-4 py-2 text-[12px] font-bold text-slate-950 transition-transform hover:scale-105 disabled:opacity-50"
                          >
                            <Wallet className="h-3.5 w-3.5" />
                            Payer & sortir
                          </button>
                        )}
                        <button
                          onClick={() => void act(r.id, "extend")}
                          disabled={busyId === r.id}
                          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3.5 py-2 text-[12px] font-medium text-slate-200 transition-colors hover:bg-white/10 disabled:opacity-50"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Prolonger 1 h
                        </button>
                        <button
                          onClick={() => void act(r.id, "cancel")}
                          disabled={busyId === r.id}
                          className="flex items-center gap-1.5 rounded-lg border border-rose-400/20 bg-rose-500/5 px-3.5 py-2 text-[12px] font-medium text-rose-300 transition-colors hover:bg-rose-500/15 disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Annuler
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.article>
              ))}
            </AnimatePresence>
          )}

          {/* Historique */}
          {history.length > 0 && (
            <div className="glass rounded-2xl p-5">
              <p className="mb-3 font-display text-sm font-bold uppercase tracking-widest text-slate-400">
                Historique
              </p>
              <div className="divide-y divide-white/5">
                {history.map((r) => (
                  <div key={r.id} className="flex flex-wrap items-center gap-3 py-2.5 text-[12px]">
                    <span className={cx("rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1", STATUS_META[r.status].cls)}>
                      {STATUS_META[r.status].label}
                    </span>
                    <span className="font-medium text-slate-300">{r.lotName}</span>
                    <span className="text-slate-600">place {r.spotCode}</span>
                    <span className="ml-auto num-tick text-slate-400">
                      {r.amountFinal != null ? formatDA(r.amountFinal) : "—"}
                      {r.paymentMethod && <span className="ml-1.5 uppercase text-slate-600">{r.paymentMethod}</span>}
                    </span>
                    <span className="num-tick text-slate-600">
                      {new Date(r.createdAt).toLocaleString("fr-DZ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Score de confiance */}
        <aside className="space-y-4">
          <div className="glass rounded-2xl p-5 text-center">
            <p className="flex items-center justify-center gap-2 font-display text-xs font-semibold uppercase tracking-widest text-slate-400">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              Score de confiance
            </p>
            <div className="relative mx-auto mt-4 h-40 w-40">
              <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                <circle cx="60" cy="60" r="52" fill="none" stroke="#152238" strokeWidth="10" />
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  stroke={trustColor}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${(2 * Math.PI * 52 * trust) / 100} ${2 * Math.PI * 52}`}
                  style={{ transition: "stroke-dasharray .8s ease, stroke .8s ease" }}
                />
              </svg>
              <div className="absolute inset-0 grid place-items-center">
                <div>
                  <p className="num-tick font-display text-4xl font-bold" style={{ color: trustColor }}>
                    {trust}
                  </p>
                  <p className="text-[10px] uppercase tracking-widest text-slate-500">/ 100</p>
                </div>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              {trust >= 70
                ? "Conducteur fiable — réservation instantanée prioritaire."
                : trust >= 40
                  ? "Attention : comportement surveillé."
                  : "Compte restreint — trop d'abus détectés."}
            </p>
          </div>

          <div className="glass rounded-2xl p-5 text-[12px] leading-relaxed text-slate-400">
            <p className="mb-2 flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-widest text-slate-400">
              <TriangleAlert className="h-4 w-4 text-amber-400" />
              Anti-fausse demande
            </p>
            <div className="num-tick space-y-1.5">
              <p className="flex justify-between">
                <span>Annulations (1 h)</span>
                <b className={cx(data && data.stats.cancelsLastHour >= 3 ? "text-rose-300" : "text-slate-200")}>
                  {data?.stats.cancelsLastHour ?? 0} / 3
                </b>
              </p>
              <p className="flex justify-between">
                <span>Réservations simultanées</span>
                <b className="text-slate-200">{data?.stats.activeReservations ?? 0} / 2</b>
              </p>
            </div>
            <ul className="mt-3 list-disc space-y-1 border-t border-white/5 pl-4 pt-3 text-slate-500 marker:text-emerald-400">
              <li>Stationnement payé : <b className="text-emerald-300">+2 pts</b></li>
              <li>Annulation : <b className="text-slate-300">−1 pt</b>, rafale : <b className="text-amber-300">−6 pts</b></li>
              <li>No-show : <b className="text-rose-300">−10 pts</b></li>
              <li>Sous 40 pts : compte restreint</li>
            </ul>
          </div>
        </aside>
      </div>

      <PaymentDialog
        open={payFor !== null}
        lotName={payFor?.lotName ?? ""}
        spotCode={payFor?.spotCode ?? ""}
        estimate={payFor?.amountEstimated ?? 0}
        onClose={() => setPayFor(null)}
        onPay={pay}
      />
    </div>
  );
}
