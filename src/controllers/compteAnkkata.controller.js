// Gestion des comptes internes Ankkata — réservé à la direction générale
// (voir routes/compteAnkkata.routes.js).
const { CompteAnkkata } = require('../models');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const passwordService = require('../services/password.service');
const { enregistrerAudit } = require('../services/audit.service');
const { buildSearchWhere, findAndRespond } = require('./helpers');

function sansMotDePasse(compte) {
  const { motDePasseHash, ...reste } = compte.toJSON();
  return reste;
}

const list = catchAsync(async (req, res) => {
  const where = buildSearchWhere(req.query, ['nom', 'identifiant', 'code']);
  const { page, limit, offset } = require('../utils/pagination').getPagination(req.query);
  const result = await CompteAnkkata.findAndCountAll({ where, limit, offset, order: [['nom', 'ASC']] });
  res.json({
    data: result.rows.map(sansMotDePasse),
    pagination: { page, limit, total: result.count, totalPages: Math.max(Math.ceil(result.count / limit), 1) },
  });
});

const getOne = catchAsync(async (req, res) => {
  const compte = await CompteAnkkata.findByPk(req.params.id);
  if (!compte) throw ApiError.notFound('Compte introuvable.');
  res.json(sansMotDePasse(compte));
});

const create = catchAsync(async (req, res) => {
  const { nom, identifiant, motDePasse, role, photoInitiales } = req.body;
  if (!nom || !identifiant || !motDePasse || !role) {
    throw ApiError.badRequest('Nom, identifiant, mot de passe et rôle sont requis.');
  }
  const compte = await CompteAnkkata.create({
    code: `AK-${Date.now()}`,
    nom,
    identifiant,
    motDePasseHash: await passwordService.hash(motDePasse),
    role,
    photoInitiales: photoInitiales || nom.split(' ').map((s) => s[0]).join('').slice(0, 2).toUpperCase(),
  });
  await enregistrerAudit({ action: 'Création de compte Ankkata', details: `Compte créé pour ${nom}.`, auteur: req.auth });
  res.status(201).json(sansMotDePasse(compte));
});

const update = catchAsync(async (req, res) => {
  const compte = await CompteAnkkata.findByPk(req.params.id);
  if (!compte) throw ApiError.notFound('Compte introuvable.');

  const donnees = { ...req.body };
  if (donnees.motDePasse) {
    donnees.motDePasseHash = await passwordService.hash(donnees.motDePasse);
    delete donnees.motDePasse;
  }
  await compte.update(donnees);
  await enregistrerAudit({ action: 'Modification de compte Ankkata', details: `Compte de ${compte.nom} mis à jour.`, auteur: req.auth });
  res.json(sansMotDePasse(compte));
});

const toggleActif = catchAsync(async (req, res) => {
  const compte = await CompteAnkkata.findByPk(req.params.id);
  if (!compte) throw ApiError.notFound('Compte introuvable.');

  await compte.update({ actif: !compte.actif });
  await enregistrerAudit({
    action: compte.actif ? 'Réactivation de compte Ankkata' : 'Désactivation de compte Ankkata',
    details: `Compte ${compte.nom} (${compte.identifiant}).`,
    auteur: req.auth,
  });
  res.json(sansMotDePasse(compte));
});

const remove = catchAsync(async (req, res) => {
  const compte = await CompteAnkkata.findByPk(req.params.id);
  if (!compte) throw ApiError.notFound('Compte introuvable.');

  await compte.destroy();
  await enregistrerAudit({ action: 'Suppression de compte Ankkata', details: `Compte ${compte.nom} (${compte.identifiant}) supprimé.`, auteur: req.auth });
  res.status(204).send();
});

module.exports = { list, getOne, create, update, toggleActif, remove };
