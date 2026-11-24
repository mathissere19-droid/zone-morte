// Toutes les valeurs d'équilibrage du jeu. Modifier ici, nulle part ailleurs.
export const CONFIG = {

  // delaiRegen : secondes sans coup avant régénération (null = aucune)
  difficultes: {
    recrue:    { nom: 'Recrue',    pvZombies: 0.7, degatsRecus: 0.6, pointsDepart: 1000, munitions: 1.5,  premiereVagueCoureurs: 8, delaiRegen: 3 },
    soldat:    { nom: 'Soldat',    pvZombies: 1,   degatsRecus: 1,   pointsDepart: 500,  munitions: 1,    premiereVagueCoureurs: 5, delaiRegen: 4 },
    veteran:   { nom: 'Vétéran',   pvZombies: 1.3, degatsRecus: 1.4, pointsDepart: 500,  munitions: 1,    premiereVagueCoureurs: 3, delaiRegen: 6 },
    cauchemar: { nom: 'Cauchemar', pvZombies: 1.6, degatsRecus: 1.8, pointsDepart: 250,  munitions: 0.75, premiereVagueCoureurs: 1, delaiRegen: null },
  },
  points: { touche: 10, kill: 60, killTete: 100, killCouteau: 130 },

  joueur: {
    vieMax: 100, degatsZombie: 40, delaiRegen: 4, dureeRegen: 1,
    staminaMax: 4, rechargeStamina: 2,
    vitesseMarche: 4.5, vitesseSprint: 7, vitesseVisee: 2.6,
    hauteurYeux: 1.7, rayon: 0.35, sautVitesse: 5, gravite: 15,
  },

  // cadence : 'semi' (un tir par clic) ou tirs par minute
  armes: {
    pistolet:      { nom: 'Pistolet',            degats: 40,  cadence: 'semi', chargeur: 8,   reserve: 32,  rechargement: 1.4, dispersion: 0.012, rare: false },
    mitraillette:  { nom: 'Mitraillette',        degats: 35,  cadence: 800,    chargeur: 30,  reserve: 150, rechargement: 2.0, dispersion: 0.03,  rare: false },
    pompe:         { nom: 'Fusil à pompe',       degats: 30,  plombs: 8, cadence: 70, chargeur: 6, reserve: 36, rechargement: 2.6, dispersion: 0.09, rare: false },
    assaut:        { nom: "Fusil d'assaut",      degats: 50,  cadence: 600,    chargeur: 30,  reserve: 180, rechargement: 2.2, dispersion: 0.02,  rare: false },
    precision:     { nom: 'Fusil de précision lourd', degats: 400, cadence: 'semi', chargeur: 5, reserve: 30, rechargement: 3.0, dispersion: 0.002, rare: true, perce: 3 },
    mitrailleuse:  { nom: 'Mitrailleuse lourde', degats: 60,  cadence: 650,    chargeur: 100, reserve: 300, rechargement: 4.5, dispersion: 0.035, rare: true },
    revolver:      { nom: 'Revolver',            degats: 110, cadence: 'semi', chargeur: 6,   reserve: 36,  rechargement: 2.0, dispersion: 0.01,  rare: false, multTete: 4 },
    pmCompact:     { nom: 'Pistolet-mitrailleur compact', degats: 28, cadence: 1000, chargeur: 32, reserve: 192, rechargement: 1.8, dispersion: 0.045, rare: false },
    semiAuto:      { nom: 'Fusil semi-automatique', degats: 140, cadence: 'semi', chargeur: 10, reserve: 60, rechargement: 2.4, dispersion: 0.006, rare: false, perce: 2 },
    pompeAuto:     { nom: 'Fusil à pompe automatique', degats: 26, plombs: 8, cadence: 240, chargeur: 12, reserve: 48, rechargement: 3.0, dispersion: 0.09, rare: false },
    arbalete:      { nom: 'Arbalète',            degats: 900, cadence: 'semi', chargeur: 1,   reserve: 25,  rechargement: 1.2, dispersion: 0.003, rare: false, perce: 3, bruit: 5 },
    lanceFlammes:  { nom: 'Lance-flammes',       degats: 12,  cadence: 600,    chargeur: 100, reserve: 300, rechargement: 3.5, dispersion: 0,     rare: true,
                     flamme: { portee: 6, angle: 20, brulureDps: 30, brulureDuree: 3 } },
    electrique:    { nom: 'Fusil électrique',    degats: 250, cadence: 'semi', chargeur: 8,   reserve: 48,  rechargement: 2.5, dispersion: 0.004, rare: true,
                     chaine: { sauts: 4, portee: 5, facteur: 0.8 } },
    lanceGrenades: { nom: 'Lance-grenades',      degats: 300, cadence: 'semi', chargeur: 1,   reserve: 20,  rechargement: 2.0, dispersion: 0.005, rare: true, rayonExplosion: 4 },
  },
  semiCadenceMax: 400,
  multiplicateurTete: 3,
  multiplicateurTetePompe: 2,
  pompeChute: { debut: 5, fin: 20, minimum: 0.3 },
  explosionDegatsJoueur: 50,

  prixMurs: { mitraillette: 1000, pompe: 1500, assaut: 2000, revolver: 750, semiAuto: 1750 },
  prixPortes: { hangar: 750, bunker: 1000, tour: 1250 },
  caisse: { prix: 950, chanceRare: 0.10, communes: ['pistolet', 'mitraillette', 'pompe', 'assaut', 'pmCompact', 'pompeAuto', 'arbalete'] },

  bonus: { chance: 0.05, maxParVague: 4, duree: 25, clignote: 5, pointsDoublesDuree: 30, explosionPoints: 400, rayonRamassage: 1.2 },

  vagues: { pause: 10, premierePause: 3, maxVivants: 24, distanceMinApparition: 8 },

  grenade: { max: 2, degats: 300, rayon: 5, degatsJoueurMax: 50, fusee: 2, vitesse: 14, delai: 0.8 },

  couteau: { degats: 150, portee: 1.6, delai: 0.6 },

  zombie: {
    vitesseMarche: 1.2, vitesseMarcheRapide: 2.2, vitesseCourse: 4.2,
    porteeAttaque: 1.3, delaiAttaque: 1.0, rayon: 0.35,
    recalculChemin: 0.5, distanceDirecte: 6,
    antiBlocage: { deplacementMin: 0.3, duree: 8, distanceMin: 3 },
  },

  // Niveaux de qualité graphique (choix mémorisé). ombres : 'non' | 'projecteurs' | 'tout'
  qualite: {
    basse:   { nom: 'Basse',   resolution: 0.7, ombres: 'non',         ssao: false, particules: 0.4, projecteurs: 2 },
    moyenne: { nom: 'Moyenne', resolution: 1,   ombres: 'projecteurs', ssao: false, particules: 1,   projecteurs: 2 },
    haute:   { nom: 'Haute',   resolution: 1,   ombres: 'tout',        ssao: true,  particules: 1,   projecteurs: 4 },
    perf: { seuil: 40, duree: 5 },
  },

  rendu: {
    brouillard: { couleur: 0x0b0f1a, densite: 0.028 },
    exposition: 1.1, intensiteEnvironnement: 0.35, intensiteFond: 0.25,
    bloom: { force: 0.6, rayon: 0.4, seuil: 0.85 },
    finition: { grain: 0.06, vignette: 0.35, aberration: 0.0015, froid: [0.92, 1.0, 1.08] },
    lumieres: {
      projecteur: { couleur: 0xdfe8ff, intensite: 150, portee: 35, angle: 0.6, penombre: 0.5, ombre: 1024 },
      gyrophare: { couleur: 0xff2020, intensite: 80, portee: 30, toursParSeconde: 2 },
      lune: { couleur: 0x8fa6d8, intensite: 0.8, ombre: 2048 },
      lampe: { couleur: 0xfff1d6, intensite: 40, portee: 25, angle: 0.45, penombre: 0.6 },
    },
  },
};
