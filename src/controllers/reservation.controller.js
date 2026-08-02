// Réservations (en ligne ou guichet) — gestion complète pour le personnel
// de la compagnie, lecture seule pour Ankkata (supervision).
const { Reservation, Client, Trip } = require('../models');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const { enregistrerAudit } = require('../services/audit.service');
const { generateDatedReference } = require('../utils/idGenerator');
const { buildSearchWhere, getPagination, buildPaginatedResponse } = require('./helpers');

const INCLUDE = [{ model: Client, as: 'client' }, { model: Trip, as: 'trip' }];

const list = catchAsync(async (req, res) => {
  const where = { companyId: req.params.companyId, ...buildSearchWhere(req.query, ['nomVoyageur', 'telephoneVoyageur', 'villeArrivee']) };
  if (req.query.agenceId) where.agenceId = req.query.agenceId;
  if (req.query.statut) where.statut = req.query.statut;
  if (req.query.canal) where.canal = req.query.canal;

  const { page, limit, offset } = getPagination(req.query);
  const result = await Reservation.findAndCountAll({
    where,
    limit,
    offset,
    order: [['date', 'DESC']],
    include: INCLUDE,
    distinct: true,
  });
  res.json(buildPaginatedResponse(result, { page, limit }));
});

const getOne = catchAsync(async (req, res) => {
  const reservation = await Reservation.findOne({ where: { id: req.params.id, companyId: req.params.companyId }, include: INCLUDE });
  if (!reservation) throw ApiError.notFound('Réservation introuvable.');
  res.json(reservation);
});

const create = catchAsync(async (req, res) => {
  const reservation = await Reservation.create({
    ...req.body,
    reference: req.body.reference || generateDatedReference('RES'),
    companyId: req.params.companyId,
  });
  await enregistrerAudit({
    action: 'Création de réservation',
    details: `Réservation ${reservation.reference} pour ${reservation.nomVoyageur}.`,
    companyId: req.params.companyId,
    auteur: req.auth,
  });
  res.status(201).json(reservation);
});

const cancel = catchAsync(async (req, res) => {
  const reservation = await Reservation.findOne({ where: { id: req.params.id, companyId: req.params.companyId } });
  if (!reservation) throw ApiError.notFound('Réservation introuvable.');
  if (reservation.statut === 'annulee') throw ApiError.conflict('Cette réservation est déjà annulée.');

  await reservation.update({ statut: 'annulee', motifAnnulation: req.body.motif || null });
  await enregistrerAudit({
    action: 'Annulation de réservation',
    details: `Réservation ${reservation.reference} annulée${req.body.motif ? ` (${req.body.motif})` : ''}.`,
    companyId: req.params.companyId,
    auteur: req.auth,
  });
  res.json(reservation);
});

module.exports = { list, getOne, create, cancel };
