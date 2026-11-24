// Effets visuels : étincelles et poussière d'impact, trous de balle, sang, feu, éclair, explosion et fumée.
// Les textures des sprites sont dessinées en canvas (aucun fichier). Les lumières sont permanentes
// (intensité 0 au repos) : en ajouter/retirer forcerait three.js à recompiler les shaders.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { ajouterBorne, nombreParticules } from './regles/tampon.js';

function textureCanvas(taille, dessiner) {
  const c = document.createElement('canvas');
  c.width = c.height = taille;
  dessiner(c.getContext('2d'), taille);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function degradeRadial(arrets) {
  return textureCanvas(64, (ctx, n) => {
    const g = ctx.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    for (const [pos, couleur] of arrets) g.addColorStop(pos, couleur);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, n, n);
  });
}

// fumée : plusieurs disques flous superposés, pour un contour irrégulier
function textureFumee() {
  return textureCanvas(128, (ctx, n) => {
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.random() * n * 0.18;
      const x = n / 2 + Math.cos(a) * d, y = n / 2 + Math.sin(a) * d, r = n * (0.18 + Math.random() * 0.2);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.35)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, n, n);
    }
  });
}

// flamme de bouche : étoile à branches
export function textureEtoile() {
  return textureCanvas(64, (ctx, n) => {
    ctx.translate(n / 2, n / 2);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, n / 2);
    g.addColorStop(0, 'rgba(255,255,230,1)');
    g.addColorStop(0.3, 'rgba(255,200,90,0.9)');
    g.addColorStop(1, 'rgba(255,120,20,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    const branches = 6;
    for (let i = 0; i < branches * 2; i++) {
      const a = (i / (branches * 2)) * Math.PI * 2, r = i % 2 ? n * 0.12 : n * 0.5;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  });
}

export function creerEffets(scene) {
  const E = CONFIG.rendu.effets;
  const tex = {
    etincelle: degradeRadial([[0, 'rgba(255,255,220,1)'], [0.25, 'rgba(255,190,80,0.9)'], [1, 'rgba(255,120,0,0)']]),
    doux: degradeRadial([[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,255,255,0.5)'], [1, 'rgba(255,255,255,0)']]),
    feu: degradeRadial([[0, 'rgba(255,250,210,1)'], [0.35, 'rgba(255,170,60,0.8)'], [1, 'rgba(200,40,0,0)']]),
    fumee: textureFumee(),
  };
  let facteur = 1;

  // ---------- particules ----------
  // p : { s (sprite), v (vitesse), t, vie, gravite, taille: [début, fin], opacite: [a, b, …] (courbe), couleurs?: [THREE.Color…] }
  const particules = [];
  const fumees = []; // sous-ensemble : fumée d'explosion (suivi par les tests)

  function particule(texture, { position, v, vie, gravite = 0, taille, opacite = [1, 0], additif = true, couleurs = null, couleur = 0xffffff }) {
    if (particules.length >= E.particulesMax) return null;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texture, color: couleur, transparent: true, depthWrite: false,
      blending: additif ? THREE.AdditiveBlending : THREE.NormalBlending,
    }));
    s.position.copy(position);
    s.material.rotation = Math.random() * Math.PI * 2;
    s.scale.setScalar(taille[0]);
    s.raycast = () => {};
    scene.add(s);
    const p = { s, v, t: 0, vie, gravite, taille, opacite, couleurs };
    particules.push(p);
    return p;
  }

  function retirer(p) {
    scene.remove(p.s);
    p.s.material.dispose();
  }

  // interpolation linéaire le long d'une liste de valeurs régulièrement espacées
  function courbe(valeurs, k) {
    const x = k * (valeurs.length - 1), a = Math.floor(x), b = Math.min(a + 1, valeurs.length - 1);
    return valeurs[a] + (valeurs[b] - valeurs[a]) * (x - a);
  }
  const aleatoire = (amp) => (Math.random() - 0.5) * 2 * amp;
  const directionAleatoire = (autour, ouverture) => new THREE.Vector3(
    autour.x + aleatoire(ouverture), autour.y + aleatoire(ouverture), autour.z + aleatoire(ouverture)).normalize();

  // ---------- trous de balle et taches de sang ----------
  const trous = [];
  const geoTrou = new THREE.CircleGeometry(0.04, 10);
  const matTrou = new THREE.MeshStandardMaterial({
    color: 0x0c0b0a, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const geoTache = new THREE.CircleGeometry(0.075, 9);
  const matTache = new THREE.MeshStandardMaterial({
    color: 0x3a0303, roughness: 0.35, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });

  // pose un disque plaqué sur une surface, accroché à l'objet touché (suit une porte, un zombie…)
  function poserDisque(geo, mat, point, normale, objet) {
    const d = new THREE.Mesh(geo, mat);
    d.position.copy(point).addScaledVector(normale, 0.01);
    d.lookAt(point.clone().add(normale));
    d.rotateZ(Math.random() * Math.PI * 2);
    d.raycast = () => {};
    d.receiveShadow = true;
    scene.add(d);
    if (objet) objet.attach(d);
    return d;
  }

  // ---------- lumières permanentes ----------
  const lumiereEclair = new THREE.PointLight(0x9fc8ff, 0, 12, 2);
  const lumiereExplosion = new THREE.PointLight(0xff8030, 0, 18, 2);
  scene.add(lumiereEclair, lumiereExplosion);
  let tEclair = 0, tExplosion = 0;

  // ---------- éclairs ----------
  const eclairs = [];
  const matsEclair = [
    new THREE.LineBasicMaterial({ color: 0xe8f4ff, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }),
    new THREE.LineBasicMaterial({ color: 0x6aa8ff, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }),
  ];

  const effets = {
    trous, fumees, particules,

    qualite(params) { facteur = params.particules; },

    impactMur(point, normale, objet) {
      for (let i = 0; i < nombreParticules(6, facteur); i++) {
        particule(tex.etincelle, {
          position: point, v: directionAleatoire(normale, 0.8).multiplyScalar(3 + Math.random() * 4),
          vie: 0.18 + Math.random() * 0.12, gravite: 9, taille: [0.07, 0.02],
        });
      }
      for (let i = 0; i < nombreParticules(4, facteur); i++) {
        particule(tex.fumee, {
          position: point.clone().addScaledVector(normale, 0.05), v: directionAleatoire(normale, 0.6).multiplyScalar(0.6 + Math.random() * 0.6),
          vie: 0.6 + Math.random() * 0.4, gravite: -0.3, taille: [0.12, 0.5], opacite: [0.55, 0], additif: false, couleur: 0x8a857c,
        });
      }
      const ancien = ajouterBorne(trous, poserDisque(geoTrou, matTrou, point, normale, objet), E.trousMax);
      if (ancien) ancien.removeFromParent();
    },

    // objet : maillage du zombie touché (la tache le suit)
    impactChair(point, objet, direction) {
      const arriere = direction ? direction.clone().negate() : new THREE.Vector3(0, 1, 0);
      for (let i = 0; i < nombreParticules(8, facteur); i++) {
        particule(tex.doux, {
          position: point, v: directionAleatoire(direction ?? arriere, 0.9).multiplyScalar(1.5 + Math.random() * 2.5),
          vie: 0.3 + Math.random() * 0.15, gravite: 9, taille: [0.06, 0.1], opacite: [0.95, 0], additif: false, couleur: 0x5a0505,
        });
      }
      const z = objet?.userData.zombie;
      if (!z) return;
      z._taches ??= [];
      const ancien = ajouterBorne(z._taches, poserDisque(geoTache, matTache, point, arriere, objet), E.tachesParZombie);
      if (ancien) ancien.removeFromParent();
    },

    feu(origine, direction) {
      for (let i = 0; i < nombreParticules(3, facteur); i++) {
        particule(tex.feu, {
          position: origine.clone().addScaledVector(direction, 0.3),
          v: directionAleatoire(direction, 0.12).multiplyScalar(9 + Math.random() * 4).add(new THREE.Vector3(0, 0.8, 0)),
          vie: 0.45 + Math.random() * 0.15, gravite: -2.5, taille: [0.15, 1.3], opacite: [0.9, 0],
          couleurs: [new THREE.Color(0xfff0b0), new THREE.Color(0xff8a20), new THREE.Color(0xc02800), new THREE.Color(0x2a2420)],
        });
      }
    },

    eclair(points) {
      // ligne brisée principale + halo plus diffus (deux tracés décalés)
      for (const [k, mat] of [[0, matsEclair[0]], [1, matsEclair[1]], [2, matsEclair[1]]]) {
        const brises = [];
        for (let i = 0; i < points.length - 1; i++) {
          for (let j = 0; j < 6; j++) {
            const p = points[i].clone().lerp(points[i + 1], j / 6);
            const amp = j > 0 ? (k ? 0.18 : 0.3) : 0;
            p.add(new THREE.Vector3(aleatoire(amp), aleatoire(amp), aleatoire(amp)));
            brises.push(p);
          }
        }
        brises.push(points[points.length - 1]);
        const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(brises), mat);
        l.raycast = () => {};
        scene.add(l);
        eclairs.push({ l, t: 0.1 });
      }
      lumiereEclair.position.copy(points[points.length - 1]);
      lumiereEclair.intensity = 25;
      tEclair = 0.1;
    },

    explosion(position) {
      // boule de feu
      for (let i = 0; i < nombreParticules(6, facteur); i++) {
        particule(tex.feu, {
          position: position.clone().add(new THREE.Vector3(aleatoire(0.4), aleatoire(0.3), aleatoire(0.4))),
          v: new THREE.Vector3(aleatoire(2), Math.random() * 2, aleatoire(2)),
          vie: 0.45 + Math.random() * 0.25, taille: [1.5, 5], opacite: [1, 0.8, 0],
          couleurs: [new THREE.Color(0xfff4c0), new THREE.Color(0xff9030), new THREE.Color(0x902000)],
        });
      }
      // gerbe d'étincelles
      for (let i = 0; i < nombreParticules(20, facteur); i++) {
        particule(tex.etincelle, {
          position, v: directionAleatoire(new THREE.Vector3(0, 0.6, 0), 1).multiplyScalar(6 + Math.random() * 8),
          vie: 0.5 + Math.random() * 0.5, gravite: 9, taille: [0.12, 0.04],
        });
      }
      // fumée qui grossit et monte
      for (let i = 0; i < nombreParticules(12, facteur); i++) {
        const p = particule(tex.fumee, {
          position: position.clone().add(new THREE.Vector3(aleatoire(1), Math.random() * 0.8, aleatoire(1))),
          v: new THREE.Vector3(aleatoire(0.8), 0.8 + Math.random() * 1.2, aleatoire(0.8)),
          vie: 2 + Math.random() * 0.5, gravite: 0.2, taille: [1, 4.5], opacite: [0, 0.55, 0.4, 0], additif: false, couleur: 0x4a4642,
        });
        if (p) fumees.push(p);
      }
      lumiereExplosion.position.copy(position);
      lumiereExplosion.intensity = 60;
      tExplosion = 0.4;
    },

    maj(dt) {
      for (let i = particules.length - 1; i >= 0; i--) {
        const p = particules[i];
        p.t += dt;
        const k = p.t / p.vie;
        if (k >= 1) {
          retirer(p);
          particules.splice(i, 1);
          const f = fumees.indexOf(p);
          if (f >= 0) fumees.splice(f, 1);
          continue;
        }
        p.v.y -= p.gravite * dt;
        p.s.position.addScaledVector(p.v, dt);
        // fumée et feu ralentissent dans l'air
        if (p.taille[1] > p.taille[0]) p.v.multiplyScalar(Math.max(0, 1 - dt * 1.5));
        p.s.scale.setScalar(p.taille[0] + (p.taille[1] - p.taille[0]) * k);
        p.s.material.opacity = courbe(p.opacite, k);
        if (p.couleurs) {
          const x = k * (p.couleurs.length - 1), a = Math.floor(x);
          p.s.material.color.copy(p.couleurs[a]).lerp(p.couleurs[Math.min(a + 1, p.couleurs.length - 1)], x - a);
        }
      }
      for (let i = eclairs.length - 1; i >= 0; i--) {
        eclairs[i].t -= dt;
        if (eclairs[i].t <= 0) { scene.remove(eclairs[i].l); eclairs[i].l.geometry.dispose(); eclairs.splice(i, 1); }
      }
      tEclair -= dt;
      lumiereEclair.intensity = tEclair > 0 ? 25 * (0.5 + Math.random() * 0.5) : 0;
      tExplosion -= dt;
      lumiereExplosion.intensity = Math.max(0, tExplosion / 0.4) * 60;
    },

    vider() {
      for (const p of particules) retirer(p);
      particules.length = 0;
      fumees.length = 0;
      for (const t of trous) t.removeFromParent();
      trous.length = 0;
      for (const e of eclairs) { scene.remove(e.l); e.l.geometry.dispose(); }
      eclairs.length = 0;
      tEclair = tExplosion = 0;
      lumiereEclair.intensity = lumiereExplosion.intensity = 0;
    },
  };
  return effets;
}
