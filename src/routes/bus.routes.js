const { Router } = require('express');
const controller = require('../controllers/bus.controller');
const {
  authenticate,
  authorize,
  enforceCompanyScope,
  canManageReseauCompagnie,
} = require('../middlewares/auth.middleware');
const { ESPACES } = require('../constants/roles');

const router = Router({ mergeParams: true });

router.use(authenticate, authorize(ESPACES.ANKKATA, ESPACES.ADMIN, ESPACES.GUICHETIER), enforceCompanyScope);

router.get('/', controller.list);
router.get('/:id', controller.getOne);
router.post('/', canManageReseauCompagnie, controller.create);
router.patch('/:id', canManageReseauCompagnie, controller.update);
router.delete('/:id', canManageReseauCompagnie, controller.remove);

module.exports = router;
