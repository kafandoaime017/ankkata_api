// Réservations (en ligne ou guichet) — gestion complète pour le personnel
// de la compagnie, lecture seule pour Ankkata (supervision).
const { sequelize, Reservation, Client, Trip } = require('../models');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const { enregistrerAudit } = require('../services/audit.service');
const { generateDatedReference } = require('../utils/idGenerator');
const { verifierEtVerrouillerQuota } = require('../services/quota.service');
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
  // Même quota que pour une vente au guichet (voir `quota.service.js` et
  // `vente.controller.js#create`) : une réservation occupe aussi une place
  // sur le trajet, elle doit donc être comptée et refusée de la même façon
  // si le trajet est déjà complet.
  const reservation = await sequelize.transaction(async (transaction) => {
    // Cette route n'est utilisée que par le guichet (l'app Voyageur passe par
    // `public.controller.js#createReservation`) : `canal` vaut donc
    // normalement toujours 'guichet' ; on retombe dessus par défaut si
    // absent du payload plutôt que de ne vérifier aucun sous-quota.
    await verifierEtVerrouillerQuota({
      transaction,
      tripId: req.body.tripId,
      placesDemandees: 1,
      canal: req.body.canal || 'guichet',
    });
    return Reservation.create(
      {
        ...req.body,
        reference: req.body.reference || generateDatedReference('RES'),
        companyId: req.params.companyId,
      },
      { transaction }
    );
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
