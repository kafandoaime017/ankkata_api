// Routes PUBLIQUES — aucun middleware d'authentification, voir
// public.controller.js pour le raisonnement complet. Montées sous /public
// (voir routes/index.js), consommées exclusivement par ankkata_frontend
// (app Voyageur Next.js) via ses propres routes API (proxy), jamais
// directement par un navigateur tiers non prévu pour ça.
const { Router } = require('express');
const controller = require('../controllers/public.controller');
const { authenticateOptionnel } = require('../middlewares/auth.middleware');

const router = Router();

router.get('/villes', controller.listVilles);
router.get('/trips', controller.searchTrips);
router.get('/trips/:id', controller.getTrip);
router.get('/compagnies', controller.listCompanies);
router.get('/compagnies/:id', controller.getCompany);
// Auth optionnelle : rattache la réservation au compte voyageur connecté
// s'il y en a un (voir authenticateOptionnel), mais ne l'exige jamais.
router.post('/reservations', authenticateOptionnel, controller.createReservation);
// Réservation aller-retour en une seule opération (deux Reservation liées,
// voir `public.controller.js#createReservationAllerRetour`).
router.post('/reservations/aller-retour', authenticateOptionnel, controller.createReservationAllerRetour);
// Réservation groupée 1-6 passagers en une seule opération (N Reservation
// liées par `groupeReference`, voir `public.controller.js#createReservationGroupe`).
router.post('/reservations/groupe', authenticateOptionnel, controller.createReservationGroupe);
router.get('/reservations/groupe/:reference', controller.lookupReservationGroupe);
router.get('/reservations/lookup', controller.lookupReservation);
router.get('/reservations/:id/billet', controller.getBillet);
router.get('/reservations/:id/billet.pdf', controller.getBilletPdf);

module.exports = router;
