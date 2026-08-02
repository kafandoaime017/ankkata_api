// Tickets de support/assistance — trace "qui a contacté qui" pour une
// compagnie en difficulté. Deux points d'entrée (voir routes) : un global
// réservé à l'équipe Ankkata (inbox toutes compagnies confondues), un scopé
// à une compagnie (accessible aussi à son administrateur, pour ouvrir/suivre
// ses propres tickets).
const { SupportTicket, SupportTicketMessage, CompteAnkkata, Company, Guichetier } = require('../models');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const { generateCode } = require('../utils/idGenerator');
const { buildSearchWhere, getPagination, buildPaginatedResponse } = require('./helpers');
const { enregistrerAudit } = require('../services/audit.service');
const { notifierAnkkata, notifierAdminCompagnie, notifierGuichetier } = require('../services/notification.service');
const { ESPACES } = require('../constants/roles');

const INCLUDE_LISTE = [
  { model: CompteAnkkata, as: 'assigneA', attributes: ['id', 'nom'] },
  { model: Company, as: 'company', attributes: ['id', 'nom'] },
  { model: Guichetier, as: 'creePar', attributes: ['id', 'nom'] },
];

/** Un guichetier ne voit/ne modifie jamais que les tickets qu'il a lui-même ouverts. */
function appliquerScopeGuichetier(where, req) {
  if (req.auth?.espace === ESPACES.GUICHETIER) {
    where.creeParGuichetierId = req.auth.sub;
  }
  return where;
}

/** Notifie l'"autre côté" d'un événement sur un ticket (réponse ou mise à jour). */
async function notifierAutreCote(ticket, auteur) {
  const statutLabel = {
    ouvert: 'ouvert',
    en_cours: 'en cours de traitement',
    resolu: 'résolu',
    ferme: 'fermé',
  }[ticket.statut] || ticket.statut;

  // Le ticket a été ouvert par un guichetier précis : il doit être notifié
  // dès que quelqu'un d'autre que lui-même (Ankkata OU l'admin de sa propre
  // compagnie) répond, sinon il ne voit jamais la réponse à son propre ticket.
  const notifierCreateurGuichetier = async () => {
    if (ticket.creeParEspace === ESPACES.GUICHETIER && ticket.creeParGuichetierId && auteur?.sub !== ticket.creeParGuichetierId) {
      await notifierGuichetier({
        guichetierId: ticket.creeParGuichetierId,
        type: 'ticket_message',
        titre: 'Réponse sur votre ticket de support',
        message: `"${ticket.sujet}" — ${statutLabel}.`,
        entityType: 'support_ticket',
        entityId: ticket.id,
      });
    }
  };

  if (auteur?.espace === ESPACES.ANKKATA) {
    await notifierAdminCompagnie({
      companyId: ticket.companyId,
      type: 'ticket_message',
      titre: 'Mise à jour de votre ticket de support',
      message: `"${ticket.sujet}" — ${statutLabel}.`,
      entityType: 'support_ticket',
      entityId: ticket.id,
    });
    await notifierCreateurGuichetier();
  } else if (auteur?.espace === ESPACES.ADMIN) {
    await notifierAnkkata({
      companyId: ticket.companyId,
      type: 'ticket_message',
      titre: 'Nouveau message sur un ticket de support',
      message: `"${ticket.sujet}" a reçu une réponse.`,
      entityType: 'support_ticket',
      entityId: ticket.id,
    });
    await notifierCreateurGuichetier();
  } else {
    await notifierAnkkata({
      companyId: ticket.companyId,
      type: 'ticket_message',
      titre: 'Nouveau message sur un ticket de support',
      message: `"${ticket.sujet}" a reçu une réponse.`,
      entityType: 'support_ticket',
      entityId: ticket.id,
    });
  }
}

const INCLUDE_DETAIL = [
  ...INCLUDE_LISTE,
  { model: SupportTicketMessage, as: 'messages', separate: true, order: [['createdAt', 'ASC']] },
];

/** GET /support-tickets — inbox globale, réservée à l'équipe Ankkata. */
const listGlobal = catchAsync(async (req, res) => {
  const where = buildSearchWhere(req.query, ['sujet', 'nomContact']);
  if (req.query.companyId) where.companyId = req.query.companyId;
  if (req.query.statut) where.statut = req.query.statut;
  if (req.query.priorite) where.priorite = req.query.priorite;

  const { page, limit, offset } = getPagination(req.query);
  const result = await SupportTicket.findAndCountAll({
    where,
    limit,
    offset,
    order: [['createdAt', 'DESC']],
    include: INCLUDE_LISTE,
    distinct: true,
  });
  res.json(buildPaginatedResponse(result, { page, limit }));
});

/** GET /companies/:companyId/support-tickets — tickets d'une compagnie donnée. */
const listForCompany = catchAsync(async (req, res) => {
  const where = appliquerScopeGuichetier(
    { companyId: req.params.companyId, ...buildSearchWhere(req.query, ['sujet', 'nomContact']) },
    req
  );
  if (req.query.statut) where.statut = req.query.statut;

  const { page, limit, offset } = getPagination(req.query);
  const result = await SupportTicket.findAndCountAll({
    where,
    limit,
    offset,
    order: [['createdAt', 'DESC']],
    include: INCLUDE_LISTE,
    distinct: true,
  });
  res.json(buildPaginatedResponse(result, { page, limit }));
});

const getOne = catchAsync(async (req, res) => {
  const where = { id: req.params.id };
  if (req.params.companyId) where.companyId = req.params.companyId;
  appliquerScopeGuichetier(where, req);
  const ticket = await SupportTicket.findOne({ where, include: INCLUDE_DETAIL });
  if (!ticket) throw ApiError.notFound('Ticket introuvable.');
  res.json(ticket);
});

/** POST — { sujet, nomContact?, coordonneesContact?, canalContact?, priorite?, description? } */
const create = catchAsync(async (req, res) => {
  // Un admin/guichetier ne peut ouvrir un ticket que pour SA propre
  // compagnie (jamais via companyId du body/params) — seule l'équipe Ankkata
  // navigue explicitement de compagnie en compagnie.
  const companyId = req.auth?.espace === ESPACES.ANKKATA ? req.params.companyId || req.body.companyId : req.auth?.companyId;
  if (!companyId) throw ApiError.badRequest('Compagnie requise.');

  const { sujet, coordonneesContact, canalContact, priorite, description } = req.body;
  // Nom du contact : renseigné explicitement (ex. équipe Ankkata déclarant un
  // problème pour la compagnie), sinon déduit du compte authentifié — un
  // admin/guichetier n'a pas à se re-décrire lui-même à chaque ticket.
  const nomContact = req.body.nomContact || req.auth?.nom;
  if (!sujet || !nomContact) throw ApiError.badRequest('Le sujet et le nom du contact sont requis.');

  const ticket = await SupportTicket.create({
    code: generateCode('TKT'),
    companyId,
    sujet,
    nomContact,
    coordonneesContact: coordonneesContact || null,
    canalContact: canalContact || 'autre',
    priorite: priorite || 'normale',
    creeParEspace: req.auth?.espace || null,
    creeParGuichetierId: req.auth?.espace === ESPACES.GUICHETIER ? req.auth.sub : null,
  });

  if (description && description.trim()) {
    await SupportTicketMessage.create({
      ticketId: ticket.id,
      auteurAnkkataId: req.auth?.espace === ESPACES.ANKKATA ? req.auth.sub : null,
      auteurNom: req.auth?.nom || nomContact,
      contenu: description.trim(),
    });
  }

  await enregistrerAudit({
    action: 'Ouverture d\'un ticket de support',
    details: `Ticket "${sujet}" ouvert (contact : ${nomContact}).`,
    companyId,
    auteur: req.auth,
  });

  await notifierAnkkata({
    companyId,
    type: 'ticket_cree',
    titre: 'Nouveau ticket de support',
    message: `"${sujet}" — ${nomContact}.`,
    entityType: 'support_ticket',
    entityId: ticket.id,
  });

  const complet = await SupportTicket.findByPk(ticket.id, { include: INCLUDE_DETAIL });
  res.status(201).json(complet);
});

/** PATCH — { statut?, priorite?, assigneAId? } */
const update = catchAsync(async (req, res) => {
  const where = { id: req.params.id };
  if (req.params.companyId) where.companyId = req.params.companyId;
  const ticket = await SupportTicket.findOne({ where });
  if (!ticket) throw ApiError.notFound('Ticket introuvable.');

  const donnees = {};
  if (req.body.statut !== undefined) {
    donnees.statut = req.body.statut;
    donnees.dateResolution = req.body.statut === 'resolu' || req.body.statut === 'ferme' ? new Date() : null;
  }
  if (req.body.priorite !== undefined) donnees.priorite = req.body.priorite;
  if (req.body.assigneAId !== undefined) donnees.assigneAId = req.body.assigneAId || null;

  await ticket.update(donnees);

  await enregistrerAudit({
    action: 'Mise à jour d\'un ticket de support',
    details: `Ticket "${ticket.sujet}" mis à jour.`,
    companyId: ticket.companyId,
    auteur: req.auth,
  });

  if (Object.keys(donnees).length > 0) {
    await notifierAutreCote(ticket, req.auth);
  }

  const complet = await SupportTicket.findByPk(ticket.id, { include: INCLUDE_DETAIL });
  res.json(complet);
});

/** POST /:id/messages — { contenu } */
const addMessage = catchAsync(async (req, res) => {
  const where = appliquerScopeGuichetier({ id: req.params.id }, req);
  if (req.params.companyId) where.companyId = req.params.companyId;
  const ticket = await SupportTicket.findOne({ where });
  if (!ticket) throw ApiError.notFound('Ticket introuvable.');
  const contenu = (req.body.contenu || '').trim();
  if (!contenu) throw ApiError.badRequest('Le contenu du message est requis.');

  await SupportTicketMessage.create({
    ticketId: ticket.id,
    auteurAnkkataId: req.auth?.espace === ESPACES.ANKKATA ? req.auth.sub : null,
    auteurNom: req.body.auteurNom || req.auth?.nom || 'Compagnie',
    contenu,
  });

  // Un ticket fermé/résolu redevient "en cours" dès qu'un nouvel échange a lieu.
  if (ticket.statut === 'resolu' || ticket.statut === 'ferme') {
    await ticket.update({ statut: 'en_cours', dateResolution: null });
  }

  await notifierAutreCote(ticket, req.auth);

  const complet = await SupportTicket.findByPk(ticket.id, { include: INCLUDE_DETAIL });
  res.status(201).json(complet);
});

const remove = catchAsync(async (req, res) => {
  const where = { id: req.params.id };
  if (req.params.companyId) where.companyId = req.params.companyId;
  const ticket = await SupportTicket.findOne({ where });
  if (!ticket) throw ApiError.notFound('Ticket introuvable.');
  await ticket.destroy();
  res.status(204).send();
});

module.exports = { listGlobal, listForCompany, getOne, create, update, addMessage, remove };
