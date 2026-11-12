/**
 * Tests unitaires — fiabilité capteurs & anti-fraude (ENF-03, EF-10).
 * Vérifie : états de santé (ok/muet/défectueux), assignabilité stricte,
 * règles de blocage anti-fausse demande, score de confiance.
 */
import { describe, expect, it } from "vitest";
import {
  HEARTBEAT_STALE_MS,
  MAX_ACTIVE_RESERVATIONS,
  MAX_CANCELS_PER_HOUR,
  assessFraud,
  clampTrust,
  isAssignable,
  reservationCode,
  sensorHealth,
  trustDeltaForEvent,
} from "@/lib/reliability";

const NOW = new Date("2026-05-04T10:00:00Z");

describe("santé des capteurs", () => {
  it("ok quand le battement est récent", () => {
    expect(sensorHealth({ sensorOk: true, lastHeartbeat: new Date(NOW.getTime() - 30_000) }, NOW)).toBe("ok");
  });

  it("muet (stale) au-delà du seuil de battement", () => {
    const silent = new Date(NOW.getTime() - HEARTBEAT_STALE_MS - 1);
    expect(sensorHealth({ sensorOk: true, lastHeartbeat: silent }, NOW)).toBe("stale");
  });

  it("défectueux dès que le capteur est signalé en panne", () => {
    expect(sensorHealth({ sensorOk: false, lastHeartbeat: NOW }, NOW)).toBe("defective");
  });
});

describe("garantie « zéro place fantôme »", () => {
  const fresh = { lastHeartbeat: NOW, sensorOk: true };
  it("assigne uniquement une place libre à capteur sain", () => {
    expect(isAssignable({ ...fresh, status: "free" }, NOW)).toBe(true);
    expect(isAssignable({ ...fresh, status: "occupied" }, NOW)).toBe(false);
    expect(isAssignable({ ...fresh, status: "reserved" }, NOW)).toBe(false);
    expect(isAssignable({ ...fresh, status: "maintenance" }, NOW)).toBe(false);
  });

  it("exclut les capteurs muets ou défectueux même si la place semble libre", () => {
    expect(
      isAssignable(
        { status: "free", sensorOk: true, lastHeartbeat: new Date(NOW.getTime() - 15 * 60_000) },
        NOW,
      ),
    ).toBe(false);
    expect(isAssignable({ status: "free", sensorOk: false, lastHeartbeat: NOW }, NOW)).toBe(false);
  });
});

describe("anti-fausse demande", () => {
  const clean = { cancelsLastHour: 0, activeReservations: 0, trustScore: 86 };

  it("laisse passer un conducteur fair-play", () => {
    const a = assessFraud(clean);
    expect(a.blocked).toBe(false);
    expect(a.reason).toBeNull();
  });

  it("bloque la rafale d'annulations", () => {
    const a = assessFraud({ ...clean, cancelsLastHour: MAX_CANCELS_PER_HOUR });
    expect(a.blocked).toBe(true);
    expect(a.flags).toContain("cancel-flood");
  });

  it("bloque le cumul de réservations simultanées", () => {
    const a = assessFraud({ ...clean, activeReservations: MAX_ACTIVE_RESERVATIONS });
    expect(a.blocked).toBe(true);
    expect(a.flags).toContain("too-many-active");
  });

  it("restreint les comptes sous le seuil de confiance", () => {
    const a = assessFraud({ ...clean, trustScore: 35 });
    expect(a.blocked).toBe(true);
    expect(a.flags).toContain("low-trust");
  });

  it("cumule plusieurs signaux", () => {
    const a = assessFraud({ cancelsLastHour: 5, activeReservations: 3, trustScore: 20 });
    expect(a.flags.length).toBe(3);
  });
});

describe("score de confiance", () => {
  it("récompense et pénalise selon l'événement", () => {
    expect(trustDeltaForEvent("completed")).toBeGreaterThan(0);
    expect(trustDeltaForEvent("no-show")).toBe(-10);
    expect(trustDeltaForEvent("cancel-flood")).toBeLessThan(trustDeltaForEvent("cancel"));
  });

  it("borne le score entre 0 et 100", () => {
    expect(clampTrust(150)).toBe(100);
    expect(clampTrust(-4)).toBe(0);
    expect(clampTrust(64)).toBe(64);
  });

  it("émet des codes de réservation lisibles et sans ambiguïté", () => {
    for (let i = 0; i < 20; i++) {
      expect(reservationCode()).toMatch(/^SP-[A-HJ-KM-NP-Z2-9]{6}$/);
    }
  });
});
