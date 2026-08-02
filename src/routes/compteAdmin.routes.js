const { Router } = require('express');
const controller = require('../controllers/compteAdmin.controller');
const {
  authenticate,
  authorize,
  enforceCompanyScope,
  canManageComptesCompagnie,
} = require('../middlewares/auth.middleware');
const { ESPACES } = require('../constants/roles');

const router = Router({ mergeParams: true });

router.use(authenticate, authorize(ESPACES.ANKKATA, ESPACES.ADMIN), enforceCompanyScope);

router.get('/', controller.list);
router.get('/:id', controller.getOne);
router.post('/', canManageComptesCompagnie, controller.create);
router.patch('/:id', canManageComptesCompagnie, controller.update);
router.patch('/:id/toggle-actif', canManageComptesCompagnie, controller.toggleActif);
router.delete('/:id', canManageComptesCompagnie, controller.remove);

module.exports = router;
