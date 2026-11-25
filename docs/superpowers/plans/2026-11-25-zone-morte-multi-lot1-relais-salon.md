# Zone Morte — Multijoueur, Lot 1 « Relais et salon » : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** créer / rejoindre une partie par code, salon d'attente, lancement par l'hôte, et voir ses coéquipiers bouger sur la carte (sans zombies partagés : Lot 2).

**Architecture :** un relais WebSocket Cloudflare (Worker + Durable Object `Salle`, logique pure testée à part) que l'on fait tourner en local avec `wrangler dev` ; côté jeu, `src/reseau.js` (connexion), règles pures `regles/coop.js` et `regles/protocole.js`, `src/coequipiers.js` (silhouettes + pseudos), menus dans `index.html` / `interface.js`, branchement dans `main.js`.

**Tech Stack :** JavaScript ES modules, Cloudflare Workers + Durable Objects (API WebSocket « hibernation »), `wrangler` 4 (dépendance de développement), three.js 0.170, `node --test`, Playwright (Edge, SwiftShader).

**Spec :** `docs/superpowers/specs/2026-11-25-zone-morte-multijoueur-design.md` (sections 2.1, 2.3 `etat`, 3, 4 « Affichage », 5, 6 lot 1, 7).

## Global Constraints

- Noms de code et textes en français ; valeurs chiffrées dans `src/config.js` (`CONFIG.reseau`), règles pures (sans three.js ni DOM) dans `src/regles/`, testées.
- Fins de ligne : garder celles du fichier (CRLF : `armes.js`, `config.js`, `zombies.js`, `carte.js`, `scenarios.mjs`, `interface.js`, `index.html`, `style.css`, `LISEZMOI.md` ; LF : `main.js`, `joueur.js`, `effets.js`). Jamais `sed -i` ni Python en mode texte ; Edit ou node en conservant `\r\n`.
- Tests de fumée : attendre une condition (`waitForFunction`), jamais une durée fixe. Ne jamais lancer deux fumées en même temps (ports fixes).
- 4 joueurs maximum par salle ; le premier connecté est l'hôte ; code de 4 lettres sans lettres ambiguës (alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ` : sans I ni O).
- Messages réseau : 10 par seconde (`CONFIG.reseau.frequence: 10`), affichage des autres avec 100 ms de retard (`CONFIG.reseau.retard: 0.1`), 3 essais de reconnexion (`CONFIG.reseau.essais: 3`).
- Adresse du relais : `CONFIG.reseau.relais` (vide tant que le Lot 4 n'est pas fait) ; surchargée par le paramètre d'URL `?relais=ws://127.0.0.1:8787`. Relais vide → boutons multijoueur grisés avec « Multijoueur bientôt disponible ».
- Le solo ne change pas : toute la fumée actuelle reste verte.
- Pseudo : 1 à 16 caractères après nettoyage (espaces en trop retirés), mémorisé (`zoneMorte.pseudo`), affiché uniquement via `textContent`.

## Review Focus

1. Relais injoignable ou adresse vide : message clair, retour à l'accueil, solo intact, aucune erreur console. → Tâche 4, scénario « relais injoignable ».
2. Pseudo vide, trop long ou contenant du HTML (`<b>x</b>`) : refusé ou nettoyé, jamais interprété. → Tâche 2 (`nettoyerPseudo`) + Tâche 4 (affichage `textContent`).
3. Code saisi en minuscules ou avec espaces (` kzrt `) : accepté (normalisé) ; code invalide (`K1`) : « Code invalide » sans connexion. → Tâche 2 (`normaliserCode`) + Tâche 4.
4. L'hôte ferme son onglet pendant le salon ou la partie : les invités voient « L'hôte a quitté la partie » et reviennent à l'accueil. → Tâche 1 (logique) + Tâche 5 (fumée).
5. Un 5ᵉ joueur : « Partie pleine (4 joueurs) » ; rejoindre un code sans hôte : « Partie introuvable ». → Tâche 1 + Tâche 4.

---

### Task 1 : Relais Cloudflare (Worker + Durable Object `Salle`)

**Files :**
- Create : `relais/wrangler.toml`, `relais/src/index.js`, `relais/src/salle.js`, `relais/src/logique.js`, `tests/relais-logique.test.js`, `tests/relais.integration.mjs`
- Modify : `package.json` (devDependency `wrangler@^4`, scripts `"relais": "wrangler dev --config relais/wrangler.toml --port 8787"`, `"test:relais": "node tests/relais.integration.mjs"`), `.gitignore` (`relais/.wrangler/`)

**Interfaces :**
- Produces (URL) : `GET /salle/<CODE>?mode=creer|rejoindre&pseudo=<p>` avec `Upgrade: websocket` ; autre chemin → 404.
- Produces (messages du relais) : `{t:'bienvenue', id, hote: bool, membres:[{id,pseudo,hote}]}`, `{t:'arrivee', id, pseudo}`, `{t:'depart', id}`, `{t:'pleine'}`, `{t:'introuvable'}`, `{t:'existe'}`, `{t:'hotePartie'}` ; puis le relais ferme la socket après `pleine` / `introuvable` / `existe` / `hotePartie`.
- Produces (relayage) : un message client `{a?: id, ...}` est remis enrichi de `de: <id expéditeur>` — d'un invité : toujours à l'hôte seul ; de l'hôte : à `a` si précisé, sinon à tous les invités.
- Produces (`relais/src/logique.js`, pur) :
  - `admettre(membres, { id, pseudo, mode }) -> { refus: 'pleine'|'introuvable'|'existe' } | { membre: {id, pseudo, hote} }`
  - `destinataires(membres, deId, message) -> id[]`
  - `apresDepart(membres, id) -> { fermerTout: bool, annonce: {t:'depart', id} | {t:'hotePartie'} }`
- `Salle` garde chaque membre dans `ws.serializeAttachment({id, pseudo, hote})` (survit à l'hibernation) et reconstruit `membres` depuis `state.getWebSockets()`.

- [ ] **Step 1 : tests qui échouent** `tests/relais-logique.test.js` : `admettre` — 1er `creer` → hôte ; `rejoindre` salle vide → `introuvable` ; `creer` salle occupée → `existe` ; 5ᵉ → `pleine`. `destinataires` — invité → `[hôte]` ; hôte sans `a` → tous les invités ; hôte avec `a` → `[a]`. `apresDepart` — invité → `{fermerTout:false, annonce:{t:'depart'}}` ; hôte → `{fermerTout:true, annonce:{t:'hotePartie'}}`.
- [ ] **Step 2 :** `node --test tests/relais-logique.test.js` → FAIL (module absent). **Step 3 :** implémenter `logique.js`. **Step 4 :** → PASS.
- [ ] **Step 5 :** `npm install -D wrangler@^4` ; écrire `wrangler.toml` (nom `zone-morte-relais`, `main = "src/index.js"`, `compatibility_date = "2026-11-01"`, Durable Object `SALLE` → classe `Salle`, migration `new_sqlite_classes = ["Salle"]`), `index.js`, `salle.js`.
- [ ] **Step 6 : test d'intégration** `tests/relais.integration.mjs` (lance `npm run relais`, attend le port, utilise le `WebSocket` intégré de node) : hôte crée `TEST` → `bienvenue hote:true` ; 3 invités → `bienvenue` + `arrivee` chez l'hôte ; 5ᵉ → `pleine` ; message invité → reçu par l'hôte seul avec `de` ; message hôte → reçu par les 3 invités ; `rejoindre` `ZZZZ` → `introuvable` ; l'hôte ferme → les invités reçoivent `hotePartie`. Affiche `RELAIS OK`. Commande : `npm run test:relais` → `RELAIS OK`.
- [ ] **Step 7 :** commit `Relais Cloudflare : salles de 4 joueurs`.

---

### Task 2 : Règles pures — code de salle, pseudo, protocole d'état

**Files :**
- Create : `src/regles/coop.js`, `src/regles/protocole.js`, `tests/coop.test.js`, `tests/protocole.test.js`
- Modify : `src/config.js` (`reseau: { relais: '', frequence: 10, retard: 0.1, essais: 3, maxJoueurs: 4 }`)

**Interfaces :**
- Produces (`coop.js`) : `genererCode(rng) -> string` (4 lettres de l'alphabet sans I ni O) ; `normaliserCode(texte) -> string | null` (majuscules, espaces retirés, null si pas 4 lettres de l'alphabet) ; `nettoyerPseudo(texte) -> string | null` (espaces réduits, coupé à 16, null si vide) ; `adresseRelais(config, parametresUrl) -> string` (paramètre `relais` prioritaire, sinon `config.reseau.relais`).
- Produces (`protocole.js`) : `encoderEtat(j) -> array` et `decoderEtat(tableau) -> {x, y, z, lacet, tangage, accroupi, vise, arme, anim}` (positions arrondies au cm, angles à 0,01 rad ; `anim ∈ 'arret'|'marche'|'course'`) ; `interpoler(a, b, k) -> etat` (positions linéaires, lacet par le plus court chemin, booléens et arme pris de `b`) ; `etatAuTemps(historique, t) -> etat|null` (historique `[{t, etat}]` trié ; interpole entre les deux encadrant `t`, sinon le plus proche).
- [ ] **Step 1 : tests qui échouent** : `genererCode(() => 0) === 'AAAA'`, jamais `I`/`O` sur 1000 tirages ; `normaliserCode(' kzrt ') === 'KZRT'`, `normaliserCode('K1') === null`, `normaliserCode('KZIO') === null` ; `nettoyerPseudo('  Bob   le  zombie ') === 'Bob le zombie'`, `nettoyerPseudo('   ') === null`, longueur max 16 ; `adresseRelais({reseau:{relais:'wss://a'}}, new URLSearchParams('relais=ws://b')) === 'ws://b'` ; aller-retour `decoderEtat(encoderEtat(e))` à 1 cm près ; `interpoler` à `k=0.5` ; lacet de 3,1 à −3,1 passe par π (pas par 0) ; `etatAuTemps` avant, entre, après l'historique.
- [ ] **Step 2 :** `npm test` → FAIL. **Step 3 :** implémenter. **Step 4 :** `npm test` → PASS.
- [ ] **Step 5 :** commit `Règles du multijoueur : code de salle, pseudo, état réseau`.

---

### Task 3 : Connexion au relais (`src/reseau.js`)

**Files :**
- Create : `src/reseau.js`
- Modify : `tests/relais.integration.mjs` (cas supplémentaire : module `reseau.js` importé dans node)

**Interfaces :**
- Consumes : messages du relais (Tâche 1).
- Produces : `connecter({ url, code, mode, pseudo, WebSocketImpl = WebSocket }) -> Promise<Connexion>` ; rejet avec `Error` dont `.raison ∈ 'pleine'|'introuvable'|'existe'|'injoignable'` ; `Connexion = { id, hote, membres, envoyer(message, a?), surMessage(fn), surEtat(fn), fermer() }` ; `surEtat` reçoit `'reconnexion'` (jusqu'à `CONFIG.reseau.essais` essais, 1 s d'intervalle, en `mode: 'rejoindre'`), `'perdue'` (échec des essais) ou `'hotePartie'`.
- [ ] **Step 1 : test qui échoue** : dans `relais.integration.mjs`, `connecter` hôte puis invité via le module ; `envoyer` invité → `surMessage` de l'hôte ; `connecter` sur un port fermé → rejet `injoignable` en moins de 5 s.
- [ ] **Step 2 :** `npm run test:relais` → ECHEC. **Step 3 :** implémenter. **Step 4 :** → `RELAIS OK`.
- [ ] **Step 5 :** commit `Connexion au relais avec reconnexion`.

---

### Task 4 : Menus : pseudo, créer, rejoindre, salon

**Files :**
- Modify : `index.html` (accueil : `#pseudo` input, `#btn-solo` (renomme `#btn-jouer`, les tests existants sont adaptés), `#btn-creer`, `#btn-rejoindre` + `#code-salle` input ; écran `#ecran-salon` : `#salon-code`, `#btn-copier-lien`, `#salon-joueurs` (liste), choix de difficulté réutilisé pour l'hôte, `#btn-lancer` (hôte), `#btn-quitter-salon`, `#salon-message`), `style.css`, `src/interface.js` (`ecranSalon({ code, lien, membres, hote, difficulte })`, `messageAccueil(texte)`), `src/main.js` (parcours), `tests/fumee/scenarios.mjs`
- Create : `tests/fumee/fumee-coop.mjs` (lance `python -m http.server 8644` + `npm run relais`, ouvre des pages Edge avec `?test=1&relais=ws://127.0.0.1:8787`, exécute `scenarios-coop.mjs`, affiche `FUMEE COOP OK`), `tests/fumee/scenarios-coop.mjs` ; `package.json` script `"fumee:coop": "node tests/fumee/fumee-coop.mjs"`

**Interfaces :**
- Consumes : `connecter` (Tâche 3) ; `genererCode`, `normaliserCode`, `nettoyerPseudo`, `adresseRelais` (Tâche 2).
- Produces : `jeu.coop = { connexion, code, membres, hote } | null` (exposé dans `window.__jeu`) ; ouverture d'une URL `?salle=CODE` → pseudo puis salon directement ; code déjà pris (`existe`) → nouveau code tiré automatiquement (5 essais) ; textes d'erreur exacts : « Partie introuvable », « Partie pleine (4 joueurs) », « L'hôte a quitté la partie », « Serveur multijoueur injoignable », « Code invalide », « Choisis un pseudo », « Multijoueur bientôt disponible ».
- [ ] **Step 1 : scénarios qui échouent** (`scenarios-coop.mjs`) : « créer et rejoindre » (page A crée → code affiché, lien contient `?salle=` ; page B ouvre le lien → salon avec 2 joueurs chez A et B, hôte marqué) ; « partie pleine » (4 pages puis une 5ᵉ → message) ; « introuvable » ; « code invalide » ; « pseudo HTML » (`<b>x</b>` affiché tel quel, aucun élément `b` créé). Dans `scenarios.mjs` (solo) : « relais injoignable » (`?relais=ws://127.0.0.1:9` → « Serveur multijoueur injoignable », retour accueil, **Solo** démarre).
- [ ] **Step 2 :** `npm run fumee:coop` → ECHEC. **Step 3 :** implémenter. **Step 4 :** `npm test && npm run fumee && npm run fumee:coop` → PASS / `FUMEE OK` / `FUMEE COOP OK`.
- [ ] **Step 5 :** commit `Menus multijoueur : pseudo, créer, rejoindre, salon`.

---

### Task 5 : Lancement et coéquipiers visibles

**Files :**
- Create : `src/coequipiers.js`
- Modify : `src/main.js`, `src/interface.js` (`listeEquipe(membres)` en haut à gauche), `style.css`, `tests/fumee/scenarios-coop.mjs`, `LISEZMOI.md` (section « Multijoueur (en préparation) » + commandes `npm run relais`, `npm run fumee:coop`)

**Interfaces :**
- Consumes : `encoderEtat`, `decoderEtat`, `etatAuTemps` (Tâche 2) ; `jeu.coop` (Tâche 4).
- Produces : message hôte `{t:'lancer', difficulte}` → tous démarrent `demarrerPartie(difficulte, { coop: true })` ; **en Lot 1, partie coop sans zombies** (`partie.phase` maintenue en `'pause'`, chrono infini ; levé au Lot 2) ; chaque joueur envoie `{t:'etat', e: encoderEtat(...)}` à `CONFIG.reseau.frequence` ; l'hôte relaie à tous les états des autres (`{t:'etats', liste:[[id, e]]}`) ; `creerCoequipiers(scene) -> { maj(dt, maintenant), recevoir(id, etat, t), retirer(id), liste }` : silhouette en boîtes (couleur par ordre d'arrivée : `0x4a7fd4`, `0xd4a24a`, `0x5fbf6a`, `0xc85a5a`), pseudo en sprite au-dessus de la tête (`depthTest: false`), affichée à `maintenant − CONFIG.reseau.retard` via `etatAuTemps`, jambes animées selon `anim`, accroupi abaissé ; départ d'un membre → `retirer` ; `hotePartie` / `perdue` → partie arrêtée, accueil avec le message.
- [ ] **Step 1 : scénarios qui échouent** : « lancement » (A lance en Recrue → A et B en partie, aucun zombie) ; « coéquipier visible » (B se déplace de 5 m → chez A, la silhouette de B s'est déplacée de plus de 4 m ; pseudo de B affiché) ; « départ d'un invité » (B ferme → silhouette retirée chez A, A continue) ; « l'hôte quitte » (A ferme → B voit « L'hôte a quitté la partie » et l'accueil).
- [ ] **Step 2 :** ECHEC. **Step 3 :** implémenter. **Step 4 :** `npm test && npm run test:relais && npm run fumee && npm run fumee:coop` → tout passe.
- [ ] **Step 5 :** commit `Multijoueur : lancement et coéquipiers visibles`.
