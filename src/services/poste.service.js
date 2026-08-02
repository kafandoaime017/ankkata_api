// Calcul du statut d'un poste (OK/Attention/Critique/Inactif) — voir cahier
// des charges "Supervision des postes" §4. Volontairement calculé À LA
// LECTURE (jamais stocké en base) : ça évite un job de mise à jour
// périodique qui pourrait se dérégler ou prendre du retard, au prix d'un
// calcul trivial (quelques comparaisons de dates/entiers) à chaque lecture.
const { Op } = require('sequelize');
const env = require('../config/env');

const STATUTS = {
  OK: 'ok',
  ATTENTION: 'attention',
  CRITIQUE: 'critique',
  INACTIF: 'inactif',
};

const MS_HEURE = 60 * 60 * 1000;
const MS_JOUR = 24 * MS_HEURE;

const SEUIL_ATTENTION_MS = 2 * MS_HEURE;
const SEUIL_CRITIQUE_MS = 24 * MS_HEURE;
const SEUIL_INACTIF_MS = 7 * MS_JOUR;

const SEUIL_VENTES_ATTENTE_ATTENTION = 20;
const SEUIL_VENTES_ATTENTE_CRITIQUE = 100;

/** Vrai si `version` ("x.y.z") est strictement antérieure à `reference`. */
function versionObsolete(version, reference) {
  if (!version || !reference) return false; // pas d'info : ne pas pénaliser injustement
  const a = String(version).split('.').map((n) => parseInt(n, 10) || 0);
  const b = String(reference).split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const av = a[i] || 0;
    const bv = b[i] || 0;
    if (av < bv) return true;
    if (av > bv) return false;
  }
  return false;
}

/**
 * Calcule le statut d'un poste — `poste` doit exposer `derniereSynchroAt`,
 * `ventesEnAttente`, `derniereErreur`, `versionApp` (un `Poste` Sequelize ou
 * un objet JSON équivalent conviennent tous les deux).
 *
 * Ordre de sévérité (du pire au meilleur) : Inactif > Critique > Attention >
 * OK — un poste silencieux depuis 7 jours reste "Inactif" même s'il cumule
 * aussi les critères de "Critique" (>24h en fait toujours partie).
 */
function calculerStatut(poste) {
  const derniere = poste.derniereSynchroAt ? new Date(poste.derniereSynchroAt).getTime() : null;
  const ageMs = derniere == null ? Infinity : Date.now() - derniere;
  const ventesEnAttente = poste.ventesEnAttente || 0;
  const erreurActive = !!poste.derniereErreur;
  const obsolete = versionObsolete(poste.versionApp, env.latestAppVersion);

  if (ageMs > SEUIL_INACTIF_MS) return STATUTS.INACTIF;
  if (ageMs > SEUIL_CRITIQUE_MS || erreurActive || ventesEnAttente > SEUIL_VENTES_ATTENTE_CRITIQUE) return STATUTS.CRITIQUE;
  if (ageMs > SEUIL_ATTENTION_MS || ventesEnAttente > SEUIL_VENTES_ATTENTE_ATTENTION || obsolete) return STATUTS.ATTENTION;
  return STATUTS.OK;
}

/** Poids numérique du statut — sert au tri "criticité décroissante" de l'écran admin. */
const POIDS_STATUT = {
  [STATUTS.CRITIQUE]: 3,
  [STATUTS.INACTIF]: 2,
  [STATUTS.ATTENTION]: 1,
  [STATUTS.OK]: 0,
};

/**
 * Purge les heartbeats de plus de 30 jours pour un poste donné — appelée
 * opportunément après chaque insertion (voir poste.controller.js#heartbeat),
 * plutôt que via un job planifié : cette API n'a pas d'infrastructure de
 * tâches cron, et une purge "à chaque écriture" suffit largement au volume
 * attendu (un heartbeat toutes les 15 min par poste).
 */
async function purgerHeartbeatsAnciens(posteId) {
  const { PosteHeartbeat } = require('../models');
  const seuil = new Date(Date.now() - 30 * MS_JOUR);
  await PosteHeartbeat.destroy({ where: { posteId, recuAt: { [Op.lt]: seuil } } });
}

module.exports = { STATUTS, POIDS_STATUT, calculerStatut, versionObsolete, purgerHeartbeatsAnciens };
