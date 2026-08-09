const { Router } = require('express');
const controller = require('../controllers/trip.controller');
const embarquementController = require('../controllers/embarquement.controller');
const {
  authenticate,
  authorize,
  enforceCompanyScope,
  canOperateCompagnie,
  canOperateCompagnieOrAnkkataSupport,
  canOperateEmbarquement,
  blockSiFonctionsNonUrgentesBloquees,
} = require('../middlewares/auth.middleware');
const { ESPACES } = require('../constants/roles');

const router = Router({ mergeParams: true });

// ESPACES.CONTROLE ajouté ICI (lecture des trajets) pour que l'app agent de
// contrôle puisse atteindre les routes d'embarquement ci-dessous, montées
// sur ce même routeur — les routes d'ÉCRITURE générales sur un trajet
// (create/update/delete/generate/quota) restent, elles, gardées par
// `canOperateCompagnie`/`canOperateCompagnieOrAnkkataSupport`, qui n'incluent
// PAS ESPACES.CONTROLE : un agent de contrôle ne peut donc jamais créer,
// modifier ou supprimer un trajet, seulement consulter et embarquer.
router.use(authenticate, authorize(ESPACES.ANKKATA, ESPACES.ADMIN, ESPACES.GUICHETIER, ESPACES.CONTROLE), enforceCompanyScope);

// Route littérale déclarée AVANT `GET /:id` pour ne pas être interceptée par
// celle-ci (Express matcherait sinon "embarquement" comme un `:id`) — voir
// embarquement.controller.js#listDeparts, écran "Sélection du départ" côté
// app mobile.
router.get('/embarquement', embarquementController.listDeparts);

router.get('/', controller.list);
router.get('/:id', controller.getOne);

// --- Contrôle à l'embarquement (app mobile "agent de contrôle") ---------
// Toutes sous-routées à un trajet précis, donc sans risque de collision
// avec les routes génériques ci-dessus/dessous.
router.get('/:id/manifeste-embarquement', embarquementController.manifeste);
router.get('/:id/embarquements', embarquementController.listEmbarquements);
router.post('/:id/embarquements', canOperateEmbarquement, embarquementController.creerEmbarquement);
router.post('/:id/embarquements/sync', canOperateEmbarquement, embarquementController.syncEmbarquements);
router.post('/:id/cloturer-embarquement', canOperateEmbarquement, embarquementController.cloturer);
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
