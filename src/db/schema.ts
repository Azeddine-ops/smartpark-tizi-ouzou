/**
 * Schéma de la base de données SmartPark (Tizi-Ouzou).
 *
 * Conception (MCD/MLD) :
 *  - users            : conducteurs + score de confiance (anti-fausse demande)
 *  - parking_lots     : parcs de stationnement géolocalisés (ancrés au graphe SIG)
 *  - parking_spots    : places + état capteur (fiabilité)
 *  - reservations     : cycle de vie complet (pending → active → completed …)
 *  - payments         : paiements CIB / Edahabia / Espèces (DA)
 *  - audit_events     : journal d'audit (traçabilité, fraude, capteurs)
 *  - snapshots        : historique d'occupation (entrepôt de données / BI)
 *  - sim_state        : état du simulateur de capteurs (démonstration temps réel)
 */
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  plate: text("plate").notNull().unique(), // immatriculation algérienne ex. 11426-116-15
  phone: text("phone"),
  trustScore: integer("trust_score").notNull().default(80), // 0..100, < 40 ⇒ restrictions
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const parkingLots = pgTable("parking_lots", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  nodeKey: text("node_key").notNull(), // nœud d'ancrage dans le graphe routier (SIG)
  lat: real("lat").notNull(), // coordonnées GPS (WGS84)
  lng: real("lng").notNull(),
  hourlyRate: real("hourly_rate").notNull(), // tarif DA / heure
  openHour: integer("open_hour").notNull().default(6),
  closeHour: integer("close_hour").notNull().default(23),
  features: jsonb("features").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SpotStatus = "free" | "occupied" | "reserved" | "maintenance";

export const parkingSpots = pgTable(
  "parking_spots",
  {
    id: serial("id").primaryKey(),
    lotId: integer("lot_id")
      .notNull()
      .references(() => parkingLots.id, { onDelete: "cascade" }),
    code: text("code").notNull(), // ex. A-07
    zone: text("zone").notNull(),
    status: text("status").$type<SpotStatus>().notNull().default("free"),
    sensorOk: boolean("sensor_ok").notNull().default(true),
    sensorFaultReason: text("sensor_fault_reason"),
    lastHeartbeat: timestamp("last_heartbeat", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("spots_lot_idx").on(t.lotId),
    uniqueIndex("spots_lot_code_uq").on(t.lotId, t.code),
    index("spots_status_idx").on(t.status),
  ],
);

export type ReservationStatus =
  | "pending" // réservée, en attente d'arrivée (fenêtre d'activation)
  | "active" // check-in effectué, véhicule garé
  | "completed" // check-out + paiement
  | "cancelled"
  | "expired"; // no-show (réservation jamais activée)

export const reservations = pgTable(
  "reservations",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull().unique(), // code d'accès affiché sur le QR
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    spotId: integer("spot_id")
      .notNull()
      .references(() => parkingSpots.id),
    lotId: integer("lot_id")
      .notNull()
      .references(() => parkingLots.id),
    status: text("status").$type<ReservationStatus>().notNull().default("pending"),
    durationMin: integer("duration_min").notNull(), // durée demandée
    amountEstimated: real("amount_estimated").notNull(), // DA
    amountFinal: real("amount_final"), // DA après check-out
    paymentMethod: text("payment_method"), // cib | edahabia | especes
    rushApplied: boolean("rush_applied").notNull().default(false),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("res_user_idx").on(t.userId), index("res_status_idx").on(t.status)],
);

export type PaymentMethod = "cib" | "edahabia" | "especes";

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  reservationId: integer("reservation_id")
    .notNull()
    .references(() => reservations.id),
  method: text("method").$type<PaymentMethod>().notNull(),
  amount: real("amount").notNull(), // DA
  status: text("status").$type<"success" | "failed">().notNull(),
  reference: text("reference").notNull(), // référence de transaction (TPE / SATIM)
  cardLast4: text("card_last4"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditEvents = pgTable(
  "audit_events",
  {
    id: serial("id").primaryKey(),
    kind: text("kind").notNull(), // reservation.create | sensor.fault | fraud.block …
    message: text("message").notNull(),
    userId: integer("user_id"),
    lotId: integer("lot_id"),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_kind_idx").on(t.kind)],
);

/** Historique d'occupation — mini entrepôt de données décisionnel. */
export const snapshots = pgTable("snapshots", {
  id: serial("id").primaryKey(),
  tick: integer("tick").notNull(),
  free: integer("free").notNull(),
  occupied: integer("occupied").notNull(),
  reserved: integer("reserved").notNull(),
  maintenance: integer("maintenance").notNull(),
  defective: integer("defective").notNull(),
  revenue: real("revenue").notNull(), // recettes cumulées DA
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const simState = pgTable("sim_state", {
  id: serial("id").primaryKey(),
  tick: integer("tick").notNull().default(0),
  rushMode: text("rush_mode").$type<"auto" | "on" | "off">().notNull().default("auto"),
  lastTickAt: timestamp("last_tick_at", { withTimezone: true }).notNull().defaultNow(),
});
