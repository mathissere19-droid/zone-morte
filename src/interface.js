// Affichage tête haute, messages, écrans de menu / pause / fin.
const $ = (id) => document.getElementById(id);

export function creerInterface() {
  let minuteurMessage = 0, minuteurAnnonce = 0, flash = 0;
  let dernierPoints = null;

  const ecrans = ['ecran-menu', 'ecran-pause', 'ecran-fin', 'ecran-erreur'];
  function montrer(id) {
    for (const e of ecrans) $(e).classList.toggle('cache', e !== id);
    $('hud').classList.toggle('cache', id !== null);
  }

  return {
    majHUD({ pv, vieMax, munitions, grenades, points, vague, restants, doubles, stamina, staminaMax, dispersion, enRechargement }) {
      $('vie-barre').style.width = (100 * pv / vieMax) + '%';
      $('stamina-barre').style.width = (100 * stamina / staminaMax) + '%';
      $('stamina').style.opacity = stamina < staminaMax ? 1 : 0.25;
      $('arme-nom').textContent = munitions.nom + (enRechargement ? ' — rechargement…' : '');
      $('chargeur').textContent = munitions.chargeur;
      $('chargeur').style.color = munitions.chargeur === 0 ? '#ff5050' : '';
      $('reserve').textContent = munitions.reserve;
      $('grenades').textContent = 'Grenades (G) : ' + grenades;
      $('points-valeur').textContent = points;
      if (dernierPoints !== null && points > dernierPoints) this.gain(points - dernierPoints);
      dernierPoints = points;
      $('vague').textContent = vague <= 0 ? ''
        : restants > 0 ? `VAGUE ${vague} · ${restants} zombie${restants > 1 ? 's' : ''} restant${restants > 1 ? 's' : ''}` : `VAGUE ${vague}`;
      $('doubles').classList.toggle('cache', !(doubles > 0));
      if (doubles > 0) $('doubles').querySelector('span').textContent = Math.ceil(doubles) + ' s';
      $('viseur').style.setProperty('--e', (6 + dispersion * 400).toFixed(1) + 'px');
      // le bord rouge reflète les PV manquants
      $('degats').style.opacity = Math.max(flash, (1 - pv / vieMax) * 0.9);
    },
    gain(n) {
      const d = document.createElement('div');
      d.textContent = '+' + n;
      $('points-gains').appendChild(d);
      setTimeout(() => d.remove(), 900);
    },
    reinitialiserPoints() { dernierPoints = null; },
    message(texte, duree = 2) {
      $('message').textContent = texte;
      $('message').classList.remove('cache');
      minuteurMessage = duree;
    },
    invite(texte) {
      $('invite').classList.toggle('cache', !texte);
      if (texte) $('invite').textContent = texte;
    },
    annonce(texte, duree = 3) {
      $('annonce').textContent = texte;
      $('annonce').classList.remove('cache');
      minuteurAnnonce = duree;
    },
    flashDegats() { flash = 0.8; },
    maj(dt) {
      if ((minuteurMessage -= dt) <= 0) $('message').classList.add('cache');
      if ((minuteurAnnonce -= dt) <= 0) $('annonce').classList.add('cache');
      flash = Math.max(0, flash - dt * 2);
    },
    // records : { idDifficulte: meilleure vague }
    ecranMenu(records, idChoisi) {
      montrer('ecran-menu');
      for (const b of document.querySelectorAll('#choix-difficulte button')) {
        const id = b.dataset.difficulte;
        b.classList.toggle('choisi', id === idChoisi);
        b.querySelector('.record-diff').textContent = records[id] > 0 ? 'Record : vague ' + records[id] : '';
      }
    },
    marquerQualite(id) {
      for (const b of document.querySelectorAll('.choix-qualite button')) b.classList.toggle('choisi', b.dataset.qualite === id);
    },
    ecranPause() { montrer('ecran-pause'); $('hud').classList.remove('cache'); },
    ecranFin(stats, record, nouveauRecord, nomDifficulte) {
      montrer('ecran-fin');
      $('difficulte-fin').textContent = 'Difficulté : ' + nomDifficulte;
      const m = Math.floor(stats.temps / 60), s = Math.floor(stats.temps % 60);
      $('stats').innerHTML =
        `Vague atteinte : <b>${stats.vague}</b><br>Zombies tués : <b>${stats.kills}</b>` +
        `<br>Tirs à la tête : <b>${stats.killsTete}</b><br>Points gagnés : <b>${stats.pointsGagnes}</b>` +
        `<br>Temps de survie : <b>${m} min ${String(s).padStart(2, '0')}</b>`;
      $('record-fin').textContent = nouveauRecord ? '★ Nouveau record ! ★' : 'Record : vague ' + record;
    },
    ecranErreur(texte) { montrer('ecran-erreur'); $('erreur-texte').textContent = texte; },
    masquerEcrans() { montrer(null); },
  };
}
