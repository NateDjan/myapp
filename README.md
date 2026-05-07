# EduCoach FR (Prototype)

Application smartphone (Expo React Native) pour aider les eleves a progresser en lecture, orthographe et autres matieres via des sessions courtes.

## Fonctionnalites incluses

- Creation de compte parent/tuteur
- Plusieurs profils enfants sous le meme tuteur
- Evaluation initiale rapide (<10 minutes)
- Session francaise en 5 etapes:
  1. Lecture progressive
  2. Dictee
  3. Correction guidee
  4. Revision espacee
  5. Recompense
- Espace parent avec suivi des niveaux, points, erreurs a revoir
- Structure prete pour modules Maths et Histoire
- Mention d'integration Pronote en mode demo

## Demarrage

```bash
npm install
npm run start
```

Puis ouvrir avec Expo Go (Android/iOS) ou emulation locale.

## Limitations actuelles

- Donnees locales uniquement (pas de backend)
- Pronote non connecte (placeholder)
- Contenu pedagogique simplifie (dataset demo)
- Pas encore de gestion RGPD/CNIL complete
