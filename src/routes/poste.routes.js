// Routes /postes — inbox globale de supervision, réservée à l'équipe
// Ankkata, + réception des heartbeats (voir poste.controller.js#heartbeat,
// envoyé directement par le logiciel guichet avec son propre JWT
// admin/guichetier, sans passer par une URL scopée compagnie).
const { Router } = require('express');
const controller = require('../controllers/poste.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { ESPACES } = require('../constants/roles');

const router = Router();

router.use(authenticate);

// Envoyé par un poste guichet/admin déjà connecté — jamais par l'équipe
// Ankkata, qui n'a pas d'installation du logiciel guichet à superviser.
router.post('/heartbeat', authorize(ESPACES.ADMIN, ESPACES.GUICHETIER), controller.heartbeat);

router.get('/', authorize(ESPACES.ANKKATA), controller.listGlobal);
router.get('/:id', authorize(ESPACES.ANKKATA), controller.getOne);
router.patch('/:id/resoudre', authorize(ESPACES.ANKKATA), controller.marquerResolu);

module.exports = router;
