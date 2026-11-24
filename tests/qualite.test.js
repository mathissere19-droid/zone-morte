import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parametresQualite, creerSurveillancePerf, majSurveillancePerf, IDS_QUALITE } from '../src/regles/qualite.js';

test('trois niveaux', () => assert.deepEqual(IDS_QUALITE, ['basse', 'moyenne', 'haute']));

test('paramètres par niveau', () => {
  assert.equal(parametresQualite('basse').resolution, 0.7);
  assert.equal(parametresQualite('basse').particules, 0.4);
  assert.equal(parametresQualite('moyenne').ombres, 'projecteurs');
  assert.equal(parametresQualite('haute').ssao, true);
  assert.equal(parametresQualite('haute').projecteurs, 4);
  assert.equal(parametresQualite('xxx').nom, 'Moyenne');
});

test('alerte perf : seulement en Haute, après 5 s sous 40 i/s, une seule fois', () => {
  const s = creerSurveillancePerf();
  for (let i = 0; i < 200; i++) assert.equal(majSurveillancePerf(s, 1 / 30, 'moyenne'), false);
  let alertes = 0;
  for (let i = 0; i < 149; i++) alertes += majSurveillancePerf(s, 1 / 30, 'haute');
  assert.equal(alertes, 0); // 149/30 s < 5 s
  alertes += majSurveillancePerf(s, 1 / 30, 'haute');
  alertes += majSurveillancePerf(s, 1 / 30, 'haute');
  for (let i = 0; i < 300; i++) alertes += majSurveillancePerf(s, 1 / 30, 'haute');
  assert.equal(alertes, 1);
});

test('une image rapide remet le compteur à zéro', () => {
  const s = creerSurveillancePerf();
  for (let i = 0; i < 140; i++) majSurveillancePerf(s, 1 / 30, 'haute');
  majSurveillancePerf(s, 1 / 60, 'haute');
  assert.equal(s.lent, 0);
});
