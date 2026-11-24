# Zone Morte — Lot 1 (gameplay) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter 4 difficultés, 7 armes, des grenades à main, le compteur de zombies restants, le bonus Trousse de soin et un filet anti-blocage de zombie.

**Architecture:** Chaque règle chiffrée va dans `src/config.js` + un module pur de `src/regles/` testé par `node --test` ; les modules three.js (`armes.js`, `zombies.js`, `main.js`, `interface.js`, `carte.js`) se contentent d'appeler ces règles. La difficulté active est un état de module dans `regles/difficulte.js` (lu par les autres règles), choisi au démarrage de la partie.

**Tech Stack:** JavaScript modules ES, three.js 0.170 (local, `vendor/`), node:test, Playwright (Edge headless) pour `npm run fumee`.

**Spec:** `docs/superpowers/specs/2026-11-24-zone-morte-jalon2-design.md` (sections 2 et 6 « zombie bloqué »).

## Global Constraints

- Aucune étape de compilation, aucune nouvelle dépendance.
- Tous les textes visibles en français.
- Toute valeur d'équilibrage dans `src/config.js`, nulle part ailleurs.
- Contenu original : aucun nom/arme/visuel repris d'un jeu existant.
- Après chaque tâche : `npm test` et `npm run fumee` passent.
- Commits en français, terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- Kill par brûlure ou par chaîne électrique : la mort doit passer par `toucherZombie` (sinon `vivants` se décale et la vague bloque — même famille que le bug de la vague 5). Test : tâche 4, fumée « brûlure tue et compte ».
- « Rejouer » après une partie en Cauchemar : la difficulté, le portefeuille, les grenades et la régénération doivent repartir des valeurs du niveau choisi. Test : tâche 2, fumée.
- Ancien record (`zoneMorte.record`) d'avant le jalon 2 : il doit apparaître comme record Soldat, pas disparaître. Test : tâche 2.
- Grenade lancée contre un mur proche / sous ses pieds : elle doit exploser après 2 s sans traverser le décor ni rester en l'air. Test : tâche 5, fumée.
- Zombie replacé par l'anti-blocage : il ne doit pas réapparaître dans le champ de vision ni dans un obstacle, et ne compte pas comme une nouvelle apparition. Test : tâche 7.

---

### Task 1: Règles de difficulté

**Files:**
- Modify: `src/config.js`, `src/regles/vagues.js`, `src/regles/vie.js`, `src/regles/inventaire.js`, `src/regles/economie.js`
- Create: `src/regles/difficulte.js`, `tests/difficulte.test.js`

**Interfaces:**
- Produces:
  - `CONFIG.difficultes = { recrue, soldat, veteran, cauchemar }`, chacun `{ nom, pvZombies, degatsRecus, pointsDepart, munitions, premiereVagueCoureurs, delaiRegen /* null = aucune */ }` avec les valeurs du tableau 2.1 du spec (Recrue : 0.7, 0.6, 1000, 1.5, 8, 3 ; Soldat : 1, 1, 500, 1, 5, 4 ; Vétéran : 1.3, 1.4, 500, 1, 3, 6 ; Cauchemar : 1.6, 1.8, 250, 0.75, 1, null). Noms affichés : « Recrue », « Soldat », « Vétéran », « Cauchemar ».
  - `difficulte.js` : `IDS_DIFFICULTE = ['recrue','soldat','veteran','cauchemar']`, `choisirDifficulte(id)` (id inconnu → `'soldat'`), `difficulteActive(): {id, ...valeurs}` (défaut soldat), `pvZombieActif(v): number` (`Math.round(pvZombie(v) * pvZombies)`), `degatsRecus(d): number` (`Math.round(d * degatsRecus)`), `reserveMax(armeId): number` (`Math.round(CONFIG.armes[id].reserve * munitions)`).
  - `partCoureurs(v, premiere = 5)` : 0 si `v < premiere`, sinon `min(0.1·(v − premiere + 1), 0.8)` (arrondi actuel conservé) ; `typeDeplacement(v, rng, premiere = 5)`.
  - `majVie(vie, dt, delaiRegen = CONFIG.joueur.delaiRegen)` : `delaiRegen === null` → aucune régénération.
  - `inventaire.js` : réserve initiale, `remplir`, `munitionsPleines` utilisent `reserveMax(id)`.
  - `creerPortefeuille(points = difficulteActive().pointsDepart)`.

- [ ] **Step 1: Write failing tests** in `tests/difficulte.test.js` (appeler `choisirDifficulte('soldat')` dans un `afterEach`) :
  - `choisirDifficulte('cauchemar')` → `difficulteActive().id === 'cauchemar'` ; `choisirDifficulte('xxx')` → `'soldat'`.
  - `pvZombieActif(1)` vaut 150 en soldat, 105 en recrue, 240 en cauchemar.
  - `degatsRecus(40)` : 40 soldat, 24 recrue, 72 cauchemar.
  - `partCoureurs(1, 1) === 0.1`, `partCoureurs(7, 8) === 0`, `partCoureurs(8, 8) === 0.1`, `partCoureurs(5) === 0.1` (défaut inchangé).
  - `majVie` : vie à 10, `depuisCoup` = 100, `majVie(vie, 1, null)` → pv reste 10 ; `majVie(vie, 0.5, 3)` avec `depuisCoup = 3` → pv > 10.
  - En recrue, `creerInventaire().armes[0].reserve === 48` et `creerPortefeuille().points === 1000` ; en cauchemar `reserveMax('mitraillette') === 113`.
- [ ] **Step 2:** `npm test` → les nouveaux tests échouent (module absent).
- [ ] **Step 3:** Implémenter les interfaces ci-dessus. `difficulte.js` importe `pvZombie` de `vagues.js` ; `inventaire.js` importe `reserveMax` de `difficulte.js` (pas d'import circulaire : `difficulte.js` n'importe pas `inventaire.js`).
- [ ] **Step 4:** `npm test` → tout passe (24 anciens + nouveaux).
- [ ] **Step 5:** Commit « Règles de difficulté ».

### Task 2: Difficulté dans le jeu (menu, records, application)

**Files:**
- Modify: `index.html`, `style.css`, `src/interface.js`, `src/main.js`, `src/zombies.js`, `tests/fumee/scenarios.mjs`

**Interfaces:**
- Consumes: Task 1 (`choisirDifficulte`, `difficulteActive`, `pvZombieActif`, `degatsRecus`, `IDS_DIFFICULTE`).
- Produces:
  - `index.html` : dans `#ecran-menu`, un bloc `#choix-difficulte` de 4 `<button data-difficulte="recrue|soldat|veteran|cauchemar">` (classe `choisi` sur l'actif), chacun montrant le nom et son record (`<small class="record-diff">`). Bouton `#btn-jouer` inchangé.
  - `jeu.demarrerPartie(idDifficulte?)` : si fourni, l'utilise ; sinon la difficulté sélectionnée au menu. Mémorisée dans `localStorage['zoneMorte.difficulte']` (try/catch comme le record).
  - Records : clé `zoneMorte.record.<id>` ; `lireRecord(id)` lit d'abord cette clé, et pour `soldat` se rabat sur l'ancienne clé `zoneMorte.record`.
  - `ui.ecranMenu(records: {id: vague}, idChoisi)` ; `ui.ecranFin(stats, record, nouveau, nomDifficulte)` affiche « Difficulté : Vétéran ».
  - `zombies.faireApparaitre` utilise `pvZombieActif(vague)` et `typeDeplacement(vague, rng, difficulteActive().premiereVagueCoureurs)`.
  - `blesserJoueur(d)` applique `degatsRecus(d)` — **sauf** les dégâts que le joueur s'inflige (explosion) : `blesserJoueur(d, { brut: true })`.
  - `majVie(joueur.vie, dt, difficulteActive().delaiRegen)` dans la boucle.
- [ ] **Step 1: Write failing smoke scenario** « difficulté Cauchemar » : `localStorage.setItem('zoneMorte.record', '7')` puis recharger n'est pas nécessaire — appeler `__jeu.demarrerPartie('cauchemar')` ; vérifier `portefeuille.points === 250`, `inventaire.armes[0].reserve === 24`, faire apparaître un zombie vague 1 → `pv === 240` ; `demarrerPartie('recrue')` → `points === 1000` ; vérifier que le texte de `[data-difficulte="soldat"] .record-diff` contient « 7 » après `__jeu.afficherMenu()` (exposer `afficherMenu` dans `jeu`). Remettre `demarrerPartie('soldat')` en fin de scénario.
- [ ] **Step 2:** `npm run fumee` → échec sur ce scénario.
- [ ] **Step 3:** Implémenter (menu, mémorisation, records, application dans `zombies.js` et `main.js`). Style : boutons côte à côte, le choisi surligné ; Cauchemar en rouge.
- [ ] **Step 4:** `npm test` et `npm run fumee` passent.
- [ ] **Step 5:** Commit « Choix de la difficulté, record par niveau ».

### Task 3: Cinq armes classiques

**Files:**
- Modify: `src/config.js`, `src/regles/combat.js`, `src/regles/economie.js`, `src/armes.js`, `src/carte.js`, `tests/regles.test.js`, `tests/fumee/scenarios.mjs`

**Interfaces:**
- Produces (dans `CONFIG.armes`, mêmes champs que l'existant) :
  - `revolver` « Revolver » : degats 110, 'semi', 6/36, rechargement 2.0, dispersion 0.01, `multTete: 4`.
  - `pmCompact` « Pistolet-mitrailleur compact » : 28, 1000, 32/192, 1.8, 0.045.
  - `semiAuto` « Fusil semi-automatique » : 140, 'semi', 10/60, 2.4, 0.006, `perce: 2`.
  - `pompeAuto` « Fusil à pompe automatique » : 26, `plombs: 8`, 240, 12/48, 3.0, 0.09.
  - `arbalete` « Arbalète » : 900, 'semi', 1/25, 1.2, 0.003, `perce: 3`, `bruit: 5`.
  - Toutes `rare: false`.
  - `CONFIG.prixMurs` += `revolver: 750, semiAuto: 1750`. `CONFIG.caisse.communes = ['pistolet','mitraillette','pompe','assaut','pmCompact','pompeAuto','arbalete']`.
  - `degatsTir(armeId, zone, distance)` : la chute avec la distance s'applique à toute arme avec `plombs` ; multiplicateur tête = `def.multTete ?? (def.plombs ? CONFIG.multiplicateurTetePompe : CONFIG.multiplicateurTete)`.
  - Carte : `murArme('revolver', -8, 18 - EP / 2, 0, -1)` (mur sud de la cour) ; `murArme('semiAuto', 20, -36 + EP / 2, 0, 1)` (mur nord, zone tour).
  - `armes.js` : `TAILLES` pour les 5 ids (revolver [0.06,0.13,0.26], pmCompact [0.06,0.12,0.3], semiAuto [0.07,0.13,0.85], pompeAuto [0.09,0.13,0.7], arbalete [0.3,0.08,0.6]) ; l'arbalète a un arc (boîte large et fine à l'avant). La condition « tir semi » passe de `a.id === 'pompe'` à `def.cadence === 'semi' || a.id === 'pompe'` (pompe auto tire en continu).
- [ ] **Step 1: Write failing tests** dans `tests/regles.test.js` :
  - `degatsTir('revolver','tete',5) === 440` ; `degatsTir('pompeAuto','corps',20) === Math.round(26*0.3)` ; `degatsTir('pompeAuto','tete',0) === 52` ; `degatsTir('arbalete','corps',30) === 900`.
  - Caisse : `tirageCaisse(seq([0.5, 0.99]), [])` ∈ communes et vaut `'arbalete'`.
- [ ] **Step 2:** `npm test` → échec.
- [ ] **Step 3:** Implémenter config, combat, armes.js, carte.
- [ ] **Step 4: Smoke scenario** « nouvelles armes » : pour chaque mur `revolver` / `semiAuto`, ouvrir les portes nécessaires (`ouvrirPorte` via import de `/src/carte.js`), placer le joueur à `mursArmes[i].position`, mettre 5000 points, `interagir()` → l'arme est en main. Pour chacun des 5 ids, `ajouterArme` + `tirer()` 2 fois sans erreur console. Vérifier aussi qu'aucun mur d'arme n'est dans un obstacle (`aabbs` + rayon 0.35 autour de `position`).
- [ ] **Step 5:** `npm test` + `npm run fumee` passent. Commit « Cinq nouvelles armes ».

### Task 4: Lance-flammes, fusil électrique, brûlure

**Files:**
- Modify: `src/config.js`, `src/regles/combat.js`, `src/armes.js`, `src/zombies.js`, `src/main.js`, `tests/regles.test.js`, `tests/fumee/scenarios.mjs`

**Interfaces:**
- Produces :
  - `CONFIG.armes.lanceFlammes` « Lance-flammes » : degats 12, cadence 600 (10 ticks/s, 1 munition par tick), 100/300, rechargement 3.5, dispersion 0, `rare: true`, `flamme: { portee: 6, angle: 20, brulureDps: 30, brulureDuree: 3 }`.
  - `CONFIG.armes.electrique` « Fusil électrique » : 250, 'semi', 8/48, 2.5, 0.004, `rare: true`, `chaine: { sauts: 4, portee: 5, facteur: 0.8 }`.
  - `combat.js` :
    - `dansCone(origine, direction /*normalisée, plan xz*/, point, portee, angleDeg): boolean` — distance xz ≤ portée et angle entre direction et (point − origine) ≤ `angleDeg / 2` (`angleDeg` est l'ouverture totale : 20 → 10° de chaque côté).
    - `chaineElectrique(premier, zombies, { sauts, portee }): zombie[]` — commence par `premier`, puis répète `sauts` fois : le zombie vivant non encore touché le plus proche (xz) du dernier, à ≤ portée ; s'arrête si aucun.
    - `degatsChaine(base, index, facteur): number` = `Math.round(base * facteur ** index)`.
    - `majBrulure(z, dt): number` — si `z.brulure?.t > 0` : retourne `dps * min(dt, t)`, décrémente `t` ; sinon 0.
    - `enflammer(z, dps, duree)` — pose/renouvelle `z.brulure = { t: duree, dps }`.
  - `zombies.majZombies(dt, joueur, surCoup, surBrulure)` — appelle `surBrulure(z, degats)` quand `majBrulure` > 0 (la mort passe donc par `toucherZombie` dans `main.js`, avec `{ tete:false, couteau:false, brulure:true }` ; une touche de brûlure non mortelle ne rapporte **pas** de points, une mort par brûlure rapporte un kill normal). Zombie qui brûle : teinte orange émissive.
  - `armes.js` : lance-flammes → à chaque tick, `surTouche` + `enflammer` pour tous les zombies `dansCone` avec ligne libre ; effet : petites sphères additives orange projetées (≤ 60 actives). Électrique → premier zombie par `lancerRayon`, puis chaîne ; effet : ligne brisée bleu-blanc (THREE.Line, 0,1 s).
- [ ] **Step 1: Write failing tests** : `dansCone` (point à 5 m droit devant → vrai ; à 7 m → faux ; à 5 m et 30° → faux) ; `chaineElectrique` sur 6 zombies alignés espacés de 3 m plus un isolé à 20 m → renvoie 5 zombies dans l'ordre, sans l'isolé ; ignore les morts ; `degatsChaine(250, 2, 0.8) === 160` ; `majBrulure` : enflammer(z, 30, 3), trois appels dt=1 → 30 chacun, quatrième → 0.
- [ ] **Step 2:** `npm test` → échec.
- [ ] **Step 3:** Implémenter.
- [ ] **Step 4: Smoke scenario** « brûlure tue et compte » : partie neuve, `partie.chrono = 1e9`, faire apparaître un zombie (`emergence = 0`, `vitesse = 0`), `enregistrerApparition(partie)` via import, `enflammer(z, 1000, 3)` via import de `/src/regles/combat.js` → après 1 s : `z.mort === true`, `partie.vivants === 0`, `partie.kills === 1`. Scénario « électrique » : 3 zombies alignés devant la caméra, arme électrique, `tirer()` → au moins 2 zombies ont perdu des PV.
- [ ] **Step 5:** `npm test` + `npm run fumee` passent. Commit « Lance-flammes, fusil électrique et brûlure ».

### Task 5: Grenades à main

**Files:**
- Modify: `src/config.js`, `src/regles/inventaire.js`, `src/regles/combat.js`, `src/armes.js`, `src/main.js`, `src/interface.js`, `index.html`, `tests/regles.test.js`, `tests/fumee/scenarios.mjs`, `LISEZMOI.md`

**Interfaces:**
- Produces :
  - `CONFIG.grenade = { max: 2, degats: 300, rayon: 5, degatsJoueurMax: 50, fusee: 2, vitesse: 14, delai: 0.8 }`.
  - `inventaire.grenades` (2 à la création) ; `lancerGrenade(inv): boolean` (décrémente si > 0) ; `rendreGrenades(inv)` (remet à `max`) ; `remplirTout` remet aussi les grenades.
  - `combat.js` : `degatsZone(distance, max, rayon): number` = `Math.round(max * (1 - distance / rayon))` si `distance <= rayon`, sinon 0.
  - `armes.js` : touche `KeyG` (si `etat.grenade <= 0` et `lancerGrenade` réussit) → projectile lancé depuis la caméra, direction visée + 0.25 vers le haut, vitesse 14 ; gravité 9.8 ; contre le sol (`y <= hauteur du sol`) : `v.y = -v.y·0.3`, `vx,vz ·= 0.6` ; contre un obstacle (raycast du pas) : vitesse horizontale inversée ·0.3 ; explose à `t >= fusee` avec `degatsZone` (zombies : `degats`, joueur : `degatsJoueurMax`, via `blesserJoueur(d, { brut: true })`). Le lance-grenades existant garde son comportement.
  - `main.js` : `rendreGrenades(inventaire)` sur `'vagueCommence'`. HUD : `#grenades` (« ● ● ») dans `#munitions`.
  - `LISEZMOI.md` : ligne « Grenade | G ».
- [ ] **Step 1: Write failing tests** : `creerInventaire().grenades === 2` ; deux `lancerGrenade` → true, troisième → false ; `rendreGrenades` → 2 ; `degatsZone(0,300,5) === 300`, `degatsZone(2.5,300,5) === 150`, `degatsZone(6,300,5) === 0`.
- [ ] **Step 2:** `npm test` → échec.
- [ ] **Step 3:** Implémenter.
- [ ] **Step 4: Smoke scenario** « grenade » : zombie immobile à 6 m devant, PV 200 ; simuler l'appui G (`entrees.appuis.add('KeyG')` via export `entrees` — l'exposer dans `jeu.entrees`) ; après 3 s : zombie mort, `inventaire.grenades === 1`. Variante « grenade contre un mur » : joueur collé à un mur, regarde le mur, lance → après 3 s la grenade n'existe plus et sa position d'explosion est du même côté du mur que le joueur (exposer `armes.derniereExplosion`).
- [ ] **Step 5:** `npm test` + `npm run fumee` passent. Commit « Grenades à main ».

### Task 6: Compteur de zombies restants et Trousse de soin

**Files:**
- Modify: `src/regles/partie.js`, `src/bonus.js`, `src/main.js`, `src/interface.js`, `index.html`, `style.css`, `tests/partie.test.js`, `tests/fumee/scenarios.mjs`

**Interfaces:**
- Produces :
  - `partie.js` : `zombiesRestants(p): number` = `p.restants + p.vivants` (0 en pause).
  - `bonus.js` : type `'soin'` (croix verte, couleur 0xff4060), nom « Trousse de soin » ; tirage équiprobable entre les 4 types.
  - `main.js` : `appliquerBonus('soin')` → `joueur.vie.pv = CONFIG.joueur.vieMax`.
  - `ui.majHUD({..., restants})` : `#vague` affiche « VAGUE 5 · 14 zombies restants » en combat, « VAGUE 5 » seul en pause (singulier « 1 zombie restant »).
- [ ] **Step 1: Write failing tests** : `zombiesRestants` = 30 au début de la vague 5 (après `majPartie`), 29 après une apparition + une mort, 0 en pause.
- [ ] **Step 2:** `npm test` → échec.
- [ ] **Step 3:** Implémenter.
- [ ] **Step 4: Smoke scenario** : après démarrage de vague 1, le texte de `#vague` contient « 10 zombies restants » ; tuer un zombie via le chemin normal → « 9 zombies restants ». Bonus : `bonus.lacher(joueur.position, 'soin')` avec pv à 20 → après 0,3 s pv = 100.
- [ ] **Step 5:** `npm test` + `npm run fumee` passent. Commit « Compteur de zombies restants et trousse de soin ».

### Task 7: Filet anti-blocage des zombies

**Files:**
- Modify: `src/config.js`, `src/regles/partie.js` (ou nouveau `src/regles/blocage.js`), `src/zombies.js`, `src/main.js`, `tests/partie.test.js`, `tests/fumee/scenarios.mjs`

**Interfaces:**
- Produces :
  - `CONFIG.zombie.antiBlocage = { deplacementMin: 0.3, duree: 8, distanceMin: 3 }`.
  - `regles/blocage.js` : `creerSuiviBlocage(pos)` → `{ ref: {x,z}, t: 0 }` ; `majSuiviBlocage(s, pos, dt, distanceJoueur): boolean` — si `distanceJoueur <= distanceMin` ou si `pos` s'est éloigné de `ref` de plus de `deplacementMin` → `ref = pos`, `t = 0`, renvoie false ; sinon `t += dt`, renvoie `t >= duree` (et remet `t` à 0 quand vrai).
  - `zombies.js` : chaque zombie a `suivi` ; pendant `emergence`, pas de suivi ; quand bloqué → `surBloque(z)` (nouveau paramètre de `majZombies`, après `surBrulure`).
  - `main.js` : `surBloque(z)` replace `z.position` au point de `choisirPointApparition(pointsApparitionActifs(), …)`, `z.emergence = 0.8`, `z.chemin = null`. **Ne touche pas** `partie.restants` / `vivants`.
- [ ] **Step 1: Write failing tests** : immobile à 10 m du joueur → false jusqu'à 7,9 s cumulées puis true à 8 s ; immobile mais à 2 m du joueur (en train de frapper) → jamais true ; se déplace de 0,5 m à 5 s → compteur remis à 0.
- [ ] **Step 2:** `npm test` → échec.
- [ ] **Step 3:** Implémenter.
- [ ] **Step 4: Smoke scenario** : toutes portes ouvertes, joueur au départ, `accelerer(4)`, faire apparaître un zombie dans la caisse en bois du bunker (18,16) + `enregistrerApparition` ; attendre jusqu'à 15 s → sa position a changé de plus de 1 m, `partie.vivants === 1`, et il n'est pas dans un obstacle.
- [ ] **Step 5:** `npm test` + `npm run fumee` passent. Commit « Filet anti-blocage des zombies ».

### Task 8: Vérification finale du lot 1

**Files:**
- Modify: `LISEZMOI.md` (difficultés, nouvelles armes, touche G), `tests/fumee/scenarios.mjs` (si besoin)

- [ ] **Step 1:** Scénario fumée « vague 5 Cauchemar toutes zones » : `CONFIG.joueur.vieMax = 1e9` (import), `demarrerPartie('cauchemar')`, toutes portes ouvertes, `partie.vague = 4`, tuer par `toucherZombie` (exposer `jeu.toucherZombie`) tout zombie à < 2 m chaque seconde, `accelerer(3)` → `partie.vague` atteint 6 en moins de 300 s réelles.
- [ ] **Step 2:** `npm test` et `npm run fumee` passent ; regarder `tests/fumee/capture.png`.
- [ ] **Step 3:** Mettre à jour `LISEZMOI.md`. Commit « Lot 1 terminé : vérification et LISEZMOI ».
