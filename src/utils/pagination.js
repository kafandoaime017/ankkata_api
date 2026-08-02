// Normalise les paramètres de pagination reçus en query string
// (?page=2&limit=20) et fournit un formateur de réponse paginée cohérent
// pour tous les endpoints de liste.
function getPagination(query) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

function buildPaginatedResponse({ rows, count }, { page, limit }) {
  return {
    data: rows,
    pagination: {
      page,
      limit,
      total: count,
      totalPages: Math.max(Math.ceil(count / limit), 1),
    },
  };
}

module.exports = { getPagination, buildPaginatedResponse };
