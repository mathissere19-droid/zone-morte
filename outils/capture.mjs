// Capture d'écran du jeu pour juger le rendu : node outils/capture.mjs <qualite> <x> <z> <angleDeg> <fichier> [lampe]
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [qualite = 'haute', x = '-5', z = '5', angle = '0', fichier = 'capture.png', lampe] = process.argv.slice(2);
const serveur = spawn('python', ['-m', 'http.server', '8645'], { cwd: racine, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', (e) => console.log('erreur', String(e)));
  await p.goto(`http://localhost:8645/?test=1&qualite=${qualite}`);
  await p.waitForFunction(() => window.__jeu && window.__jeu.scene.environment, null, { timeout: 60000 });
  await p.evaluate(([x, z, a, l]) => {
    const j = window.__jeu; j.demarrerPartie('recrue'); j.joueur.vie.pv = 1e9; j.accelerer(1);
    j.joueur.placer(+x, +z); j.camera.rotation.set(0, (+a * Math.PI) / 180, 0, 'YXZ');
    if (l) j.entrees.appuis.add('KeyF');
  }, [x, z, angle, lampe]);
  await new Promise((r) => setTimeout(r, 6000));
  await p.evaluate(() => { document.getElementById('hud').style.display = 'none'; });
  await new Promise((r) => setTimeout(r, 1000));
  await p.screenshot({ path: fichier });
} finally { await b.close(); serveur.kill(); }
