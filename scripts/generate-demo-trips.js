// Script d'appoint (hors HTTP, jamais exposé à un utilisateur) — génère des
// `Trip` pour les prochains jours sur TOUTES les lignes actives de TOUTES
// les compagnies, tous horaires confondus.
//
// Contexte : en fonctionnement normal, ce sont les guichetiers qui génèrent
// les trajets du jour depuis ankata_guichet (voir
// trip.controller.js#generateForDate, appelé compagnie par compagnie). Ça
// suppose un compte + une session ouverte — impossible avant que qui que ce
// soit ne se soit connecté. Pour que le site Voyageur (ankkata_frontend)
// ait des trajets à proposer dès `docker compose up` sur une base tout
// juste seedée, ce script rejoue la même logique mais pour toutes les
// compagnies d'un coup et sans authentification, à lancer une fois après le
// seed (voir docker-compose.yml d'ankkata_frontend).
//
// Idempotent : `Trip.findOrCreate` sur la contrainte unique
// (ligne_id, date, heure_depart) ne duplique jamais rien si relancé.
const { Ligne, LigneHoraire, Trip, sequelize } = require('../src/models');

const NOMBRE_JOURS = 14;

function dateOnly(date) {
  return date.toISOString().slice(0, 10);
}

async function genererTrajetsDemo() {
  const lignes = await Ligne.findAll({
    where: { active: true },
    include: [{ model: LigneHoraire, as: 'horaires' }],
  });

  let crees = 0;
  const aujourdHui = new Date();
  aujourdHui.setHours(0, 0, 0, 0);

  for (let jour = 0; jour < NOMBRE_JOURS; jour += 1) {
    const date = new Date(aujourdHui);
    date.setDate(date.getDate() + jour);
    const dateFormatee = dateOnly(date);

    for (const ligne of lignes) {
      for (const horaire of ligne.horaires) {
        const [, wasCreated] = await Trip.findOrCreate({
          where: { ligneId: ligne.id, date: dateFormatee, heureDepart: horaire.heure },
          defaults: {
            companyId: ligne.companyId,
            ligneId: ligne.id,
            agenceDepartId: ligne.agenceDepartId,
            busId: ligne.busId,
            date: dateFormatee,
            heureDepart: horaire.heure,
            statut: 'prevu',
          },
        });
        if (wasCreated) crees += 1;
      }
    }
  }

  console.log(`[generate-demo-trips] ${crees} trajet(s) créé(s) sur ${NOMBRE_JOURS} jours pour ${lignes.length} ligne(s) active(s).`);
}

genererTrajetsDemo()
  .then(() => sequelize.close())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[generate-demo-trips] Échec :', err);
    process.exit(1);
  });
