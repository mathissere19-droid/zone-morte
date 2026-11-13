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
scenarios.push({
  nom: 'tir sur un zombie : points gagnés',
  async executer(page, verifier, attendre) {
    await page.evaluate(() => {
      const j = window.__jeu;
      j.demarrerPartie();
      j.joueur.vie.pv = 1e9;
      j.joueur.placer(-2, 4);
      j.joueur.vie.pv = 1e9;
      j.camera.rotation.set(0, 0, 0); // regarde vers -z
      const z = j.zombies.faireApparaitre({ x: -2, z: -2 }, 1);
      z.emergence = 0; z.vitesse = 0;
    });
    await attendre(300);
    const avant = await page.evaluate(() => window.__jeu.portefeuille.points);
    for (let i = 0; i < 6; i++) {
      await page.evaluate(() => { window.__jeu.camera.rotation.set(-0.06, 0, 0); window.__jeu.tirer(); });
      await attendre(200);
    }
    const r = await page.evaluate(() => ({ pts: window.__jeu.portefeuille.points, kills: window.__jeu.partie.kills }));
    verifier(r.pts > avant, 'des points ont été gagnés (' + avant + ' → ' + r.pts + ')');
    verifier(r.kills >= 1, 'le zombie est mort (kills=' + r.kills + ')');
  },
});
scenarios.push({
  nom: 'porte du hangar sans assez de points',
  async executer(page, verifier, attendre) {
    await page.evaluate(() => {
      const j = window.__jeu;
      j.zombies.vider();
      j.portefeuille.points = 0;
      j.joueur.placer(-4, -10.5);
      j.interagir();
    });
    await attendre(100);
    const r = await page.evaluate(() => ({ pts: window.__jeu.portefeuille.points, ouverte: window.__jeu.carte.portes[0].ouverte, msg: document.getElementById('message').textContent }));
    verifier(r.pts === 0 && !r.ouverte, 'porte toujours fermée, points inchangés');
    verifier(r.msg === 'Pas assez de points', 'message « Pas assez de points »');
    await page.evaluate(() => { window.__jeu.portefeuille.points = 800; window.__jeu.interagir(); });
    const r2 = await page.evaluate(() => ({ pts: window.__jeu.portefeuille.points, ouverte: window.__jeu.carte.portes[0].ouverte, hangar: window.__jeu.carte.zones.hangar.debloquee }));
    verifier(r2.ouverte && r2.pts === 50 && r2.hangar, 'porte ouverte pour 750 points, hangar débloqué');
    await page.evaluate(() => { window.__jeu.joueur.placer(-4, -14); });
    await attendre(200);
    verifier(await page.evaluate(() => window.__jeu.joueur.position.z) < -13, 'on peut entrer dans le hangar');
    await page.evaluate(() => window.__jeu.demarrerPartie());
    await attendre(100);
    verifier(await page.evaluate(() => !window.__jeu.carte.portes[0].ouverte && !window.__jeu.carte.zones.hangar.debloquee), 'Rejouer referme les portes');
  },
});
