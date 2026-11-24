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
scenarios.push({
  nom: 'pause quand l\'onglet est caché',
  async executer(page, verifier, attendre) {
    await page.evaluate(() => { window.__jeu.demarrerPartie(); window.__jeu.joueur.vie.pv = 1e9; });
    await attendre(300);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    const t1 = await page.evaluate(() => window.__jeu.partie.temps);
    await attendre(1000);
    const r = await page.evaluate(() => ({ etat: window.__jeu.etat, t: window.__jeu.partie.temps, ecran: !document.getElementById('ecran-pause').classList.contains('cache') }));
    verifier(r.etat === 'pause' && r.ecran, 'état pause et écran de pause affiché');
    verifier(r.t === t1, 'le temps de partie est figé pendant la pause');
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      window.__jeu.reprendre();
    });
    await attendre(200);
    verifier(await page.evaluate(() => window.__jeu.etat) === 'partie', 'reprise de la partie');
  },
});
scenarios.push({
  nom: 'mort du joueur, écran de fin et record',
  async executer(page, verifier, attendre) {
    await page.evaluate(() => { localStorage.removeItem('zoneMorte.record'); localStorage.removeItem('zoneMorte.record.soldat'); window.__jeu.partie.vague = 3; window.__jeu.joueur.vie.pv = 0; });
    await attendre(300);
    const r = await page.evaluate(() => ({
      etat: window.__jeu.etat,
      ecran: !document.getElementById('ecran-fin').classList.contains('cache'),
      record: localStorage.getItem('zoneMorte.record.soldat'),
      texte: document.getElementById('record-fin').textContent,
    }));
    verifier(r.etat === 'fin' && r.ecran, 'écran de fin affiché');
    verifier(r.record === '3' && r.texte.includes('Nouveau record'), 'record de la vague 3 enregistré');
    await page.evaluate(() => document.getElementById('btn-rejouer').click());
    await attendre(300);
    verifier(await page.evaluate(() => window.__jeu.etat === 'partie' && window.__jeu.partie.vague === 0 && window.__jeu.portefeuille.points === 500), 'Rejouer relance une partie neuve');
  },
});
scenarios.push({
  nom: "points d'apparition hors des obstacles",
  async executer(page, verifier) {
    const coinces = await page.evaluate(() => {
      const j = window.__jeu, r = 0.35, out = [];
      for (const [n, z] of Object.entries(j.carte.zones)) for (const pt of z.pointsApparition) {
        const dedans = j.carte.aabbsZombies.some((b) => (b.maxY ?? 3) > 0.35 &&
          pt.x + r > b.minX && pt.x - r < b.maxX && pt.z + r > b.minZ && pt.z - r < b.maxZ);
        if (dedans) out.push(`${n}(${pt.x},${pt.z})`);
      }
      return out;
    });
    verifier(coinces.length === 0, "aucun point d'apparition dans un obstacle (" + coinces.join(', ') + ')');
  },
});
scenarios.push({
  nom: 'difficulté : Cauchemar et Recrue, records par niveau',
  async executer(page, verifier, attendre) {
    const r = await page.evaluate(() => {
      const j = window.__jeu;
      localStorage.removeItem('zoneMorte.record.soldat');
      localStorage.setItem('zoneMorte.record', '7');
      j.demarrerPartie('cauchemar');
      j.partie.chrono = 1e9;
      const z = j.zombies.faireApparaitre({ x: 0, z: 0 }, 1);
      const c = { points: j.portefeuille.points, reserve: j.inventaire.armes[0].reserve, pv: z.pv };
      j.zombies.vider();
      j.demarrerPartie('recrue');
      const rec = { points: j.portefeuille.points };
      j.afficherMenu();
      const txt = document.querySelector('[data-difficulte="soldat"] .record-diff').textContent;
      return { c, rec, txt };
    });
    verifier(r.c.points === 250 && r.c.reserve === 24 && r.c.pv === 240, 'Cauchemar : 250 pts, réserve 24, zombie 240 PV (' + JSON.stringify(r.c) + ')');
    verifier(r.rec.points === 1000, 'Recrue : 1000 pts');
    verifier(r.txt.includes('7'), 'ancien record repris en Soldat (' + r.txt + ')');
    await page.evaluate(() => { localStorage.removeItem('zoneMorte.record'); window.__jeu.demarrerPartie('soldat'); });
  },
});
scenarios.push({
  nom: 'nouvelles armes : murs d\'achat et tir',
  async executer(page, verifier, attendre) {
    const r = await page.evaluate(async () => {
      const j = window.__jeu; const C = await import('/src/carte.js');
      const I = await import('/src/regles/inventaire.js');
      j.demarrerPartie('soldat'); j.partie.chrono = 1e9;
      for (const p of j.carte.portes) C.ouvrirPorte(j.carte, p);
      const achats = {};
      for (const id of ['revolver', 'semiAuto']) {
        const m = j.carte.mursArmes.find((x) => x.armeId === id);
        if (!m) { achats[id] = 'mur absent'; continue; }
        j.joueur.placer(m.position.x, m.position.z);
        j.portefeuille.points = 5000;
        j.interagir();
        achats[id] = j.inventaire.armes.some((a) => a.id === id);
      }
      const coinces = j.carte.mursArmes.filter((m) => j.carte.aabbs.some((b) => (b.maxY ?? 3) > 0.35 &&
        m.position.x + 0.35 > b.minX && m.position.x - 0.35 < b.maxX && m.position.z + 0.35 > b.minZ && m.position.z - 0.35 < b.maxZ)).map((m) => m.armeId);
      j.joueur.placer(-2, 4);
      return { achats, coinces };
    });
    verifier(r.achats.revolver === true && r.achats.semiAuto === true, 'revolver et fusil semi-auto achetés au mur (' + JSON.stringify(r.achats) + ')');
    verifier(r.coinces.length === 0, 'aucun mur d\'arme dans un obstacle (' + r.coinces.join(', ') + ')');
    for (const id of ['revolver', 'pmCompact', 'semiAuto', 'pompeAuto', 'arbalete']) {
      await page.evaluate(async (id) => {
        const I = await import('/src/regles/inventaire.js');
        I.ajouterArme(window.__jeu.inventaire, id);
      }, id);
      await attendre(450);
      for (let k = 0; k < 2; k++) { await page.evaluate(() => window.__jeu.tirer()); await attendre(120); }
    }
    const ch = await page.evaluate(() => window.__jeu.inventaire.armes.map((a) => a.id + ':' + a.chargeur));
    verifier(ch.length === 2, 'tirs avec les 5 armes sans erreur (' + ch.join(' ') + ')');
  },
});
scenarios.push({
  nom: 'brûlure : tue et compte la mort',
  async executer(page, verifier, attendre) {
    await page.evaluate(async () => {
      const j = window.__jeu; const P = await import('/src/regles/partie.js'); const C = await import('/src/regles/combat.js');
      j.demarrerPartie('soldat'); j.partie.chrono = 1e9; j.partie.phase = 'combat'; j.partie.restants = 0;
      const z = j.zombies.faireApparaitre({ x: -2, z: -4 }, 1);
      z.emergence = 0; z.vitesse = 0;
      P.enregistrerApparition(j.partie); j.partie.restants = 0;
      C.enflammer(z, 1000, 3);
      window.__brule = z;
    });
    await attendre(1000);
    const r = await page.evaluate(() => ({ mort: window.__brule.mort, vivants: window.__jeu.partie.vivants, kills: window.__jeu.partie.kills }));
    verifier(r.mort && r.vivants === 0 && r.kills === 1, 'mort par brûlure comptée (' + JSON.stringify(r) + ')');
  },
});
scenarios.push({
  nom: 'fusil électrique : l\'éclair saute entre zombies',
  async executer(page, verifier, attendre) {
    await page.evaluate(async () => {
      const j = window.__jeu; const I = await import('/src/regles/inventaire.js');
      j.demarrerPartie('soldat'); j.partie.chrono = 1e9;
      j.joueur.placer(-2, 4); j.camera.rotation.set(0, 0, 0);
      window.__cibles = [-2, -5, -8].map((z) => { const o = j.zombies.faireApparaitre({ x: -2 + (z === -2 ? 0 : 1.5), z }, 1); o.emergence = 0; o.vitesse = 0; o.pv = 5000; return o; });
      I.ajouterArme(j.inventaire, 'electrique');
    });
    await attendre(500);
    await page.evaluate(() => { window.__jeu.camera.rotation.set(-0.06, 0, 0); window.__jeu.tirer(); });
    await attendre(100);
    const n = await page.evaluate(() => window.__cibles.filter((z) => z.pv < 5000).length);
    verifier(n >= 2, 'au moins 2 zombies touchés par l\'éclair (' + n + ')');
  },
});
scenarios.push({
  nom: 'lance-flammes : enflamme les zombies devant',
  async executer(page, verifier, attendre) {
    await page.evaluate(async () => {
      const j = window.__jeu; const I = await import('/src/regles/inventaire.js');
      j.zombies.vider(); j.joueur.placer(-2, 4); j.camera.rotation.set(0, 0, 0);
      window.__f = j.zombies.faireApparaitre({ x: -2, z: 0 }, 1); window.__f.emergence = 0; window.__f.vitesse = 0; window.__f.pv = 5000;
      I.ajouterArme(j.inventaire, 'lanceFlammes');
    });
    await attendre(500);
    await page.evaluate(() => window.__jeu.tirer());
    await attendre(300);
    const r = await page.evaluate(() => ({ pv: window.__f.pv, brule: !!(window.__f.brulure && window.__f.brulure.t > 0) }));
    verifier(r.pv < 5000 && r.brule, 'zombie touché et en feu (' + JSON.stringify(r) + ')');
  },
});
scenarios.push({
  nom: 'grenade à main (G)',
  async executer(page, verifier, attendre) {
    await page.evaluate(() => {
      const j = window.__jeu;
      j.demarrerPartie('soldat'); j.partie.chrono = 1e9; j.joueur.vie.pv = 1e9;
      j.joueur.placer(-2, 4); j.camera.rotation.set(-0.35, 0, 0);
      window.__g = j.zombies.faireApparaitre({ x: -2, z: 0 }, 1); window.__g.emergence = 0; window.__g.vitesse = 0; window.__g.pv = 1000;
      j.entrees.appuis.add('KeyG');
    });
    await page.waitForFunction(() => window.__jeu.armes.derniereExplosion, null, { timeout: 20000 });
    const r = await page.evaluate(() => ({ pv: window.__g.pv, n: window.__jeu.inventaire.grenades, hud: document.getElementById('grenades').textContent }));
    verifier(r.pv < 1000, 'le zombie est blessé par la grenade (pv ' + r.pv + ')');
    verifier(r.n === 1, 'il reste 1 grenade (' + r.n + ')');
    verifier(r.hud.includes('1'), 'HUD grenades à jour (' + r.hud + ')');
  },
});
scenarios.push({
  nom: 'grenade contre un mur : ne le traverse pas',
  async executer(page, verifier, attendre) {
    await page.evaluate(() => {
      const j = window.__jeu;
      j.zombies.vider(); j.joueur.vie.pv = 1e9;
      j.joueur.placer(-16.5, 0); j.camera.rotation.set(0, Math.PI / 2, 0); // regarde vers -x (mur ouest x = -18)
      j.armes.vider();
      j.entrees.appuis.add('KeyG');
    });
    await page.waitForFunction(() => window.__jeu.armes.derniereExplosion, null, { timeout: 20000 });
    const p = await page.evaluate(() => window.__jeu.armes.derniereExplosion);
    verifier(p && p.x > -17.8 && p.y >= -0.01 && p.y < 3, 'explosion du bon côté du mur et au sol (' + JSON.stringify(p) + ')');
  },
});
scenarios.push({
  nom: 'compteur de zombies restants et trousse de soin',
  async executer(page, verifier, attendre) {
    await page.evaluate(() => {
      const j = window.__jeu; j.demarrerPartie('soldat'); j.partie.chrono = 0.01;
    });
    await page.waitForFunction(() => window.__jeu.partie.vague === 1, null, { timeout: 10000 });
    await attendre(200);
    const t1 = await page.evaluate(() => document.getElementById('vague').textContent);
    verifier(t1.includes('10 zombies restants'), 'compteur au début de la vague 1 (' + t1 + ')');
    await page.waitForFunction(() => window.__jeu.zombies.liste.some((z) => !z.mort), null, { timeout: 10000 });
    await page.evaluate(() => { const j = window.__jeu; const z = j.zombies.liste.find((o) => !o.mort); j.toucherZombie(z, 1e9, {}); });
    await attendre(200);
    const t2 = await page.evaluate(() => document.getElementById('vague').textContent);
    verifier(t2.includes('9 zombies restants'), 'compteur après un kill (' + t2 + ')');
    await page.evaluate(() => { const j = window.__jeu; j.zombies.vider(); j.joueur.vie.pv = 20; j.joueur.vie.depuisCoup = 0; j.bonus.lacher(j.joueur.position, 'soin'); });
    await attendre(400);
    const pv = await page.evaluate(() => window.__jeu.joueur.vie.pv);
    verifier(pv === 100, 'trousse de soin : vie pleine (' + pv + ')');
  },
});
