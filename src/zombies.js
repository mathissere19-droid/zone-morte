// Zombies : apparence (GLB Mixamo animés, repli en boîtes), IA de déplacement, attaque, mort.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { typeDeplacement, pvBoss } from './regles/vagues.js';
import { pvZombieActif, difficulteActive } from './regles/difficulte.js';
import { deplacer } from './regles/collisions.js';
import { trouverChemin, ligneLibre } from './regles/navigation.js';
import { hauteurSol } from './carte.js';
import { majBrulure } from './regles/combat.js';
import { creerSuiviBlocage, majSuiviBlocage } from './regles/blocage.js';
import { choisirAnimation, momentImpact, doitAnimer, toucheJambes } from './regles/animation-zombie.js';
import { creerModeleZombie } from './modeles-zombies.js';
import { creerPerception, majPerception, voit } from './regles/perception.js';
import { hauteurSurfaces, choisirLien, bordLePlusProche } from './regles/surfaces.js';

const Z = CONFIG.zombie;
const E = CONFIG.escalade;
const PER = CONFIG.perception;
const ZA = CONFIG.zombie.animation;
const B = CONFIG.boss;
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
const geoFeu = new THREE.SphereGeometry(0.45, 10, 8);
const matFeu = new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending });

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
  const feu = new THREE.Mesh(geoFeu, matFeu); feu.position.y = 1.1; feu.scale.set(1, 1.8, 1); feu.visible = false; g.add(feu);
  jambeG.userData.zone = jambeD.userData.zone = 'jambes';
  const touchables = [tronc, tete, brasG, brasD, jambeG, jambeD];
  for (const m of touchables) m.castShadow = true;
  return { g, corps, tete, brasG, brasD, jambeG, jambeD, touchables, feu };
}

// Boss de repli : boîtes plus grandes et plus sombres
function creerBossBoites(rng) {
  const m = creerModeleBoites(rng);
  m.g.children[0].scale.setScalar(1.3);
  for (const j of [m.jambeG, m.jambeD]) j.scale.set(1.3, 1, 1.3);
  return m;
}

// Modèle de repli (pas de GLB) : boîtes animées par programme. Même interface que modeles-zombies.js.
export function creerModeleBoites(rng = Math.random) {
  const m = construireModele(rng);
  let phase = rng() * 10, nom = null, t = 0, tMort = -1;
  return Object.assign(m, {
    dureeEmergence: 0.8, enterre: true, teteRetiree: false, rampe: false,
    get animation() { return tMort >= 0 ? 'mort' : nom; },
    animer(anim, dt) {
      if (tMort >= 0) { tMort += dt; m.g.rotation.x = Math.max(-Math.PI / 2, -tMort * 5); return; }
      if (!anim) return;
      if (anim.nom !== nom) { nom = anim.nom; t = 0; }
      t += dt * anim.vitesse;
      const avance = (nom === 'marche' || nom === 'course' || nom === 'ramper') && anim.vitesse > 0;
      phase += dt * (avance ? 3.1 * anim.vitesse * (nom === 'course' ? 2.5 : 1) : 1);
      const amp = avance ? (nom === 'course' ? 0.9 : 0.5) : 0.05;
      m.jambeG.rotation.x = Math.sin(phase) * amp;
      m.jambeD.rotation.x = -Math.sin(phase) * amp;
      const grimpe = nom === 'attaque' && anim.vitesse < 1;
      m.corps.rotation.x = m.rampe ? 1.35 : (nom === 'course' ? 0.35 : 0.15) + (grimpe ? 0.3 : 0);
      const frappe = nom === 'attaque' && !grimpe ? Math.sin(Math.min(1, t / 0.7) * Math.PI) * 0.9 : 0;
      const bras = grimpe ? -2.4 : 0; // bras levés pour grimper
      m.brasG.rotation.x = Math.sin(phase * 0.5) * 0.15 - frappe + bras;
      m.brasD.rotation.x = -Math.sin(phase * 0.5) * 0.15 - frappe + bras;
    },
    jouerMort() { tMort = 0; },
    dureeAnimation(n) { return n === 'attaque' ? 0.7 : 1; },
    tempsAnimation() { return t; },
    relancer() { t = 0; },
    retirerTete() { m.teteRetiree = true; m.tete.visible = false; },
    passerRampeur() {
      m.rampe = true;
      m.corps.position.y = -0.75;
      for (const j of [m.jambeG, m.jambeD]) {
        j.visible = false;
        m.touchables.splice(m.touchables.indexOf(j), 1);
      }
    },
    positionTete(cible = new THREE.Vector3()) { return m.tete.getWorldPosition(cible); },
    ombres(actif) { for (const o of m.touchables) o.castShadow = actif; },
  });
}

export function creerGestionnaireZombies(scene, carte, grille) {
  const liste = [];
  let compteur = 0;
  let modeles = null; // GLB chargés (null : boîtes)
  let image = 0;
  let ombresActives = false;

  // boss : « Le Colosse » (PV × 12, lent, ne court jamais, coups × 3)
  function faireApparaitre(point, vague, rng = Math.random, { boss = false } = {}) {
    const type = boss ? 'marche' : typeDeplacement(vague, rng, difficulteActive().premiereVagueCoureurs);
    const m = creerModeleZombie(modeles, { boss, rng, repli: boss ? creerBossBoites : creerModeleBoites });
    const pv = boss ? pvBoss(pvZombieActif(vague)) : pvZombieActif(vague);
    const z = {
      id: compteur++,
      modele: m,
      position: { x: point.x, y: hauteurSol(point.x, point.z), z: point.z },
      pv, pvMax: pv, boss,
      type,
      vitesse: boss ? B.vitesse : VITESSES[type] * (0.9 + rng() * 0.2),
      chemin: null, iChemin: 0,
      prochainCalcul: (compteur % 10) * (Z.recalculChemin / 10),
      tAttaque: null,   // temps écoulé dans l'attaque en cours (null : pas d'attaque)
      mort: false, tempsMort: 0,
      emergence: m.dureeEmergence, // sort du sol
      vitesseReelle: 0,
      perception: null,  // créée à la première mise à jour (connaît la position du joueur : apparition en traque)
      prochainePerception: (compteur % 5) * (PER.intervalle / 5), cumulPerception: 0, alerte: false,
      surface: null,     // îlot en hauteur où il se trouve (null = sol)
      escalade: null,    // { de, vers, t, duree, surface } pendant une montée ou un saut vers le bas
    };
    z.suivi = creerSuiviBlocage(z.position);
    for (const t of m.touchables) t.userData.zombie = z;
    m.g.position.set(z.position.x, z.position.y - (m.enterre ? 1.8 : 0), z.position.z);
    m.g.updateMatrixWorld(true); // touchable dès l'apparition, avant la prochaine image
    m.ombres(ombresActives);
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
  // zone 'jambes' : dégâts cumulés, le zombie peut passer rampeur
  function infliger(z, degats, zone) {
    if (z.mort) return false;
    z.pv -= degats;
    z.recul = 0.12;
    if (z.pv <= 0) { z.mort = true; z.tempsMort = 0; return true; }
    if (zone === 'jambes' && toucheJambes(z, degats, z.pvMax)) {
      z.rampe = true;
      z.modele.passerRampeur();
      z.escalade = null;
    }
    return false;
  }

  function tuerTous() {
    const tues = liste.filter((z) => !z.mort && !z.boss); // le bonus explosion n'abat pas le boss
    for (const z of tues) { z.mort = true; z.tempsMort = 0; }
    return tues;
  }

  function vider() {
    for (const z of liste) scene.remove(z.modele.g);
    liste.length = 0;
  }

  let nbFlairs = 0;

  // Perception : vue, bruit, contact, alerte des voisins ; renvoie l'état ('traque' ou 'recherche').
  function majPerceptionZombie(z, dt, joueur) {
    const jp = joueur.position;
    if (!z.perception) z.perception = creerPerception(jp);
    z.cumulPerception += dt;
    z.prochainePerception -= dt;
    if (z.prochainePerception > 0) return z.perception.etat;
    z.prochainePerception += PER.intervalle;
    const d = Math.hypot(jp.x - z.position.x, jp.z - z.position.z);
    // sur le même îlot (toit, conteneur) : à découvert, il le voit
    const memeIlot = !!z.surface && z.surface === joueur.surface;
    const repere = d <= PER.contact || d <= (joueur.bruit ?? 0) || memeIlot ||
      voit({ zombie: z.position, orientation: z.modele.g.rotation.y, joueur: jp,
        ligneLibre: ligneLibre(grille, z.position, jp), cacheDansOmbre: !!(joueur.accroupi && joueur.dansOmbre) });
    const avant = z.perception.etat;
    const r = majPerception(z.perception, { repere, joueur: jp, alerte: z.alerte }, z.cumulPerception, difficulteActive().delaiFlair);
    z.alerte = false; z.cumulPerception = 0;
    if (r === 'flair') nbFlairs++;
    if (repere && avant !== 'traque') {
      // il prévient les vivants proches
      for (const o of liste) {
        if (o !== z && !o.mort && Math.hypot(o.position.x - z.position.x, o.position.z - z.position.z) <= PER.alerte) o.alerte = true;
      }
    }
    if (z.perception.etat !== avant) z.chemin = null;
    return z.perception.etat;
  }

  function commencerEscalade(z, vers, duree, surface) {
    z.escalade = { de: { ...z.position }, vers, t: 0, duree, surface };
    z.chemin = null;
  }

  // Avance l'escalade (montée en ligne droite ou saut vers le bas) ; renvoie l'angle de déplacement.
  function majEscalade(z, dt) {
    const e = z.escalade;
    e.t += dt;
    const k = Math.min(1, e.t / e.duree);
    const monte = e.vers.y > e.de.y;
    z.position.x = e.de.x + (e.vers.x - e.de.x) * k;
    z.position.z = e.de.z + (e.vers.z - e.de.z) * k;
    // en montant : il grimpe d'abord, puis se hisse sur le bord ; en sautant : petite parabole
    z.position.y = monte ? e.de.y + (e.vers.y - e.de.y) * Math.min(1, k * 1.25)
      : e.de.y + (e.vers.y - e.de.y) * k * k + Math.sin(k * Math.PI) * 0.3;
    if (k >= 1) {
      z.position.y = e.vers.y; z.surface = e.surface; z.escalade = null;
      z.suivi = creerSuiviBlocage(z.position);
    }
    return Math.atan2(e.vers.x - e.de.x, e.vers.z - e.de.z);
  }

  // surBrulure(z, degats) : dégâts de feu, à faire passer par le même chemin que les tirs (comptage des morts)
  // surBloque(z) : zombie immobile trop longtemps loin du joueur, à replacer
  // joueur.bruit (m), joueur.dansOmbre (main.js) ; joueur.accroupi, joueur.surface (joueur.js)
  function majZombies(dt, joueur, surCoup, surBrulure, surBloque) {
    const jp = joueur.position;
    const jIlot = joueur.surface?.ilot && joueur.surface.h >= E.hauteurIlot ? joueur.surface : null;
    image++;
    for (let i = liste.length - 1; i >= 0; i--) {
      const z = liste[i];
      const m = z.modele;
      // au loin, l'animation n'avance qu'une image sur deux (avec le temps cumulé)
      const dAnim = Math.hypot(jp.x - z.position.x, jp.z - z.position.z);
      const animer = (anim) => {
        z.dtAnim = (z.dtAnim || 0) + dt;
        if (!doitAnimer(dAnim, image + z.id)) return;
        m.animer(anim, z.dtAnim);
        z.dtAnim = 0;
      };
      const feu = majBrulure(z, dt);
      m.feu.visible = !z.mort && z.brulure?.t > 0;
      if (m.feu.visible) m.feu.scale.set(0.9 + Math.random() * 0.2, 1.6 + Math.random() * 0.4, 0.9 + Math.random() * 0.2);
      if (feu > 0 && !z.mort && z.emergence <= 0) surBrulure?.(z, feu);
      if (z.mort) {
        if (!z.mortJouee) { z.mortJouee = true; m.jouerMort(); }
        z.tempsMort += dt;
        animer(null);
        // le corps reste, puis s'enfonce d'1 m en 1 s avant d'être retiré
        const enfonce = Math.max(0, z.tempsMort - ZA.corps);
        m.g.position.y = z.position.y - enfonce;
        if (enfonce > 1) { scene.remove(m.g); liste.splice(i, 1); }
        continue;
      }
      if (z.emergence > 0) {
        z.emergence -= dt;
        animer(choisirAnimation({ emergence: z.emergence }));
        const k = m.enterre ? Math.max(0, z.emergence) * 2.2 : 0;
        m.g.position.set(z.position.x, z.position.y - k, z.position.z);
        continue;
      }
      const ax = z.position.x, az = z.position.z;

      const etat = majPerceptionZombie(z, dt, joueur);
      const dx = jp.x - z.position.x, dz = jp.z - z.position.z;
      const dist = Math.hypot(dx, dz);
      const memeNiveau = Math.abs(jp.y - z.position.y) < 1.2;
      const portee = z.rampe ? Z.rampe.portee : Z.porteeAttaque;
      let angleCible = Math.atan2(dx, dz);
      let enMarche = false;
      let surveille = true; // détection de blocage

      if (z.escalade) {
        angleCible = majEscalade(z, dt);
        enMarche = true; surveille = false;
      } else if (z.tAttaque != null || (dist < portee && memeNiveau)) {
        // attaque : le coup part à l'instant d'impact de l'animation, si le joueur est encore à portée
        const duree = m.dureeAnimation('attaque');
        if (z.tAttaque == null) {
          z.tAttaque = 0;
          if (m.animation === 'attaque') m.relancer();
        }
        const avant = z.tAttaque;
        z.tAttaque += dt;
        if (momentImpact(avant, z.tAttaque, duree) && dist < portee * 1.3 && memeNiveau) surCoup(CONFIG.joueur.degatsZombie * (z.boss ? B.degats : 1), z);
        if (z.tAttaque >= duree) z.tAttaque = null;
      } else {
        const traque = etat === 'traque';
        let but = traque ? { x: jp.x, z: jp.z } : z.perception.cible;
        if (z.surface && !(traque && jIlot === z.surface)) {
          // le joueur n'est plus sur son îlot : il saute en bas, au bord le plus proche de son but
          const bord = bordLePlusProche(z.surface, but ?? jp);
          commencerEscalade(z, { x: bord.x, y: hauteurSurfaces(carte.surfaces, bord.x, bord.z, 0).h, z: bord.z }, E.sautBas, null);
          continue;
        }
        const lien = !z.surface && traque && jIlot ? choisirLien(carte.liens, jIlot.id, z.position) : null;
        // un rampeur ne grimpe plus : il attend au pied
        if (lien) {
          if (!z.rampe && Math.hypot(lien.bas.x - z.position.x, lien.bas.z - z.position.z) < 1) { // le pied est souvent dans une case bloquée de la grille
            commencerEscalade(z, { x: lien.haut.x, y: lien.haut.h, z: lien.haut.z }, lien.duree * (z.boss ? B.escalade : 1), jIlot);
            continue;
          }
          but = lien.bas;
        }
        if (!but) but = { x: z.position.x, z: z.position.z }; // fouille : nouvelle cible à la prochaine perception
        let cx = but.x, cz = but.z;
        if (!z.surface) {
          // au sol : A* (sur un îlot : déplacement direct vers le joueur)
          const direct = (!traque || memeNiveau || lien) && Math.hypot(but.x - z.position.x, but.z - z.position.z) < Z.distanceDirecte &&
            ligneLibre(grille, z.position, but);
          if (!direct) {
            z.prochainCalcul -= dt;
            const butChange = !z.butChemin || Math.hypot(z.butChemin.x - but.x, z.butChemin.z - but.z) > 1;
            if (z.prochainCalcul <= 0 || !z.chemin || butChange) {
              z.prochainCalcul = Z.recalculChemin;
              z.chemin = trouverChemin(grille, z.position, but);
              z.butChemin = { x: but.x, z: but.z };
              z.iChemin = 0;
            }
            if (z.chemin && z.chemin.length) {
              while (z.iChemin < z.chemin.length - 1 &&
                Math.hypot(z.chemin[z.iChemin].x - z.position.x, z.chemin[z.iChemin].z - z.position.z) < 0.5) z.iChemin++;
              // raccourci : viser le point suivant s'il est visible
              if (z.iChemin < z.chemin.length - 1 && ligneLibre(grille, z.position, z.chemin[z.iChemin + 1])) z.iChemin++;
              cx = z.chemin[z.iChemin].x; cz = z.chemin[z.iChemin].z;
            }
            // chemin null → déplacement direct (ne jamais rester figé) ; en fouille, cible inatteignable abandonnée
            else if (!traque) { z.perception.cible = null; cx = z.position.x; cz = z.position.z; }
          }
        }
        if (!traque && z.perception.cible) {
          // cible de fouille atteinte (ou au plus près possible) : la perception en tirera une autre
          const fin = z.chemin?.[z.chemin.length - 1];
          const dCible = Math.hypot(but.x - z.position.x, but.z - z.position.z);
          if (dCible < 0.8 || (fin && z.iChemin === z.chemin.length - 1 && Math.hypot(fin.x - z.position.x, fin.z - z.position.z) < 0.5)) {
            z.perception.cible = null;
          }
        }
        let mx = cx - z.position.x, mz = cz - z.position.z;
        const l = Math.hypot(mx, mz);
        if (l > 0.05) {
          mx /= l; mz /= l;
          // séparation entre zombies (même niveau)
          for (const o of liste) {
            if (o === z || o.mort || Math.abs(o.position.y - z.position.y) > 1) continue;
            const ox = z.position.x - o.position.x, oz = z.position.z - o.position.z;
            const d = Math.hypot(ox, oz);
            if (d > 0.001 && d < 0.7) { mx += (ox / d) * (0.7 - d) * 2; mz += (oz / d) * (0.7 - d) * 2; }
          }
          const lm = Math.hypot(mx, mz) || 1;
          const v = z.vitesse * dt * (z.recul > 0 ? 0.3 : 1) * (traque ? 1 : 0.6) * (z.rampe ? Z.rampe.vitesse : 1); // il fouille sans se presser
          const p = deplacer(z.position, (mx / lm) * v, (mz / lm) * v, Z.rayon, carte.aabbsZombies, z.position.y);
          if (z.surface) {
            // borné au-dessus de l'îlot (ne tombe pas du bord)
            const s = z.surface;
            p.x = Math.min(s.maxX - Z.rayon, Math.max(s.minX + Z.rayon, p.x));
            p.z = Math.min(s.maxZ - Z.rayon, Math.max(s.minZ + Z.rayon, p.z));
          }
          z.position.x = p.x; z.position.z = p.z;
          z.position.y = hauteurSol(p.x, p.z, z.position.y);
          angleCible = Math.atan2(mx, mz);
          enMarche = true;
        } else surveille = traque;
      }
      // en fouille, un zombie arrêté sur sa cible n'est pas bloqué ; sur un îlot, il est près du joueur
      if (surveille && majSuiviBlocage(z.suivi, z.position, dt, z.surface ? 0 : dist)) { surBloque?.(z); continue; }
      if (z.recul > 0) z.recul -= dt;

      // orientation et animation
      let da = angleCible - m.g.rotation.y;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      m.g.rotation.y += da * Math.min(1, dt * 8);
      m.g.position.set(z.position.x, z.position.y, z.position.z);
      const v = dt > 0 ? Math.hypot(z.position.x - ax, z.position.z - az) / dt : 0;
      z.vitesseReelle += (v - z.vitesseReelle) * Math.min(1, dt * 10); // lissée
      const e = z.escalade;
      animer(choisirAnimation({
        emergence: 0, mort: false,
        escalade: e ? (e.vers.y > e.de.y ? 'monte' : 'descend') : null,
        attaque: z.tAttaque != null, rampe: !!z.rampe, vitesse: enMarche ? z.vitesseReelle : 0, type: z.type,
      }));
    }
  }

  return {
    liste, faireApparaitre, majZombies, cibles, infliger, tuerTous, vider,
    get nbFlairs() { return nbFlairs; },
    definirModeles(m) { modeles = m; },
    // ombres portées des zombies (Haute seulement)
    ombres(actif) {
      ombresActives = actif;
      for (const z of liste) z.modele.ombres(actif);
    },
    get modelesCharges() { return !!modeles; },
  };
}
