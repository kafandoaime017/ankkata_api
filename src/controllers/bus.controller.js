// Flotte de véhicules d'une compagnie.
const { Bus, Ligne } = require('../models');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const { enregistrerAudit } = require('../services/audit.service');
const { buildSearchWhere, findAndRespond } = require('./helpers');

const list = catchAsync(async (req, res) => {
  const where = { companyId: req.params.companyId, ...buildSearchWhere(req.query, ['immatriculation', 'marqueModele']) };
  await findAndRespond(res, Bus, where, { query: req.query, order: [['immatriculation', 'ASC']] });
});

const getOne = catchAsync(async (req, res) => {
  const bus = await Bus.findOne({ where: { id: req.params.id, companyId: req.params.companyId } });
  if (!bus) throw ApiError.notFound('Véhicule introuvable.');
  res.json(bus);
});

const create = catchAsync(async (req, res) => {
  const bus = await Bus.create({ ...req.body, code: req.body.code || `BUS-${Date.now()}`, companyId: req.params.companyId });
  await enregistrerAudit({
    action: 'Ajout de véhicule',
    details: `Véhicule "${bus.immatriculation}" ajouté à la flotte.`,
    companyId: req.params.companyId,
    auteur: req.auth,
  });
  res.status(201).json(bus);
});

const update = catchAsync(async (req, res) => {
  const bus = await Bus.findOne({ where: { id: req.params.id, companyId: req.params.companyId } });
  if (!bus) throw ApiError.notFound('Véhicule introuvable.');

  await bus.update(req.body);
  await enregistrerAudit({
    action: 'Modification de véhicule',
    details: `Véhicule "${bus.immatriculation}" mis à jour.`,
    companyId: req.params.companyId,
    auteur: req.auth,
  });
  res.json(bus);
});

const remove = catchAsync(async (req, res) => {
  const bus = await Bus.findOne({ where: { id: req.params.id, companyId: req.params.companyId } });
  if (!bus) throw ApiError.notFound('Véhicule introuvable.');

  const nombreLignes = await Ligne.count({ where: { busId: bus.id } });
  if (nombreLignes > 0) {
    throw ApiError.conflict('Ce véhicule est encore assigné à une ou plusieurs lignes. Réaffectez-les d\'abord.');
  }

  await bus.destroy();
  await enregistrerAudit({
    action: 'Suppression de véhicule',
    details: `Véhicule "${bus.immatriculation}" retiré de la flotte.`,
    companyId: req.params.companyId,
    auteur: req.auth,
  });
  res.status(204).send();
});

module.exports = { list, getOne, create, update, remove };
