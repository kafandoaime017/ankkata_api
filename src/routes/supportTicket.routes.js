// Tickets de support/assistance — inbox globale, réservée à l'équipe
// Ankkata (toutes compagnies confondues). Voir `supportTicketCompany.routes.js`
// pour la variante scopée à une compagnie (accessible aussi à son admin).
const { Router } = require('express');
const controller = require('../controllers/supportTicket.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { ESPACES } = require('../constants/roles');

const router = Router();

router.use(authenticate, authorize(ESPACES.ANKKATA));
router.get('/', controller.listGlobal);
router.get('/:id', controller.getOne);
router.patch('/:id', controller.update);
router.post('/:id/messages', controller.addMessage);
router.delete('/:id', controller.remove);

module.exports = router;
