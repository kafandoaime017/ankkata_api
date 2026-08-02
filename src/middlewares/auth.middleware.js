// Authentification/autorisation — les 3 espaces (ankkata/admin/guichetier)
// passent tous par le même JWT, seul le contenu du payload change (voir
// auth.controller.js pour l'émission). `authenticate` peuple `req.auth` ;
// les autres middlewares n'ont qu'à lire `req.auth`.
const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const tokenService = require('../services/token.service');
const { ESPACES, peutGererCompagnies, peutGererComptesAnkkata, peutVoirJournalAudit } = require('../constants/roles');

const authenticate = catchAsync(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw ApiError.unauthorized('Jeton d\'authentification manquant.');
  }
  try {
    req.auth = tokenService.verifyAccessToken(token);
  } catch (err) {
    throw ApiError.unauthorized('Jeton d\'authentification invalide ou expiré.');
  }
  next();
});

/** Restreint l'accès à un ou plusieurs espaces (ex: authorize(ESPACES.ANKKATA)). */
function authorize(...espacesAutorises) {
  return (req, res, next) => {
    if (!req.auth || !espacesAutorises.includes(req.auth.espace)) {
      return next(ApiError.forbidden('Cet espace n\'a pas accès à cette ressource.'));
    }
    next();
  };
}

/** Réservé aux comptes Ankkata pouvant gérer les compagnies (DG + responsable provisioning). */
function requirePeutGererCompagnies(req, res, next) {
  if (req.auth?.espace !== ESPACES.ANKKATA || !peutGererCompagnies(req.auth.role)) {
    return next(ApiError.forbidden('Réservé à la direction générale et au responsable provisioning.'));
  }
  next();
}

/** Réservé à la direction générale (gestion des comptes internes Ankkata). */
function requirePeutGererComptesAnkkata(req, res, next) {
  if (req.auth?.espace !== ESPACES.ANKKATA || !peutGererComptesAnkkata(req.auth.role)) {
    return next(ApiError.forbidden('Réservé à la direction générale.'));
  }
  next();
}

/** Réservé à la direction générale (consultation du journal d'audit interne). */
function requirePeutVoirJournalAudit(req, res, next) {
  if (req.auth?.espace !== ESPACES.ANKKATA || !peutVoirJournalAudit(req.auth.role)) {
    return next(ApiError.forbidden('Réservé à la direction générale.'));
  }
  next();
}

/**
 * Détermine le companyId sur lequel filtrer/écrire :
 *  - espace "ankkata" : vient du paramètre de route (:companyId), l'équipe
 *    Ankkata navigue explicitement de compagnie en compagnie ;
 *  - espace "admin"/"guichetier" : vient du token, jamais du client — on
 *    ignore/rejette toute tentative d'accéder à une autre compagnie.
 */
function resolveCompanyId(req) {
  if (req.auth.espace === ESPACES.ANKKATA) {
    return req.params.companyId || req.body.companyId || req.query.companyId || null;
  }
  return req.auth.companyId;
}

/** Empêche un admin/guichetier d'accéder à une ressource d'une autre compagnie. */
function enforceCompanyScope(req, res, next) {
  if (req.auth.espace === ESPACES.ANKKATA) return next();
  const demande = req.params.companyId || req.body.companyId || req.query.companyId;
  if (demande && demande !== req.auth.companyId) {
    return next(ApiError.forbidden('Accès à une autre compagnie refusé.'));
  }
  next();
}

/**
 * Réseau d'une compagnie (agences/bus/lignes) : gérable par Ankkata (DG +
 * responsable provisioning) OU par l'administrateur de la compagnie elle-
 * même. Le guichetier reste en lecture seule (routes GET uniquement, non
 * protégées par ce middleware).
 */
function canManageReseauCompagnie(req, res, next) {
  const { espace, role } = req.auth || {};
  if (espace === ESPACES.ADMIN) return next();
  if (espace === ESPACES.ANKKATA && peutGererCompagnies(role)) return next();
  return next(ApiError.forbidden('Réservé à l\'administrateur de la compagnie ou à l\'équipe Ankkata habilitée.'));
}

/** Comptes admin/guichetiers : gérables par Ankkata habilité ou l'admin de la compagnie. */
function canManageComptesCompagnie(req, res, next) {
  const { espace, role } = req.auth || {};
  if (espace === ESPACES.ADMIN) return next();
  if (espace === ESPACES.ANKKATA && peutGererCompagnies(role)) return next();
  return next(ApiError.forbidden('Réservé à l\'administrateur de la compagnie ou à l\'équipe Ankkata habilitée.'));
}

/** Opérations quotidiennes (ventes, réservations, caisse, pointage, clients, trips) : jamais Ankkata en écriture. */
function canOperateCompagnie(req, res, next) {
  const { espace } = req.auth || {};
  if (espace === ESPACES.ADMIN || espace === ESPACES.GUICHETIER) return next();
  return next(ApiError.forbidden('Réservé au personnel de la compagnie — l\'équipe Ankkata n\'a qu\'un accès en lecture ici.'));
}

module.exports = {
  authenticate,
  authorize,
  requirePeutGererCompagnies,
  requirePeutGererComptesAnkkata,
  requirePeutVoirJournalAudit,
  resolveCompanyId,
  enforceCompanyScope,
  canManageReseauCompagnie,
  canManageComptesCompagnie,
  canOperateCompagnie,
};
