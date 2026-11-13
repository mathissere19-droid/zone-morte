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
