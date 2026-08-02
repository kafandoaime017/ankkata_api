const { Router } = require('express');
const controller = require('../controllers/pointage.controller');
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
router.post('/', canOperateCompagnie, controller.clockIn);
router.post('/:id/clock-out', canOperateCompagnie, controller.clockOut);

module.exports = router;
