import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/sora";
import "@fontsource-variable/inter";
import "./globals.css";
import Nav from "@/components/Nav";
import ChatBot from "@/components/ChatBot";

export const metadata: Metadata = {
  title: "SmartPark Tizi-Ouzou — Stationnement intelligent",
  description:
    "Prototype SmartPark (UMMTO — Assurance Qualité Logiciel, Master 1 ISI 2026/2027) : SIG temps réel, optimisation d'itinéraire, capteurs fiables, paiement CIB/Edahabia.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body className="antialiased">
        <Nav />
        <main className="min-h-screen pb-24 lg:pb-0 lg:pl-[86px]">{children}</main>
        <ChatBot />
      </body>
    </html>
  );
}
