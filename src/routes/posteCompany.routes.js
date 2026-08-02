// Routes /companies/:companyId/postes — supervision scopée à une compagnie,
// accessible à son administrateur ET à l'équipe Ankkata (même deux-routes
// pattern que supportTicketCompany.routes.js).
const { Router } = require('express');
const controller = require('../controllers/poste.controller');
const { authenticate, authorize, enforceCompanyScope } = require('../middlewares/auth.middleware');
const { ESPACES } = require('../constants/roles');

const router = Router({ mergeParams: true });

router.use(authenticate, enforceCompanyScope);

const LECTURE = authorize(ESPACES.ANKKATA, ESPACES.ADMIN);

router.get('/', LECTURE, controller.listForCompany);
router.get('/:id', LECTURE, controller.getOne);
router.patch('/:id/resoudre', LECTURE, controller.marquerResolu);

module.exports = router;
