'use strict';

/**
 * Seed de démonstration transactionnel.
 *
 * Principes :
 * - si toutes les données principales existent, le seed est ignoré ;
 * - si seulement une partie existe, une erreur explicite est déclenchée ;
 * - si une insertion échoue, toute la transaction est annulée ;
 * - aucune donnée partielle ne reste dans la base.
 */

const { Op } = require('sequelize');
const models = require('../models');
const passwordService = require('../services/password.service');
const {
  generateCode,
  generateDatedReference,
} = require('../utils/idGenerator');
const {
  ROLE_ANKKATA,
  NIVEAU_ADMIN,
  ROLE_GUICHETIER,
} = require('../constants/roles');

function demain() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date;
}

function dateOnly(date) {
  return date.toISOString().slice(0, 10);
}

module.exports = {
  async up() {
    const {
      sequelize,
      Company,
      CompteAnkkata,
      Agence,
      Bus,
      Ligne,
      LigneTarif,
      LigneHoraire,
      CompteAdmin,
      Guichetier,
      Client,
      Trip,
      Reservation,
      Vente,
      CashSession,
      CashMovement,
      Pointage,
      AuditLog,
    } = models;

    await sequelize.transaction(async (transaction) => {
      /*
       * On ne se base plus uniquement sur Company.count().
       *
       * On recherche précisément les enregistrements appartenant à ce seed.
       * Cela évite le cas suivant :
       * - companies est vide ;
       * - AK-0001 existe déjà ;
       * - le seed tente de recréer AK-0001 et échoue.
       */

      const codesCompagniesSeed = ['CIE-0001', 'CIE-0002'];
      const codesComptesAnkkataSeed = ['AK-0001', 'AK-0002', 'AK-0003'];

      const [nombreCompagniesExistantes, nombreComptesAnkkataExistants] =
        await Promise.all([
          Company.count({
            where: {
              code: {
                [Op.in]: codesCompagniesSeed,
              },
            },
            transaction,
          }),

          CompteAnkkata.count({
            where: {
              code: {
                [Op.in]: codesComptesAnkkataSeed,
              },
            },
            transaction,
          }),
        ]);

      const nombreMarqueursExistants =
        nombreCompagniesExistantes + nombreComptesAnkkataExistants;

      const nombreMarqueursAttendus =
        codesCompagniesSeed.length + codesComptesAnkkataSeed.length;

      if (nombreMarqueursExistants === nombreMarqueursAttendus) {
        console.log(
          '[seed] Les données de démonstration existent déjà — seed ignoré.',
        );

        return;
      }

      if (nombreMarqueursExistants > 0) {
        throw new Error(
          [
            '[seed] La base contient des données de démonstration partielles.',
            `Compagnies trouvées : ${nombreCompagniesExistantes}/${codesCompagniesSeed.length}.`,
            `Comptes Ankkata trouvés : ${nombreComptesAnkkataExistants}/${codesComptesAnkkataSeed.length}.`,
            'Nettoyez les anciennes données partielles avant de relancer le seed.',
          ].join(' '),
        );
      }

      const motDePasseAnkkataHash =
        await passwordService.hash('Ankkata@2026');

      const motDePasseAdminHash =
        await passwordService.hash('Admin@2026');

      const codePinHash =
        await passwordService.hash('123456');

      // ---------------------------------------------------------------
      // Équipe interne Ankkata
      // ---------------------------------------------------------------

      const dg = await CompteAnkkata.create(
        {
          code: 'AK-0001',
          nom: 'Aïmé Kaboré',
          identifiant: 'aime.kabore',
          motDePasseHash: motDePasseAnkkataHash,
          role: ROLE_ANKKATA.DIRECTION_GENERALE,
          photoInitiales: 'AK',
        },
        { transaction },
      );

      await CompteAnkkata.create(
        {
          code: 'AK-0002',
          nom: 'Fatimata Ouédraogo',
          identifiant: 'fatimata.ouedraogo',
          motDePasseHash: motDePasseAnkkataHash,
          role: ROLE_ANKKATA.RESPONSABLE_PROVISIONING,
          photoInitiales: 'FO',
        },
        { transaction },
      );

      await CompteAnkkata.create(
        {
          code: 'AK-0003',
          nom: 'Boureima Zongo',
          identifiant: 'boureima.zongo',
          motDePasseHash: motDePasseAnkkataHash,
          role: ROLE_ANKKATA.AGENT_SUPPORT,
          photoInitiales: 'BZ',
        },
        { transaction },
      );

      // ---------------------------------------------------------------
      // Compagnie 1 : Transport Ouaga Express
      // ---------------------------------------------------------------

      const compagnie1 = await Company.create(
        {
          code: 'CIE-0001',
          nom: 'Transport Ouaga Express',
          cleActivation: 'OUAGA-EXPRESS-2024',
          couleurPrimaire: 0xff141b4d,
          couleurSecondaire: 0xff2748e0,
          ville: 'Ouagadougou',
          pays: 'Burkina Faso',
          responsableNom: 'Issa Sanou',
          responsableTelephone: '+226 70 12 34 56',
          responsableEmail: 'contact@ouagaexpress.bf',
          plan: 'premium',
          statut: 'active',
          dateExpirationAbonnement: '2026-12-31',
        },
        { transaction },
      );

      const agence1a = await Agence.create(
        {
          code: 'RAG-001',
          companyId: compagnie1.id,
          nom: 'Gare Centrale Ouaga',
          ville: 'Ouagadougou',
          responsable: 'Issa Sanou',
          telephone: '+226 70 12 34 56',
          latitude: 12.3714,
          longitude: -1.5197,
        },
        { transaction },
      );

      const agence1b = await Agence.create(
        {
          code: 'RAG-002',
          companyId: compagnie1.id,
          nom: 'Gare Ouaga II',
          ville: 'Ouagadougou',
          responsable: 'Awa Kaboré',
          telephone: '+226 70 22 33 44',
        },
        { transaction },
      );

      await Agence.create(
        {
          code: 'RAG-003',
          companyId: compagnie1.id,
          nom: 'Agence Bobo',
          ville: 'Bobo-Dioulasso',
          responsable: 'Boureima Zongo',
          telephone: '+226 70 55 66 77',
        },
        { transaction },
      );

      const bus1 = await Bus.create(
        {
          code: 'BUS-001',
          companyId: compagnie1.id,
          agenceId: agence1a.id,
          immatriculation: '11 BF 3421',
          marqueModele: 'Mercedes-Benz Sprinter',
          capaciteStandard: 45,
          capaciteVip: 8,
          etat: 'en_service',
          dateMiseEnService: '2023-05-01',
        },
        { transaction },
      );

      const ligne1 = await Ligne.create(
        {
          code: 'RLN-001',
          companyId: compagnie1.id,
          agenceDepartId: agence1a.id,
          villeArrivee: 'Bobo-Dioulasso',
          busId: bus1.id,
          dureeEstimeeMinutes: 300,
        },
        { transaction },
      );

      await LigneTarif.bulkCreate(
        [
          {
            ligneId: ligne1.id,
            classe: 'Standard',
            prix: 5000,
          },
          {
            ligneId: ligne1.id,
            classe: 'VIP',
            prix: 7500,
          },
        ],
        { transaction },
      );

      await LigneHoraire.bulkCreate(
        [
          {
            ligneId: ligne1.id,
            heure: '06:00',
          },
          {
            ligneId: ligne1.id,
            heure: '10:00',
          },
          {
            ligneId: ligne1.id,
            heure: '16:00',
          },
        ],
        { transaction },
      );

      const ligne2 = await Ligne.create(
        {
          code: 'RLN-002',
          companyId: compagnie1.id,
          agenceDepartId: agence1a.id,
          villeArrivee: 'Koudougou',
          dureeEstimeeMinutes: 90,
        },
        { transaction },
      );

      await LigneTarif.create(
        {
          ligneId: ligne2.id,
          classe: 'Standard',
          prix: 2000,
        },
        { transaction },
      );

      await LigneHoraire.bulkCreate(
        [
          {
            ligneId: ligne2.id,
            heure: '07:00',
          },
          {
            ligneId: ligne2.id,
            heure: '14:00',
          },
        ],
        { transaction },
      );

      await CompteAdmin.create(
        {
          code: 'ADM-001',
          companyId: compagnie1.id,
          nom: 'Salif Ouédraogo',
          identifiant: 'admin.ouedraogo',
          motDePasseHash: motDePasseAdminHash,
          niveau: NIVEAU_ADMIN.SUPER_ADMINISTRATEUR,
        },
        { transaction },
      );

      const guichetier1 = await Guichetier.create(
        {
          code: 'RGU-001',
          companyId: compagnie1.id,
          agenceId: agence1a.id,
          nom: 'Issa Sanou',
          identifiant: 'IS-0142',
          role: ROLE_GUICHETIER.SUPERVISEUR,
          codePinHash,
        },
        { transaction },
      );

      await Guichetier.create(
        {
          code: 'RGU-002',
          companyId: compagnie1.id,
          agenceId: agence1b.id,
          nom: 'Awa Kaboré',
          identifiant: 'AK-0087',
          role: ROLE_GUICHETIER.GUICHETIER,
          codePinHash,
        },
        { transaction },
      );

      const client1 = await Client.create(
        {
          companyId: compagnie1.id,
          nom: 'Rasmané Compaoré',
          telephone: '76 22 11 09',
        },
        { transaction },
      );

      const client2 = await Client.create(
        {
          companyId: compagnie1.id,
          nom: 'Fatoumata Zongo',
          telephone: '70 88 45 12',
          email: 'fatou.zongo@example.com',
        },
        { transaction },
      );

      const dateVoyage = demain();
      const dateVoyageFormatee = dateOnly(dateVoyage);

      const trip1 = await Trip.create(
        {
          companyId: compagnie1.id,
          ligneId: ligne1.id,
          agenceDepartId: agence1a.id,
          busId: bus1.id,
          date: dateVoyageFormatee,
          heureDepart: '06:00',
          chauffeur: 'Karim Ouédraogo',
          statut: 'a_l_heure',
        },
        { transaction },
      );

      await Reservation.create(
        {
          reference: generateDatedReference('RES'),
          companyId: compagnie1.id,
          clientId: client1.id,
          tripId: trip1.id,
          agenceId: agence1a.id,
          nomVoyageur: client1.nom,
          telephoneVoyageur: client1.telephone,
          villeDepart: 'Ouagadougou',
          villeArrivee: 'Bobo-Dioulasso',
          date: dateVoyageFormatee,
          heureDepart: '06:00',
          classe: 'Standard',
          montant: 5000,
          moyenPaiement: 'Mobile Money',
          canal: 'en_ligne',
          statut: 'confirmee',
        },
        { transaction },
      );

      await Vente.create(
        {
          reference: generateDatedReference('TCK'),
          companyId: compagnie1.id,
          agenceId: agence1a.id,
          tripId: trip1.id,
          guichetierId: guichetier1.id,
          clientId: client2.id,
          classe: 'VIP',
          nombrePlaces: 1,
          prixUnitaire: 7500,
          nomVoyageur: client2.nom,
          telephoneVoyageur: '+226 70 88 45 12',
          pieceIdentite: 'CNIB n° B01245789',
          moyenPaiement: 'Espèces',
          dateVoyage: dateVoyageFormatee,
          montantRecu: 8000,
        },
        { transaction },
      );

      const cashSession1 = await CashSession.create(
        {
          numeroSession: generateDatedReference('CAI'),
          companyId: compagnie1.id,
          agenceId: agence1a.id,
          guichetierId: guichetier1.id,
          fondInitial: 100000,
          totalVentesEspeces: 7500,
          totalVentesMobileMoney: 0,
          nombreBilletsVendus: 1,
        },
        { transaction },
      );

      await CashMovement.create(
        {
          cashSessionId: cashSession1.id,
          reference: 'REC-1001',
          type: 'depense',
          motif: 'Fournitures de guichet',
          montant: 2000,
          guichetierId: guichetier1.id,
        },
        { transaction },
      );

      await Pointage.create(
        {
          code: generateCode('PTG'),
          companyId: compagnie1.id,
          guichetierId: guichetier1.id,
          agenceId: agence1a.id,
          cashSessionId: cashSession1.id,
        },
        { transaction },
      );

      await AuditLog.create(
        {
          companyId: null,
          auteurAnkkataId: dg.id,
          auteurNom: dg.nom,
          action: 'Provisioning de compagnie',
          details:
            `Compagnie "${compagnie1.nom}" provisionnée ` +
            `(clé ${compagnie1.cleActivation}, plan Premium).`,
        },
        { transaction },
      );

      await AuditLog.create(
        {
          companyId: compagnie1.id,
          auteurGuichetierId: guichetier1.id,
          auteurNom: guichetier1.nom,
          action: 'Ouverture de caisse',
          details:
            `Session ${cashSession1.numeroSession} ouverte ` +
            `à l'agence "${agence1a.nom}".`,
        },
        { transaction },
      );

      // ---------------------------------------------------------------
      // Compagnie 2 : Rafiq Voyages
      // ---------------------------------------------------------------

      const compagnie2 = await Company.create(
        {
          code: 'CIE-0002',
          nom: 'Rafiq Voyages',
          cleActivation: 'RAFIQ-VOYAGES-2024',
          couleurPrimaire: 0xff7c2d12,
          couleurSecondaire: 0xffea580c,
          ville: 'Bobo-Dioulasso',
          pays: 'Burkina Faso',
          responsableNom: 'Aminata Traoré',
          responsableTelephone: '+226 76 45 12 89',
          responsableEmail: 'direction@rafiqvoyages.bf',
          plan: 'standard',
          statut: 'active',
          dateExpirationAbonnement: '2026-09-15',
        },
        { transaction },
      );

      const agence2a = await Agence.create(
        {
          code: 'RAG-005',
          companyId: compagnie2.id,
          nom: 'Gare Bobo Centre',
          ville: 'Bobo-Dioulasso',
          responsable: 'Aminata Traoré',
          telephone: '+226 76 45 12 89',
        },
        { transaction },
      );

      const ligne3 = await Ligne.create(
        {
          code: 'RLN-004',
          companyId: compagnie2.id,
          agenceDepartId: agence2a.id,
          villeArrivee: 'Banfora',
          dureeEstimeeMinutes: 80,
        },
        { transaction },
      );

      await LigneTarif.create(
        {
          ligneId: ligne3.id,
          classe: 'Standard',
          prix: 2500,
        },
        { transaction },
      );

      await LigneHoraire.bulkCreate(
        [
          {
            ligneId: ligne3.id,
            heure: '08:00',
          },
          {
            ligneId: ligne3.id,
            heure: '15:00',
          },
        ],
        { transaction },
      );

      await CompteAdmin.create(
        {
          code: 'ADM-002',
          companyId: compagnie2.id,
          nom: 'Aminata Traoré',
          identifiant: 'admin.traore',
          motDePasseHash: motDePasseAdminHash,
          niveau: NIVEAU_ADMIN.SUPER_ADMINISTRATEUR,
        },
        { transaction },
      );

      await Guichetier.create(
        {
          code: 'RGU-005',
          companyId: compagnie2.id,
          agenceId: agence2a.id,
          nom: 'Drissa Coulibaly',
          identifiant: 'DC-0198',
          role: ROLE_GUICHETIER.GUICHETIER,
          codePinHash,
        },
        { transaction },
      );

      await Client.create(
        {
          companyId: compagnie2.id,
          nom: 'Aïcha Sawadogo',
          telephone: '78 90 12 34',
        },
        { transaction },
      );

      await AuditLog.create(
        {
          companyId: null,
          auteurAnkkataId: dg.id,
          auteurNom: dg.nom,
          action: 'Provisioning de compagnie',
          details:
            `Compagnie "${compagnie2.nom}" provisionnée ` +
            `(clé ${compagnie2.cleActivation}, plan Standard).`,
        },
        { transaction },
      );

      console.log(
        [
          '[seed] Données de démonstration insérées :',
          '2 compagnies,',
          'comptes Ankkata/admin/guichetiers,',
          'lignes, ventes, réservation et session de caisse.',
        ].join(' '),
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `
          TRUNCATE TABLE
            audit_logs,
            pointages,
            cash_movements,
            cash_sessions,
            ventes,
            reservations,
            trips,
            clients,
            guichetiers,
            comptes_admin,
            promotions_tarifaires,
            ligne_arrets,
            ligne_horaires,
            ligne_tarifs,
            lignes,
            buses,
            agences,
            comptes_ankkata,
            companies
          RESTART IDENTITY CASCADE;
        `,
        { transaction },
      );
    });
  },
};