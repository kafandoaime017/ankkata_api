// Petites fonctions réutilisées par (presque) tous les controllers, pour
// éviter de réécrire la même logique de pagination/recherche partout.
const { Op } = require('sequelize');
const { getPagination, buildPaginatedResponse } = require('../utils/pagination');

/** Construit une clause WHERE `LIKE` (insensible à la casse) sur plusieurs colonnes. */
function buildSearchWhere(query, fields) {
  const q = (query.q || query.search || '').trim();
  if (!q || fields.length === 0) return {};
  return {
    [Op.or]: fields.map((field) => ({ [field]: { [Op.iLike]: `%${q}%` } })),
  };
}

async function findAndRespond(res, Model, where, options = {}) {
  const { page, limit, offset } = getPagination(options.query || {});
  const result = await Model.findAndCountAll({
    where,
    limit,
    offset,
    order: options.order || [['createdAt', 'DESC']],
    include: options.include,
  });
  res.json(buildPaginatedResponse(result, { page, limit }));
}

module.exports = { buildSearchWhere, findAndRespond, getPagination, buildPaginatedResponse };
