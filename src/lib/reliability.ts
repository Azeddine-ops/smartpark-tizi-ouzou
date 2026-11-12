/**
 * Fiabilité & anti-fraude SmartPark.
 *
 * Fiabilité capteurs (ENF-04 / exigence métier « ne jamais envoyer un
 * automobiliste vers une place occupée ou surveillée par un capteur
 * défectueux ») :
 *  - chaque place possède un capteur qui émet un battement (heartbeat) ;
 *  - un capteur sans battement depuis {@link HEARTBEAT_STALE_MS} est « stale » ;
 *  - un capteur signalé défectueux ou stale rend sa place inassignable.
 *
 * Anti-fausse demande (adaptation au contexte local) :
 *  - score de confiance par conducteur (0..100) ;
 *  - blocage au-delà de {@link MAX_CANCELS_PER_HOUR} annulations/heure ;
 *  - no-show (réservation non activée) ⇒ pénalité de confiance.
 */

export type SensorHealth = "ok" | "stale" | "defective";

export const HEARTBEAT_STALE_MS = 10 * 60 * 1000; // 10 minutes
export const MAX_CANCELS_PER_HOUR = 3;
export const MAX_ACTIVE_RESERVATIONS = 2;
export const MIN_TRUST_SCORE = 40;

export interface SensorLike {
  sensorOk: boolean;
  lastHeartbeat: Date;
}

/** Évalue la santé d'un capteur à un instant donné. */
export function sensorHealth(s: SensorLike, now: Date = new Date()): SensorHealth {
  if (!s.sensorOk) return "defective";
  if (now.getTime() - new Date(s.lastHeartbeat).getTime() > HEARTBEAT_STALE_MS) {
    return "stale";
  }
  return "ok";
}

export const HEALTH_LABELS: Record<SensorHealth, string> = {
  ok: "Capteur opérationnel",
  stale: "Capteur muet (battement expiré)",
  defective: "Capteur défectueux",
};

export interface SpotAssignableLike extends SensorLike {
  status: string;
}

/**
 * Une place n'est assignable que si elle est libre ET surveillée par un
 * capteur en bonne santé — garantie clé de fiabilité du cahier des charges.
 */
export function isAssignable(s: SpotAssignableLike, now: Date = new Date()): boolean {
  return s.status === "free" && sensorHealth(s, now) === "ok";
}

export interface FraudInput {
  cancelsLastHour: number;
  activeReservations: number;
  trustScore: number;
}

export interface FraudAssessment {
  blocked: boolean;
  reason: string | null;
  flags: string[];
}

/** Détecte les demandes abusives avant toute réservation. */
export function assessFraud(input: FraudInput): FraudAssessment {
  const flags: string[] = [];
  let blocked = false;
  let reason: string | null = null;

  if (input.trustScore < MIN_TRUST_SCORE) {
    blocked = true;
    reason = `Score de confiance insuffisant (${input.trustScore}/100). Contactez le support pour réhabiliter votre compte.`;
    flags.push("low-trust");
  }
  if (input.activeReservations >= MAX_ACTIVE_RESERVATIONS) {
    blocked = true;
    reason = `Maximum ${MAX_ACTIVE_RESERVATIONS} réservations simultanées (anti-fausse demande).`;
    flags.push("too-many-active");
  }
  if (input.cancelsLastHour >= MAX_CANCELS_PER_HOUR) {
    blocked = true;
    reason = `Trop d'annulations en 1 h (${input.cancelsLastHour}). Réessayez plus tard.`;
    flags.push("cancel-flood");
  }

  return { blocked, reason, flags };
}

export type TrustEvent = "completed" | "cancel" | "cancel-flood" | "no-show";

/** Variation du score de confiance selon l'événement. */
export function trustDeltaForEvent(kind: TrustEvent): number {
  switch (kind) {
    case "completed":
      return 2;
    case "cancel":
      return -1;
    case "cancel-flood":
      return -6;
    case "no-show":
      return -10;
  }
}

export function clampTrust(score: number): number {
  return Math.max(0, Math.min(100, score));
}

/** Code de réservation unique, lisible au guichet (alphabet sans ambiguïté). */
export function reservationCode(rand: () => number = Math.random): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += alphabet[Math.floor(rand() * alphabet.length)];
  }
  return `SP-${out}`;
}
