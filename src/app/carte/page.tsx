"use client";

/**
 * /carte — expérience principale SmartPark.
 * Carte SIG temps réel + recommandations explicables + itinéraire optimal
 * + réservation atomique de place certifiée fiable.
 */
import { useMemo, useState } from "react";
import useSWR from "swr";
import { DoorOpen, Loader2, Radar } from "lucide-react";
import { GATES } from "@/lib/geo";
import { fetcher, cx } from "@/lib/client";
import ParkingMap, { type MapLot, type MapRoute } from "@/components/map/ParkingMap";
import LotDetails, { type LotDetailData } from "@/components/carte/LotDetails";
import RecommendList, { type RecItem } from "@/components/carte/RecommendList";
import SimPanel from "@/components/SimPanel";

interface ParkingsResp {
  lots: Array<{
    id: number;
    slug: string;
    name: string;
    address: string;
    nodeKey: string;
    hourlyRate: number;
    occupancyPct: number;
    stats: MapLot["stats"] & { occupied: number; reserved: number; maintenance: number };
  }>;
  totals: { capacity: number; free: number; assignable: number; defectiveSensors: number };
  sim: { tick: number; rushMode: "auto" | "on" | "off"; rush: boolean; rushLabel: string };
}

interface RecommendResp {
  items: RecItem[];
}

export default function CartePage() {
  const [origin, setOrigin] = useState("gN");
  const [selectedLotId, setSelectedLotId] = useState<number | null>(null);
  const [durationMin, setDurationMin] = useState(60);
  const [hoverPath, setHoverPath] = useState<string | null>(null);
  const [route, setRoute] = useState<MapRoute | null>(null);
  const [routeMeta, setRouteMeta] = useState<string | null>(null);
  const [tab, setTab] = useState<"reco" | "details">("reco");

  const parkings = useSWR<ParkingsResp>("/api/parkings", fetcher, { refreshInterval: 4000 });
  const reco = useSWR<RecommendResp>(`/api/recommend?origin=${origin}&duration=${durationMin}`, fetcher, {
    refreshInterval: 9000,
  });
  const detail = useSWR<LotDetailData>(
    selectedLotId ? `/api/parkings/${selectedLotId}` : null,
    fetcher,
    { refreshInterval: 3000 },
  );

  const refreshAll = () => {
    void parkings.mutate();
    void reco.mutate();
    void detail.mutate();
  };

  const mapLots: MapLot[] = useMemo(
    () =>
      (parkings.data?.lots ?? []).map((l) => ({
        id: l.id,
        name: l.name,
        shortName: l.name.replace(/^Parking\s*/, ""),
        nodeKey: l.nodeKey,
        hourlyRate: l.hourlyRate,
        occupancyPct: l.occupancyPct,
        stats: l.stats,
      })),
    [parkings.data],
  );

  function selectLot(id: number) {
    setSelectedLotId(id);
    setTab("details");
  }

  function trace(it: RecItem) {
    setRoute({
      pathSvg: it.pathSvg,
      points: [],
      minutes: it.minutes,
      km: it.km,
    });
    setRouteMeta(
      `${it.lot.name} — ${Math.round(it.minutes)} min · ${it.km} km via ${it.roadNames.slice(0, 2).join(" puis ")}`,
    );
    setSelectedLotId(it.lot.id);
  }

  function traceSelected() {
    const item = reco.data?.items.find((i) => i.lot.id === selectedLotId);
    if (item) trace(item);
  }

  const sim = parkings.data?.sim;
  const totals = parkings.data?.totals;

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-6 lg:px-8">
      {/* En-tête */}
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-50 lg:text-3xl">
            Carte <span className="text-gradient">temps réel</span> — Tizi-Ouzou
          </h1>
          <p className="mt-1 text-[13px] text-slate-500">
            SIG local · capteurs IoT · Dijkstra trafic-pondéré · polling 4 s
          </p>
        </div>
        <div className="flex items-center gap-2">
          {sim && (
            <span
              className={cx(
                "flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12px] font-semibold",
                sim.rush ? "bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30" : "bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/25",
              )}
            >
              <Radar className="h-3.5 w-3.5 animate-pulse" />
              {sim.rush ? "Heure de pointe" : sim.rushLabel}
            </span>
          )}
          {totals && (
            <span className="num-tick rounded-full bg-white/5 px-3.5 py-1.5 text-[12px] font-medium text-slate-300 ring-1 ring-white/10">
              {totals.assignable} places fiables sur {totals.capacity}
            </span>
          )}
        </div>
      </header>

      {/* Portes d'entrée */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-[12px] text-slate-500">
          <DoorOpen className="h-3.5 w-3.5" /> J'arrive par :
        </span>
        {GATES.map((g) => (
          <button
            key={g.key}
            onClick={() => {
              setOrigin(g.key);
              setRoute(null);
              setRouteMeta(null);
            }}
            className={cx(
              "rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all",
              origin === g.key
                ? "bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-400/40"
                : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200",
            )}
          >
            {g.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
        {/* Carte */}
        <div className="space-y-4">
          {mapLots.length === 0 ? (
            <div className="glass grid h-[420px] place-items-center rounded-3xl">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
            </div>
          ) : (
            <ParkingMap
              lots={mapLots}
              originKey={origin}
              selectedLotId={selectedLotId}
              route={route}
              previewSvg={hoverPath}
              onSelectLot={selectLot}
              onSelectOrigin={(k) => {
                setOrigin(k);
                setRoute(null);
                setRouteMeta(null);
              }}
            />
          )}

          {routeMeta && (
            <p className="glass num-tick flex items-center gap-2 rounded-xl px-4 py-2.5 text-[12px] text-cyan-200">
              <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300" />
              Itinéraire actif : {routeMeta}
              <button
                onClick={() => {
                  setRoute(null);
                  setRouteMeta(null);
                }}
                className="ml-auto rounded-md bg-white/10 px-2 py-1 text-[10px] text-slate-400 hover:text-slate-200"
              >
                Effacer
              </button>
            </p>
          )}

          {sim && <SimPanel sim={sim} onDone={refreshAll} />}
        </div>

        {/* Panneau latéral */}
        <aside className="min-w-0">
          <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
            {(
              [
                { k: "reco", l: "Recommandés" },
                { k: "details", l: selectedLotId ? "Parking choisi" : "Détails" },
              ] as const
            ).map((t) => (
              <button
                key={t.k}
                onClick={() => setTab(t.k)}
                className={cx(
                  "rounded-lg py-2 text-[12px] font-semibold transition-colors",
                  tab === t.k ? "bg-emerald-400/15 text-emerald-200" : "text-slate-500 hover:text-slate-300",
                )}
              >
                {t.l}
              </button>
            ))}
          </div>

          {tab === "reco" ? (
            <RecommendList
              items={reco.data?.items ?? []}
              selectedId={selectedLotId}
              loading={reco.isLoading}
              originLabel={GATES.find((g) => g.key === origin)?.label.split("·")[1]?.trim() ?? "Porte Nord"}
              onSelect={selectLot}
              onTrace={trace}
              onHover={setHoverPath}
            />
          ) : selectedLotId ? (
            <LotDetails
              detail={detail.data ?? null}
              loading={detail.isLoading}
              durationMin={durationMin}
              onDurationChange={setDurationMin}
              rush={sim?.rush ?? false}
              onTrace={traceSelected}
              onSelectLot={selectLot}
              onChanged={refreshAll}
            />
          ) : (
            <div className="glass rounded-2xl p-8 text-center text-[13px] text-slate-500">
              Touchez un parking sur la carte pour voir ses places, son devis et réserver.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
