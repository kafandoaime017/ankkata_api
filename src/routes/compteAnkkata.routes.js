const { Router } = require('express');
const controller = require('../controllers/compteAnkkata.controller');
const { authenticate, authorize, requirePeutGererComptesAnkkata } = require('../middlewares/auth.middleware');
const { ESPACES } = require('../constants/roles');

const router = Router();

router.use(authenticate, authorize(ESPACES.ANKKATA));

// Auto-service 2FA — placé AVANT `/:id` pour éviter toute ambiguïté de
// routage, et agit toujours sur `req.auth.sub` (jamais un id passé par le
// client) : voir compteAnkkata.controller.js.
router.post('/2fa/setup', controller.setup2fa);
router.post('/2fa/confirmer', controller.confirmer2fa);
router.post('/2fa/desactiver', controller.desactiver2fa);

router.get('/', controller.list);
router.get('/:id', controller.getOne);
router.post('/', requirePeutGererComptesAnkkata, controller.create);
router.patch('/:id', requirePeutGererComptesAnkkata, controller.update);
router.patch('/:id/toggle-actif', requirePeutGererComptesAnkkata, controller.toggleActif);
router.delete('/:id', requirePeutGererComptesAnkkata, controller.remove);

module.exports = router;
