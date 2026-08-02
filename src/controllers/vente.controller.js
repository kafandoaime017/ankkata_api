// Ventes au guichet — création, annulation, vérification de colis. Chaque
// vente réussie incrémente les totaux de la session de caisse ouverte de
// l'agent (voir cashSession.controller.js pour la logique de caisse).
const { Vente, Client, Trip, Guichetier, CashSession } = require('../models');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const { enregistrerAudit } = require('../services/audit.service');
const { generateDatedReference } = require('../utils/idGenerator');
const { buildSearchWhere, getPagination, buildPaginatedResponse } = require('./helpers');

const INCLUDE = [
  { model: Client, as: 'client' },
  { model: Trip, as: 'trip' },
  { model: Guichetier, as: 'guichetier' },
];

const list = catchAsync(async (req, res) => {
  const where = { companyId: req.params.companyId, ...buildSearchWhere(req.query, ['nomVoyageur', 'telephoneVoyageur', 'reference']) };
  if (req.query.agenceId) where.agenceId = req.query.agenceId;
  if (req.query.guichetierId) where.guichetierId = req.query.guichetierId;
  if (req.query.annulee !== undefined) where.annulee = req.query.annulee === 'true';

  const { page, limit, offset } = getPagination(req.query);
  const result = await Vente.findAndCountAll({
    where,
    limit,
    offset,
    order: [['heureVente', 'DESC']],
    include: INCLUDE,
    distinct: true,
  });
  res.json(buildPaginatedResponse(result, { page, limit }));
});

const getOne = catchAsync(async (req, res) => {
  const vente = await Vente.findOne({ where: { id: req.params.id, companyId: req.params.companyId }, include: INCLUDE });
  if (!vente) throw ApiError.notFound('Vente introuvable.');
  res.json(vente);
});

const create = catchAsync(async (req, res) => {
  const vente = await Vente.create({
    ...req.body,
    reference: req.body.reference || generateDatedReference('TCK'),
    companyId: req.params.companyId,
  });

  const montantVente = vente.nombrePlaces * vente.prixUnitaire;
  const session = await CashSession.findOne({ where: { companyId: req.params.companyId, guichetierId: vente.guichetierId, ouverte: true } });
  if (session) {
    const champEspeces = vente.moyenPaiement === 'Espèces' ? 'totalVentesEspeces' : 'totalVentesMobileMoney';
    await session.update({
      [champEspeces]: session[champEspeces] + montantVente,
      nombreBilletsVendus: session.nombreBilletsVendus + vente.nombrePlaces,
    });
  }

  await enregistrerAudit({
    action: 'Vente de billet',
    details: `Vente ${vente.reference} — ${vente.nomVoyageur} (${montantVente} FCFA).`,
    companyId: req.params.companyId,
    auteur: req.auth,
  });
  res.status(201).json(vente);
});

const cancel = catchAsync(async (req, res) => {
  const vente = await Vente.findOne({ where: { id: req.params.id, companyId: req.params.companyId } });
  if (!vente) throw ApiError.notFound('Vente introuvable.');
  if (vente.annulee) throw ApiError.conflict('Cette vente est déjà annulée.');

  await vente.update({ annulee: true, motifAnnulation: req.body.motif || null });
  await enregistrerAudit({
    action: 'Annulation de vente',
    details: `Vente ${vente.reference} annulée${req.body.motif ? ` (${req.body.motif})` : ''}.`,
    companyId: req.params.companyId,
    auteur: req.auth,
  });
  res.json(vente);
});

const verifyColis = catchAsync(async (req, res) => {
  const vente = await Vente.findOne({ where: { id: req.params.id, companyId: req.params.companyId } });
  if (!vente) throw ApiError.notFound('Vente introuvable.');
  if (!vente.aDesColis) throw ApiError.badRequest('Cette vente ne comporte pas de colis.');

  await vente.update({ colisVerifie: true });
  res.json(vente);
});

module.exports = { list, getOne, create, cancel, verifyColis };
