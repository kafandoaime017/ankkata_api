const { Router } = require('express');
const controller = require('../controllers/trip.controller');
const {
  authenticate,
  authorize,
  enforceCompanyScope,
  canOperateCompagnie,
  canOperateCompagnieOrAnkkataSupport,
  blockSiFonctionsNonUrgentesBloquees,
} = require('../middlewares/auth.middleware');
const { ESPACES } = require('../constants/roles');

const router = Router({ mergeParams: true });

router.use(authenticate, authorize(ESPACES.ANKKATA, ESPACES.ADMIN, ESPACES.GUICHETIER), enforceCompanyScope);

router.get('/', controller.list);
router.get('/:id', controller.getOne);
// Création de nouveaux trajets = fonction "non urgente" bloquée au palier 2
// (impayé) — voir cahier des charges cycle de vie abonnement. La vente sur
// les trajets déjà créés n'est jamais concernée.
router.post('/', canOperateCompagnie, blockSiFonctionsNonUrgentesBloquees, controller.create);
// Génération : exception support Ankkata (voir doc de
// `canOperateCompagnieOrAnkkataSupport`) — utile pour dépanner une compagnie
// qui n'a pas encore généré les trajets d'une date.
router.post('/generate', canOperateCompagnieOrAnkkataSupport, blockSiFonctionsNonUrgentesBloquees, controller.generateForDate);
// Surcharge de quota par trajet précis : même exception support Ankkata,
// mais volontairement isolée sur sa propre route + son propre contrôleur
// (`updateQuota`), qui n'écrit QUE les deux champs de quota — jamais le
// reste du trajet (statut, bus, date...), qui reste `canOperateCompagnie`
// (compagnie uniquement) via la route PATCH générique ci-dessous.
router.patch('/:id/quota', canOperateCompagnieOrAnkkataSupport, controller.updateQuota);
router.patch('/:id', canOperateCompagnie, controller.update);
router.delete('/:id', canOperateCompagnie, controller.remove);

module.exports = router;
