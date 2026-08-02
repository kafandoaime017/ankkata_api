// Promotion tarifaire temporaire sur une ligne (PromotionTarifaire côté
// ankata_guichet).
module.exports = (sequelize, DataTypes) => {
  const Promotion = sequelize.define(
    'Promotion',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      ligneId: { type: DataTypes.UUID, allowNull: false },
      libelle: { type: DataTypes.STRING, allowNull: false },
      dateDebut: { type: DataTypes.DATEONLY, allowNull: false },
      dateFin: { type: DataTypes.DATEONLY, allowNull: false },
      reductionPourcentage: { type: DataTypes.INTEGER, allowNull: false },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      tableName: 'promotions_tarifaires',
    }
  );

  Promotion.associate = (models) => {
    Promotion.belongsTo(models.Ligne, { foreignKey: 'ligneId', as: 'ligne' });
  };

  return Promotion;
};
