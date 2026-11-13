import * as THREE from 'three';
import { construireCarte, majCarte } from './carte.js';
import { creerJoueur, finImageEntrees } from './joueur.js';
import { creerGrille, marquerObstacles } from './regles/navigation.js';

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
joueur.placer(carte.depart.x, carte.depart.z);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const jeu = {
  etat: 'menu', scene, camera, renderer, modeTest, carte, grille, joueur,
  vitesseTemps: 1,
  accelerer(f) { this.vitesseTemps = f; },
  demarrerPartie,
};
window.__jeu = jeu;

const $ = (id) => document.getElementById(id);

function demarrerPartie() {
  joueur.placer(carte.depart.x, carte.depart.z);
  jeu.etat = 'partie';
  $('ecran-menu').classList.add('cache');
  $('hud').classList.remove('cache');
  if (!modeTest) joueur.verrouiller();
}

$('btn-jouer').addEventListener('click', demarrerPartie);

function boucle(dt) {
  dt = Math.min(dt, 0.1) * jeu.vitesseTemps;
  majCarte(carte, dt);
  if (jeu.etat === 'partie') {
    joueur.majJoueur(dt, carte.aabbs);
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
