# EduCoach FR (Prototype avance)

Application smartphone (Expo React Native) + API Node.js/SQLite pour aider les eleves a progresser en lecture, orthographe et devoirs.

## Stack

- Mobile: Expo + React Native + TypeScript
- Backend: Express + better-sqlite3 + Zod
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

## Lancer l'app mobile

Dans un autre terminal:

```bash
npm run start
```

Si vous testez sur un vrai smartphone, definir l'URL API de votre machine:

```bash
EXPO_PUBLIC_API_URL=http://<IP_LOCALE>:4000 npm run start
```

## Endpoints principaux

- `POST /api/parents/register`
- `POST /api/parents/login`
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

## Limites encore presentes

- Auth simplifiee (token basique, pas de refresh token)
- Pas de chiffrement avance des mots de passe (hash SHA-256 simple)
- Pas de synchronisation cloud multi-device (SQLite locale serveur)
- Pas d'integration Pronote officielle (workflow manuel uniquement)
- Pas encore de voice dictation / TTS / ASR
- Pas de tests auto (unitaires/e2e) pour l'instant
- Conformite RGPD/CNIL a finaliser avant production
- Certaines pages officielles (Education.gouv / Eduscol) bloquent le scraping direct; les contenus sont structures depuis references accessibles puis doivent etre verifies par une equipe enseignante
