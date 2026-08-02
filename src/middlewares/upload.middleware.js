// Upload de fichiers (logos de compagnie pour l'instant) — stockage sur
// disque, servi ensuite en statique via `/uploads` (voir app.js). Le dossier
// est créé au démarrage s'il n'existe pas encore (utile en développement et
// au tout premier démarrage d'un conteneur avec volume vide).
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const ApiError = require('../utils/ApiError');

// Racine des fichiers uploadés : ankkata_api/uploads/... (à la racine du
// projet, PAS dans src/, pour rester hors du code source versionné et
// pouvoir être monté comme volume Docker indépendant — voir docker-compose.yml).
const UPLOADS_ROOT = path.join(__dirname, '..', '..', 'uploads');
const LOGOS_DIR = path.join(UPLOADS_ROOT, 'logos');

fs.mkdirSync(LOGOS_DIR, { recursive: true });

const EXTENSIONS_AUTORISEES = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg']);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, LOGOS_DIR),
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    // Route Ankkata (`/companies/:id/logo`) ou route admin scopée
    // (`/companies/:companyId/branding/logo`) — voir company.routes.js.
    const companyId = req.params.companyId || req.params.id;
    const nomUnique = `${companyId}-${Date.now()}${extension}`;
    cb(null, nomUnique);
  },
});

const filtreFichier = (req, file, cb) => {
  const extension = path.extname(file.originalname).toLowerCase();
  if (!EXTENSIONS_AUTORISEES.has(extension)) {
    cb(ApiError.badRequest('Format de logo non pris en charge (png, jpg, jpeg, webp, svg uniquement).'));
    return;
  }
  cb(null, true);
};

const uploadLogo = multer({
  storage,
  fileFilter: filtreFichier,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 Mo
});

module.exports = { uploadLogo, UPLOADS_ROOT };
