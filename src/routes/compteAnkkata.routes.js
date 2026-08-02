const { Router } = require('express');
const controller = require('../controllers/compteAnkkata.controller');
const { authenticate, authorize, requirePeutGererComptesAnkkata } = require('../middlewares/auth.middleware');
const { ESPACES } = require('../constants/roles');

const router = Router();

router.use(authenticate, authorize(ESPACES.ANKKATA));

router.get('/', controller.list);
router.get('/:id', controller.getOne);
router.post('/', requirePeutGererComptesAnkkata, controller.create);
router.patch('/:id', requirePeutGererComptesAnkkata, controller.update);
router.patch('/:id/toggle-actif', requirePeutGererComptesAnkkata, controller.toggleActif);
router.delete('/:id', requirePeutGererComptesAnkkata, controller.remove);

module.exports = router;
