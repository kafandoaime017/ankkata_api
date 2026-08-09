// Journal d'audit unifié — remplace `enregistrerAudit(...)` qu'on retrouve
// dans les deux apps Flutter (ankkata_admin ET ankata_guichet), mais côté
// serveur, avec une vraie table partagée. Chaque entrée peut être rattachée
// soit à un compte Ankkata (actions internes/provisioning), soit à un
// compte admin ou guichetier d'une compagnie (actions locales à la
// compagnie) — jamais les deux à la fois.
const { AuditLog } = require('../models');

/**
 * @param {Object} params
 * @param {string} params.action - libellé court, ex: "Suspension de compagnie"
 * @param {string} params.details - détails libres
 * @param {string|null} [params.companyId] - null pour un événement Ankkata pur
 * @param {Object|null} [params.auteur] - req.auth (voir auth.middleware) ou null pour "Système"
 */
async function enregistrerAudit({ action, details, companyId = null, auteur = null }) {
  const entry = {
    action,
    details,
    companyId: companyId || auteur?.companyId || null,
    date: new Date(),
    auteurNom: auteur?.nom || 'Système',
    // `auteur` est toujours `req.auth` (payload JWT décodé), qui porte
    // l'identifiant du compte sous la clé `sub` (convention JWT standard —
    // voir token.service.js/auth.controller.js), jamais `id`.
    auteurAnkkataId: auteur?.espace === 'ankkata' ? auteur.sub : null,
    auteurAdminId: auteur?.espace === 'admin' ? auteur.sub : null,
    auteurGuichetierId: auteur?.espace === 'guichetier' ? auteur.sub : null,
    auteurAgentControleId: auteur?.espace === 'controle' ? auteur.sub : null,
  };
  return AuditLog.create(entry);
}

module.exports = { enregistrerAudit };
