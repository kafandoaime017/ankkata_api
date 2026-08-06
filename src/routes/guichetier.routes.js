const { Router } = require('express');
const controller = require('../controllers/guichetier.controller');
const {
  authenticate,
  authorize,
  enforceCompanyScope,
  canManageComptesCompagnie,
  blockSiFonctionsNonUrgentesBloquees,
} = require('../middlewares/auth.middleware');
const { ESPACES } = require('../constants/roles');

const router = Router({ mergeParams: true });

router.use(authenticate, authorize(ESPACES.ANKKATA, ESPACES.ADMIN), enforceCompanyScope);

router.get('/', controller.list);
router.get('/:id', controller.getOne);
// Ajout de comptes guichetiers = fonction "non urgente" bloquée au palier 2
// (impayé) — voir cahier des charges cycle de vie abonnement.
router.post('/', canManageComptesCompagnie, blockSiFonctionsNonUrgentesBloquees, controller.create);
router.patch('/:id', canManageComptesCompagnie, controller.update);
router.post('/:id/reset-pin', canManageComptesCompagnie, controller.resetPin);
router.patch('/:id/toggle-actif', canManageComptesCompagnie, controller.toggleActif);
router.delete('/:id', canManageComptesCompagnie, controller.remove);

module.exports = router;
