// Tarif d'une ligne par classe de confort — remplace le Map<String,int>
// `tarifsParClasse` du modèle Dart par une ligne par classe.
const { CLASSE_CONFORT } = require('../constants/enums');

module.exports = (sequelize, DataTypes) => {
  const LigneTarif = sequelize.define(
    'LigneTarif',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      ligneId: { type: DataTypes.UUID, allowNull: false },
      classe: { type: DataTypes.ENUM(...CLASSE_CONFORT), allowNull: false },
      prix: { type: DataTypes.INTEGER, allowNull: false },
    },
    {
      tableName: 'ligne_tarifs',
      indexes: [{ unique: true, fields: ['ligne_id', 'classe'] }],
    }
  );

  LigneTarif.associate = (models) => {
    LigneTarif.belongsTo(models.Ligne, { foreignKey: 'ligneId', as: 'ligne' });
  };

  return LigneTarif;
};
