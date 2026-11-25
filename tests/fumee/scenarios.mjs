// Scénarios du test de fumée, exécutés dans l'ordre sur la page chargée en ?test=1.
export const scenarios = [
  {
    nom: 'démarrage de partie et collisions de bord',
    async executer(page, verifier, attendre) {
      await page.evaluate(() => window.__jeu.demarrerPartie());
      await attendre(300);
      verifier(await page.evaluate(() => window.__jeu.etat) === 'partie', 'état partie');
      await page.evaluate(() => { window.__jeu.joueur.position.x += 100; });
      // rendu logiciel lent : attendre quelques images plutôt qu'une durée fixe
      await page.waitForFunction(() => Math.abs(window.__jeu.joueur.position.x) <= 40, null, { timeout: 10000 }).catch(() => {});
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
    // attente conditionnelle (le temps de jeu dépend de la vitesse du rendu logiciel)
    await page.waitForFunction(() => window.__jeu.zombies.liste.length > 0, null, { timeout: 60000 }).catch(() => {});
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
    await page.waitForFunction(() => window.__jeu.etat === 'fin', null, { timeout: 10000 }).catch(() => {});
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
    // attente conditionnelle : en rendu logiciel, le temps de jeu avance moins vite que le temps réel
    const t0 = Date.now();
    await page.waitForFunction(() => window.__brule.mort, null, { timeout: 10000 }).catch(() => {});
    await attendre(100);
    console.log(`  (brûlure : ${Date.now() - t0} ms)`);
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
scenarios.push({
  nom: 'anti-blocage : un zombie coincé est replacé',
  async executer(page, verifier) {
    await page.evaluate(async () => {
      const j = window.__jeu; const C = await import('/src/carte.js'); const P = await import('/src/regles/partie.js');
      (await import('/src/config.js')).CONFIG.joueur.vieMax = 1e9;
      j.demarrerPartie('soldat'); j.joueur.vie.pv = 1e9;
      for (const p of j.carte.portes) C.ouvrirPorte(j.carte, p);
      j.partie.chrono = 1e9; j.partie.phase = 'combat'; j.partie.restants = 0;
      window.__coince = j.zombies.faireApparaitre({ x: 18, z: 16 }, 1); // dans la caisse en bois du bunker
      P.enregistrerApparition(j.partie); j.partie.restants = 0;
      j.accelerer(4);
    });
    await page.waitForFunction(() => Math.hypot(window.__coince.position.x - 18, window.__coince.position.z - 16) > 1, null, { timeout: 60000 });
    const r = await page.evaluate(async () => {
      const j = window.__jeu; const z = window.__coince; j.accelerer(1);
      (await import('/src/config.js')).CONFIG.joueur.vieMax = 100; j.joueur.vie.pv = 100;
      const dedans = j.carte.aabbsZombies.some((b) => (b.maxY ?? 3) > 0.35 && z.position.x + 0.35 > b.minX && z.position.x - 0.35 < b.maxX && z.position.z + 0.35 > b.minZ && z.position.z - 0.35 < b.maxZ);
      return { vivants: j.partie.vivants, dedans, pos: [z.position.x.toFixed(1), z.position.z.toFixed(1)] };
    });
    verifier(r.vivants === 1 && !r.dedans, 'zombie replacé hors obstacle, compteur inchangé (' + JSON.stringify(r) + ')');
  },
});
scenarios.push({
  nom: 'vague 5 en Cauchemar, toutes zones ouvertes : la vague 6 arrive',
  async executer(page, verifier, attendre) {
    await page.evaluate(async () => {
      const j = window.__jeu; const C = await import('/src/carte.js');
      (await import('/src/config.js')).CONFIG.joueur.vieMax = 1e9;
      j.demarrerPartie('cauchemar'); j.joueur.vie.pv = 1e9;
      for (const p of j.carte.portes) C.ouvrirPorte(j.carte, p);
      j.partie.vague = 4; j.partie.chrono = 0; j.accelerer(3);
    });
    let v = 5;
    for (let t = 0; t < 300 && v < 6; t++) {
      await attendre(1000);
      v = await page.evaluate(() => {
        const j = window.__jeu, jp = j.joueur.position; j.joueur.vie.pv = 1e9;
        for (const z of [...j.zombies.liste]) if (!z.mort && Math.hypot(z.position.x - jp.x, z.position.z - jp.z) < 2) j.toucherZombie(z, 1e9, {});
        return j.partie.vague;
      });
    }
    await page.evaluate(async () => { (await import('/src/config.js')).CONFIG.joueur.vieMax = 100; window.__jeu.accelerer(1); });
    verifier(v >= 6, 'la vague 6 démarre (vague ' + v + ')');
  },
});
scenarios.push({
  nom: 'ciel HDRI chargé',
  async executer(page, verifier) {
    await page.waitForFunction(() => window.__jeu.scene.environment !== null, null, { timeout: 15000 }).catch(() => {});
    verifier(await page.evaluate(() => window.__jeu.scene.environment !== null), 'environnement HDRI présent');
  },
});
scenarios.push({
  nom: 'qualité : bascule Basse → Haute → Moyenne en pleine partie',
  async executer(page, verifier, attendre) {
    const attendue = process.env.FUMEE_QUALITE ?? 'basse';
    verifier(await page.evaluate(() => window.__jeu.qualite) === attendue, `qualité de départ en mode test : ${attendue}`);
    await page.evaluate(() => { window.__jeu.demarrerPartie('recrue'); window.__jeu.joueur.vie.pv = 1e9; });
    for (const q of ['haute', 'moyenne', 'basse']) {
      await page.evaluate((id) => window.__jeu.changerQualite(id), q);
      await attendre(1000);
      const r = await page.evaluate(() => ({ q: window.__jeu.qualite, o: window.__jeu.renderer.shadowMap.enabled }));
      verifier(r.q === q && r.o === (q !== 'basse'), `qualité ${q} active (ombres ${r.o})`);
    }
    verifier(await page.evaluate(() => document.querySelector('#choix-qualite-pause button.choisi')?.dataset.qualite) === 'basse', 'bouton de qualité marqué');
  },
});
scenarios.push({
  nom: 'lampe torche (F)',
  async executer(page, verifier) {
    await page.evaluate(() => { window.__jeu.demarrerPartie('recrue'); window.__jeu.joueur.vie.pv = 1e9; });
    const basculer = async (attendu) => {
      await page.evaluate(() => window.__jeu.entrees.appuis.add('KeyF'));
      await page.waitForFunction((a) => window.__jeu.lampe.allumee === a, attendu, { timeout: 10000 }).catch(() => {});
      return page.evaluate(() => window.__jeu.lampe.allumee);
    };
    verifier(await page.evaluate(() => window.__jeu.lampe.allumee) === false, 'lampe éteinte au départ');
    verifier(await basculer(true) === true, 'F allume la lampe');
    verifier(await page.evaluate(() => window.__jeu.lampe.lumiere.intensity > 0), 'la lampe éclaire');
    verifier(await basculer(false) === false, 'F éteint la lampe');
  },
});
scenarios.push({
  nom: 'projecteurs et gyrophare selon la qualité',
  async executer(page, verifier, attendre) {
    const etat = () => page.evaluate(() => {
      const c = window.__jeu.carte;
      return { visibles: c.projecteurs.filter((p) => p.lumiere.visible).length, ombres: c.projecteurs.some((p) => p.lumiere.castShadow),
        gyro: c.gyrophare.lumiere.rotation?.y ?? 0, lune: window.__jeu.lune.castShadow };
    });
    let e = await etat();
    verifier(e.visibles === 2 && !e.ombres && !e.lune, `Basse : 2 projecteurs sans ombre (${JSON.stringify(e)})`);
    await page.evaluate(() => window.__jeu.changerQualite('haute'));
    await attendre(500);
    e = await etat();
    verifier(e.visibles === 4 && e.ombres && e.lune, `Haute : 4 projecteurs, ombres, lune (${JSON.stringify(e)})`);
    const cible1 = await page.evaluate(() => window.__jeu.carte.gyrophare.lumiere.target.position.x);
    // en rendu logiciel (SwiftShader), une image en qualité Haute peut prendre plus d'une seconde :
    // on attend que le gyrophare ait bougé plutôt qu'une durée fixe
    const t0 = Date.now();
    const tourne = await page.waitForFunction((c1) => window.__jeu.carte.gyrophare.lumiere.target.position.x !== c1,
      cible1, { timeout: 10000 }).then(() => true, () => false);
    verifier(tourne, `le gyrophare tourne (${Date.now() - t0} ms)`);
    await page.evaluate(() => window.__jeu.changerQualite('basse'));
  },
});
scenarios.push({
  nom: 'trous de balle bornés',
  async executer(page, verifier, attendre) {
    const tirs = (n) => page.evaluate((n) => {
      const j = window.__jeu;
      for (let i = 0; i < n; i++) { for (const a of j.inventaire.armes) a.chargeur = 999; j.camera.rotation.set(0, Math.PI / 2, 0); j.armes.etat.dispersionActuelle = 0; j.tirer(); } // recul annulé : on reste face au mur
    }, n);
    await page.evaluate(() => {
      const j = window.__jeu;
      j.demarrerPartie('soldat'); j.partie.chrono = 1e9; j.joueur.vie.pv = 1e9; j.zombies.vider();
      j.joueur.placer(-16, 0); j.camera.rotation.set(0, Math.PI / 2, 0); // face au mur ouest
    });
    await tirs(100);
    verifier(await page.evaluate(() => window.__jeu.effets.particules.length > 0), 'étincelles et poussière à l\'impact');
    await page.waitForFunction(() => window.__jeu.effets.particules.length === 0, null, { timeout: 20000 });
    const n1 = await page.evaluate(() => window.__jeu.scene.children.length);
    await tirs(200);
    await page.waitForFunction(() => window.__jeu.effets.particules.length === 0, null, { timeout: 20000 });
    const r = await page.evaluate(() => ({ trous: window.__jeu.effets.trous.length, n: window.__jeu.scene.children.length }));
    verifier(r.trous === 64, `64 trous de balle au maximum (${r.trous})`);
    verifier(Math.abs(r.n - n1) <= 20, `scène stable (${n1} → ${r.n} objets)`);
  },
});
scenarios.push({
  nom: 'explosion avec fumée',
  async executer(page, verifier, attendre) {
    await page.evaluate(() => {
      const j = window.__jeu;
      j.armes.vider(); j.effets.vider(); j.joueur.vie.pv = 1e9;
      j.joueur.placer(-2, 4); j.camera.rotation.set(-0.35, 0, 0);
      j.inventaire.grenades = 2;
      j.entrees.appuis.add('KeyG');
    });
    await page.waitForFunction(() => window.__jeu.armes.derniereExplosion, null, { timeout: 20000 });
    verifier(await page.evaluate(() => window.__jeu.effets.fumees.length > 0), 'la fumée apparaît');
    const disparue = await page.waitForFunction(() => window.__jeu.effets.fumees.length === 0, null, { timeout: 30000 }).then(() => true, () => false);
    verifier(disparue, 'la fumée se dissipe');
  },
});

// ---------- Lot 2 : accroupi, escalade, échelles ----------
// attend n images du jeu (le temps réel ne dit rien en rendu logiciel)
const images = (page, n) => page.evaluate((n) => new Promise((ok) => {
  let k = 0; const f = () => (++k >= n ? ok() : requestAnimationFrame(f)); requestAnimationFrame(f);
}), n);
const nouvellePartie = (page, x, z, lacet) => page.evaluate(([x, z, lacet]) => {
  const j = window.__jeu;
  j.demarrerPartie('soldat'); j.partie.chrono = 1e9; j.joueur.vie.pv = 1e9; j.zombies.vider();
  j.entrees.touches.clear();
  j.joueur.placer(x, z); j.camera.rotation.set(0, lacet, 0, 'YXZ');
}, [x, z, lacet]);
const touche = (page, code, tenue = true) => page.evaluate(([c, t]) => {
  const e = window.__jeu.entrees; e.appuis.add(c); if (t) e.touches.add(c); else e.touches.delete(c);
}, [code, tenue]);
const relacher = (page, code) => page.evaluate((c) => window.__jeu.entrees.touches.delete(c), code);
const OUEST = Math.PI / 2, EST = -Math.PI / 2;

scenarios.push({
  nom: 'accroupi (C)',
  async executer(page, verifier) {
    await nouvellePartie(page, -5, 5, 0);
    await touche(page, 'KeyC', false);
    await page.waitForFunction(() => window.__jeu.joueur.accroupi === true, null, { timeout: 10000 }).catch(() => {});
    const ok = await page.waitForFunction(() => window.__jeu.camera.position.y - window.__jeu.joueur.position.y < 1.05,
      null, { timeout: 20000 }).then(() => true, () => false);
    verifier(ok, 'accroupi : yeux à 1 m');
    await touche(page, 'KeyC', false);
    await page.waitForFunction(() => !window.__jeu.joueur.accroupi, null, { timeout: 10000 }).catch(() => {});
  },
});
scenarios.push({
  nom: 'conduit du bunker : accroupi seulement',
  async executer(page, verifier) {
    await nouvellePartie(page, 20.3, -9.1, EST);
    await page.evaluate(async () => { const C = await import('/src/carte.js'); for (const p of window.__jeu.carte.portes) C.ouvrirPorte(window.__jeu.carte, p); });
    await page.evaluate(() => window.__jeu.joueur.placer(20.3, -9.1));
    await page.evaluate(() => window.__jeu.camera.rotation.set(0, -Math.PI / 2, 0, 'YXZ'));
    await touche(page, 'KeyW');
    await page.waitForFunction(() => window.__jeu.joueur.position.x > 20.6, null, { timeout: 20000 }).catch(() => {});
    await images(page, 10);
    const debout = await page.evaluate(() => window.__jeu.joueur.position.x);
    verifier(debout < 21, `debout : bloqué devant le conduit (x=${debout.toFixed(2)})`);
    await touche(page, 'KeyC');
    await relacher(page, 'KeyC');
    const passe = await page.waitForFunction(() => window.__jeu.joueur.position.x > 23.3, null, { timeout: 30000 }).then(() => true, () => false);
    await relacher(page, 'KeyW');
    verifier(passe, 'accroupi : passe par le conduit');
    await page.evaluate(() => window.__jeu.joueur.placer(22, -9.1));
    await touche(page, 'KeyC', false); // placer remet debout... on se baisse dans le conduit
    await images(page, 3);
    await page.evaluate(() => { const j = window.__jeu.joueur; j.accroupi = true; });
    await touche(page, 'KeyC', false);
    await images(page, 5);
    verifier(await page.evaluate(() => window.__jeu.joueur.accroupi) === true, 'impossible de se relever dans le conduit');
  },
});
scenarios.push({
  nom: 'grimper sur un conteneur (saut + Espace tenu)',
  async executer(page, verifier) {
    await nouvellePartie(page, -12, 9, OUEST);
    await touche(page, 'Space');
    const monte = await page.waitForFunction(() => window.__jeu.joueur.position.y > 2.5, null, { timeout: 20000 }).then(() => true, () => false);
    await relacher(page, 'Space');
    await page.waitForFunction(() => !window.__jeu.joueur.occupe, null, { timeout: 10000 }).catch(() => {});
    const r = await page.evaluate(() => ({ y: window.__jeu.joueur.position.y, h: window.__jeu.joueur.surface?.h }));
    verifier(monte && r.h === 2.6, `sur le conteneur (${JSON.stringify(r)})`);
  },
});
scenarios.push({
  nom: 'échelle du toit du bunker',
  async executer(page, verifier) {
    await nouvellePartie(page, 12.6, 12.5, EST);
    await touche(page, 'KeyW');
    const ok = await page.waitForFunction(() => window.__jeu.joueur.position.y > 2.8 && window.__jeu.joueur.position.x > 14,
      null, { timeout: 30000 }).then(() => true, () => false);
    await relacher(page, 'KeyW');
    const p = await page.evaluate(() => window.__jeu.joueur.position);
    verifier(ok, `sur le toit du bunker (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`);
  },
});
scenarios.push({
  nom: 'grenade lâchée sur un conteneur',
  async executer(page, verifier) {
    await nouvellePartie(page, -13.8, 9, 0);
    await page.evaluate(() => {
      const j = window.__jeu; j.joueur.position.y = 2.6; j.joueur.majCamera(); j.armes.vider();
      j.camera.rotation.set(-1.45, 0, 0, 'YXZ');
    });
    await touche(page, 'KeyG', false);
    await page.waitForFunction(() => window.__jeu.armes.derniereExplosion, null, { timeout: 20000 });
    const e = await page.evaluate(() => window.__jeu.armes.derniereExplosion);
    verifier(e.y > 2.5 && e.y < 3, `explosion posée sur le toit du conteneur (y=${e.y.toFixed(2)})`);
  },
});

// --- Tâche 5 : perception et escalade des zombies ---
// joueur immobile en hauteur, invulnérable ; un zombie part de (-9, 2)
const joueurEnHauteur = (page, x, z, y) => page.evaluate(([x, z, y]) => {
  const j = window.__jeu;
  j.joueur.position.y = y; j.joueur.sommetSaut = y; j.joueur.majCamera(); j.joueur.vie.pv = 1e9;
  const zb = j.zombies.faireApparaitre({ x: -9, z: 2 }, 1); zb.emergence = 0; zb.pv = 1e9;
  window.__z = zb;
  j.accelerer(3);
}, [x, z, y]);
async function zombieRejoint(page, verifier, yMin, quoi) {
  // rendu logiciel lent : le zombie peut perdre le joueur (ombre) et attendre le flair avant de traverser la carte
  const monte = await page.waitForFunction((y) => window.__z.position.y > y, yMin, { timeout: 180000 }).then(() => true, () => false);
  const proche = monte && await page.waitForFunction(() => {
    const p = window.__jeu.joueur.position, z = window.__z.position;
    return Math.hypot(p.x - z.x, p.z - z.z) < 2;
  }, null, { timeout: 30000 }).then(() => true, () => false);
  const r = await page.evaluate(() => {
    window.__jeu.accelerer(1);
    const z = window.__z;
    return { x: z.position.x.toFixed(2), y: z.position.y.toFixed(2), z: z.position.z.toFixed(2), etat: z.perception?.etat, surface: z.surface?.id ?? null };
  });
  verifier(monte && proche, `${quoi} (${JSON.stringify(r)})`);
}
scenarios.push({
  nom: 'un zombie rejoint le joueur sur un conteneur',
  async executer(page, verifier) {
    await nouvellePartie(page, -13.8, 9, 0);
    await joueurEnHauteur(page, -13.8, 9, 2.6);
    await zombieRejoint(page, verifier, 2.5, 'le zombie grimpe sur le conteneur et rejoint le joueur');
  },
});
scenarios.push({
  nom: 'échelle : un zombie rejoint le joueur sur le toit du bunker',
  async executer(page, verifier) {
    await nouvellePartie(page, 20, 12, 0);
    await joueurEnHauteur(page, 20, 12, 2.9);
    await zombieRejoint(page, verifier, 2.8, 'le zombie monte sur le toit du bunker et rejoint le joueur');
  },
});
scenarios.push({
  nom: 'caché puis retrouvé par flair (Soldat)',
  async executer(page, verifier) {
    await nouvellePartie(page, -16, -10, 0);
    await page.evaluate(() => {
      const j = window.__jeu;
      j.joueur.vie.pv = 1e9; j.joueur.accroupi = true;
      if (j.lampe.allumee) j.entrees.appuis.add('KeyF');
      const z = j.zombies.faireApparaitre({ x: 10, z: 15 }, 1); z.emergence = 0; z.pv = 1e9;
      z.modele.g.rotation.y = Math.PI / 4; // dos tourné au joueur
      z.perception = { etat: 'recherche', derniere: { x: 10, z: 15 }, sansContact: 0, cible: null };
      window.__z = z; window.__flairs = j.zombies.nbFlairs;
      j.accelerer(5);
    });
    await page.waitForFunction(() => window.__jeu.joueur.dansOmbre !== undefined, null, { timeout: 10000 });
    verifier(await page.evaluate(() => window.__jeu.joueur.dansOmbre && window.__jeu.joueur.accroupi), 'joueur accroupi dans l\'ombre');
    await page.waitForFunction(() => window.__z.perception.sansContact > 5, null, { timeout: 60000 });
    const p = await page.evaluate(() => ({ etat: window.__z.perception.etat, d: Math.hypot(window.__z.position.x - 10, window.__z.position.z - 15) }));
    verifier(p.etat === 'recherche' && p.d < 8, `il fouille autour de la dernière position connue (${JSON.stringify(p)})`);
    const ok = await page.waitForFunction(() => window.__z.perception.etat === 'traque', null, { timeout: 60000 }).then(() => true, () => false);
    const r = await page.evaluate(() => { window.__jeu.accelerer(1); return { flairs: window.__jeu.zombies.nbFlairs - window.__flairs, derniere: window.__z.perception.derniere }; });
    verifier(ok && r.flairs >= 1 && Math.hypot(r.derniere.x + 16, r.derniere.z + 10) < 1, `retrouvé par flair (${JSON.stringify(r)})`);
  },
});
scenarios.push({
  nom: 'modèles GLB chargés',
  async executer(page, verifier) {
    await page.evaluate(() => { const j = window.__jeu; j.demarrerPartie(); j.joueur.vie.pv = 1e9; j.zombies.vider(); });
    verifier(await page.evaluate(() => window.__jeu.zombies.modelesCharges === true), 'les GLB des zombies sont chargés');
    const r = await page.evaluate(() => {
      const z = window.__jeu.zombies.faireApparaitre({ x: -2, z: -4 }, 1);
      let peau = false;
      z.modele.g.traverse((o) => { if (o.isSkinnedMesh) peau = true; });
      return { peau, zones: [...new Set(z.modele.touchables.map((t) => t.userData.zone))].sort().join(','), lies: z.modele.touchables.every((t) => t.userData.zombie === z) };
    });
    verifier(r.peau, 'le zombie apparu est un maillage animé (SkinnedMesh)');
    verifier(r.zones === 'corps,jambes,tete', 'zones tête, corps, jambes (' + r.zones + ')');
    verifier(r.lies, 'chaque zone est liée au zombie');
  },
});
scenarios.push({
  nom: "tir à la tête d'un zombie animé",
  async executer(page, verifier, attendre) {
    await page.evaluate(() => {
      const j = window.__jeu;
      j.demarrerPartie(); j.joueur.vie.pv = 1e9; j.zombies.vider();
      j.joueur.placer(-2, 4);
      window.__cible = j.zombies.faireApparaitre({ x: -2, z: -2 }, 1);
      Object.assign(window.__cible, { emergence: 0, vitesse: 0, pv: 5000 });
    });
    await page.waitForFunction(() => window.__jeu.partie.temps > 0.5, null, { timeout: 20000 });
    const viser = (zone) => page.evaluate((zone) => {
      const j = window.__jeu, z = window.__cible;
      z.modele.g.updateMatrixWorld(true);
      const boite = z.modele.touchables.find((t) => t.userData.zone === zone);
      const p = boite.getWorldPosition(new (j.camera.position.constructor)());
      const avant = z.pv;
      j.camera.lookAt(p);
      j.tirer();
      return avant - z.pv;
    }, zone);
    const tete = await viser('tete');
    await attendre(600);
    const corps = await viser('corps');
    verifier(tete > 0 && corps > 0, 'les deux tirs touchent (tête ' + tete + ', corps ' + corps + ')');
    verifier(tete > corps, 'la tête fait plus de dégâts que le corps');
  },
});
scenarios.push({
  nom: 'repli sans modèles (?sansModeles=1)',
  async executer(page, verifier) {
    const p2 = await page.context().browser().newPage();
    const erreurs = [];
    p2.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
    p2.on('pageerror', (e) => erreurs.push(String(e)));
    await p2.goto(page.url().split('?')[0] + '?test=1&sansModeles=1', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await p2.waitForFunction(() => window.__jeu && window.__jeu.pret === true, null, { timeout: 90000 });
    const r = await p2.evaluate(() => {
      const j = window.__jeu; j.demarrerPartie(); j.joueur.vie.pv = 1e9;
      const z = j.zombies.faireApparaitre({ x: -2, z: -4 }, 1);
      let peau = false;
      z.modele.g.traverse((o) => { if (o.isSkinnedMesh) peau = true; });
      return { peau, charges: j.zombies.modelesCharges, n: z.modele.touchables.length };
    });
    await p2.waitForFunction(() => window.__jeu.partie.temps > 1, null, { timeout: 20000 });
    await p2.close();
    verifier(!r.peau && !r.charges && r.n > 0, 'zombies en boîtes sans GLB');
    verifier(erreurs.length === 0, 'aucune erreur console en repli (' + erreurs.join(' | ') + ')');
  },
});
scenarios.push({
  nom: "le coup part à l'impact",
  async executer(page, verifier) {
    await page.evaluate(() => {
      const j = window.__jeu;
      j.demarrerPartie(); j.zombies.vider(); j.accelerer(1);
      j.joueur.placer(-2, 4); j.joueur.vie.pv = 1000;
      const z = j.zombies.faireApparaitre({ x: -2, z: 0 }, 1); // loin d'abord, rapproché après quelques images
      Object.assign(z, { emergence: 0, vitesse: 0, pv: 1e9 });
      window.__zc = z;
      window.__journal = [];
      const boucle = () => {
        if (!window.__journal) return;
        window.__journal.push({ t: j.partie.temps, anim: z.modele.animation, tAnim: z.modele.tempsAnimation(), pv: j.joueur.vie.pv });
        if (window.__journal.length === 5) { z.position.z = 3.2; z.position.x = -2; }
        requestAnimationFrame(boucle);
      };
      requestAnimationFrame(boucle);
    });
    await page.waitForFunction(() => {
      const l = window.__journal; const i = l.findIndex((e) => e.anim === 'attaque');
      return i >= 0 && l[l.length - 1].t - l[i].t > window.__zc.modele.dureeAnimation('attaque') * 1.05;
    }, null, { timeout: 60000 });
    const r = await page.evaluate(() => {
      const l = window.__journal; window.__journal = null;
      const i = l.findIndex((e) => e.anim === 'attaque');
      const duree = window.__zc.modele.dureeAnimation('attaque');
      const cycle = l.filter((e) => e.t >= l[i].t && e.t < l[i].t + duree);
      let coups = 0;
      for (let k = 1; k < cycle.length; k++) if (cycle[k].pv < cycle[k - 1].pv) coups++;
      if (cycle[0].pv < l[Math.max(0, i - 1)].pv) coups++;
      return { pvDebut: cycle[0].pv, pvAvant: l[Math.max(0, i - 1)].pv, pvFin: cycle[cycle.length - 1].pv, coups };
    });
    verifier(r.pvDebut === r.pvAvant, 'pas de dégâts au début de l\'attaque (' + r.pvAvant + ' → ' + r.pvDebut + ')');
    verifier(r.coups === 1 && r.pvFin < r.pvDebut, 'un seul coup par attaque (' + r.coups + ')');
  },
});
scenarios.push({
  nom: 'mort animée : le corps reste puis disparaît',
  async executer(page, verifier) {
    await page.evaluate(() => {
      const j = window.__jeu;
      j.demarrerPartie(); j.zombies.vider(); j.joueur.vie.pv = 1e9;
      const z = j.zombies.faireApparaitre({ x: -2, z: -6 }, 1);
      z.emergence = 0;
      j.toucherZombie(z, 1e9, {});
      window.__zm = z; window.__tMort = j.partie.temps;
      j.accelerer(3);
    });
    await page.waitForFunction(() => window.__jeu.partie.temps - window.__tMort > 2.6, null, { timeout: 30000 });
    verifier(await page.evaluate(() => !!window.__zm.modele.g.parent && window.__jeu.zombies.liste.includes(window.__zm)), 'le corps est encore là après 2,6 s');
    await page.waitForFunction(() => !window.__jeu.zombies.liste.includes(window.__zm), null, { timeout: 30000 }).catch(() => {});
    const r = await page.evaluate(() => ({ dt: window.__jeu.partie.temps - window.__tMort, parti: !window.__zm.modele.g.parent }));
    verifier(r.parti && r.dt >= 4.9, 'corps retiré après s\'être enfoncé (' + r.dt.toFixed(1) + ' s)');
    await page.evaluate(() => window.__jeu.accelerer(1));
  },
});
scenarios.push({
  nom: 'tirer pendant la sortie du sol et pendant la mort',
  async executer(page, verifier) {
    const tirSur = () => page.evaluate(() => {
      const j = window.__jeu, z = window.__zs;
      z.modele.g.updateMatrixWorld(true);
      const b = z.modele.touchables.find((t) => t.userData.zone === 'corps') ?? z.modele.touchables[0];
      j.camera.lookAt(b.getWorldPosition(new (j.camera.position.constructor)()));
      const avant = z.pv; j.tirer(); return avant - z.pv;
    });
    await page.evaluate(() => {
      const j = window.__jeu;
      j.demarrerPartie(); j.zombies.vider(); j.joueur.vie.pv = 1e9; j.joueur.placer(-2, 4);
      window.__zs = j.zombies.faireApparaitre({ x: -2, z: -1 }, 1);
      window.__zs.pv = 5000;
    });
    await page.waitForFunction(() => window.__zs.emergence > 0 && window.__zs.emergence < window.__zs.modele.dureeEmergence - 0.1, null, { timeout: 20000 });
    await tirSur();
    verifier(await page.evaluate(() => window.__zs.emergence > 0), 'tir pendant la sortie du sol sans erreur');
    await page.evaluate(() => { window.__zs.emergence = 0; window.__jeu.toucherZombie(window.__zs, 1e9, {}); });
    await page.waitForFunction(() => window.__zs.tempsMort > 0.3, null, { timeout: 20000 });
    await tirSur();
    verifier(true, 'tir pendant la mort sans erreur');
  },
});
scenarios.push({
  nom: 'ombres des zombies en Haute seulement',
  async executer(page, verifier) {
    const r = await page.evaluate(() => {
      const j = window.__jeu;
      j.demarrerPartie(); j.zombies.vider();
      const z = j.zombies.faireApparaitre({ x: -2, z: -6 }, 1);
      const ombre = () => { let o = false; z.modele.g.traverse((m) => { if ((m.isSkinnedMesh || (m.isMesh && m.material.visible !== false && m !== z.modele.feu)) && m.castShadow) o = true; }); return o; };
      j.changerQualite('haute'); const h = ombre();
      j.changerQualite('moyenne'); const m = ombre();
      const z2 = j.zombies.faireApparaitre({ x: -2, z: -8 }, 1);
      let n2 = false; z2.modele.g.traverse((o) => { if (o.castShadow) n2 = true; });
      j.changerQualite('basse');
      return { h, m, n2, b: ombre() };
    });
    verifier(r.h && !r.m && !r.b && !r.n2, 'ombres portées en Haute seulement (haute ' + r.h + ', moyenne ' + r.m + ', basse ' + r.b + ', nouveau en moyenne ' + r.n2 + ')');
  },
});
