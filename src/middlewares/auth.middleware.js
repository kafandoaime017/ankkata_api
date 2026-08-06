// Authentification/autorisation — les 3 espaces (ankkata/admin/guichetier)
// passent tous par le même JWT, seul le contenu du payload change (voir
// auth.controller.js pour l'émission). `authenticate` peuple `req.auth` ;
// les autres middlewares n'ont qu'à lire `req.auth`.
const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const tokenService = require('../services/token.service');
const { ESPACES, peutGererCompagnies, peutGererComptesAnkkata, peutVoirJournalAudit } = require('../constants/roles');
const { fonctionsNonUrgentesBloquees } = require('../services/abonnement.service');

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

/**
 * Comme `authenticate`, mais ne bloque JAMAIS la requête : si l'en-tête
 * Authorization est absent ou invalide, `req.auth` reste simplement
 * `undefined` et la route continue normalement. Utilisé UNIQUEMENT par
 * `POST /public/reservations` (voir public.controller.js#createReservation)
 * pour rattacher la réservation à un compte voyageur connecté quand il y en
 * a un, sans jamais exiger de compte pour réserver (le "guest checkout"
 * reste la voie normale).
 */
function authenticateOptionnel(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme === 'Bearer' && token) {
    try {
      req.auth = tokenService.verifyAccessToken(token);
    } catch (err) {
      // Jeton invalide/expiré : on l'ignore silencieusement, la réservation
      // se poursuit comme si le voyageur n'était pas connecté.
    }
  }
  next();
}

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

/**
 * Exception PRÉCISE et volontairement étroite à `canOperateCompagnie` :
 * l'équipe Ankkata reste en lecture seule sur les trajets (statut, bus,
 * annulation, suppression — tout ce qui reste exclusivement piloté par la
 * compagnie elle-même), MAIS peut, pour du support, générer les trajets
 * d'une date (`POST /trips/generate`) et ajuster la surcharge de quota
 * ponctuelle d'un trajet précis (`PATCH /trips/:id/quota`) — jamais le reste
 * du trajet (voir `trip.controller.js#updateQuota`, qui n'écrit QUE
 * `quotaEnLigneOverride`/`quotaGuichetOverride`, quel que soit le contenu du
 * corps de la requête). Compagnie (admin/guichetier) toujours autorisée,
 * comme avant.
 */
function canOperateCompagnieOrAnkkataSupport(req, res, next) {
  const { espace } = req.auth || {};
  if (espace === ESPACES.ADMIN || espace === ESPACES.GUICHETIER || espace === ESPACES.ANKKATA) return next();
  return next(ApiError.forbidden('Action réservée au personnel de la compagnie ou à l\'équipe Ankkata.'));
}

/**
 * Palier 2 (impayé, J+1 à J+15+) — voir services/abonnement.service.js :
 * bloque uniquement les fonctions "non urgentes" (nouveaux trajets,
 * nouveaux comptes guichetiers, modification des tarifs) sur les routes qui
 * l'utilisent explicitement. Ne bloque JAMAIS la vente, l'impression ou la
 * clôture de caisse — ces routes n'utilisent pas ce middleware.
 * Contourné pour l'équipe Ankkata (peut toujours intervenir pour aider une
 * compagnie, y compris pendant un impayé).
 */
const blockSiFonctionsNonUrgentesBloquees = catchAsync(async (req, res, next) => {
  if (req.auth?.espace === ESPACES.ANKKATA) return next();

  const companyId = resolveCompanyId(req);
  if (!companyId) return next();

  const { Company } = require('../models');
  const company = await Company.findByPk(companyId, {
    attributes: ['id', 'statut', 'dateExpirationAbonnement', 'montantDu'],
  });
  if (!company) return next();

  if (fonctionsNonUrgentesBloquees(company)) {
    return next(ApiError.forbidden(
      'Cette action est temporairement indisponible — l\'abonnement de votre compagnie doit être régularisé. Contactez Ankkata.'
    ));
  }
  next();
});

module.exports = {
  authenticate,
  authenticateOptionnel,
  authorize,
  requirePeutGererCompagnies,
  requirePeutGererComptesAnkkata,
  requirePeutVoirJournalAudit,
  resolveCompanyId,
  enforceCompanyScope,
  canManageReseauCompagnie,
  canManageComptesCompagnie,
  canOperateCompagnie,
  canOperateCompagnieOrAnkkataSupport,
  blockSiFonctionsNonUrgentesBloquees,
};
