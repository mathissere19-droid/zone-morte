import { test } from 'node:test';
import assert from 'node:assert/strict';
import { choisirAnimation, momentImpact, doitAnimer, toucheJambes, teteArrachee } from '../src/regles/animation-zombie.js';
import { CONFIG } from '../src/config.js';

const base = { emergence: 0, mort: false, escalade: null, attaque: false, rampe: false, vitesse: 1.2, type: 'marche' };
const choix = (e) => choisirAnimation({ ...base, ...e });

test('valeurs de config du Lot 1', () => {
  assert.deepEqual(CONFIG.zombie.rampe, { seuil: 0.4, vitesse: 0.35, portee: 1 });
  assert.equal(CONFIG.zombie.animation.fondu, 0.2);
  assert.equal(CONFIG.zombie.animation.distanceReduite, 25);
  assert.deepEqual(CONFIG.sang, { flaques: 24, duree: 20 });
  assert.equal(CONFIG.boss.nom, 'Le Colosse');
  assert.equal(CONFIG.boss.multiplicateurPv, 12);
});

test('choisirAnimation : chaque état', () => {
  assert.equal(choix({ mort: true }), null);
  assert.deepEqual(choix({ emergence: 0.5 }), { nom: 'sortie', vitesse: 1 });
  assert.deepEqual(choix({ escalade: 'monte' }), { nom: 'attaque', vitesse: 0.6 });
  assert.deepEqual(choix({ escalade: 'descend' }), { nom: 'course', vitesse: 0 });
  assert.deepEqual(choix({ attaque: true }), { nom: 'attaque', vitesse: 1 });
  assert.deepEqual(choix({ rampe: true }), { nom: 'ramper', vitesse: 1 });
  assert.deepEqual(choix({ rampe: true, vitesse: 0 }), { nom: 'ramper', vitesse: 0 });
  assert.deepEqual(choix({ vitesse: 0.01 }), { nom: 'attente', vitesse: 1 });
  assert.deepEqual(choix({ type: 'course', vitesse: 4 }), { nom: 'course', vitesse: 1 });
  assert.deepEqual(choix({ type: 'marcheRapide', vitesse: 2 }), { nom: 'marche', vitesse: 1.6 });
  assert.deepEqual(choix({}), { nom: 'marche', vitesse: 1 });
});

test('choisirAnimation : priorités', () => {
  assert.equal(choix({ mort: true, attaque: true }), null);
  assert.equal(choix({ emergence: 1, attaque: true }).nom, 'sortie');
  assert.equal(choix({ escalade: 'monte', attaque: true }).nom, 'attaque');
  assert.equal(choix({ escalade: 'monte', attaque: true }).vitesse, 0.6);
  // un rampeur reste au sol pour mordre (pas d'attaque debout)
  assert.deepEqual(choix({ attaque: true, rampe: true }), { nom: 'ramper', vitesse: 1 });
});

test("momentImpact : vrai une seule fois au franchissement", () => {
  // impact 0,45 × 1,4 = 0,63
  assert.equal(momentImpact(0.5, 0.7, 1.4), true);
  assert.equal(momentImpact(0.7, 0.9, 1.4), false);
  assert.equal(momentImpact(0.1, 0.5, 1.4), false);
  assert.equal(momentImpact(0.63, 0.7, 1.4), false);
  assert.equal(momentImpact(0.6, 0.63, 1.4), true);
});

test('doitAnimer : plein régime de près, une image sur deux au loin', () => {
  assert.equal(doitAnimer(10, 1), true);
  assert.equal(doitAnimer(25, 3), true);
  assert.equal(doitAnimer(30, 2), true);
  assert.equal(doitAnimer(30, 3), false);
});

test('toucheJambes : passe en rampeur à 40 % des PV max, une seule fois', () => {
  const z = { pv: 1000 };
  assert.equal(toucheJambes(z, 200, 1000), false);
  z.pv = 800;
  assert.equal(toucheJambes(z, 200, 1000), true);
  z.rampe = true;
  assert.equal(toucheJambes(z, 200, 1000), false);
  assert.equal(z.degatsJambes, 600);
});

test('toucheJambes : pas de rampeur si le coup tue ou si boss', () => {
  assert.equal(toucheJambes({ pv: 0 }, 500, 1000), false);
  assert.equal(toucheJambes({ pv: 500, boss: true }, 500, 1000), false);
});

test('teteArrachee', () => {
  assert.equal(teteArrachee({ tete: true, mortel: true, boss: false }), true);
  assert.equal(teteArrachee({ tete: true, mortel: false, boss: false }), false);
  assert.equal(teteArrachee({ tete: false, mortel: true, boss: false }), false);
  assert.equal(teteArrachee({ tete: true, mortel: true, boss: true }), false);
});
