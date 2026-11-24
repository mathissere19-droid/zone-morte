// Test de fumée : lance le jeu dans Edge (sans fenêtre) et vérifie qu'il tourne sans erreur.
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PORT = 8643;
const serveur = spawn('python', ['-m', 'http.server', String(PORT)], { cwd: racine, stdio: 'ignore' });
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

const erreurs = [];
let navigateur;
let echec = null;

function verifier(condition, message) {
  if (!condition) throw new Error('ECHEC : ' + message);
  console.log('  ok - ' + message);
}

try {
  await attendre(800);
  navigateur = await chromium.launch({
    channel: 'msedge', headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const page = await navigateur.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
  page.on('pageerror', (e) => erreurs.push(String(e)));

  // FUMEE_QUALITE=haute : tout le parcours dans un autre niveau de qualité (Basse par défaut en test)
  const qualite = process.env.FUMEE_QUALITE ? '&qualite=' + process.env.FUMEE_QUALITE : '';
  await page.goto(`http://localhost:${PORT}/?test=1${qualite}`);
  await page.waitForFunction(() => window.__jeu && window.__jeu.pret !== false, null, { timeout: 30000 });
  verifier(true, 'le jeu se charge');

  const scenarios = await import('./scenarios.mjs').then((m) => m.scenarios).catch(() => []);
  const filtre = process.env.FUMEE_FILTRE; // ex. FUMEE_FILTRE=conteneur : seulement ces scénarios
  for (const s of scenarios.filter((s) => !filtre || s.nom.includes(filtre))) {
    console.log('- ' + s.nom);
    await s.executer(page, verifier, attendre);
  }

  await page.screenshot({ path: path.join(racine, 'tests/fumee/capture.png') });
  verifier(erreurs.length === 0, 'aucune erreur console (' + erreurs.join(' | ') + ')');
} catch (e) {
  echec = e;
} finally {
  if (navigateur) await navigateur.close();
  serveur.kill();
}

if (echec) {
  console.error(echec.message);
  if (erreurs.length) console.error('Erreurs console :', erreurs);
  process.exit(1);
}
console.log('FUMEE OK');
