// Comptes administrateurs d'une compagnie.
const { CompteAdmin } = require('../models');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const passwordService = require('../services/password.service');
const { enregistrerAudit } = require('../services/audit.service');
const { buildSearchWhere, getPagination } = require('./helpers');

function sansMotDePasse(compte) {
  const { motDePasseHash, ...reste } = compte.toJSON();
  return reste;
}

const list = catchAsync(async (req, res) => {
  const where = { companyId: req.params.companyId, ...buildSearchWhere(req.query, ['nom', 'identifiant']) };
  const { page, limit, offset } = getPagination(req.query);
  const result = await CompteAdmin.findAndCountAll({ where, limit, offset, order: [['nom', 'ASC']] });
  res.json({
    data: result.rows.map(sansMotDePasse),
    pagination: { page, limit, total: result.count, totalPages: Math.max(Math.ceil(result.count / limit), 1) },
  });
});

const getOne = catchAsync(async (req, res) => {
  const compte = await CompteAdmin.findOne({ where: { id: req.params.id, companyId: req.params.companyId } });
  if (!compte) throw ApiError.notFound('Compte introuvable.');
  res.json(sansMotDePasse(compte));
});

const create = catchAsync(async (req, res) => {
  const { nom, identifiant, motDePasse, niveau } = req.body;
  if (!nom || !identifiant || !motDePasse) throw ApiError.badRequest('Nom, identifiant et mot de passe requis.');

  const compte = await CompteAdmin.create({
    code: `ADM-${Date.now()}`,
    companyId: req.params.companyId,
    nom,
    identifiant,
    motDePasseHash: await passwordService.hash(motDePasse),
    niveau: niveau || 'administrateur',
  });
  await enregistrerAudit({ action: 'Création de compte administrateur', details: `Compte créé pour ${nom}.`, companyId: req.params.companyId, auteur: req.auth });
  res.status(201).json(sansMotDePasse(compte));
});

const update = catchAsync(async (req, res) => {
  const compte = await CompteAdmin.findOne({ where: { id: req.params.id, companyId: req.params.companyId } });
  if (!compte) throw ApiError.notFound('Compte introuvable.');

  const donnees = { ...req.body };
  if (donnees.motDePasse) {
    donnees.motDePasseHash = await passwordService.hash(donnees.motDePasse);
    delete donnees.motDePasse;
  }
  await compte.update(donnees);
  await enregistrerAudit({ action: 'Modification de compte administrateur', details: `Compte de ${compte.nom} mis à jour.`, companyId: req.params.companyId, auteur: req.auth });
  res.json(sansMotDePasse(compte));
});

const toggleActif = catchAsync(async (req, res) => {
  const compte = await CompteAdmin.findOne({ where: { id: req.params.id, companyId: req.params.companyId } });
  if (!compte) throw ApiError.notFound('Compte introuvable.');

  await compte.update({ actif: !compte.actif });
  await enregistrerAudit({
    action: compte.actif ? 'Réactivation de compte administrateur' : 'Désactivation de compte administrateur',
    details: `Compte ${compte.nom}.`,
    companyId: req.params.companyId,
    auteur: req.auth,
  });
  res.json(sansMotDePasse(compte));
});

const remove = catchAsync(async (req, res) => {
  const compte = await CompteAdmin.findOne({ where: { id: req.params.id, companyId: req.params.companyId } });
  if (!compte) throw ApiError.notFound('Compte introuvable.');

  await compte.destroy();
  await enregistrerAudit({ action: 'Suppression de compte administrateur', details: `Compte ${compte.nom} supprimé.`, companyId: req.params.companyId, auteur: req.auth });
  res.status(204).send();
});

module.exports = { list, getOne, create, update, toggleActif, remove };
