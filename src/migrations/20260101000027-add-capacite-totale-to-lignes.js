'use strict';

// Capacité (nombre de places) par départ d'une ligne — jusqu'ici la
// capacité "réelle" n'existait que de façon dérivée et non fiable côté
// client (capacité du bus assigné, ou une valeur par défaut généreuse (500)
// quand aucun bus n'était assigné) : rien n'était stocké ni vérifié côté
// serveur, donc aucun quota n'était réellement appliqué — voir
// `vente.controller.js` (aucune vérification de places avant création d'une
// vente) et `core/services/quota.service.js` (nouveau, ce qui l'utilise).
// `DEFAULT 50` couvre les lignes déjà existantes (créées avant l'ajout de ce
// champ) le temps qu'un administrateur la modifie pour renseigner la vraie
// valeur.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('lignes', 'capacite_totale', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 50,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('lignes', 'capacite_totale');
  },
};
