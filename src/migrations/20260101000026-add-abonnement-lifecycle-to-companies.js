'use strict';

// Cycle de vie de l'abonnement — dégradation progressive à quatre paliers
// (voir services/abonnement.service.js#calculerPalier) :
//   1. Rappel (J-7 à échéance) — purement informatif, calculé à la lecture
//      depuis `date_expiration_abonnement`, aucune colonne dédiée.
//   2. Impayé (J+1 à J+15) — idem, informatif + blocage des fonctions non
//      urgentes côté admin compagnie ; `montant_du` sert à afficher le
//      bandeau ("XX FCFA dus, à régler avant le DD/MM").
//   3. Suspension — TOUJOURS une action manuelle de l'équipe Ankkata
//      (`statut = 'suspendue'`, déjà existant) : jamais automatique, voir
//      avertissement dans changeStatus. `suspension_demandee_at` horodate
//      cette décision (affiché à l'admin compagnie : "suspendu depuis le...").
//   4. Résiliation (`statut = 'archivee'`, déjà existant) — `resiliation_at`
//      sert à calculer la fenêtre de 90 jours d'accès lecture seule à
//      l'historique + export complet (jamais de suppression de données).
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('companies', 'montant_du', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
    await queryInterface.addColumn('companies', 'suspension_demandee_at', { type: Sequelize.DATE, allowNull: true });
    await queryInterface.addColumn('companies', 'resiliation_at', { type: Sequelize.DATE, allowNull: true });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('companies', 'resiliation_at');
    await queryInterface.removeColumn('companies', 'suspension_demandee_at');
    await queryInterface.removeColumn('companies', 'montant_du');
  },
};
