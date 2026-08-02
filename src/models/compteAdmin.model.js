// Administrateur d'une compagnie cliente (espace "admin") — portée
// compagnie entière, pas rattaché à une agence précise.
const { NIVEAU_ADMIN } = require('../constants/roles');

module.exports = (sequelize, DataTypes) => {
  const CompteAdmin = sequelize.define(
    'CompteAdmin',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      code: { type: DataTypes.STRING, allowNull: false, unique: true },
      companyId: { type: DataTypes.UUID, allowNull: false },
      nom: { type: DataTypes.STRING, allowNull: false },
      identifiant: { type: DataTypes.STRING, allowNull: false },
      motDePasseHash: { type: DataTypes.STRING, allowNull: false },
      niveau: {
        type: DataTypes.ENUM(...Object.values(NIVEAU_ADMIN)),
        allowNull: false,
        defaultValue: NIVEAU_ADMIN.ADMINISTRATEUR,
      },
      actif: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      tableName: 'comptes_admin',
      indexes: [{ unique: true, fields: ['company_id', 'identifiant'] }],
    }
  );

  CompteAdmin.associate = (models) => {
    CompteAdmin.belongsTo(models.Company, { foreignKey: 'companyId', as: 'company' });
    CompteAdmin.hasMany(models.AuditLog, { foreignKey: 'auteurAdminId', as: 'auditLogs' });
  };

  return CompteAdmin;
};
