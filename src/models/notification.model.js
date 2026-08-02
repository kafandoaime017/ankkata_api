// Notification générique — pour l'instant uniquement alimentée par le cycle
// de vie des tickets de support (voir services/notification.service.js et
// controllers/supportTicket.controller.js), mais volontairement pensée
// assez large (type/entityType/entityId) pour servir d'autres événements
// plus tard sans nouvelle table.
//
// `espace` détermine à qui la notification est destinée :
//  - 'ankkata'    : diffusion à toute l'équipe Ankkata (companyId/guichetierId nuls) ;
//  - 'admin'      : à l'administrateur (ou aux administrateurs) de `companyId` ;
//  - 'guichetier' : à un guichetier précis (`guichetierId`).
module.exports = (sequelize, DataTypes) => {
  const Notification = sequelize.define(
    'Notification',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      espace: { type: DataTypes.STRING, allowNull: false },
      companyId: { type: DataTypes.UUID, allowNull: true },
      guichetierId: { type: DataTypes.UUID, allowNull: true },
      type: { type: DataTypes.STRING, allowNull: false },
      titre: { type: DataTypes.STRING, allowNull: false },
      message: { type: DataTypes.STRING, allowNull: false },
      entityType: { type: DataTypes.STRING, allowNull: true },
      entityId: { type: DataTypes.UUID, allowNull: true },
      lu: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    },
    {
      tableName: 'notifications',
    }
  );

  Notification.associate = (models) => {
    Notification.belongsTo(models.Company, { foreignKey: 'companyId', as: 'company' });
    Notification.belongsTo(models.Guichetier, { foreignKey: 'guichetierId', as: 'guichetier' });
  };

  return Notification;
};
