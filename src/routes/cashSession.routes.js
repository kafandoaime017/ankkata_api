const { Router } = require('express');
const controller = require('../controllers/cashSession.controller');
const {
  authenticate,
  authorize,
  enforceCompanyScope,
  canOperateCompagnie,
} = require('../middlewares/auth.middleware');
const { ESPACES } = require('../constants/roles');

const router = Router({ mergeParams: true });

router.use(authenticate, authorize(ESPACES.ANKKATA, ESPACES.ADMIN, ESPACES.GUICHETIER), enforceCompanyScope);

router.get('/', controller.list);
router.get('/:id', controller.getOne);
router.post('/', canOperateCompagnie, controller.open);
router.post('/:id/movements', canOperateCompagnie, controller.addMovement);
router.post('/:id/close', canOperateCompagnie, controller.close);

module.exports = router;
