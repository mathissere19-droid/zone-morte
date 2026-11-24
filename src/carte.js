// Base militaire abandonnée (jalon 1 : formes simples).
// Repère : x vers l'est, z vers le sud (nord = -z). Zone jouable : x[-18,36] z[-36,18].
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { uvEnMetres } from './uv.js';
import * as D from './decors.js';
import { hauteurSurfaces, liensAuto } from './regles/surfaces.js';

const EP = 0.4; // épaisseur des murs

export const mats = {
  asphalte: new THREE.MeshStandardMaterial({ color: 0x2c2d30, roughness: 0.95 }),
  beton: new THREE.MeshStandardMaterial({ color: 0x55534e, roughness: 0.9 }),
  betonSombre: new THREE.MeshStandardMaterial({ color: 0x3b3a37, roughness: 0.9 }),
  tole: new THREE.MeshStandardMaterial({ color: 0x4d5a52, roughness: 0.7, metalness: 0.4 }),
  sable: new THREE.MeshStandardMaterial({ color: 0x6b6250, roughness: 1 }),
  kaki: new THREE.MeshStandardMaterial({ color: 0x4a5236, roughness: 0.85 }),
  bois: new THREE.MeshStandardMaterial({ color: 0x6a5134, roughness: 0.9 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x777b80, roughness: 0.5, metalness: 0.7 }),
  rouille: new THREE.MeshStandardMaterial({ color: 0x6e3b22, roughness: 0.8, metalness: 0.3 }),
  porte: new THREE.MeshStandardMaterial({ color: 0x8a6d1c, roughness: 0.6, metalness: 0.3 }),
  porteBande: new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.6 }),
  caisse: new THREE.MeshStandardMaterial({ color: 0x3d5a2a, roughness: 0.7, emissive: 0x0a2a05 }),
  murArme: new THREE.MeshStandardMaterial({ color: 0xd9c38a, emissive: 0x3a2f10, roughness: 0.6 }),
  dehors: new THREE.MeshStandardMaterial({ color: 0x1b1d1c, roughness: 1 }),
  solHangar: new THREE.MeshStandardMaterial({ color: 0x4a4946, roughness: 0.9 }),
  sacs: new THREE.MeshStandardMaterial({ color: 0x8a7b58, roughness: 1 }),
  bache: new THREE.MeshStandardMaterial({ color: 0x4a5236, roughness: 0.95 }),
  conteneurA: new THREE.MeshStandardMaterial({ color: 0x7a3a2a, roughness: 0.7, metalness: 0.4 }),
  conteneurB: new THREE.MeshStandardMaterial({ color: 0x3a5068, roughness: 0.7, metalness: 0.4 }),
  grillage: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0.5, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }),
};

// Plateforme et rampe de la tour radio
const PLATEFORME = { minX: 25, maxX: 31, minZ: -31, maxZ: -25, h: 3 };
// Zone sous le plafond bas du bunker : ses décors ne s'escaladent pas (la tête passerait au travers)
const SOUS_PLAFOND = { minX: 14, maxX: 36, minZ: -12, maxZ: 18 };

// Surfaces de la dernière carte construite (une seule carte par partie)
let surfacesCourantes = [];

// Hauteur du sol sous (x, z) pour quelqu'un qui se trouve à la hauteur y (on ne monte que des marches de 0,35 m)
export function hauteurSol(x, z, y = 0) {
  return hauteurSurfaces(surfacesCourantes, x, z, y).h;
}

export function construireCarte(scene) {
  const carte = {
    aabbs: [],          // collisions joueur
    aabbsZombies: [],   // collisions zombies (+ bords de plateforme)
    navObstacles: [],   // obstacles pour la grille de navigation
    zones: {
      cour: { debloquee: true, pointsApparition: [{ x: -16, z: -10 }, { x: -16, z: 16 }, { x: 11, z: 16 }, { x: 2, z: 16 }] },
      hangar: { debloquee: false, pointsApparition: [{ x: -16, z: -34 }, { x: 6, z: -34 }, { x: -16, z: -20 }] },
      bunker: { debloquee: false, pointsApparition: [{ x: 34, z: 16 }, { x: 34, z: -10 }, { x: 20.5, z: 16 }] },
      tour: { debloquee: false, pointsApparition: [{ x: 34, z: -34 }, { x: 11, z: -34 }] },
    },
    portes: [],
    mursArmes: [],
    caisse: null,
    depart: { x: -5, z: 5 },
    obstaclesVisibles: [],
    lumieresVacillantes: [],
    projecteurs: [],
    gyrophare: null,
    surChangement: null,
    surfaces: [],        // dessus des décors, toits, passerelle, rampe (regles/surfaces.js)
    echelles: [],
    liens: [],           // liens d'escalade des zombies
    sourcesLumiere: [],  // { x, z, rayon } : hors de ces cercles, on est dans l'ombre
  };
  surfacesCourantes = carte.surfaces;
  const E = CONFIG.escalade;

  // Surface au sommet d'un obstacle posé au sol
  function surface(minX, maxX, minZ, maxZ, h, options = {}) {
    const sousPlafond = minX >= SOUS_PLAFOND.minX && maxX <= SOUS_PLAFOND.maxX && minZ >= SOUS_PLAFOND.minZ && maxZ <= SOUS_PLAFOND.maxZ && h < 2.9;
    const ilot = !sousPlafond && h >= E.hauteurIlot;
    const s = { id: 's' + carte.surfaces.length, minX, maxX, minZ, maxZ, h, ilot, liensAuto: ilot, grimpable: !sousPlafond, ...options };
    carte.surfaces.push(s);
    return s;
  }

  // Échelle collée à un mur ; face = normale vers le joueur ; sortie = point d'arrivée en haut
  function echelle(minX, maxX, minZ, maxZ, haut, face, sortie, idSurface) {
    const e = { minX, maxX, minZ, maxZ, bas: 0, haut, face, sortie };
    carte.echelles.push(e);
    carte.liens.push({ bas: { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 }, haut: { ...sortie, h: haut }, duree: E.lienEchelle, surface: idSurface });
    const modele = D.echelle(mats, haut);
    modele.position.set((minX + maxX) / 2 - face.x * 0.25, 0, (minZ + maxZ) / 2 - face.z * 0.25);
    modele.rotation.y = Math.atan2(face.x, face.z);
    groupe.add(modele);
    return e;
  }

  const groupe = new THREE.Group();
  scene.add(groupe);

  function boite(minX, maxX, minZ, maxZ, minY, maxY, mat, { collision = true, nav = true, zombies = true, dessus = collision && minY <= 0.35 && maxY <= 3 } = {}) {
    const g = uvEnMetres(new THREE.BoxGeometry(maxX - minX, maxY - minY, maxZ - minZ), { x: maxX - minX, y: maxY - minY, z: maxZ - minZ });
    const m = new THREE.Mesh(g, mat);
    m.position.set((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);
    m.castShadow = m.receiveShadow = true;
    groupe.add(m);
    carte.obstaclesVisibles.push(m);
    const b = { minX, maxX, minZ, maxZ, minY, maxY };
    if (collision) carte.aabbs.push(b);
    if (zombies) carte.aabbsZombies.push(b);
    if (nav) carte.navObstacles.push(b);
    if (dessus) surface(minX, maxX, minZ, maxZ, maxY);
    return { mesh: m, aabb: b };
  }

  // Décor détaillé : collision = boîte englobante, maillages = modèle de decors.js (arrêtent les balles)
  function decor(fabrique, minX, maxX, minZ, maxZ, h, ...options) {
    const b = { minX, maxX, minZ, maxZ, minY: 0, maxY: h };
    carte.aabbs.push(b); carte.aabbsZombies.push(b); carte.navObstacles.push(b);
    surface(minX, maxX, minZ, maxZ, h);
    const modele = fabrique(mats, { dx: maxX - minX, dz: maxZ - minZ }, h, ...options);
    modele.position.set((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
    groupe.add(modele);
    modele.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = o.receiveShadow = true;
      carte.obstaclesVisibles.push(o);
    });
    return b;
  }

  // Mur entre (x1,z1) et (x2,z2) (horizontal ou vertical), avec ouvertures [a,b] le long de l'axe
  function mur(x1, z1, x2, z2, h, mat, ouvertures = []) {
    const horiz = z1 === z2;
    const a0 = horiz ? Math.min(x1, x2) : Math.min(z1, z2);
    const a1 = horiz ? Math.max(x1, x2) : Math.max(z1, z2);
    const trous = [...ouvertures].sort((p, q) => p[0] - q[0]);
    let debut = a0;
    for (const [o0, o1] of [...trous, [a1, a1]]) {
      if (o0 > debut) {
        if (horiz) boite(debut, o0, z1 - EP / 2, z1 + EP / 2, 0, h, mat, { dessus: false });
        else boite(x1 - EP / 2, x1 + EP / 2, debut, o0, 0, h, mat, { dessus: false });
      }
      debut = Math.max(debut, o1);
    }
  }

  function sol(minX, maxX, minZ, maxZ, mat, y = 0.001) {
    const m = new THREE.Mesh(uvEnMetres(new THREE.PlaneGeometry(maxX - minX, maxZ - minZ), { x: maxX - minX, z: maxZ - minZ }), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set((minX + maxX) / 2, y, (minZ + maxZ) / 2);
    m.receiveShadow = true;
    groupe.add(m);
    carte.obstaclesVisibles.push(m);
  }

  function porte(id, segments, debloque) {
    const p = { id, prix: CONFIG.prixPortes[id], aabbs: [], meshes: [], ouverte: false, debloque, position: new THREE.Vector3(), parent: groupe, solides: [] };
    for (const s of segments) {
      const { mesh, aabb } = boite(s.minX, s.maxX, s.minZ, s.maxZ, 0, 2.6, mats.porte, { dessus: false });
      p.aabbs.push(aabb);
      p.meshes.push(mesh);
      p.solides.push(mesh);
      // bandes noires de signalisation
      for (let i = 0; i < 3; i++) {
        const bande = new THREE.Mesh(new THREE.BoxGeometry(
          s.maxX - s.minX + 0.02, 0.25, s.maxZ - s.minZ + 0.02), mats.porteBande);
        bande.position.set(mesh.position.x, 0.5 + i * 0.8, mesh.position.z);
        groupe.add(bande);
        p.meshes.push(bande);
      }
      p.position.add(mesh.position);
    }
    p.position.divideScalar(segments.length);
    p.segments = segments.map((s) => ({ x: (s.minX + s.maxX) / 2, z: (s.minZ + s.maxZ) / 2 }));
    carte.portes.push(p);
    return p;
  }

  function murArme(armeId, x, z, normaleX, normaleZ) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(normaleX ? 0.05 : 1.6, 0.5, normaleZ ? 0.05 : 1.6), mats.murArme);
    m.position.set(x, 1.5, z);
    groupe.add(m);
    carte.mursArmes.push({ armeId, position: new THREE.Vector3(x + normaleX * 0.6, 1.5, z + normaleZ * 0.6), mesh: m });
  }

  function lumiere(x, y, z, couleur = 0xffd9a0, intensite = 25, portee = 22, vacille = false) {
    const l = new THREE.PointLight(couleur, intensite, portee, 1.6);
    l.position.set(x, y, z);
    groupe.add(l);
    const ampoule = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), new THREE.MeshBasicMaterial({ color: couleur }));
    ampoule.position.copy(l.position);
    groupe.add(ampoule);
    if (vacille) carte.lumieresVacillantes.push({ l, base: intensite, t: Math.random() * 10 });
    carte.sourcesLumiere.push({ x, z, rayon: portee * 0.5 });
    return l;
  }

  // Projecteur sur mât : SpotLight orienté vers `cible` ; rang = ordre d'allumage selon la qualité
  const matAmpoule = new THREE.MeshBasicMaterial({ color: 0xf4f8ff });
  function projecteur(x, z, h, cible, rang) {
    const P = CONFIG.rendu.lumieres.projecteur;
    boite(x - 0.15, x + 0.15, z - 0.15, z + 0.15, 0, h, mats.metal);
    const tete = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.35, 0.5), mats.metal);
    tete.position.set(x, h + 0.1, z);
    tete.lookAt(cible.x, 0, cible.z);
    groupe.add(tete);
    const verre = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.28), matAmpoule);
    verre.position.set(0, 0, 0.26);
    tete.add(verre);
    const l = new THREE.SpotLight(P.couleur, P.intensite, P.portee, P.angle, P.penombre, 1.6);
    l.position.set(x, h, z);
    l.target.position.set(cible.x, 0, cible.z);
    l.shadow.mapSize.set(P.ombre, P.ombre);
    l.shadow.bias = -0.0004;
    groupe.add(l, l.target);
    carte.projecteurs.push({ lumiere: l, verre, rang });
    carte.sourcesLumiere.push({ x: cible.x, z: cible.z, rayon: 7 });
  }

  // ---------- Sols ----------
  sol(-60, 80, -80, 60, mats.dehors, 0);
  sol(-18, 14, -12, 18, mats.asphalte);
  sol(-18, 8, -36, -12, mats.solHangar);
  sol(14, 36, -12, 18, mats.betonSombre);
  sol(8, 36, -36, -12, mats.sable);

  // ---------- Murs extérieurs ----------
  mur(-18, -36, -18, 18, 4, mats.beton);
  mur(36, -36, 36, 18, 4, mats.beton);
  mur(-18, -36, 36, -36, 4, mats.beton);
  mur(-18, 18, 36, 18, 4, mats.beton);
  // grillage décoratif au-dessus des murs de la cour
  for (const [x1, z1, x2, z2] of [[-18, -12, -18, 18], [-18, 18, 14, 18]]) {
    const long = Math.hypot(x2 - x1, z2 - z1);
    const g = new THREE.Mesh(uvEnMetres(new THREE.PlaneGeometry(long, 2), { x: long, z: 2 }), mats.grillage);
    g.position.set((x1 + x2) / 2, 5, (z1 + z2) / 2);
    if (x1 === x2) g.rotation.y = Math.PI / 2;
    groupe.add(g);
  }

  // ---------- Murs intérieurs avec portes ----------
  // ligne z = -12 : hangar | (mur plein) | tour/bunker
  mur(-18, -12, 36, -12, 4, mats.beton, [[-6, -2], [24, 27]]);
  // ligne x = 8 : hangar | tour
  mur(8, -36, 8, -12, 4, mats.tole, [[-26, -23]]);
  // ligne x = 14 : cour | bunker
  mur(14, -12, 14, 8, 4, mats.betonSombre, [[2, 5]]);
  mur(14, 8, 14, 18, 2.9, mats.betonSombre);            // plus bas : on monte sur le toit du bunker par l'échelle

  const pHangar = porte('hangar', [{ minX: -6, maxX: -2, minZ: -12 - EP / 2, maxZ: -12 + EP / 2 }], ['hangar']);
  const pBunker = porte('bunker', [{ minX: 14 - EP / 2, maxX: 14 + EP / 2, minZ: 2, maxZ: 5 }], ['bunker']);
  porte('tour', [
    { minX: 8 - EP / 2, maxX: 8 + EP / 2, minZ: -26, maxZ: -23 },
    { minX: 24, maxX: 27, minZ: -12 - EP / 2, maxZ: -12 + EP / 2 },
  ], ['tour']);
  void pHangar; void pBunker;

  // ---------- Cour ----------
  decor(D.camionRenverse, -8.5, -4, 8, 10.5, 2.6);         // camion renversé
  decor(D.cabine, -10, -8.5, 7.5, 11, 1.8);                // cabine
  decor(D.muretSacs, 4, 7, -6, -5.2, 1.0);                 // sacs de sable
  decor(D.muretSacs, 6.2, 7, -5.2, -3, 1.0);
  boite(-14, -12, -4, -2, 0, 1.2, mats.bois);              // caisses
  boite(-14, -12.8, -2, -0.8, 0, 2.4, mats.bois);
  decor(D.barils, 8, 9.2, 10, 11.2, 1.2);                  // barils
  decor(D.barils, 9.4, 10.6, 10, 11.2, 1.2);
  // nouveaux décors de la cour
  decor(D.conteneur, -15, -12.6, 6, 12, 2.6, mats.conteneurA);
  decor(D.conteneur, 4, 10, -10, -7.6, 2.6, mats.conteneurB);
  decor(D.muretSacs, -2, 2, 12, 12.6, 1.0);
  decor(D.jeep, 6, 9.5, 4, 5.8, 1.5);
  decor(D.palettes, -8, -6.8, -8, -6.8, 0.6);
  decor(D.barils, 11, 12.2, -10, -8.8, 1.2);
  projecteur(0.15, 0.15, 7, { x: -6, z: 8 }, 0);          // mâts de projecteurs
  projecteur(-12, -9, 6, { x: -4, z: -2 }, 2);
  lumiere(-16, 3.5, 16, 0xffb070, 12, 14, true);
  murArme('mitraillette', -18 + EP / 2, 4, 1, 0);
  murArme('revolver', -8, 18 - EP / 2, 0, -1);        // mur sud de la cour

  // ---------- Hangar ----------
  const toit = new THREE.Mesh(uvEnMetres(new THREE.BoxGeometry(26, 0.3, 24), { x: 26, y: 0.3, z: 24 }), mats.tole);
  toit.position.set(-5, 8, -24);
  groupe.add(toit);
  mur(-18, -36, -18, -12, 8, mats.tole);
  for (const [x, z] of [[-10, -18], [0, -18], [-10, -30], [0, -30]]) boite(x, x + 0.5, z, z + 0.5, 0, 8, mats.metal); // piliers
  decor(D.vehiculeBache, -14, -7, -28, -24, 2.2);          // véhicules bâchés
  decor(D.vehiculeBache, -2, 4, -22, -19, 1.6);
  decor(D.pileCaisses, -6, -3, -35, -33, 2.0);
  decor(D.barils, 5, 6.2, -16, -14.8, 1.2);
  boite(2, 4, -33, -31, 0, 1.4, mats.bois);
  boite(-17.5, 7.5, -35.5, -34, 3, 3.2, mats.metal, { collision: false, nav: false, zombies: false }); // passerelle
  const passerelle = surface(-17.5, 7.5, -35.5, -34, 3.2, { ilot: true, liensAuto: false });
  echelle(-12, -11, -34, -33.4, 3.2, { x: 0, z: 1 }, { x: -11.5, z: -34.8 }, passerelle.id);
  echelle(5, 6, -34, -33.4, 3.2, { x: 0, z: 1 }, { x: 5.5, z: -34.8 }, passerelle.id);
  lumiere(-5, 7, -24, 0xffe0b0, 30, 26, true);
  projecteur(-15, -14.5, 6, { x: -6, z: -24 }, 3);
  murArme('pompe', -18 + EP / 2, -24, 1, 0);
  const caisse = boite(-1, 1, -34.5, -33.5, 0, 1, mats.caisse, { nav: true });
  carte.caisse = { position: new THREE.Vector3(0, 1, -33), mesh: caisse.mesh };

  // ---------- Bunker (plafond bas) ----------
  const plafond = new THREE.Mesh(uvEnMetres(new THREE.BoxGeometry(22, 0.3, 30), { x: 22, y: 0.3, z: 30 }), mats.betonSombre);
  plafond.position.set(25, 2.75, 3);
  groupe.add(plafond);
  mur(22, -12, 22, 6, 2.6, mats.betonSombre, [[-9.6, -8.6]]);
  boite(21, 23, -9.6, -8.6, 1.2, 2.6, mats.metal);       // conduit d'aération : on passe accroupi (pas les zombies)
  const toitBunker = surface(14, 36, -12, 18, 2.9, { ilot: true, liensAuto: false, grimpable: true });
  echelle(13.2, 13.8, 12, 13, 2.9, { x: -1, z: 0 }, { x: 14.6, z: 12.5 }, toitBunker.id);
  mur(26, 10, 36, 10, 2.6, mats.betonSombre);
  mur(14, -4, 18, -4, 2.6, mats.betonSombre);
  boite(28, 32, 0, 2, 0, 1.0, mats.metal);                 // table de commandement
  boite(17, 19, 12, 16, 0, 1.6, mats.bois);
  decor(D.armoireRenversee, 24, 26, 12, 13, 0.8);
  decor(D.bureauRenverse, 16, 18, -8, -7, 0.9);
  decor(D.armoireRenversee, 33, 35, -2, -1.4, 0.8);
  lumiere(18, 2.4, 0, 0x9fffd0, 8, 12, true);
  lumiere(29, 2.4, 14, 0x9fffd0, 8, 12, true);
  lumiere(29, 2.4, -6, 0xff6040, 6, 10, true);
  murArme('assaut', 36 - EP / 2, 4, -1, 0);
  murArme('semiAuto', 20, -36 + EP / 2, 0, 1);         // mur nord, zone de la tour

  // ---------- Tour radio ----------
  boite(PLATEFORME.minX, PLATEFORME.maxX, PLATEFORME.minZ, PLATEFORME.maxZ, 0, PLATEFORME.h, mats.betonSombre, { zombies: false, nav: false, dessus: false });
  surface(PLATEFORME.minX, PLATEFORME.maxX, PLATEFORME.minZ, PLATEFORME.maxZ, PLATEFORME.h, { ilot: false, liensAuto: false });
  surface(20, 25, -29, -27, PLATEFORME.h, { ilot: false, liensAuto: false, pente: { axe: 'x', de: 20, a: 25, h0: 0, h1: PLATEFORME.h } });
  // bords de la plateforme pour les zombies et la navigation (côté rampe ouvert)
  const bords = [
    { minX: 25, maxX: 31, minZ: -31.2, maxZ: -31, minY: 0, maxY: 3 },
    { minX: 25, maxX: 31, minZ: -25, maxZ: -24.8, minY: 0, maxY: 3 },
    { minX: 31, maxX: 31.2, minZ: -31, maxZ: -25, minY: 0, maxY: 3 },
    { minX: 24.8, maxX: 25, minZ: -31, maxZ: -29, minY: 0, maxY: 3 },
    { minX: 24.8, maxX: 25, minZ: -27, maxZ: -25, minY: 0, maxY: 3 },
  ];
  carte.aabbsZombies.push(...bords);
  carte.navObstacles.push(...bords);
  const rampe = new THREE.Mesh(uvEnMetres(new THREE.BoxGeometry(Math.hypot(5, 3), 0.2, 2), { x: Math.hypot(5, 3), y: 0.2, z: 2 }), mats.metal);
  rampe.position.set(22.5, 1.5, -28);
  rampe.rotation.z = Math.atan2(3, 5);
  groupe.add(rampe);
  carte.obstaclesVisibles.push(rampe);
  for (const [x, z] of [[26, -30], [30, -30], [26, -26], [30, -26]]) { // pylône
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 14), mats.metal);
    p.position.set(x + (28 - x) * 0.3, 3 + 7, z + (-28 - z) * 0.3);
    p.rotation.set((z + 28) * 0.03, 0, (28 - x) * 0.03);
    groupe.add(p);
  }
  decor(D.conteneur, 12, 15, -32, -29, 2.5, mats.conteneurA); // conteneur
  decor(D.muretSacs, 16, 18, -18, -16, 1);
  decor(D.guerite, 32, 35, -20, -17, 2.5);
  const guerite = carte.surfaces[carte.surfaces.length - 1];
  guerite.liensAuto = false;
  echelle(33, 34, -17, -16.4, 2.5, { x: 0, z: 1 }, { x: 33.5, z: -17.6 }, guerite.id);
  decor(D.muretSacs, 18, 22, -22, -21.4, 1.0);
  decor(D.barils, 10, 11.2, -20, -18.8, 1.2);
  projecteur(18, -20, 7, { x: 24, z: -28 }, 1);
  // gyrophare rouge au sommet de la tour
  {
    const G = CONFIG.rendu.lumieres.gyrophare;
    const corps = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.4, 12), new THREE.MeshBasicMaterial({ color: 0xff3030 }));
    corps.position.set(28, 14, -28);
    groupe.add(corps);
    const l = new THREE.SpotLight(G.couleur, G.intensite, G.portee, 0.35, 0.4, 1.6);
    l.position.set(28, 14, -28);
    groupe.add(l, l.target);
    carte.gyrophare = { lumiere: l, mesh: corps, angle: 0 };
  }

  // liens d'escalade automatiques (un par côté) ; on retire ceux dont le pied est dans un obstacle ou hors de la base
  const libre = (p) => p.x > -17.6 && p.x < 35.6 && p.z > -35.6 && p.z < 17.6 &&
    !carte.navObstacles.some((b) => p.x > b.minX - 0.35 && p.x < b.maxX + 0.35 && p.z > b.minZ - 0.35 && p.z < b.maxZ + 0.35);
  for (const s of carte.surfaces) {
    if (s.liensAuto) carte.liens.push(...liensAuto(s, E.lienRebord).filter((l) => libre(l.bas)));
  }

  return carte;
}

export function ouvrirPorte(carte, porte) {
  if (porte.ouverte) return;
  porte.ouverte = true;
  for (const m of porte.meshes) {
    m.parent?.remove(m);
    const i = carte.obstaclesVisibles.indexOf(m);
    if (i >= 0) carte.obstaclesVisibles.splice(i, 1);
  }
  for (const liste of [carte.aabbs, carte.aabbsZombies, carte.navObstacles]) {
    for (const b of porte.aabbs) {
      const i = liste.indexOf(b);
      if (i >= 0) liste.splice(i, 1);
    }
  }
  for (const z of porte.debloque) carte.zones[z].debloquee = true;
  carte.surChangement?.();
}

// Remet la carte dans son état de départ (nouvelle partie)
export function fermerPortes(carte) {
  for (const porte of carte.portes) {
    if (!porte.ouverte) continue;
    porte.ouverte = false;
    for (const m of porte.meshes) porte.parent.add(m);
    carte.obstaclesVisibles.push(...porte.solides);
    carte.aabbs.push(...porte.aabbs);
    carte.aabbsZombies.push(...porte.aabbs);
    carte.navObstacles.push(...porte.aabbs);
  }
  for (const [nom, z] of Object.entries(carte.zones)) z.debloquee = nom === 'cour';
  carte.surChangement?.();
}

// Projecteurs allumés et ombres selon le niveau de qualité (parametresQualite)
export function appliquerQualiteCarte(carte, p) {
  for (const pr of carte.projecteurs) {
    pr.lumiere.visible = pr.rang < p.projecteurs;
    pr.verre.visible = pr.lumiere.visible;
    pr.lumiere.castShadow = p.ombres !== 'non';
  }
}

export function majCarte(carte, dt) {
  const g = carte.gyrophare;
  if (g) {
    g.angle += dt * CONFIG.rendu.lumieres.gyrophare.toursParSeconde * Math.PI * 2;
    g.lumiere.target.position.set(28 + Math.cos(g.angle) * 12, 4, -28 + Math.sin(g.angle) * 12);
    g.mesh.rotation.y = g.angle;
  }
  for (const v of carte.lumieresVacillantes) {
    v.t += dt;
    const bruit = Math.sin(v.t * 13) * Math.sin(v.t * 7.3) > 0.85 ? 0.15 : 1;
    v.l.intensity = v.base * bruit;
  }
}
