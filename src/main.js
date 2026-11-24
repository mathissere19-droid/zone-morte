// Zone Morte — assemblage et boucle de jeu.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { appliquerTextures } from './textures.js';
import { construireCarte, mats, appliquerQualiteCarte, majCarte, ouvrirPorte, fermerPortes, hauteurSol } from './carte.js';
import { creerSuiviBlocage } from './regles/blocage.js';
import { creerJoueur, entrees, finImageEntrees } from './joueur.js';
import { creerGrille, marquerObstacles, ligneLibre } from './regles/navigation.js';
import { creerGestionnaireZombies } from './zombies.js';
import { creerArmes } from './armes.js';
import { creerBonus, NOMS_BONUS } from './bonus.js';
import { creerInterface } from './interface.js';
import { creerRendu } from './rendu.js';
import { IDS_QUALITE, creerSurveillancePerf, majSurveillancePerf } from './regles/qualite.js';
import {
  creerPartie, majPartie, peutFaireApparaitre, enregistrerApparition, enregistrerMort,
  tirerBonus, choisirPointApparition, zombiesRestants,
} from './regles/partie.js';
import { subir, majVie, estMort } from './regles/vie.js';
import { IDS_DIFFICULTE, choisirDifficulte, difficulteActive, degatsRecus } from './regles/difficulte.js';
import { creerPortefeuille, gainCoup, crediter, payer, tirageCaisse, acheterMur } from './regles/economie.js';
import { creerInventaire, armeActive, ajouterArme, remplirTout, rendreGrenades } from './regles/inventaire.js';

const modeTest = new URLSearchParams(location.search).has('test');
const ui = creerInterface();
const $ = (id) => document.getElementById(id);

// ---------- Rendu ----------
let rendu;
try {
  rendu = creerRendu($('jeu'));
} catch (e) {
  ui.ecranErreur("Votre navigateur ne peut pas afficher la 3D (WebGL). Activez l'accélération matérielle dans les paramètres de Chrome ou Edge, puis rechargez la page.");
  throw e;
}
const { renderer, scene, camera } = rendu;
scene.add(new THREE.HemisphereLight(0x5a6a8a, 0x1a1a1a, 0.7));
const LUM = CONFIG.rendu.lumieres;
const lune = new THREE.DirectionalLight(LUM.lune.couleur, LUM.lune.intensite);
lune.position.set(-20, 40, 10);
lune.target.position.set(9, 0, -9);
Object.assign(lune.shadow.camera, { left: -35, right: 35, top: 35, bottom: -35, near: 5, far: 100 });
lune.shadow.mapSize.set(LUM.lune.ombre, LUM.lune.ombre);
lune.shadow.bias = -0.0005;
scene.add(lune, lune.target);

// Lampe torche (F), attachée à la caméra ; éteinte = intensité 0 (évite de recompiler les matériaux)
const lampe = { allumee: false, lumiere: new THREE.SpotLight(LUM.lampe.couleur, 0, LUM.lampe.portee, LUM.lampe.angle, LUM.lampe.penombre, 1.6) };
lampe.lumiere.position.set(0.05, -0.05, -0.75); // devant l'arme : elle reste hors du faisceau
lampe.lumiere.target.position.set(0.05, -0.05, -6);
lampe.lumiere.shadow.mapSize.set(1024, 1024);
camera.add(lampe.lumiere, lampe.lumiere.target);
function basculerLampe(etat = !lampe.allumee) {
  lampe.allumee = etat;
  lampe.lumiere.intensity = etat ? LUM.lampe.intensite : 0;
}

addEventListener('resize', () => rendu.redimensionner());

// Qualité graphique : mémorisée ; en mode test, Basse par défaut (rendu logiciel lent)
const CLE_QUALITE = 'zoneMorte.qualite';
const parametresUrl = new URLSearchParams(location.search);
let qualiteInitiale = 'moyenne';
try { if (IDS_QUALITE.includes(localStorage.getItem(CLE_QUALITE))) qualiteInitiale = localStorage.getItem(CLE_QUALITE); } catch { /* stockage indisponible */ }
if (modeTest) qualiteInitiale = IDS_QUALITE.includes(parametresUrl.get('qualite')) ? parametresUrl.get('qualite') : 'basse';
function changerQualite(id) {
  if (!IDS_QUALITE.includes(id)) return;
  rendu.appliquerQualite(id);
  if (!modeTest) try { localStorage.setItem(CLE_QUALITE, id); } catch { /* idem */ }
  ui.marquerQualite(id);
}
const surveillancePerf = creerSurveillancePerf();

// ---------- Monde ----------
const carte = construireCarte(scene);
rendu.surQualite((p) => {
  appliquerQualiteCarte(carte, p);
  lune.castShadow = p.ombres === 'tout';
  lampe.lumiere.castShadow = p.ombres === 'tout';
});
appliquerTextures(mats, renderer);
const grille = creerGrille({ minX: -18, minZ: -36, largeur: 54, profondeur: 54, taille: 0.5 });
marquerObstacles(grille, carte.navObstacles);
carte.surChangement = () => marquerObstacles(grille, carte.navObstacles);

const joueur = creerJoueur(camera, renderer.domElement);
const zombies = creerGestionnaireZombies(scene, carte, grille);
const bonus = creerBonus(scene);

let partie, portefeuille, inventaire, doubles = 0, delaiApparition = 0;
inventaire = creerInventaire();

const armes = creerArmes({
  camera, scene, inventaire, joueur,
  cibles: () => zombies.cibles(),
  obstacles: () => carte.obstaclesVisibles,
  surTouche: toucherZombie,
  surJoueurTouche: (d) => blesserJoueur(d, { brut: true }),
  surExplosionVisuelle: explosionVisuelle,
});

// ---------- Record ----------
// Un record par difficulté ; l'ancien record (avant les difficultés) compte pour Soldat.
const CLE_RECORD = 'zoneMorte.record';
const CLE_DIFFICULTE = 'zoneMorte.difficulte';
function lireRecord(id) {
  try {
    const v = Number(localStorage.getItem(CLE_RECORD + '.' + id)) || 0;
    return id === 'soldat' ? Math.max(v, Number(localStorage.getItem(CLE_RECORD)) || 0) : v;
  } catch { return 0; }
}
function ecrireRecord(id, v) {
  try { localStorage.setItem(CLE_RECORD + '.' + id, String(v)); } catch { /* stockage indisponible */ }
}
let difficulteChoisie = 'soldat';
try { if (IDS_DIFFICULTE.includes(localStorage.getItem(CLE_DIFFICULTE))) difficulteChoisie = localStorage.getItem(CLE_DIFFICULTE); } catch { /* idem */ }
function selectionnerDifficulte(id) {
  difficulteChoisie = IDS_DIFFICULTE.includes(id) ? id : 'soldat';
  try { localStorage.setItem(CLE_DIFFICULTE, difficulteChoisie); } catch { /* idem */ }
}
function afficherMenu() {
  ui.ecranMenu(Object.fromEntries(IDS_DIFFICULTE.map((id) => [id, lireRecord(id)])), difficulteChoisie);
}

// ---------- Combat ----------
function toucherZombie(z, degats, { tete = false, couteau = false, brulure = false } = {}) {
  if (jeu.etat !== 'partie' || z.mort) return;
  const mortel = zombies.infliger(z, degats);
  // une touche de brûlure non mortelle ne rapporte rien
  const gain = brulure && !mortel ? 0 : gainCoup({ mortel, tete, couteau }, doubles > 0);
  crediter(portefeuille, gain);
  partie.pointsGagnes += gain;
  if (mortel) {
    enregistrerMort(partie, { tete });
    if (tirerBonus(partie, Math.random)) bonus.lacher(z.position);
  }
}

// brut : dégâts que le joueur s'inflige lui-même (explosions), non modifiés par la difficulté
function blesserJoueur(degats, { brut = false } = {}) {
  subir(joueur.vie, brut ? degats : degatsRecus(degats));
  ui.flashDegats();
}

const explosions = [];
function explosionVisuelle(pos) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.9 }));
  m.position.copy(pos);
  const l = new THREE.PointLight(0xff8030, 40, 15, 2);
  l.position.copy(pos);
  scene.add(m, l);
  explosions.push({ m, l, t: 0.4 });
}

function appliquerBonus(type) {
  ui.annonce(NOMS_BONUS[type], 2);
  if (type === 'munitions') remplirTout(inventaire);
  if (type === 'soin') joueur.vie.pv = CONFIG.joueur.vieMax;
  if (type === 'doubles') doubles = CONFIG.bonus.pointsDoublesDuree;
  if (type === 'explosion') {
    for (const z of zombies.tuerTous()) enregistrerMort(partie, { tete: false });
    crediter(portefeuille, CONFIG.bonus.explosionPoints);
    partie.pointsGagnes += CONFIG.bonus.explosionPoints;
    explosionVisuelle(new THREE.Vector3(joueur.position.x, 1.5, joueur.position.z));
  }
}

// ---------- Interactions (E) ----------
function interactionProche() {
  const p = joueur.position;
  const d = (v) => Math.hypot(v.x - p.x, v.z - p.z);
  let meilleur = null, dMin = 2.2;
  for (const m of carte.mursArmes) if (d(m.position) < dMin) { dMin = d(m.position); meilleur = { type: 'mur', m }; }
  for (const porte of carte.portes) {
    if (porte.ouverte) continue;
    for (const s of porte.segments) if (d(s) < dMin) { dMin = d(s); meilleur = { type: 'porte', porte }; }
  }
  if (d(carte.caisse.position) < dMin) meilleur = { type: 'caisse' };
  return meilleur;
}

const NOMS_ZONES = { hangar: 'le hangar', bunker: 'le bunker', tour: 'la tour radio' };
function texteInvite(i) {
  if (!i) return null;
  if (i.type === 'mur') {
    const nom = CONFIG.armes[i.m.armeId].nom, prix = CONFIG.prixMurs[i.m.armeId];
    return inventaire.armes.some((a) => a.id === i.m.armeId)
      ? `E — Munitions ${nom} (${Math.floor(prix / 2)})` : `E — Acheter ${nom} (${prix})`;
  }
  if (i.type === 'porte') return `E — Ouvrir ${NOMS_ZONES[i.porte.id]} (${i.porte.prix})`;
  return `E — Caisse de ravitaillement (${CONFIG.caisse.prix})`;
}

function interagir() {
  const i = interactionProche();
  if (!i) return;
  if (i.type === 'mur') {
    const r = acheterMur(portefeuille, inventaire, i.m.armeId);
    if (r === 'pas-assez') ui.message('Pas assez de points');
    else if (r === 'plein') ui.message('Munitions déjà pleines');
  } else if (i.type === 'porte') {
    if (payer(portefeuille, i.porte.prix)) ouvrirPorte(carte, i.porte);
    else ui.message('Pas assez de points');
  } else if (payer(portefeuille, CONFIG.caisse.prix)) {
    const id = tirageCaisse(Math.random, inventaire.armes.map((a) => a.id));
    ajouterArme(inventaire, id);
    ui.annonce(CONFIG.armes[id].nom, 2);
  } else ui.message('Pas assez de points');
}

// ---------- Apparitions ----------
const frustum = new THREE.Frustum();
const matriceVue = new THREE.Matrix4();
const pointTest = new THREE.Vector3();
function pointVisible(pt) {
  matriceVue.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  frustum.setFromProjectionMatrix(matriceVue);
  pointTest.set(pt.x, 1, pt.z);
  return frustum.containsPoint(pointTest) && ligneLibre(grille, joueur.position, pt);
}
function pointsApparitionActifs() {
  const r = [];
  for (const z of Object.values(carte.zones)) if (z.debloquee) r.push(...z.pointsApparition);
  return r;
}

// Filet de sécurité : un zombie coincé ressort d'un point d'apparition (sans compter une nouvelle apparition).
function replacerZombie(z) {
  const pt = choisirPointApparition(pointsApparitionActifs(), joueur.position, pointVisible, Math.random);
  z.position.x = pt.x; z.position.z = pt.z; z.position.y = hauteurSol(pt.x, pt.z);
  z.emergence = 0.8; z.chemin = null;
  z.suivi = creerSuiviBlocage(z.position);
}

// ---------- États de jeu ----------
const jeu = {
  etat: 'menu', scene, camera, renderer, modeTest, carte, grille, joueur, zombies, bonus, armes,
  get partie() { return partie; },
  get portefeuille() { return portefeuille; },
  get inventaire() { return inventaire; },
  vitesseTemps: 1,
  accelerer(f) { this.vitesseTemps = f; },
  demarrerPartie, mettreEnPause, reprendre, afficherMenu, toucherZombie, entrees,
  get qualite() { return rendu.qualite; },
  lampe, lune,
  rendu,
  changerQualite,
  tirer: () => armes.tirForce(),
  interagir,
};
window.__jeu = jeu;

function demarrerPartie(idDifficulte) {
  // remise à zéro complète (Rejouer sans recharger la page)
  if (typeof idDifficulte === 'string') selectionnerDifficulte(idDifficulte);
  choisirDifficulte(difficulteChoisie);
  zombies.vider();
  bonus.vider();
  fermerPortes(carte);
  partie = creerPartie();
  portefeuille = creerPortefeuille();
  inventaire = creerInventaire();
  armes.reinitialiser(inventaire);
  armes.vider();
  doubles = 0;
  basculerLampe(false);
  joueur.placer(carte.depart.x, carte.depart.z);
  ui.reinitialiserPoints();
  ui.masquerEcrans();
  jeu.etat = 'partie';
  if (!modeTest) joueur.verrouiller();
}

function mettreEnPause() {
  if (jeu.etat !== 'partie') return;
  jeu.etat = 'pause';
  entrees.gauche = entrees.droite = false;
  ui.ecranPause();
}

function reprendre() {
  if (jeu.etat !== 'pause') return;
  jeu.etat = 'partie';
  ui.masquerEcrans();
  if (!modeTest) joueur.verrouiller();
}

function finDePartie() {
  jeu.etat = 'fin';
  joueur.controles.unlock();
  const d = difficulteActive();
  const record = lireRecord(d.id);
  const nouveau = partie.vague > record;
  if (nouveau) ecrireRecord(d.id, partie.vague);
  ui.ecranFin(partie, Math.max(record, partie.vague), nouveau, d.nom);
}

$('btn-jouer').addEventListener('click', () => demarrerPartie());
$('btn-rejouer').addEventListener('click', () => demarrerPartie());
for (const b of document.querySelectorAll('#choix-difficulte button')) {
  b.addEventListener('click', () => { selectionnerDifficulte(b.dataset.difficulte); afficherMenu(); });
}
$('btn-reprendre').addEventListener('click', reprendre);
$('btn-abandon').addEventListener('click', () => { jeu.etat = 'partie'; finDePartie(); });
joueur.controles.addEventListener('unlock', () => mettreEnPause());
document.addEventListener('visibilitychange', () => { if (document.hidden) mettreEnPause(); });
addEventListener('blur', () => mettreEnPause());
for (const b of document.querySelectorAll('.choix-qualite button')) {
  b.addEventListener('click', () => changerQualite(b.dataset.qualite));
}
changerQualite(qualiteInitiale);
afficherMenu();

// ---------- Boucle ----------
function boucle(dtBrut) {
  const dt = Math.min(dtBrut, 0.1) * jeu.vitesseTemps;
  majCarte(carte, dt);
  ui.maj(dt);

  for (let i = explosions.length - 1; i >= 0; i--) {
    const e = explosions[i];
    e.t -= dt;
    e.m.scale.setScalar(1 + (0.4 - e.t) * 10);
    e.m.material.opacity = Math.max(0, e.t / 0.4);
    e.l.intensity = Math.max(0, e.t * 100);
    if (e.t <= 0) { scene.remove(e.m, e.l); explosions.splice(i, 1); }
  }

  if (jeu.etat === 'partie') {
    joueur.majJoueur(dt, carte.aabbs);
    majVie(joueur.vie, dt, difficulteActive().delaiRegen);
    if (majPartie(partie, dt) === 'vagueCommence') {
      ui.annonce('VAGUE ' + partie.vague, 3);
      rendreGrenades(inventaire);
    }
    delaiApparition -= dt;
    if (delaiApparition <= 0 && peutFaireApparaitre(partie)) {
      const pt = choisirPointApparition(pointsApparitionActifs(), joueur.position, pointVisible, Math.random);
      zombies.faireApparaitre(pt, partie.vague);
      enregistrerApparition(partie);
      delaiApparition = 0.35;
    }
    zombies.majZombies(dt, joueur, (d) => blesserJoueur(d), (z, d) => toucherZombie(z, d, { brulure: true }), replacerZombie);
    armes.majArmes(dt, true);
    bonus.majBonus(dt, joueur, appliquerBonus);
    doubles = Math.max(0, doubles - dt);

    const i = interactionProche();
    ui.invite(texteInvite(i));
    if (entrees.appuis.has('KeyE')) interagir();
    if (entrees.appuis.has('KeyF')) basculerLampe();

    const a = armeActive(inventaire);
    ui.majHUD({
      pv: joueur.vie.pv, vieMax: CONFIG.joueur.vieMax,
      munitions: { nom: CONFIG.armes[a.id].nom, chargeur: a.chargeur, reserve: a.reserve }, grenades: inventaire.grenades,
      points: portefeuille.points, vague: partie.vague, restants: zombiesRestants(partie), doubles,
      stamina: joueur.stamina, staminaMax: CONFIG.joueur.staminaMax,
      dispersion: armes.dispersion * (joueur.vise ? 0.4 : 1), enRechargement: armes.enRechargement,
    });
    if (estMort(joueur.vie)) finDePartie();
  }
  if (jeu.etat === 'partie' && majSurveillancePerf(surveillancePerf, dtBrut, rendu.qualite)) {
    ui.message('Images saccadées : passez en qualité Moyenne (menu pause)', 5);
  }
  finImageEntrees();
  rendu.rendre(dt);
}

let precedent = performance.now();
renderer.setAnimationLoop((t) => {
  const dt = (t - precedent) / 1000;
  precedent = t;
  boucle(dt);
});
