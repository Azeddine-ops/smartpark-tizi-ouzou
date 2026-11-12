"use client";

import { QRCodeSVG } from "qrcode.react";

/** Badge QR d'accès au portail (génération locale, hors-ligne). */
export default function QRBadge({ code, size = 128 }: { code: string; size?: number }) {
  return (
    <div className="inline-flex flex-col items-center gap-2 rounded-2xl border border-emerald-400/25 bg-gradient-to-b from-emerald-400/10 to-cyan-400/5 p-4">
      <div className="rounded-xl bg-slate-950/80 p-2.5 ring-1 ring-white/10">
        <QRCodeSVG value={`SMARTPARK|${code}`} size={size} bgColor="#020617" fgColor="#6ee7b7" level="M" />
      </div>
      <p className="font-display text-sm font-bold tracking-[0.2em] text-emerald-200">{code}</p>
      <p className="text-[10px] uppercase tracking-widest text-slate-500">À scanner au portail</p>
    </div>
  );
}
