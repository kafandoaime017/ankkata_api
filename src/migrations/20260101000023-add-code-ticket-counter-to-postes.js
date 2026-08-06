'use strict';

// Ajoute au poste un code court lisible par un humain ("P01", "P02"...),
// attribué séquentiellement par compagnie à la création du poste (voir
// poste.service.js#resolvePoste), et un compteur de tickets propre à ce
// poste — les deux servent à construire une référence de billet
// séquentielle par poste (format TCK-P03-20260803-000147, voir
// idGenerator.js#genererReferenceTicket) au lieu de l'ancien suffixe
// aléatoire : un trou dans la séquence par poste devient un signal de
// fraude/perte détectable, ce qu'un suffixe aléatoire ne permettait pas.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('postes', 'code', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('postes', 'dernier_numero_ticket', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
    // Unicité du code au sein d'une compagnie seulement (pas globale) — deux
    // compagnies différentes peuvent chacune avoir un poste "P01".
    await queryInterface.addIndex('postes', ['company_id', 'code'], {
      unique: true,
      name: 'postes_company_code_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('postes', 'postes_company_code_unique');
    await queryInterface.removeColumn('postes', 'dernier_numero_ticket');
    await queryInterface.removeColumn('postes', 'code');
  },
};
