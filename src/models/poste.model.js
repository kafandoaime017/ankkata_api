// Une installation du logiciel guichet (un poste physique) — alimentée par
// des heartbeats périodiques (voir controllers/poste.controller.js). Le
// `statut` (OK/Attention/Critique/Inactif) n'est PAS stocké : il est
// recalculé à la lecture par services/poste.service.js#calculerStatut, pour
// ne jamais avoir besoin d'un job de mise à jour périodique qui pourrait se
// dérégler.
module.exports = (sequelize, DataTypes) => {
  const Poste = sequelize.define(
    'Poste',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      companyId: { type: DataTypes.UUID, allowNull: false },
      agenceId: { type: DataTypes.UUID, allowNull: true },
      machineId: { type: DataTypes.STRING, allowNull: false },
      libelle: { type: DataTypes.STRING, allowNull: true },
      versionApp: { type: DataTypes.STRING, allowNull: true },
      osInfo: { type: DataTypes.STRING, allowNull: true },
      derniereSynchroAt: { type: DataTypes.DATE, allowNull: true },
      ventesEnAttente: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      derniereErreur: { type: DataTypes.TEXT, allowNull: true },
      derniereErreurAt: { type: DataTypes.DATE, allowNull: true },
      actif: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      tableName: 'postes',
    }
  );

  Poste.associate = (models) => {
    Poste.belongsTo(models.Company, { foreignKey: 'companyId', as: 'company' });
    Poste.belongsTo(models.Agence, { foreignKey: 'agenceId', as: 'agence' });
    Poste.hasMany(models.PosteHeartbeat, { foreignKey: 'posteId', as: 'heartbeats' });
  };

  return Poste;
};
