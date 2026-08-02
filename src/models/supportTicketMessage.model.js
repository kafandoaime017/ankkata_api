// Message du fil de discussion d'un ticket de support — immuable une fois
// posté (pas d'updatedAt, même logique que AuditLog). `auteurAnkkataId` nul
// signifie que le message rapporte les propos du contact côté compagnie
// (pas un compte enregistré), `auteurNom` reste alors le seul repère.
module.exports = (sequelize, DataTypes) => {
  const SupportTicketMessage = sequelize.define(
    'SupportTicketMessage',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      ticketId: { type: DataTypes.UUID, allowNull: false },
      auteurAnkkataId: { type: DataTypes.UUID, allowNull: true },
      auteurNom: { type: DataTypes.STRING, allowNull: false },
      contenu: { type: DataTypes.TEXT, allowNull: false },
    },
    {
      tableName: 'support_ticket_messages',
      updatedAt: false,
    }
  );

  SupportTicketMessage.associate = (models) => {
    SupportTicketMessage.belongsTo(models.SupportTicket, { foreignKey: 'ticketId', as: 'ticket' });
    SupportTicketMessage.belongsTo(models.CompteAnkkata, { foreignKey: 'auteurAnkkataId', as: 'auteurAnkkata' });
  };

  return SupportTicketMessage;
};
