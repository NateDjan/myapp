# EduCoach FR (Prototype avance)

Application smartphone (Expo React Native) + API Node.js/SQLite pour aider les eleves a progresser en lecture, orthographe et devoirs.

## Webapp + App mobile: meme produit, meme fonctionnalites

- Une seule base UI (`App.tsx`) sert le web et le mobile.
- Les donnees pedagogiques/progression sont synchronisees via le meme backend API.
- La session parent est restauree automatiquement (memoire locale) sur web et mobile.
- En se connectant avec le meme compte, vous retrouvez vos avances des deux cotes.

## Travailler avec Cursor depuis le mobile

Pour lancer des agents **hors bureau** et reprendre le travail sur les **pull requests** au bureau, voir le guide [docs/flux-cursor-mobile.md](docs/flux-cursor-mobile.md). Sur GitHub, le modèle d’issue **Demande agent Cursor** aide à formuler les tâches avant un commentaire `@cursor`.

## Stack

- Mobile: Expo + React Native + TypeScript
- Backend: Express + better-sqlite3 + Zod
- Auth: bcrypt + JWT (sessions with expiry/revocation)
- Session refresh token with rotation and revocation
- Base locale: SQLite (`educoach.db`)

## Fonctionnalites actuellement disponibles

- Inscription/connexion parent (token API)
- Multi-profils enfants par tuteur
- Evaluation initiale rapide (<10 min)
- Parcours eleve 10 minutes:
  1. Lecture
  2. Dictee
  3. Correction
  4. Revision espacee
  5. Recompense
- Progression persistante (niveaux + points)
- File de revision espacee persistante (replanification automatique)
- Espace parent avec dashboard de progression
- Ajout manuel de devoirs (base pour import Pronote)
- Structure de contenus pour Francais, Maths, Histoire
- Base pedagogique structuree CP -> Terminale dans `content/curriculum.fr.json`
- Endpoint de recommandations personnalisees par profil: `GET /api/recommendations/:childId`

## Lancer le backend

```bash
npm install
npm run api
```

API sur `http://localhost:4000`.

## Tests backend

```bash
npm run test:backend
```

## Test de charge API (basique)

Demarrer d'abord le serveur API puis lancer:

```bash
npm run loadtest:api
```

Options:

```bash
API_BASE=http://localhost:4000 LOAD_CONCURRENCY=8 LOAD_ITERATIONS=15 npm run loadtest:api
```

Le script cree une session unique puis charge principalement `/api/health` et `/api/parents/security` pour eviter de fausser les resultats avec les limites anti-bruteforce.

## Lancer l'app mobile

### Distribution parents (Expo Go hors Wi-Fi local)

L'application **ne demande pas** d'URL sur l'ecran: l'adresse du serveur API est embarquee au moment du build Expo.

1. Editer `config/publicApi.json` et remplacer `apiUrl` par l'URL HTTPS publique de votre API (sans slash final).
2. Relancer Metro (`npm run start` ou tunnel). Les parents ne voient aucun champ technique.

Alternative sans modifier le fichier:

```bash
EXPO_PUBLIC_API_URL=https://votre-api.example.com npm run start
```

### Developpement sur le meme Wi-Fi que le PC

```bash
npm run start
```

Sur le meme reseau que la machine qui tourne `npm run api`, Expo peut resoudre automatiquement `http://<IP>:4000`.

Sinon:

```bash
EXPO_PUBLIC_API_URL=http://<IP_LOCALE>:4000 npm run start
```

## Endpoints principaux

- `POST /api/parents/register`
- `POST /api/parents/login`
- `POST /api/parents/refresh`
- `POST /api/parents/logout`
- `GET /api/parents/security`
- `POST /api/parents/children`
- `GET /api/parents/children`
- `POST /api/evaluation/:childId`
- `GET /api/lesson/:childId?subject=Francais`
- `POST /api/session/:childId/dictation`
- `POST /api/review/:reviewId/complete`
- `POST /api/homework/:childId`
- `GET /api/homework/:childId`
- `GET /api/parents/dashboard`
- `GET /api/curriculum`
- `GET /api/recommendations/:childId`

## Deploy production API (HTTPS pour les parents)

L'environnement d'agent ne peut pas ouvrir un compte cloud a votre place, mais le depot est **pret pour un deploy en une commande**.

### Option A — Fly.io (recommande)

Prérequis : [Fly CLI](https://fly.io/docs/h/getting-started/install/), compte Fly.io.

```bash
# Une fois par projet : créer l'app si le nom est libre (modifier fly.toml si besoin)
fly launch --no-deploy --copy-config

fly secrets set JWT_SECRET="$(openssl rand -hex 32)"

fly deploy
```

URL publique typique : `https://educoach-fr-api.fly.dev` (voir `fly status` ou le dashboard Fly).

Puis mettre cette URL **sans slash final** dans `config/publicApi.json` (`apiUrl`), et redémarrer Expo pour les parents.

**CI / GitHub Actions** : ajouter le secret depot `FLY_API_TOKEN`, le workflow `.github/workflows/deploy-api-fly.yml` deploiera sur chaque push (chemins API).

### Option B — Render (Blueprint)

Dans Render : **New** → **Blueprint** → connecter le depot, pointer vers `render.yaml`.  
Le plan gratuit peut recycle le conteneur (SQLite volatile entre redeploiements ; OK pour tests courts).

### Image Docker locale

```bash
docker build -f Dockerfile.api -t educoach-api .
docker run --rm -e JWT_SECRET=test-secret-for-local-docker -e NODE_ENV=production -p 4000:4000 educoach-api
```

---

## Limites encore presentes

- Auth JWT + refresh avec rotation en prototype ; hygiene prod (rotation secrets, revocation globale, SSO parents) a renforcer
- Rate limiting en memoire (non distribue) a remplacer par Redis en multi-instance
- Verrouillage progressif du compte apres echecs de connexion repetees (policy locale)
- Logs structures JSON (request-id + evenements de securite) disponibles cote serveur
- Donnees sur SQLite serveur (persistance selon hebergeur / redeploiements sur plans gratuits)
- Pas d'integration Pronote officielle (workflow manuel uniquement)
- Pas encore de voice dictation / TTS / ASR
- Tests automatises limites au backend (`npm run test:backend`) ; pas encore de suite E2E mobile
- Conformite RGPD/CNIL a finaliser avant production
- Certaines pages officielles (Education.gouv / Eduscol) bloquent le scraping direct; les contenus sont structures depuis references accessibles puis doivent etre verifies par une equipe enseignante
