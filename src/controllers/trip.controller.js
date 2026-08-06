// Départs concrets (instances datées d'une ligne) — le "trajet du jour"
// côté ankata_guichet. `generateForDate` instancie automatiquement un trip
// pour chaque horaire de chaque ligne active, pour une date donnée (upsert
// silencieux si déjà généré — la contrainte unique ligne/date/heure protège
// contre les doublons).
const { Trip, Ligne, Agence, Bus } = require('../models');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const { buildSearchWhere, getPagination, buildPaginatedResponse } = require('./helpers');
const { genererTrajetsPourCompagnie } = require('../services/tripGeneration.service');

const INCLUDE = [
  { model: Ligne, as: 'ligne' },
  { model: Agence, as: 'agenceDepart' },
  { model: Bus, as: 'bus' },
];

const list = catchAsync(async (req, res) => {
  const where = { companyId: req.params.companyId };
  if (req.query.date) where.date = req.query.date;
  if (req.query.agenceId) where.agenceDepartId = req.query.agenceId;
  // Utilisé notamment pour retrouver les trajets de la ligne RETOUR d'une
  // paire réversible lors d'une vente aller-retour (voir vente_modal.dart) —
  // cette ligne retour part généralement d'une autre agence que celle du
  // guichetier connecté, donc `agenceId` seul ne suffit pas à la retrouver.
  if (req.query.ligneId) where.ligneId = req.query.ligneId;
  Object.assign(where, buildSearchWhere(req.query, []));

  const { page, limit, offset } = getPagination(req.query);
  const result = await Trip.findAndCountAll({
    where,
    limit,
    offset,
    order: [['date', 'ASC'], ['heureDepart', 'ASC']],
    include: INCLUDE,
    distinct: true,
  });
  res.json(buildPaginatedResponse(result, { page, limit }));
});

const getOne = catchAsync(async (req, res) => {
  const trip = await Trip.findOne({ where: { id: req.params.id, companyId: req.params.companyId }, include: INCLUDE });
  if (!trip) throw ApiError.notFound('Trajet introuvable.');
  res.json(trip);
});

/**
 * Valide les surcharges ponctuelles de quota par canal (voir migration
 * `add-quota-overrides-to-trips`) — un entier positif ou nul si renseigné,
 * ou `null`/absent pour retomber sur la valeur par défaut de la Ligne.
 * Message clair plutôt que de laisser remonter une erreur de validation
 * Sequelize brute au client.
 */
function validerQuotaOverrides(champs) {
  for (const [champ, libelle] of [
    ['quotaEnLigneOverride', 'en ligne'],
    ['quotaGuichetOverride', 'guichet'],
  ]) {
    if (champs[champ] === undefined || champs[champ] === null) continue;
    const valeur = Number(champs[champ]);
    if (!Number.isInteger(valeur) || valeur < 0) {
      throw ApiError.badRequest(`La surcharge de quota ${libelle} pour ce trajet doit être un nombre entier positif ou nul.`);
    }
  }
}

const create = catchAsync(async (req, res) => {
  validerQuotaOverrides(req.body);
  const trip = await Trip.create({ ...req.body, companyId: req.params.companyId });
  const complet = await Trip.findByPk(trip.id, { include: INCLUDE });
  res.status(201).json(complet);
});

const update = catchAsync(async (req, res) => {
  const trip = await Trip.findOne({ where: { id: req.params.id, companyId: req.params.companyId } });
  if (!trip) throw ApiError.notFound('Trajet introuvable.');
  validerQuotaOverrides(req.body);
  await trip.update(req.body);
  const complet = await Trip.findByPk(trip.id, { include: INCLUDE });
  res.json(complet);
});

/**
 * PATCH /companies/:companyId/trips/:id/quota — route dédiée, séparée de
 * `update`, pour l'exception support Ankkata (voir
 * `canOperateCompagnieOrAnkkataSupport` dans `auth.middleware.js` et
 * `trip.routes.js`) : l'équipe Ankkata reste en lecture seule sur tout le
 * reste d'un trajet (statut, bus, date, annulation...), mais peut ajuster
 * cette surcharge ponctuelle pour dépanner une compagnie. Écrit UNIQUEMENT
 * `quotaEnLigneOverride`/`quotaGuichetOverride`, quel que soit le contenu du
 * corps de la requête — même un appel malveillant/mal formé ne peut pas
 * passer par cette route pour modifier autre chose sur le trajet.
 */
const updateQuota = catchAsync(async (req, res) => {
  const trip = await Trip.findOne({ where: { id: req.params.id, companyId: req.params.companyId } });
  if (!trip) throw ApiError.notFound('Trajet introuvable.');

  const champs = {
    quotaEnLigneOverride: req.body.quotaEnLigneOverride ?? null,
    quotaGuichetOverride: req.body.quotaGuichetOverride ?? null,
  };
  validerQuotaOverrides(champs);
  await trip.update(champs);
  const complet = await Trip.findByPk(trip.id, { include: INCLUDE });
  res.json(complet);
});

const remove = catchAsync(async (req, res) => {
  const trip = await Trip.findOne({ where: { id: req.params.id, companyId: req.params.companyId } });
  if (!trip) throw ApiError.notFound('Trajet introuvable.');
  await trip.destroy();
  res.status(204).send();
});

/**
 * POST /companies/:companyId/trips/generate — { date: 'YYYY-MM-DD' }
 * Chaque ligne génère déjà automatiquement ses ~2 prochains mois de trajets
 * dès sa création (voir `ligne.controller.js#create` et
 * `services/tripGeneration.service.js#genererTrajetsPourLigneSurPeriode`) —
 * cette route manuelle reste là pour étendre l'horizon au-delà, ou combler
 * un trou après coup (ex. nouvel horaire ajouté sur une ligne existante).
 */
const generateForDate = catchAsync(async (req, res) => {
  const { date } = req.body;
  if (!date) throw ApiError.badRequest('La date est requise (YYYY-MM-DD).');

  const crees = await genererTrajetsPourCompagnie(req.params.companyId, date);
  res.status(201).json({ message: `${crees} trajet(s) généré(s) pour le ${date}.`, crees });
});

module.exports = { list, getOne, create, update, updateQuota, remove, generateForDate };
