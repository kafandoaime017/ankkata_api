// Journal d'audit global (tous événements, y compris internes Ankkata) —
// réservé à la direction générale.
const { Router } = require('express');
const controller = require('../controllers/auditLog.controller');
const { authenticate, authorize, requirePeutVoirJournalAudit } = require('../middlewares/auth.middleware');
const { ESPACES } = require('../constants/roles');

const router = Router();

router.get('/', authenticate, authorize(ESPACES.ANKKATA), requirePeutVoirJournalAudit, controller.listGlobal);

module.exports = router;
