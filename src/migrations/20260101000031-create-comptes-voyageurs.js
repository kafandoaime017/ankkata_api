'use strict';

// Compte voyageur (espace public "Mon compte" du site Voyageur) — un 4e
// espace d'authentification en plus de ankkata/admin/guichetier (voir
// constants/roles.js#ESPACES), mais SANS notion de compagnie : un même
// voyageur réserve chez n'importe quelle compagnie Ankkata avec un seul
// compte.
//
// Vérification d'email SIMULÉE (aucun fournisseur SMTP configuré dans ce
// projet) : `code_verification_hash` + `code_verification_expire_at` portent
// un code à 6 chiffres renvoyé directement dans la réponse HTTP de
// l'inscription plutôt qu'envoyé par email — voir
// voyageur.controller.js#register pour le détail et l'avertissement associé.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('comptes_voyageurs', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      nom: { type: Sequelize.STRING, allowNull: false },
      prenom: { type: Sequelize.STRING, allowNull: false },
      email: { type: Sequelize.STRING, allowNull: false, unique: true },
      telephone: { type: Sequelize.STRING, allowNull: true, unique: true },
      mot_de_passe_hash: { type: Sequelize.STRING, allowNull: false },
      email_verifie: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      code_verification_hash: { type: Sequelize.STRING, allowNull: true },
      code_verification_expire_at: { type: Sequelize.DATE, allowNull: true },
      actif: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('comptes_voyageurs');
  },
};
