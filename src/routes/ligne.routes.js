const { Router } = require('express');
const controller = require('../controllers/ligne.controller');
const {
  authenticate,
  authorize,
  enforceCompanyScope,
  canManageReseauCompagnie,
  blockSiFonctionsNonUrgentesBloquees,
} = require('../middlewares/auth.middleware');
const { ESPACES } = require('../constants/roles');

const router = Router({ mergeParams: true });

router.use(authenticate, authorize(ESPACES.ANKKATA, ESPACES.ADMIN, ESPACES.GUICHETIER), enforceCompanyScope);

router.get('/', controller.list);
router.get('/:id', controller.getOne);
router.post('/', canManageReseauCompagnie, controller.create);
// Modification des tarifs (embarquée dans la mise à jour de la ligne, voir
// ligne.controller.js#update/remplacerEnfants) = fonction "non urgente"
// bloquée au palier 2 (impayé).
router.patch('/:id', canManageReseauCompagnie, blockSiFonctionsNonUrgentesBloquees, controller.update);
// Génération manuelle des ~2 prochains mois de trajets pour cette ligne —
// même génération de trajets, même règle "non urgente" que /trips/generate ;
// même niveau d'accès que le reste de la gestion des lignes (canManageReseauCompagnie).
router.post('/:id/generer', canManageReseauCompagnie, blockSiFonctionsNonUrgentesBloquees, controller.genererProchainsMois);
router.delete('/:id', canManageReseauCompagnie, controller.remove);

module.exports = router;
