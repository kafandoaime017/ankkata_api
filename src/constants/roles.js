// Les trois "espaces" d'authentification de l'écosystème Ankkata :
//  - ankkata   : équipe interne Ankkata (multi-compagnies, provisioning)
//  - admin     : administrateur d'une compagnie cliente (app ankata_guichet, admin)
//  - guichetier: agent de comptoir d'une compagnie cliente (app ankata_guichet, guichet)
const ESPACES = {
  ANKKATA: 'ankkata',
  ADMIN: 'admin',
  GUICHETIER: 'guichetier',
  // Compte voyageur (site public ankkata_frontend) — pas de compagnie ni de
  // rôle associé, juste une identité permettant de retrouver "Mes trajets"
  // sans ressaisir référence+téléphone à chaque fois. Voir
  // voyageur.controller.js.
  VOYAGEUR: 'voyageur',
};

// Rôles internes Ankkata — voir RoleAnkkataPermissions côté ankkata_admin.
const ROLE_ANKKATA = {
  DIRECTION_GENERALE: 'direction_generale',
  RESPONSABLE_PROVISIONING: 'responsable_provisioning',
  AGENT_SUPPORT: 'agent_support',
};

// Un compte Ankkata peut gérer les compagnies (créer/modifier/suspendre,
// gérer agences/lignes/guichetiers) — direction générale + responsable
// provisioning seulement ; l'agent support reste en lecture seule.
const ROLES_PEUVENT_GERER_COMPAGNIES = [
  ROLE_ANKKATA.DIRECTION_GENERALE,
  ROLE_ANKKATA.RESPONSABLE_PROVISIONING,
];

// Gestion des comptes internes Ankkata et consultation du journal d'audit :
// réservé à la direction générale.
const ROLES_PEUVENT_GERER_COMPTES_ANKKATA = [ROLE_ANKKATA.DIRECTION_GENERALE];
const ROLES_PEUVENT_VOIR_JOURNAL_AUDIT = [ROLE_ANKKATA.DIRECTION_GENERALE];

function peutGererCompagnies(role) {
  return ROLES_PEUVENT_GERER_COMPAGNIES.includes(role);
}

function peutGererComptesAnkkata(role) {
  return ROLES_PEUVENT_GERER_COMPTES_ANKKATA.includes(role);
}

function peutVoirJournalAudit(role) {
  return ROLES_PEUVENT_VOIR_JOURNAL_AUDIT.includes(role);
}

// Niveaux d'administrateur compagnie.
const NIVEAU_ADMIN = {
  SUPER_ADMINISTRATEUR: 'super_administrateur',
  ADMINISTRATEUR: 'administrateur',
};

// Rôles guichetier (agent de comptoir).
const ROLE_GUICHETIER = {
  GUICHETIER: 'guichetier',
  SUPERVISEUR: 'superviseur',
};

module.exports = {
  ESPACES,
  ROLE_ANKKATA,
  NIVEAU_ADMIN,
  ROLE_GUICHETIER,
  peutGererCompagnies,
  peutGererComptesAnkkata,
  peutVoirJournalAudit,
};
