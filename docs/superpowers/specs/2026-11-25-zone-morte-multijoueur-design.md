# Zone Morte — Multijoueur coop (jusqu'à 4 joueurs) : conception

Date : 2026-11-25. Validé oralement le 25/11 (choix B : chacun sur son propre partage de connexion mobile ; relais Cloudflare ; règles de coop proposées acceptées).

## 1. Objectif

Jouer à 2, 3 ou 4 en coopération contre les vagues, **chacun sur son PC portable, chacun sur le partage de connexion de son propre téléphone**. Un joueur crée une partie, envoie un lien ; les autres cliquent et rejoignent. Le solo reste strictement identique.

**Réussi si** : depuis le site en ligne, 2 à 4 PC sur des réseaux mobiles différents jouent ensemble une partie complète, sans décalage gênant (zombies fluides, tirs qui touchent ce qu'on vise), avec relève des joueurs à terre et fin de partie commune.

**Hypothèses** (non dites par l'utilisateur, à corriger si besoin) : PC + clavier/souris (pas de mobile) ; pas de chat ; même carte, mêmes armes, mêmes difficultés qu'en solo.

## 2. Architecture réseau

### 2.1 Relais Cloudflare (`relais/`)
Les opérateurs mobiles bloquent les connexions directes entre téléphones (CGNAT) : tous les messages passent par un **relais WebSocket** hébergé gratuitement sur **Cloudflare Workers + Durable Objects**.

- Un Worker (`relais/src/index.js`) reçoit `wss://<relais>/salle/<CODE>` et transmet la connexion au Durable Object `Salle` de ce code (un objet par partie).
- `Salle` : au plus **4 connexions** ; la première est l'**hôte**. Il relaie sans rien calculer : messages de l'hôte → tous les invités (ou un seul, si destinataire précisé) ; messages d'un invité → hôte. Il annonce arrivées et départs (`{t:'arrivee', id, pseudo}`, `{t:'depart', id}`), refuse un 5ᵉ joueur (`{t:'pleine'}`), et signale le départ de l'hôte à tous (`{t:'hotePartie'}`), puis se vide.
- API WebSocket « hibernation » (facturation minimale). Budget gratuit : 100 000 requêtes/jour ; à 4 joueurs × 10 messages/s, environ **13 h de partie par jour**.
- Déploiement avec `wrangler` (dépendance de développement), compte Cloudflare gratuit créé par l'utilisateur (connexion par navigateur, comme pour GitHub). L'adresse du relais est dans `src/config.js` (`CONFIG.reseau.relais`) ; en test : relais local `wrangler dev`.

### 2.2 L'hôte fait autorité
- L'**hôte** fait tourner toute la simulation, comme en solo : vagues, apparitions, IA et animations des zombies, bonus, portes, vie de tous les joueurs.
- Les **invités** n'exécutent pas l'IA : ils affichent les zombies reçus (interpolés) et envoient leur état et leurs actions.
- Confiance entre amis : les touches sont décidées chez celui qui tire (pas d'anti-triche).

### 2.3 Messages (JSON compact, 10 par seconde)
| Sens | Message | Contenu |
|---|---|---|
| invité → hôte | `etat` | position, orientation, accroupi, visée, arme en main, animation (marche/course/arrêt) |
| invité → hôte | `touche` | id du zombie, dégâts, zone (tête/corps/jambes), couteau ; envoyé aussitôt |
| invité → hôte | `action` | ouvrir une porte (déjà payée par l'invité), grenade (position, direction), relever un joueur |
| hôte → tous | `image` | vague, phase, restants ; zombies `[id, x, y, z, angle, anim, drapeaux]` (rampe, tête retirée, boss, mort) ; joueurs (position, PV, à terre, éliminé) ; bonus au sol |
| hôte → tous | `evenement` | mort d'un zombie (tête ?, par qui), points gagnés par un joueur, coup reçu par un joueur, porte ouverte, bonus ramassé, vague commence, fin de partie |

Les invités affichent les zombies **avec 100 ms de retard**, interpolés entre deux images reçues (mouvement fluide malgré 10 images/s). Données mobiles estimées : **≈ 30 Mo par heure** et par joueur.

## 3. Parcours joueur

- **Écran d'accueil** : champ **pseudo** (mémorisé), boutons **Solo** (le jeu actuel), **Créer une partie**, **Rejoindre** (saisie d'un code).
- **Créer** : code de 4 lettres (sans lettres ambiguës, ex. `KZRT`) ; lien `…/zone-morte/?salle=KZRT` avec bouton **Copier le lien**.
- **Ouvrir un lien `?salle=CODE`** : va directement au salon de cette partie (après le pseudo).
- **Salon** : liste des joueurs (pseudo, hôte marqué) ; l'hôte choisit la difficulté et clique **Lancer** (dès 1 joueur). Un joueur qui arrive pendant une partie entre à la vague suivante.
- **Erreurs claires** : « Partie introuvable », « Partie pleine (4 joueurs) », « L'hôte a quitté la partie », « Connexion perdue — reconnexion… » (3 essais, puis retour à l'accueil).

## 4. Règles de la coop

- **Nombre de zombies par vague** × 1 / 1,5 / 2 / 2,5 pour 1 / 2 / 3 / 4 joueurs (arrondi) ; le plafond de 24 zombies vivants simultanés est inchangé. Le boss reste unique, ses PV × (nombre de joueurs + 1) / 2.
- **Cible des zombies** : le joueur debout le plus proche parmi ceux qu'ils perçoivent (perception du jalon 2 appliquée à chaque joueur) ; un joueur à terre n'est plus ciblé.
- **À terre** : à 0 PV, le joueur tombe (vue basse, écran rouge), ne peut plus bouger mais **tire au pistolet**. Un coéquipier à moins de 1,5 m **tient E pendant 3 s** pour le relever (barre de progression ; interrompue s'il s'éloigne ou s'il est touché). Relevé avec **50 % de sa vie**. Sans relève en **30 s** : **éliminé** (spectateur, caméra qui suit un coéquipier) jusqu'au début de la vague suivante, où il réapparaît au départ avec le pistolet et 2 chargeurs.
- **En solo** : pas d'état « à terre », mort directe comme aujourd'hui.
- **Fin de partie** : quand **aucun joueur n'est debout** en même temps. Écran de fin commun : vague atteinte, kills et kills à la tête de chacun. Le record n'est enregistré qu'en solo.
- **Points** : chacun les siens (chaque coup et chaque kill créditent celui qui a tiré). Achats d'armes et munitions au mur, caisse : chacun pour soi. **Portes** : payées par celui qui ouvre, ouvertes pour tous. **Bonus** : pour toute l'équipe (munitions max et trousse pour tous ; points doubles pour tous ; explosion : points à celui qui l'a ramassé).
- **Affichage** : pseudo au-dessus de chaque coéquipier (visible à travers les murs, discret), liste de l'équipe en haut à gauche (pseudo, barre de vie, à terre / éliminé), icône « à relever » au-dessus d'un joueur à terre.
- **Coéquipiers à l'écran** : silhouette de soldat simple (formes géométriques, couleur par joueur), arme en main, animation de marche, accroupi, à terre. Un vrai modèle animé (Mixamo) pourra venir plus tard, comme pour les zombies.

## 5. Découpage du code

| Unité | Rôle | Dépend de |
|---|---|---|
| `relais/` (Worker + `Salle`) | relais WebSocket par code de partie | Cloudflare |
| `src/regles/coop.js` (pur, testé) | code de salle, multiplicateur de vague, PV du boss, à terre / relève / élimination, fin de partie, choix de la cible d'un zombie | `config.js` |
| `src/regles/protocole.js` (pur, testé) | encodage / décodage compact des messages, interpolation des positions | — |
| `src/reseau.js` | connexion au relais, reconnexion, envoi / réception, file d'événements | `WebSocket` |
| `src/coop.js` | branchement hôte (diffuse l'état, applique les touches et actions reçues) et invité (applique les images, envoie état et touches) | `reseau.js`, zombies, partie |
| `src/coequipiers.js` | silhouettes, pseudos, interpolation des coéquipiers | three.js |
| `src/zombies.js` | `majZombies` accepte **plusieurs joueurs** (cible par zombie) ; mode « affichage seul » pour les invités (pose et animation imposées) | `regles/coop.js` |
| `src/main.js`, `interface.js`, `index.html`, `style.css` | menus (pseudo, créer, rejoindre, salon), HUD d'équipe, à terre, écran de fin à plusieurs | — |

Le solo passe par les mêmes fonctions avec une liste d'un seul joueur et sans réseau : aucune régression attendue (toute la fumée actuelle doit rester verte).

## 6. Découpage en lots

1. **Relais et salon** : Worker local (`wrangler dev`), créer / rejoindre / salon / lancer, coéquipiers visibles qui bougent. Erreurs (pleine, introuvable, hôte parti).
2. **Zombies partagés** : simulation chez l'hôte avec plusieurs cibles, images aux invités et interpolation, tirs et touches des invités, morts (tête, flaques) visibles chez tous, points par joueur.
3. **Coop complète** : à terre, relève, élimination, réapparition, fin commune, portes, bonus d'équipe, grenades des invités, HUD d'équipe, écran de fin.
4. **Mise en ligne** : compte Cloudflare (guidé), déploiement du relais, adresse dans la config, publication GitHub Pages, essai réel à plusieurs.

## 7. Tests

- **Unitaires** : `regles/coop.js` (code de salle, multiplicateurs, minuteries à terre / relève / élimination, fin de partie, choix de cible) et `regles/protocole.js` (aller-retour d'encodage, interpolation).
- **Relais** : test node qui ouvre 5 WebSockets sur `wrangler dev` (4 acceptées, 5ᵉ refusée ; relais hôte ↔ invités ; départ de l'hôte annoncé).
- **Fumée à deux navigateurs** (deux pages Edge, un relais local) : rejoindre par code ; l'invité voit l'hôte bouger et inversement ; un zombie tué par l'invité meurt chez l'hôte avec les points à l'invité ; joueur à terre relevé par l'autre ; les deux à terre → fin de partie chez les deux ; hôte qui ferme → message chez l'invité.
- **Toute la fumée solo actuelle reste verte.**
- **Essai réel** (Lot 4) : décalage mesuré (aller-retour affiché en mode test) depuis le site en ligne.

## 8. Hors champ (pour plus tard)

Passation d'hôte si l'hôte quitte ; anti-triche ; chat ; liste publique des parties ; modèle Mixamo animé des coéquipiers ; jeu sur téléphone.
