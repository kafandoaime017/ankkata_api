// Espace compte voyageur (site public) — connexion par téléphone + code OTP,
// profil, voir controllers/voyageur.controller.js. Monté sous /voyageur
// (routes/index.js).
const { Router } = require('express');
const controller = require('../controllers/voyageur.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { ESPACES } = require('../constants/roles');

const router = Router();

router.post('/otp/demander', controller.demanderOtp);
router.post('/otp/verifier', controller.verifierOtp);

// Connexion alternative "se connecter par email" — voir demanderOtpEmail/verifierOtpEmail.
router.post('/email/demander', controller.demanderOtpEmail);
router.post('/email/verifier', controller.verifierOtpEmail);

router.get('/me', authenticate, authorize(ESPACES.VOYAGEUR), controller.me);
router.patch('/me', authenticate, authorize(ESPACES.VOYAGEUR), controller.updateProfile);
router.get('/reservations', authenticate, authorize(ESPACES.VOYAGEUR), controller.mesReservations);

module.exports = router;
