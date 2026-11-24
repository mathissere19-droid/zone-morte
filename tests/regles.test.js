import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creerPortefeuille, gainCoup, crediter, payer, tirageCaisse, acheterMur } from '../src/regles/economie.js';
import { degatsTir, degatsCouteau, degatsExplosion, degatsExplosionJoueur } from '../src/regles/combat.js';
import {
  creerInventaire, armeActive, tirer, peutRecharger, recharger, possede, ajouterArme,
  remplirTout, munitionsPleines, changer,
} from '../src/regles/inventaire.js';
import { creerVie, subir, majVie, estMort } from '../src/regles/vie.js';

const seq = (valeurs) => { let i = 0; return () => valeurs[i++ % valeurs.length]; };

test('gains de points', () => {
  assert.equal(gainCoup({ mortel: false, tete: false, couteau: false }, false), 10);
  assert.equal(gainCoup({ mortel: true, tete: false, couteau: false }, false), 60);
  assert.equal(gainCoup({ mortel: true, tete: true, couteau: false }, false), 100);
  assert.equal(gainCoup({ mortel: true, tete: false, couteau: true }, true), 260);
});

test('payer refuse sans débiter si pas assez', () => {
  const pf = creerPortefeuille(500);
  assert.equal(payer(pf, 750), false);
  assert.equal(pf.points, 500);
  assert.equal(payer(pf, 500), true);
  assert.equal(pf.points, 0);
  crediter(pf, 60);
  assert.equal(pf.points, 60);
  assert.equal(creerPortefeuille().points, 500);
});

test('caisse : rare et exclusion des armes possédées', () => {
  assert.equal(tirageCaisse(seq([0.05, 0]), ['pistolet']), 'precision');
  for (let i = 0; i < 4; i++) {
    const id = tirageCaisse(seq([0.5, i / 4]), ['pistolet']);
    assert.notEqual(id, 'pistolet');
  }
});

test('dégâts', () => {
  assert.equal(degatsTir('pistolet', 'tete', 10), 120);
  assert.equal(degatsTir('pistolet', 'corps', 10), 40);
  assert.equal(degatsTir('pompe', 'corps', 20), 9);
  assert.equal(degatsTir('pompe', 'tete', 2), 60);
  assert.equal(degatsCouteau(), 150);
  assert.equal(degatsExplosion(3), 300);
  assert.equal(degatsExplosion(5), 0);
  assert.equal(degatsExplosionJoueur(2), 50);
});

test('achat au mur', () => {
  const pf = creerPortefeuille(1500), inv = creerInventaire();
  assert.equal(acheterMur(pf, inv, 'mitraillette'), 'achete');
  assert.equal(pf.points, 500);
  assert.equal(armeActive(inv).id, 'mitraillette');
  assert.equal(acheterMur(pf, inv, 'mitraillette'), 'plein');
  assert.equal(pf.points, 500);
  tirer(inv); recharger(inv);
  assert.equal(munitionsPleines(inv, 'mitraillette'), false);
  assert.equal(acheterMur(pf, inv, 'mitraillette'), 'recharge');
  assert.equal(pf.points, 0);
  assert.equal(acheterMur(pf, inv, 'assaut'), 'pas-assez');
  assert.equal(possede(inv, 'assaut'), false);
});

test('inventaire', () => {
  const inv = creerInventaire();
  assert.deepEqual(armeActive(inv), { id: 'pistolet', chargeur: 8, reserve: 32 });
  for (let i = 0; i < 8; i++) assert.equal(tirer(inv), true);
  assert.equal(tirer(inv), false);
  assert.equal(peutRecharger(inv), true);
  recharger(inv);
  assert.deepEqual(armeActive(inv), { id: 'pistolet', chargeur: 8, reserve: 24 });
  ajouterArme(inv, 'mitraillette');
  ajouterArme(inv, 'pompe');
  assert.equal(inv.armes.length, 2);
  assert.equal(armeActive(inv).id, 'pompe');
  assert.equal(possede(inv, 'mitraillette'), false);
  changer(inv, 0);
  assert.equal(armeActive(inv).id, 'pistolet');
  remplirTout(inv);
  assert.equal(munitionsPleines(inv, 'pistolet'), true);
  assert.equal(peutRecharger(inv), false);
});

test('vie et régénération', () => {
  const v = creerVie();
  subir(v, 40); subir(v, 40);
  majVie(v, 3.9);
  assert.equal(v.pv, 20);
  majVie(v, 0.2);
  majVie(v, 1);
  assert.equal(v.pv, 100);
  subir(v, 40); subir(v, 40); subir(v, 40);
  assert.equal(v.pv, 0);
  assert.ok(estMort(v));
});

test('dégâts des nouvelles armes classiques', () => {
  assert.equal(degatsTir('revolver', 'tete', 5), 440);
  assert.equal(degatsTir('pompeAuto', 'corps', 20), Math.round(26 * 0.3));
  assert.equal(degatsTir('pompeAuto', 'tete', 0), 52);
  assert.equal(degatsTir('arbalete', 'corps', 30), 900);
});

test('caisse : les nouvelles armes communes peuvent sortir', () => {
  assert.equal(tirageCaisse(seq([0.5, 0.99]), []), 'arbalete');
});
