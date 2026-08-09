// Contrôle à l'embarquement — cœur de l'app mobile "agent de contrôle" :
// liste des départs de la gare de l'agent, téléchargement du "manifeste"
// (liste des billets valides d'un trajet, pour un fonctionnement 100% hors
// ligne une fois téléchargé), enregistrement d'un scan/d'une validation
// manuelle (idempotent, voir idLocal — même mécanique que
// vente.controller.js#create), et clôture du voyage.
//
// Important : le QR déjà imprimé sur les billets (voir
// services/billet.service.js) n'encode qu'une URL de vérification
// "https://.../mes-reservations?reference=...&telephone=...", jamais un
// jeton signé. On ne le change PAS : l'app agent télécharge d'abord le
// manifeste (HTTPS, donc déjà de confiance) puis se contente de vérifier
// que la référence scannée y figure — aucune vérification cryptographique
// du QR n'est nécessaire pour ce cas d'usage (voir la note dans le document
// de conception `ankkata_controle_embarquement_SPEC.md`).
const { Trip, Ligne, Agence, Bus, Reservation, Vente, Embarquement, AgentControle } = require('../models');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const { enregistrerAudit } = require('../services/audit.service');
const { ESPACES } = require('../constants/roles');

const INCLUDE_TRIP = [
  { model: Ligne, as: 'ligne', include: [{ model: Agence, as: 'agenceArrivee' }] },
  { model: Agence, as: 'agenceDepart' },
  { model: Bus, as: 'bus' },
];

/**
 * Un agent de contrôle (ou un guichetier) ne doit jamais pouvoir consulter/
 * agir sur les trajets d'une AUTRE gare que la sienne — `agenceId` vient
 * toujours du token pour ces deux espaces, jamais du client (même principe
 * que `enforceCompanyScope` pour `companyId`, voir auth.middleware.js).
 */
function agenceIdImpose(req) {
  const { espace, agenceId } = req.auth || {};
  if (espace === ESPACES.CONTROLE || espace === ESPACES.GUICHETIER) return agenceId;
  return null;
}

/** Résout et vérifie l'accès au trajet ciblé, en appliquant `agenceIdImpose`. */
async function trouverTripAutorise(req) {
  const trip = await Trip.findOne({ where: { id: req.params.id, companyId: req.params.companyId }, include: INCLUDE_TRIP });
  if (!trip) throw ApiError.notFound('Trajet introuvable.');

  const agenceImposee = agenceIdImpose(req);
  if (agenceImposee && trip.agenceDepartId !== agenceImposee) {
    throw ApiError.forbidden('Ce trajet ne part pas de votre gare.');
  }
  return trip;
}

/** Compte les passagers attendus (réservations confirmées + ventes non annulées) et déjà embarqués d'UN trajet. */
async function compterEmbarquement(tripId) {
  const [reservations, ventes, embarques] = await Promise.all([
    Reservation.count({ where: { tripId, statut: 'confirmee' } }),
    Vente.sum('nombrePlaces', { where: { tripId, annulee: false } }),
    Embarquement.count({ where: { tripId, statut: 'embarque' } }),
  ]);
  return { attendus: reservations + (ventes || 0), embarques };
}

/**
 * GET /companies/:companyId/trips/embarquement?date=YYYY-MM-DD — départs de
 * la gare de l'agent (ou de la gare demandée pour Ankkata/admin) pour une
 * date donnée. C'est l'écran "Sélection du départ" de l'app mobile.
 */
const listDeparts = catchAsync(async (req, res) => {
  const agenceImposee = agenceIdImpose(req);
  const where = { companyId: req.params.companyId };
  where.agenceDepartId = agenceImposee || req.query.agenceId;
  if (!where.agenceDepartId) throw ApiError.badRequest('Gare de départ requise.');
  // Date du jour par défaut — même convention que le reste de l'API (pas de
  // fuseau horaire dédié géré ici, voir Company.fuseauHoraire pour l'usage
  // purement informatif côté affichage).
  where.date = req.query.date || new Date().toISOString().slice(0, 10);

  const trips = await Trip.findAll({ where, include: INCLUDE_TRIP, order: [['heureDepart', 'ASC']] });

  const departs = await Promise.all(
    trips.map(async (trip) => {
      const { attendus, embarques } = await compterEmbarquement(trip.id);
      return {
        id: trip.id,
        date: trip.date,
        heureDepart: trip.heureDepart,
        statutTrip: trip.statut,
        villeArrivee: trip.ligne?.villeArrivee || null,
        agenceArrivee: trip.ligne?.agenceArrivee
          ? { nom: trip.ligne.agenceArrivee.nom, ville: trip.ligne.agenceArrivee.ville }
          : null,
        busImmatriculation: trip.bus?.immatriculation || null,
        nombrePassagersAttendus: attendus,
        nombreDejaEmbarques: embarques,
        embarquementClotureAt: trip.embarquementClotureAt,
      };
    })
  );

  res.json({ agenceId: where.agenceDepartId, date: where.date, departs });
});

/**
 * GET /companies/:companyId/trips/:id/manifeste-embarquement — le cœur du
 * mode hors ligne : tout ce dont l'app a besoin pour contrôler CE trajet
 * sans aucun appel réseau supplémentaire (voir en-tête de fichier).
 */
const manifeste = catchAsync(async (req, res) => {
  const trip = await trouverTripAutorise(req);

  const [reservations, ventes, embarquesReussis] = await Promise.all([
    Reservation.findAll({ where: { tripId: trip.id, statut: 'confirmee' } }),
    Vente.findAll({ where: { tripId: trip.id, annulee: false } }),
    Embarquement.findAll({ where: { tripId: trip.id, statut: 'embarque' } }),
  ]);

  // Référence -> date du premier embarquement réussi (une référence ne peut
  // apparaître qu'une fois dans cet ensemble, voir la contrainte applicative
  // dans `creerEmbarquement` ci-dessous).
  const embarqueParReference = new Map(embarquesReussis.map((e) => [e.reference, e.scanneAt]));

  const passagers = [
    ...reservations.map((r) => ({
      ticketId: r.id,
      ticketType: 'reservation',
      reference: r.reference,
      nomVoyageur: r.nomVoyageur,
      telephoneVoyageur: r.telephoneVoyageur,
      classe: r.classe,
      nombrePlaces: 1,
      typeBillet: r.typeBillet,
      groupeReference: r.groupeReference,
      statutEmbarquement: embarqueParReference.has(r.reference) ? 'embarque' : 'attendu',
      embarqueAt: embarqueParReference.get(r.reference) || null,
    })),
    ...ventes.map((v) => ({
      ticketId: v.id,
      ticketType: 'vente',
      reference: v.reference,
      nomVoyageur: v.nomVoyageur,
      telephoneVoyageur: v.telephoneVoyageur,
      classe: v.classe,
      nombrePlaces: v.nombrePlaces,
      typeBillet: v.typeBillet,
      groupeReference: null,
      statutEmbarquement: embarqueParReference.has(v.reference) ? 'embarque' : 'attendu',
      embarqueAt: embarqueParReference.get(v.reference) || null,
    })),
  ];

  res.json({
    trip: {
      id: trip.id,
      date: trip.date,
      heureDepart: trip.heureDepart,
      villeDepart: trip.agenceDepart?.ville || null,
      agenceDepart: trip.agenceDepart ? { nom: trip.agenceDepart.nom, ville: trip.agenceDepart.ville } : null,
      villeArrivee: trip.ligne?.villeArrivee || null,
      agenceArrivee: trip.ligne?.agenceArrivee
        ? { nom: trip.ligne.agenceArrivee.nom, ville: trip.ligne.agenceArrivee.ville }
        : null,
      busImmatriculation: trip.bus?.immatriculation || null,
      embarquementClotureAt: trip.embarquementClotureAt,
    },
    passagers,
    genereAt: new Date().toISOString(),
  });
});

/**
 * Retrouve un billet par référence (Reservation OU Vente selon
 * `ticketType`, ou les deux si non précisé) et détermine le statut d'une
 * tentative d'embarquement — logique partagée par `creerEmbarquement` et
 * `syncEmbarquements`. Ne persiste rien elle-même.
 */
async function evaluerTentative({ trip, ticketType, reference }) {
  let ticket = null;
  let type = ticketType;

  if (type !== 'vente') {
    ticket = await Reservation.findOne({ where: { companyId: trip.companyId, reference } });
    if (ticket) type = 'reservation';
  }
  if (!ticket && type !== 'reservation') {
    ticket = await Vente.findOne({ where: { companyId: trip.companyId, reference } });
    if (ticket) type = 'vente';
  }

  if (!ticket) return { statut: 'invalide', message: 'Billet introuvable.', ticket: null, type: ticketType || null };
  if (ticket.tripId !== trip.id) return { statut: 'mauvais_voyage', message: 'Ce billet n\'est pas pour ce départ.', ticket, type };

  const annule = type === 'reservation' ? ticket.statut !== 'confirmee' : ticket.annulee;
  if (annule) return { statut: 'annule', message: 'Billet annulé.', ticket, type };

  const dejaEmbarque = await Embarquement.findOne({ where: { tripId: trip.id, reference, statut: 'embarque' } });
  if (dejaEmbarque) {
    return { statut: 'deja_embarque', message: 'Billet déjà utilisé.', ticket, type, embarqueAt: dejaEmbarque.scanneAt };
  }

  return { statut: 'embarque', message: 'Billet valide.', ticket, type };
}

/** Construit la ligne de réponse "passager" (affichage écran de scan) à partir du billet résolu. */
function passagerAffiche(ticket, type) {
  if (!ticket) return null;
  return {
    nomVoyageur: ticket.nomVoyageur,
    classe: ticket.classe,
    typeBillet: ticket.typeBillet,
    groupeReference: type === 'reservation' ? ticket.groupeReference : null,
  };
}

/**
 * Enregistre UNE tentative (scan ou validation manuelle) — toujours une
 * nouvelle ligne dans le journal `embarquements` (y compris les échecs, pour
 * l'historique "signalés" côté agent), sauf en cas de rejeu du même
 * `idLocal` (voir idempotence ci-dessous).
 */
async function traiterTentative({ trip, agentControleId, item }) {
  const { idLocal, ticketType, reference, source } = item;
  if (!idLocal || !reference) {
    throw ApiError.badRequest('idLocal et reference sont requis pour enregistrer un embarquement.');
  }

  // Rejeu idempotent (mode offline) — voir vente.controller.js#create pour
  // le raisonnement complet : si ce téléphone a déjà envoyé cette tentative
  // avec succès, on renvoie l'enregistrement existant plutôt que d'en créer
  // un doublon.
  const existant = await Embarquement.findOne({ where: { tripId: trip.id, idLocal } });
  if (existant) return { embarquement: existant, rejoue: true };

  const resultat = await evaluerTentative({ trip, ticketType, reference });
  const embarquement = await Embarquement.create({
    companyId: trip.companyId,
    tripId: trip.id,
    agentControleId,
    idLocal,
    ticketType: resultat.type || ticketType || 'reservation',
    ticketId: resultat.ticket?.id || null,
    reference,
    groupeReference: resultat.type === 'reservation' ? resultat.ticket?.groupeReference || null : null,
    statut: resultat.statut,
    source: source === 'manuel' ? 'manuel' : 'scan',
    scanneAt: item.scanneAt || new Date(),
  });

  return { embarquement, resultat, rejoue: false };
}

/**
 * `agentControleId` n'est renseigné que quand l'auteur est RÉELLEMENT un
 * agent de contrôle (`AgentControle.id`) — ces routes restent aussi
 * accessibles à un admin/guichetier de la compagnie (voir
 * `canOperateEmbarquement`), dont l'identifiant de compte ne correspond à
 * aucune ligne `agents_controle` (la colonne est nullable exprès, voir
 * models/embarquement.model.js).
 */
function agentControleIdAuteur(req) {
  return req.auth.espace === ESPACES.CONTROLE ? req.auth.sub : null;
}

/** POST /companies/:companyId/trips/:id/embarquements — un seul scan/validation manuelle. */
const creerEmbarquement = catchAsync(async (req, res) => {
  const trip = await trouverTripAutorise(req);
  const { embarquement, resultat, rejoue } = await traiterTentative({
    trip,
    agentControleId: agentControleIdAuteur(req),
    item: req.body,
  });

  if (rejoue) {
    res.status(200).json({ statut: embarquement.statut, embarquement, rejoue: true });
    return;
  }

  res.status(201).json({
    statut: embarquement.statut,
    message: resultat.message,
    embarquement,
    passager: passagerAffiche(resultat.ticket, resultat.type),
  });
});

/**
 * POST /companies/:companyId/trips/:id/embarquements/sync — vide en un seul
 * aller-retour la file d'attente locale accumulée hors ligne (voir
 * `ScansEnAttente` dans le document de conception de l'app) — corps
 * `{ items: [{ idLocal, ticketType, reference, source, scanneAt }, ...] }`,
 * traité dans l'ordre reçu (l'app envoie déjà sa file dans l'ordre
 * d'insertion).
 */
const syncEmbarquements = catchAsync(async (req, res) => {
  const trip = await trouverTripAutorise(req);
  const items = Array.isArray(req.body.items) ? req.body.items : [];

  const resultats = [];
  for (const item of items) {
    try {
      const { embarquement, resultat, rejoue } = await traiterTentative({
        trip,
        agentControleId: agentControleIdAuteur(req),
        item,
      });
      resultats.push({
        idLocal: item.idLocal,
        statut: embarquement.statut,
        message: resultat?.message || null,
        rejoue: Boolean(rejoue),
      });
    } catch (err) {
      resultats.push({ idLocal: item.idLocal, statut: 'erreur', message: err.message || 'Échec de synchronisation.' });
    }
  }

  res.json({ resultats });
});

/** GET /companies/:companyId/trips/:id/embarquements — journal complet d'un trajet (audit/rafraîchissement). */
const listEmbarquements = catchAsync(async (req, res) => {
  const trip = await trouverTripAutorise(req);
  const embarquements = await Embarquement.findAll({
    where: { tripId: trip.id },
    include: [{ model: AgentControle, as: 'agentControle', attributes: ['id', 'nom'] }],
    order: [['scanneAt', 'DESC']],
  });
  res.json(embarquements);
});

/**
 * POST /companies/:companyId/trips/:id/cloturer-embarquement — naturellement
 * idempotent (on vérifie l'état déjà clôturé plutôt que de s'appuyer sur un
 * `idLocal` dédié : il n'y a qu'UNE clôture possible par trajet, inutile
 * d'introduire une colonne supplémentaire pour ça).
 */
const cloturer = catchAsync(async (req, res) => {
  const trip = await trouverTripAutorise(req);

  if (!trip.embarquementClotureAt) {
    await trip.update({
      embarquementClotureAt: req.body.clotureAt || new Date(),
      // Uniquement attribuable à un agent de contrôle réel (contrainte de
      // clé étrangère vers `agents_controle`) — une clôture faite par un
      // admin/guichetier reste enregistrée (date renseignée) mais sans
      // auteur agent précis.
      embarquementCloturePar: agentControleIdAuteur(req),
    });
    await enregistrerAudit({
      action: 'Clôture d\'embarquement',
      details: `Trajet du ${trip.date} ${trip.heureDepart} clôturé.`,
      companyId: req.params.companyId,
      auteur: req.auth,
    });
  }

  const { attendus, embarques } = await compterEmbarquement(trip.id);
  res.json({
    tripId: trip.id,
    embarquementClotureAt: trip.embarquementClotureAt,
    nombrePassagersAttendus: attendus,
    nombreDejaEmbarques: embarques,
  });
});

module.exports = { listDeparts, manifeste, creerEmbarquement, syncEmbarquements, listEmbarquements, cloturer };
