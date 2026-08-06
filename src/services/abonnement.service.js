// Cycle de vie de l'abonnement compagnie — dégradation PROGRESSIVE en
// quatre paliers, jamais une coupure brutale. Principe directeur (cahier
// des charges) : "on ne coupe jamais une vente en cours" — une gare
// bloquée en pleine matinée pour un impayé, c'est la réputation Ankkata
// détruite sur tout le marché en une semaine.
//
// Paliers 1 (rappel) et 2 (impayé) sont calculés À LA LECTURE depuis
// `dateExpirationAbonnement`, jamais stockés (même principe que
// poste.service.js#calculerStatut) : purement informatifs, aucune
// restriction technique dure tant que l'équipe Ankkata n'a pas cliqué sur
// "Suspendre" elle-même.
//
// Paliers 3 (suspension) et 4 (résiliation) sont des actions MANUELLES
// (`statut` passé à 'suspendue'/'archivee' par l'équipe Ankkata via
// `company.controller.js#changeStatus`) — JAMAIS automatiques : un impayé
// est souvent un patron en déplacement ou un virement en retard, pas de la
// mauvaise foi. Un appel règle 90% des cas.
const MS_JOUR = 24 * 60 * 60 * 1000;

const PALIERS = {
  ACTIF: 'actif',
  RAPPEL: 'rappel',
  IMPAYE: 'impaye',
  IMPAYE_CRITIQUE: 'impaye_critique', // > J+15 sans suspension manuelle — suspension recommandée, jamais appliquée seule
  SUSPENSION: 'suspension',
  RESILIATION: 'resiliation',
};

function joursAvantEcheance(dateExpirationAbonnement) {
  const echeance = new Date(dateExpirationAbonnement);
  const auj = new Date();
  echeance.setHours(0, 0, 0, 0);
  auj.setHours(0, 0, 0, 0);
  return Math.round((echeance.getTime() - auj.getTime()) / MS_JOUR);
}

/** Calcule le palier actuel d'une compagnie — jamais stocké, toujours recalculé. */
function calculerPalier(company) {
  if (company.statut === 'archivee') return PALIERS.RESILIATION;
  if (company.statut === 'suspendue') return PALIERS.SUSPENSION;

  const jours = joursAvantEcheance(company.dateExpirationAbonnement);
  if (jours > 7) return PALIERS.ACTIF;
  if (jours >= 0) return PALIERS.RAPPEL;
  if (jours >= -15) return PALIERS.IMPAYE;
  return PALIERS.IMPAYE_CRITIQUE;
}

/**
 * true si les fonctions "non urgentes" côté admin compagnie doivent être
 * bloquées (palier 2 et pire) — nouveaux trajets, nouveaux comptes
 * guichetiers, modification des tarifs. La vente, l'impression et la
 * clôture de caisse ne sont JAMAIS concernées par cette restriction.
 */
function fonctionsNonUrgentesBloquees(company) {
  const palier = calculerPalier(company);
  return [PALIERS.IMPAYE, PALIERS.IMPAYE_CRITIQUE, PALIERS.SUSPENSION, PALIERS.RESILIATION].includes(palier);
}

/**
 * true si le poste guichet doit être en lecture seule (palier 3) : plus de
 * nouvelle vente. Vérifié UNIQUEMENT à la connexion (voir
 * auth.controller.js#loginGuichetier/loginAdmin) — jamais en cours de
 * session ni sur la création de vente elle-même, pour ne jamais couper une
 * vente en cours. Le "prochain démarrage de session" est donc la
 * granularité naturelle : une session déjà ouverte continue de vendre
 * normalement jusqu'à sa clôture.
 */
function suspensionActive(company) {
  return company.statut === 'suspendue';
}

/** Résumé exposé aux écrans admin (bandeau paliers 1/2) — voir loginAdmin. */
function resumeAbonnement(company) {
  return {
    palier: calculerPalier(company),
    dateExpiration: company.dateExpirationAbonnement,
    montantDu: company.montantDu || 0,
    joursAvantEcheance: joursAvantEcheance(company.dateExpirationAbonnement),
    suspensionDemandeeAt: company.suspensionDemandeeAt,
    resiliationAt: company.resiliationAt,
  };
}

module.exports = {
  PALIERS,
  calculerPalier,
  fonctionsNonUrgentesBloquees,
  suspensionActive,
  resumeAbonnement,
};
