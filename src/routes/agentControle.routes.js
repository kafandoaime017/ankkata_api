const { Router } = require('express');
const controller = require('../controllers/agentControle.controller');
const {
  authenticate,
  authorize,
  enforceCompanyScope,
  canManageComptesCompagnie,
  blockSiFonctionsNonUrgentesBloquees,
} = require('../middlewares/auth.middleware');
const { ESPACES } = require('../constants/roles');

const router = Router({ mergeParams: true });

// Même politique d'accès que guichetier.routes.js : gérable par Ankkata
// (lecture + écriture habilitée) ou par l'administrateur de la compagnie —
// jamais par un agent de contrôle lui-même (ESPACES.CONTROLE volontairement
// absent de cette liste, voir constants/roles.js).
router.use(authenticate, authorize(ESPACES.ANKKATA, ESPACES.ADMIN), enforceCompanyScope);

router.get('/', controller.list);
router.get('/:id', controller.getOne);
// Ajout de comptes agent de contrôle = fonction "non urgente" bloquée au
// palier 2 (impayé) — même politique que les guichetiers.
router.post('/', canManageComptesCompagnie, blockSiFonctionsNonUrgentesBloquees, controller.create);
router.patch('/:id', canManageComptesCompagnie, controller.update);
router.post('/:id/reset-pin', canManageComptesCompagnie, controller.resetPin);
router.patch('/:id/toggle-actif', canManageComptesCompagnie, controller.toggleActif);
router.delete('/:id', canManageComptesCompagnie, controller.remove);

module.exports = router;
