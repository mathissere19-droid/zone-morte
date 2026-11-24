# Zone Morte — Jalon 2 : difficulté, armes, couverts, escalade, réalisme

Date : 2026-11-24
Statut : en attente de validation
Base : jalon 1 jouable (branche `jalon1`, commit b119188).

## 1. Intention

Ce que l'utilisateur a demandé : « rajouter des éléments pour se cacher, grimper, et rendre le tout réaliste ; plusieurs difficultés ; plus d'armes ». Il a laissé les choix de détail au concepteur (« fais le meilleur »), en insistant sur **réaliste** et **endroits pour se cacher / grimper**.

Succès : en jouant, l'utilisateur
- choisit une difficulté qui change vraiment l'expérience ;
- trouve et utilise de nouvelles armes et des grenades ;
- peut se mettre à couvert, se baisser, échapper un moment aux zombies en se cachant, monter sur des conteneurs, toits et passerelles — et les zombies savent l'y rejoindre (pas de « camping » invincible) ;
- trouve que la base ressemble à un vrai lieu la nuit (textures, lumières, ombres, ciel), à 60 i/s en qualité Moyenne.

Le travail est livré en **3 lots**, dans l'ordre, chacun jouable à la fin :
1. Gameplay : difficulté, armes, grenades, compteur, bonus soin.
2. Se cacher et grimper : nouveaux décors, accroupi, escalade, perception des zombies.
3. Réalisme visuel : textures, ciel, lumières, ombres, post-traitement, lampe torche, réglage qualité.

Hors jalon 2 : sons (jalon suivant), zombies Mixamo et armes 3D détaillées (jalon suivant), machine d'amélioration d'armes, boss, multijoueur.

## 2. Lot 1 — Gameplay

### 2.1 Difficulté
Choix sur l'écran d'accueil (4 boutons). Valeurs dans `CONFIG.difficultes`.

| | Recrue | Soldat | Vétéran | Cauchemar |
|---|---|---|---|---|
| PV zombies | ×0,7 | ×1 | ×1,3 | ×1,6 |
| Dégâts reçus | ×0,6 | ×1 | ×1,4 | ×1,8 |
| Points de départ | 1 000 | 500 | 500 | 250 |
| Munitions (réserve initiale et achats) | ×1,5 | ×1 | ×1 | ×0,75 |
| Première vague avec coureurs | 8 | 5 | 3 | 1 |
| Régénération | délai 3 s | 4 s | 6 s | aucune |

- La part de coureurs suit la formule actuelle décalée : `min(0,1·(v − premiereVagueCoureurs + 1), 0,8)`.
- Record (meilleure vague) stocké **par difficulté** (`zoneMorte.record.<id>`), affiché sur l'accueil et l'écran de fin.
- La difficulté est fixée pour toute la partie ; « Rejouer » garde la même.

### 2.2 Nouvelles armes (14 au total)
| Arme | Source | Dégâts | Cadence | Chargeur / réserve | Particularité |
|---|---|---|---|---|---|
| Revolver | mur cour, 750 | 110 | semi | 6 / 36 | tête ×4 |
| Pistolet-mitrailleur compact | caisse | 28 | 1 000 c/min | 32 / 192 | dispersion forte |
| Fusil semi-automatique | mur tour, 1 750 | 140 | semi | 10 / 60 | perce 2 |
| Fusil à pompe automatique | caisse | 8 × 26 | 240 c/min | 12 / 48 | |
| Arbalète | caisse | 900 | semi | 1 / 25 | perce 3, rechargement 1,2 s |
| Lance-flammes (rare) | caisse | 12 par tick (10/s) | continu | 100 / 300 | cône 6 m, 20°, enflamme : 30 dégâts/s pendant 3 s |
| Fusil électrique (rare) | caisse | 250 puis ×0,8 par saut | semi | 8 / 48 | l'éclair saute sur 4 zombies à ≤ 5 m du précédent |

- Caisse : les 3 armes rares actuelles + les 2 nouvelles se partagent les 10 % de rareté ; les communes deviennent pistolet, mitraillette, pompe, assaut, PM compact, pompe auto, arbalète.
- Prix des murs ajoutés dans `CONFIG.prixMurs`. Le mur du revolver est dans la cour, celui du fusil semi-auto au pied de la tour radio.

### 2.3 Grenades
- Touche **G** : lancer (trajectoire parabolique, rebond simple sur le sol, explose après 2 s).
- 300 dégâts dans un rayon de 5 m (décroissant), peut blesser le joueur (50 max).
- 2 grenades max ; on revient à 2 au début de chaque vague. Le bonus *Munitions max* les remplit aussi.

### 2.4 Interface
- Haut de l'écran : « VAGUE 5 · 14 zombies restants » (restants = à faire apparaître + vivants).
- Compteur de grenades à côté des munitions.
- Accueil : choix de difficulté + record de chaque niveau.

### 2.5 Bonus Trousse de soin
- Remet la vie au maximum. Ajouté à la liste des bonus (tirage équiprobable entre les 4). En Cauchemar c'est la seule façon de se soigner.

## 3. Lot 2 — Se cacher et grimper

### 3.1 Nouveaux décors de couverture (toutes zones)
Formes simples au lot 2, texturées au lot 3. Placés pour créer des couloirs et des cachettes sans bloquer la boucle de circulation entre zones.
- **Cour** : 2 conteneurs maritimes (2,6 m, montables), murets de sacs de sable (1 m), carcasse de jeep, palettes, barils, le camion renversé existant devient montable.
- **Hangar** : passerelle métallique à 3 m le long d'un mur (2 échelles), pile de caisses en escalier, bâches sur véhicules (on peut se glisser derrière).
- **Bunker** : armoires et bureaux renversés comme couverts bas ; un conduit d'aération où l'on passe accroupi (raccourci entre deux salles).
- **Tour radio** : la plateforme existante + un toit de guérite accessible par échelle.
- Toit du bâtiment du bunker accessible par une échelle extérieure côté cour.

### 3.2 Joueur
- **Accroupi** : `C` ou `Ctrl` (bascule). Yeux à 1,0 m, vitesse ×0,5, dispersion ×0,7, plus de sprint. Permet de passer sous les obstacles de 1,2 m (conduit). On ne peut pas se relever si le plafond est trop bas.
- **Escalade de rebord** : `Espace` face à un rebord dont le haut est entre 0,9 m et 2,2 m au-dessus des pieds, à moins de 0,8 m → on se hisse (0,6 s, caméra qui monte et passe par-dessus). Armes inutilisables pendant ce temps.
- **Échelles** : volumes « échelle » ; en avançant face à une échelle on monte/descend (2,5 m/s), `Espace` pour se détacher.
- **Surfaces en hauteur** : `hauteurSol(x, z)` est généralisé en une liste de surfaces (`{minX,maxX,minZ,maxZ,h}` + rampes) ; le sol retenu est la plus haute surface ≤ hauteur actuelle + marche (0,35 m). On peut tomber d'un toit (pas de dégâts de chute en dessous de 4 m, au-delà 10 PV par mètre).

### 3.3 Perception des zombies (se cacher)
Nouveau module pur `src/regles/perception.js` (testé). Chaque zombie a un état :
- **traque** : il connaît la position du joueur et la suit (comportement actuel).
- **recherche** : il a perdu le joueur ; il va à la **dernière position connue**, puis fouille autour (points aléatoires dans 6 m) pendant 8 s.
- **flair** : passé `delaiFlair` (15 s, 10 s en Vétéran, 6 s en Cauchemar) sans repérer le joueur, il « sent » sa position et repasse en traque. Garantit que les vagues ne bloquent jamais.

Repérage (passage en traque) si l'une de ces conditions est vraie :
- **vue** : ligne libre, distance ≤ 25 m (≤ 12 m si le joueur est accroupi dans l'ombre, c.-à-d. loin de toute lumière et lampe éteinte), dans un cône de 120° devant le zombie ;
- **bruit** : le joueur tire (rayon 30 m ; arbalète 5 m), sprinte (10 m), marche (5 m), accroupi (1,5 m) ;
- **contact** : distance ≤ 2 m ;
- un zombie qui repère le joueur alerte ceux à ≤ 8 m.

Les zombies apparaissent en traque. Conséquence : on peut casser le contact (se baisser derrière un conteneur, monter sur un toit sans bruit), souffler quelques secondes, puis la horde revient.

### 3.4 Les zombies grimpent aussi
- La carte déclare des **liens d'escalade** `{bas:{x,z}, haut:{x,z,h}, duree}` (échelles et rebords bas ; durée 1,5 s, 2,5 s pour une échelle).
- Si le joueur est sur une surface en hauteur et qu'un zombie est en traque, il va au lien d'escalade le plus proche qui mène à cette surface, grimpe (animation : monte en ligne droite), puis le poursuit sur la surface (déplacement direct + collisions des bords).
- Une surface en hauteur est un « îlot » : la navigation A* reste en 2D au sol ; sur un îlot, déplacement direct. Si le joueur redescend, le zombie saute en bas (0,4 s) au bord le plus proche.

## 4. Lot 3 — Réalisme visuel

- **Textures PBR** Poly Haven (CC0, téléchargées par Claude via leur API, 1K) : asphalte fissuré, béton, béton sale, tôle ondulée rouillée, métal peint, bois de palette, sacs de sable, toile de bâche, grillage (alpha). Couleur + normale + rugosité (+AO). Répétition des UV selon la taille de chaque boîte.
- **Ciel** : HDRI de nuit Poly Haven (éclairage d'ambiance faible + fond) ; lune directionnelle bleutée avec ombres ; brouillard exponentiel.
- **Lumières** : projecteurs de cour sur mâts (SpotLight avec ombres, 2 en Moyenne / 4 en Haute), néons du bunker qui grésillent (existants), gyrophare rouge de la tour. **Lampe torche** du joueur (`F`), avec ombre en Haute.
- **Post-traitement** : tone mapping ACES, bloom (lumières, flammes, éclairs), SSAO (Haute seulement), grain de film + vignette + légère aberration chromatique (shader unique), correction de couleur froide.
- **Effets** : flamme de bouche avec éclair de lumière, étincelles/poussière à l'impact, sang sur les zombies, trous de balle (64 max), feu du lance-flammes en particules, éclair électrique en ligne brisée lumineuse, explosion de grenade avec fumée.
- **Qualité** (menu pause + accueil) : Basse / Moyenne / Haute → résolution de rendu (0,7 / 1 / 1), ombres (non / projecteurs / tout), SSAO (non / non / oui), particules (×0,4 / ×1 / ×1). Choix mémorisé (`localStorage`).
- Nouveau module `src/rendu.js` (renderer, composer, qualité) et `src/textures.js` (chargement + application, repli couleur unie si un fichier manque, avec message dans la console).
- Les fichiers vont dans `assets/textures/` et `assets/hdri/`, crédités dans `CREDITS.md`.

## 5. Architecture (changements)

```
src/config.js          + difficultes, nouvelles armes, grenades, perception, escalade, qualité
src/regles/
  difficulte.js        (nouveau) applique les multiplicateurs ; part de coureurs par difficulté
  perception.js        (nouveau) états traque/recherche/flair, repérage vue/bruit/contact
  surfaces.js          (nouveau) surfaces en hauteur, hauteurSol, choix du lien d'escalade
  combat.js            + chaîne électrique, dégâts de zone décroissants, brûlure
  vagues.js            partCoureurs(v, difficulte)
  vie.js               régénération paramétrée par la difficulté
  inventaire.js        + grenades
src/joueur.js          accroupi, escalade, échelles, chute
src/zombies.js         perception, liens d'escalade, brûlure
src/armes.js           nouvelles armes, lance-flammes, électrique, grenades
src/carte.js           nouveaux décors, surfaces, échelles, liens d'escalade
src/rendu.js, textures.js   (lot 3)
src/interface.js       compteur, grenades, choix difficulté, qualité
```

Principe inchangé : toute règle chiffrée dans `config.js` + `regles/` (pur, testé) ; les modules visuels n'en recalculent pas.

## 6. Gestion des erreurs
- Texture ou HDRI manquant → couleur unie / fond uni, avertissement console, le jeu continue.
- Si les performances chutent sous 40 i/s pendant 5 s en Haute, message proposant de passer en Moyenne (pas de changement automatique).
- Un zombie bloqué (aucun déplacement de plus de 0,3 m pendant 8 s alors qu'il est en traque et à plus de 3 m) est replacé au point d'apparition actif le plus proche hors de vue — filet de sécurité contre tout futur blocage de vague.

## 7. Vérification
- **Tests unitaires** (`node --test`) : multiplicateurs de difficulté, part de coureurs par difficulté, régénération désactivée en Cauchemar, chaîne électrique (ordre, portée, décroissance), dégâts de zone décroissants, brûlure, grenades (stock, remise à 2), transitions de perception (vue, bruit, contact, alerte, flair), `hauteurSol` multi-surfaces, choix du lien d'escalade.
- **Test du jeu lancé** (`npm run fumee`) : choix d'une difficulté, compteur qui baisse après un kill, lancer de grenade qui tue un zombie, escalade d'un conteneur par le joueur, zombie qui rejoint le joueur sur un toit, zombie qui perd le joueur caché puis le retrouve par flair, aucun point d'apparition / décor qui coince, vague 5 complète toutes zones ouvertes, aucune erreur console. Captures d'écran à chaque lot.
- **Parties réelles** par l'utilisateur à la fin de chaque lot.
