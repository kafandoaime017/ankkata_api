// Trois flux de connexion distincts (un par espace), qui aboutissent tous
// au même format de jeton — voir middlewares/auth.middleware.js pour la
// lecture de ce jeton côté serveur.
const { Company, CompteAnkkata, CompteAdmin, Guichetier, AgentControle, Agence } = require('../models');
const passwordService = require('../services/password.service');
const tokenService = require('../services/token.service');
const twoFactorService = require('../services/twoFactor.service');
const { resumeAbonnement, suspensionActive } = require('../services/abonnement.service');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const { ESPACES } = require('../constants/roles');

function emettreJetons(payload) {
  return {
    accessToken: tokenService.signAccessToken(payload),
    refreshToken: tokenService.signRefreshToken({ sub: payload.sub, espace: payload.espace }),
  };
}

/**
 * POST /auth/ankkata/login — { identifiant, motDePasse }
 *
 * Comptes de l'équipe Ankkata uniquement : accès à l'ensemble des
 * compagnies clientes, donc la cible la plus sensible de la plateforme — si
 * la 2FA est active sur ce compte (voir services/twoFactor.service.js), le
 * mot de passe seul ne suffit PAS à obtenir un jeton d'accès. On renvoie à
 * la place un jeton de "défi" de courte durée (5 min) que le client doit
 * renvoyer avec le code TOTP à `POST /auth/ankkata/2fa/login`.
 */
const loginAnkkata = catchAsync(async (req, res) => {
  const { identifiant, motDePasse } = req.body;
  if (!identifiant || !motDePasse) throw ApiError.badRequest('Identifiant et mot de passe requis.');

  const compte = await CompteAnkkata.findOne({ where: { identifiant } });
  if (!compte || !compte.actif) throw ApiError.unauthorized('Identifiants invalides ou compte désactivé.');

  const motDePasseValide = await passwordService.compare(motDePasse, compte.motDePasseHash);
  if (!motDePasseValide) throw ApiError.unauthorized('Identifiants invalides.');

  if (compte.deuxFaActif) {
    res.json({ deuxFaRequis: true, defiToken: tokenService.signDefi2fa(compte.id) });
    return;
  }

  const payload = { sub: compte.id, espace: ESPACES.ANKKATA, nom: compte.nom, role: compte.role, companyId: null };
  res.json({ ...emettreJetons(payload), compte: { id: compte.id, nom: compte.nom, role: compte.role, identifiant: compte.identifiant } });
});

/**
 * POST /auth/ankkata/2fa/login — { defiToken, code }
 *
 * Deuxième étape du login Ankkata quand la 2FA est active — voir
 * [loginAnkkata]. `defiToken` prouve que le mot de passe vient d'être
 * validé (courte durée de vie, ne porte ni `espace` ni `role`, donc
 * inutilisable comme un vrai jeton d'accès même par erreur).
 */
const loginAnkkata2fa = catchAsync(async (req, res) => {
  const { defiToken, code } = req.body;
  if (!defiToken || !code) throw ApiError.badRequest('Jeton de défi et code requis.');

  let decoded;
  try {
    decoded = tokenService.verifyDefi2fa(defiToken);
  } catch (err) {
    throw ApiError.unauthorized('Session de connexion expirée, recommencez.');
  }

  const compte = await CompteAnkkata.findByPk(decoded.sub);
  if (!compte || !compte.actif) throw ApiError.unauthorized('Compte introuvable ou désactivé.');
  if (!compte.deuxFaActif) throw ApiError.badRequest('La double authentification n\'est pas active sur ce compte.');

  if (!twoFactorService.verifierCode(code, compte.deuxFaSecret)) {
    throw ApiError.unauthorized('Code de vérification incorrect.');
  }

  const payload = { sub: compte.id, espace: ESPACES.ANKKATA, nom: compte.nom, role: compte.role, companyId: null };
  res.json({ ...emettreJetons(payload), compte: { id: compte.id, nom: compte.nom, role: compte.role, identifiant: compte.identifiant } });
});

/** POST /auth/admin/login — { cleActivation, identifiant, motDePasse } */
const loginAdmin = catchAsync(async (req, res) => {
  const { cleActivation, identifiant, motDePasse } = req.body;
  if (!cleActivation || !identifiant || !motDePasse) {
    throw ApiError.badRequest('Clé d\'activation, identifiant et mot de passe requis.');
  }

  const company = await Company.findOne({ where: { cleActivation } });
  if (!company) throw ApiError.unauthorized('Clé d\'activation inconnue.');

  const compte = await CompteAdmin.findOne({ where: { companyId: company.id, identifiant } });
  if (!compte || !compte.actif) throw ApiError.unauthorized('Identifiants invalides ou compte désactivé.');

  const motDePasseValide = await passwordService.compare(motDePasse, compte.motDePasseHash);
  if (!motDePasseValide) throw ApiError.unauthorized('Identifiants invalides.');

  const payload = {
    sub: compte.id,
    espace: ESPACES.ADMIN,
    nom: compte.nom,
    niveau: compte.niveau,
    companyId: company.id,
  };
  res.json({
    ...emettreJetons(payload),
    compte: { id: compte.id, nom: compte.nom, niveau: compte.niveau, identifiant: compte.identifiant },
    company: { id: company.id, code: company.code, nom: company.nom },
    // Bandeau de dégradation progressive (paliers 1/2, purement informatif)
    // + drapeau de suspension effective (palier 3) — voir
    // services/abonnement.service.js. Vérifié UNIQUEMENT à la connexion,
    // jamais en cours de session : voir avertissement dans changeStatus.
    abonnement: resumeAbonnement(company),
    compagnieSuspendue: suspensionActive(company),
  });
});

/** POST /auth/guichetier/login — { cleActivation, identifiant, codePin } */
const loginGuichetier = catchAsync(async (req, res) => {
  const { cleActivation, identifiant, codePin } = req.body;
  if (!cleActivation || !identifiant || !codePin) {
    throw ApiError.badRequest('Clé d\'activation, identifiant et code PIN requis.');
  }

  const company = await Company.findOne({ where: { cleActivation } });
  if (!company) throw ApiError.unauthorized('Clé d\'activation inconnue.');

  const compte = await Guichetier.findOne({ where: { companyId: company.id, identifiant } });
  if (!compte || !compte.actif) throw ApiError.unauthorized('Identifiants invalides ou compte désactivé.');

  const codePinValide = await passwordService.compare(codePin, compte.codePinHash);
  if (!codePinValide) throw ApiError.unauthorized('Code PIN invalide.');

  const payload = {
    sub: compte.id,
    espace: ESPACES.GUICHETIER,
    nom: compte.nom,
    role: compte.role,
    agenceId: compte.agenceId,
    companyId: company.id,
  };
  res.json({
    ...emettreJetons(payload),
    compte: { id: compte.id, nom: compte.nom, role: compte.role, identifiant: compte.identifiant, agenceId: compte.agenceId },
    company: { id: company.id, code: company.code, nom: company.nom },
    // Voir loginAdmin — le guichetier n'a besoin que du drapeau de
    // suspension effective (palier 3), jamais du détail des paliers 1/2
    // (bandeau réservé à l'écran admin compagnie).
    compagnieSuspendue: suspensionActive(company),
  });
});

/**
 * POST /auth/controle/login — { cleActivation, identifiant, codePin }
 *
 * App mobile "agent de contrôle" (scan/embarquement) — même mécanique que
 * [loginGuichetier] (clé d'activation + identifiant + PIN haché, message
 * d'erreur générique, pas d'énumération d'identifiant), mais un modèle et un
 * espace JWT à part (voir constants/roles.js#ESPACES.CONTROLE et
 * models/agentControle.model.js) : ce compte n'a accès qu'aux routes
 * d'embarquement, jamais à la vente/caisse/réservation. `agence` est
 * renvoyée en clair dans la réponse (nom de la gare) car l'agent ne la
 * choisit jamais lui-même — elle vient uniquement de son compte.
 */
const loginControle = catchAsync(async (req, res) => {
  const { cleActivation, identifiant, codePin } = req.body;
  if (!cleActivation || !identifiant || !codePin) {
    throw ApiError.badRequest('Clé d\'activation, identifiant et code PIN requis.');
  }

  const company = await Company.findOne({ where: { cleActivation } });
  if (!company) throw ApiError.unauthorized('Clé d\'activation inconnue.');

  const compte = await AgentControle.findOne({ where: { companyId: company.id, identifiant }, include: [{ model: Agence, as: 'agence' }] });
  if (!compte || !compte.actif) throw ApiError.unauthorized('Identifiants invalides ou compte désactivé.');

  const codePinValide = await passwordService.compare(codePin, compte.codePinHash);
  if (!codePinValide) throw ApiError.unauthorized('Code PIN invalide.');

  const payload = {
    sub: compte.id,
    espace: ESPACES.CONTROLE,
    nom: compte.nom,
    agenceId: compte.agenceId,
    companyId: company.id,
  };
  res.json({
    ...emettreJetons(payload),
    compte: { id: compte.id, nom: compte.nom, identifiant: compte.identifiant, agenceId: compte.agenceId, agenceNom: compte.agence?.nom || null },
    company: {
      id: company.id,
      code: company.code,
      nom: company.nom,
      logoPath: company.logoPath,
      couleurPrimaire: company.couleurPrimaire,
      couleurSecondaire: company.couleurSecondaire,
    },
    // Voir loginGuichetier — même drapeau, même raisonnement.
    compagnieSuspendue: suspensionActive(company),
  });
});

/** POST /auth/refresh — { refreshToken } */
const refresh = catchAsync(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) throw ApiError.badRequest('Jeton de rafraîchissement requis.');

  let decoded;
  try {
    decoded = tokenService.verifyRefreshToken(refreshToken);
  } catch (err) {
    throw ApiError.unauthorized('Jeton de rafraîchissement invalide ou expiré.');
  }

  const modeleParEspace = {
    [ESPACES.ANKKATA]: CompteAnkkata,
    [ESPACES.ADMIN]: CompteAdmin,
    [ESPACES.GUICHETIER]: Guichetier,
    [ESPACES.CONTROLE]: AgentControle,
  };
  const Modele = modeleParEspace[decoded.espace];
  if (!Modele) throw ApiError.unauthorized('Espace inconnu.');

  const compte = await Modele.findByPk(decoded.sub);
  if (!compte || !compte.actif) throw ApiError.unauthorized('Compte introuvable ou désactivé.');

  const payload = {
    sub: compte.id,
    espace: decoded.espace,
    nom: compte.nom,
    role: compte.role,
    niveau: compte.niveau,
    agenceId: compte.agenceId,
    companyId: compte.companyId || null,
  };
  res.json(emettreJetons(payload));
});

/** GET /auth/me */
const me = catchAsync(async (req, res) => {
  res.json({ auth: req.auth });
});

module.exports = { loginAnkkata, loginAnkkata2fa, loginAdmin, loginGuichetier, loginControle, refresh, me };
