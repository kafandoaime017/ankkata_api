// Émission de notifications — pour l'instant uniquement appelé depuis le
// cycle de vie des tickets de support (voir supportTicket.controller.js),
// mais centralisé ici pour que d'autres événements futurs (retard de
// paiement, etc.) puissent réutiliser le même mécanisme.
const { Notification } = require('../models');
const { ESPACES } = require('../constants/roles');

/**
 * @param {Object} params
 * @param {'ankkata'|'admin'|'guichetier'} params.espace
 * @param {string|null} [params.companyId] - requis pour espace='admin'
 * @param {string|null} [params.guichetierId] - requis pour espace='guichetier'
 * @param {string} params.type - ex: 'ticket_cree', 'ticket_message', 'ticket_statut'
 * @param {string} params.titre
 * @param {string} params.message
 * @param {string|null} [params.entityType] - ex: 'support_ticket'
 * @param {string|null} [params.entityId]
 */
async function notifier({ espace, companyId = null, guichetierId = null, type, titre, message, entityType = null, entityId = null }) {
  return Notification.create({ espace, companyId, guichetierId, type, titre, message, entityType, entityId });
}

/**
 * Diffusion à toute l'équipe Ankkata (inbox partagée, pas de destinataire
 * précis) — `companyId` n'est pas un filtre ici (l'espace 'ankkata' voit
 * tout), mais reste enregistré pour permettre au client (ankkata_admin) de
 * savoir vers quelle compagnie naviguer depuis la notification.
 */
function notifierAnkkata({ companyId = null, type, titre, message, entityType = null, entityId = null }) {
  return notifier({ espace: ESPACES.ANKKATA, companyId, type, titre, message, entityType, entityId });
}

/** À l'administrateur (ou aux administrateurs) d'une compagnie donnée. */
function notifierAdminCompagnie({ companyId, type, titre, message, entityType = null, entityId = null }) {
  return notifier({ espace: ESPACES.ADMIN, companyId, type, titre, message, entityType, entityId });
}

/** À un guichetier précis. */
function notifierGuichetier({ guichetierId, type, titre, message, entityType = null, entityId = null }) {
  return notifier({ espace: ESPACES.GUICHETIER, guichetierId, type, titre, message, entityType, entityId });
}

module.exports = { notifier, notifierAnkkata, notifierAdminCompagnie, notifierGuichetier };
