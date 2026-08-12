// Pointage (connexion/déconnexion) des guichetiers.
const { Pointage, Guichetier, Agence, CashSession } = require('../models');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const { generateCode } = require('../utils/idGenerator');
const { enregistrerAudit } = require('../services/audit.service');
const { getPagination, buildPaginatedResponse } = require('./helpers');

const INCLUDE = [
  { model: Guichetier, as: 'guichetier' },
  { model: Agence, as: 'agence' },
  { model: CashSession, as: 'cashSession' },
];

const list = catchAsync(async (req, res) => {
  const where = { companyId: req.params.companyId };
  if (req.query.guichetierId) where.guichetierId = req.query.guichetierId;
  if (req.query.agenceId) where.agenceId = req.query.agenceId;

  const { page, limit, offset } = getPagination(req.query);
  const result = await Pointage.findAndCountAll({
    where,
    limit,
    offset,
    order: [['heureConnexion', 'DESC']],
    include: INCLUDE,
    distinct: true,
  });
  res.json(buildPaginatedResponse(result, { page, limit }));
});

/** POST /companies/:companyId/pointages — { guichetierId, agenceId, cashSessionId? } */
const clockIn = catchAsync(async (req, res) => {
  const { guichetierId, agenceId, cashSessionId } = req.body;
  if (!guichetierId || !agenceId) throw ApiError.badRequest('Guichetier et agence requis.');

  const pointage = await Pointage.create({
    code: generateCode('PTG'),
    companyId: req.params.companyId,
    guichetierId,
    agenceId,
    cashSessionId: cashSessionId || null,
  });
  res.status(201).json(pointage);
});

/** POST /companies/:companyId/pointages/:id/clock-out — { ecartCaisse?, rapport? } */
const clockOut = catchAsync(async (req, res) => {
  const pointage = await Pointage.findOne({ where: { id: req.params.id, companyId: req.params.companyId } });
  if (!pointage) throw ApiError.notFound('Pointage introuvable.');
  if (pointage.heureDeconnexion) throw ApiError.conflict('Ce pointage est déjà clôturé.');

  await pointage.update({
    heureDeconnexion: new Date(),
    rapportEnvoye: Boolean(req.body.rapport),
    ecartCaisse: req.body.ecartCaisse || 0,
    rapport: req.body.rapport || null,
  });
  res.json(pointage);
});

/**
 * Suppression DÉFINITIVE d'une session de pointage (dite "session de
 * caisse" côté écran admin, voir pointage_screen.dart) — usage
 * administratif ponctuel (ex. session de test, doublon). Ne touche PAS à la
 * `CashSession` éventuellement liée (`cashSessionId`) : seule la ligne de
 * pointage elle-même est supprimée, l'historique de caisse reste intact.
 */
const remove = catchAsync(async (req, res) => {
  const pointage = await Pointage.findOne({ where: { id: req.params.id, companyId: req.params.companyId } });
  if (!pointage) throw ApiError.notFound('Pointage introuvable.');

  await pointage.destroy();
  await enregistrerAudit({
    action: 'Suppression de session de pointage',
    details: `Pointage ${pointage.code} supprimé définitivement.`,
    companyId: req.params.companyId,
    auteur: req.auth,
  });
  res.status(204).send();
});

module.exports = { list, clockIn, clockOut, remove };
