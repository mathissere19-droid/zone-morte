import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  creerPartie, majPartie, peutFaireApparaitre, enregistrerApparition, enregistrerMort,
  tirerBonus, choisirPointApparition,
} from '../src/regles/partie.js';

test('la vague 1 démarre après 3 s', () => {
  const p = creerPartie();
  assert.equal(majPartie(p, 2.9), null);
  assert.equal(p.vague, 0);
  assert.equal(majPartie(p, 0.2), 'vagueCommence');
  assert.equal(p.vague, 1);
  assert.equal(p.restants, 10);
  assert.equal(p.phase, 'combat');
});

test('plafond de 24 zombies vivants', () => {
  const p = creerPartie();
  p.vague = 4; majPartie(p, 3.1); // passe en vague 5 : 30 zombies
  assert.equal(p.restants, 30);
  let n = 0;
  while (peutFaireApparaitre(p)) { enregistrerApparition(p); n++; }
  assert.equal(n, 24);
  assert.equal(p.vivants, 24);
  assert.equal(p.restants, 6);
});

test('fin de vague puis pause de 10 s', () => {
  const p = creerPartie();
  majPartie(p, 3.1);
  while (peutFaireApparaitre(p)) enregistrerApparition(p);
  let r = null;
  for (let i = 0; i < 10; i++) r = enregistrerMort(p, { tete: i % 2 === 0 });
  assert.equal(r, 'vagueTerminee');
  assert.equal(p.phase, 'pause');
  assert.equal(p.chrono, 10);
  assert.equal(p.kills, 10);
  assert.equal(p.killsTete, 5);
  assert.equal(majPartie(p, 10.01), 'vagueCommence');
  assert.equal(p.vague, 2);
});

test('pause : le temps de partie et le chrono avancent seulement via majPartie', () => {
  const p = creerPartie();
  majPartie(p, 1);
  assert.equal(p.temps, 1);
});

test('4 bonus maximum par vague, remis à zéro à la vague suivante', () => {
  const p = creerPartie();
  majPartie(p, 3.1);
  let n = 0;
  for (let i = 0; i < 10; i++) if (tirerBonus(p, () => 0)) n++;
  assert.equal(n, 4);
  assert.equal(tirerBonus(p, () => 0.5), false);
  while (peutFaireApparaitre(p)) enregistrerApparition(p);
  for (let i = 0; i < 10; i++) enregistrerMort(p, { tete: false });
  majPartie(p, 10.01);
  assert.equal(tirerBonus(p, () => 0), true);
});

test('point d\'apparition : loin et invisible en priorité, sinon le plus éloigné', () => {
  const joueur = { x: 0, z: 0 };
  const pts = [{ x: 2, z: 0 }, { x: 20, z: 0 }, { x: 0, z: 30 }];
  assert.deepEqual(choisirPointApparition(pts, joueur, (pt) => pt.z === 30, () => 0), { x: 20, z: 0 });
  assert.deepEqual(choisirPointApparition(pts, joueur, () => true, () => 0), { x: 20, z: 0 });
  const proches = [{ x: 1, z: 0 }, { x: 3, z: 0 }];
  assert.deepEqual(choisirPointApparition(proches, joueur, () => true, () => 0), { x: 3, z: 0 });
});
