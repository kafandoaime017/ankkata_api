// Agences d'une compagnie — provisionnées par Ankkata puis modifiables en
// continu par l'administrateur de la compagnie (même logique de permission
// que côté ankkata_admin/ankata_guichet).
const { Agence, Ligne } = require('../models');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const { enregistrerAudit } = require('../services/audit.service');
const { buildSearchWhere, findAndRespond } = require('./helpers');

const list = catchAsync(async (req, res) => {
  const where = { companyId: req.params.companyId, ...buildSearchWhere(req.query, ['nom', 'ville']) };
  await findAndRespond(res, Agence, where, { query: req.query, order: [['nom', 'ASC']] });
});

const getOne = catchAsync(async (req, res) => {
  const agence = await Agence.findOne({ where: { id: req.params.id, companyId: req.params.companyId } });
  if (!agence) throw ApiError.notFound('Agence introuvable.');
  res.json(agence);
});

const create = catchAsync(async (req, res) => {
  const agence = await Agence.create({
    ...req.body,
    code: req.body.code || `RAG-${Date.now()}`,
    companyId: req.params.companyId,
  });
  await enregistrerAudit({
    action: 'Création d\'agence',
    details: `Agence "${agence.nom}" ajoutée.`,
    companyId: req.params.companyId,
    auteur: req.auth,
  });
  res.status(201).json(agence);
});

const update = catchAsync(async (req, res) => {
  const agence = await Agence.findOne({ where: { id: req.params.id, companyId: req.params.companyId } });
  if (!agence) throw ApiError.notFound('Agence introuvable.');

  await agence.update(req.body);
  await enregistrerAudit({
    action: 'Modification d\'agence',
    details: `Agence "${agence.nom}" mise à jour.`,
    companyId: req.params.companyId,
    auteur: req.auth,
  });
  res.json(agence);
});

const remove = catchAsync(async (req, res) => {
  const agence = await Agence.findOne({ where: { id: req.params.id, companyId: req.params.companyId } });
  if (!agence) throw ApiError.notFound('Agence introuvable.');

  const nombreLignes = await Ligne.count({ where: { agenceDepartId: agence.id } });
  if (nombreLignes > 0) {
    throw ApiError.conflict('Des lignes partent encore de cette agence. Supprimez-les ou réaffectez-les d\'abord.');
  }

  await agence.destroy();
  await enregistrerAudit({
    action: 'Suppression d\'agence',
    details: `Agence "${agence.nom}" supprimée.`,
    companyId: req.params.companyId,
    auteur: req.auth,
  });
  res.status(204).send();
});

module.exports = { list, getOne, create, update, remove };
