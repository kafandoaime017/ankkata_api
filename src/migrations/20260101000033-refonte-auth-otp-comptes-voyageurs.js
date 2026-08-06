'use strict';

// Refonte de l'authentification voyageur : email+mot de passe -> téléphone +
// code OTP par SMS (voir controllers/voyageur.controller.js). Le téléphone
// devient le vrai identifiant (obligatoire), l'email devient optionnel (sert
// uniquement à recevoir la confirmation de réservation par email si
// renseigné — voir services/notification/index.js). Le mot de passe n'existe
// plus : `mot_de_passe_hash` est conservé en base (colonne rendue nullable,
// pas supprimée, pour rester simple et réversible) mais n'est plus utilisé
// par aucun code applicatif. Les colonnes `code_verification_hash` /
// `code_verification_expire_at` sont RÉUTILISÉES telles quelles pour stocker
// le hash + l'expiration du code OTP de connexion (même forme de données,
// pas besoin d'ajouter de colonnes).
module.exports = {
  async up(queryInterface, Sequelize) {
    // Défensif : d'éventuels comptes de test créés avant cette migration
    // peuvent n'avoir aucun téléphone (il était optionnel) — on leur pose un
    // placeholder inutilisable plutôt que de faire échouer la migration.
    await queryInterface.sequelize.query(
      "UPDATE comptes_voyageurs SET telephone = CONCAT('SANSTEL-', id) WHERE telephone IS NULL"
    );

    await queryInterface.changeColumn('comptes_voyageurs', 'telephone', {
      type: Sequelize.STRING,
      allowNull: false,
      unique: true,
    });
    await queryInterface.changeColumn('comptes_voyageurs', 'email', {
      type: Sequelize.STRING,
      allowNull: true,
      unique: true,
    });
    await queryInterface.changeColumn('comptes_voyageurs', 'mot_de_passe_hash', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    // Compteur de tentatives de code OTP incorrect — limite le brute-force
    // sur `code_verification_hash` (voir voyageur.controller.js#verifierOtp,
    // TENTATIVES_MAX). Remis à 0 à chaque nouvelle demande de code.
    await queryInterface.addColumn('comptes_voyageurs', 'otp_tentatives', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('comptes_voyageurs', 'otp_tentatives');
    await queryInterface.changeColumn('comptes_voyageurs', 'mot_de_passe_hash', {
      type: Sequelize.STRING,
      allowNull: false,
    });
    await queryInterface.changeColumn('comptes_voyageurs', 'email', {
      type: Sequelize.STRING,
      allowNull: false,
      unique: true,
    });
    await queryInterface.changeColumn('comptes_voyageurs', 'telephone', {
      type: Sequelize.STRING,
      allowNull: true,
      unique: true,
    });
  },
};
