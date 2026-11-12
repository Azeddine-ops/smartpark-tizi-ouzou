/**
 * Sahbi — chatbot d'orientation des nouveaux utilisateurs (EF-11).
 *
 * Moteur à intentions (règles) entièrement local : aucune donnée ne quitte
 * le serveur, réponse < 5 ms, hors-ligne garanti. Réponses en français
 * avec touches de darija, adaptées au contexte algérien (CIB, Edahabia,
 * vendredi, heures de pointe…).
 */

export interface BotReply {
  text: string;
  chips: string[];
  intent: string;
}

interface Intent {
  id: string;
  patterns: RegExp[];
  reply: string;
  chips: string[];
}

const MENU_CHIPS = ["Réserver une place", "Payer par CIB / Edahabia", "Tarifs", "Itinéraire"];

const INTENTS: Intent[] = [
  {
    id: "greeting",
    patterns: [/salam/i, /bonjour/i, /salut/i, /bonsoir/i, /azul/i, /hello/i, /\bslt\b/i],
    reply:
      "Salam ! Je suis Sahbi, votre guide SmartPark à Tizi-Ouzou. Je peux vous aider à réserver une place, calculer votre itinéraire, payer par CIB ou Edahabia, ou comprendre les tarifs. Que voulez-vous faire ?",
    chips: MENU_CHIPS,
  },
  {
    id: "payment",
    patterns: [/pay/i, /cib/i, /edahabia/i, /carte/i, /esp[èe]ce/i, /argent/i, /tpe/i, /satim/i, /dinar/i, /\bda\b/i],
    reply:
      "Trois moyens de paiement, en dinars (DA) :\n• Carte CIB — paiement électronique sécurisé, −5 % de remise.\n• Carte Edahabia (Algérie Poste) — même remise de −5 %.\n• Espèces — au gardien à la sortie, au tarif normal.\nLe paiement carte se fait au check-out depuis « Mes réservations ». Votre numéro de carte est vérifié (algorithme de Luhn) et masqué — aucune donnée bancaire n'est conservée.",
    chips: ["Tarifs", "Réserver une place", "Remise e-paiement ?"],
  },
  {
    id: "pricing",
    patterns: [/tarif/i, /prix/i, /co[uû]t/i, /combien/i, /cher/i, /gratuit/i, /remise/i],
    reply:
      "Tarifs par parking (DA/heure) : Campus UMMO 20 DA, Stade & Nouvelle Ville 25 DA, Hôpital 30 DA, Central 40 DA, Gare Routière 45 DA.\n• Facturation minimale : 30 min.\n• Heure de pointe : +25 % (07:30–09:30, 12:00–14:00, 16:30–19:00).\n• Paiement CIB / Edahabia : −5 %.\nExemple : 2 h au Parking Central en heure creuse = 80 DA, soit 76 DA par carte.",
    chips: ["Heures de pointe", "Payer par CIB / Edahabia", "Réserver une place"],
  },
  {
    id: "rush",
    patterns: [/heure/i, /pointe/i, /horaire/i, /ouvert/i, /ferme/i, /vendredi/i, /pri[èe]re/i, /quand/i],
    reply:
      "Les parkings ouvrent de 06:00 à 23:00.\nHeures de pointe (itinéraires plus longs, tarif +25 %) : 07:30–09:30, 12:00–14:00 et 16:30–19:00.\nLe vendredi, le trafic se concentre autour de la prière (11:30–13:30) : prévoyez la marge ou visez la Nouvelle Ville, souvent plus fluide.",
    chips: ["Tarifs", "Itinéraire", "Réserver une place"],
  },
  {
    id: "route",
    patterns: [/itin[ée]raire/i, /route/i, /chemin/i, /trajet/i, /aller/i, /navigation/i, /gps/i, /port/i],
    reply:
      "L'optimisation d'itinéraire repose sur le graphe routier de Tizi-Ouzou (boulevard Abane Ramdane, boulevard du 1er Novembre, RN-33…) et l'algorithme de Dijkstra pondéré par le trafic en temps réel. Choisissez votre porte d'entrée sur la Carte, puis touchez « Itinéraire » sur un parking : le tracé s'anime sur la carte avec la durée estimée et les voies empruntées.",
    chips: ["Heures de pointe", "Réserver une place"],
  },
  {
    id: "cancel",
    patterns: [/annul/i, /supprim/i, /reporter/i, /prolong/i, /modif/i],
    reply:
      "Pour annuler ou prolonger : « Mes réservations » → votre carte active → « Annuler » ou « +1 h ».\nBon à savoir (anti-fausse demande) : plus de 3 annulations par heure bloque temporairement les nouvelles réservations, et une réservation non activée (no-show) fait baisser votre score de confiance de 10 points.",
    chips: ["Score de confiance ?", "Réserver une place"],
  },
  {
    id: "trust",
    patterns: [/confiance/i, /score/i, /fraude/i, /bloqu/i, /no.?show/i, /fausse/i],
    reply:
      "Le score de confiance (0–100) protège tout le monde des fausses demandes :\n• Stationnement terminé et payé : +2 pts.\n• Annulation : −1 pt, plus de 3/h : −6 pts et blocage temporaire.\n• No-show (réservation non activée sous 15 min) : −10 pts.\nSous 40 pts, le compte est restreint. Restez fair-play, rezk yekfi !",
    chips: ["Annuler une réservation", "Réserver une place"],
  },
  {
    id: "sensor",
    patterns: [/capteur/i, /d[ée]fectueux/i, /panne/i, /fiabl/i, /occup[ée]e/i, /signal/i],
    reply:
      "Chaque place possède un capteur d'occupation qui émet un battement régulier. Un capteur qui ne répond plus (ou incohérent) est marqué défectueux : sa place passe en maintenance et n'est JAMAIS proposée. C'est notre garantie : pas de place fantôme, pas de mauvaise surprise à l'arrivée. La salle de contrôle (Admin) surveille tous les capteurs en direct.",
    chips: ["Réserver une place", "Itinéraire"],
  },
  {
    id: "qr",
    patterns: [/qr/i, /code/i, /portail/i, /barri[èe]re/i, /check.?in/i, /entr[ée]e/i, /badge/i],
    reply:
      "Après la réservation vous recevez un code (ex. SP-X7K2M9) et un QR. À l'arrivée, scannez le QR au portail (ou touchez « Check-in » dans l'appli de démo) : la place passe à « occupée » et le temps de stationnement démarre. Vous avez 15 min pour activer, sinon la réservation expire (no-show).",
    chips: ["Réserver une place", "Annuler une réservation"],
  },
  {
    // volontairement tardif : les mots « place » / « réserver » sont génériques
    id: "reserve",
    patterns: [/r[ée]serv/i, /place/i, /garer/i, /stationn/i, /park/i, /book/i],
    reply:
      "Pour réserver, c'est simple :\n1. Ouvrez la Carte et choisissez votre porte d'entrée en ville (Nord, Azazga, Ouacifs ou Boghni).\n2. Je calcule l'itinéraire optimal et les parkings recommandés.\n3. Touchez un parking puis « Réserver » — une place vous est attribuée instantanément et bloquée pour vous pendant 15 min.\n4. Présentez le code QR au portail pour le check-in.\nSeules les places à capteur sain sont attribuées : on ne vous enverra jamais vers une place occupée !",
    chips: ["Payer par CIB / Edahabia", "Annuler une réservation", "Tarifs"],
  },
  {
    id: "thanks",
    patterns: [/merci/i, /choukran/i, /thanks/i, /top/i, /parfait/i],
    reply:
      "Avec plaisir, sahbi ! Bonne route et bon stationnement à Tizi-Ouzou. Si vous cherchez autre chose, je suis là.",
    chips: MENU_CHIPS,
  },
  {
    id: "help",
    patterns: [/aide/i, /help/i, /comment/i, /pourquoi/i, /quoi/i, /\bqui\b/i, /fonctionne/i],
    reply:
      "Voici ce que je sais faire :\n• Vous guider pour réserver une place en 4 étapes.\n• Expliquer les paiements CIB / Edahabia / espèces.\n• Détailler tarifs et heures de pointe.\n• Raconter la fiabilité des capteurs et le score de confiance.\nChoisissez un sujet ci-dessous ou écrivez votre question.",
    chips: MENU_CHIPS.concat(["Capteurs défectueux ?"]),
  },
];

const FALLBACK: BotReply = {
  text:
    "Hmm, je n'ai pas tout compris. Je suis calé sur SmartPark : réservation, itinéraires optimisés, paiement CIB/Edahabia, tarifs, capteurs… Essayez l'un de ces sujets !",
  chips: MENU_CHIPS.concat(["Capteurs défectueux ?", "Score de confiance ?"]),
  intent: "fallback",
};

/** Produit la réponse du chatbot pour un message utilisateur. */
export function reply(message: string): BotReply {
  const text = message.trim();
  if (!text) return { ...FALLBACK, text: "Écrivez-moi quelque chose, je vous écoute !" };
  for (const intent of INTENTS) {
    if (intent.patterns.some((p) => p.test(text))) {
      return { text: intent.reply, chips: intent.chips, intent: intent.id };
    }
  }
  return FALLBACK;
}

export const WELCOME: BotReply = {
  text:
    "Salam ! Bienvenue sur SmartPark Tizi-Ouzou. Je suis Sahbi, votre assistant d'orientation. Première visite ? Je vous montre : réservez en 4 étapes, payez par CIB ou Edahabia (−5 %), et laissez Dijkstra trouver votre itinéraire malgré les heures de pointe.",
  chips: MENU_CHIPS,
  intent: "welcome",
};
