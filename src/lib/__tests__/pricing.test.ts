/**
 * Tests unitaires — tarification & paiement (EF-07, EF-09).
 * Vérifie : facturation minimale 30 min, majoration de pointe +25 %,
 * remise carte −5 % ≤ espèces, arrondi 5 DA, contrôle de Luhn.
 */
import { describe, expect, it } from "vitest";
import {
  formatDA,
  luhnCheck,
  maskCard,
  paymentReference,
  quoteParking,
} from "@/lib/pricing";

describe("quoteParking", () => {
  it("facture au minimum 30 minutes", () => {
    const q = quoteParking(40, 12, false, null);
    expect(q.billedMinutes).toBe(30);
    expect(q.total).toBe(20); // 40 DA/h → 20 DA les 30 min
  });

  it("calcule la base au prorata arrondi à 5 DA", () => {
    expect(quoteParking(40, 60, false, null).total).toBe(40);
    expect(quoteParking(25, 90, false, null).total).toBe(40); // 37,5 → 40
  });

  it("majore de 25 % en heure de pointe", () => {
    const q = quoteParking(40, 60, true, null);
    expect(q.rushApplied).toBe(true);
    expect(q.rushSurcharge).toBe(10);
    expect(q.total).toBe(50);
  });

  it("applique la remise e-paiement (−5 %) toujours ≤ espèces", () => {
    const cash = quoteParking(80, 120, false, "especes");
    const card = quoteParking(80, 120, false, "cib");
    expect(cash.total).toBe(160);
    expect(card.cardDiscount).toBe(8);
    expect(card.total).toBe(150);
    expect(card.total).toBeLessThanOrEqual(cash.total);
    // Edahabia bénéficie de la même remise
    expect(quoteParking(80, 120, false, "edahabia").total).toBe(card.total);
  });

  it("borne les saisies absurdes", () => {
    expect(quoteParking(45, 0, false, null).billedMinutes).toBe(30);
    expect(quoteParking(45, -50, false, null).total).toBeGreaterThan(0);
  });

  it("formate les montants en dinars", () => {
    expect(formatDA(150)).toMatch(/150\s?DA/);
  });
});

describe("Luhn — cartes CIB / Edahabia", () => {
  it("accepte une carte valide", () => {
    expect(luhnCheck("4242424242424242")).toBe(true);
    expect(luhnCheck("4242 4242 4242 4242")).toBe(true);
  });

  it("rejette une carte invalide ou mal formée", () => {
    expect(luhnCheck("4242424242424241")).toBe(false);
    expect(luhnCheck("1234")).toBe(false);
    expect(luhnCheck("abcdabcdabcdabcd")).toBe(false);
    expect(luhnCheck("")).toBe(false);
  });

  it("masque le numéro pour l'affichage", () => {
    expect(maskCard("4242424242424242")).toBe("4242 •••• •••• 4242");
  });

  it("génère des références de transaction distinctes", () => {
    const a = paymentReference();
    const b = paymentReference();
    expect(a).toMatch(/^SP-/);
    expect(a).not.toBe(b);
  });
});
