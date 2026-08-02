// Notifications — chaque espace (ankkata/admin/guichetier) ne voit que les
// siennes ; le scope est toujours dérivé de `req.auth` (jamais des
// paramètres de requête, pour qu'un guichetier ne puisse jamais lire les
// notifications d'un autre, ni un admin celles d'une autre compagnie).
const { Notification } = require('../models');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const { ESPACES } = require('../constants/roles');

/** Clause WHERE de scope, dérivée exclusivement de req.auth. */
function scopeWhere(auth) {
  if (auth.espace === ESPACES.ANKKATA) return { espace: ESPACES.ANKKATA };
  if (auth.espace === ESPACES.ADMIN) return { espace: ESPACES.ADMIN, companyId: auth.companyId };
  return { espace: ESPACES.GUICHETIER, guichetierId: auth.sub };
}

/** GET /notifications?lu=false — les 50 plus récentes, non paginées (volume attendu faible). */
const list = catchAsync(async (req, res) => {
  const where = scopeWhere(req.auth);
  if (req.query.lu !== undefined) where.lu = req.query.lu === 'true';

  const notifications = await Notification.findAll({
    where,
    order: [['createdAt', 'DESC']],
    limit: 50,
  });
  res.json(notifications);
});

/** GET /notifications/nombre-non-lues */
const compterNonLues = catchAsync(async (req, res) => {
  const where = { ...scopeWhere(req.auth), lu: false };
  const nombre = await Notification.count({ where });
  res.json({ nombre });
});

/** PATCH /notifications/:id/lu */
const marquerLue = catchAsync(async (req, res) => {
  const where = { id: req.params.id, ...scopeWhere(req.auth) };
  const notification = await Notification.findOne({ where });
  if (!notification) throw ApiError.notFound('Notification introuvable.');
  await notification.update({ lu: true });
  res.json(notification);
});

/** PATCH /notifications/marquer-toutes-lues */
const marquerToutesLues = catchAsync(async (req, res) => {
  const where = { ...scopeWhere(req.auth), lu: false };
  await Notification.update({ lu: true }, { where });
  res.status(204).send();
});

module.exports = { list, compterNonLues, marquerLue, marquerToutesLues };
