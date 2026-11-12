/**
 * Tarification SmartPark (en dinars algériens, DA).
 *
 * Règles métier adaptées au contexte algérien :
 *  - facturation minimale de 30 minutes ;
 *  - majoration de +25 % en heure de pointe (régulation de la demande) ;
 *  - remise de −5 % pour le paiement électronique CIB / Edahabia
 *    (politique d'encouragement du e-paiement, SATIM) — jamais plus chère
 *    que le règlement espèces à prestation égale ;
 *  - arrondi à la cinquantaine de centimes… non : à 5 DA (habitudes locales).
 *
 * Traçabilité : EF-07 (devis), EF-09 (paiement), ENF-05 (adaptation locale).
 */

export type PaymentMethod = "cib" | "edahabia" | "especes";

export const MIN_BILL_MINUTES = 30;
export const RUSH_SURCHARGE_RATE = 0.25;
export const CARD_DISCOUNT_RATE = 0.05;

export const METHOD_LABELS: Record<PaymentMethod, string> = {
  cib: "Carte CIB",
  edahabia: "Carte Edahabia",
  especes: "Espèces (au gardien)",
};

export interface Quote {
  billedMinutes: number;
  hourlyRate: number;
  base: number;
  rushSurcharge: number;
  cardDiscount: number;
  total: number;
  rushApplied: boolean;
  method: PaymentMethod | null;
}

function roundDA(amount: number): number {
  return Math.round(amount / 5) * 5;
}

/**
 * Calcule le devis d'un stationnement.
 * @param hourlyRate tarif horaire du parc (DA/h)
 * @param durationMin durée réelle ou demandée (minutes)
 * @param rush heure de pointe active
 * @param method mode de paiement (remise carte si CIB/Edahabia)
 */
export function quoteParking(
  hourlyRate: number,
  durationMin: number,
  rush = false,
  method: PaymentMethod | null = null,
): Quote {
  const billed = Math.max(MIN_BILL_MINUTES, Math.ceil(durationMin));
  const base = (hourlyRate * billed) / 60;
  const rushSurcharge = rush ? base * RUSH_SURCHARGE_RATE : 0;
  const subtotal = base + rushSurcharge;
  const cardDiscount =
    method && method !== "especes" ? subtotal * CARD_DISCOUNT_RATE : 0;
  // la carte n'est jamais plus chère que les espèces à prestation égale
  const cash = roundDA(subtotal);
  const total =
    method && method !== "especes" ? Math.min(cash, roundDA(subtotal - cardDiscount)) : cash;
  return {
    billedMinutes: billed,
    hourlyRate,
    base: Math.round(base),
    rushSurcharge: Math.round(rushSurcharge),
    cardDiscount: Math.round(cardDiscount),
    total,
    rushApplied: rush,
    method,
  };
}

/** Montant formaté en dinars : « 120 DA ». */
export function formatDA(amount: number): string {
  return `${Math.round(amount).toLocaleString("fr-DZ")} DA`;
}

/**
 * Vérification de carte bancaire par l'algorithme de Luhn.
 * Utilisé pour valider les numéros CIB / Edahabia (16 chiffres).
 */
export function luhnCheck(cardNumber: string): boolean {
  const digits = cardNumber.replace(/[\s-]/g, "");
  if (!/^\d{15,19}$/.test(digits)) return false;
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

/** Numéro masqué pour l'affichage : « 6282 •••• •••• 4242 ». */
export function maskCard(cardNumber: string): string {
  const digits = cardNumber.replace(/\D/g, "");
  if (digits.length < 8) return "••••";
  return `${digits.slice(0, 4)} •••• •••• ${digits.slice(-4)}`;
}

/** Référence de transaction déterministe-style (TPE / passerelle SATIM). */
export function paymentReference(prefix = "SP"): string {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  const t = Date.now().toString(36).toUpperCase();
  return `${prefix}-${t}-${rand}`;
}
