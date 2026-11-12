"use client";

import Link from "next/link";
import Image from "next/image";
import useSWR from "swr";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  BotMessageSquare,
  CreditCard,
  FileCheck2,
  FlaskConical,
  MapPinned,
  Radar,
  Route as RouteIcon,
  ShieldCheck,
  Siren,
  Sparkles,
} from "lucide-react";
import { fetcher } from "@/lib/client";

interface Totals {
  totals: { capacity: number; assignable: number; defectiveSensors: number; occupied: number };
  sim: { rush: boolean; rushLabel: string };
}

const MARQUEE = [
  "Paiement CIB",
  "Edahabia acceptée",
  "Anti-fausse demande",
  "Capteurs surveillés 24/7",
  "Dijkstra temps réel",
  "Tarif de pointe régulé",
  "QR d'accès portail",
  "Zéro place fantôme",
];

const STEPS = [
  {
    n: "01",
    title: "Choisissez votre porte d'entrée",
    text: "Bouira, Azazga, Ouacifs ou Boghni : le graphe routier SIG de Tizi-Ouzou sait d'où vous arrivez.",
  },
  {
    n: "02",
    title: "Suivez l'itinéraire optimal",
    text: "Dijkstra pondéré par le trafic : en heure de pointe ou le vendredi midi, l'algorithme contourne la congestion.",
  },
  {
    n: "03",
    title: "Réservez une place certifiée",
    text: "Attribution atomique et transactionnelle : uniquement des places libres à capteur sain. Jamais deux voitures, jamais un mirage.",
  },
  {
    n: "04",
    title: "Scannez, garez-vous, payez",
    text: "QR au portail, chrono réel, paiement CIB ou Edahabia (−5 %)… ou espèces au gardien, à l'algérienne.",
  },
];

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "Fiabilité capteurs",
    text: "Un capteur muet ou incohérent retire instantanément sa place de l'assignation. On ne promet que ce qui est vérifié.",
    accent: "text-emerald-300 bg-emerald-500/10",
  },
  {
    icon: Siren,
    title: "Anti-fausse demande",
    text: "Score de confiance, quotas d'annulation, pénalité no-show : les places restent pour ceux qui viennent vraiment.",
    accent: "text-amber-300 bg-amber-500/10",
  },
  {
    icon: MapPinned,
    title: "SIG 100 % local",
    text: "Carte vectorielle de Tizi-Ouzou rendue hors-ligne : démo portable, zéro dépendance réseau, GPS approximatifs affichés.",
    accent: "text-cyan-300 bg-cyan-500/10",
  },
  {
    icon: RouteIcon,
    title: "Optimisation d'itinéraire",
    text: "Algorithme de Dijkstra sur 22 nœuds routiers, vitesses par classe de voie et facteur de congestion horaire.",
    accent: "text-indigo-300 bg-indigo-500/10",
  },
  {
    icon: Banknote,
    title: "Pensée pour l'Algérie",
    text: "Dinars, CIB, Edahabia, espèces au guichet, pic du vendredi midi, tarification de pointe qui régule la demande.",
    accent: "text-rose-300 bg-rose-500/10",
  },
  {
    icon: BotMessageSquare,
    title: "Sahbi, le chatbot",
    text: "Assistant d'orientation des nouveaux utilisateurs : moteur à intentions local, réponses < 5 ms, conseils adaptés.",
    accent: "text-teal-300 bg-teal-500/10",
  },
];

export default function LandingPage() {
  const { data } = useSWR<Totals>("/api/parkings", fetcher, { refreshInterval: 8000 });
  const t = data?.totals;

  return (
    <div className="overflow-x-clip">
      {/* ─── HERO ─── */}
      <section className="relative mx-auto max-w-[1500px] px-4 pb-10 pt-10 lg:px-8 lg:pt-14">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
          <div>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-300"
            >
              <Sparkles className="h-3.5 w-3.5" />
              UMMTO · Assurance Qualité Logiciel · Master 1 ISI 2026/2027
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="font-display mt-4 text-[42px] font-extrabold leading-[1.02] tracking-tight text-slate-50 sm:text-6xl lg:text-[68px]"
            >
              Garez-vous
              <span className="shimmer-text block">malin à Tizi-Ouzou.</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16 }}
              className="mt-5 max-w-xl text-[15px] leading-relaxed text-slate-400"
            >
              SmartPark localise en temps réel les places <b className="text-slate-200">réellement libres</b>,
              trace votre itinéraire optimal malgré les heures de pointe, bloque les fausses demandes et
              encaisse en CIB, Edahabia ou espèces. Une place promise est une place qui vous attend.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.24 }}
              className="mt-7 flex flex-wrap gap-3"
            >
              <Link
                href="/carte"
                className="group flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-500 px-6 py-3.5 font-display text-sm font-bold text-slate-950 shadow-[0_12px_40px_rgba(52,211,153,0.4)] transition-transform hover:scale-[1.04]"
              >
                Trouver une place
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/admin"
                className="rounded-xl border border-white/10 bg-white/5 px-6 py-3.5 font-display text-sm font-semibold text-slate-200 transition-colors hover:bg-white/10"
              >
                Salle de contrôle
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 }}
              className="num-tick mt-8 flex flex-wrap gap-6 text-[12px] text-slate-500"
            >
              <span>
                <b className="font-display text-xl text-emerald-300">{t ? t.assignable : "—"}</b>
                <br />
                places fiables maintenant
              </span>
              <span>
                <b className="font-display text-xl text-cyan-300">{t ? t.defectiveSensors : "—"}</b>
                <br />
                capteurs sous surveillance
              </span>
              <span>
                <b className="font-display text-xl text-amber-300">{data?.sim.rush ? "+25 %" : "×1"}</b>
                <br />
                {data ? data.sim.rushLabel : "…"}
              </span>
            </motion.div>
          </div>

          {/* Visuel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15, duration: 0.7 }}
            className="relative"
          >
            <div className="animate-float-y relative overflow-hidden rounded-[28px] border border-white/10 shadow-[0_40px_120px_rgba(2,8,23,0.8)]">
              <Image
                src="/images/hero.jpg"
                alt="Tizi-Ouzou la nuit — parkings intelligents"
                width={1100}
                height={880}
                className="h-auto w-full object-cover"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#05080f] via-transparent to-transparent" />
              {/* pastilles flottantes */}
              <div className="glass-soft absolute left-4 top-4 rounded-2xl px-4 py-3 text-[11px]">
                <p className="flex items-center gap-1.5 font-semibold text-emerald-300">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                  EN DIRECT
                </p>
                <p className="num-tick mt-0.5 font-display text-lg font-bold text-slate-50">
                  {t ? `${t.assignable}/${t.capacity}` : "…"} places
                </p>
              </div>
              <div className="glass-soft absolute bottom-4 right-4 rounded-2xl px-4 py-3 text-[11px]">
                <p className="flex items-center gap-1.5 font-semibold text-cyan-300">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  Attribution atomique
                </p>
                <p className="mt-0.5 text-slate-300">Zéro double réservation, zéro mirage</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Marquee */}
        <div className="relative mt-10 overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] py-3">
          <motion.div
            className="flex w-max gap-8 pr-8"
            animate={{ x: ["0%", "-50%"] }}
            transition={{ duration: 26, ease: "linear", repeat: Infinity }}
          >
            {[...MARQUEE, ...MARQUEE].map((m, i) => (
              <span key={i} className="flex items-center gap-2 whitespace-nowrap text-[12px] font-medium text-slate-500">
                <span className="h-1 w-1 rounded-full bg-emerald-400" />
                {m}
              </span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── ÉTAPES ─── */}
      <section className="mx-auto max-w-[1500px] px-4 py-14 lg:px-8">
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="font-display text-3xl font-bold text-slate-50"
        >
          Quatre étapes, <span className="text-gradient">zéro stress</span>
        </motion.h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="glass group rounded-2xl p-5 transition-colors hover:border-emerald-400/25"
            >
              <span className="font-display text-sm font-bold text-emerald-400/70">{s.n}</span>
              <p className="font-display mt-2 text-[15px] font-bold text-slate-100">{s.title}</p>
              <p className="mt-2 text-[12.5px] leading-relaxed text-slate-500">{s.text}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── FONCTIONNALITÉS ─── */}
      <section className="mx-auto max-w-[1500px] px-4 py-10 lg:px-8">
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="font-display text-3xl font-bold text-slate-50"
        >
          Une ingénierie <span className="text-gradient">de confiance</span>
        </motion.h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="glass rounded-2xl p-5"
            >
              <span className={`grid h-11 w-11 place-items-center rounded-xl ${f.accent}`}>
                <f.icon className="h-5 w-5" />
              </span>
              <p className="font-display mt-3 text-[15px] font-bold text-slate-100">{f.title}</p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-500">{f.text}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── QUALITÉ ─── */}
      <section className="mx-auto max-w-[1500px] px-4 py-14 lg:px-8">
        <div className="glass relative overflow-hidden rounded-3xl p-8 lg:p-12">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl" />
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="font-display text-3xl font-bold text-slate-50"
          >
            Assurance qualité <span className="text-gradient">prouvée</span>
          </motion.h2>
          <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-slate-400">
            Chaque exigence du cahier des charges est traçable jusqu'au code et à ses tests.
            La démarche complète — hypothèses, exigences, user stories, traçabilité — est publiée
            avec ce prototype.
          </p>
          <div className="mt-7 grid gap-4 md:grid-cols-3">
            {[
              {
                icon: FlaskConical,
                title: "Tests unitaires Vitest",
                text: "Dijkstra, Luhn, devis pointe, fiabilité capteurs, anti-fraude, chatbot : la logique métier est sous test.",
                cta: "npx vitest run",
                href: "/spec#tests",
                code: true,
              },
              {
                icon: FileCheck2,
                title: "Documentation générée",
                text: "TypeDoc (équivalent Javadoc) généré depuis les commentaires TSDoc des modules SIG, pricing et fiabilité.",
                cta: "Ouvrir la doc",
                href: "/docs/index.html",
              },
              {
                icon: CreditCard,
                title: "Traçabilité EF/ENF",
                text: "12 exigences fonctionnelles, 8 non fonctionnelles, user stories Gherkin et matrice exigence → code → test.",
                cta: "Voir la spécification",
                href: "/spec",
              },
            ].map((q, i) => (
              <motion.div
                key={q.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="rounded-2xl border border-white/10 bg-black/20 p-5"
              >
                <q.icon className="h-6 w-6 text-cyan-300" />
                <p className="font-display mt-3 font-bold text-slate-100">{q.title}</p>
                <p className="mt-1.5 text-[12px] leading-relaxed text-slate-500">{q.text}</p>
                <Link
                  href={q.href}
                  target={q.href.startsWith("/docs") ? "_blank" : undefined}
                  className={
                    q.code
                      ? "num-tick mt-3 inline-block rounded-lg bg-white/5 px-3 py-1.5 font-mono text-[12px] text-emerald-300"
                      : "mt-3 inline-block rounded-lg bg-emerald-400/10 px-3 py-1.5 text-[12px] font-semibold text-emerald-300 transition-colors hover:bg-emerald-400/20"
                  }
                >
                  {q.cta}
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-white/5 py-8">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3 px-4 text-[11px] text-slate-600 lg:px-8">
          <p>
            <b className="text-slate-400">SmartPark Tizi-Ouzou</b> — prototype du mini-projet « Assurance
            Qualité Logiciel » (situation problème authentique).
          </p>
          <p>
            Université Mouloud Mammeri · Département d'Informatique · Master 1 ISI · 2026/2027 · Pr F.
            Dahmani-Bouarab
          </p>
        </div>
      </footer>
    </div>
  );
}
