// Sessions de caisse d'un guichetier — ouverture, mouvements (dépense/
// versement), clôture. Reprend les règles métier de CaisseSession côté
// ankata_guichet (le "théorique" ne compte que les espèces, jamais le
// mobile money, qui ne transite pas physiquement par le tiroir-caisse).
const { CashSession, CashMovement, Guichetier, Agence } = require('../models');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const { enregistrerAudit } = require('../services/audit.service');
const { generateDatedReference } = require('../utils/idGenerator');
const { getPagination, buildPaginatedResponse } = require('./helpers');

const INCLUDE = [
  { model: Guichetier, as: 'guichetier' },
  { model: Agence, as: 'agence' },
  { model: CashMovement, as: 'mouvements' },
];

function montantTheorique(session) {
  return session.fondInitial + session.totalVentesEspeces - session.totalDepenses - session.totalVersements;
}

const list = catchAsync(async (req, res) => {
  const where = { companyId: req.params.companyId };
  if (req.query.agenceId) where.agenceId = req.query.agenceId;
  if (req.query.guichetierId) where.guichetierId = req.query.guichetierId;
  if (req.query.ouverte !== undefined) where.ouverte = req.query.ouverte === 'true';

  const { page, limit, offset } = getPagination(req.query);
  const result = await CashSession.findAndCountAll({
    where,
    limit,
    offset,
    order: [['dateOuverture', 'DESC']],
    include: INCLUDE,
    distinct: true,
  });
  res.json(buildPaginatedResponse(result, { page, limit }));
});

const getOne = catchAsync(async (req, res) => {
  const session = await CashSession.findOne({ where: { id: req.params.id, companyId: req.params.companyId }, include: INCLUDE });
  if (!session) throw ApiError.notFound('Session de caisse introuvable.');
  res.json({ ...session.toJSON(), montantTheorique: montantTheorique(session) });
});

/** POST /companies/:companyId/cash-sessions — ouverture, { agenceId, guichetierId, fondInitial } */
const open = catchAsync(async (req, res) => {
  const { agenceId, guichetierId, fondInitial } = req.body;
  if (!agenceId || !guichetierId) throw ApiError.badRequest('Agence et guichetier requis.');

  const dejaOuverte = await CashSession.findOne({ where: { companyId: req.params.companyId, guichetierId, ouverte: true } });
  if (dejaOuverte) throw ApiError.conflict('Ce guichetier a déjà une session de caisse ouverte.');

  const session = await CashSession.create({
    numeroSession: generateDatedReference('CAI'),
    companyId: req.params.companyId,
    agenceId,
    guichetierId,
    fondInitial: fondInitial || 0,
  });
  await enregistrerAudit({
    action: 'Ouverture de caisse',
    details: `Session ${session.numeroSession} ouverte.`,
    companyId: req.params.companyId,
    auteur: req.auth,
  });
  res.status(201).json(session);
});

/** POST /companies/:companyId/cash-sessions/:id/movements — { type, motif, montant } */
const addMovement = catchAsync(async (req, res) => {
  const session = await CashSession.findOne({ where: { id: req.params.id, companyId: req.params.companyId } });
  if (!session) throw ApiError.notFound('Session de caisse introuvable.');
  if (!session.ouverte) throw ApiError.conflict('Cette session de caisse est déjà clôturée.');

  const { type, motif, montant } = req.body;
  if (!['depense', 'versement'].includes(type)) throw ApiError.badRequest('Type de mouvement invalide.');
  if (!motif || !montant) throw ApiError.badRequest('Motif et montant requis.');

  const mouvement = await CashMovement.create({
    cashSessionId: session.id,
    reference: `REC-${1000 + (await CashMovement.count({ where: { cashSessionId: session.id } })) + 1}`,
    type,
    motif,
    montant,
    guichetierId: session.guichetierId,
  });

  const champ = type === 'depense' ? 'totalDepenses' : 'totalVersements';
  await session.update({ [champ]: session[champ] + montant });

  await enregistrerAudit({
    action: type === 'depense' ? 'Dépense de caisse' : 'Versement de caisse',
    details: `${mouvement.reference} — ${motif} (${montant} FCFA), session ${session.numeroSession}.`,
    companyId: req.params.companyId,
    auteur: req.auth,
  });
  res.status(201).json(mouvement);
});

/** POST /companies/:companyId/cash-sessions/:id/close — { montantCompte, commentaire } */
const close = catchAsync(async (req, res) => {
  const session = await CashSession.findOne({ where: { id: req.params.id, companyId: req.params.companyId } });
  if (!session) throw ApiError.notFound('Session de caisse introuvable.');
  if (!session.ouverte) throw ApiError.conflict('Cette session de caisse est déjà clôturée.');

  const { montantCompte, commentaire } = req.body;
  await session.update({
    ouverte: false,
    dateFermeture: new Date(),
    montantCompte: montantCompte ?? null,
    commentaire: commentaire || session.commentaire,
  });

  const ecart = (montantCompte ?? montantTheorique(session)) - montantTheorique(session);
  await enregistrerAudit({
    action: 'Clôture de caisse',
    details: `Session ${session.numeroSession} clôturée — écart ${ecart} FCFA.`,
    companyId: req.params.companyId,
    auteur: req.auth,
  });
  res.json({ ...session.toJSON(), ecart });
});

module.exports = { list, getOne, open, addMovement, close };
