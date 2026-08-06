// Gestion des comptes internes Ankkata — réservé à la direction générale
// (voir routes/compteAnkkata.routes.js).
const { CompteAnkkata } = require('../models');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const passwordService = require('../services/password.service');
const twoFactorService = require('../services/twoFactor.service');
const { enregistrerAudit } = require('../services/audit.service');
const { buildSearchWhere, findAndRespond } = require('./helpers');

function sansMotDePasse(compte) {
  const { motDePasseHash, deuxFaSecret, ...reste } = compte.toJSON();
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

/**
 * POST /comptes-ankkata/2fa/setup — auto-service, agit sur le compte
 * CONNECTÉ (`req.auth.sub`), jamais sur un `:id` arbitraire : personne ne
 * doit pouvoir déclencher l'activation de la 2FA sur le compte de
 * quelqu'un d'autre. Génère un nouveau secret (pas encore actif — voir
 * migration) et renvoie l'URI `otpauth://` à afficher en QR code côté
 * client (voir `qr_flutter` dans ankkata_admin).
 */
const setup2fa = catchAsync(async (req, res) => {
  const compte = await CompteAnkkata.findByPk(req.auth.sub);
  if (!compte) throw ApiError.notFound('Compte introuvable.');

  const secret = twoFactorService.genererSecret();
  await compte.update({ deuxFaSecret: secret, deuxFaActif: false, deuxFaVerifieAt: null });

  res.json({
    secret,
    otpauthUri: twoFactorService.genererUriProvisionnement(compte.identifiant, secret),
  });
});

/**
 * POST /comptes-ankkata/2fa/confirmer — { code }
 * Confirme la configuration en vérifiant un premier code réellement généré
 * par l'appli d'authentification du compte — la 2FA ne devient active
 * qu'à ce moment (jamais à la simple génération du secret par /2fa/setup).
 */
const confirmer2fa = catchAsync(async (req, res) => {
  const compte = await CompteAnkkata.findByPk(req.auth.sub);
  if (!compte) throw ApiError.notFound('Compte introuvable.');
  if (!compte.deuxFaSecret) throw ApiError.badRequest('Aucune configuration 2FA en attente — relancez /2fa/setup.');

  if (!twoFactorService.verifierCode(req.body.code, compte.deuxFaSecret)) {
    throw ApiError.unauthorized('Code de vérification incorrect.');
  }

  await compte.update({ deuxFaActif: true, deuxFaVerifieAt: new Date() });
  await enregistrerAudit({ action: 'Activation de la 2FA', details: `Compte ${compte.nom} (${compte.identifiant}).`, auteur: req.auth });
  res.json(sansMotDePasse(compte));
});

/**
 * POST /comptes-ankkata/2fa/desactiver — { motDePasse, code }
 * Exige le mot de passe ET un code TOTP valide (pas juste l'un ou l'autre)
 * — désactiver la 2FA doit être au moins aussi difficile que de l'activer,
 * sinon elle ne protège plus rien face à un jeton d'accès volé.
 */
const desactiver2fa = catchAsync(async (req, res) => {
  const compte = await CompteAnkkata.findByPk(req.auth.sub);
  if (!compte) throw ApiError.notFound('Compte introuvable.');
  if (!compte.deuxFaActif) throw ApiError.badRequest('La double authentification n\'est pas active.');

  const motDePasseValide = await passwordService.compare(req.body.motDePasse || '', compte.motDePasseHash);
  if (!motDePasseValide) throw ApiError.unauthorized('Mot de passe incorrect.');
  if (!twoFactorService.verifierCode(req.body.code, compte.deuxFaSecret)) {
    throw ApiError.unauthorized('Code de vérification incorrect.');
  }

  await compte.update({ deuxFaActif: false, deuxFaSecret: null, deuxFaVerifieAt: null });
  await enregistrerAudit({ action: 'Désactivation de la 2FA', details: `Compte ${compte.nom} (${compte.identifiant}).`, auteur: req.auth });
  res.json(sansMotDePasse(compte));
});

module.exports = { list, getOne, create, update, toggleActif, remove, setup2fa, confirmer2fa, desactiver2fa };
