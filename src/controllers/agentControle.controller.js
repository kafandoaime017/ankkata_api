// Comptes "agent de contrôle" (app mobile de scan/embarquement) d'une
// compagnie, rattachés à une agence — CRUD quasiment identique à
// guichetier.controller.js (même mécanique PIN haché/jamais affiché), mais
// sur sa propre table (voir models/agentControle.model.js pour le
// raisonnement du cloisonnement).
const { AgentControle } = require('../models');
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
  const result = await AgentControle.findAndCountAll({ where, limit, offset, order: [['nom', 'ASC']] });
  res.json({
    data: result.rows.map(sansPin),
    pagination: { page, limit, total: result.count, totalPages: Math.max(Math.ceil(result.count / limit), 1) },
  });
});

const getOne = catchAsync(async (req, res) => {
  const compte = await AgentControle.findOne({ where: { id: req.params.id, companyId: req.params.companyId } });
  if (!compte) throw ApiError.notFound('Agent de contrôle introuvable.');
  res.json(sansPin(compte));
});

const create = catchAsync(async (req, res) => {
  const { nom, identifiant, agenceId, codePin } = req.body;
  if (!nom || !identifiant || !agenceId) throw ApiError.badRequest('Nom, identifiant et gare sont requis.');

  const pin = codePin || genererCodePin();
  const compte = await AgentControle.create({
    code: `RAC-${Date.now()}`,
    companyId: req.params.companyId,
    agenceId,
    nom,
    identifiant,
    codePinHash: await passwordService.hash(pin),
  });
  await enregistrerAudit({
    action: 'Création de compte agent de contrôle',
    details: `Compte créé pour "${nom}".`,
    companyId: req.params.companyId,
    auteur: req.auth,
  });
  res.status(201).json({ ...sansPin(compte), codePin: pin });
});

const update = catchAsync(async (req, res) => {
  const compte = await AgentControle.findOne({ where: { id: req.params.id, companyId: req.params.companyId } });
  if (!compte) throw ApiError.notFound('Agent de contrôle introuvable.');

  const { codePin, ...donnees } = req.body;
  await compte.update(donnees);
  await enregistrerAudit({
    action: 'Modification de compte agent de contrôle',
    details: `Compte "${compte.nom}" mis à jour.`,
    companyId: req.params.companyId,
    auteur: req.auth,
  });
  res.json(sansPin(compte));
});

const resetPin = catchAsync(async (req, res) => {
  const compte = await AgentControle.findOne({ where: { id: req.params.id, companyId: req.params.companyId } });
  if (!compte) throw ApiError.notFound('Agent de contrôle introuvable.');

  const nouveauPin = genererCodePin();
  await compte.update({ codePinHash: await passwordService.hash(nouveauPin) });
  await enregistrerAudit({
    action: 'Réinitialisation de code PIN (agent de contrôle)',
    details: `Nouveau code PIN généré pour "${compte.nom}".`,
    companyId: req.params.companyId,
    auteur: req.auth,
  });
  res.json({ ...sansPin(compte), codePin: nouveauPin });
});

const toggleActif = catchAsync(async (req, res) => {
  const compte = await AgentControle.findOne({ where: { id: req.params.id, companyId: req.params.companyId } });
  if (!compte) throw ApiError.notFound('Agent de contrôle introuvable.');

  await compte.update({ actif: !compte.actif });
  await enregistrerAudit({
    action: compte.actif ? 'Réactivation de compte agent de contrôle' : 'Désactivation de compte agent de contrôle',
    details: `Compte "${compte.nom}" (${compte.identifiant}).`,
    companyId: req.params.companyId,
    auteur: req.auth,
  });
  res.json(sansPin(compte));
});

const remove = catchAsync(async (req, res) => {
  const compte = await AgentControle.findOne({ where: { id: req.params.id, companyId: req.params.companyId } });
  if (!compte) throw ApiError.notFound('Agent de contrôle introuvable.');

  await compte.destroy();
  await enregistrerAudit({
    action: 'Suppression de compte agent de contrôle',
    details: `Compte "${compte.nom}" (${compte.identifiant}) supprimé.`,
    companyId: req.params.companyId,
    auteur: req.auth,
  });
  res.status(204).send();
});

module.exports = { list, getOne, create, update, resetPin, toggleActif, remove };
