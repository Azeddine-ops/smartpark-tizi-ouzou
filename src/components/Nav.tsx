"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  FileText,
  GaugeCircle,
  Home,
  Map as MapIcon,
  MapPin,
  Ticket,
} from "lucide-react";
import { cx } from "@/lib/client";

const ITEMS = [
  { href: "/", label: "Accueil", icon: Home },
  { href: "/carte", label: "Carte", icon: MapIcon },
  { href: "/reservations", label: "Réservations", icon: Ticket },
  { href: "/admin", label: "Contrôle", icon: GaugeCircle },
  { href: "/spec", label: "Spécification", icon: FileText },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <>
      {/* Rail latéral — desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[86px] flex-col items-center border-r border-white/5 bg-[#070b14]/90 py-5 backdrop-blur lg:flex">
        <Link href="/" className="group relative mb-8 grid place-items-center">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 text-slate-950 shadow-[0_0_28px_rgba(52,211,153,0.45)] transition-transform group-hover:scale-105">
            <MapPin className="h-5 w-5" strokeWidth={2.5} />
          </span>
        </Link>

        <nav className="flex flex-1 flex-col items-center gap-2">
          {ITEMS.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cx(
                  "relative grid h-14 w-14 place-items-center gap-0.5 rounded-xl text-slate-500 transition-colors hover:text-slate-200",
                  active && "text-emerald-300",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-xl border border-emerald-400/25 bg-emerald-400/10"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <Icon className="relative z-10 h-5 w-5" />
                <span className="relative z-10 text-[9px] font-medium tracking-wide">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="flex flex-col items-center gap-1 text-center">
          <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-600">
            UMMTO
          </span>
          <span className="text-[9px] text-slate-700">AQL · M1 ISI</span>
        </div>
      </aside>

      {/* Barre basse — mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-white/5 bg-[#070b14]/95 py-2 backdrop-blur lg:hidden">
        {ITEMS.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cx(
                "flex flex-col items-center gap-1 px-3 py-1 text-slate-500",
                active && "text-emerald-300",
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[9px]">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
