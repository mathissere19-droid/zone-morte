// Zombies Mixamo : chargement des GLB et instances animées.
// Une instance expose la même interface que le modèle en boîtes (zombies.js) :
// { g, touchables, feu, animer(anim, dt), jouerMort(rng), dureeAnimation(nom), tempsAnimation(),
//   retirerTete(), passerRampeur(), ombres(bool), dureeEmergence, enterre }
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { CONFIG } from './config.js';

const A = CONFIG.zombie.animation;
const FICHIERS = ['zombie1', 'zombie2', 'boss'];

// Ne rejette jamais : null si aucun modèle n'a pu être chargé.
export async function chargerModelesZombies(url = 'assets/zombies/') {
  const chargeur = new GLTFLoader();
  const charges = await Promise.all(FICHIERS.map((n) => chargeur.loadAsync(url + n + '.glb').catch(() => null)));
  const [z1, z2, boss] = charges.map((g) => (g && g.animations.length ? g : null));
  const zombies = [z1, z2].filter(Boolean);
  if (!zombies.length && !boss) return null;
  return { zombies, boss };
}

const geoTete = new THREE.SphereGeometry(0.13, 8, 6);
const geoBuste = new THREE.BoxGeometry(0.45, 0.6, 0.3);
const geoCuisse = new THREE.BoxGeometry(0.19, 0.45, 0.19);
const geoMollet = new THREE.BoxGeometry(0.15, 0.45, 0.15);
const matInvisible = new THREE.MeshBasicMaterial({ visible: false });
const geoFeu = new THREE.SphereGeometry(0.45, 10, 8);
const matFeu = new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending });
const vTmp = new THREE.Vector3();

function trouverOs(racine, suffixe) {
  let r = null;
  racine.traverse((o) => { if (!r && o.isBone && (o.name === suffixe || o.name.endsWith(':' + suffixe) || o.name === 'mixamorig' + suffixe)) r = o; });
  return r;
}

// Boîte de zone invisible (mais touchable) attachée à un os, décalée de 'haut' mètres le long de l'os.
function attacherZone(os, geo, zone, haut) {
  const m = new THREE.Mesh(geo, matInvisible);
  os.getWorldScale(vTmp);
  const k = 1 / vTmp.x;
  m.scale.setScalar(k);
  m.position.set(0, haut * k, 0);
  m.userData.zone = zone;
  os.add(m);
  return m;
}

// modeles : résultat de chargerModelesZombies ; repli : fabrique du modèle en boîtes.
export function creerModeleZombie(modeles, { boss = false, rng = Math.random, repli }) {
  const choix = boss && modeles?.boss ? modeles.boss
    : modeles?.zombies.length ? modeles.zombies[Math.floor(rng() * modeles.zombies.length)] : modeles?.boss;
  if (!choix) return repli(rng);

  const racine = SkeletonUtils.clone(choix.scene);
  const g = new THREE.Group();
  g.add(racine);
  const echelle = boss ? 1 : 0.92 + rng() * 0.16;
  racine.scale.multiplyScalar(echelle);
  const teinte = boss ? 0.8 : 0.85 + rng() * 0.25;
  const maillages = [];
  racine.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = false; // la boîte englobante du maillage animé ne suit pas la pose
    o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
    for (const m of [].concat(o.material)) m.color?.multiplyScalar(teinte);
    maillages.push(o);
  });
  g.updateMatrixWorld(true);

  const os = {};
  for (const n of ['Head', 'Spine1', 'LeftUpLeg', 'RightUpLeg', 'LeftLeg', 'RightLeg']) os[n] = trouverOs(racine, n);
  const tete = attacherZone(os.Head, geoTete, 'tete', 0.08);
  const buste = attacherZone(os.Spine1, geoBuste, 'corps', 0.05);
  const jambes = [
    attacherZone(os.LeftUpLeg, geoCuisse, 'jambes', 0.22), attacherZone(os.RightUpLeg, geoCuisse, 'jambes', 0.22),
    attacherZone(os.LeftLeg, geoMollet, 'jambes', 0.22), attacherZone(os.RightLeg, geoMollet, 'jambes', 0.22),
  ];
  const touchables = [tete, buste, ...jambes];

  const feu = new THREE.Mesh(geoFeu, matFeu);
  feu.position.y = 1.1; feu.scale.set(1, 1.8, 1); feu.visible = false;
  g.add(feu);

  const mixer = new THREE.AnimationMixer(racine);
  const actions = {};
  for (const clip of choix.animations) actions[clip.name] = mixer.clipAction(clip);
  for (const n of ['mort1', 'mort2']) {
    if (!actions[n]) continue;
    actions[n].setLoop(THREE.LoopOnce, 1);
    actions[n].clampWhenFinished = true;
  }
  const vitesseClip = (nom) => A.vitesseClip[nom] ?? 1;
  let courante = null, nomCourant = null;

  const modele = {
    g, touchables, feu, glb: true,
    dureeEmergence: A.emergence, enterre: false,
    teteRetiree: false, rampe: false,

    jouer(nom, vitesse = 1) {
      const a = actions[nom];
      if (!a) return;
      if (nom !== nomCourant) {
        a.reset().play();
        if (courante) a.crossFadeFrom(courante, A.fondu, false);
        courante = a; nomCourant = nom;
      }
      a.timeScale = nom === 'sortie' ? a.getClip().duration / modele.dureeEmergence : vitesse * vitesseClip(nom);
    },

    animer(anim, dt) {
      if (anim) modele.jouer(anim.nom, anim.vitesse);
      mixer.update(dt);
      if (modele.teteRetiree) os.Head.scale.setScalar(0.001); // les pistes d'animation réécrivent l'échelle
    },

    jouerMort(rngMort = Math.random) {
      modele.jouer(rngMort() < 0.5 ? 'mort1' : 'mort2', 1);
    },

    // durée réelle (en s de jeu) d'une animation à vitesse 1
    dureeAnimation(nom) {
      const a = actions[nom];
      if (!a) return 0;
      return a.getClip().duration * (nom === 'attaque' ? A.coupeAttaque : 1) / vitesseClip(nom);
    },

    // reprend l'animation courante au début (nouveau coup)
    relancer() {
      if (courante) courante.time = 0;
    },

    // temps écoulé dans l'animation courante (en s de jeu, à vitesse 1)
    tempsAnimation() {
      return courante ? courante.time / vitesseClip(nomCourant) : 0;
    },

    get animation() { return nomCourant; },

    retirerTete() {
      modele.teteRetiree = true;
      os.Head.scale.setScalar(0.001);
    },

    passerRampeur() {
      modele.rampe = true;
      for (const j of jambes) {
        const i = touchables.indexOf(j);
        if (i >= 0) touchables.splice(i, 1);
      }
    },

    positionTete(cible = new THREE.Vector3()) {
      return os.Head.getWorldPosition(cible);
    },

    ombres(actif) {
      for (const m of maillages) m.castShadow = actif;
    },
  };
  return modele;
}
