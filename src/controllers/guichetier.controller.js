// Comptes guichetiers (agents de comptoir) d'une compagnie, rattachés à
// une agence. Note : contrairement aux apps Flutter de démonstration (qui
// stockent le PIN en clair pour pouvoir l'afficher), ici le PIN est haché
// — il n'existe donc pas de "voir le code PIN", seulement une
// réinitialisation qui renvoie le nouveau code UNE FOIS, à charge pour
// l'appelant de le communiquer immédiatement à l'agent.
const { Guichetier } = require('../models');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const passwordService = require('../services/password.service');
const { enregistrerAudit } = require('../services/audit.service');
const { genererCodePin } = require('../utils/idGenerator');
const { buildSearchWhere, getPagination } = require('./helpers');

function sansPin(compte) {
  const { codePinHash, ...reste } = compte.toJSON();
  return reste;
}

const list = catchAsync(async (req, res) => {
  const where = { companyId: req.params.companyId, ...buildSearchWhere(req.query, ['nom', 'identifiant']) };
  if (req.query.agenceId) where.agenceId = req.query.agenceId;
  const { page, limit, offset } = getPagination(req.query);
  const result = await Guichetier.findAndCountAll({ where, limit, offset, order: [['nom', 'ASC']] });
  res.json({
    data: result.rows.map(sansPin),
    pagination: { page, limit, total: result.count, totalPages: Math.max(Math.ceil(result.count / limit), 1) },
  });
});

const getOne = catchAsync(async (req, res) => {
  const compte = await Guichetier.findOne({ where: { id: req.params.id, companyId: req.params.companyId } });
  if (!compte) throw ApiError.notFound('Guichetier introuvable.');
  res.json(sansPin(compte));
});

const create = catchAsync(async (req, res) => {
  const { nom, identifiant, agenceId, role, codePin } = req.body;
  if (!nom || !identifiant || !agenceId) throw ApiError.badRequest('Nom, identifiant et agence sont requis.');

  const pin = codePin || genererCodePin();
  const compte = await Guichetier.create({
    code: `RGU-${Date.now()}`,
    companyId: req.params.companyId,
    agenceId,
    nom,
    identifiant,
    role: role || 'guichetier',
    codePinHash: await passwordService.hash(pin),
  });
  await enregistrerAudit({ action: 'Création de compte guichetier', details: `Compte créé pour "${nom}".`, companyId: req.params.companyId, auteur: req.auth });
  res.status(201).json({ ...sansPin(compte), codePin: pin });
});

const update = catchAsync(async (req, res) => {
  const compte = await Guichetier.findOne({ where: { id: req.params.id, companyId: req.params.companyId } });
  if (!compte) throw ApiError.notFound('Guichetier introuvable.');

  const { codePin, ...donnees } = req.body;
  await compte.update(donnees);
  await enregistrerAudit({ action: 'Modification de compte guichetier', details: `Compte "${compte.nom}" mis à jour.`, companyId: req.params.companyId, auteur: req.auth });
  res.json(sansPin(compte));
});

const resetPin = catchAsync(async (req, res) => {
  const compte = await Guichetier.findOne({ where: { id: req.params.id, companyId: req.params.companyId } });
  if (!compte) throw ApiError.notFound('Guichetier introuvable.');

  const nouveauPin = genererCodePin();
  await compte.update({ codePinHash: await passwordService.hash(nouveauPin) });
  await enregistrerAudit({ action: 'Réinitialisation de code PIN', details: `Nouveau code PIN généré pour "${compte.nom}".`, companyId: req.params.companyId, auteur: req.auth });
  res.json({ ...sansPin(compte), codePin: nouveauPin });
});

const toggleActif = catchAsync(async (req, res) => {
  const compte = await Guichetier.findOne({ where: { id: req.params.id, companyId: req.params.companyId } });
  if (!compte) throw ApiError.notFound('Guichetier introuvable.');

  await compte.update({ actif: !compte.actif });
  await enregistrerAudit({
    action: compte.actif ? 'Réactivation de compte guichetier' : 'Désactivation de compte guichetier',
    details: `Compte "${compte.nom}" (${compte.identifiant}).`,
    companyId: req.params.companyId,
    auteur: req.auth,
  });
  res.json(sansPin(compte));
});

const remove = catchAsync(async (req, res) => {
  const compte = await Guichetier.findOne({ where: { id: req.params.id, companyId: req.params.companyId } });
  if (!compte) throw ApiError.notFound('Guichetier introuvable.');

  await compte.destroy();
  await enregistrerAudit({ action: 'Suppression de compte guichetier', details: `Compte "${compte.nom}" (${compte.identifiant}) supprimé.`, companyId: req.params.companyId, auteur: req.auth });
  res.status(204).send();
});

module.exports = { list, getOne, create, update, resetPin, toggleActif, remove };
