# SmartPark Tizi-Ouzou 🅿️

> Stationnement intelligent pour la ville de Tizi-Ouzou — mini-projet du module
> **Assurance Qualité Logiciel**, Master 1 ISI, Université Mouloud Mammeri (UMMTO), 2026/2027.
> Chargée du module : Pr F. Dahmani-Bouarab.

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Drizzle%20ORM-336791)
![Tests](https://img.shields.io/badge/Vitest-40%20tests%20passent-success)
![Docs](https://img.shields.io/badge/TypeDoc-g%C3%A9n%C3%A9r%C3%A9e-blue)

## Fonctionnalités

- **SIG temps réel** : carte vectorielle de Tizi-Ouzou (22 nœuds routiers, 38 tronçons nommés), état des 6 parcs rafraîchi toutes les 4 s.
- **Optimisation d'itinéraire** : Dijkstra pondéré par la congestion (heures de pointe + pic du vendredi midi).
- **Réservation atomique** : `SELECT … FOR UPDATE SKIP LOCKED` — impossible d'envoyer deux conducteurs sur la même place, ou vers une place à capteur défectueux.
- **Paiement algérien** : cartes CIB / Edahabia (−5 %, contrôle de Luhn) ou espèces, montants en DA.
- **Anti-fausse demande** : score de confiance, limites d'annulation, pénalité no-show.
- **Chatbot « Sahbi »** d'orientation des nouveaux utilisateurs (français + contexte local).
- **Salle de contrôle** : simulation IoT, graphiques BI, journal d'audit, gestion des pannes capteurs.
- **Spécification traçable** : `/spec` — ambiguïtés, EF/ENF, user stories Gherkin, matrice exigence → code → test.

## Structure

```
src/
├── app/            pages & API routes (Next.js App Router)
├── components/     carte SVG, chatbot, paiement, salle de contrôle…
├── lib/            logique métier pure (geo/Dijkstra, pricing, reliability, chatbot)
└── db/             schéma Drizzle + amorçage (auto-création des tables)
```

## Démarrage local

```bash
npm install
cp .env.example .env        # adapter DATABASE_URL
npm run build && npm run start
```

> Les tables et le jeu de démonstration (6 parcs, 310 places instrumentées)
> sont **créés automatiquement au premier lancement** — aucune migration manuelle.

## Qualité

```bash
npx vitest run   # 40 tests unitaires (géo, tarifs, fiabilité, anti-fraude, chatbot)
```

Documentation technique générée (TypeDoc) : `/docs/index.html`.

## Pile technique

Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Drizzle ORM · PostgreSQL ·
Framer Motion · Recharts · qrcode.react · Vitest · TypeDoc
