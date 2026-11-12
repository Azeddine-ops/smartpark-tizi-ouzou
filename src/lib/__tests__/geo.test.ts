/**
 * Tests unitaires — module SIG & optimisation d'itinéraire (EF-04).
 * Vérifie : connectivité du graphe, contiguïté des chemins Dijkstra,
 * impact des heures de pointe et du vendredi midi.
 */
import { describe, expect, it } from "vitest";
import {
  EDGES,
  GATES,
  LOT_NODES,
  findRoute,
  routeToSvgPath,
  rushInfo,
} from "@/lib/geo";

const edgeSet = new Set(EDGES.map((e) => `${e.a}-${e.b}`));
const adjacent = (a: string, b: string) => edgeSet.has(`${a}-${b}`) || edgeSet.has(`${b}-${a}`);

describe("graphe routier de Tizi-Ouzou", () => {
  it("relie chaque porte d'entrée à chaque parking", () => {
    for (const g of GATES) {
      for (const l of LOT_NODES) {
        const r = findRoute(g.key, l.key, { rush: false });
        expect(r, `${g.key} → ${l.key}`).not.toBeNull();
        expect(r!.pathKeys[0]).toBe(g.key);
        expect(r!.pathKeys.at(-1)).toBe(l.key);
        expect(r!.km).toBeGreaterThan(0);
        expect(r!.minutes).toBeGreaterThan(0);
      }
    }
  });

  it("produit des chemins contigus (tronçons réels uniquement)", () => {
    const r = findRoute("gE", "L_campus", { rush: false })!;
    for (let i = 1; i < r.pathKeys.length; i++) {
      expect(adjacent(r.pathKeys[i - 1], r.pathKeys[i]), `${r.pathKeys[i - 1]}~${r.pathKeys[i]}`).toBe(
        true,
      );
    }
    expect(r.points.length).toBe(r.pathKeys.length);
  });

  it("rend un tracé SVG valide pour la carte", () => {
    const r = findRoute("gW", "L_gare", { rush: false })!;
    const d = routeToSvgPath(r);
    expect(d.startsWith("M")).toBe(true);
    expect(d).toContain("L");
  });

  it("signale les voies empruntées dans l'ordre", () => {
    const r = findRoute("gN", "L_central", { rush: false })!;
    expect(r.roadNames.length).toBeGreaterThan(0);
    expect(r.roadNames.join(" ")).toMatch(/Abane Ramdane|Accès Parking Central/);
  });
});

describe("congestion — heures de pointe & vendredi", () => {
  it("l'heure de pointe rallonge strictement le trajet", () => {
    const fluide = findRoute("gN", "L_gare", { rush: false })!;
    const pointe = findRoute("gN", "L_gare", { rush: true })!;
    expect(pointe.minutes).toBeGreaterThan(fluide.minutes);
    expect(pointe.rushApplied).toBe(true);
    expect(fluide.rushApplied).toBe(false);
  });

  it("détecte les plages de pointe algériennes", () => {
    expect(rushInfo(new Date(2026, 0, 12, 8, 15)).rush).toBe(true); // lundi 08:15
    expect(rushInfo(new Date(2026, 0, 12, 12, 45)).rush).toBe(true); // lundi 12:45
    expect(rushInfo(new Date(2026, 0, 12, 17, 30)).rush).toBe(true); // lundi 17:30
    expect(rushInfo(new Date(2026, 0, 12, 22, 0)).rush).toBe(false); // lundi 22:00
  });

  it("active le pic du vendredi midi (prière)", () => {
    const friday = rushInfo(new Date(2026, 0, 16, 12, 15)); // vendredi 12:15
    expect(friday.friday).toBe(true);
    expect(friday.rush).toBe(true);
    expect(friday.label).toContain("vendredi");
    // samedi 12:15 — pas de pic de prière mais plage 12:00–14:00 active
    expect(rushInfo(new Date(2026, 0, 17, 12, 15)).friday).toBe(false);
  });
});
