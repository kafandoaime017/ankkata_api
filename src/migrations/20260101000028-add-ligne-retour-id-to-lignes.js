'use strict';

// Lien explicite entre une ligne "aller" et sa ligne "retour", pour la
// vente de billets aller-retour dans un même billet (voir
// `services/vente.controller.js#createAllerRetour`). Jusqu'ici, une "ligne
// réversible" (voir `add-... reversible` sur `lignes`, champ booléen) ne
// créait que DEUX lignes indépendantes sans aucun lien en base — les
// retrouver l'une l'autre reposait uniquement sur une convention côté
// client (comparaison villeArrivee/agenceDepartId), fragile et non fiable
// pour résoudre un trajet retour au moment d'une vente.
//
// Auto-référence symétrique : peu importe quelle ligne est "l'aller" ou
// "le retour" du point de vue de l'admin qui les a créées, chacune pointe
// simplement vers "l'autre ligne de la paire". `UNIQUE` empêche qu'une
// ligne appartienne à plus d'une paire à la fois.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('lignes', 'ligne_retour_id', {
      type: Sequelize.UUID,
      allowNull: true,
      unique: true,
      references: { model: 'lignes', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('lignes', 'ligne_retour_id');
  },
};
