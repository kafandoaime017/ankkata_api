// Petit utilitaire partagé par les migrations (pas par l'app runtime) :
// PostgreSQL crée un type ENUM nommé "enum_<table>_<colonne>" pour chaque
// colonne Sequelize de type DataTypes.ENUM. `queryInterface.dropTable` ne
// supprime pas ce type automatiquement, donc chaque migration qui crée une
// colonne ENUM doit la nettoyer explicitement dans son `down` pour rester
// ré-exécutable proprement (sequelize-cli db:migrate:undo puis db:migrate).
async function dropEnumTypes(queryInterface, tableName, columnNames) {
  const queries = columnNames.map((column) =>
    queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_${tableName}_${column}";`)
  );
  await Promise.all(queries);
}

module.exports = { dropEnumTypes };
