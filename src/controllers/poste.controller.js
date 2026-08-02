// Supervision des postes (installations du logiciel guichet) — deux points
// d'entrée en lecture comme pour les tickets de support (voir
// supportTicket.controller.js) : un global réservé à l'équipe Ankkata
// (toutes compagnies confondues), un scopé à une compagnie (accessible aussi
// à son administrateur). Le heartbeat, lui, n'a besoin d'aucun paramètre
// d'URL : la compagnie/l'agence viennent du JWT du poste qui l'envoie (voir
// resolveCompanyId, middlewares/auth.middleware.js).
//
// Pas de pagination façon `buildPaginatedResponse` ici : c'est un tableau de
// bord de supervision (quelques dizaines de postes au plus par compagnie),
// pas une liste métier à parcourir page par page — mieux vaut renvoyer tout
// le scope d'un coup pour calculer des compteurs globaux fiables (OK /
// attention / critique / inactif) qui ne dépendent pas d'un filtre appliqué
// après coup.
const { Poste, PosteHeartbeat, Company, Agence } = require('../models');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');
const { ESPACES } = require('../constants/roles');
const { resolveCompanyId } = require('../middlewares/auth.middleware');
const { calculerStatut, POIDS_STATUT, purgerHeartbeatsAnciens } = require('../services/poste.service');

const INCLUDE = [
  { model: Company, as: 'company', attributes: ['id', 'nom'] },
  { model: Agence, as: 'agence', attributes: ['id', 'nom'] },
];

/** Sérialise un poste + son statut calculé à la lecture (jamais stocké). */
function avecStatut(poste) {
  const json = poste.toJSON();
  return { ...json, statut: calculerStatut(json) };
}

/** Compte OK/attention/critique/inactif sur un ensemble de postes déjà sérialisés (avec `statut`). */
function calculerCompteurs(postesAvecStatut) {
  const compteurs = { ok: 0, attention: 0, critique: 0, inactif: 0 };
  for (const p of postesAvecStatut) {
    compteurs[p.statut] = (compteurs[p.statut] || 0) + 1;
  }
  return compteurs;
}

/** Trie par criticité décroissante (critique > inactif > attention > ok), puis synchro la plus ancienne d'abord. */
function trierParCriticite(postesAvecStatut) {
  return [...postesAvecStatut].sort((a, b) => {
    const diff = (POIDS_STATUT[b.statut] || 0) - (POIDS_STATUT[a.statut] || 0);
    if (diff !== 0) return diff;
    const da = a.derniereSynchroAt ? new Date(a.derniereSynchroAt).getTime() : 0;
    const db = b.derniereSynchroAt ? new Date(b.derniereSynchroAt).getTime() : 0;
    return da - db;
  });
}

/** GET /postes — inbox globale, réservée à l'équipe Ankkata. Filtres : ?companyId=, ?statut=. */
const listGlobal = catchAsync(async (req, res) => {
  const where = { actif: true };
  if (req.query.companyId) where.companyId = req.query.companyId;

  const postes = await Poste.findAll({ where, include: INCLUDE, order: [['derniereSynchroAt', 'ASC']] });
  const avecStatuts = postes.map(avecStatut);
  const compteurs = calculerCompteurs(avecStatuts);
  const filtres = req.query.statut ? avecStatuts.filter((p) => p.statut === req.query.statut) : avecStatuts;

  res.json({ compteurs, postes: trierParCriticite(filtres) });
});

/** GET /companies/:companyId/postes — postes d'une compagnie donnée (admin + Ankkata). */
const listForCompany = catchAsync(async (req, res) => {
  const where = { companyId: req.params.companyId, actif: true };

  const postes = await Poste.findAll({ where, include: INCLUDE, order: [['derniereSynchroAt', 'ASC']] });
  const avecStatuts = postes.map(avecStatut);
  const compteurs = calculerCompteurs(avecStatuts);
  const filtres = req.query.statut ? avecStatuts.filter((p) => p.statut === req.query.statut) : avecStatuts;

  res.json({ compteurs, postes: trierParCriticite(filtres) });
});

/** GET /postes/:id (ou /companies/:companyId/postes/:id) — détail + 30 derniers heartbeats. */
const getOne = catchAsync(async (req, res) => {
  const where = { id: req.params.id };
  if (req.params.companyId) where.companyId = req.params.companyId;
  const poste = await Poste.findOne({ where, include: INCLUDE });
  if (!poste) throw ApiError.notFound('Poste introuvable.');

  const heartbeats = await PosteHeartbeat.findAll({
    where: { posteId: poste.id },
    order: [['recuAt', 'DESC']],
    limit: 30,
  });

  res.json({ ...avecStatut(poste), heartbeats });
});

/** PATCH /postes/:id/resoudre — efface la dernière erreur signalée (action manuelle de l'admin/Ankkata). */
const marquerResolu = catchAsync(async (req, res) => {
  const where = { id: req.params.id };
  if (req.params.companyId) where.companyId = req.params.companyId;
  const poste = await Poste.findOne({ where });
  if (!poste) throw ApiError.notFound('Poste introuvable.');

  await poste.update({ derniereErreur: null, derniereErreurAt: null });
  res.json(avecStatut(poste));
});

/**
 * POST /postes/heartbeat — envoyé par le logiciel guichet lui-même (JWT
 * admin/guichetier déjà en poche), pas besoin de :companyId dans l'URL : la
 * compagnie/l'agence viennent du token, jamais du corps de la requête
 * (cloisonnement strict — un poste ne peut mettre à jour que ses propres
 * données). Idempotent et tolérant : ne doit jamais faire échouer la
 * synchro des ventes, y compris sur un payload partiel.
 */
const heartbeat = catchAsync(async (req, res) => {
  const companyId = resolveCompanyId(req);
  if (!companyId) throw ApiError.badRequest('Compagnie non identifiée.');

  const machineId = (req.body.machineId || req.body.machine_id || '').trim();
  if (!machineId) throw ApiError.badRequest('Identifiant de poste (machineId) requis.');

  const versionApp = req.body.versionApp || req.body.version_app || null;
  const osInfo = req.body.osInfo || req.body.os_info || null;
  const ventesEnAttente = Number.isFinite(Number(req.body.ventesEnAttente ?? req.body.ventes_en_attente))
    ? Number(req.body.ventesEnAttente ?? req.body.ventes_en_attente)
    : 0;
  // Le texte d'erreur éventuel — voir avertissement `derniereErreur` : ne
  // s'écrase que si une nouvelle erreur est effectivement signalée, jamais
  // effacé automatiquement par un heartbeat "propre" (seule l'action
  // manuelle marquerResolu le fait, cf. `derniere_erreur non résolue` §4).
  const derniereErreur = req.body.derniereErreur || req.body.derniere_erreur || null;
  const agenceId = req.auth?.agenceId || null;

  const [poste] = await Poste.findOrCreate({
    where: { companyId, machineId },
    defaults: { companyId, machineId, agenceId, versionApp, osInfo },
  });

  const champs = {
    versionApp,
    osInfo,
    // Toujours l'heure SERVEUR — jamais `horloge_locale` du poste, peu
    // fiable (voir cahier des charges §7 côté mode offline).
    derniereSynchroAt: new Date(),
    ventesEnAttente,
  };
  if (agenceId) champs.agenceId = agenceId;
  if (derniereErreur) {
    champs.derniereErreur = derniereErreur;
    champs.derniereErreurAt = new Date();
  }
  await poste.update(champs);

  await PosteHeartbeat.create({
    posteId: poste.id,
    recuAt: champs.derniereSynchroAt,
    versionApp,
    ventesEnAttente,
    erreur: derniereErreur,
  });
  // Purge best-effort — une erreur ici ne doit jamais faire échouer le heartbeat.
  purgerHeartbeatsAnciens(poste.id).catch(() => {});

  res.json({ ok: true, versionDisponible: env.latestAppVersion });
});

module.exports = { listGlobal, listForCompany, getOne, marquerResolu, heartbeat };
