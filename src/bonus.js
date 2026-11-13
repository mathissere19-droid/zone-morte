// Bonus lâchés par les zombies : munitions max, points doubles, explosion.
import * as THREE from 'three';
import { CONFIG } from './config.js';

const TYPES = ['munitions', 'doubles', 'explosion'];
const COULEURS = { munitions: 0x7fd36b, doubles: 0x66ccff, explosion: 0xff5a2a };
export const NOMS_BONUS = { munitions: 'Munitions max', doubles: 'Points doubles', explosion: 'Explosion' };

export function creerBonus(scene) {
  const liste = [];

  function lacher(position, type = TYPES[Math.floor(Math.random() * TYPES.length)]) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: COULEURS[type], emissive: COULEURS[type], emissiveIntensity: 1.2 });
    const forme = type === 'munitions' ? new THREE.BoxGeometry(0.4, 0.3, 0.3)
      : type === 'doubles' ? new THREE.OctahedronGeometry(0.28) : new THREE.IcosahedronGeometry(0.26);
    g.add(new THREE.Mesh(forme, mat));
    const l = new THREE.PointLight(COULEURS[type], 4, 5, 2);
    g.add(l);
    g.position.set(position.x, (position.y ?? 0) + 1, position.z);
    scene.add(g);
    liste.push({ g, type, t: CONFIG.bonus.duree });
  }

  function majBonus(dt, joueur, appliquer) {
    const B = CONFIG.bonus;
    for (let i = liste.length - 1; i >= 0; i--) {
      const b = liste[i];
      b.t -= dt;
      b.g.rotation.y += dt * 2;
      b.g.position.y += Math.sin(b.t * 3) * dt * 0.15;
      b.g.visible = b.t > B.clignote || Math.floor(b.t * 6) % 2 === 0;
      const d = Math.hypot(b.g.position.x - joueur.position.x, b.g.position.z - joueur.position.z);
      if (d < B.rayonRamassage && Math.abs(b.g.position.y - 1 - joueur.position.y) < 1.5) {
        appliquer(b.type);
        scene.remove(b.g); liste.splice(i, 1);
      } else if (b.t <= 0) {
        scene.remove(b.g); liste.splice(i, 1);
      }
    }
  }

  function vider() {
    for (const b of liste) scene.remove(b.g);
    liste.length = 0;
  }

  return { liste, lacher, majBonus, vider };
}
