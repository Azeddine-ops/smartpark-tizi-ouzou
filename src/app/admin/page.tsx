"use client";

/**
 * /admin — Salle de contrôle & pilotage (EF-12).
 * Entrepôt de données en direct : occupation, recettes CIB/Edahabia/espèces,
 * capteurs défectueux, audit anti-fraude, simulation.
 */
import useSWR from "swr";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CreditCard,
  GaugeCircle,
  HeartPulse,
  Landmark,
  Radar,
  Siren,
  ShieldAlert,
  ShieldCheck,
  Ticket,
  Zap,
} from "lucide-react";
import { fetcher, cx } from "@/lib/client";
import { formatDA } from "@/lib/pricing";
import SimPanel from "@/components/SimPanel";

interface Stats {
  totals: {
    capacity: number;
    free: number;
    occupied: number;
    reserved: number;
    maintenance: number;
    defectiveSensors: number;
    assignable: number;
  };
  lots: Array<{
    id: number;
    name: string;
    hourlyRate: number;
    stats: { total: number; free: number; occupied: number; reserved: number; maintenance: number; defective: number; assignable: number };
  }>;
  revenue: { byMethod: Array<{ method: string; total: number; n: number }>; total: number };
  reservationsByStatus: Array<{ status: string; n: number }>;
  history: Array<{ tick: number; occupancyPct: number; revenue: number; defective: number; at: string }>;
  defective: Array<{
    id: number;
    code: string;
    zone: string;
    status: string;
    lotName: string;
    sensorFaultReason: string | null;
    silentMin: number;
    health: string;
  }>;
  events: Array<{ id: number; kind: string; message: string; createdAt: string }>;
  fraud: { cancelsLastHour: number; trustScore: number; userName: string };
  sim: { tick: number; rushMode: "auto" | "on" | "off"; rush: boolean; rushLabel: string };
}

const METHOD_META: Record<string, { label: string; color: string }> = {
  cib: { label: "CIB", color: "#34d399" },
  edahabia: { label: "Edahabia", color: "#fbbf24" },
  especes: { label: "Espèces", color: "#94a3b8" },
};

function eventStyle(kind: string) {
  if (kind.startsWith("sensor.fault")) return { icon: Zap, cls: "text-rose-300 bg-rose-500/10" };
  if (kind.startsWith("sensor.heal")) return { icon: HeartPulse, cls: "text-emerald-300 bg-emerald-500/10" };
  if (kind.startsWith("fraud")) return { icon: ShieldAlert, cls: "text-amber-300 bg-amber-500/10" };
  if (kind.startsWith("payment")) return { icon: CreditCard, cls: "text-cyan-300 bg-cyan-500/10" };
  if (kind.startsWith("reservation")) return { icon: Ticket, cls: "text-slate-300 bg-white/5" };
  return { icon: Radar, cls: "text-slate-400 bg-white/5" };
}

const tooltipStyle = {
  backgroundColor: "#0b1120",
  border: "1px solid rgba(148,163,184,0.18)",
  borderRadius: 12,
  fontSize: 12,
  color: "#e2e8f0",
};

export default function AdminPage() {
  const { data, mutate, isLoading } = useSWR<Stats>("/api/admin/stats", fetcher, {
    refreshInterval: 6000,
  });

  if (isLoading || !data) {
    return (
      <div className="mx-auto grid max-w-6xl gap-4 px-4 py-10 lg:px-8">
        <div className="glass h-10 w-1/3 animate-pulse rounded-xl" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="glass h-28 animate-pulse rounded-2xl" />
          ))}
        </div>
        <div className="glass h-72 animate-pulse rounded-2xl" />
      </div>
    );
  }

  const t = data.totals;
  const occPct = t.capacity ? Math.round(((t.occupied + t.reserved) / t.capacity) * 100) : 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-50 lg:text-3xl">
            Salle de <span className="text-gradient">contrôle</span>
          </h1>
          <p className="mt-1 text-[13px] text-slate-500">
            Pilotage des capteurs IoT, recettes et fraude — rafraîchi toutes les 6 s.
          </p>
        </div>
        <span
          className={cx(
            "flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12px] font-semibold ring-1",
            data.sim.rush ? "bg-amber-400/15 text-amber-300 ring-amber-400/30" : "bg-emerald-400/10 text-emerald-300 ring-emerald-400/25",
          )}
        >
          <Radar className="h-3.5 w-3.5 animate-pulse" />
          {data.sim.rush ? "Heure de pointe active" : "Trafic fluide"} · cycle n°{data.sim.tick}
        </span>
      </header>

      {/* Statistiques clés */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            icon: GaugeCircle,
            label: "Occupation réseau",
            value: `${occPct} %`,
            sub: `${t.occupied} occupées · ${t.reserved} réservées`,
            cls: "text-cyan-300",
          },
          {
            icon: Landmark,
            label: "Recettes cumulées",
            value: formatDA(data.revenue.total),
            sub: `${data.revenue.byMethod.reduce((a, m) => a + m.n, 0)} transactions`,
            cls: "text-emerald-300",
          },
          {
            icon: Siren,
            label: "Capteurs en panne",
            value: String(t.defectiveSensors),
            sub: "places exclues de l'assignation",
            cls: t.defectiveSensors > 0 ? "text-rose-300" : "text-emerald-300",
          },
          {
            icon: ShieldCheck,
            label: "Places fiables",
            value: String(t.assignable),
            sub: `sur ${t.capacity} capteurs actifs`,
            cls: "text-emerald-300",
          },
        ].map((c) => (
          <div key={c.label} className="glass rounded-2xl p-4">
            <c.icon className={cx("h-5 w-5", c.cls)} />
            <p className="num-tick font-display mt-2 text-2xl font-bold text-slate-50">{c.value}</p>
            <p className="text-[11px] font-medium text-slate-400">{c.label}</p>
            <p className="text-[10px] text-slate-600">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Graphiques BI */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="glass rounded-2xl p-4">
          <p className="mb-3 font-display text-xs font-semibold uppercase tracking-widest text-slate-400">
            Occupation du réseau (%)
          </p>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.history} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                <defs>
                  <linearGradient id="occG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(148,163,184,0.08)" vertical={false} />
                <XAxis dataKey="tick" tick={{ fill: "#475569", fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: "#475569", fontSize: 10 }} tickLine={false} axisLine={false} unit="%" />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v} %`, "Occupation"]} labelFormatter={(l) => `Cycle ${l}`} />
                <Area type="monotone" dataKey="occupancyPct" stroke="#22d3ee" strokeWidth={2.2} fill="url(#occG)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass rounded-2xl p-4">
          <p className="mb-3 font-display text-xs font-semibold uppercase tracking-widest text-slate-400">
            Recettes par mode de paiement (DA)
          </p>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.revenue.byMethod.map((m) => ({ ...m, label: METHOD_META[m.method]?.label ?? m.method }))}
                margin={{ top: 4, right: 8, bottom: 0, left: -10 }}
              >
                <CartesianGrid stroke="rgba(148,163,184,0.08)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: "#475569", fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v, _n, item) => [`${formatDA(Number(v))} · ${item?.payload?.n ?? 0} tx`, "Recettes"]} />
                <Bar dataKey="total" radius={[8, 8, 0, 0]}>
                  {data.revenue.byMethod.map((m) => (
                    <Cell key={m.method} fill={METHOD_META[m.method]?.color ?? "#64748b"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          {/* Parcs */}
          <div className="glass overflow-hidden rounded-2xl">
            <p className="border-b border-white/5 px-5 py-3.5 font-display text-xs font-semibold uppercase tracking-widest text-slate-400">
              Parcs surveillés
            </p>
            <div className="divide-y divide-white/5">
              {data.lots.map((l) => {
                const pct = l.stats.total ? ((l.stats.occupied + l.stats.reserved) / l.stats.total) * 100 : 0;
                return (
                  <div key={l.id} className="num-tick flex items-center gap-4 px-5 py-3 text-[12px]">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-200">{l.name}</p>
                      <p className="text-[10px] text-slate-600">{l.hourlyRate} DA/h</p>
                    </div>
                    <div className="hidden h-1.5 w-40 overflow-hidden rounded-full bg-white/5 sm:block">
                      <div
                        className={cx("h-full rounded-full transition-all", pct < 40 ? "bg-emerald-400" : pct < 75 ? "bg-amber-400" : "bg-rose-400")}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-20 text-slate-400">{l.stats.assignable} fiables</span>
                    <span className={cx("w-16 text-right font-semibold", l.stats.defective > 0 ? "text-rose-300" : "text-slate-600")}>
                      {l.stats.defective > 0 ? `${l.stats.defective} HS` : "capteurs OK"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Capteurs défectueux */}
          <div className="glass overflow-hidden rounded-2xl">
            <p className="flex items-center gap-2 border-b border-white/5 px-5 py-3.5 font-display text-xs font-semibold uppercase tracking-widest text-slate-400">
              <Siren className="h-4 w-4 text-rose-300" />
              Capteurs à problème — exclus de l'assignation
            </p>
            {data.defective.length === 0 ? (
              <p className="px-5 py-6 text-center text-[12px] text-emerald-300">
                Tous les capteurs répondent — réseau sain.
              </p>
            ) : (
              <div className="divide-y divide-white/5">
                {data.defective.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 px-5 py-2.5 text-[12px]">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-rose-500/10">
                      <Zap className="h-4 w-4 text-rose-300" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-200">
                        {s.lotName} · place <b>{s.code}</b> <span className="text-slate-600">(zone {s.zone})</span>
                      </p>
                      <p className="text-[11px] text-rose-300/80">{s.sensorFaultReason ?? "Panne signalée"}</p>
                    </div>
                    <span className="num-tick rounded-full bg-white/5 px-2 py-1 text-[10px] text-slate-500">
                      muet depuis {s.silentMin} min
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <SimPanel sim={data.sim} onDone={() => void mutate()} />

          {/* Anti-fraude */}
          <div className="glass rounded-2xl p-4 text-[12px]">
            <p className="mb-2 flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-widest text-slate-400">
              <ShieldAlert className="h-4 w-4 text-amber-400" />
              Anti-fraude
            </p>
            <div className="num-tick space-y-1.5 text-slate-400">
              <p className="flex justify-between">
                <span>{data.fraud.userName}</span>
                <b className={data.fraud.trustScore >= 70 ? "text-emerald-300" : "text-amber-300"}>
                  {data.fraud.trustScore}/100
                </b>
              </p>
              <p className="flex justify-between">
                <span>Annulations dernière heure</span>
                <b className={data.fraud.cancelsLastHour >= 3 ? "text-rose-300" : "text-slate-200"}>
                  {data.fraud.cancelsLastHour}/3
                </b>
              </p>
            </div>
          </div>

          {/* Journal d'audit */}
          <div className="glass rounded-2xl p-4">
            <p className="mb-3 font-display text-xs font-semibold uppercase tracking-widest text-slate-400">
              Journal d'audit — traçabilité
            </p>
            <div className="max-h-[380px] space-y-2.5 overflow-y-auto pr-1">
              {data.events.map((e) => {
                const st = eventStyle(e.kind);
                return (
                  <div key={e.id} className="flex items-start gap-2.5">
                    <span className={cx("mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg", st.cls)}>
                      <st.icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[11.5px] leading-snug text-slate-300">{e.message}</p>
                      <p className="num-tick mt-0.5 text-[9.5px] uppercase tracking-wide text-slate-600">
                        {e.kind} · {new Date(e.createdAt).toLocaleTimeString("fr-DZ", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
