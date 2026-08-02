const { Router } = require('express');
const controller = require('../controllers/trip.controller');
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
router.post('/generate', canOperateCompagnie, controller.generateForDate);
router.patch('/:id', canOperateCompagnie, controller.update);
router.delete('/:id', canOperateCompagnie, controller.remove);

module.exports = router;
