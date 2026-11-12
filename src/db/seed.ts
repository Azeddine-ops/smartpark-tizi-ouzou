/**
 * Amorçage idempotent de la base SmartPark (jeu de données de démonstration).
 *
 * - 6 parcs de stationnement géolocalisés de Tizi-Ouzou, ancrés au graphe SIG ;
 * - ~300 places avec capteurs (≈ 35 % occupées au départ, quelques pannes) ;
 * - 1 conducteur de démonstration (score de confiance) ;
 * - historique de réservations/paiements (CIB, Edahabia, espèces) ;
 * - 24 snapshots d'occupation pour l'entrepôt de données.
 */
import { db } from "@/db";
import {
  auditEvents,
  parkingLots,
  parkingSpots,
  payments,
  reservations,
  simState,
  snapshots,
  users,
} from "@/db/schema";
import { quoteParking } from "@/lib/pricing";

const LOTS = [
  {
    slug: "central",
    name: "Parking Central",
    address: "Place du 1er Novembre, Centre-ville",
    nodeKey: "L_central",
    lat: 36.7172,
    lng: 4.0501,
    hourlyRate: 40,
    zones: ["RDC", "Étage 1"],
    counts: 48,
    features: ["Vidéosurveillance", "Gardiennage 24/7", "Places PMR", "Couvert"],
  },
  {
    slug: "campus",
    name: "Parking Campus UMMO",
    address: "Hasnaoua, Avenue Aïssat Idir",
    nodeKey: "L_campus",
    lat: 36.7212,
    lng: 4.0456,
    hourlyRate: 20,
    zones: ["Nord", "Sud"],
    counts: 60,
    features: ["Tarif étudiant", "Recharge EV", "Places PMR"],
  },
  {
    slug: "hopital",
    name: "Parking Hôpital Nedir Mohamed",
    address: "Rue Colonel Amirouche",
    nodeKey: "L_hopital",
    lat: 36.7198,
    lng: 4.0545,
    hourlyRate: 30,
    zones: ["A", "B"],
    counts: 42,
    features: ["Accès Urgences", "Vidéosurveillance", "Places PMR"],
  },
  {
    slug: "stade",
    name: "Parking Stade 1er Novembre",
    address: "Rue du Stade, Quartier Est",
    nodeKey: "L_stade",
    lat: 36.7128,
    lng: 4.0582,
    hourlyRate: 25,
    zones: ["Tribunes", "Annexe"],
    counts: 54,
    features: ["Jours de match", "Gardiennage"],
  },
  {
    slug: "nouvelle-ville",
    name: "Parking Nouvelle Ville",
    address: "Rue de Boukhalfa, Nouvelle Ville",
    nodeKey: "L_nouvelle",
    lat: 36.7118,
    lng: 4.0432,
    hourlyRate: 25,
    zones: ["A", "B", "C"],
    counts: 66,
    features: ["Ombragé", "Recharge EV", "Vidéosurveillance"],
  },
  {
    slug: "gare",
    name: "Parking Gare Routière",
    address: "Rue de la Gare",
    nodeKey: "L_gare",
    lat: 36.7155,
    lng: 4.0532,
    hourlyRate: 45,
    zones: ["Court", "Long"],
    counts: 40,
    features: ["Dépose-minute", "Gardiennage 24/7", "Couvert"],
  },
];

let seeded = false;

export async function ensureSeeded(): Promise<void> {
  if (seeded) return;
  const existing = await db.select({ id: parkingLots.id }).from(parkingLots).limit(1);
  if (existing.length > 0) {
    seeded = true;
    return;
  }

  const now = Date.now();
  const lotRows = await db.insert(parkingLots).values(LOTS.map(({ counts: _c, zones: _z, ...l }) => l)).returning();

  // Places + capteurs
  const spotValues: (typeof parkingSpots.$inferInsert)[] = [];
  for (const [li, lot] of LOTS.entries()) {
    const lotRow = lotRows[li];
    const perZone = Math.ceil(lot.counts / lot.zones.length);
    for (const zone of lot.zones) {
      for (let i = 1; i <= perZone; i++) {
        const r = Math.random();
        const occupied = r < 0.34;
        const defective = Math.random() < 0.02;
        const heartAgo = defective
          ? 6 * 60_000 + Math.random() * 30 * 60_000 // muet depuis 6–36 min
          : 5_000 + Math.random() * 60_000;
        spotValues.push({
          lotId: lotRow.id,
          zone,
          code: `${zone.replace(/\s/g, "")[0]}-${String(i).padStart(2, "0")}`,
          status: defective ? "maintenance" : occupied ? "occupied" : "free",
          sensorOk: !defective,
          sensorFaultReason: defective ? "Capteur sans signal" : null,
          lastHeartbeat: new Date(now - heartAgo),
        });
      }
    }
  }
  const spotRows = await db.insert(parkingSpots).values(spotValues).returning();

  // Conducteur de démonstration
  const [demo] = await db
    .insert(users)
    .values({
      name: "Lylia Hamitouche",
      plate: "11426 · 116 · 15",
      phone: "+213 550 42 11 15",
      trustScore: 86,
    })
    .returning();

  // Historique : réservations terminées + paiements (pour les graphiques BI)
  const methods = ["cib", "edahabia", "especes"] as const;
  const resValues: (typeof reservations.$inferInsert)[] = [];
  for (let i = 0; i < 16; i++) {
    const li = Math.floor(Math.random() * lotRows.length);
    const lot = lotRows[li];
    const spot = spotRows.find((s) => s.lotId === lot.id)!;
    const dur = [45, 60, 90, 120, 150, 180, 240][Math.floor(Math.random() * 7)];
    const rush = Math.random() < 0.35;
    const method = methods[Math.floor(Math.random() * methods.length)];
    const q = quoteParking(lot.hourlyRate, dur, rush, method);
    const created = new Date(now - (2 + Math.random() * 9) * 3_600_000);
    const done = new Date(created.getTime() + dur * 60_000);
    resValues.push({
      code: `SP-HIST${String(i).padStart(2, "0")}`,
      userId: demo.id,
      spotId: spot.id,
      lotId: lot.id,
      status: "completed",
      durationMin: dur,
      amountEstimated: q.total,
      amountFinal: q.total,
      paymentMethod: method,
      rushApplied: rush,
      expiresAt: created,
      checkedInAt: created,
      completedAt: done,
      createdAt: created,
    });
  }
  const resRows = await db.insert(reservations).values(resValues).returning();
  await db.insert(payments).values(
    resRows.map((r) => ({
      reservationId: r.id,
      method: r.paymentMethod as (typeof methods)[number],
      amount: r.amountFinal ?? 0,
      status: "success" as const,
      reference: `SP-HIST-${r.code.slice(7)}`,
      cardLast4: r.paymentMethod === "especes" ? null : "4242",
      createdAt: r.completedAt ?? r.createdAt,
    })),
  );

  // Snapshots historiques (24 derniers cycles) — entrepôt BI
  const totalSpots = spotRows.length;
  let occ = Math.round(totalSpots * 0.35);
  let revenue = 0;
  const snapValues: (typeof snapshots.$inferInsert)[] = [];
  for (let t = 1; t <= 24; t++) {
    const drift = [8, 9, 12, 17, 18].includes((t + 6) % 24) ? 22 : -8; // pics simulés
    occ = Math.max(30, Math.min(totalSpots - 20, occ + drift + (Math.random() * 14 - 7)));
    revenue += Math.round(150 + Math.random() * 700);
    const occupied = Math.round(occ);
    const reserved = Math.round(4 + Math.random() * 8);
    const maintenance = 3 + Math.round(Math.random() * 3);
    snapValues.push({
      tick: t,
      free: totalSpots - occupied - reserved - maintenance,
      occupied,
      reserved,
      maintenance,
      defective: 2 + Math.round(Math.random() * 4),
      revenue,
      createdAt: new Date(now - (24 - t) * 15 * 60_000),
    });
  }
  await db.insert(snapshots).values(snapValues);

  await db.insert(simState).values({ tick: 24, rushMode: "auto" });

  await db.insert(auditEvents).values([
    {
      kind: "system.seed",
      message: "Réseau SmartPark initialisé : 6 parcs, capteurs IoT étalonnés, graphe SIG chargé.",
    },
    {
      kind: "sensor.fault",
      message: "Capteur défectueux détecté au Parking Central — place retirée de l'assignation.",
      lotId: lotRows[0].id,
    },
    {
      kind: "payment.success",
      userId: demo.id,
      message: "Paiement CIB accepté via passerelle SATIM — remise e-paiement appliquée.",
    },
  ]);

  seeded = true;
}
