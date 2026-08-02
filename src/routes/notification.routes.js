// Notifications — accessible aux 3 espaces authentifiés, chacun scopé à ce
// qui le concerne (voir notification.controller.js#scopeWhere). Pas de
// enforceCompanyScope ici : le scope ne dépend jamais d'un paramètre client.
const { Router } = require('express');
const controller = require('../controllers/notification.controller');
const { authenticate } = require('../middlewares/auth.middleware');

const router = Router();

router.use(authenticate);
router.get('/', controller.list);
router.get('/nombre-non-lues', controller.compterNonLues);
router.patch('/marquer-toutes-lues', controller.marquerToutesLues);
router.patch('/:id/lu', controller.marquerLue);

module.exports = router;
