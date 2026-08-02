// Véhicule (flotte) — capacité par classe stockée en deux colonnes plutôt
// qu'une Map, la liste de classes de confort étant fixe (Standard/VIP,
// voir constants/enums.js CLASSE_CONFORT).
const { ETAT_BUS } = require('../constants/enums');

module.exports = (sequelize, DataTypes) => {
  const Bus = sequelize.define(
    'Bus',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      code: { type: DataTypes.STRING, allowNull: false, unique: true },
      companyId: { type: DataTypes.UUID, allowNull: false },
      agenceId: { type: DataTypes.UUID, allowNull: false },
      immatriculation: { type: DataTypes.STRING, allowNull: false },
      marqueModele: { type: DataTypes.STRING, allowNull: false },
      capaciteStandard: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      capaciteVip: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      etat: { type: DataTypes.ENUM(...ETAT_BUS), allowNull: false, defaultValue: 'en_service' },
      dateMiseEnService: { type: DataTypes.DATEONLY, allowNull: false },
      prochainEntretien: { type: DataTypes.DATEONLY, allowNull: true },
    },
    {
      tableName: 'buses',
    }
  );

  Bus.associate = (models) => {
    Bus.belongsTo(models.Company, { foreignKey: 'companyId', as: 'company' });
    Bus.belongsTo(models.Agence, { foreignKey: 'agenceId', as: 'agence' });
    Bus.hasMany(models.Ligne, { foreignKey: 'busId', as: 'lignes' });
    Bus.hasMany(models.Trip, { foreignKey: 'busId', as: 'trips' });
  };

  return Bus;
};
