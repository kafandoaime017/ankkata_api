// Journal d'audit scopé à une compagnie — visible par son administrateur
// et par l'équipe Ankkata habilitée (DG).
const { Router } = require('express');
const ApiError = require('../utils/ApiError');
const controller = require('../controllers/auditLog.controller');
const { authenticate, authorize, enforceCompanyScope } = require('../middlewares/auth.middleware');
const { ESPACES, peutVoirJournalAudit } = require('../constants/roles');

const router = Router({ mergeParams: true });

function canViewCompanyAudit(req, res, next) {
  const { espace, role } = req.auth;
  if (espace === ESPACES.ADMIN) return next();
  if (espace === ESPACES.ANKKATA && peutVoirJournalAudit(role)) return next();
  return next(ApiError.forbidden('Accès au journal d\'audit réservé à l\'administrateur de la compagnie ou à la direction générale Ankkata.'));
}

router.get('/', authenticate, authorize(ESPACES.ANKKATA, ESPACES.ADMIN), enforceCompanyScope, canViewCompanyAudit, controller.listForCompany);

module.exports = router;
