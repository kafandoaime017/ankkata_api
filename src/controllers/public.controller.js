// Surface PUBLIQUE (aucune authentification) utilisée par l'app Voyageur
// (ankkata_frontend, Next.js) — recherche de trajets et création de
// réservations par un internaute anonyme, tous compagnies confondues.
//
// Contrairement au reste de l'API (toujours scopé à UNE compagnie via
// `:companyId` + un JWT ankkata/admin/guichetier, voir auth.middleware.js),
// ces routes n'exposent QUE des champs sûrs (jamais de données financières
// internes, de comptes, d'identifiants) et ne permettent QUE deux actions :
// chercher un trajet, réserver une place dessus — exactement ce qu'un
// voyageur anonyme doit pouvoir faire sur un site de réservation classique.
//
// Toute compagnie non "active"/"essai" (suspendue ou archivée — voir
// services/abonnement.service.js) est invisible ici : on ne propose jamais
// de réserver chez une compagnie dont l'abonnement Ankkata est coupé.
//
// IMPORTANT — recherche basée sur la LIGNE (horaire récurrent), pas sur le
// `Trip` : un `Trip` n'est aujourd'hui matérialisé en base que lorsqu'un
// guichetier clique sur "Générer les trajets du jour" (voir
// trip.controller.js#generateForDate). Si la recherche publique ne portait
// que sur les `Trip` déjà existants, un voyageur ne verrait JAMAIS aucun
// résultat pour une compagnie qui n'a pas encore généré ses trajets pour la
// date demandée — alors même que la ligne, ses horaires et ses tarifs
// existent bel et bien. On recherche donc les `Ligne` actives dont un
// horaire correspond, et on ne consulte le `Trip` réel (s'il existe) que
// pour connaître son statut et sa disponibilité réelle ; s'il n'existe pas
// encore, on considère le trajet "prévu" avec la capacité pleine de la
// ligne. Il n'est matérialisé en base (`Trip.findOrCreate`) qu'au moment
// où une réservation est réellement posée dessus (voir `createReservation`
// ci-dessous) — jamais avant, pour ne pas créer des milliers de trajets
// vides à chaque recherche.
const { Op } = require('sequelize');
const { sequelize, Company, Agence, Ligne, LigneTarif, LigneHoraire, LigneArret, Trip, Client, Reservation, Vente, CompteVoyageur } = require('../models');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const { enregistrerAudit } = require('../services/audit.service');
const { generateDatedReference } = require('../utils/idGenerator');
const { verifierEtVerrouillerQuota } = require('../services/quota.service');
const { MOYEN_PAIEMENT_VOYAGEUR, MIN_PASSAGERS_RESERVATION, MAX_PASSAGERS_RESERVATION } = require('../constants/enums');
const { ESPACES } = require('../constants/roles');
const { envoyerConfirmationReservation } = require('../services/notification');
const { genererBilletPdf, genererQrDataUrl } = require('../services/billet.service');
const env = require('../config/env');

const COMPAGNIES_VISIBLES = ['active', 'essai'];

/**
 * Préfixe de l'identifiant "virtuel" d'un trajet dont le `Trip` n'a pas
 * encore été matérialisé en base — voir doc de tête. Séparateur "." choisi
 * délibérément : ni un UUID (tirets), ni une date YYYY-MM-DD (tirets), ni
 * une heure HH:mm (deux-points) ne peuvent en contenir, donc aucune
 * ambiguïté de découpage — et un point reste un caractère d'URL sûr,
 * contrairement à d'autres séparateurs qui auraient pu nécessiter un
 * encodage selon les proxys/CDN.
 */
const PREFIXE_VIRTUEL = 'virtuel';

function idVirtuel(ligneId, date, heureDepart) {
  return `${PREFIXE_VIRTUEL}.${ligneId}.${date}.${heureDepart}`;
}

function parseIdVirtuel(id) {
  if (typeof id !== 'string' || !id.startsWith(`${PREFIXE_VIRTUEL}.`)) return null;
  const [, ligneId, date, heureDepart] = id.split('.');
  if (!ligneId || !date || !heureDepart) return null;
  return { ligneId, date, heureDepart };
}

const INCLUDE_LIGNE_PUBLIC = [
  { model: LigneTarif, as: 'tarifs' },
  { model: Agence, as: 'agenceDepart', required: true, where: { active: true } },
  // required: false — `agenceArriveeId` reste optionnel sur `Ligne` (lignes
  // historiques créées avant la migration `add-agence-arrivee-id-to-lignes`,
  // voir ligne.model.js) : on ne veut jamais exclure un trajet de la
  // recherche simplement parce que sa gare d'arrivée n'a pas encore été
  // renseignée côté admin.
  { model: Agence, as: 'agenceArrivee', required: false },
  { model: Company, as: 'company', required: true, where: { statut: { [Op.in]: COMPAGNIES_VISIBLES } } },
  // Arrêts intermédiaires ordonnés — utilisés pour la frise "itinéraire" du
  // détail trajet (voir app/trajets/[id]), purement informatif côté public.
  { model: LigneArret, as: 'arrets', separate: true, order: [['ordre', 'ASC']] },
];

/** DTO gare public — nom + coordonnées (peuvent être `null`, une agence n'est
 * pas toujours géolocalisée côté admin) pour construire un lien "itinéraire"
 * vers Google Maps côté frontend, sans jamais exposer l'id/l'agence complète. */
function dtoAgencePublique(agence) {
  if (!agence) return null;
  return {
    nom: agence.nom,
    ville: agence.ville,
    latitude: agence.latitude !== null && agence.latitude !== undefined ? Number(agence.latitude) : null,
    longitude: agence.longitude !== null && agence.longitude !== undefined ? Number(agence.longitude) : null,
  };
}

/**
 * Disponibilité d'un `Trip` RÉELLEMENT matérialisé — même calcul que
 * `quota.service.js#verifierEtVerrouillerQuota`, mais en LECTURE SEULE (pas
 * de transaction/verrou : disponibilité indicative pendant la recherche, le
 * contrôle qui fait foi reste celui posé au moment de la réservation
 * elle-même).
 *
 * Renvoie deux nombres distincts car une compagnie peut réserver un
 * sous-quota de places à la réservation EN LIGNE (`ligne.quotaEnLigne`, voir
 * migration `add-quotas-canal-to-lignes`) : `placesRestantes` reste le
 * plafond global (tous canaux confondus, comme avant ce champ),
 * `placesRestantesEnLigne` est ce qu'il reste RÉELLEMENT réservable par un
 * voyageur sur le site — jamais plus que `placesRestantes` (le plafond
 * global prime toujours), et borné par `quotaEnLigne` si la compagnie en a
 * défini un.
 *
 * `tripReel.quotaEnLigneOverride` (voir migration
 * `add-quota-overrides-to-trips`), quand renseigné, prime sur
 * `ligne.quotaEnLigne` pour CE trajet daté précisément — c'est ce qui permet
 * de fermer/limiter la réservation en ligne d'UN SEUL départ sans changer le
 * réglage par défaut de la ligne pour tous les autres jours.
 */
async function disponibiliteTripReel(tripReel, ligne) {
  if (!ligne.capaciteTotale) return { placesRestantes: null, placesRestantesEnLigne: null };
  const tripId = tripReel.id;

  const [ventesOccupees, reservationsOccupees, reservationsEnLigneOccupees] = await Promise.all([
    Vente.sum('nombrePlaces', { where: { tripId, annulee: false } }),
    Reservation.count({ where: { tripId, statut: 'confirmee' } }),
    Reservation.count({ where: { tripId, statut: 'confirmee', canal: 'en_ligne' } }),
  ]);

  const occupees = (ventesOccupees || 0) + (reservationsOccupees || 0);
  const placesRestantes = Math.max(ligne.capaciteTotale - occupees, 0);
  const quotaEnLigneEffectif = tripReel.quotaEnLigneOverride ?? ligne.quotaEnLigne;
  const placesRestantesEnLigne =
    quotaEnLigneEffectif != null
      ? Math.max(quotaEnLigneEffectif - (reservationsEnLigneOccupees || 0), 0)
      : placesRestantes;

  return { placesRestantes, placesRestantesEnLigne: Math.min(placesRestantesEnLigne, placesRestantes) };
}

/**
 * Corrige un artefact de double encodage parfois présent sur `heureDepart`
 * (ex. "23%3A00" affiché tel quel au lieu de "23:00" — observé sur des
 * lignes historiques, très probablement une valeur déjà percent-encodée au
 * moment de sa saisie/import dans `ligne_horaires`). Ne touche jamais une
 * valeur propre ; ne lève jamais (une valeur invalide ressort inchangée).
 */
function corrigerEncodageEventuel(valeur) {
  if (typeof valeur !== 'string' || !valeur.includes('%')) return valeur;
  try {
    return decodeURIComponent(valeur);
  } catch {
    return valeur;
  }
}

/**
 * Construit le DTO public d'un créneau (ligne + horaire + date), qu'un
 * `Trip` existe déjà pour ce créneau ou non.
 * @param {object} ligne - Ligne Sequelize avec tarifs/agenceDepart/company chargés
 * @param {string} date
 * @param {string} heureDepart
 * @param {object|null} tripReel - `Trip` déjà en base pour ce créneau, si trouvé
 */
async function construireResultat(ligne, date, heureDepartBrut, tripReel) {
  // Corrigé une seule fois ici, avant de servir à construire l'id virtuel ET
  // le champ de sortie — les deux restent ainsi cohérents entre eux.
  const heureDepart = corrigerEncodageEventuel(heureDepartBrut);

  let placesRestantes;
  let placesRestantesEnLigne;
  if (tripReel) {
    ({ placesRestantes, placesRestantesEnLigne } = await disponibiliteTripReel(tripReel, ligne));
  } else {
    // Aucun `Trip` matérialisé : personne n'a encore rien vendu/réservé sur
    // ce créneau, la disponibilité vaut donc la capacité pleine de la ligne
    // (bornée par le sous-quota en ligne s'il y en a un).
    placesRestantes = ligne.capaciteTotale ?? null;
    placesRestantesEnLigne =
      ligne.quotaEnLigne != null ? Math.min(ligne.quotaEnLigne, ligne.capaciteTotale ?? ligne.quotaEnLigne) : placesRestantes;
  }

  // "Complet" ici veut dire "un voyageur ne peut plus réserver ce trajet EN
  // LIGNE" — soit parce que le trajet entier est plein (tous canaux
  // confondus), soit parce que le sous-quota en ligne spécifiquement est
  // épuisé (même si le guichet, lui, peut encore vendre des places : voir
  // `quotaGuichet`/`quotaEnLigne` sur `Ligne`). Cet endpoint n'étant utilisé
  // QUE par le site Voyageur (jamais par le guichet), cette sémantique est
  // celle qui a du sens ici.
  const complet =
    tripReel?.statut === 'complet' ||
    (placesRestantes !== null && placesRestantes <= 0) ||
    (placesRestantesEnLigne !== null && placesRestantesEnLigne <= 0);

  return {
    id: tripReel ? tripReel.id : idVirtuel(ligne.id, date, heureDepart),
    companyId: ligne.companyId,
    compagnie: {
      nom: ligne.company.nom,
      logoPath: ligne.company.logoPath,
      couleurPrimaire: ligne.company.couleurPrimaire,
      couleurSecondaire: ligne.company.couleurSecondaire,
      devise: ligne.company.devise,
    },
    ligneId: ligne.id,
    villeDepart: ligne.agenceDepart.ville,
    // Objet (nom + coordonnées) plutôt qu'une simple chaîne — voir
    // dtoAgencePublique ci-dessus : permet au frontend de proposer un lien
    // "itinéraire vers la gare" (Google Maps) quand l'agence est
    // géolocalisée. `agenceArrivee` peut être `null` (agence pas encore
    // renseignée côté admin pour cette ligne) — `villeArrivee` (string,
    // ci-dessous) reste alors la seule info fiable côté arrivée.
    agenceDepart: dtoAgencePublique(ligne.agenceDepart),
    agenceArrivee: dtoAgencePublique(ligne.agenceArrivee),
    villeArrivee: ligne.villeArrivee,
    date,
    heureDepart,
    dureeEstimeeMinutes: ligne.dureeEstimeeMinutes,
    statut: tripReel ? tripReel.statut : 'prevu',
    tarifs: ligne.tarifs.map((t) => ({ classe: t.classe, prix: t.prix })),
    placesRestantes,
    placesRestantesEnLigne,
    complet,
    // Arrêts intermédiaires ordonnés (frise "itinéraire" du détail trajet) —
    // tableau vide si la ligne est directe, jamais `null`.
    arrets: (ligne.arrets || []).map((a) => ({ ville: a.ville, ordre: a.ordre })),
    // Services/équipements inclus (climatisation, wifi, repas...) — codes
    // bruts tirés de EQUIPEMENTS_LIGNE ; le libellé + l'icône à afficher sont
    // résolus côté client (voir ankkata_frontend/lib/equipements.ts).
    equipements: ligne.equipements || [],
    // Teaser affiché côté résultats/détail ("Économisez X % en aller-retour")
    // — non `null` UNIQUEMENT si cette ligne appartient à une paire
    // réversible (voir `Ligne.ligneRetourId`) ET que la compagnie a bien
    // configuré une réduction dessus (voir migration
    // `add-reduction-aller-retour-to-lignes`). La réduction réelle n'est
    // calculée qu'au moment de `createReservationAllerRetour`, jamais ici.
    reductionAllerRetourPourcentage: ligne.ligneRetourId && ligne.reductionAllerRetourPourcentage > 0 ? ligne.reductionAllerRetourPourcentage : null,
  };
}

/**
 * GET /public/villes — villes de départ (agences actives) et d'arrivée
 * (lignes actives), toutes compagnies visibles confondues, pour peupler les
 * deux sélecteurs du formulaire de recherche.
 */
const listVilles = catchAsync(async (req, res) => {
  // Dédoublonnage fait côté Node plutôt qu'un `GROUP BY` SQL combiné à un
  // `include` — ce dernier est fragile ici (l'alias de table généré par
  // Sequelize pour le modèle racine peut varier), alors que le volume de
  // lignes/agences d'une plateforme de bus reste minuscule (quelques
  // centaines tout au plus) : charger puis dédoublonner en mémoire est
  // amplement suffisant et beaucoup plus robuste.
  const [agences, lignes] = await Promise.all([
    Agence.findAll({
      where: { active: true },
      include: [{ model: Company, as: 'company', where: { statut: { [Op.in]: COMPAGNIES_VISIBLES } }, attributes: [] }],
      attributes: ['ville'],
    }),
    Ligne.findAll({
      where: { active: true },
      include: [{ model: Company, as: 'company', where: { statut: { [Op.in]: COMPAGNIES_VISIBLES } }, attributes: [] }],
      attributes: ['villeArrivee'],
    }),
  ]);

  const villesDepart = [...new Set(agences.map((a) => a.ville))].sort((a, b) => a.localeCompare(b));
  const villesArrivee = [...new Set(lignes.map((l) => l.villeArrivee))].sort((a, b) => a.localeCompare(b));
  res.json({ villesDepart, villesArrivee });
});

/**
 * GET /public/trips?villeDepart=&villeArrivee=&date=YYYY-MM-DD — recherche de
 * trajets, toutes compagnies visibles confondues. Les trois paramètres sont
 * requis : un voyageur cherche toujours "de X à Y, tel jour" — jamais un
 * catalogue complet non filtré (qui exposerait toute la donnée interne des
 * compagnies sans raison).
 */
const searchTrips = catchAsync(async (req, res) => {
  const { villeDepart, villeArrivee, date } = req.query;
  if (!villeDepart || !villeArrivee || !date) {
    throw ApiError.badRequest('villeDepart, villeArrivee et date sont requis.');
  }
  if (String(villeDepart).trim().toLowerCase() === String(villeArrivee).trim().toLowerCase()) {
    throw ApiError.badRequest('La ville de départ et la ville d\'arrivée doivent être différentes.');
  }

  const lignes = await Ligne.findAll({
    where: { active: true, villeArrivee: { [Op.iLike]: villeArrivee } },
    include: [...INCLUDE_LIGNE_PUBLIC, { model: LigneHoraire, as: 'horaires' }],
  });
  const lignesFiltrees = lignes.filter((ligne) => ligne.agenceDepart.ville.toLowerCase() === String(villeDepart).trim().toLowerCase());

  if (lignesFiltrees.length === 0) {
    res.json({ resultats: [] });
    return;
  }

  // Trips déjà matérialisés pour ces lignes à cette date précise (le cas
  // échéant) — permet de refléter un statut réel (annulé/retardé/complet)
  // et une disponibilité réelle là où un guichetier a déjà généré/vendu.
  const tripsReels = await Trip.findAll({
    where: { ligneId: { [Op.in]: lignesFiltrees.map((l) => l.id) }, date },
  });
  const tripParCle = new Map(tripsReels.map((t) => [`${t.ligneId}|${t.heureDepart}`, t]));

  const entrees = [];
  for (const ligne of lignesFiltrees) {
    for (const horaire of ligne.horaires) {
      // Départ déjà passé (aujourd'hui, forcément — une date future n'est
      // jamais "passée") : même règle que le guichet (voir departIsPasse plus
      // bas, utilisé aussi pour bloquer la vente), on ne propose plus un
      // horaire déjà parti à la recherche voyageur. Un horaire dont la
      // réservation en ligne est fermée (délai limite de la compagnie
      // écoulé — voir `reservationEnLigneFermee`) disparaît aussi
      // entièrement : le voyageur ne doit même plus le voir, contrairement à
      // un trajet "complet" qui reste visible mais grisé.
      if (reservationEnLigneFermee(date, corrigerEncodageEventuel(horaire.heure), ligne.delaiLimiteReservationEnLigneMinutes)) continue;
      const tripReel = tripParCle.get(`${ligne.id}|${horaire.heure}`);
      // Un trajet explicitement annulé par la compagnie ne doit plus
      // apparaître à la recherche.
      if (tripReel?.statut === 'annule') continue;
      entrees.push({ ligne, heure: horaire.heure, tripReel });
    }
  }

  const resultats = await Promise.all(entrees.map(({ ligne, heure, tripReel }) => construireResultat(ligne, date, heure, tripReel)));
  resultats.sort((a, b) => a.heureDepart.localeCompare(b.heureDepart));
  res.json({ resultats });
});

/** Charge une Ligne (active, compagnie visible) avec tout ce qu'il faut pour construireResultat/réservation. */
async function chargerLignePublique(ligneId) {
  return Ligne.findOne({
    where: { id: ligneId, active: true },
    include: INCLUDE_LIGNE_PUBLIC,
  });
}

/** GET /public/trips/:id — détail d'un trajet (page de sélection/réservation), réel ou virtuel. */
const getTrip = catchAsync(async (req, res) => {
  const virtuel = parseIdVirtuel(req.params.id);

  if (virtuel) {
    const ligne = await chargerLignePublique(virtuel.ligneId);
    if (!ligne) throw ApiError.notFound('Trajet introuvable.');
    // Un `Trip` a pu être matérialisé entre-temps (une autre personne a déjà
    // réservé ce créneau) — on le recherche à chaque fois plutôt que de
    // supposer que l'id virtuel reste valable indéfiniment, pour ne jamais
    // afficher une disponibilité périmée.
    const tripReel = await Trip.findOne({ where: { ligneId: virtuel.ligneId, date: virtuel.date, heureDepart: virtuel.heureDepart } });
    if (tripReel?.statut === 'annule') throw ApiError.notFound('Ce trajet a été annulé.');
    res.json(await construireResultat(ligne, virtuel.date, virtuel.heureDepart, tripReel));
    return;
  }

  const trip = await Trip.findOne({ where: { id: req.params.id, statut: { [Op.notIn]: ['annule'] } } });
  if (!trip) throw ApiError.notFound('Trajet introuvable.');
  const ligne = await chargerLignePublique(trip.ligneId);
  if (!ligne) throw ApiError.notFound('Trajet introuvable.');
  res.json(await construireResultat(ligne, trip.date, trip.heureDepart, trip));
});

/** UUID v4-ish — juste assez strict pour choisir entre recherche par id ou par code, jamais utilisé pour valider une vraie création. */
const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /public/compagnies — annuaire des compagnies visibles, pour la
 * section "Nos compagnies" de la page d'accueil (logo + nom cliquable vers
 * la page détail). Champs volontairement limités à l'identité publique —
 * jamais de données financières/internes (voir doc de tête du fichier).
 */
const listCompanies = catchAsync(async (req, res) => {
  const compagnies = await Company.findAll({
    where: { statut: { [Op.in]: COMPAGNIES_VISIBLES } },
    attributes: ['id', 'code', 'nom', 'logoPath', 'couleurPrimaire', 'couleurSecondaire', 'ville', 'pays'],
    order: [['nom', 'ASC']],
  });

  // Nombre de lignes actives par compagnie — comptage à part (plutôt qu'un
  // `include` + `group`) pour ne pas complexifier/risquer la requête
  // principale ci-dessus ; utilisé par l'app voyageur pour afficher "X
  // lignes actives" sur chaque carte compagnie plutôt qu'une simple liste
  // nom + ville.
  const compteurs = await Ligne.findAll({
    attributes: ['companyId', [sequelize.fn('COUNT', sequelize.col('id')), 'total']],
    where: { active: true, companyId: { [Op.in]: compagnies.map((c) => c.id) } },
    group: ['companyId'],
    raw: true,
  });
  const nombreLignesParCompagnie = new Map(compteurs.map((c) => [c.companyId, Number(c.total)]));

  res.json({
    compagnies: compagnies.map((c) => ({ ...c.toJSON(), nombreLignes: nombreLignesParCompagnie.get(c.id) ?? 0 })),
  });
});

/**
 * GET /public/compagnies/:id — page dédiée d'une compagnie (identité +
 * lignes actives avec leurs horaires), accessible en cliquant sur son logo.
 * `:id` accepte l'UUID ou le `code` (pas de champ `slug` dédié aujourd'hui).
 */
const getCompany = catchAsync(async (req, res) => {
  const { id } = req.params;
  const where = RE_UUID.test(id) ? { [Op.or]: [{ id }, { code: id }] } : { code: id };

  const company = await Company.findOne({
    where: { ...where, statut: { [Op.in]: COMPAGNIES_VISIBLES } },
    // `findOne` applique un `limit: 1` implicite, ce qui active par défaut le
    // mode `subQuery` de Sequelize dès qu'un include hasMany (ici `lignes`)
    // est présent : la requête principale est alors exécutée comme
    // sous-requête, et toute clause portant sur une table jointe (le `where`
    // sur `lignes`, ou son propre include `agenceDepart`) se retrouve hors de
    // portée de cette sous-requête -> erreur Postgres "missing FROM-clause
    // entry for table lignes". `subQuery: false` force une jointure classique
    // à plat, correcte ici puisqu'on ne pagine pas `lignes`.
    subQuery: false,
    include: [
      {
        model: Ligne,
        as: 'lignes',
        required: false,
        where: { active: true },
        include: [
          { model: LigneHoraire, as: 'horaires' },
          { model: Agence, as: 'agenceDepart', required: true, where: { active: true } },
        ],
      },
    ],
  });
  if (!company) throw ApiError.notFound('Compagnie introuvable.');

  res.json({
    id: company.id,
    code: company.code,
    nom: company.nom,
    logoPath: company.logoPath,
    couleurPrimaire: company.couleurPrimaire,
    couleurSecondaire: company.couleurSecondaire,
    devise: company.devise,
    ville: company.ville,
    pays: company.pays,
    lignes: (company.lignes || [])
      .map((ligne) => ({
        id: ligne.id,
        villeDepart: ligne.agenceDepart.ville,
        villeArrivee: ligne.villeArrivee,
        dureeEstimeeMinutes: ligne.dureeEstimeeMinutes,
        horaires: (ligne.horaires || []).map((h) => corrigerEncodageEventuel(h.heure)).sort(),
      }))
      .sort((a, b) => a.villeArrivee.localeCompare(b.villeArrivee)),
  });
});

function normaliserTelephone(telephone) {
  return String(telephone || '').trim().replace(/[\s.-]/g, '');
}

/** Découpe un nom complet ("Awa Kaboré") en { prenom, nom } — le formulaire
 * de réservation ne collecte qu'un champ "nom complet", alors que
 * `CompteVoyageur` stocke les deux séparément (voir compteVoyageur.model.js).
 * Premier mot = prénom, reste = nom ; à défaut d'un second mot, on réutilise
 * le nom complet pour les deux plutôt que de laisser "nom" vide (NOT NULL). */
function decouperNomComplet(nomComplet) {
  const mots = String(nomComplet || '').trim().split(/\s+/);
  const prenom = mots[0] || nomComplet;
  const nom = mots.slice(1).join(' ') || prenom;
  return { prenom, nom };
}

/**
 * true si la date/heure de départ fournie est déjà passée — comparée à
 * l'heure réelle au Burkina Faso (Africa/Ouagadougou, UTC+0 toute l'année,
 * pas d'heure d'été), PAS au fuseau horaire du serveur ni à celui du
 * voyageur qui consulte le site (ex. depuis la France, en UTC+1/+2 selon la
 * saison). L'ancienne version utilisait `new Date(date)` (minuit UTC) puis
 * `.setHours()` (heure LOCALE du process Node) : un décalage entre les deux
 * faisait dériver la comparaison du fuseau horaire du serveur, provoquant des
 * trajets déjà partis encore affichés (ou l'inverse) selon l'environnement
 * d'exécution. On ancre maintenant tout le calcul en UTC explicitement.
 */
function departIsPasse(date, heureDepart) {
  const [h, m] = heureDepart.split(':').map(Number);
  const [annee, mois, jour] = String(date).split('-').map(Number);
  const depart = new Date(Date.UTC(annee, mois - 1, jour, h, m, 0, 0));
  return depart.getTime() < Date.now();
}

/**
 * true si la réservation EN LIGNE d'un trajet est fermée — soit parce qu'il
 * est déjà parti (`departIsPasse`), soit parce que la compagnie a défini un
 * délai de coupure (`ligne.delaiLimiteReservationEnLigneMinutes`, voir
 * migration `add-quotas-canal-to-lignes`) et que ce délai est écoulé. Un
 * trajet dont la réservation en ligne est fermée disparaît entièrement de
 * la recherche voyageur (voir `searchTrips`) — contrairement à `complet`
 * (places épuisées), qui affiche encore la carte mais grisée/non
 * réservable : ici, le voyageur ne doit même plus le VOIR.
 *
 * Même ancrage UTC que `departIsPasse` (voir sa doc) : le Burkina Faso est
 * en UTC+0 toute l'année, donc "X minutes avant le départ" se calcule sans
 * ambiguïté de fuseau horaire, quel que soit le fuseau du serveur ou du
 * voyageur qui consulte le site.
 */
function reservationEnLigneFermee(date, heureDepart, delaiLimiteMinutes) {
  if (departIsPasse(date, heureDepart)) return true;
  if (delaiLimiteMinutes == null) return false;

  const [h, m] = heureDepart.split(':').map(Number);
  const [annee, mois, jour] = String(date).split('-').map(Number);
  const depart = new Date(Date.UTC(annee, mois - 1, jour, h, m, 0, 0));
  const limite = depart.getTime() - delaiLimiteMinutes * 60000;
  return limite < Date.now();
}

/**
 * Include Sequelize complet d'une réservation prête à être renvoyée au
 * client (page de confirmation, billet, lookup) — extrait une seule fois ici
 * car répété par `createReservation`, `createReservationAllerRetour`,
 * `getBillet`, `getBilletPdf` et `lookupReservation`.
 *
 * `reservationLiee` (une seule jambe : jamais imbriqué plus profond, une
 * jambe aller-retour n'a jamais plus d'UNE seule jambe liée — voir
 * `reservation.model.js`) permet à la page de confirmation d'afficher les
 * DEUX trajets d'un billet aller-retour à partir d'une seule référence.
 */
const INCLUDE_TRIP_COMPLET = [
  {
    model: Trip,
    as: 'trip',
    include: [
      { model: Ligne, as: 'ligne', include: [{ model: LigneTarif, as: 'tarifs' }] },
      { model: Agence, as: 'agenceDepart' },
      { model: Company, as: 'company' },
    ],
  },
];
// Version allégée utilisée UNIQUEMENT pour la jambe liée (reservationLiee)
// ci-dessous : ni le frontend (voir LegSummary dans confirmation-card.tsx,
// qui n'affiche que company/agenceDepart pour cette jambe) ni le backend
// n'ont besoin de `ligne.tarifs` sur cette branche — et l'inclure y causait
// un bug Postgres (voir commentaire plus bas), donc autant ne jamais
// demander cette donnée inutile à cet endroit plutôt que de compter
// uniquement sur `subQuery: false` pour contourner le problème.
const INCLUDE_TRIP_LEGER = [
  {
    model: Trip,
    as: 'trip',
    include: [
      { model: Agence, as: 'agenceDepart' },
      { model: Company, as: 'company' },
    ],
  },
];
const INCLUDE_RESERVATION_COMPLETE = [
  { model: Client, as: 'client' },
  ...INCLUDE_TRIP_COMPLET,
  { model: Reservation, as: 'reservationLiee', include: [{ model: Client, as: 'client' }, ...INCLUDE_TRIP_LEGER] },
];
// IMPORTANT : avant l'introduction de INCLUDE_TRIP_LEGER ci-dessus, ce
// include réutilisait INCLUDE_TRIP_COMPLET (donc son hasMany Ligne.tarifs)
// pour la branche reservationLiee elle-même — un hasMany niché derrière une
// self-jointure belongsTo. Sequelize active automatiquement `subQuery: true`
// dès qu'un findByPk/findOne (limit implicite 1) rencontre un hasMany
// n'importe où dans l'arbre d'include — et son planificateur de jointures
// perdait alors la portée de l'alias "reservationLiee" pour la branche
// tarifs imbriquée, ce qui cassait la requête générée avec l'erreur Postgres
// `missing FROM-clause entry for table "reservationLiee"` (déjà vu et corrigé
// une fois pour getCompany, voir plus bas). TOUT appel de
// Reservation.findByPk/findOne avec ce include DOIT donc passer
// `subQuery: false` en option — sinon la même erreur revient.

/**
 * Résout et valide le créneau visé par un `tripId` (réel ou virtuel) — même
 * logique que ce que faisait `createReservation` avant d'être factorisée ici
 * pour être réutilisée telle quelle par `createReservationAllerRetour`
 * (chaque jambe d'un billet aller-retour doit subir EXACTEMENT les mêmes
 * vérifications qu'une réservation simple : trajet non déjà parti,
 * réservation en ligne pas fermée...).
 * @param {string} tripId
 * @param {{ libelle?: string }} [options] - ex. `{ libelle: 'aller ' }` pour préciser quelle jambe dans un message d'erreur.
 */
async function resoudreCreneauReservable(tripId, { libelle = '' } = {}) {
  const virtuel = parseIdVirtuel(tripId);
  const tripExistant = virtuel ? null : await Trip.findByPk(tripId);
  if (!virtuel && !tripExistant) throw ApiError.notFound(`Trajet ${libelle}introuvable ou indisponible à la réservation.`.replace('  ', ' '));

  const ligneId = virtuel ? virtuel.ligneId : tripExistant.ligneId;
  const date = virtuel ? virtuel.date : tripExistant.date;
  const heureDepart = virtuel ? virtuel.heureDepart : tripExistant.heureDepart;

  const ligne = await chargerLignePublique(ligneId);
  if (!ligne) throw ApiError.notFound(`Trajet ${libelle}introuvable ou indisponible à la réservation.`.replace('  ', ' '));
  if (departIsPasse(date, heureDepart)) throw ApiError.conflict(`Le trajet ${libelle}est déjà parti — choisissez un autre horaire.`.replace('  ', ' '));
  if (reservationEnLigneFermee(date, heureDepart, ligne.delaiLimiteReservationEnLigneMinutes)) {
    throw ApiError.conflict(`Les réservations en ligne sont fermées pour le trajet ${libelle}.`.replace(' .', '.'));
  }

  return { ligne, date, heureDepart };
}

/**
 * Résout (et crée si besoin) le `Trip` réel d'un créneau, vérifie/verrouille
 * son quota, puis crée la `Reservation` correspondante — DOIT être appelé
 * dans la transaction du site appelant. Factorisé pour être partagé par
 * `createReservation` (une jambe) et `createReservationAllerRetour` (deux
 * jambes, appelé deux fois dans la MÊME transaction).
 */
async function resoudreTripPourReservation({ transaction, ligne, date, heureDepart, placesDemandees }) {
  const [trip] = await Trip.findOrCreate({
    where: { ligneId: ligne.id, date, heureDepart },
    defaults: {
      companyId: ligne.companyId,
      ligneId: ligne.id,
      agenceDepartId: ligne.agenceDepartId,
      busId: ligne.busId,
      date,
      heureDepart,
      statut: 'prevu',
    },
    transaction,
  });
  if (trip.statut === 'annule') throw ApiError.conflict('Ce trajet a été annulé.');

  await verifierEtVerrouillerQuota({ transaction, tripId: trip.id, placesDemandees, canal: 'en_ligne' });

  return trip;
}

async function creerJambeReservation({ transaction, ligne, date, heureDepart, classe, montant, montantAvantReduction, typeBillet, reference, nomVoyageur, telephoneVoyageur, email, moyenPaiement, compteVoyageurId }) {
  const trip = await resoudreTripPourReservation({ transaction, ligne, date, heureDepart, placesDemandees: 1 });

  return creerReservationSurTrip({
    transaction,
    trip,
    ligne,
    date,
    heureDepart,
    classe,
    montant,
    montantAvantReduction,
    typeBillet,
    reference,
    nomVoyageur,
    telephoneVoyageur,
    email,
    moyenPaiement,
    compteVoyageurId,
  });
}

/**
 * Crée une seule `Reservation` sur un `Trip` déjà résolu (et dont le quota a
 * déjà été vérifié/verrouillé pour le nombre total de places du groupe) —
 * factorisé pour être appelé une fois par `creerJambeReservation` (1 place)
 * et en boucle par `creerReservationsGroupe` (N places, un seul appel de
 * `resoudreTripPourReservation` en amont pour tout le groupe).
 */
async function creerReservationSurTrip({ transaction, trip, ligne, date, heureDepart, classe, montant, montantAvantReduction, typeBillet, reference, nomVoyageur, telephoneVoyageur, email, moyenPaiement, compteVoyageurId, groupeReference }) {
  const [clientTrouve] = await Client.findOrCreate({
    where: { companyId: ligne.companyId, telephone: telephoneVoyageur },
    defaults: { companyId: ligne.companyId, nom: nomVoyageur, telephone: telephoneVoyageur, email: email || null },
    transaction,
  });

  return Reservation.create(
    {
      reference,
      companyId: ligne.companyId,
      clientId: clientTrouve.id,
      compteVoyageurId,
      tripId: trip.id,
      agenceId: ligne.agenceDepartId,
      nomVoyageur,
      telephoneVoyageur,
      villeDepart: ligne.agenceDepart.ville,
      villeArrivee: ligne.villeArrivee,
      date,
      heureDepart,
      classe,
      montant,
      montantAvantReduction: montantAvantReduction ?? null,
      typeBillet,
      moyenPaiement,
      canal: 'en_ligne',
      statut: 'confirmee',
      groupeReference: groupeReference ?? null,
    },
    { transaction }
  );
}

/**
 * Crée EN UNE FOIS les N réservations (1 à 6) d'un groupe de passagers sur le
 * MÊME trajet/classe — voir `createReservationGroupe`. Le quota n'est
 * vérifié/verrouillé qu'UNE SEULE fois pour les N places (et non N fois pour
 * 1 place), afin qu'un groupe entier échoue ou réussisse ensemble : jamais 4
 * places posées puis la 5e refusée pour cause de trajet entre-temps rempli
 * par ailleurs (même garantie de tout-ou-rien qu'un rollback de transaction
 * classique, appliquée ici dès la vérification de quota).
 */
async function creerReservationsGroupe({ transaction, ligne, date, heureDepart, classe, montant, typeBillet, groupeReference, passagers, moyenPaiement, compteVoyageurId }) {
  const trip = await resoudreTripPourReservation({ transaction, ligne, date, heureDepart, placesDemandees: passagers.length });

  const reservations = [];
  for (const passager of passagers) {
    // eslint-disable-next-line no-await-in-loop -- création séquentielle volontaire : chaque `Reservation.create` dépend du même `trip` déjà verrouillé, pas besoin de parallélisme ici et ça garde l'ordre des passagers stable.
    const reservation = await creerReservationSurTrip({
      transaction,
      trip,
      ligne,
      date,
      heureDepart,
      classe,
      montant,
      montantAvantReduction: null,
      typeBillet,
      reference: generateDatedReference('RES'),
      nomVoyageur: passager.nomVoyageur,
      telephoneVoyageur: passager.telephoneVoyageur,
      email: passager.email,
      moyenPaiement,
      compteVoyageurId,
      groupeReference,
    });
    reservations.push(reservation);
  }
  return reservations;
}

/**
 * Résout (et crée si besoin, option "Créer un compte" cochée) le compte
 * voyageur à rattacher à une/des réservation(s) — factorisé pour être
 * partagé par `createReservation` et `createReservationAllerRetour` (un
 * seul compte, rattaché aux DEUX jambes d'un billet aller-retour).
 */
async function resoudreCompteVoyageurId({ req, transaction, creerCompte, nomVoyageur, telephoneVoyageur, email }) {
  let compteVoyageurId = req.auth?.espace === ESPACES.VOYAGEUR ? req.auth.sub : null;
  if (!compteVoyageurId && creerCompte) {
    try {
      const telephoneNormalise = normaliserTelephone(telephoneVoyageur);
      const { prenom, nom } = decouperNomComplet(nomVoyageur);
      const [compteVoyageur] = await CompteVoyageur.findOrCreate({
        where: { telephone: telephoneNormalise },
        defaults: { telephone: telephoneNormalise, nom, prenom, email: email || null },
        transaction,
      });
      compteVoyageurId = compteVoyageur.id;
    } catch {
      // Option non bloquante — la réservation continue sans compte lié.
    }
  }
  return compteVoyageurId;
}

/**
 * POST /public/reservations — réservation en ligne par un voyageur anonyme.
 * Même contrôle de quota que le guichet (voir `quota.service.js` et
 * `reservation.controller.js#create`), pour ne jamais survendre un trajet
 * qu'il soit réservé en ligne ou au guichet physique.
 *
 * Si `tripId` est un identifiant virtuel (aucun `Trip` généré pour ce
 * créneau pour l'instant), le `Trip` réel est créé à la volée ici (même
 * logique que `trip.controller.js#generateForDate`, mais pour un seul
 * créneau) avant de poser la réservation dessus.
 */
const createReservation = catchAsync(async (req, res) => {
  const { tripId, classe, nomVoyageur, telephoneVoyageur, email, moyenPaiement, creerCompte } = req.body;

  if (!tripId || !classe || !nomVoyageur || !telephoneVoyageur || !moyenPaiement) {
    throw ApiError.badRequest('tripId, classe, nomVoyageur, telephoneVoyageur et moyenPaiement sont requis.');
  }
  // Le site Voyageur ne simule le paiement en ligne que via Orange Money et
  // Moov Money (voir constants/enums.js#MOYEN_PAIEMENT_VOYAGEUR) — restriction
  // propre à ce canal, le guichet physique garde 'Espèces'/'Mobile Money'.
  if (!MOYEN_PAIEMENT_VOYAGEUR.includes(moyenPaiement)) {
    throw ApiError.badRequest(`moyenPaiement doit être l'un de : ${MOYEN_PAIEMENT_VOYAGEUR.join(', ')}.`);
  }

  const { ligne, date, heureDepart } = await resoudreCreneauReservable(tripId);

  const tarif = ligne.tarifs.find((t) => t.classe === classe);
  if (!tarif) throw ApiError.badRequest(`Aucun tarif "${classe}" pour ce trajet.`);

  const { reservation } = await sequelize.transaction(async (transaction) => {
    // Rattache la réservation au compte voyageur connecté s'il y en a un, ou
    // en crée un si "Créer un compte" a été coché — voir
    // `resoudreCompteVoyageurId` (jamais bloquant).
    const compteVoyageurId = await resoudreCompteVoyageurId({ req, transaction, creerCompte, nomVoyageur, telephoneVoyageur, email });

    const nouvelleReservation = await creerJambeReservation({
      transaction,
      ligne,
      date,
      heureDepart,
      classe,
      montant: tarif.prix,
      typeBillet: 'aller_simple',
      reference: generateDatedReference('RES'),
      nomVoyageur,
      telephoneVoyageur,
      email,
      moyenPaiement,
      compteVoyageurId,
    });

    return { reservation: nouvelleReservation };
  });

  await enregistrerAudit({
    action: 'Réservation en ligne (Voyageur)',
    details: `Réservation ${reservation.reference} pour ${reservation.nomVoyageur} (${reservation.villeDepart} → ${reservation.villeArrivee}, ${reservation.date}).`,
    companyId: ligne.companyId,
    auteur: { nom: 'Voyageur (site en ligne)' },
  });

  const complete = await Reservation.findByPk(reservation.id, { include: INCLUDE_RESERVATION_COMPLETE, subQuery: false });

  // Confirmation SMS et/ou email — voir services/notification/index.js et
  // CANAL_NOTIFICATION dans .env. N'échoue jamais (try/catch interne) : une
  // panne du fournisseur SMS/SMTP ne doit jamais faire perdre une réservation
  // déjà posée en base. Le résultat est renvoyé pour information (visible en
  // dev/debug), jamais garanti côté contrat d'API.
  const notification = await envoyerConfirmationReservation({
    telephone: complete.telephoneVoyageur,
    email: complete.client?.email || email || null,
    donnees: {
      reference: complete.reference,
      nomVoyageur: complete.nomVoyageur,
      villeDepart: complete.villeDepart,
      villeArrivee: complete.villeArrivee,
      date: complete.date,
      heureDepart: complete.heureDepart,
      montant: complete.montant,
      lienBillet: `${env.appPublicUrl}/mes-reservations?reference=${encodeURIComponent(complete.reference)}&telephone=${encodeURIComponent(complete.telephoneVoyageur)}`,
    },
  });

  res.status(201).json({ ...complete.toJSON(), notification });
});

/**
 * POST /public/reservations/groupe — réservation en ligne pour 1 à 6
 * passagers EN UNE SEULE OPÉRATION, tous sur le MÊME trajet et la MÊME classe
 * (voir retour utilisateur : jusqu'ici le voyageur ne pouvait réserver qu'une
 * place à la fois, une jambe = une seule personne). Même architecture que
 * `createReservationAllerRetour` : chaque passager reste une `Reservation` à
 * part entière (sa propre `reference`, son propre billet PDF/QR), les N
 * lignes étant liées par une `groupeReference` commune (voir migration
 * `add-groupe-reference-to-reservations`) au lieu de la self-jointure
 * `reservationLieeId` (qui ne modélise qu'UNE paire, pas un groupe de N).
 *
 * `passagers[0]` porte le contact réel (téléphone, email) — utilisé pour la
 * confirmation SMS/email et pour `Client.findOrCreate`/le compte voyageur.
 * Les passagers suivants n'ont besoin que d'un nom (voyage nominatif mais pas
 * de compte/téléphone individuel dans ce parcours) : leur `telephoneVoyageur`
 * et `email` héritent de `passagers[0]` s'ils ne sont pas fournis.
 *
 * Le quota est vérifié/verrouillé UNE SEULE fois pour les N places (voir
 * `creerReservationsGroupe`) : le groupe entier réussit ou échoue ensemble,
 * jamais 4 billets posés puis le 5e refusé.
 */
const createReservationGroupe = catchAsync(async (req, res) => {
  const { tripId, classe, passagers, moyenPaiement, creerCompte } = req.body;

  if (!tripId || !classe || !moyenPaiement) {
    throw ApiError.badRequest('tripId, classe et moyenPaiement sont requis.');
  }
  if (!Array.isArray(passagers) || passagers.length < MIN_PASSAGERS_RESERVATION || passagers.length > MAX_PASSAGERS_RESERVATION) {
    throw ApiError.badRequest(`passagers doit être un tableau de ${MIN_PASSAGERS_RESERVATION} à ${MAX_PASSAGERS_RESERVATION} personnes.`);
  }
  const contact = passagers[0];
  if (!contact?.nomVoyageur || !contact?.telephoneVoyageur) {
    throw ApiError.badRequest('Le premier passager (contact) doit avoir un nom et un numéro de téléphone.');
  }
  if (passagers.some((p) => !p?.nomVoyageur)) {
    throw ApiError.badRequest('Chaque passager doit avoir un nom.');
  }
  if (!MOYEN_PAIEMENT_VOYAGEUR.includes(moyenPaiement)) {
    throw ApiError.badRequest(`moyenPaiement doit être l'un de : ${MOYEN_PAIEMENT_VOYAGEUR.join(', ')}.`);
  }

  const passagersNormalises = passagers.map((p) => ({
    nomVoyageur: p.nomVoyageur,
    telephoneVoyageur: p.telephoneVoyageur || contact.telephoneVoyageur,
    email: p.email || contact.email || null,
  }));

  const { ligne, date, heureDepart } = await resoudreCreneauReservable(tripId);

  const tarif = ligne.tarifs.find((t) => t.classe === classe);
  if (!tarif) throw ApiError.badRequest(`Aucun tarif "${classe}" pour ce trajet.`);

  const groupeReference = generateDatedReference('GRP');

  const { reservations } = await sequelize.transaction(async (transaction) => {
    const compteVoyageurId = await resoudreCompteVoyageurId({
      req,
      transaction,
      creerCompte,
      nomVoyageur: contact.nomVoyageur,
      telephoneVoyageur: contact.telephoneVoyageur,
      email: contact.email,
    });

    const nouvellesReservations = await creerReservationsGroupe({
      transaction,
      ligne,
      date,
      heureDepart,
      classe,
      montant: tarif.prix,
      typeBillet: 'aller_simple',
      groupeReference,
      passagers: passagersNormalises,
      moyenPaiement,
      compteVoyageurId,
    });

    return { reservations: nouvellesReservations };
  });

  const montantTotal = tarif.prix * reservations.length;
  await enregistrerAudit({
    action: 'Réservation en ligne groupée (Voyageur)',
    details: `Réservation groupée ${groupeReference} pour ${reservations.length} passager(s), contact ${contact.nomVoyageur} (${ligne.agenceDepart.ville} → ${ligne.villeArrivee}, ${date}, ${montantTotal} FCFA).`,
    companyId: ligne.companyId,
    auteur: { nom: 'Voyageur (site en ligne)' },
  });

  const completes = await Promise.all(
    reservations.map((r) => Reservation.findByPk(r.id, { include: INCLUDE_RESERVATION_COMPLETE, subQuery: false }))
  );

  // Une seule confirmation SMS/email pour tout le groupe (jamais N messages
  // séparés) — envoyée au contact principal, référence le groupe.
  const notification = await envoyerConfirmationReservation({
    telephone: contact.telephoneVoyageur,
    email: completes[0].client?.email || contact.email || null,
    donnees: {
      reference: groupeReference,
      nomVoyageur: contact.nomVoyageur,
      villeDepart: completes[0].villeDepart,
      villeArrivee: completes[0].villeArrivee,
      date: completes[0].date,
      heureDepart: completes[0].heureDepart,
      montant: montantTotal,
      lienBillet: `${env.appPublicUrl}/mes-reservations/groupe?reference=${encodeURIComponent(groupeReference)}&telephone=${encodeURIComponent(contact.telephoneVoyageur)}`,
    },
  });

  res.status(201).json({
    groupeReference,
    montantTotal,
    passagers: completes.map((c) => c.toJSON()),
    notification,
  });
});

/**
 * GET /public/reservations/groupe/:reference?telephone= — retrouver tous les
 * billets d'une réservation groupée (page de confirmation, ou réouverte plus
 * tard sans compte) — même principe d'identité minimale que
 * `lookupReservation` (référence ET téléphone du contact doivent
 * correspondre), étendu à N réservations partageant `groupeReference` au
 * lieu d'une seule `reference`.
 */
const lookupReservationGroupe = catchAsync(async (req, res) => {
  const { telephone } = req.query;
  const { reference } = req.params;
  if (!reference || !telephone) throw ApiError.badRequest('reference et telephone sont requis.');

  const reservations = await Reservation.findAll({
    where: { groupeReference: reference, telephoneVoyageur: telephone },
    include: INCLUDE_RESERVATION_COMPLETE,
    subQuery: false,
    order: [['dateReservation', 'ASC']],
  });
  // Message volontairement générique — ne pas révéler si c'est la référence
  // ou le téléphone qui ne correspond pas. Un groupe où seuls certains
  // passagers partagent le téléphone du contact (cas normal, voir doc de
  // tête de `createReservationGroupe`) renvoie déjà tous les billets
  // pertinents ici puisque `telephoneVoyageur` est hérité du contact pour
  // tous les passagers sans numéro propre.
  if (!reservations.length) throw ApiError.notFound('Aucune réservation trouvée pour cette référence et ce numéro de téléphone.');
  res.json({ groupeReference: reference, passagers: reservations.map((r) => r.toJSON()) });
});

/**
 * POST /public/reservations/aller-retour — réservation en ligne d'un
 * aller-retour EN UNE SEULE OPÉRATION (voir retour utilisateur : jusqu'ici
 * il fallait poser deux réservations séparées, une par trajet, sans aucun
 * lien entre elles). Même architecture que
 * `vente.controller.js#createAllerRetour` côté guichet : chaque jambe reste
 * une `Reservation` à part entière (son propre `tripId`, son propre quota
 * vérifié/verrouillé), les deux étant liées via `reservationLieeId` pour
 * être retrouvées/affichées ensemble sur une seule page de confirmation.
 *
 * Réduction : si (et SEULEMENT si) les deux trajets choisis appartiennent à
 * la paire de lignes réversibles explicitement liée par la compagnie (voir
 * `Ligne.ligneRetourId`) et qu'elle a configuré un pourcentage de réduction
 * (`Ligne.reductionAllerRetourPourcentage`), le prix total est réduit
 * d'autant et réparti entre les deux jambes au prorata de leur tarif
 * respectif — sinon le prix total reste la simple somme des deux tarifs
 * (comportement identique à la vente guichet, qui n'a elle-même aucune
 * réduction). Ce choix évite d'avoir à modéliser une "entité paire" séparée :
 * la réduction reste une propriété de la ligne, appliquée uniquement quand
 * le voyageur a effectivement choisi le vrai aller ET le vrai retour de la
 * paire configurée par la compagnie (jamais deux trajets choisis au hasard).
 */
const createReservationAllerRetour = catchAsync(async (req, res) => {
  const { tripIdAller, tripIdRetour, classe, nomVoyageur, telephoneVoyageur, email, moyenPaiement, creerCompte } = req.body;

  if (!tripIdAller || !tripIdRetour || !classe || !nomVoyageur || !telephoneVoyageur || !moyenPaiement) {
    throw ApiError.badRequest('tripIdAller, tripIdRetour, classe, nomVoyageur, telephoneVoyageur et moyenPaiement sont requis.');
  }
  if (tripIdAller === tripIdRetour) {
    throw ApiError.badRequest('Le trajet retour doit être différent du trajet aller.');
  }
  if (!MOYEN_PAIEMENT_VOYAGEUR.includes(moyenPaiement)) {
    throw ApiError.badRequest(`moyenPaiement doit être l'un de : ${MOYEN_PAIEMENT_VOYAGEUR.join(', ')}.`);
  }

  const [aller, retour] = await Promise.all([
    resoudreCreneauReservable(tripIdAller, { libelle: 'aller ' }),
    resoudreCreneauReservable(tripIdRetour, { libelle: 'retour ' }),
  ]);

  const tarifAller = aller.ligne.tarifs.find((t) => t.classe === classe);
  const tarifRetour = retour.ligne.tarifs.find((t) => t.classe === classe);
  if (!tarifAller || !tarifRetour) throw ApiError.badRequest(`Aucun tarif "${classe}" pour l'un des deux trajets.`);

  // Réduction UNIQUEMENT si les deux lignes sont bien la paire réversible
  // officiellement liée (voir doc de tête) — deux trajets qui se trouvent
  // juste avoir des villes inversées, sans être LA paire configurée par la
  // compagnie, ne donnent droit à aucune réduction.
  const sontPaireReversible = Boolean(aller.ligne.ligneRetourId) && aller.ligne.ligneRetourId === retour.ligne.id;
  const pourcentageReduction = sontPaireReversible ? aller.ligne.reductionAllerRetourPourcentage : null;

  const prixAllerBrut = tarifAller.prix;
  const prixRetourBrut = tarifRetour.prix;
  const totalBrut = prixAllerBrut + prixRetourBrut;

  let montantAller = prixAllerBrut;
  let montantRetour = prixRetourBrut;
  let montantAvantReductionAller = null;
  let montantAvantReductionRetour = null;

  if (pourcentageReduction) {
    const totalNet = Math.round((totalBrut * (100 - pourcentageReduction)) / 100);
    // Répartition proportionnelle au poids de chaque jambe dans le total
    // brut (et non un simple partage 50/50) — reste cohérent même quand les
    // deux classes de confort choisies ont des tarifs différents. Le reliquat
    // d'arrondi est absorbé par la jambe retour pour que la somme des deux
    // montants corresponde EXACTEMENT au total net annoncé.
    montantAller = Math.round((totalNet * prixAllerBrut) / totalBrut);
    montantRetour = totalNet - montantAller;
    montantAvantReductionAller = prixAllerBrut;
    montantAvantReductionRetour = prixRetourBrut;
  }

  const referenceAller = generateDatedReference('RES');
  const referenceRetour = generateDatedReference('RES');

  const { reservationAller, reservationRetour } = await sequelize.transaction(async (transaction) => {
    const compteVoyageurId = await resoudreCompteVoyageurId({ req, transaction, creerCompte, nomVoyageur, telephoneVoyageur, email });

    // Les DEUX trajets sont vérifiés/verrouillés dans la MÊME transaction :
    // si le retour est complet, l'aller déjà créé plus haut est annulé par
    // le rollback automatique de la transaction (rien n'est jamais persisté
    // à moitié) — même garantie que `vente.controller.js#createAllerRetour`.
    const nouvelleReservationAller = await creerJambeReservation({
      transaction,
      ligne: aller.ligne,
      date: aller.date,
      heureDepart: aller.heureDepart,
      classe,
      montant: montantAller,
      montantAvantReduction: montantAvantReductionAller,
      typeBillet: 'aller_retour',
      reference: referenceAller,
      nomVoyageur,
      telephoneVoyageur,
      email,
      moyenPaiement,
      compteVoyageurId,
    });

    const nouvelleReservationRetour = await creerJambeReservation({
      transaction,
      ligne: retour.ligne,
      date: retour.date,
      heureDepart: retour.heureDepart,
      classe,
      montant: montantRetour,
      montantAvantReduction: montantAvantReductionRetour,
      typeBillet: 'aller_retour',
      reference: referenceRetour,
      nomVoyageur,
      telephoneVoyageur,
      email,
      moyenPaiement,
      compteVoyageurId,
    });

    await nouvelleReservationAller.update({ reservationLieeId: nouvelleReservationRetour.id }, { transaction });
    await nouvelleReservationRetour.update({ reservationLieeId: nouvelleReservationAller.id }, { transaction });

    return { reservationAller: nouvelleReservationAller, reservationRetour: nouvelleReservationRetour };
  });

  const montantTotal = montantAller + montantRetour;
  await enregistrerAudit({
    action: 'Réservation en ligne aller-retour (Voyageur)',
    details: `Réservation aller-retour ${reservationAller.reference} / ${reservationRetour.reference} pour ${nomVoyageur} (${montantTotal} FCFA${pourcentageReduction ? `, réduction ${pourcentageReduction} % appliquée` : ''}).`,
    companyId: aller.ligne.companyId,
    auteur: { nom: 'Voyageur (site en ligne)' },
  });

  const [completeAller, completeRetour] = await Promise.all([
    Reservation.findByPk(reservationAller.id, { include: INCLUDE_RESERVATION_COMPLETE, subQuery: false }),
    Reservation.findByPk(reservationRetour.id, { include: INCLUDE_RESERVATION_COMPLETE, subQuery: false }),
  ]);

  // Une seule confirmation SMS/email couvrant les deux jambes (jamais deux
  // messages séparés pour un seul achat) — le lien pointe vers la référence
  // de la jambe ALLER, dont la page de confirmation affiche automatiquement
  // le retour lié (voir `reservationLiee`, frontend `confirmation-card`).
  const notification = await envoyerConfirmationReservation({
    telephone: completeAller.telephoneVoyageur,
    email: completeAller.client?.email || email || null,
    donnees: {
      reference: completeAller.reference,
      nomVoyageur: completeAller.nomVoyageur,
      villeDepart: completeAller.villeDepart,
      villeArrivee: completeAller.villeArrivee,
      date: completeAller.date,
      heureDepart: completeAller.heureDepart,
      montant: montantTotal,
      lienBillet: `${env.appPublicUrl}/mes-reservations?reference=${encodeURIComponent(completeAller.reference)}&telephone=${encodeURIComponent(completeAller.telephoneVoyageur)}`,
    },
  });

  res.status(201).json({
    aller: completeAller.toJSON(),
    retour: completeRetour.toJSON(),
    montantTotal,
    reductionPourcentage: pourcentageReduction,
    notification,
  });
});

/**
 * GET /public/reservations/:id/billet — QR code (data URL) + infos billet.
 * Accès invité protégé par le même principe que `lookupReservation` : il
 * faut connaître la référence ET le téléphone exacts (query `telephone`),
 * jamais l'id seul.
 */
const getBillet = catchAsync(async (req, res) => {
  const { telephone } = req.query;
  if (!telephone) throw ApiError.badRequest('telephone est requis.');

  const reservation = await Reservation.findOne({
    where: { id: req.params.id, telephoneVoyageur: telephone },
    include: INCLUDE_RESERVATION_COMPLETE,
    subQuery: false,
  });
  if (!reservation) throw ApiError.notFound('Réservation introuvable pour cet identifiant et ce numéro de téléphone.');

  const qrDataUrl = await genererQrDataUrl(reservation);
  res.json({ qrDataUrl, reservation });
});

/**
 * GET /public/reservations/:id/billet.pdf — billet PDF téléchargeable (QR +
 * infos du voyage), pensé pour les voyageurs notifiés par SMS (qui ne
 * peuvent pas recevoir de pièce jointe) : ils suivent le lien du SMS vers la
 * page de confirmation, puis téléchargent ce PDF depuis leur téléphone.
 */
const getBilletPdf = catchAsync(async (req, res) => {
  const { telephone } = req.query;
  if (!telephone) throw ApiError.badRequest('telephone est requis.');

  const reservation = await Reservation.findOne({
    where: { id: req.params.id, telephoneVoyageur: telephone },
    include: INCLUDE_RESERVATION_COMPLETE,
    subQuery: false,
  });
  if (!reservation) throw ApiError.notFound('Réservation introuvable pour cet identifiant et ce numéro de téléphone.');

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="billet-${reservation.reference}.pdf"`);
  const doc = await genererBilletPdf(reservation);
  doc.pipe(res);
  doc.end();
});

/**
 * GET /public/reservations/lookup?reference=&telephone= — retrouver sa
 * réservation (page de confirmation rouverte plus tard, sans compte).
 * `reference` est unique sur toute la table : on ne redemande le téléphone
 * QUE comme vérification d'identité minimale avant de renvoyer les détails.
 */
const lookupReservation = catchAsync(async (req, res) => {
  const { reference, telephone } = req.query;
  if (!reference || !telephone) throw ApiError.badRequest('reference et telephone sont requis.');

  const reservation = await Reservation.findOne({
    where: { reference, telephoneVoyageur: telephone },
    include: INCLUDE_RESERVATION_COMPLETE,
    subQuery: false,
  });
  // Message volontairement générique — ne pas révéler si c'est la référence
  // ou le téléphone qui ne correspond pas.
  if (!reservation) throw ApiError.notFound('Aucune réservation trouvée pour cette référence et ce numéro de téléphone.');
  res.json(reservation);
});

module.exports = {
  listVilles,
  searchTrips,
  getTrip,
  listCompanies,
  getCompany,
  createReservation,
  createReservationGroupe,
  createReservationAllerRetour,
  lookupReservation,
  lookupReservationGroupe,
  getBillet,
  getBilletPdf,
};
