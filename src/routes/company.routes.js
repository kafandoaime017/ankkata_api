// Routes /companies — gestion des compagnies elles-mêmes (réservé Ankkata)
// + montage de toutes les ressources scopées à une compagnie sous
// /companies/:companyId/... (agences, bus, lignes, comptes, guichetiers,
// clients, trips, réservations, ventes, caisse, pointages, audit, dashboard).
const { Router } = require('express');
const controller = require('../controllers/company.controller');
const dashboardController = require('../controllers/dashboard.controller');
const {
  authenticate,
  authorize,
  requirePeutGererCompagnies,
  enforceCompanyScope,
} = require('../middlewares/auth.middleware');
const { uploadLogo } = require('../middlewares/upload.middleware');
const { ESPACES } = require('../constants/roles');

const agenceRoutes = require('./agence.routes');
const busRoutes = require('./bus.routes');
const ligneRoutes = require('./ligne.routes');
const compteAdminRoutes = require('./compteAdmin.routes');
const guichetierRoutes = require('./guichetier.routes');
const agentControleRoutes = require('./agentControle.routes');
const clientRoutes = require('./client.routes');
const tripRoutes = require('./trip.routes');
const reservationRoutes = require('./reservation.routes');
const venteRoutes = require('./vente.routes');
const cashSessionRoutes = require('./cashSession.routes');
const pointageRoutes = require('./pointage.routes');
const auditLogCompanyRoutes = require('./auditLogCompany.routes');
const supportTicketCompanyRoutes = require('./supportTicketCompany.routes');
const posteCompanyRoutes = require('./posteCompany.routes');

const router = Router();

// Endpoint public utilisé par l'app compagnie pour récupérer son identité
// visuelle à l'activation (pas d'authentification : c'est la toute
// première requête avant qu'un compte n'existe côté client).
router.get('/activation/:cleActivation', controller.lookupByActivationKey);

router.use(authenticate);

router.get('/', authorize(ESPACES.ANKKATA), controller.list);
router.post('/', authorize(ESPACES.ANKKATA), requirePeutGererCompagnies, controller.create);
router.get('/:id', authorize(ESPACES.ANKKATA), controller.getOne);
router.patch('/:id', authorize(ESPACES.ANKKATA), requirePeutGererCompagnies, controller.update);
router.post(
  '/:id/logo',
  authorize(ESPACES.ANKKATA),
  requirePeutGererCompagnies,
  uploadLogo.single('logo'),
  controller.uploadLogo
);
router.post('/:id/regenerate-key', authorize(ESPACES.ANKKATA), requirePeutGererCompagnies, controller.regenerateActivationKey);
router.post('/:id/renew-subscription', authorize(ESPACES.ANKKATA), requirePeutGererCompagnies, controller.renewSubscription);
router.patch('/:id/status', authorize(ESPACES.ANKKATA), requirePeutGererCompagnies, controller.changeStatus);

router.get(
  '/:companyId/dashboard',
  authorize(ESPACES.ANKKATA, ESPACES.ADMIN, ESPACES.GUICHETIER),
  enforceCompanyScope,
  dashboardController.companyOverview
);

// Identité visuelle + réglages régionaux/ticket, en self-service pour
// l'administrateur de la compagnie (voir ankata_guichet, écran Paramètres
// compagnie) — distinct de PATCH /:id (réservé Ankkata) : n'expose que les
// champs de marque, jamais statut/plan/clé d'activation.
router.patch(
  '/:companyId/branding',
  authorize(ESPACES.ANKKATA, ESPACES.ADMIN),
  enforceCompanyScope,
  controller.updateBranding
);
router.post(
  '/:companyId/branding/logo',
  authorize(ESPACES.ANKKATA, ESPACES.ADMIN),
  enforceCompanyScope,
  uploadLogo.single('logo'),
  controller.uploadLogo
);
router.delete(
  '/:companyId/branding/logo',
  authorize(ESPACES.ANKKATA, ESPACES.ADMIN),
  enforceCompanyScope,
  controller.removeLogo
);

router.use('/:companyId/agences', agenceRoutes);
router.use('/:companyId/buses', busRoutes);
router.use('/:companyId/lignes', ligneRoutes);
router.use('/:companyId/comptes-admin', compteAdminRoutes);
router.use('/:companyId/guichetiers', guichetierRoutes);
router.use('/:companyId/agents-controle', agentControleRoutes);
router.use('/:companyId/clients', clientRoutes);
router.use('/:companyId/trips', tripRoutes);
router.use('/:companyId/reservations', reservationRoutes);
router.use('/:companyId/ventes', venteRoutes);
router.use('/:companyId/cash-sessions', cashSessionRoutes);
router.use('/:companyId/pointages', pointageRoutes);
router.use('/:companyId/audit-logs', auditLogCompanyRoutes);
router.use('/:companyId/support-tickets', supportTicketCompanyRoutes);
router.use('/:companyId/postes', posteCompanyRoutes);

module.exports = router;
