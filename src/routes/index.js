// Point de montage unique de toutes les routes de l'API, sous le préfixe
// configuré (env.apiPrefix, ex : /api/v1) — voir app.js.
const { Router } = require('express');

const authRoutes = require('./auth.routes');
const companyRoutes = require('./company.routes');
const compteAnkkataRoutes = require('./compteAnkkata.routes');
const auditLogRoutes = require('./auditLog.routes');
const dashboardRoutes = require('./dashboard.routes');
const supportTicketRoutes = require('./supportTicket.routes');
const notificationRoutes = require('./notification.routes');
const posteRoutes = require('./poste.routes');
const publicRoutes = require('./public.routes');
const voyageurRoutes = require('./voyageur.routes');

const router = Router();

// Aucune authentification — voir public.controller.js. Montée avant
// `/companies` par pure lisibilité (surface publique bien séparée du reste,
// qui exige toujours un JWT).
router.use('/public', publicRoutes);
// Compte voyageur (site public) — espace d'authentification à part entière,
// distinct de /public (recherche/réservation anonymes) : voir
// voyageur.controller.js.
router.use('/voyageur', voyageurRoutes);

router.use('/auth', authRoutes);
router.use('/companies', companyRoutes);
router.use('/comptes-ankkata', compteAnkkataRoutes);
router.use('/audit-logs', auditLogRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/support-tickets', supportTicketRoutes);
router.use('/notifications', notificationRoutes);
router.use('/postes', posteRoutes);

module.exports = router;
