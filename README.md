# To Do List Pixel : guide d'installation

À la fin de ce guide, l'appli est sur l'écran d'accueil de l'iPhone et dans une fenêtre rangée sur le côté de l'écran du PC, avec la même liste sur les deux. Compte environ 45 minutes la première fois.

Il te faut : un PC Windows avec Microsoft Edge, un iPhone, ce dépôt GitHub (compte `rom1-jr`) et un compte Google pour Firebase. Tout est gratuit, sans carte bancaire.

Les étapes marquées **clé secrète** utilisent des clés à ne montrer à personne. Les parties 1 à 6 suffisent pour avoir l'appli ; la partie 7 ajoute le récap du matin.

---

## Partie 1 — Récupérer les fichiers

1. Télécharge `todo-pixel.zip` sur le PC.
2. Clic droit → **Extraire tout…** → **Extraire**.
3. Ouvre le dossier `todo-pixel` : il contient `index.html`, `config.js`, `firestore.rules`, les dossiers `icons`, `fonts`, `vendor`, `recap`, `outils` et `.github`.

## Partie 2 — Mettre l'appli en ligne avec GitHub

### 2.1 Créer le dépôt
Sur <https://github.com> : **+** → **New repository** → nom `todo-pixel` → **Public** → rien d'autre → **Create repository**.

### 2.2 Envoyer les fichiers
Lien **uploading an existing file** → sélectionne **le contenu** du dossier `todo-pixel` (Ctrl + A), pas le dossier → glisse-le dans la page → **Commit changes**.

### 2.3 Vérifier
`index.html` doit être à la racine du dépôt, avec le dossier `.github`. S'il manque `.github` : **Add file** → **Create new file** → `.github/workflows/recap.yml` → colle le contenu du fichier → **Commit changes** (pareil pour `keepalive.yml`).

### 2.4 Activer GitHub Pages
**Settings** → **Pages** → **Deploy from a branch** → `main` et `/ (root)` → **Save**. Une à deux minutes plus tard : « Your site is live ».

### 2.5 Vérifier l'adresse
<https://rom1-jr.github.io/todo-pixel/> affiche l'appli avec « Mode local : config.js n'est pas encore rempli ». C'est normal.

## Partie 3 — Créer la synchro avec Firebase

### 3.1 Créer le projet
<https://console.firebase.google.com> → **Créer un projet** → `todo-pixel` → Google Analytics désactivé → **Créer le projet**.

### 3.2 Activer la connexion par e-mail
**Créer / Build** → **Authentication** → **Commencer** → **Méthode de connexion** → **Adresse e-mail/Mot de passe** → premier interrupteur → **Enregistrer**.

### 3.3 Créer la base de données
**Créer / Build** → **Firestore Database** → **Créer une base de données** → édition **Standard**, identifiant `(default)`, emplacement en Europe (par exemple `europe-west9 (Paris)`), mode **Production**.

### 3.4 Coller les règles
Firestore → onglet **Règles** → remplace tout par le contenu de [`firestore.rules`](firestore.rules) → **Publier**.

### 3.5 Déclarer l'appli web
Roue dentée → **Paramètres du projet** → **Vos applications** → icône **`</>`** → surnom `todo-pixel`, sans Firebase Hosting → **Enregistrer l'application**. Note les 6 valeurs de `firebaseConfig` (elles ne sont pas secrètes).

### 3.6 Autoriser l'adresse de l'appli
**Authentication** → **Paramètres** → **Domaines autorisés** → **Ajouter un domaine** → `rom1-jr.github.io`.

## Partie 4 — Relier l'appli à Firebase

Sur GitHub, ouvre [`config.js`](config.js) → crayon → remplace chaque `REMPLACE-MOI` du bloc `firebase` par la valeur de l'étape 3.5, entre les guillemets (`authDomain` et `storageBucket` : toute la valeur de Firebase). Laisse `vapidPublicKey` pour la partie 7 → **Commit changes**. Deux minutes plus tard, l'adresse de l'appli affiche l'écran **Bienvenue**.

## Partie 5 — Installer l'appli sur l'iPhone

1. **Safari** → <https://rom1-jr.github.io/todo-pixel/>.
2. **Partager** → **Sur l'écran d'accueil** → **Ajouter**.
3. Ouvre l'appli **depuis l'icône** → e-mail + mot de passe (6 caractères minimum) → **Créer mon compte**.

Ouvre-la toujours depuis l'icône, pas depuis Safari.

## Partie 6 — Installer l'appli sur le PC et la ranger sur le côté

1. **Edge** → <https://rom1-jr.github.io/todo-pixel/> → connecte-toi avec le même compte.
2. Icône **Application disponible** dans la barre d'adresse → **Installer** (ou **…** → **Applications** → **Installer To Do List Pixel**).
3. Clic droit sur son icône dans la barre des tâches → **Épingler à la barre des tâches**.
4. Colle la fenêtre au bord droit de l'écran (**Windows + flèche droite**) et rétrécis-la en tirant son bord gauche. Edge retient sa taille et sa place.
5. Option, toujours au premier plan : **PowerToys** (Microsoft Store) → **Always On Top** → **Windows + Ctrl + T** dans l'appli.
6. Option, au démarrage du PC : `edge://apps` → **Détails** sous l'appli → **Démarrer automatiquement à la connexion**. Sinon : **Windows + R** → `shell:startup` → nouveau raccourci vers
   `"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --app=https://rom1-jr.github.io/todo-pixel/`

## Partie 7 (bonus) — Le récap du matin sur l'iPhone

### 7.1 Générer les clés
<https://rom1-jr.github.io/todo-pixel/outils/cles-notifications.html> → **Générer mes clés**. Garde la page ouverte.

### 7.2 Clé publique dans l'appli
`config.js` → remplace le `REMPLACE-MOI` de `vapidPublicKey` par la clé publique → **Commit changes**.

### 7.3 Clé secrète : la clé privée
**Settings** → **Secrets and variables** → **Actions** → **New repository secret** → `VAPID_PRIVATE_KEY` = la clé privée.

### 7.4 Clé secrète : la clé d'accès Firebase
Firebase → **Paramètres du projet** → **Comptes de service** → **Générer une nouvelle clé privée**. Ouvre le `.json` avec le Bloc-notes, copie tout → secret `FIREBASE_SERVICE_ACCOUNT`. Supprime ensuite le fichier du PC ; ne le mets jamais dans le dépôt.

**Vérifie l'endroit** : onglet **Secrets**, les deux noms doivent être sous **Repository secrets** (pas dans **Variables**, ni sous **Environment secrets**), sinon GitHub ne les donne pas au récap.

### 7.5 Garder le récap actif
**Settings** → **Actions** → **General** → **Workflow permissions** → **Read and write permissions** → **Save**. Le workflow `keepalive.yml` évite la mise en pause de GitHub après 60 jours sans activité.

### 7.6 Activer sur l'iPhone
Dans l'appli ouverte depuis l'icône : roue dentée → heure du récap → **Activer sur cet appareil** → **Autoriser** → **Tester une notif**.

### 7.7 Tester l'envoi
**Actions** → **Récap du matin** → **Run workflow**. Le récap arrive en une minute environ, puis chaque matin tout seul.

---

## Dépannage

| Ce que tu vois | Que faire |
| --- | --- |
| Page 404 | Attends 2 minutes après 2.4 ; `index.html` doit être à la racine (2.3). |
| « Mode local : config.js n'est pas encore rempli » | Une valeur contient encore `REMPLACE-MOI` ou un guillemet manque (partie 4). |
| « La connexion par e-mail n'est pas activée dans Firebase » | Étape 3.2. |
| « Accès refusé par Firebase : vérifie les règles Firestore » | Étape 3.4. |
| Ancienne version de l'appli | Ferme complètement l'appli et rouvre-la, deux fois si besoin. |
| « Activer sur cet appareil » grisé sur l'iPhone | Ouvre l'appli depuis l'icône ; iOS 16.4 minimum. |
| Notifications bloquées | Réglages → Notifications → To do list → Autoriser. |
| Pas de récap le matin | **Actions** → **Récap du matin** → dernier lancement : le message dit quelle étape revoir (7.2 à 7.4). |
| Pas d'installation possible dans Edge | Raccourci `--app` de la partie 6. |

## Bon à savoir

- **Tes données** sont dans Firestore et les règles réservent l'accès à ton compte. Le code de ce dépôt est public, tes tâches non.
- **Hors ligne**, l'appli s'ouvre quand même et envoie tes changements au retour du réseau.
- **Polices** : Press Start 2P, Pixelify Sans et Jacquard 24, sous licence SIL Open Font License (voir `fonts/`).
