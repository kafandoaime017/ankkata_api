// Ventes au guichet — création, annulation, vérification de colis. Chaque
// vente réussie incrémente les totaux de la session de caisse ouverte de
// l'agent (voir cashSession.controller.js pour la logique de caisse).
const { sequelize, Vente, Client, Trip, Guichetier, CashSession } = require('../models');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const { enregistrerAudit } = require('../services/audit.service');
const { generateDatedReference, genererReferenceTicket } = require('../utils/idGenerator');
const { resolvePoste } = require('../services/poste.service');
const { verifierEtVerrouillerQuota } = require('../services/quota.service');
const { buildSearchWhere, getPagination, buildPaginatedResponse } = require('./helpers');

/**
 * Référence de vente : si le poste vendeur est identifié (machineId envoyé
 * par le logiciel guichet), séquentielle par poste (voir
 * idGenerator.js#genererReferenceTicket) — un trou dans la séquence d'un
 * poste devient un signal de fraude/perte détectable. Sinon (vente créée
 * sans machineId, ex. depuis ankkata_admin), on retombe sur l'ancienne
 * référence datée + suffixe aléatoire.
 */
async function construireReference({ companyId, machineId }) {
  if (!machineId) return generateDatedReference('TCK');

  const poste = await resolvePoste({ companyId, machineId });
  // `increment` exécute un `UPDATE ... SET dernier_numero_ticket =
  // dernier_numero_ticket + 1` atomique côté base — jamais un
  // lu-puis-réécrit côté appli, qui perdrait des incréments sous
  // concurrence. `reload()` ensuite pour être certain de lire la valeur
  // réellement écrite (comportement de `increment` variable selon les
  // versions de Sequelize).
  await poste.increment('dernierNumeroTicket');
  await poste.reload();
  return genererReferenceTicket({ codePoste: poste.code, numero: poste.dernierNumeroTicket });
}

const INCLUDE = [
  { model: Client, as: 'client' },
  { model: Trip, as: 'trip' },
  { model: Guichetier, as: 'guichetier' },
];

// Même include + la jambe liée (aller <-> retour), sur un seul niveau —
// utilisé uniquement là où on a besoin d'afficher/imprimer les deux jambes
// d'un billet aller-retour ensemble (voir `createAllerRetour` ci-dessous).
const INCLUDE_AVEC_LIEE = [...INCLUDE, { model: Vente, as: 'venteLiee', include: INCLUDE }];

/** Incrémente la session de caisse ouverte du guichetier pour UNE vente. */
async function incrementerCaisse({ vente, transaction }) {
  const session = await CashSession.findOne({
    where: { companyId: vente.companyId, guichetierId: vente.guichetierId, ouverte: true },
    transaction,
  });
  if (!session) return;
  const montant = vente.nombrePlaces * vente.prixUnitaire;
  const champEspeces = vente.moyenPaiement === 'Espèces' ? 'totalVentesEspeces' : 'totalVentesMobileMoney';
  await session.update(
    {
      [champEspeces]: session[champEspeces] + montant,
      nombreBilletsVendus: session.nombreBilletsVendus + vente.nombrePlaces,
    },
    { transaction }
  );
}

const list = catchAsync(async (req, res) => {
  const where = { companyId: req.params.companyId, ...buildSearchWhere(req.query, ['nomVoyageur', 'telephoneVoyageur', 'reference']) };
  if (req.query.agenceId) where.agenceId = req.query.agenceId;
  if (req.query.guichetierId) where.guichetierId = req.query.guichetierId;
  if (req.query.annulee !== undefined) where.annulee = req.query.annulee === 'true';

  const { page, limit, offset } = getPagination(req.query);
  const result = await Vente.findAndCountAll({
    where,
    limit,
    offset,
    order: [['heureVente', 'DESC']],
    include: INCLUDE,
    distinct: true,
  });
  res.json(buildPaginatedResponse(result, { page, limit }));
});

const getOne = catchAsync(async (req, res) => {
  // `INCLUDE_AVEC_LIEE` (et pas seulement `INCLUDE`) : l'écran de détail
  // billet (ankata_guichet) a besoin de connaître l'autre jambe d'un billet
  // aller-retour pour l'afficher/l'imprimer ensemble et proposer de
  // l'annuler aussi si besoin.
  const vente = await Vente.findOne({ where: { id: req.params.id, companyId: req.params.companyId }, include: INCLUDE_AVEC_LIEE });
  if (!vente) throw ApiError.notFound('Vente introuvable.');
  res.json(vente);
});

const create = catchAsync(async (req, res) => {
  // `machineId` : envoyé par le logiciel guichet pour identifier le poste
  // vendeur (voir ankata_guichet/lib/core/utils/machine_id.dart) — ne fait
  // pas partie du modèle Vente, on l'exclut du payload persisté.
  const { machineId, machine_id: machineIdSnake, idLocal, id_local: idLocalSnake, ...donneesVente } = req.body;
  const machineIdFinal = (machineId || machineIdSnake || '').trim();
  const idLocalFinal = idLocal || idLocalSnake || null;

  // Rejeu idempotent (mode offline guichet) : si ce poste a déjà envoyé
  // cette vente avec succès lors d'une tentative précédente (ex. la requête
  // avait abouti côté serveur mais la coupure réseau a empêché la réponse
  // d'arriver au client, qui la retente donc au cycle de synchro suivant),
  // on renvoie l'enregistrement déjà créé au lieu d'en créer un doublon —
  // voir ankata_guichet/lib/core/services/vente_sync_session.dart.
  if (idLocalFinal) {
    const existante = await Vente.findOne({ where: { companyId: req.params.companyId, idLocal: idLocalFinal }, include: INCLUDE });
    if (existante) {
      res.status(200).json(existante);
      return;
    }
  }

  const reference = donneesVente.reference || (await construireReference({
    companyId: req.params.companyId,
    machineId: machineIdFinal,
  }));

  // Vérification de quota + création de la vente dans UNE MÊME transaction :
  // voir `quota.service.js` — le verrou posé sur le trajet le temps de cette
  // transaction est ce qui empêche deux ventes concurrentes (dont une
  // rejouée depuis le mode hors ligne) de survendre le même trajet.
  const vente = await sequelize.transaction(async (transaction) => {
    await verifierEtVerrouillerQuota({
      transaction,
      tripId: donneesVente.tripId,
      placesDemandees: donneesVente.nombrePlaces || 1,
      canal: 'guichet',
    });

    const nouvelleVente = await Vente.create(
      {
        ...donneesVente,
        reference,
        idLocal: idLocalFinal,
        companyId: req.params.companyId,
      },
      { transaction }
    );

    await incrementerCaisse({ vente: nouvelleVente, transaction });

    return nouvelleVente;
  });

  await enregistrerAudit({
    action: 'Vente de billet',
    details: `Vente ${vente.reference} — ${vente.nomVoyageur} (${vente.nombrePlaces * vente.prixUnitaire} FCFA).`,
    companyId: req.params.companyId,
    auteur: req.auth,
  });
  res.status(201).json(vente);
});

/**
 * POST /companies/:companyId/ventes/aller-retour — vend un billet
 * aller-retour EN UNE SEULE OPÉRATION : deux `Vente` (une par trajet, donc
 * un quota vérifié pour chacune — voir `quota.service.js`), créées dans la
 * MÊME transaction et reliées entre elles via `venteLieeId`, pour ne jamais
 * se retrouver avec une seule des deux jambes vendue (ex. l'aller accepté
 * mais le retour refusé faute de place, ce qui laisserait le voyageur avec
 * un billet incohérent et la caisse à moitié à jour). Si l'un des deux
 * trajets est complet, TOUTE la vente est annulée (rollback de la
 * transaction) — le guichetier doit recommencer, éventuellement avec un
 * autre horaire retour.
 */
const createAllerRetour = catchAsync(async (req, res) => {
  const {
    machineId,
    machine_id: machineIdSnake,
    idLocal,
    id_local: idLocalSnake,
    tripIdAller,
    prixUnitaireAller,
    dateVoyageAller,
    tripIdRetour,
    prixUnitaireRetour,
    dateVoyageRetour,
    reference,
    ...communs
  } = req.body;
  const machineIdFinal = (machineId || machineIdSnake || '').trim();
  const idLocalFinal = idLocal || idLocalSnake || null;

  if (!tripIdAller || !tripIdRetour) {
    throw ApiError.badRequest('Un billet aller-retour nécessite un trajet aller et un trajet retour.');
  }
  if (tripIdAller === tripIdRetour) {
    throw ApiError.badRequest('Le trajet retour doit être différent du trajet aller.');
  }
  if (!prixUnitaireAller || !prixUnitaireRetour) {
    throw ApiError.badRequest('Le tarif aller et le tarif retour sont tous les deux requis.');
  }
  if (!dateVoyageAller || !dateVoyageRetour) {
    throw ApiError.badRequest('La date de voyage aller et la date de voyage retour sont toutes les deux requises.');
  }

  // Rejeu idempotent (mode offline guichet) — voir `create` ci-dessus pour
  // le raisonnement complet. L'`idLocal` n'est stocké que sur la jambe
  // aller ; la jambe retour se retrouve via `venteLiee`.
  if (idLocalFinal) {
    const existante = await Vente.findOne({
      where: { companyId: req.params.companyId, idLocal: idLocalFinal },
      include: INCLUDE_AVEC_LIEE,
    });
    if (existante) {
      res.status(200).json({ venteAller: existante, venteRetour: existante.venteLiee || null });
      return;
    }
  }

  const referenceAller = reference || (await construireReference({ companyId: req.params.companyId, machineId: machineIdFinal }));
  const referenceRetour = await construireReference({ companyId: req.params.companyId, machineId: machineIdFinal });

  const { venteAller, venteRetour } = await sequelize.transaction(async (transaction) => {
    // Les DEUX trajets sont vérifiés/verrouillés dans la même transaction :
    // si le retour est complet, l'aller déjà créé plus haut est annulé par
    // le rollback automatique de la transaction (rien n'est jamais persisté
    // à moitié).
    await verifierEtVerrouillerQuota({ transaction, tripId: tripIdAller, placesDemandees: communs.nombrePlaces || 1, canal: 'guichet' });
    await verifierEtVerrouillerQuota({ transaction, tripId: tripIdRetour, placesDemandees: communs.nombrePlaces || 1, canal: 'guichet' });

    const nouvelleVenteAller = await Vente.create(
      {
        ...communs,
        tripId: tripIdAller,
        prixUnitaire: prixUnitaireAller,
        dateVoyage: dateVoyageAller,
        reference: referenceAller,
        idLocal: idLocalFinal,
        typeBillet: 'aller_retour',
        companyId: req.params.companyId,
      },
      { transaction }
    );

    const nouvelleVenteRetour = await Vente.create(
      {
        ...communs,
        tripId: tripIdRetour,
        prixUnitaire: prixUnitaireRetour,
        dateVoyage: dateVoyageRetour,
        reference: referenceRetour,
        idLocal: null,
        typeBillet: 'aller_retour',
        companyId: req.params.companyId,
        venteLieeId: nouvelleVenteAller.id,
        // Colis/montant reçu ne concernent que l'achat global — déjà portés
        // par la jambe aller, pour ne pas les compter/afficher deux fois.
        aDesColis: false,
        colisDescription: null,
        colisPoidsKg: null,
        montantRecu: null,
      },
      { transaction }
    );

    await nouvelleVenteAller.update({ venteLieeId: nouvelleVenteRetour.id }, { transaction });

    await incrementerCaisse({ vente: nouvelleVenteAller, transaction });
    await incrementerCaisse({ vente: nouvelleVenteRetour, transaction });

    return { venteAller: nouvelleVenteAller, venteRetour: nouvelleVenteRetour };
  });

  const montantTotal = venteAller.nombrePlaces * venteAller.prixUnitaire + venteRetour.nombrePlaces * venteRetour.prixUnitaire;
  await enregistrerAudit({
    action: 'Vente de billet aller-retour',
    details: `Billet aller-retour ${venteAller.reference} / ${venteRetour.reference} — ${venteAller.nomVoyageur} (${montantTotal} FCFA).`,
    companyId: req.params.companyId,
    auteur: req.auth,
  });

  const [allerComplet, retourComplet] = await Promise.all([
    Vente.findByPk(venteAller.id, { include: INCLUDE_AVEC_LIEE }),
    Vente.findByPk(venteRetour.id, { include: INCLUDE_AVEC_LIEE }),
  ]);
  res.status(201).json({ venteAller: allerComplet, venteRetour: retourComplet });
});

const cancel = catchAsync(async (req, res) => {
  const vente = await Vente.findOne({ where: { id: req.params.id, companyId: req.params.companyId } });
  if (!vente) throw ApiError.notFound('Vente introuvable.');
  if (vente.annulee) throw ApiError.conflict('Cette vente est déjà annulée.');

  await vente.update({ annulee: true, motifAnnulation: req.body.motif || null });
  await enregistrerAudit({
    action: 'Annulation de vente',
    details: `Vente ${vente.reference} annulée${req.body.motif ? ` (${req.body.motif})` : ''}.`,
    companyId: req.params.companyId,
    auteur: req.auth,
  });
  res.json(vente);
});

const verifyColis = catchAsync(async (req, res) => {
  const vente = await Vente.findOne({ where: { id: req.params.id, companyId: req.params.companyId } });
  if (!vente) throw ApiError.notFound('Vente introuvable.');
  if (!vente.aDesColis) throw ApiError.badRequest('Cette vente ne comporte pas de colis.');

  await vente.update({ colisVerifie: true });
  res.json(vente);
});

module.exports = { list, getOne, create, createAllerRetour, cancel, verifyColis };
