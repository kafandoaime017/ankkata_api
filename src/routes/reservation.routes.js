const { Router } = require('express');
const controller = require('../controllers/reservation.controller');
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
router.post('/', canOperateCompagnie, controller.create);
router.post('/:id/cancel', canOperateCompagnie, controller.cancel);
router.delete('/:id', canOperateCompagnie, controller.remove);

module.exports = router;
