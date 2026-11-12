"use client";

/**
 * TPE simulé — paiement de sortie (EF-09).
 * CIB / Edahabia (validation Luhn en direct, −5 %) ou espèces au guichet.
 */
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Banknote, CheckCircle2, CreditCard, Loader2, X } from "lucide-react";
import { formatDA, luhnCheck, maskCard, type PaymentMethod } from "@/lib/pricing";
import { cx } from "@/lib/client";

export interface Receipt {
  reference: string;
  amount: number;
  minutesParked: number;
  rushApplied: boolean;
  method: PaymentMethod;
  card: string | null;
  lotName: string;
  spotCode: string;
}

interface Props {
  open: boolean;
  lotName: string;
  spotCode: string;
  estimate: number;
  onClose: () => void;
  onPay: (method: PaymentMethod, cardNumber?: string) => Promise<{ ok: boolean; receipt?: Receipt; error?: string }>;
}

function formatCard(v: string): string {
  return v
    .replace(/\D/g, "")
    .slice(0, 16)
    .replace(/(\d{4})(?=\d)/g, "$1 ");
}

export default function PaymentDialog({ open, lotName, spotCode, estimate, onClose, onPay }: Props) {
  const [method, setMethod] = useState<PaymentMethod>("cib");
  const [card, setCard] = useState("");
  const [phase, setPhase] = useState<"form" | "processing" | "done" | "error">("form");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cardValid = card.replace(/\D/g, "").length === 16 && luhnCheck(card);
  const canPay = method === "especes" || cardValid;

  async function pay() {
    setPhase("processing");
    setError(null);
    // latence TPE simulée
    await new Promise((r) => setTimeout(r, 900));
    const res = await onPay(method, method === "especes" ? undefined : card.replace(/\D/g, ""));
    if (res.ok && res.receipt) {
      setReceipt(res.receipt);
      setPhase("done");
    } else {
      setError(res.error ?? "Paiement refusé");
      setPhase("error");
    }
  }

  function close() {
    setPhase("form");
    setReceipt(null);
    setError(null);
    onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm"
          onClick={close}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            className="glass w-full max-w-md rounded-3xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {phase === "done" && receipt ? (
              <div className="text-center">
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 16 }}
                >
                  <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-400" />
                </motion.div>
                <h3 className="font-display mt-3 text-xl font-bold text-slate-50">Paiement accepté</h3>
                <p className="mt-1 text-[13px] text-slate-400">
                  {receipt.lotName} · place {receipt.spotCode}
                </p>
                <div className="num-tick mt-4 space-y-1.5 rounded-2xl border border-white/10 bg-black/30 p-4 text-left text-[13px] text-slate-300">
                  <p className="flex justify-between">
                    <span>Durée facturée</span>
                    <b>{receipt.minutesParked} min</b>
                  </p>
                  {receipt.rushApplied && (
                    <p className="flex justify-between text-amber-300">
                      <span>Majoration heure de pointe</span>
                      <b>+25 %</b>
                    </p>
                  )}
                  {receipt.method !== "especes" && (
                    <p className="flex justify-between text-emerald-300">
                      <span>Remise e-paiement</span>
                      <b>−5 %</b>
                    </p>
                  )}
                  <p className="flex justify-between border-t border-white/10 pt-2 font-display text-base font-bold text-slate-50">
                    <span>Total</span>
                    <span>{formatDA(receipt.amount)}</span>
                  </p>
                  {receipt.card && (
                    <p className="flex justify-between text-[12px] text-slate-500">
                      <span>{receipt.method.toUpperCase()}</span>
                      <span>{receipt.card}</span>
                    </p>
                  )}
                  <p className="flex justify-between text-[11px] text-slate-500">
                    <span>Référence</span>
                    <span>{receipt.reference}</span>
                  </p>
                </div>
                <button
                  onClick={close}
                  className="mt-5 w-full rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-500 py-3 font-display text-sm font-bold text-slate-950 transition-transform hover:scale-[1.02]"
                >
                  Terminer — barrière ouverte
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-display text-lg font-bold text-slate-50">Régler la sortie</h3>
                    <p className="mt-0.5 text-[12px] text-slate-500">
                      {lotName} · place {spotCode} · estimation {formatDA(estimate)}
                    </p>
                  </div>
                  <button onClick={close} className="rounded-lg p-1 text-slate-500 hover:text-slate-200">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  {(
                    [
                      { m: "cib" as const, l: "CIB", d: "−5 %", icon: CreditCard },
                      { m: "edahabia" as const, l: "Edahabia", d: "−5 %", icon: CreditCard },
                      { m: "especes" as const, l: "Espèces", d: "guichet", icon: Banknote },
                    ] as const
                  ).map((o) => (
                    <button
                      key={o.m}
                      onClick={() => {
                        setMethod(o.m);
                        setPhase("form");
                        setError(null);
                      }}
                      className={cx(
                        "rounded-xl border p-3 text-center transition-all",
                        method === o.m
                          ? "border-emerald-400/50 bg-emerald-400/10"
                          : "border-white/10 bg-white/[0.03] hover:border-white/20",
                      )}
                    >
                      <o.icon className={cx("mx-auto h-5 w-5", method === o.m ? "text-emerald-300" : "text-slate-400")} />
                      <p className="mt-1.5 text-[12px] font-bold text-slate-200">{o.l}</p>
                      <p className="text-[10px] text-emerald-400/80">{o.d}</p>
                    </button>
                  ))}
                </div>

                {method !== "especes" ? (
                  <div className="mt-4">
                    <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                      Numéro de carte {method === "cib" ? "CIB" : "Edahabia"}
                    </label>
                    <input
                      value={card}
                      onChange={(e) => setCard(formatCard(e.target.value))}
                      placeholder="6282 1234 5678 9012"
                      inputMode="numeric"
                      className="num-tick mt-1.5 h-12 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-[15px] tracking-[0.15em] text-slate-100 outline-none placeholder:text-slate-600 focus:border-emerald-400/40"
                    />
                    <p className={cx("mt-1.5 text-[11px]", card.length === 0 ? "text-slate-600" : cardValid ? "text-emerald-400" : "text-rose-400")}>
                      {card.length === 0
                        ? "Vérifié par l'algorithme de Luhn — jamais stocké"
                        : cardValid
                          ? `Carte valide — ${maskCard(card)}`
                          : "Numéro invalide"}
                    </p>
                  </div>
                ) : (
                  <p className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-[12px] leading-relaxed text-amber-200/90">
                    Présentez votre code QR au gardien et réglez en espèces (DA). Le montant exact est calculé
                    selon la durée réelle au moment de la sortie.
                  </p>
                )}

                {phase === "error" && error && (
                  <p className="mt-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-2.5 text-[12px] text-rose-200">
                    {error}
                  </p>
                )}

                <button
                  onClick={() => void pay()}
                  disabled={!canPay || phase === "processing"}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-500 py-3 font-display text-sm font-bold text-slate-950 transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {phase === "processing" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Passerelle SATIM…
                    </>
                  ) : method === "especes" ? (
                    "Valider la sortie (paiement au gardien)"
                  ) : (
                    `Payer ${formatDA(estimate)} — estimé`
                  )}
                </button>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
