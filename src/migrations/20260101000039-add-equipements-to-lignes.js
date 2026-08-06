// Ajoute la liste des équipements/services inclus sur une ligne (climatisation,
// wifi, repas, chargeur...) — voir constants/enums.js#EQUIPEMENTS_LIGNE et
// ligne.model.js. Tableau de codes (PostgreSQL ARRAY), jamais NULL — une
// ligne sans équipement particulier a simplement un tableau vide, pas de
// distinction "pas encore configuré" à faire ici.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('lignes', 'equipements', {
      type: Sequelize.ARRAY(Sequelize.STRING),
      allowNull: false,
      defaultValue: [],
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('lignes', 'equipements');
  },
};
