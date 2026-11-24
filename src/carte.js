// Base militaire abandonnée (jalon 1 : formes simples).
// Repère : x vers l'est, z vers le sud (nord = -z). Zone jouable : x[-18,36] z[-36,18].
import * as THREE from 'three';
import { CONFIG } from './config.js';

const EP = 0.4; // épaisseur des murs

const mats = {
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
};

// Hauteur du sol (rampe et plateforme de la tour radio)
const RAMPE = { minX: 20, maxX: 25, minZ: -29, maxZ: -27 };
const PLATEFORME = { minX: 25, maxX: 31, minZ: -31, maxZ: -25, h: 3 };

export function hauteurSol(x, z) {
  if (x >= PLATEFORME.minX && x <= PLATEFORME.maxX && z >= PLATEFORME.minZ && z <= PLATEFORME.maxZ) return PLATEFORME.h;
  if (x >= RAMPE.minX && x < RAMPE.maxX && z >= RAMPE.minZ && z <= RAMPE.maxZ) {
    return ((x - RAMPE.minX) / (RAMPE.maxX - RAMPE.minX)) * PLATEFORME.h;
  }
  return 0;
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
    surChangement: null,
  };

  const groupe = new THREE.Group();
  scene.add(groupe);

  function boite(minX, maxX, minZ, maxZ, minY, maxY, mat, { collision = true, nav = true, zombies = true } = {}) {
    const g = new THREE.BoxGeometry(maxX - minX, maxY - minY, maxZ - minZ);
    const m = new THREE.Mesh(g, mat);
    m.position.set((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);
    m.castShadow = m.receiveShadow = true;
    groupe.add(m);
    carte.obstaclesVisibles.push(m);
    const b = { minX, maxX, minZ, maxZ, minY, maxY };
    if (collision) carte.aabbs.push(b);
    if (zombies) carte.aabbsZombies.push(b);
    if (nav) carte.navObstacles.push(b);
    return { mesh: m, aabb: b };
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
        if (horiz) boite(debut, o0, z1 - EP / 2, z1 + EP / 2, 0, h, mat);
        else boite(x1 - EP / 2, x1 + EP / 2, debut, o0, 0, h, mat);
      }
      debut = Math.max(debut, o1);
    }
  }

  function sol(minX, maxX, minZ, maxZ, mat, y = 0.001) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(maxX - minX, maxZ - minZ), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set((minX + maxX) / 2, y, (minZ + maxZ) / 2);
    m.receiveShadow = true;
    groupe.add(m);
    carte.obstaclesVisibles.push(m);
  }

  function porte(id, segments, debloque) {
    const p = { id, prix: CONFIG.prixPortes[id], aabbs: [], meshes: [], ouverte: false, debloque, position: new THREE.Vector3(), parent: groupe, solides: [] };
    for (const s of segments) {
      const { mesh, aabb } = boite(s.minX, s.maxX, s.minZ, s.maxZ, 0, 2.6, mats.porte);
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
    return l;
  }

  // ---------- Sols ----------
  sol(-60, 80, -80, 60, mats.dehors, 0);
  sol(-18, 14, -12, 18, mats.asphalte);
  sol(-18, 8, -36, -12, mats.beton);
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
    const g = new THREE.Mesh(new THREE.PlaneGeometry(long, 2), new THREE.MeshStandardMaterial({ color: 0x888888, wireframe: true }));
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
  mur(14, -12, 14, 18, 4, mats.betonSombre, [[2, 5]]);

  const pHangar = porte('hangar', [{ minX: -6, maxX: -2, minZ: -12 - EP / 2, maxZ: -12 + EP / 2 }], ['hangar']);
  const pBunker = porte('bunker', [{ minX: 14 - EP / 2, maxX: 14 + EP / 2, minZ: 2, maxZ: 5 }], ['bunker']);
  porte('tour', [
    { minX: 8 - EP / 2, maxX: 8 + EP / 2, minZ: -26, maxZ: -23 },
    { minX: 24, maxX: 27, minZ: -12 - EP / 2, maxZ: -12 + EP / 2 },
  ], ['tour']);
  void pHangar; void pBunker;

  // ---------- Cour ----------
  boite(-10, -4, 8, 10.5, 0, 2.6, mats.kaki);              // camion renversé
  boite(-10, -8.5, 7.5, 11, 0, 1.8, mats.metal);           // cabine
  boite(4, 7, -6, -5.2, 0, 1.0, mats.sable);               // sacs de sable
  boite(6.2, 7, -6, -3, 0, 1.0, mats.sable);
  boite(-14, -12, -4, -2, 0, 1.2, mats.bois);              // caisses
  boite(-14, -12.8, -2, -0.8, 0, 2.4, mats.bois);
  boite(8, 9.2, 10, 11.2, 0, 1.2, mats.rouille);           // barils
  boite(9.4, 10.6, 10, 11.2, 0, 1.2, mats.rouille);
  boite(0, 0.3, 0, 0.3, 0, 7, mats.metal);                 // mât de projecteur
  lumiere(0.15, 7, 0.15, 0xdfe8ff, 60, 30);
  lumiere(-16, 3.5, 16, 0xffb070, 12, 14, true);
  murArme('mitraillette', -18 + EP / 2, 4, 1, 0);

  // ---------- Hangar ----------
  const toit = new THREE.Mesh(new THREE.BoxGeometry(26, 0.3, 24), mats.tole);
  toit.position.set(-5, 8, -24);
  groupe.add(toit);
  mur(-18, -36, -18, -12, 8, mats.tole);
  for (const [x, z] of [[-10, -18], [0, -18], [-10, -30], [0, -30]]) boite(x, x + 0.5, z, z + 0.5, 0, 8, mats.metal); // piliers
  boite(-14, -7, -28, -24, 0, 2.2, mats.kaki);             // véhicule bâché
  boite(-2, 4, -22, -19, 0, 1.6, mats.kaki);
  boite(2, 4, -33, -31, 0, 1.4, mats.bois);
  boite(-17.5, 7.5, -35.5, -34, 3, 3.2, mats.metal, { collision: false, nav: false, zombies: false }); // passerelle
  lumiere(-5, 7, -24, 0xffe0b0, 30, 26, true);
  murArme('pompe', -18 + EP / 2, -24, 1, 0);
  const caisse = boite(-1, 1, -34.5, -33.5, 0, 1, mats.caisse, { nav: true });
  carte.caisse = { position: new THREE.Vector3(0, 1, -33), mesh: caisse.mesh };

  // ---------- Bunker (plafond bas) ----------
  const plafond = new THREE.Mesh(new THREE.BoxGeometry(22, 0.3, 30), mats.betonSombre);
  plafond.position.set(25, 2.75, 3);
  groupe.add(plafond);
  mur(22, -12, 22, 6, 2.6, mats.betonSombre);
  mur(26, 10, 36, 10, 2.6, mats.betonSombre);
  mur(14, -4, 18, -4, 2.6, mats.betonSombre);
  boite(28, 32, 0, 2, 0, 1.0, mats.metal);                 // table de commandement
  boite(17, 19, 12, 16, 0, 1.6, mats.bois);
  lumiere(18, 2.4, 0, 0x9fffd0, 8, 12, true);
  lumiere(29, 2.4, 14, 0x9fffd0, 8, 12, true);
  lumiere(29, 2.4, -6, 0xff6040, 6, 10, true);
  murArme('assaut', 36 - EP / 2, 4, -1, 0);

  // ---------- Tour radio ----------
  boite(PLATEFORME.minX, PLATEFORME.maxX, PLATEFORME.minZ, PLATEFORME.maxZ, 0, PLATEFORME.h, mats.betonSombre, { zombies: false, nav: false });
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
  const rampe = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(5, 3), 0.2, 2), mats.metal);
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
  boite(12, 15, -32, -29, 0, 2.5, mats.rouille);           // conteneur
  boite(16, 18, -18, -16, 0, 1, mats.sable);
  lumiere(28, 10, -28, 0xff2020, 15, 20, true);

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

export function majCarte(carte, dt) {
  for (const v of carte.lumieresVacillantes) {
    v.t += dt;
    const bruit = Math.sin(v.t * 13) * Math.sin(v.t * 7.3) > 0.85 ? 0.15 : 1;
    v.l.intensity = v.base * bruit;
  }
}
