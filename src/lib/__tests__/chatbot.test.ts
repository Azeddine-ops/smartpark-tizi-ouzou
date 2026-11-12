/**
 * Tests unitaires — chatbot d'orientation Sahbi (EF-11).
 * Vérifie la reconnaissance d'intentions sur des formulations réelles
 * et la présence d'actions rapides pour guider les nouveaux utilisateurs.
 */
import { describe, expect, it } from "vitest";
import { WELCOME, reply } from "@/lib/chatbot";

describe("reconnaissance d'intentions", () => {
  it("salue et propose le menu", () => {
    const r = reply("Salam, je suis nouveau ici");
    expect(r.intent).toBe("greeting");
    expect(r.chips.length).toBeGreaterThanOrEqual(3);
  });

  it("comprend le paiement CIB / Edahabia", () => {
    const r = reply("Comment payer avec ma carte CIB ?");
    expect(r.intent).toBe("payment");
    expect(r.text).toMatch(/Edahabia/);
    expect(r.text).toMatch(/Luhn/);
  });

  it("détaille les tarifs et les heures de pointe", () => {
    const r = reply("C'est combien le tarif au parking central ?");
    expect(r.intent).toBe("pricing");
    expect(r.text).toMatch(/DA/);
    expect(r.text).toMatch(/\+25 %/);
  });

  it("explique la réservation en étapes", () => {
    const r = reply("je veux réserver une place");
    expect(r.intent).toBe("reserve");
    expect(r.text).toMatch(/QR/);
  });

  it("explique les règles d'annulation et le score de confiance", () => {
    const r = reply("comment annuler ma réservation");
    expect(r.intent).toBe("cancel");
    expect(r.text).toMatch(/confiance/);
  });

  it("rassure sur les capteurs défectueux", () => {
    const r = reply("et si le capteur est en panne ?");
    expect(r.intent).toBe("sensor");
    expect(r.text.toLowerCase()).toMatch(/jamais/);
  });

  it("remercie chaleureusement", () => {
    expect(reply("merci beaucoup !").intent).toBe("thanks");
  });

  it("rebondit poliment hors sujet avec des pistes", () => {
    const r = reply("blabla incompréhensible zqsd");
    expect(r.intent).toBe("fallback");
    expect(r.chips.length).toBeGreaterThan(0);
  });

  it("gère un message vide", () => {
    expect(reply("   ").text.length).toBeGreaterThan(0);
  });

  it("le message d'accueil présente les capacités", () => {
    expect(WELCOME.intent).toBe("welcome");
    expect(WELCOME.chips).toContain("Réserver une place");
  });
});
