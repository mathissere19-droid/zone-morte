// Armes : tir (raycast), visée, recul, rechargement, couteau, lance-grenades.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { entrees } from './joueur.js';
import { armeActive, tirer, peutRecharger, recharger, changer } from './regles/inventaire.js';
import { degatsTir, degatsCouteau, degatsExplosion, degatsExplosionJoueur } from './regles/combat.js';

const TAILLES = {
  pistolet: [0.06, 0.12, 0.22], mitraillette: [0.07, 0.12, 0.4], pompe: [0.07, 0.1, 0.7],
  assaut: [0.07, 0.13, 0.65], precision: [0.07, 0.13, 0.9], mitrailleuse: [0.1, 0.16, 0.8], lanceGrenades: [0.12, 0.12, 0.5],
  revolver: [0.06, 0.13, 0.26], pmCompact: [0.06, 0.12, 0.3], semiAuto: [0.07, 0.13, 0.85], pompeAuto: [0.09, 0.13, 0.7],
  arbalete: [0.08, 0.08, 0.6],
};
const matArme = new THREE.MeshStandardMaterial({ color: 0x2a2b2d, roughness: 0.5, metalness: 0.7 });
const matRare = new THREE.MeshStandardMaterial({ color: 0x8a6a20, roughness: 0.35, metalness: 0.9 });
const matCrosse = new THREE.MeshStandardMaterial({ color: 0x3b2c1d, roughness: 0.8 });

function modeleArme(id) {
  const [l, h, p] = TAILLES[id];
  const g = new THREE.Group();
  const mat = CONFIG.armes[id].rare ? matRare : matArme;
  const corps = new THREE.Mesh(new THREE.BoxGeometry(l, h, p), mat);
  g.add(corps);
  const canon = new THREE.Mesh(new THREE.CylinderGeometry(l * 0.25, l * 0.25, p * 0.5, 8), mat);
  canon.rotation.x = Math.PI / 2; canon.position.set(0, h * 0.2, -p * 0.7); g.add(canon);
  const poignee = new THREE.Mesh(new THREE.BoxGeometry(l * 0.8, h * 1.2, 0.06), matCrosse);
  poignee.position.set(0, -h * 0.8, p * 0.25); poignee.rotation.x = 0.25; g.add(poignee);
  if (p > 0.3) {
    const crosse = new THREE.Mesh(new THREE.BoxGeometry(l * 0.9, h * 0.9, 0.22), matCrosse);
    crosse.position.set(0, -h * 0.1, p * 0.5 + 0.1); g.add(crosse);
  }
  if (id === 'arbalete') { // arc à l'avant
    const arc = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.04), mat);
    arc.position.set(0, h * 0.3, -p * 0.75); g.add(arc);
  }
  g.userData.bouche = new THREE.Vector3(0, h * 0.2, -p * 0.95);
  g.traverse((o) => { if (o.isMesh) o.renderOrder = 10; });
  return g;
}

export function creerArmes({ camera, scene, inventaire, cibles, obstacles, joueur, surTouche, surJoueurTouche, surExplosionVisuelle }) {
  const support = new THREE.Group();
  camera.add(support);
  support.scale.setScalar(0.75);
  const modeles = {};
  let modeleCourant = null, idCourant = null;

  const flash = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.25), new THREE.MeshBasicMaterial({
    color: 0xffd27a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  const lumiereFlash = new THREE.PointLight(0xffb050, 0, 8, 2);
  support.add(lumiereFlash);

  const raycaster = new THREE.Raycaster();
  raycaster.far = 120;
  const etat = {
    attente: 0, rechargement: 0, changement: 0, couteau: 0,
    recul: 0, balancement: 0, flash: 0, dispersionActuelle: 0,
    inventaire,
  };
  const impacts = [];
  const grenades = [];
  const geoImpact = new THREE.SphereGeometry(0.05, 6, 6);
  const matImpactMur = new THREE.MeshBasicMaterial({ color: 0xffe0a0 });
  const matImpactSang = new THREE.MeshBasicMaterial({ color: 0x6a0000 });

  function afficherArme() {
    const id = armeActive(etat.inventaire).id;
    if (id === idCourant) return;
    if (modeleCourant) support.remove(modeleCourant);
    modeles[id] ??= modeleArme(id);
    modeleCourant = modeles[id];
    idCourant = id;
    support.add(modeleCourant);
    modeleCourant.add(flash);
    flash.position.copy(modeleCourant.userData.bouche);
    lumiereFlash.position.copy(modeleCourant.userData.bouche);
    etat.changement = 0.35;
    etat.rechargement = 0;
  }

  function impact(point, sang) {
    const m = new THREE.Mesh(geoImpact, sang ? matImpactSang : matImpactMur);
    m.position.copy(point);
    scene.add(m);
    impacts.push({ m, t: sang ? 0.25 : 0.12 });
  }

  function appliquerRecul(force) {
    const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
    e.x = Math.min(Math.PI / 2 - 0.01, e.x + force);
    e.y += (Math.random() - 0.5) * force * 0.5;
    camera.quaternion.setFromEuler(e);
  }

  const dirTmp = new THREE.Vector3();
  function rayon(dispersion) {
    camera.getWorldDirection(dirTmp);
    const droite = new THREE.Vector3().crossVectors(dirTmp, camera.up).normalize();
    const haut = new THREE.Vector3().crossVectors(droite, dirTmp).normalize();
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * dispersion;
    dirTmp.addScaledVector(droite, Math.cos(a) * r).addScaledVector(haut, Math.sin(a) * r).normalize();
    raycaster.set(camera.getWorldPosition(new THREE.Vector3()), dirTmp);
  }

  // Un tir : renvoie la liste [{zombie, degats, tete}] pour ce rayon
  function lancerRayon(armeId, dispersion, perce) {
    rayon(dispersion);
    const hits = raycaster.intersectObjects([...cibles(), ...obstacles()], false);
    const res = [];
    const dejaTouches = new Set();
    for (const h of hits) {
      const z = h.object.userData.zombie;
      if (!z) { impact(h.point, false); break; }
      if (z.mort || dejaTouches.has(z)) continue;
      dejaTouches.add(z);
      const tete = h.object.userData.zone === 'tete';
      res.push({ zombie: z, degats: degatsTir(armeId, tete ? 'tete' : 'corps', h.distance), tete });
      impact(h.point, true);
      if (res.length >= perce) break;
    }
    return res;
  }

  function tir() {
    const a = armeActive(etat.inventaire);
    const def = CONFIG.armes[a.id];
    if (!tirer(etat.inventaire)) return false;
    const visee = joueur.vise ? 0.4 : 1;
    const mouvement = joueur.enMouvement ? 1.5 : 1;
    const disp = def.dispersion * visee * mouvement + etat.dispersionActuelle;

    if (a.id === 'lanceGrenades') {
      const pos = camera.getWorldPosition(new THREE.Vector3());
      const dir = camera.getWorldDirection(new THREE.Vector3());
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), matArme);
      m.position.copy(pos).addScaledVector(dir, 0.6);
      scene.add(m);
      grenades.push({ m, v: dir.multiplyScalar(28), t: 0 });
    } else {
      const total = new Map();
      for (let i = 0; i < (def.plombs ?? 1); i++) {
        for (const r of lancerRayon(a.id, disp, def.perce ?? 1)) {
          const t = total.get(r.zombie) ?? { degats: 0, tete: false };
          t.degats += r.degats; t.tete ||= r.tete;
          total.set(r.zombie, t);
        }
      }
      for (const [z, t] of total) surTouche(z, t.degats, { tete: t.tete, couteau: false });
    }
    etat.attente = def.cadence === 'semi' ? 60 / CONFIG.semiCadenceMax : 60 / def.cadence;
    if (a.id === 'pompe') etat.attente = 60 / def.cadence; // pompe : semi mais cadence propre
    const force = { pompe: 0.06, pompeAuto: 0.045, precision: 0.08, semiAuto: 0.04, revolver: 0.05, arbalete: 0.02, lanceGrenades: 0.05, pistolet: 0.025 }[a.id] ?? 0.012;
    appliquerRecul(force * (joueur.vise ? 0.6 : 1));
    etat.recul = Math.min(etat.recul + force * 2, 0.2);
    etat.dispersionActuelle = Math.min(etat.dispersionActuelle + def.dispersion * 0.3, def.dispersion * 2);
    etat.flash = 0.05;
    flash.rotation.z = Math.random() * Math.PI;
    return true;
  }

  function exploser(position) {
    surExplosionVisuelle?.(position);
    for (const z of cibles().map((c) => c.userData.zombie)) {
      if (z.mort || z._explose) continue;
      z._explose = true;
      const d = Math.hypot(z.position.x - position.x, z.position.y + 1 - position.y, z.position.z - position.z);
      const dg = degatsExplosion(d);
      if (dg > 0) surTouche(z, dg, { tete: false, couteau: false });
    }
    for (const c of cibles()) delete c.userData.zombie._explose;
    const jp = joueur.position;
    const dj = Math.hypot(jp.x - position.x, jp.y + 1 - position.y, jp.z - position.z);
    const dgj = degatsExplosionJoueur(dj);
    if (dgj > 0) surJoueurTouche(dgj);
  }

  function coupDeCouteau() {
    etat.couteau = CONFIG.couteau.delai;
    const pos = joueur.position;
    const dir = camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize();
    let meilleur = null, dMin = Infinity;
    for (const c of cibles()) {
      const z = c.userData.zombie;
      const dx = z.position.x - pos.x, dz = z.position.z - pos.z;
      const d = Math.hypot(dx, dz);
      if (d > CONFIG.couteau.portee + 0.3 || d >= dMin) continue;
      if ((dx * dir.x + dz * dir.z) / (d || 1) < 0.5) continue;
      meilleur = z; dMin = d;
    }
    if (meilleur) surTouche(meilleur, degatsCouteau(), { tete: false, couteau: true });
  }

  function majArmes(dt, actif) {
    afficherArme();
    const a = armeActive(etat.inventaire);
    const def = CONFIG.armes[a.id];
    etat.attente -= dt; etat.couteau -= dt; etat.changement -= dt;
    etat.dispersionActuelle = Math.max(0, etat.dispersionActuelle - dt * def.dispersion * 3);

    if (actif) {
      // changement d'arme
      if (entrees.appuis.has('Digit1')) changer(etat.inventaire, 0);
      if (entrees.appuis.has('Digit2')) changer(etat.inventaire, 1);
      if (entrees.molette !== 0 && etat.inventaire.armes.length > 1) changer(etat.inventaire, 1 - etat.inventaire.active);
      afficherArme();

      if (etat.rechargement > 0) {
        etat.rechargement -= dt;
        if (etat.rechargement <= 0) recharger(etat.inventaire);
      } else if (entrees.appuis.has('KeyR') && peutRecharger(etat.inventaire)) {
        etat.rechargement = def.rechargement;
      }

      if (entrees.appuis.has('KeyV') && etat.couteau <= 0) coupDeCouteau();

      const veutTirer = def.cadence === 'semi' || a.id === 'pompe' ? entrees.clics > 0 : entrees.gauche;
      if (veutTirer && etat.attente <= 0 && etat.rechargement <= 0 && etat.changement <= 0 && etat.couteau <= CONFIG.couteau.delai - 0.3) {
        if (a.chargeur > 0) tir();
        else if (peutRecharger(etat.inventaire)) etat.rechargement = def.rechargement;
      }
    }

    // grenades
    for (let i = grenades.length - 1; i >= 0; i--) {
      const g = grenades[i];
      g.t += dt;
      g.v.y -= 9.8 * dt;
      const pas = g.v.clone().multiplyScalar(dt);
      raycaster.set(g.m.position, pas.clone().normalize());
      raycaster.far = pas.length();
      const h = raycaster.intersectObjects([...cibles(), ...obstacles()], false)[0];
      raycaster.far = 120;
      if (h || g.t > 4 || g.m.position.y < 0) {
        exploser(h ? h.point : g.m.position.clone());
        scene.remove(g.m); grenades.splice(i, 1);
      } else g.m.position.add(pas);
    }

    // impacts
    for (let i = impacts.length - 1; i >= 0; i--) {
      impacts[i].t -= dt;
      if (impacts[i].t <= 0) { scene.remove(impacts[i].m); impacts.splice(i, 1); }
    }

    // position de l'arme à l'écran
    const vise = joueur.vise && etat.rechargement <= 0;
    camera.fov += ((vise ? 55 : 75) - camera.fov) * Math.min(1, dt * 12);
    camera.updateProjectionMatrix();
    etat.balancement += dt * (joueur.enMouvement ? (joueur.enSprint ? 13 : 9) : 2);
    const amp = joueur.enMouvement ? (joueur.enSprint ? 0.03 : 0.015) : 0.004;
    const cible = vise ? new THREE.Vector3(0, -0.13, -0.32) : new THREE.Vector3(0.24, -0.22, -0.45);
    cible.x += Math.sin(etat.balancement) * amp;
    cible.y += Math.abs(Math.cos(etat.balancement)) * amp;
    cible.z += etat.recul;
    let bas = 0;
    if (etat.rechargement > 0) bas = Math.sin(Math.min(1, 1 - etat.rechargement / def.rechargement) * Math.PI) * 0.3;
    if (etat.changement > 0) bas = Math.max(bas, etat.changement / 0.35 * 0.3);
    cible.y -= bas;
    if (modeleCourant) {
      modeleCourant.position.lerp(cible, Math.min(1, dt * 18));
      modeleCourant.rotation.x = -bas * 1.5 + etat.recul * 2;
      modeleCourant.rotation.y = joueur.enSprint ? 0.6 : 0;
    }
    etat.recul = Math.max(0, etat.recul - dt * 0.8);
    etat.flash -= dt;
    flash.material.opacity = etat.flash > 0 ? 1 : 0;
    lumiereFlash.intensity = etat.flash > 0 ? 6 : 0;
  }

  return {
    etat, majArmes,
    tirForce: () => tir(),
    get enRechargement() { return etat.rechargement > 0; },
    get dispersion() { return CONFIG.armes[armeActive(etat.inventaire).id].dispersion + etat.dispersionActuelle; },
    reinitialiser(inv) { etat.inventaire = inv; etat.rechargement = 0; idCourant = null; },
  };
}
