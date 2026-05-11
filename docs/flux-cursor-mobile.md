# Lancer du travail Cursor depuis le mobile et reprendre au bureau

Ce document décrit des flux **supportés par Cursor** (sans pont WhatsApp maison). Le dépôt reste sur **GitHub** : l’agent pousse une branche et une **pull request**, ce qui sert de fil conducteur une fois au bureau.

## Ce dont vous avez besoin (checklist)

| Élément | Rôle |
|--------|------|
| **Compte Cursor** avec **plan payant** | Les Cloud Agents exigent un plan payant et des droits suffisants (voir [doc officielle — dépannage](https://cursor.com/docs/cloud-agent/web-and-mobile)). |
| **GitHub (ou GitLab)** connecté à Cursor | Paramètres Cursor : compte lié avec droits **lecture + écriture** sur ce dépôt (et sous-modules éventuels). |
| **Accès au dépôt** depuis le téléphone | Navigateur ou application GitHub. |
| **Connexion internet** | Les agents tournent dans le cloud ; votre PC peut être éteint. |

**Optionnel mais utile**

- **Secrets** (clés API, tokens de test) : les déclarer dans le tableau de bord Cursor plutôt que dans le code — [cursor.com/dashboard/cloud-agents](https://cursor.com/dashboard/cloud-agents).
- **Slack** : l’intégration Cursor permet aussi `@cursor` depuis Slack (proche d’une messagerie mobile si votre équipe l’utilise déjà).

---

## Parcours 1 — Agents cloud depuis le téléphone (recommandé)

1. Sur le téléphone, ouvrir **https://cursor.com/agents** et vous connecter avec le même compte Cursor.
2. Choisir le dépôt (par ex. celui d’EduCoach FR), décrire la création ou l’amélioration comme vous le feriez dans l’IDE.
3. Lancer l’agent **cloud**. Il clone le dépôt, travaille sur une **branche dédiée**, ouvre ou met à jour une **PR**.
4. **Au bureau** : ouvrir la PR sur GitHub (notification e-mail ou app), puis dans Cursor faire un `git fetch` / checkout de la branche de la PR, ou fusionner après relecture.

**Raccourci « quasi-app »** : installer la page en **PWA** — iOS : Safari → Partager → « Sur l’écran d’accueil » ; Android : Chrome → menu → « Installer l’application ». Même usage que pour une app, sans WhatsApp.

---

## Parcours 2 — GitHub (issue + `@cursor`)

1. Créer une **issue** depuis le mobile (modèle **« Demande agent Cursor »** si proposé).
2. Rédiger l’objectif, les critères de succès et le contexte (voir le modèle).
3. Publier un **commentaire** contenant **`@cursor`** sur l’issue (ou une PR) pour déclencher l’agent, **si** l’intégration GitHub est activée pour votre organisation Cursor.
4. Suivre la **PR** générée comme au parcours 1.

Si `@cursor` ne réagit pas : vérifier la connexion GitHub dans Cursor, les droits sur le dépôt, et la doc / support Cursor pour votre plan.

---

## Parcours 3 — Slack ou Linear

Si vous les utilisez déjà au travail, la documentation Cursor indique qu’on peut lancer un agent avec **`@cursor`** depuis **Slack** ou **Linear**. Cela peut remplacer une partie des messages « hors bureau » sans développement custom.

---

## Parcours 4 — API Cursor

Cursor documente une **API** pour démarrer un agent. Utile pour une automatisation interne (par ex. serveur qui crée une tâche à partir d’un autre outil). Ce n’est pas WhatsApp natif ; il faudrait un intermédiaire (webhook, Zapier, etc.) et une gestion stricte des secrets.

---

## WhatsApp : pourquoi ce n’est pas dans ce dépôt

Relier **WhatsApp → Cursor** impose en général :

- **WhatsApp Business Platform** (Meta) ou un fournisseur type Twilio, numéro et modération des messages ;
- un **serveur** qui reçoit les webhooks, authentifie l’expéditeur, et appelle **GitHub** (issue) ou l’**API Cursor** ;
- de la **maintenance** et des règles de sécurité (qui a le droit de lancer quoi sur quel dépôt).

Ce dépôt se limite donc aux flux officiels ci-dessus. Si vous montez un pont WhatsApp plus tard, la création d’**issues GitHub** à partir de messages validés reste souvent la couche la plus simple et auditable.

---

## Au bureau : comment « voir ce qui a été fait »

1. **GitHub** : onglet *Pull requests*, fichiers modifiés, description de l’agent, CI éventuelle.
2. **Cursor** : ouvrir la branche de la PR, revue de diff, tests locaux (`npm run test:backend`, etc.).
3. **cursor.com/agents** : historique des exécutions si vous êtes passés par l’interface web.

En résumé : **mobile = démarrer** (agents web ou issue `@cursor`) ; **bureau = relire, tester, fusionner** sur la même PR GitHub.
