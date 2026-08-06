// Toutes les énumérations métier, partagées entre migrations, modèles et
// validators — une seule source de vérité pour chaque liste de valeurs.

const PLAN_ABONNEMENT = ['essai', 'standard', 'premium'];

const STATUT_COMPAGNIE = ['active', 'essai', 'suspendue', 'archivee'];

const ETAT_BUS = ['en_service', 'maintenance', 'hors_service'];

const CLASSE_CONFORT = ['Standard', 'VIP'];

const STATUT_TRIP = ['prevu', 'a_l_heure', 'retarde', 'complet', 'annule'];

const CANAL_RESERVATION = ['en_ligne', 'guichet'];

const STATUT_RESERVATION = ['confirmee', 'annulee', 'expiree'];

const TYPE_MOUVEMENT_CAISSE = ['depense', 'versement'];

// 'Orange Money'/'Moov Money' ajoutés pour le site Voyageur (ankkata_frontend)
// qui simule le paiement en ligne exclusivement via ces deux Mobile Money —
// voir migration 20260101000030. Le guichet (ankata_guichet) continue de
// n'utiliser que 'Espèces'/'Mobile Money'.
const MOYEN_PAIEMENT = ['Espèces', 'Mobile Money', 'Orange Money', 'Moov Money'];

// Sous-ensemble utilisable pour une réservation en ligne (voir
// public.controller.js#createReservation) — restriction métier, pas une
// contrainte de la colonne elle-même (qui accepte tout MOYEN_PAIEMENT).
const MOYEN_PAIEMENT_VOYAGEUR = ['Orange Money', 'Moov Money'];

// Bornes d'une réservation groupée en une seule opération publique (voir
// `public.controller.js#createReservationGroupe`) — le frontend affiche déjà
// un sélecteur 1-6 sur la page de recherche (`search-form.tsx`), ces
// constantes sont la contrepartie serveur (jamais fait confiance au seul
// frontend pour cette borne).
const MIN_PASSAGERS_RESERVATION = 1;
const MAX_PASSAGERS_RESERVATION = 6;

// Un billet "aller_retour" correspond à DEUX lignes `Vente` (une par trajet,
// voir `vente_liee_id`), chacune gardant son propre `tripId`/`prixUnitaire` —
// voir `vente.controller.js#createAllerRetour`.
const TYPE_BILLET = ['aller_simple', 'aller_retour'];

const CATEGORIES_DEPENSE = [
  'Fournitures de guichet',
  'Transport / carburant',
  'Réparation / entretien',
  'Frais bancaires',
  'Autre',
];

const CATEGORIES_VERSEMENT = [
  'Versement partiel en cours de journée',
  'Versement de fin de journée',
  'Autre',
];

const STATUT_SUPPORT_TICKET = ['ouvert', 'en_cours', 'resolu', 'ferme'];

const PRIORITE_SUPPORT_TICKET = ['basse', 'normale', 'haute', 'urgente'];

const CANAL_CONTACT_SUPPORT = ['telephone', 'email', 'whatsapp', 'en_personne', 'autre'];

// Catalogue fixe des équipements/services qu'une compagnie peut cocher sur
// une ligne (voir migration `add-equipements-to-lignes` et
// `ligne.controller.js#validerEquipements`) — voyageur les voit ensuite en
// icônes sur les cards de résultats et le détail d'un trajet (voir
// `public.controller.js#construireResultat`). Simple liste de CODES : le
// libellé français + l'icône à afficher sont définis séparément dans chaque
// client (ankkata_admin, ankata_guichet, ankkata_frontend), CE fichier ne
// fait qu'arbitrer quels codes sont valides — ne jamais renommer un code
// existant sans migrer les lignes déjà enregistrées.
const EQUIPEMENTS_LIGNE = [
  'climatisation',
  'wifi',
  'prise_electrique',
  'port_usb',
  'repas',
  'collation',
  'eau_minerale',
  'ecran_tv',
  'toilettes',
  'couverture',
  'bagages_inclus',
  'siege_inclinable',
  'assurance_voyage',
  'hotesse',
  'audio_individuel',
  'acces_pmr',
  'videosurveillance',
];

module.exports = {
  PLAN_ABONNEMENT,
  STATUT_COMPAGNIE,
  ETAT_BUS,
  CLASSE_CONFORT,
  STATUT_TRIP,
  TYPE_BILLET,
  CANAL_RESERVATION,
  STATUT_RESERVATION,
  TYPE_MOUVEMENT_CAISSE,
  MOYEN_PAIEMENT,
  MOYEN_PAIEMENT_VOYAGEUR,
  MIN_PASSAGERS_RESERVATION,
  MAX_PASSAGERS_RESERVATION,
  CATEGORIES_DEPENSE,
  CATEGORIES_VERSEMENT,
  STATUT_SUPPORT_TICKET,
  PRIORITE_SUPPORT_TICKET,
  CANAL_CONTACT_SUPPORT,
  EQUIPEMENTS_LIGNE,
};
