// Tickets de support/assistance d'une compagnie donnée — accessible à
// l'équipe Ankkata, à l'administrateur de la compagnie, ET à un guichetier
// (pour ouvrir/suivre SES PROPRES tickets — voir supportTicket.controller.js
// #appliquerScopeGuichetier). Statut/priorité/assignation et suppression
// restent réservés à Ankkata/Admin. Voir `supportTicket.routes.js` pour
// l'inbox globale (Ankkata uniquement).
const { Router } = require('express');
const controller = require('../controllers/supportTicket.controller');
const { authenticate, authorize, enforceCompanyScope } = require('../middlewares/auth.middleware');
const { ESPACES } = require('../constants/roles');

const router = Router({ mergeParams: true });

router.use(authenticate, enforceCompanyScope);

const LECTURE_ET_ECHANGE = authorize(ESPACES.ANKKATA, ESPACES.ADMIN, ESPACES.GUICHETIER);
const GESTION = authorize(ESPACES.ANKKATA, ESPACES.ADMIN);

router.get('/', LECTURE_ET_ECHANGE, controller.listForCompany);
router.get('/:id', LECTURE_ET_ECHANGE, controller.getOne);
router.post('/', LECTURE_ET_ECHANGE, controller.create);
router.post('/:id/messages', LECTURE_ET_ECHANGE, controller.addMessage);
router.patch('/:id', GESTION, controller.update);
router.delete('/:id', GESTION, controller.remove);

module.exports = router;
