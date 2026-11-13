// Zombies : apparence (jalon 1 : formes simples), IA de déplacement, attaque, mort.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { pvZombie, typeDeplacement } from './regles/vagues.js';
import { deplacer } from './regles/collisions.js';
import { trouverChemin, ligneLibre } from './regles/navigation.js';
import { hauteurSol } from './carte.js';

const Z = CONFIG.zombie;
const VITESSES = { marche: Z.vitesseMarche, marcheRapide: Z.vitesseMarcheRapide, course: Z.vitesseCourse };

const geo = {
  tronc: new THREE.BoxGeometry(0.5, 0.7, 0.28),
  tete: new THREE.BoxGeometry(0.28, 0.3, 0.28),
  bras: new THREE.BoxGeometry(0.13, 0.13, 0.6),
  jambe: new THREE.BoxGeometry(0.17, 0.8, 0.17),
};
const peaux = [0x6f7d5c, 0x7a8466, 0x5f6b55, 0x8a8a6a].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }));
const habits = [0x3b3f2e, 0x2e3440, 0x4a3b2e, 0x3a3a3a].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95 }));
const matYeux = new THREE.MeshBasicMaterial({ color: 0xffaa22 });
const geoOeil = new THREE.BoxGeometry(0.05, 0.03, 0.02);

function construireModele(rng) {
  const peau = peaux[Math.floor(rng() * peaux.length)];
  const habit = habits[Math.floor(rng() * habits.length)];
  const g = new THREE.Group();
  const corps = new THREE.Group(); // tout ce qui s'incline
  g.add(corps);
  const tronc = new THREE.Mesh(geo.tronc, habit); tronc.position.y = 1.2; corps.add(tronc);
  const tete = new THREE.Mesh(geo.tete, peau); tete.position.y = 1.72; corps.add(tete);
  for (const x of [-0.06, 0.06]) { const o = new THREE.Mesh(geoOeil, matYeux); o.position.set(x, 1.75, 0.145); corps.add(o); }
  const brasG = new THREE.Mesh(geo.bras, peau); brasG.position.set(-0.3, 1.42, 0.25); corps.add(brasG);
  const brasD = new THREE.Mesh(geo.bras, peau); brasD.position.set(0.3, 1.42, 0.25); corps.add(brasD);
  const jambeG = new THREE.Mesh(geo.jambe, habit); jambeG.geometry = geo.jambe; jambeG.position.set(-0.13, 0.4, 0); g.add(jambeG);
  const jambeD = new THREE.Mesh(geo.jambe, habit); jambeD.position.set(0.13, 0.4, 0); g.add(jambeD);
  for (const m of [tronc, brasG, brasD, jambeG, jambeD]) m.userData.zone = 'corps';
  tete.userData.zone = 'tete';
  const touchables = [tronc, tete, brasG, brasD, jambeG, jambeD];
  for (const m of touchables) m.castShadow = true;
  return { g, corps, tete, brasG, brasD, jambeG, jambeD, touchables };
}

export function creerGestionnaireZombies(scene, carte, grille) {
  const liste = [];
  let compteur = 0;

  function faireApparaitre(point, vague, rng = Math.random) {
    const type = typeDeplacement(vague, rng);
    const m = construireModele(rng);
    const z = {
      id: compteur++,
      modele: m,
      position: { x: point.x, y: hauteurSol(point.x, point.z), z: point.z },
      pv: pvZombie(vague),
      type,
      vitesse: VITESSES[type] * (0.9 + rng() * 0.2),
      chemin: null, iChemin: 0,
      prochainCalcul: (compteur % 10) * (Z.recalculChemin / 10),
      attente: 0,
      mort: false, tempsMort: 0,
      phase: rng() * 10,
      emergence: 0.8, // sort du sol
    };
    for (const t of m.touchables) t.userData.zombie = z;
    m.g.position.set(z.position.x, z.position.y - 1.8, z.position.z);
    scene.add(m.g);
    liste.push(z);
    return z;
  }

  function cibles() {
    const r = [];
    for (const z of liste) if (!z.mort) r.push(...z.modele.touchables);
    return r;
  }

  // Applique des dégâts ; renvoie true si le zombie vient de mourir
  function infliger(z, degats) {
    if (z.mort) return false;
    z.pv -= degats;
    z.recul = 0.12;
    if (z.pv <= 0) { z.mort = true; z.tempsMort = 0; return true; }
    return false;
  }

  function tuerTous() {
    const tues = liste.filter((z) => !z.mort);
    for (const z of tues) { z.mort = true; z.tempsMort = 0; }
    return tues;
  }

  function vider() {
    for (const z of liste) scene.remove(z.modele.g);
    liste.length = 0;
  }

  function majZombies(dt, joueur, surCoup) {
    const jp = joueur.position;
    for (let i = liste.length - 1; i >= 0; i--) {
      const z = liste[i];
      const m = z.modele;
      if (z.mort) {
        z.tempsMort += dt;
        m.g.rotation.x = Math.max(-Math.PI / 2, -z.tempsMort * 5);
        m.g.position.y = z.position.y + Math.min(z.tempsMort, 0.3) * 0.5;
        if (z.tempsMort > 2.5) { scene.remove(m.g); liste.splice(i, 1); }
        continue;
      }
      if (z.emergence > 0) {
        z.emergence -= dt;
        m.g.position.set(z.position.x, z.position.y - Math.max(0, z.emergence) * 2.2, z.position.z);
        continue;
      }

      const dx = jp.x - z.position.x, dz = jp.z - z.position.z;
      const dist = Math.hypot(dx, dz);
      const memeNiveau = Math.abs(jp.y - z.position.y) < 1.2;
      let angleCible = Math.atan2(dx, dz);
      let enMarche = false;

      if (dist < Z.porteeAttaque && memeNiveau) {
        z.attente -= dt;
        if (z.attente <= 0) { z.attente = Z.delaiAttaque; z.frappe = 0.35; surCoup(CONFIG.joueur.degatsZombie, z); }
      } else {
        z.attente = Math.min(z.attente, 0.3);
        let cx = jp.x, cz = jp.z;
        const direct = memeNiveau && dist < Z.distanceDirecte && ligneLibre(grille, z.position, jp);
        if (!direct) {
          z.prochainCalcul -= dt;
          if (z.prochainCalcul <= 0 || !z.chemin) {
            z.prochainCalcul = Z.recalculChemin;
            z.chemin = trouverChemin(grille, z.position, jp);
            z.iChemin = 0;
          }
          if (z.chemin && z.chemin.length) {
            while (z.iChemin < z.chemin.length - 1 &&
              Math.hypot(z.chemin[z.iChemin].x - z.position.x, z.chemin[z.iChemin].z - z.position.z) < 0.5) z.iChemin++;
            // raccourci : viser le point suivant s'il est visible
            if (z.iChemin < z.chemin.length - 1 && ligneLibre(grille, z.position, z.chemin[z.iChemin + 1])) z.iChemin++;
            cx = z.chemin[z.iChemin].x; cz = z.chemin[z.iChemin].z;
          }
          // chemin null → déplacement direct vers le joueur (ne jamais rester figé)
        }
        let mx = cx - z.position.x, mz = cz - z.position.z;
        const l = Math.hypot(mx, mz) || 1;
        mx /= l; mz /= l;
        // séparation entre zombies
        for (const o of liste) {
          if (o === z || o.mort) continue;
          const ox = z.position.x - o.position.x, oz = z.position.z - o.position.z;
          const d = Math.hypot(ox, oz);
          if (d > 0.001 && d < 0.7) { mx += (ox / d) * (0.7 - d) * 2; mz += (oz / d) * (0.7 - d) * 2; }
        }
        const lm = Math.hypot(mx, mz) || 1;
        const v = z.vitesse * dt * (z.recul > 0 ? 0.3 : 1);
        const p = deplacer(z.position, (mx / lm) * v, (mz / lm) * v, Z.rayon, carte.aabbsZombies, z.position.y);
        z.position.x = p.x; z.position.z = p.z;
        z.position.y = hauteurSol(p.x, p.z);
        angleCible = Math.atan2(mx, mz);
        enMarche = true;
      }
      if (z.recul > 0) z.recul -= dt;
      if (z.frappe > 0) z.frappe -= dt;

      // orientation et animation
      let da = angleCible - m.g.rotation.y;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      m.g.rotation.y += da * Math.min(1, dt * 8);
      m.g.position.set(z.position.x, z.position.y, z.position.z);
      z.phase += dt * (enMarche ? z.vitesse * 2.6 : 1);
      const amp = enMarche ? (z.type === 'course' ? 0.9 : 0.5) : 0.05;
      m.jambeG.rotation.x = Math.sin(z.phase) * amp;
      m.jambeD.rotation.x = -Math.sin(z.phase) * amp;
      m.corps.rotation.x = (z.type === 'course' ? 0.35 : 0.15) + (z.recul > 0 ? -0.3 : 0);
      const frappe = z.frappe > 0 ? Math.sin((0.35 - z.frappe) / 0.35 * Math.PI) * 0.9 : 0;
      m.brasG.rotation.x = Math.sin(z.phase * 0.5) * 0.15 - frappe;
      m.brasD.rotation.x = -Math.sin(z.phase * 0.5) * 0.15 - frappe;
    }
  }

  return { liste, faireApparaitre, majZombies, cibles, infliger, tuerTous, vider };
}
