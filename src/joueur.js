// Contrôles FPS, mouvement, saut, stamina, vie.
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { CONFIG } from './config.js';
import { deplacer } from './regles/collisions.js';
import { creerVie } from './regles/vie.js';
import { hauteurSol } from './carte.js';

// État brut des entrées (touches par code physique → ZQSD/WASD identiques)
export const entrees = {
  touches: new Set(),
  gauche: false, droite: false,
  clics: 0,        // clics gauches non encore consommés (armes semi-auto)
  molette: 0,
  appuis: new Set(), // touches pressées depuis la dernière image
};

addEventListener('keydown', (e) => {
  if (!entrees.touches.has(e.code)) entrees.appuis.add(e.code);
  entrees.touches.add(e.code);
  if (['Space', 'Tab'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', (e) => entrees.touches.delete(e.code));
addEventListener('mousedown', (e) => {
  if (e.button === 0) { entrees.gauche = true; entrees.clics++; }
  if (e.button === 2) entrees.droite = true;
});
addEventListener('mouseup', (e) => {
  if (e.button === 0) entrees.gauche = false;
  if (e.button === 2) entrees.droite = false;
});
addEventListener('wheel', (e) => { entrees.molette += Math.sign(e.deltaY); });
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('blur', () => { entrees.touches.clear(); entrees.gauche = entrees.droite = false; });

export function finImageEntrees() {
  entrees.appuis.clear();
  entrees.clics = 0;
  entrees.molette = 0;
}

export function creerJoueur(camera, dom) {
  const controles = new PointerLockControls(camera, dom);
  const J = CONFIG.joueur;
  const joueur = {
    position: { x: 0, y: 0, z: 0 },
    vy: 0,
    auSol: true,
    vie: creerVie(),
    stamina: J.staminaMax,
    reposStamina: 0,
    enSprint: false,
    enMouvement: false,
    vise: false,
    controles,
    get estVerrouille() { return controles.isLocked; },
    verrouiller() { controles.lock(); },
    placer(x, z) {
      this.position.x = x; this.position.z = z; this.position.y = hauteurSol(x, z);
      this.vy = 0; this.vie = creerVie(); this.stamina = J.staminaMax;
      camera.rotation.set(0, 0, 0);
      this.majCamera();
    },
    majCamera() {
      camera.position.set(this.position.x, this.position.y + J.hauteurYeux, this.position.z);
    },
    majJoueur(dt, aabbs) {
      const t = entrees.touches;
      const avant = (t.has('KeyW') || t.has('ArrowUp') ? 1 : 0) - (t.has('KeyS') || t.has('ArrowDown') ? 1 : 0);
      const cote = (t.has('KeyD') || t.has('ArrowRight') ? 1 : 0) - (t.has('KeyA') || t.has('ArrowLeft') ? 1 : 0);
      this.vise = entrees.droite;
      this.enMouvement = avant !== 0 || cote !== 0;

      const veutSprint = t.has('ShiftLeft') && avant > 0 && !this.vise;
      this.enSprint = veutSprint && this.stamina > 0;
      if (this.enSprint) {
        this.stamina = Math.max(0, this.stamina - dt);
        this.reposStamina = 0;
      } else {
        this.reposStamina += dt;
        if (this.reposStamina > 0.5) this.stamina = Math.min(J.staminaMax, this.stamina + (J.staminaMax / J.rechargeStamina) * dt);
      }
      const vitesse = this.vise ? J.vitesseVisee : this.enSprint ? J.vitesseSprint : J.vitesseMarche;

      // direction selon le regard horizontal
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      dir.y = 0; dir.normalize();
      const droite = new THREE.Vector3(-dir.z, 0, dir.x);
      const mv = dir.multiplyScalar(avant).add(droite.multiplyScalar(cote));
      if (mv.lengthSq() > 0) mv.normalize().multiplyScalar(vitesse * dt);

      const p = deplacer(this.position, mv.x, mv.z, J.rayon, aabbs, this.position.y);
      // bornes de sécurité de la zone jouable
      this.position.x = Math.min(35.6, Math.max(-17.6, p.x));
      this.position.z = Math.min(17.6, Math.max(-35.6, p.z));

      // saut et gravité
      const solY = hauteurSol(this.position.x, this.position.z, this.position.y);
      if (this.auSol && entrees.appuis.has('Space')) { this.vy = J.sautVitesse; this.auSol = false; }
      this.vy -= J.gravite * dt;
      this.position.y += this.vy * dt;
      if (this.position.y <= solY) {
        // marche montante (rampe) ou atterrissage
        this.position.y = solY; this.vy = 0; this.auSol = true;
      } else if (this.auSol && this.position.y - solY < 0.4 && this.vy <= 0) {
        this.position.y = solY; this.vy = 0; // descente de rampe sans décoller
      } else {
        this.auSol = false;
      }
      this.majCamera();
    },
  };
  return joueur;
}
