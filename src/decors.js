// Modèles détaillés des décors (conteneurs, jeep, sacs de sable, barils…).
// Chaque fabrique reçoit les dimensions de sa boîte englobante (la collision reste cette boîte)
// et renvoie un THREE.Group posé au sol, centré sur la boîte. Axe long du modèle = x local.
import * as THREE from 'three';
import { uvEnMetres } from './uv.js';

const pneu = new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.95 });
const vitre = new THREE.MeshStandardMaterial({ color: 0x0c1014, roughness: 0.15, metalness: 0.6 });
const peinture = new THREE.MeshStandardMaterial({ color: 0x5c6266, roughness: 0.6, metalness: 0.5 });

function geoBoite(x, y, z) {
  return uvEnMetres(new THREE.BoxGeometry(x, y, z), { x, y, z });
}

// pièce en boîte : (x, z) = centre, y = bas
function piece(parent, mat, lx, ly, lz, x, y, z) {
  const m = new THREE.Mesh(geoBoite(lx, ly, lz), mat);
  m.position.set(x, y + ly / 2, z);
  parent.add(m);
  return m;
}

// même géométrie répétée : un seul InstancedMesh (le lancer de rayon le gère)
function instances(parent, geo, mat, transformations) {
  const im = new THREE.InstancedMesh(geo, mat, transformations.length);
  const o = new THREE.Object3D();
  transformations.forEach(({ p, r = [0, 0, 0], s = [1, 1, 1] }, i) => {
    o.position.set(...p); o.rotation.set(...r); o.scale.set(...s);
    o.updateMatrix();
    im.setMatrixAt(i, o.matrix);
  });
  im.computeBoundingSphere();
  parent.add(im);
  return im;
}

function roue(parent, r, largeur, x, y, z, axe = 'z') {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, largeur, 16), pneu);
  m.position.set(x, y, z);
  if (axe === 'z') m.rotation.x = Math.PI / 2;
  parent.add(m);
  const jante = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.5, r * 0.5, largeur + 0.02, 10), peinture);
  jante.position.copy(m.position); jante.rotation.copy(m.rotation);
  parent.add(jante);
}

// Crée le groupe orienté : L = dimension longue, W = courte
function groupeOriente(dims) {
  const g = new THREE.Group();
  const L = Math.max(dims.dx, dims.dz), W = Math.min(dims.dx, dims.dz);
  const interne = new THREE.Group();
  if (dims.dz > dims.dx) interne.rotation.y = Math.PI / 2;
  g.add(interne);
  return { g, interne, L, W };
}

export function conteneur(mats, dims, h, mat = mats.conteneurA) {
  const { g, interne: i, L, W } = groupeOriente(dims);
  piece(i, mat, L - 0.1, h - 0.1, W - 0.1, 0, 0.05, 0);
  // nervures verticales sur les deux grands côtés
  const n = Math.floor(L / 0.45);
  const geoNervure = geoBoite(0.08, h - 0.3, 0.06);
  const t = [];
  for (let k = 0; k < n; k++) {
    const x = -L / 2 + 0.3 + k * ((L - 0.6) / (n - 1));
    t.push({ p: [x, h / 2, W / 2 - 0.04] }, { p: [x, h / 2, -W / 2 + 0.04] });
  }
  instances(i, geoNervure, mat, t);
  // cadre : poteaux d'angle et longerons
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) piece(i, mats.rouille, 0.16, h, 0.16, sx * (L / 2 - 0.08), 0, sz * (W / 2 - 0.08));
  for (const y of [0, h - 0.14]) for (const sz of [-1, 1]) piece(i, mats.rouille, L, 0.14, 0.12, 0, y, sz * (W / 2 - 0.06));
  // portes au bout +x : deux battants, barres de verrouillage
  for (const sz of [-1, 1]) piece(i, mat, 0.06, h - 0.3, W / 2 - 0.12, L / 2 - 0.01, 0.15, sz * (W / 4));
  for (const z of [-0.75, -0.35, 0.35, 0.75].map((f) => f * W / 2)) {
    const barre = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, h - 0.2, 6), mats.metal);
    barre.position.set(L / 2 + 0.05, h / 2, z);
    i.add(barre);
  }
  return g;
}

export function jeep(mats, dims, h) {
  const { g, interne: i, L, W } = groupeOriente(dims);
  i.rotation.z = 0.04; // carcasse affaissée
  piece(i, mats.kaki, L, 0.45, W - 0.3, 0, 0.35, 0);                       // caisse basse
  piece(i, mats.kaki, L * 0.32, 0.35, W - 0.35, L / 2 - L * 0.16, 0.8, 0); // capot
  piece(i, mats.rouille, 0.08, 0.25, W - 0.4, L / 2, 0.45, 0);             // calandre
  piece(i, mats.kaki, L * 0.4, 0.35, W - 0.3, -L / 2 + L * 0.2, 0.8, 0);   // benne
  piece(i, mats.metal, 0.05, 0.45, W - 0.4, L * 0.18, 1.15, 0);            // cadre de pare-brise
  // arceau
  for (const sz of [-1, 1]) piece(i, mats.metal, 0.06, h - 1.15, 0.06, -L * 0.1, 1.15, sz * (W / 2 - 0.2));
  piece(i, mats.metal, 0.06, 0.06, W - 0.35, -L * 0.1, h - 0.06, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) roue(i, 0.38, 0.28, sx * (L / 2 - 0.6), 0.38, sz * (W / 2 - 0.14));
  return g;
}

export function muretSacs(mats, dims, h) {
  const { g, interne: i, L, W } = groupeOriente(dims);
  const geo = new THREE.SphereGeometry(1, 10, 6);
  const t = [];
  const rangs = Math.max(1, Math.round(h / 0.2));
  const profondeurs = Math.max(1, Math.round(W / 0.4));
  for (let r = 0; r < rangs; r++) {
    const decal = r % 2 ? 0.27 : 0;
    for (let x = -L / 2 + 0.28 + decal; x <= L / 2 - 0.2; x += 0.54) {
      for (let d = 0; d < profondeurs; d++) {
        const z = -W / 2 + (d + 0.5) * (W / profondeurs);
        t.push({ p: [x, 0.11 + r * (h / rangs), z], r: [0, (Math.sin(x * 7 + r) * 0.15), 0], s: [0.29, 0.12, Math.min(0.19, W / profondeurs / 2)] });
      }
    }
  }
  instances(i, geo, mats.sacs, t);
  return g;
}

export function palettes(mats, dims, h) {
  const { g, interne: i, L, W } = groupeOriente(dims);
  const n = Math.max(1, Math.round(h / 0.15));
  const planches = [], blocs = [];
  for (let k = 0; k < n; k++) {
    const y = k * 0.15, rot = (k % 3) * 0.06;
    for (const z of [-1, 0, 1].map((f) => f * (W / 2 - 0.08))) blocs.push({ p: [0, y + 0.05, z], r: [0, rot, 0] });
    for (let q = 0; q < 5; q++) planches.push({ p: [0, y + 0.125, -W / 2 + 0.1 + q * ((W - 0.2) / 4)], r: [0, rot + Math.PI / 2, 0] });
  }
  instances(i, geoBoite(L, 0.1, 0.12), mats.bois, blocs);
  instances(i, geoBoite(0.14, 0.025, L), mats.bois, planches.map((p) => ({ ...p, r: [0, p.r[1] - Math.PI / 2, 0] })));
  return g;
}

export function barils(mats, dims, h) {
  const g = new THREE.Group();
  const nx = Math.max(1, Math.floor(dims.dx / 0.6)), nz = Math.max(1, Math.floor(dims.dz / 0.6));
  const corps = [], cercles = [];
  for (let a = 0; a < nx; a++) {
    for (let b = 0; b < nz; b++) {
      const x = -dims.dx / 2 + (a + 0.5) * (dims.dx / nx), z = -dims.dz / 2 + (b + 0.5) * (dims.dz / nz);
      const hb = h * (0.88 + ((a + b) % 2) * 0.1);
      corps.push({ p: [x, hb / 2, z], s: [1, hb, 1] });
      for (const f of [0.22, 0.78]) cercles.push({ p: [x, hb * f, z] });
    }
  }
  instances(g, new THREE.CylinderGeometry(0.28, 0.28, 1, 16), mats.rouille, corps);
  instances(g, new THREE.CylinderGeometry(0.295, 0.295, 0.04, 16), mats.metal, cercles);
  return g;
}

export function vehiculeBache(mats, dims, h) {
  const { g, interne: i, L, W } = groupeOriente(dims);
  piece(i, mats.kaki, L, 0.5, W - 0.2, 0, 0.35, 0);
  const n = Math.max(2, Math.round(L / 1.6));
  for (let k = 0; k < n; k++) for (const sz of [-1, 1]) roue(i, 0.4, 0.3, -L / 2 + 0.6 + k * ((L - 1.2) / (n - 1)), 0.4, sz * (W / 2 - 0.15));
  // bâche : flancs + toit arrondi
  const hb = h - 0.85 - W * 0.2;
  piece(i, mats.bache, L - 0.1, hb, W - 0.15, 0, 0.85, 0);
  const toit = new THREE.Mesh(new THREE.CylinderGeometry(W / 2 - 0.07, W / 2 - 0.07, L - 0.1, 16, 1, false, 0, Math.PI), mats.bache);
  toit.rotation.z = Math.PI / 2; // axe le long de x, moitié bombée vers le haut
  toit.scale.set(0.4, 1, 1);
  toit.position.set(0, 0.85 + hb, 0);
  i.add(toit);
  return g;
}

export function camionRenverse(mats, dims, h) {
  const { g, interne: i, L, W } = groupeOriente(dims);
  // couché sur le flanc : la benne bâchée est verticale, les roues dépassent d'un côté
  piece(i, mats.kaki, L, h, 0.4, 0, 0, -W / 2 + 0.2);            // plancher (debout)
  piece(i, mats.bache, L - 0.2, h - 0.2, W - 0.6, 0, 0.1, 0.25);  // bâche
  for (const x of [-L / 2 + 0.9, L / 2 - 0.9]) for (const y of [0.55, h - 0.55]) roue(i, 0.45, 0.35, x, y, -W / 2 - 0.05, 'y');
  return g;
}

export function cabine(mats, dims, h) {
  const { g, interne: i, L, W } = groupeOriente(dims);
  piece(i, mats.kaki, L, h - 0.1, W, 0, 0, 0);
  piece(i, vitre, 0.05, h * 0.35, W - 0.4, L / 2 + 0.01, h * 0.45, 0);
  piece(i, mats.rouille, 0.1, 0.3, W - 0.3, L / 2 + 0.03, 0.2, 0);
  return g;
}

export function pileCaisses(mats, dims, h) {
  const { g, interne: i, L, W } = groupeOriente(dims);
  const c = L / 3;
  const cubes = [];
  // escalier : 3 en bas, 2 au milieu, 1 en haut
  for (let r = 0; r < 3; r++) for (let k = 0; k < 3 - r; k++) cubes.push([-L / 2 + c / 2 + (k + r) * c, r * (h / 2)]);
  for (const [x, y] of cubes.filter(([, y]) => y < h)) {
    const hc = Math.min(h / 2, c);
    piece(i, mats.bois, c - 0.06, hc - 0.04, W - 0.1, x, y, 0);
    for (const sz of [-1, 1]) piece(i, mats.rouille, c - 0.02, 0.06, 0.03, x, y + hc / 2, sz * (W / 2 - 0.04));
  }
  return g;
}

export function armoireRenversee(mats, dims, h) {
  const { g, interne: i, L, W } = groupeOriente(dims);
  i.rotation.y += 0.08;
  piece(i, peinture, L, h, W, 0, 0, 0);
  for (let k = 0; k < 3; k++) {
    const x = -L / 2 + (k + 0.5) * (L / 3);
    piece(i, mats.metal, 0.02, h - 0.2, 0.02, x + L / 6, 0.1, W / 2 + 0.01);
    piece(i, mats.metal, 0.12, 0.04, 0.05, x, h / 2, W / 2 + 0.03);
  }
  return g;
}

export function bureauRenverse(mats, dims, h) {
  const { g, interne: i, L, W } = groupeOriente(dims);
  piece(i, mats.bois, L, h, 0.06, 0, 0, -W / 2 + 0.03);           // plateau dressé
  piece(i, peinture, L - 0.2, h - 0.2, 0.04, 0, 0.1, -W / 2 + 0.4); // voile de fond
  for (const sx of [-1, 1]) for (const y of [0.1, h - 0.1]) {
    const pied = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, W - 0.1, 6), mats.metal);
    pied.rotation.x = Math.PI / 2;
    pied.position.set(sx * (L / 2 - 0.1), y, 0.02);
    i.add(pied);
  }
  return g;
}

export function guerite(mats, dims, h) {
  const { g, interne: i, L, W } = groupeOriente(dims);
  const e = 0.15, hm = h - 0.2;
  piece(i, mats.beton, L, 1.1, e, 0, 0, W / 2 - e / 2);      // façade : allège + fenêtre
  piece(i, mats.beton, L, hm - 1.9, e, 0, 1.9, W / 2 - e / 2);
  piece(i, vitre, L - 0.6, 0.8, 0.04, 0, 1.1, W / 2 - e / 2);
  piece(i, mats.beton, L, hm, e, 0, 0, -W / 2 + e / 2);
  for (const sx of [-1, 1]) piece(i, mats.beton, e, hm, W - 2 * e, sx * (L / 2 - e / 2), 0, 0);
  piece(i, mats.metal, 0.9, 1.9, 0.05, L / 4, 0, -W / 2 - 0.02); // porte
  piece(i, mats.tole, L + 0.5, 0.15, W + 0.5, 0, hm, 0);           // toit débordant
  piece(i, mats.betonSombre, L - 2 * e, 0.05, W - 2 * e, 0, 0, 0);
  return g;
}
