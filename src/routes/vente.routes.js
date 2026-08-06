const { Router } = require('express');
const controller = require('../controllers/vente.controller');
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
// Doit être déclaré AVANT '/:id/...' pour éviter toute ambiguïté de route,
// même si Express distingue déjà par méthode/segment ici.
router.post('/aller-retour', canOperateCompagnie, controller.createAllerRetour);
router.post('/:id/cancel', canOperateCompagnie, controller.cancel);
router.patch('/:id/verify-colis', canOperateCompagnie, controller.verifyColis);

module.exports = router;
