const { Router } = require('express');
const controller = require('../controllers/dashboard.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { ESPACES } = require('../constants/roles');

const router = Router();

router.get('/', authenticate, authorize(ESPACES.ANKKATA), controller.ankkataOverview);

module.exports = router;
