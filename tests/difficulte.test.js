import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  IDS_DIFFICULTE, choisirDifficulte, difficulteActive, pvZombieActif, degatsRecus, reserveMax,
} from '../src/regles/difficulte.js';
import { partCoureurs } from '../src/regles/vagues.js';
import { creerVie, majVie } from '../src/regles/vie.js';
import { creerInventaire } from '../src/regles/inventaire.js';
import { creerPortefeuille } from '../src/regles/economie.js';

afterEach(() => choisirDifficulte('soldat'));

test('choix de la difficulté, soldat par défaut', () => {
  assert.deepEqual(IDS_DIFFICULTE, ['recrue', 'soldat', 'veteran', 'cauchemar']);
  assert.equal(difficulteActive().id, 'soldat');
  choisirDifficulte('cauchemar');
  assert.equal(difficulteActive().id, 'cauchemar');
  choisirDifficulte('xxx');
  assert.equal(difficulteActive().id, 'soldat');
});

test('PV des zombies selon la difficulté', () => {
  assert.equal(pvZombieActif(1), 150);
  choisirDifficulte('recrue');
  assert.equal(pvZombieActif(1), 105);
  choisirDifficulte('cauchemar');
  assert.equal(pvZombieActif(1), 240);
});

test('dégâts reçus selon la difficulté', () => {
  assert.equal(degatsRecus(40), 40);
  choisirDifficulte('recrue');
  assert.equal(degatsRecus(40), 24);
  choisirDifficulte('cauchemar');
  assert.equal(degatsRecus(40), 72);
});

test('part de coureurs décalée par la première vague de coureurs', () => {
  assert.equal(partCoureurs(1, 1), 0.1);
  assert.equal(partCoureurs(7, 8), 0);
  assert.equal(partCoureurs(8, 8), 0.1);
  assert.equal(partCoureurs(5), 0.1);
});

test('régénération désactivée quand le délai est null', () => {
  const vie = creerVie();
  vie.pv = 10; vie.depuisCoup = 100;
  majVie(vie, 1, null);
  assert.equal(vie.pv, 10);
  vie.depuisCoup = 3;
  majVie(vie, 0.5, 3);
  assert.ok(vie.pv > 10);
});

test('munitions et points de départ selon la difficulté', () => {
  choisirDifficulte('recrue');
  assert.equal(creerInventaire().armes[0].reserve, 48);
  assert.equal(creerPortefeuille().points, 1000);
  choisirDifficulte('cauchemar');
  assert.equal(reserveMax('mitraillette'), 113);
});
