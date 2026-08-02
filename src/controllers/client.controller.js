// Clients d'une compagnie — lecture seule pour Ankkata, gestion complète
// pour le personnel de la compagnie.
const { Client } = require('../models');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const { enregistrerAudit } = require('../services/audit.service');
const { buildSearchWhere, findAndRespond } = require('./helpers');

const list = catchAsync(async (req, res) => {
  const where = { companyId: req.params.companyId, ...buildSearchWhere(req.query, ['nom', 'telephone', 'email']) };
  await findAndRespond(res, Client, where, { query: req.query, order: [['nom', 'ASC']] });
});

const getOne = catchAsync(async (req, res) => {
  const client = await Client.findOne({ where: { id: req.params.id, companyId: req.params.companyId } });
  if (!client) throw ApiError.notFound('Client introuvable.');
  res.json(client);
});

const create = catchAsync(async (req, res) => {
  const client = await Client.create({ ...req.body, companyId: req.params.companyId });
  res.status(201).json(client);
});

const update = catchAsync(async (req, res) => {
  const client = await Client.findOne({ where: { id: req.params.id, companyId: req.params.companyId } });
  if (!client) throw ApiError.notFound('Client introuvable.');
  await client.update(req.body);
  res.json(client);
});

const toggleVigilance = catchAsync(async (req, res) => {
  const client = await Client.findOne({ where: { id: req.params.id, companyId: req.params.companyId } });
  if (!client) throw ApiError.notFound('Client introuvable.');

  await client.update({ vigilance: !client.vigilance });
  await enregistrerAudit({
    action: client.vigilance ? 'Mise sous vigilance d\'un client' : 'Retrait de la vigilance d\'un client',
    details: `Client "${client.nom}" (${client.telephone}).`,
    companyId: req.params.companyId,
    auteur: req.auth,
  });
  res.json(client);
});

const remove = catchAsync(async (req, res) => {
  const client = await Client.findOne({ where: { id: req.params.id, companyId: req.params.companyId } });
  if (!client) throw ApiError.notFound('Client introuvable.');
  await client.destroy();
  res.status(204).send();
});

module.exports = { list, getOne, create, update, toggleVigilance, remove };
