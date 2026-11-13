import * as THREE from 'three';
import { construireCarte, majCarte } from './carte.js';
import { creerJoueur, finImageEntrees } from './joueur.js';
import { creerGrille, marquerObstacles, ligneLibre } from './regles/navigation.js';
import { creerGestionnaireZombies } from './zombies.js';
import { creerPartie, majPartie, peutFaireApparaitre, enregistrerApparition, choisirPointApparition } from './regles/partie.js';
import { subir, majVie, estMort } from './regles/vie.js';

const conteneur = document.getElementById('jeu');
const modeTest = new URLSearchParams(location.search).has('test');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = false;
conteneur.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0f1a);
scene.fog = new THREE.FogExp2(0x0b0f1a, 0.03);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 200);
scene.add(camera);

scene.add(new THREE.HemisphereLight(0x5a6a8a, 0x1a1a1a, 0.7));
const lune = new THREE.DirectionalLight(0x8899cc, 0.6);
lune.position.set(-20, 40, 10);
scene.add(lune);

const carte = construireCarte(scene);
const grille = creerGrille({ minX: -18, minZ: -36, largeur: 54, profondeur: 54, taille: 0.5 });
marquerObstacles(grille, carte.navObstacles);
carte.surChangement = () => marquerObstacles(grille, carte.navObstacles);

const joueur = creerJoueur(camera, renderer.domElement);
const zombies = creerGestionnaireZombies(scene, carte, grille);
let partie = creerPartie();
let delaiApparition = 0;
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
joueur.placer(carte.depart.x, carte.depart.z);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const jeu = {
  etat: 'menu', scene, camera, renderer, modeTest, carte, grille, joueur, zombies,
  get partie() { return partie; },
  vitesseTemps: 1,
  accelerer(f) { this.vitesseTemps = f; },
  demarrerPartie,
};
window.__jeu = jeu;

const $ = (id) => document.getElementById(id);

function demarrerPartie() {
  joueur.placer(carte.depart.x, carte.depart.z);
  zombies.vider();
  partie = creerPartie();
  jeu.etat = 'partie';
  $('ecran-menu').classList.add('cache');
  $('hud').classList.remove('cache');
  if (!modeTest) joueur.verrouiller();
}

$('btn-jouer').addEventListener('click', demarrerPartie);

function finDePartie() {
  jeu.etat = 'fin';
  joueur.controles.unlock();
  $('hud').classList.add('cache');
  $('ecran-fin').classList.remove('cache');
}

function boucle(dt) {
  dt = Math.min(dt, 0.1) * jeu.vitesseTemps;
  majCarte(carte, dt);
  if (jeu.etat === 'partie') {
    joueur.majJoueur(dt, carte.aabbs);
    majVie(joueur.vie, dt);
    majPartie(partie, dt);
    delaiApparition -= dt;
    if (delaiApparition <= 0 && peutFaireApparaitre(partie)) {
      const pt = choisirPointApparition(pointsApparitionActifs(), joueur.position, pointVisible, Math.random);
      zombies.faireApparaitre(pt, partie.vague);
      enregistrerApparition(partie);
      delaiApparition = 0.35;
    }
    zombies.majZombies(dt, joueur, (degats) => subir(joueur.vie, degats));
    if (estMort(joueur.vie)) finDePartie();
  }
  finImageEntrees();
  renderer.render(scene, camera);
}

let precedent = performance.now();
renderer.setAnimationLoop((t) => {
  const dt = (t - precedent) / 1000;
  precedent = t;
  boucle(dt);
});
