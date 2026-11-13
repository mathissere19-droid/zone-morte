// Scénarios du test de fumée, exécutés dans l'ordre sur la page chargée en ?test=1.
export const scenarios = [
  {
    nom: 'démarrage de partie et collisions de bord',
    async executer(page, verifier, attendre) {
      await page.evaluate(() => window.__jeu.demarrerPartie());
      await attendre(300);
      verifier(await page.evaluate(() => window.__jeu.etat) === 'partie', 'état partie');
      await page.evaluate(() => { window.__jeu.joueur.position.x += 100; });
      await attendre(200);
      const x = await page.evaluate(() => window.__jeu.joueur.position.x);
      verifier(x >= -40 && x <= 40, 'le joueur reste dans la carte (x=' + x.toFixed(2) + ')');
      await page.evaluate(() => window.__jeu.joueur.placer(-2, 4));
      await attendre(100);
    },
  },
];
scenarios.push({
  nom: 'apparition des zombies (vague 1)',
  async executer(page, verifier, attendre) {
    await page.evaluate(() => { window.__jeu.joueur.vie.pv = 1e9; window.__jeu.accelerer(5); });
    await attendre(6000);
    const r = await page.evaluate(() => ({ n: window.__jeu.zombies.liste.length, v: window.__jeu.partie.vague }));
    verifier(r.n > 0, 'des zombies sont apparus (' + r.n + ')');
    verifier(r.v === 1, 'vague 1 en cours');
    // les zombies se rapprochent du joueur
    const d = () => page.evaluate(() => {
      const j = window.__jeu.joueur.position;
      const l = window.__jeu.zombies.liste.filter((z) => !z.mort && z.emergence <= 0);
      return l.length ? Math.min(...l.map((z) => Math.hypot(z.position.x - j.x, z.position.z - j.z))) : 999;
    });
    const d1 = await d(); await attendre(1500); const d2 = await d();
    verifier(d2 < d1 || d2 < 1.5, 'les zombies avancent vers le joueur (' + d1.toFixed(1) + ' → ' + d2.toFixed(1) + ')');
    await page.evaluate(() => window.__jeu.accelerer(1));
  },
});
