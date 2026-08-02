// Journal d'audit — deux points d'entrée le consultent (voir routes) :
// un global réservé à la direction générale Ankkata (tous événements, y
// compris ceux internes à Ankkata même, companyId = null), et un scopé à
// une compagnie (accessible aussi à son administrateur).
const { AuditLog } = require('../models');
const catchAsync = require('../utils/catchAsync');
const { buildSearchWhere, getPagination, buildPaginatedResponse } = require('./helpers');

const listGlobal = catchAsync(async (req, res) => {
  const where = buildSearchWhere(req.query, ['action', 'details', 'auteurNom']);
  if (req.query.companyId) where.companyId = req.query.companyId;

  const { page, limit, offset } = getPagination(req.query);
  const result = await AuditLog.findAndCountAll({ where, limit, offset, order: [['date', 'DESC']] });
  res.json(buildPaginatedResponse(result, { page, limit }));
});

const listForCompany = catchAsync(async (req, res) => {
  const where = { companyId: req.params.companyId, ...buildSearchWhere(req.query, ['action', 'details', 'auteurNom']) };
  const { page, limit, offset } = getPagination(req.query);
  const result = await AuditLog.findAndCountAll({ where, limit, offset, order: [['date', 'DESC']] });
  res.json(buildPaginatedResponse(result, { page, limit }));
});

module.exports = { listGlobal, listForCompany };
