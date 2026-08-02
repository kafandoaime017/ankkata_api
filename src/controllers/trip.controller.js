// Départs concrets (instances datées d'une ligne) — le "trajet du jour"
// côté ankata_guichet. `generateForDate` instancie automatiquement un trip
// pour chaque horaire de chaque ligne active, pour une date donnée (upsert
// silencieux si déjà généré — la contrainte unique ligne/date/heure protège
// contre les doublons).
const { Trip, Ligne, LigneHoraire, Agence, Bus } = require('../models');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const { buildSearchWhere, getPagination, buildPaginatedResponse } = require('./helpers');

const INCLUDE = [
  { model: Ligne, as: 'ligne' },
  { model: Agence, as: 'agenceDepart' },
  { model: Bus, as: 'bus' },
];

const list = catchAsync(async (req, res) => {
  const where = { companyId: req.params.companyId };
  if (req.query.date) where.date = req.query.date;
  if (req.query.agenceId) where.agenceDepartId = req.query.agenceId;
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

const create = catchAsync(async (req, res) => {
  const trip = await Trip.create({ ...req.body, companyId: req.params.companyId });
  const complet = await Trip.findByPk(trip.id, { include: INCLUDE });
  res.status(201).json(complet);
});

const update = catchAsync(async (req, res) => {
  const trip = await Trip.findOne({ where: { id: req.params.id, companyId: req.params.companyId } });
  if (!trip) throw ApiError.notFound('Trajet introuvable.');
  await trip.update(req.body);
  const complet = await Trip.findByPk(trip.id, { include: INCLUDE });
  res.json(complet);
});

const remove = catchAsync(async (req, res) => {
  const trip = await Trip.findOne({ where: { id: req.params.id, companyId: req.params.companyId } });
  if (!trip) throw ApiError.notFound('Trajet introuvable.');
  await trip.destroy();
  res.status(204).send();
});

/** POST /companies/:companyId/trips/generate — { date: 'YYYY-MM-DD' } */
const generateForDate = catchAsync(async (req, res) => {
  const { date } = req.body;
  if (!date) throw ApiError.badRequest('La date est requise (YYYY-MM-DD).');

  const lignes = await Ligne.findAll({
    where: { companyId: req.params.companyId, active: true },
    include: [{ model: LigneHoraire, as: 'horaires' }],
  });

  let crees = 0;
  for (const ligne of lignes) {
    for (const h of ligne.horaires) {
      const [, wasCreated] = await Trip.findOrCreate({
        where: { ligneId: ligne.id, date, heureDepart: h.heure },
        defaults: {
          companyId: req.params.companyId,
          ligneId: ligne.id,
          agenceDepartId: ligne.agenceDepartId,
          busId: ligne.busId,
          date,
          heureDepart: h.heure,
          statut: 'prevu',
        },
      });
      if (wasCreated) crees += 1;
    }
  }

  res.status(201).json({ message: `${crees} trajet(s) généré(s) pour le ${date}.`, crees });
});

module.exports = { list, getOne, create, update, remove, generateForDate };
