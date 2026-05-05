# Meet Saver

Meet Saver suit le cout des reunions en temps reel, synchronise les reunions du jour via Google Calendar et suggere les departs anticipes lorsque l'expertise d'un participant n'est plus requise.

## Stack

- Frontend : React + Vite + Tailwind CSS, Lucide React, Recharts
- Backend : Node.js + Express
- Database : PostgreSQL compatible Replit (`DATABASE_URL`)
- Auth : Google OAuth 2.0 avec scope Google Calendar readonly

## Demarrage

```bash
npm install
cp .env.example .env
npm run db:migrate
npm run dev
```

Variables requises pour la vraie synchronisation Google Calendar :

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI` (par defaut `http://localhost:4000/api/auth/google/callback`)
- `DATABASE_URL`

En mode local, des donnees demo sont creees automatiquement sauf si `ENABLE_DEMO_DATA=false`.

## Routes principales

- `GET /api/auth/google` : genere l'URL OAuth Google
- `GET /api/auth/google/callback` : enregistre les tokens OAuth
- `POST /api/calendar/sync` : importe les reunions du jour et leurs participants
- `GET/POST /api/roles` : gestion des roles et taux horaires
- `GET/PATCH /api/participants` : participants et taux individuels
- `GET /api/meetings/:id/costs` : snapshot cash-burn live
- `PATCH /api/agenda/:blockId` : terminer une section d'ordre du jour
- `POST /api/meetings/:id/departures` : valider un depart anticipe

## UI

- Dashboard responsive dark fintech : `/`
- Side-panel 300px simulant une extension Meet/Teams : `/meeting-overlay`
