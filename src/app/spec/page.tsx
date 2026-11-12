import type { Metadata } from "next";
import {
  BookOpenCheck,
  Boxes,
  FileSearch,
  FlaskConical,
  GitBranch,
  Landmark,
  ScrollText,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Spécification & traçabilité — SmartPark",
  description:
    "Ingénierie des exigences du cahier des charges SmartPark : hypothèses, ambiguïtés levées, exigences fonctionnelles et non fonctionnelles, user stories, matrice de traçabilité exigence → code → test.",
};

function Chip({ children, tone = "emerald" }: { children: string; tone?: "emerald" | "cyan" | "amber" }) {
  const cls =
    tone === "emerald"
      ? "bg-emerald-400/10 text-emerald-300 ring-emerald-400/25"
      : tone === "cyan"
        ? "bg-cyan-400/10 text-cyan-300 ring-cyan-400/25"
        : "bg-amber-400/10 text-amber-300 ring-amber-400/25";
  return (
    <span className={`inline-block rounded-md px-2 py-0.5 font-mono text-[11px] font-semibold ring-1 ${cls}`}>
      {children}
    </span>
  );
}

function Section({
  id,
  icon: Icon,
  title,
  children,
}: {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-8">
      <h2 className="font-display flex items-center gap-2.5 text-xl font-bold text-slate-50">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-400/10">
          <Icon className="h-4.5 w-4.5 text-emerald-300" />
        </span>
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

const AMBIGUITES = [
  {
    pb: "« Trouver une place » — que se passe-t-il si deux conducteurs visent la même place ?",
    decision:
      "Attribution transactionnelle avec verrou de ligne (SELECT … FOR UPDATE SKIP LOCKED) : la place passe immédiatement à « reserved » ; le second conducteur reçoit un conflit 409 accompagné d'alternatives recommandées.",
  },
  {
    pb: "Le cahier des charges ne précise pas la granulométrie de « capteur défectueux ».",
    decision:
      "Trois états de santé : ok / muet (aucun battement depuis 10 min) / défectueux (signalé ou incohérent). Seules les places à capteur « ok » sont assignables — garantie « zéro place fantôme ».",
  },
  {
    pb: "« Paiement adapté à l'Algérie » — quels canaux ?",
    decision:
      "CIB et Edahabia (passerelle type SATIM simulée, contrôle de Luhn, jamais de numéro stocké) + espèces au gardien. Remise de −5 % sur le e-paiement pour encourager l'usage de la carte.",
  },
  {
    pb: "Comment traiter les « fausses demandes de place » ?",
    decision:
      "Score de confiance 0–100 par conducteur : no-show −10, rafale d'annulations −6 + blocage temporaire (max 3/h), 2 réservations simultanées maximum, restriction sous 40 points.",
  },
  {
    pb: "Qu'est-ce qu'une « heure de pointe » à Tizi-Ouzou ?",
    decision:
      "07:30–09:30, 12:00–14:00, 16:30–19:00 + pic du vendredi 11:30–13:30 (prière). Effets : temps de trajet ×1,35–1,6 selon la classe de voie, tarif +25 % (régulation de la demande).",
  },
  {
    pb: "La géolocalisation « temps réel » exige-t-elle un service cartographique externe ?",
    decision:
      "Non : plan vectoriel local de la ville (graphe de 22 nœuds, 38 tronçons nommés). L'application reste portable et démontrable hors-ligne — critère clé d'une soutenance.",
  },
];

const EF = [
  ["EF-01", "Consulter en temps réel l'occupation des 6 parcs de Tizi-Ouzou", "Polling 4 s · GET /api/parkings"],
  ["EF-02", "Visualiser la ville sur une carte SIG avec portes d'entrée et voies nommées", "components/map/ParkingMap.tsx"],
  ["EF-03", "Choisir une origine (Bouira/Azazga/Ouacifs/Boghni) et une durée", "app/carte/page.tsx"],
  ["EF-04", "Calculer l'itinéraire optimal (Dijkstra, congestion incluse)", "lib/geo.ts · /api/route-optimize"],
  ["EF-05", "Recevoir un classement recommandé et justifié des parcs", "/api/recommend (score multi-critères)"],
  ["EF-06", "Réserver une place certifiée fiable de façon atomique", "POST /api/reservations (transaction)"],
  ["EF-07", "Obtenir un devis exact en DA (pointe, remise carte, min 30 min)", "lib/pricing.ts · quoteParking"],
  ["EF-08", "Activer (check-in), prolonger, annuler une réservation", "PATCH /api/reservations/[id]"],
  ["EF-09", "Payer en CIB / Edahabia / espèces avec reçu de transaction", "PaymentDialog + passerelle simulée"],
  ["EF-10", "Bloquer les fausses demandes (score de confiance, quotas)", "lib/reliability.ts · assessFraud"],
  ["EF-11", "Être orienté par un chatbot (français, contexte local)", "lib/chatbot.ts · widget « Sahbi »"],
  ["EF-12", "Superviser capteurs, recettes et audit en salle de contrôle", "app/admin · /api/admin/stats"],
];

const ENF = [
  ["ENF-01", "Ergonomie : parcours complet en ≤ 5 clics, interface française, responsive mobile"],
  ["ENF-02", "Performance : réponses API < 100 ms en local, rafraîchissement incrémental (SWR)"],
  ["ENF-03", "Fiabilité : impossibilité structurelle d'envoyer un conducteur vers une place occupée ou non certifiée"],
  ["ENF-04", "Sécurité : aucun numéro de carte persisté (Luhn serveur + masquage), SQL paramétré (Drizzle)"],
  ["ENF-05", "Adaptation locale : DZD, CIB/Edahabia, vendredi midi, heures de pointe de Tizi-Ouzou"],
  ["ENF-06", "Traçabilité : journal d'audit de tout événement métier (fraude, capteurs, paiements)"],
  ["ENF-07", "Testabilité : logique métier pure isolée dans src/lib, couverte par Vitest"],
  ["ENF-08", "Documentabilité : TSDoc exhaustif → documentation TypeDoc générée automatiquement"],
];

const STORIES = [
  {
    id: "US-01",
    title: "Réserver une place fiable",
    story:
      "En tant qu'automobiliste arrivant par Azazga, je veux une place garantie libre au parking recommandé afin de ne pas tourner en ville.",
    gwt: [
      "Étant donné la porte Est sélectionnée et 60 min de stationnement",
      "Quand je clique « Réserver une place fiable » sur le Parking Stade",
      "Alors une place à capteur sain m'est attribuée (conflit impossible), un QR + code m'est remis, et j'ai 15 min pour le check-in",
    ],
  },
  {
    id: "US-02",
    title: "Payer par CIB à la sortie",
    story:
      "En tant que conducteur stationné, je veux payer ma durée réelle par carte CIB afin de bénéficier de la remise de 5 %.",
    gwt: [
      "Étant donné un stationnement actif depuis 87 min en heure de pointe",
      "Quand je saisis « Payer & sortir » avec un numéro CIB valide (Luhn)",
      "Alors le montant majoré de 25 % puis remisé de 5 % est encaissé, un reçu référencé est émis, et la place est relâchée",
    ],
  },
  {
    id: "US-03",
    title: "Éviter une place fantôme",
    story:
      "En tant que système, je dois refuser toute assignation dont le capteur est muet ou défectueux afin de ne jamais mentir à l'automobiliste.",
    gwt: [
      "Étant donné un parking dont 4 places sont libres mais à capteur défectueux",
      "Quand le compteur est interrogé",
      "Alors ces places sont affichées en maintenance et exclues : le compteur « fiables » ne les compte pas",
    ],
  },
  {
    id: "US-04",
    title: "Sanctionner les fausses demandes",
    story:
      "En tant qu'exploitant, je veux pénaliser les réservations fantaisistes afin de préserver la disponibilité réelle.",
    gwt: [
      "Étant donné un conducteur à 3 annulations dans l'heure",
      "Quand il tente une 4ᵉ réservation",
      "Alors l'API répond 429 « anti-fausse demande », l'événement est audité, et son score de confiance chute",
    ],
  },
  {
    id: "US-05",
    title: "Contourner l'heure de pointe",
    story:
      "En tant qu'automobiliste à 17 h 45, je veux un itinéraire qui tient compte de la congestion afin d'arriver au temps annoncé.",
    gwt: [
      "Étant donné le mode heure de pointe actif (16:30–19:00)",
      "Quand l'itinéraire Porte Nord → Gare Routière est calculé",
      "Alors Dijkstra pénalise les voies urbaines (×1,6) et privilégie les boulevards, avec ETA recalculée",
    ],
  },
  {
    id: "US-06",
    title: "Être guidé à la première utilisation",
    story:
      "En tant que nouvel utilisateur, je veux qu'un assistant m'explique les tarifs et le QR afin de réussir ma première réservation seul.",
    gwt: [
      "Étant donné l'ouverture du widget « Sahbi »",
      "Quand je demande « comment payer avec Edahabia ? »",
      "Alors le chatbot répond en français, cite la remise carte et propose des actions rapides",
    ],
  },
];

const TRACE = [
  ["EF-04", "src/lib/geo.ts — findRoute()", "geo.test.ts : chemin contigu, cohérence"],
  ["EF-04/ENF-05", "rushInfo() pointes + vendredi", "geo.test.ts : rush ralentit, vendredi 12 h"],
  ["EF-05", "/api/recommend — score composite", "reco visible sur /carte (justifications)"],
  ["EF-06/ENF-03", "POST /api/reservations — SKIP LOCKED", "conflit 409 + alternatives (démo reproductible)"],
  ["EF-07", "src/lib/pricing.ts — quoteParking()", "pricing.test.ts : min 30 min, pointe, remise carte"],
  ["EF-09", "luhnCheck() + passerelle simulée", "pricing.test.ts : 4242…242 acceptée, …241 refusée"],
  ["EF-10", "src/lib/reliability.ts — assessFraud()", "reliability.test.ts : quotas, score plancher"],
  ["ENF-03", "sensorHealth() + isAssignable()", "reliability.test.ts : muet/défectueux exclus"],
  ["EF-11", "src/lib/chatbot.ts — moteur à intentions", "chatbot.test.ts : intents CIB/tarifs/salut"],
];

export default function SpecPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 lg:px-8">
      {/* En-tête */}
      <header className="glass relative overflow-hidden rounded-3xl p-8">
        <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-300">
          Mini-projet AQL · UMMTO · Master 1 ISI · 2026/2027
        </p>
        <h1 className="font-display mt-3 text-3xl font-extrabold text-slate-50 lg:text-4xl">
          Spécification & <span className="text-gradient">traçabilité</span>
        </h1>
        <p className="mt-3 max-w-3xl text-[14px] leading-relaxed text-slate-400">
          Ingénierie des exigences du cahier des charges SmartPark : hypothèses posées pour lever les
          ambiguïtés, catalogue EF/ENF, user stories avec critères d'acceptation (Gherkin), architecture
          et matrice de traçabilité « exigence → module → test ». Document vivant livré avec le prototype.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Chip>EF × 12</Chip>
          <Chip tone="cyan">ENF × 8</Chip>
          <Chip tone="amber">US × 6 Gherkin</Chip>
        </div>
      </header>

      <div className="mt-10 space-y-12">
        {/* Ambiguïtés */}
        <Section id="ambiguites" icon={FileSearch} title="Hypothèses & ambiguïtés levées">
          <div className="space-y-3">
            {AMBIGUITES.map((a, i) => (
              <div key={i} className="glass rounded-2xl p-5">
                <p className="text-[13px] font-semibold text-amber-200">Ambiguïté {i + 1} — {a.pb}</p>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-400">
                  <b className="text-emerald-300">Décision : </b>
                  {a.decision}
                </p>
              </div>
            ))}
          </div>
        </Section>

        {/* EF */}
        <Section id="ef" icon={ScrollText} title="Exigences fonctionnelles (EF)">
          <div className="glass overflow-hidden rounded-2xl">
            <div className="divide-y divide-white/5">
              {EF.map(([id, txt, trace]) => (
                <div key={id} className="grid gap-2 px-5 py-3.5 text-[13px] md:grid-cols-[80px_1fr_260px] md:items-center">
                  <Chip>{id}</Chip>
                  <span className="text-slate-300">{txt}</span>
                  <span className="font-mono text-[11px] text-slate-600">{trace}</span>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* ENF */}
        <Section id="enf" icon={Boxes} title="Exigences non fonctionnelles (ENF)">
          <div className="grid gap-3 md:grid-cols-2">
            {ENF.map(([id, txt]) => (
              <div key={id} className="glass rounded-2xl p-4 text-[13px]">
                <Chip tone="cyan">{id}</Chip>
                <p className="mt-2 leading-relaxed text-slate-400">{txt}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* User stories */}
        <Section id="stories" icon={BookOpenCheck} title="User stories & critères d'acceptation">
          <div className="grid gap-4 md:grid-cols-2">
            {STORIES.map((s) => (
              <div key={s.id} className="glass rounded-2xl p-5">
                <div className="flex items-center gap-2">
                  <Chip tone="amber">{s.id}</Chip>
                  <p className="font-display text-[13.5px] font-bold text-slate-100">{s.title}</p>
                </div>
                <p className="mt-2 text-[12.5px] italic leading-relaxed text-slate-400">{s.story}</p>
                <ol className="mt-3 space-y-1.5 border-t border-white/5 pt-3 text-[12px] leading-relaxed">
                  <li className="text-slate-400"><b className="text-slate-300">Étant donné</b> {s.gwt[0].replace("Étant donné ", "")}</li>
                  <li className="text-slate-400"><b className="text-slate-300">Quand</b> {s.gwt[1].replace("Quand ", "")}</li>
                  <li className="text-emerald-200/90"><b>Alors</b> {s.gwt[2].replace("Alors ", "")}</li>
                </ol>
              </div>
            ))}
          </div>
        </Section>

        {/* Architecture */}
        <Section id="archi" icon={Landmark} title="Architecture du prototype">
          <div className="grid gap-3 md:grid-cols-3">
            {[
              {
                t: "Présentation",
                d: "Next.js (App Router) + Tailwind v4 + Framer Motion. Carte SIG SVG locale, QR via qrcode.react, graphiques BI Recharts. 100 % hors-ligne après chargement.",
              },
              {
                t: "Logique & algorithmes",
                d: "src/lib purs et testés : graphe SIG + Dijkstra (geo), devis/Luhn (pricing), santé capteurs + anti-fraude (reliability), chatbot à intentions, simulateur IoT.",
              },
              {
                t: "Données",
                d: "PostgreSQL + Drizzle ORM : users, parking_lots, parking_spots (capteurs), reservations, payments, audit_events, snapshots (entrepôt BI), sim_state. Transactions ACID.",
              },
            ].map((c) => (
              <div key={c.t} className="glass rounded-2xl p-5">
                <p className="font-display text-[13.5px] font-bold text-slate-100">{c.t}</p>
                <p className="mt-2 text-[12.5px] leading-relaxed text-slate-500">{c.d}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 rounded-xl border border-white/10 bg-black/30 px-4 py-3 font-mono text-[11px] leading-relaxed text-slate-500">
            Client → API Routes (Next.js) → Drizzle ORM → PostgreSQL &nbsp;·&nbsp; POST /api/reservations
            → BEGIN · SELECT … FOR UPDATE SKIP LOCKED · UPDATE reserved · INSERT reservation · COMMIT
          </p>
        </Section>

        {/* Traçabilité */}
        <Section id="tracabilite" icon={GitBranch} title="Matrice de traçabilité exigence → code → test">
          <div className="glass overflow-hidden rounded-2xl">
            <div className="grid grid-cols-[90px_1fr_1fr] gap-2 border-b border-white/10 bg-white/[0.03] px-5 py-2.5 font-mono text-[10px] uppercase tracking-widest text-slate-500">
              <span>Exigence</span>
              <span>Implémentation</span>
              <span>Vérification</span>
            </div>
            <div className="divide-y divide-white/5">
              {TRACE.map(([ef, impl, test]) => (
                <div key={ef} className="grid grid-cols-[90px_1fr_1fr] gap-2 px-5 py-3 text-[12px] md:items-center">
                  <Chip>{ef}</Chip>
                  <span className="font-mono text-[11px] text-cyan-200/80">{impl}</span>
                  <span className="text-[11.5px] text-slate-500">{test}</span>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* Tests & doc */}
        <Section id="tests" icon={FlaskConical} title="Tests unitaires & documentation générée">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="glass rounded-2xl p-5">
              <p className="font-display text-[14px] font-bold text-slate-100">Vitest (pendant TS de JUnit)</p>
              <p className="mt-2 text-[12.5px] leading-relaxed text-slate-500">
                Suites : <code className="text-cyan-300">geo.test.ts</code> (Dijkstra, pointes, vendredi),{" "}
                <code className="text-cyan-300">pricing.test.ts</code> (devis, Luhn, arrondi DA),{" "}
                <code className="text-cyan-300">reliability.test.ts</code> (capteurs, anti-fraude),{" "}
                <code className="text-cyan-300">chatbot.test.ts</code> (intentions Sahbi).
              </p>
              <p className="mt-3 rounded-lg bg-black/40 px-3 py-2 font-mono text-[12px] text-emerald-300">
                npx vitest run
              </p>
            </div>
            <div className="glass rounded-2xl p-5">
              <p className="font-display text-[14px] font-bold text-slate-100">TypeDoc (pendant de Javadoc)</p>
              <p className="mt-2 text-[12.5px] leading-relaxed text-slate-500">
                Documentation HTML générée automatiquement depuis les commentaires TSDoc de l'ensemble des
                modules et des routes API.
              </p>
              <a
                href="/docs/index.html"
                target="_blank"
                className="mt-3 inline-block rounded-lg bg-emerald-400/10 px-3 py-1.5 text-[12px] font-semibold text-emerald-300 transition-colors hover:bg-emerald-400/20"
              >
                Ouvrir la documentation générée
              </a>
            </div>
          </div>
        </Section>

        <p className="border-t border-white/5 pt-6 text-center text-[11px] text-slate-600">
          Prototype SmartPark — livrable du mini-projet « Assurance Qualité Logiciel » · Département
          d'Informatique, Université Mouloud Mammeri de Tizi-Ouzou · Chargée du module : Pr F. Dahmani-Bouarab
        </p>
      </div>
    </div>
  );
}
