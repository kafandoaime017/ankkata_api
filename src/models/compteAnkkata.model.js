// Compte du personnel interne Ankkata (espace "ankkata") — non rattaché à
// une compagnie, portée plateforme entière. Voir constants/roles.js pour
// les permissions dérivées du rôle.
const { ROLE_ANKKATA } = require('../constants/roles');

module.exports = (sequelize, DataTypes) => {
  const CompteAnkkata = sequelize.define(
    'CompteAnkkata',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      code: { type: DataTypes.STRING, allowNull: false, unique: true },
      nom: { type: DataTypes.STRING, allowNull: false },
      identifiant: { type: DataTypes.STRING, allowNull: false, unique: true },
      motDePasseHash: { type: DataTypes.STRING, allowNull: false },
      role: { type: DataTypes.ENUM(...Object.values(ROLE_ANKKATA)), allowNull: false },
      actif: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      photoInitiales: { type: DataTypes.STRING, allowNull: true },
    },
    {
      tableName: 'comptes_ankkata',
    }
  );

  CompteAnkkata.associate = (models) => {
    CompteAnkkata.hasMany(models.AuditLog, { foreignKey: 'auteurAnkkataId', as: 'auditLogs' });
  };

  return CompteAnkkata;
};
