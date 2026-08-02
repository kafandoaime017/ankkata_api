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

const MOYEN_PAIEMENT = ['Espèces', 'Mobile Money'];

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

module.exports = {
  PLAN_ABONNEMENT,
  STATUT_COMPAGNIE,
  ETAT_BUS,
  CLASSE_CONFORT,
  STATUT_TRIP,
  CANAL_RESERVATION,
  STATUT_RESERVATION,
  TYPE_MOUVEMENT_CAISSE,
  MOYEN_PAIEMENT,
  CATEGORIES_DEPENSE,
  CATEGORIES_VERSEMENT,
  STATUT_SUPPORT_TICKET,
  PRIORITE_SUPPORT_TICKET,
  CANAL_CONTACT_SUPPORT,
};
