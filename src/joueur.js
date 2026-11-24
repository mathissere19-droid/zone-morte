// Contrôles FPS, mouvement, saut, stamina, vie, accroupi, escalade (rebords et échelles), chute.
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { CONFIG } from './config.js';
import { deplacer, peutSeRelever } from './regles/collisions.js';
import { hauteurSurfaces, trouverRebord, echelleDevant, degatsChute } from './regles/surfaces.js';
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
  const E = CONFIG.escalade;
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
    accroupi: false,
    occupe: false,      // en train de se hisser ou sur une échelle : armes inutilisables
    surface: null,      // surface en hauteur sous les pieds (null = sol)
    yeux: J.hauteurYeux,
    hisse: null,        // { de, a, t }
    echelle: null,
    sommetSaut: 0,      // plus haute position depuis qu'on a quitté le sol (dégâts de chute)
    surChute: null,     // (degats) => void
    controles,
    get estVerrouille() { return controles.isLocked; },
    verrouiller() { controles.lock(); },
    placer(x, z) {
      this.position.x = x; this.position.z = z; this.position.y = hauteurSol(x, z);
      this.vy = 0; this.vie = creerVie(); this.stamina = J.staminaMax;
      this.accroupi = false; this.occupe = false; this.hisse = null; this.echelle = null;
      this.auSol = true; this.surface = null; this.yeux = J.hauteurYeux; this.sommetSaut = this.position.y;
      camera.rotation.set(0, 0, 0);
      this.majCamera();
    },
    majCamera() {
      camera.position.set(this.position.x, this.position.y + this.yeux, this.position.z);
    },
    majJoueur(dt, carte) {
      const t = entrees.touches;
      const avant = (t.has('KeyW') || t.has('ArrowUp') ? 1 : 0) - (t.has('KeyS') || t.has('ArrowDown') ? 1 : 0);
      const cote = (t.has('KeyD') || t.has('ArrowRight') ? 1 : 0) - (t.has('KeyA') || t.has('ArrowLeft') ? 1 : 0);
      const p = this.position;
      this.vise = entrees.droite;
      this.enMouvement = avant !== 0 || cote !== 0;

      // accroupi (bascule) ; on ne se relève pas sous un plafond bas
      if (entrees.appuis.has('KeyC') && !this.hisse && !this.echelle) {
        if (!this.accroupi) this.accroupi = true;
        else if (peutSeRelever(carte.aabbs, p, J.rayon, p.y)) this.accroupi = false;
      }
      const yeuxCible = this.accroupi ? J.accroupi.hauteurYeux : J.hauteurYeux;
      this.yeux += (yeuxCible - this.yeux) * Math.min(1, dt * 12);

      if (this.hisse) { this.majHisse(dt); this.majCamera(); return; }
      if (this.echelle) { this.majEchelle(dt, avant); this.majCamera(); return; }

      const veutSprint = t.has('ShiftLeft') && avant > 0 && !this.vise && !this.accroupi;
      this.enSprint = veutSprint && this.stamina > 0;
      if (this.enSprint) {
        this.stamina = Math.max(0, this.stamina - dt);
        this.reposStamina = 0;
      } else {
        this.reposStamina += dt;
        if (this.reposStamina > 0.5) this.stamina = Math.min(J.staminaMax, this.stamina + (J.staminaMax / J.rechargeStamina) * dt);
      }
      let vitesse = this.vise ? J.vitesseVisee : this.enSprint ? J.vitesseSprint : J.vitesseMarche;
      if (this.accroupi) vitesse *= J.accroupi.vitesse;

      // direction selon le regard horizontal
      const regard = new THREE.Vector3();
      camera.getWorldDirection(regard);
      regard.y = 0; regard.normalize();
      const droite = new THREE.Vector3(-regard.z, 0, regard.x);
      const mv = regard.clone().multiplyScalar(avant).add(droite.multiplyScalar(cote));
      const dirMv = mv.lengthSq() > 0 ? mv.clone().normalize() : null;
      if (dirMv) mv.copy(dirMv).multiplyScalar(vitesse * dt);

      const hauteurCorps = this.accroupi ? J.accroupi.hauteurCorps : J.hauteurCorps;
      const np = deplacer(p, mv.x, mv.z, J.rayon, carte.aabbs, p.y, hauteurCorps);
      // bornes de sécurité de la zone jouable
      p.x = Math.min(35.6, Math.max(-17.6, np.x));
      p.z = Math.min(17.6, Math.max(-35.6, np.z));

      // échelle : on avance face à elle
      if (dirMv && this.auSol) {
        const e = echelleDevant(carte.echelles, p, dirMv);
        if (e && p.y < e.haut - 0.1) { this.echelle = e; this.occupe = true; this.vy = 0; this.majCamera(); return; }
      }

      // Espace : se hisser sur un rebord (au sol, ou Espace tenu en l'air), sinon sauter
      if (entrees.appuis.has('Space') || (t.has('Space') && !this.auSol)) {
        const rebord = trouverRebord(carte.surfaces, p, { x: regard.x, z: regard.z }, p.y);
        if (rebord) {
          this.hisse = { de: { ...p }, a: { x: rebord.x, y: rebord.h, z: rebord.z }, surface: rebord.surface, t: 0 };
          this.occupe = true; this.vy = 0;
          this.majCamera();
          return;
        }
        if (this.auSol && entrees.appuis.has('Space')) { this.vy = J.sautVitesse; this.auSol = false; }
      }

      // gravité
      const solY = hauteurSol(p.x, p.z, p.y);
      this.vy -= J.gravite * dt;
      p.y += this.vy * dt;
      if (p.y <= solY) {
        // marche montante (rampe) ou atterrissage
        if (!this.auSol) this.atterrir(solY);
        p.y = solY; this.vy = 0; this.auSol = true;
      } else if (this.auSol && p.y - solY < 0.4 && this.vy <= 0) {
        p.y = solY; this.vy = 0; // descente de rampe sans décoller
      } else {
        if (this.auSol) this.sommetSaut = p.y;
        this.auSol = false;
        this.sommetSaut = Math.max(this.sommetSaut, p.y);
      }
      if (this.auSol) this.surface = hauteurSurfaces(carte.surfaces, p.x, p.z, p.y).surface;
      this.majCamera();
    },
    atterrir(solY) {
      const degats = degatsChute(this.sommetSaut - solY);
      if (degats > 0) this.surChute?.(degats);
      this.sommetSaut = solY;
    },
    // se hisser : la moitié du temps pour monter, l'autre pour passer par-dessus le bord
    majHisse(dt) {
      const h = this.hisse, p = this.position;
      h.t += dt;
      const k = Math.min(1, h.t / E.dureeHisse);
      const montee = Math.min(1, k * 2), avance = Math.max(0, k * 2 - 1);
      p.y = h.de.y + (h.a.y + 0.05 - h.de.y) * montee;
      p.x = h.de.x + (h.a.x - h.de.x) * avance;
      p.z = h.de.z + (h.a.z - h.de.z) * avance;
      if (k >= 1) {
        p.y = h.a.y; this.hisse = null; this.occupe = false; this.auSol = true; this.vy = 0; this.surface = h.surface;
        this.sommetSaut = p.y;
      }
    },
    // échelle : avancer = monter, reculer = descendre, Espace = lâcher
    majEchelle(dt, avant) {
      const e = this.echelle, p = this.position;
      this.enSprint = false;
      const quitter = (auSol) => { this.echelle = null; this.occupe = false; this.auSol = auSol; this.sommetSaut = p.y; };
      if (entrees.appuis.has('Space')) { quitter(false); return; }
      p.y += avant * E.vitesseEchelle * dt;
      if (p.y >= e.haut) {
        p.x = e.sortie.x; p.z = e.sortie.z; p.y = e.haut;
        quitter(true);
      } else if (p.y <= e.bas) {
        p.y = e.bas;
        if (avant < 0) quitter(true);
      }
    },
  };
  return joueur;
}
