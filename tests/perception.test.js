import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creerPerception, rayonBruit, voit, dansOmbre, majPerception } from '../src/regles/perception.js';
import { CONFIG } from '../src/config.js';

// zombie en (0, 0) regardant +z (orientation = atan2(dx, dz) = 0)
const vue = (joueur, o = {}) => voit({ zombie: { x: 0, z: 0 }, orientation: 0, joueur, ligneLibre: true, cacheDansOmbre: false, ...o });

test('voit : devant à 20 m → oui', () => assert.equal(vue({ x: 0, z: 20 }), true));
test('voit : devant à 30 m → non (au-delà de 25 m)', () => assert.equal(vue({ x: 0, z: 30 }), false));
test('voit : derrière → non', () => assert.equal(vue({ x: 0, z: -5 }), false));
test('voit : sur le côté à 50° → oui, à 70° → non (cône de 120°)', () => {
  const a = (deg) => ({ x: 10 * Math.sin(deg * Math.PI / 180), z: 10 * Math.cos(deg * Math.PI / 180) });
  assert.equal(vue(a(50)), true);
  assert.equal(vue(a(70)), false);
});
test('voit : à 15 m caché dans l\'ombre → non ; à 10 m → oui', () => {
  assert.equal(vue({ x: 0, z: 15 }, { cacheDansOmbre: true }), false);
  assert.equal(vue({ x: 0, z: 10 }, { cacheDansOmbre: true }), true);
});
test('voit : derrière un mur → non', () => assert.equal(vue({ x: 0, z: 5 }, { ligneLibre: false }), false));

test('rayonBruit : tir 30, arbalète 5, sprint 10, marche 5, accroupi 1,5, immobile 0', () => {
  assert.equal(rayonBruit({ tir: true, armeId: 'pistolet' }), 30);
  assert.equal(rayonBruit({ tir: true, armeId: 'arbalete' }), 5);
  assert.equal(rayonBruit({ sprint: true, mouvement: true }), 10);
  assert.equal(rayonBruit({ mouvement: true }), 5);
  assert.equal(rayonBruit({ mouvement: true, accroupi: true }), 1.5);
  assert.equal(rayonBruit({}), 0);
});

test('dansOmbre : loin des lumières, lampe éteinte → oui', () => {
  assert.equal(dansOmbre({ x: 0, z: 0 }, [{ x: 20, z: 0, rayon: 5 }], false), true);
});
test('dansOmbre : lampe allumée → non', () => {
  assert.equal(dansOmbre({ x: 0, z: 0 }, [], true), false);
});
test('dansOmbre : près d\'une source → non', () => {
  assert.equal(dansOmbre({ x: 18, z: 1 }, [{ x: 20, z: 0, rayon: 5 }], false), false);
});

const rngFixe = (...v) => { let i = 0; return () => v[i++ % v.length]; };

test('perception : apparition en traque', () => {
  const p = creerPerception({ x: 1, z: 2 });
  assert.equal(p.etat, 'traque'); assert.deepEqual(p.derniere, { x: 1, z: 2 }); assert.equal(p.sansContact, 0); assert.equal(p.cible, null);
});
test('perception : repéré → traque, dernière position = joueur', () => {
  const p = creerPerception({ x: 0, z: 0 });
  assert.equal(majPerception(p, { repere: true, joueur: { x: 5, z: 6 } }, 0.2, 15, Math.random), 'traque');
  assert.deepEqual(p.derniere, { x: 5, z: 6 });
});
test('perception : traque sans repérage → recherche là où il a perdu la trace', () => {
  const p = creerPerception({ x: 0, z: 0 });
  majPerception(p, { repere: true, joueur: { x: 5, z: 6 } }, 0.2, 15, Math.random);
  assert.equal(majPerception(p, { repere: false, joueur: { x: 50, z: 60 } }, 0.2, 15, Math.random), 'traque', 'il garde la trace un instant');
  assert.equal(majPerception(p, { repere: false, joueur: { x: 50, z: 60 } }, CONFIG.perception.memoire, 15, Math.random), 'recherche');
  assert.deepEqual(p.cible, { x: 50, z: 60 }); // là où il a perdu sa trace
});
test('perception : cible atteinte → nouvelle cible à moins de 6 m de la dernière position', () => {
  const p = creerPerception({ x: 0, z: 0 });
  majPerception(p, { repere: false, joueur: { x: 0, z: 0 } }, CONFIG.perception.memoire, 15, Math.random);
  for (const r of [0, 0.3, 0.99]) {
    p.cible = null;
    majPerception(p, { repere: false, joueur: { x: 50, z: 50 } }, 0.2, 15, rngFixe(r, r));
    assert.ok(p.cible, 'une cible est tirée');
    assert.ok(Math.hypot(p.cible.x, p.cible.z) <= CONFIG.perception.fouille + 1e-9);
  }
});
test('perception : flair après 15 s en Soldat, 6 s en Cauchemar', () => {
  for (const [id, delai] of [['soldat', 15], ['cauchemar', 6]]) {
    assert.equal(CONFIG.difficultes[id].delaiFlair, delai);
    const p = creerPerception({ x: 0, z: 0 });
    majPerception(p, { repere: false, joueur: { x: 0, z: 0 } }, CONFIG.perception.memoire, delai, Math.random); // → recherche
    let r, t = 0;
    do { r = majPerception(p, { repere: false, joueur: { x: 40, z: 40 } }, 0.2, delai, Math.random); t += 0.2; } while (r === 'recherche' && t < 100);
    assert.equal(r, 'flair');
    assert.ok(Math.abs(t - delai) < 0.3, `flair à ${t} s`);
    assert.equal(p.etat, 'traque');
    assert.deepEqual(p.derniere, { x: 40, z: 40 });
  }
});
test('perception : une alerte remet en traque', () => {
  const p = creerPerception({ x: 0, z: 0 });
  majPerception(p, { repere: false, joueur: { x: 0, z: 0 } }, CONFIG.perception.memoire, 15, Math.random);
  assert.equal(p.etat, 'recherche');
  assert.equal(majPerception(p, { repere: false, alerte: true, joueur: { x: 3, z: 3 } }, 0.2, 15, Math.random), 'traque');
  assert.equal(p.sansContact, 0);
});
test('délais de flair par difficulté', () => {
  assert.deepEqual(['recrue', 'soldat', 'veteran', 'cauchemar'].map((d) => CONFIG.difficultes[d].delaiFlair), [15, 15, 10, 6]);
});

test('perception : après un flair, il reste en traque le temps de rejoindre le joueur', () => {
  const p = creerPerception({ x: 0, z: 0 });
  majPerception(p, { repere: false, joueur: { x: 0, z: 0 } }, CONFIG.perception.memoire, 6, Math.random); // → recherche
  assert.equal(majPerception(p, { repere: false, joueur: { x: 9, z: 9 } }, 6, 6, Math.random), 'flair');
  for (let t = 0; t < CONFIG.perception.memoireFlair - 0.5; t += 0.2) {
    assert.equal(majPerception(p, { repere: false, joueur: { x: 9, z: 9 } }, 0.2, 6, Math.random), 'traque');
  }
  assert.equal(majPerception(p, { repere: false, joueur: { x: 9, z: 9 } }, 1, 6, Math.random), 'recherche');
});
