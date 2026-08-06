'use strict';

// Double authentification (TOTP) pour les comptes de l'équipe Ankkata — voir
// services/twoFactor.service.js. `deux_fa_secret` reste NULL tant que le
// compte n'a jamais activé la 2FA ; il est écrit une première fois "en
// attente de confirmation" par /2fa/setup, puis `deux_fa_actif` ne passe à
// true qu'après vérification d'un premier code correct (/2fa/confirmer) —
// impossible d'activer la 2FA "à moitié" sans avoir prouvé qu'on sait
// réellement générer les codes.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('comptes_ankkata', 'deux_fa_secret', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('comptes_ankkata', 'deux_fa_actif', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn('comptes_ankkata', 'deux_fa_verifie_at', { type: Sequelize.DATE, allowNull: true });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('comptes_ankkata', 'deux_fa_verifie_at');
    await queryInterface.removeColumn('comptes_ankkata', 'deux_fa_actif');
    await queryInterface.removeColumn('comptes_ankkata', 'deux_fa_secret');
  },
};
