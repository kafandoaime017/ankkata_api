const { Router } = require('express');
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth.middleware');

const router = Router();

router.post('/ankkata/login', authController.loginAnkkata);
router.post('/admin/login', authController.loginAdmin);
router.post('/guichetier/login', authController.loginGuichetier);
router.post('/refresh', authController.refresh);
router.get('/me', authenticate, authController.me);

module.exports = router;
