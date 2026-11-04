# Liena — API et socle de données

Ce projet contient l'API REST Express et l'interface d'administration React de Liena, le modèle PostgreSQL, les migrations Prisma, le seed du catalogue et les tests.

## Prérequis

- Node.js 20.19+, 22.12+ ou 24+
- PostgreSQL 14+ avec l'extension `btree_gist` disponible
- Prisma ORM 7.9.0

## Installation et configuration

```powershell
npm install
Copy-Item .env.example .env
```

Configurez `DATABASE_URL` vers une base PostgreSQL locale dédiée, puis appliquez le schéma et le catalogue :

```powershell
npm run db:validate
npm run db:generate
npm run db:migrate:dev
npm run db:seed
```

La migration des demandes, devis et missions est additive. N'appliquez pas `db:migrate:dev` à une base partagée sans revue et sauvegarde; les tests DB utilisent exclusivement `TEST_DATABASE_URL`.




## Commandes

```powershell
npm run db:validate
npm run db:generate
npm run db:migrate:dev
npm run db:seed
npm run dev
npm run admin:dev
npm run build
npm run admin:build
npm start
npm run admin:bootstrap -- admin@liena.fr
npm run test
npm run test:db
```

- `db:migrate:dev` crée une migration lors du développement et exige une base accessible.
- `db:migrate:deploy` applique uniquement les migrations versionnées; utilisez-le pour les déploiements.
- `dev` démarre l'API en mode développement sur le port configuré par `PORT` (3000 par défaut).
- `admin:dev` démarre l'interface React dans `apps/admin` sur `http://localhost:5173`.
- `build` compile l'application TypeScript dans `dist`; `start` démarre cette version compilée.
- `admin:build` vérifie les types et compile l'interface React.
- `admin:bootstrap` crée un lien d'activation de 15 minutes pour le premier super-administrateur, uniquement si aucun administrateur ni bootstrap en attente n'existe. La commande affiche un lien secret une seule fois : exécutez-la dans un terminal privé et ne partagez pas sa sortie.
- `test` valide le schéma Prisma et exécute les tests unitaires HTTP/configuration sans connexion à PostgreSQL.
- `db:generate` régénère le client Prisma après une modification du schéma.
- `test:db` applique les migrations et le seed deux fois sur `TEST_DATABASE_URL`, puis exécute les tests d'intégrité/concurrence. Il ne réinitialise pas la base et refuse un nom de base ne contenant pas `test`.
- `db:seed` est idempotent et ne crée que les catégories du catalogue.

Le seed et les commandes Prisma lisent `DATABASE_URL`. Ne lancez pas ces commandes contre une base contenant des données utiles sans avoir compris l'effet de la migration.

## Authentification de l’administration

1. Renseignez `DATABASE_URL`, `CORS_ORIGIN`, `APP_URL`, `EMAIL_FROM` et `RESEND_API_KEY` dans `.env`. Ne partagez jamais les clés API.
2. Appliquez la migration puis générez le client Prisma : `npm run db:migrate:dev` et `npm run db:generate`.
3. Créez le compte initial avec `npm run admin:bootstrap -- admin@liena.fr`; ouvrez le lien à usage unique affiché dans le terminal.
4. Démarrez l’API avec `npm run dev`, puis l’interface dans un autre terminal avec `npm run admin:dev`.
5. Depuis la console, le super-administrateur peut inviter d’autres administrateurs, modifier leurs rôles et retirer leurs accès. Les inscriptions publiques avec privilèges sont désactivées.

Les invitations expirent après 48 heures; les liens de récupération expirent après 30 minutes et ne peuvent être utilisés qu’une fois. Une demande de récupération renvoie toujours le même message, qu’un compte existe ou non. Les mots de passe utilisent Argon2id (12 caractères minimum). Les sessions serveur sont conservées 12 heures par défaut, ou 30 jours si « Mémoriser cet appareil » est coché; le cookie de session est `HttpOnly`, `SameSite=Lax` par défaut et `Secure` en production. Les mutations exigent un jeton CSRF et l’origine configurée. Le retrait d’accès révoque immédiatement les sessions, et l’application empêche de retirer le dernier super-administrateur actif.

L'authentification ci-dessus concerne uniquement l'administration. Les routes métier n'ont pas encore l'intégration Yeria. En développement ou test, `DEV_AUTH_ENABLED=true` autorise temporairement l'en-tête `x-user-id` après vérification UUID, existence, statut actif et absence de suppression logique du compte en base. Cette option est désactivée par défaut et la validation de configuration refuse son activation en production. Ce mécanisme sert uniquement aux essais locaux; ne l'exposez pas comme authentification réelle.

Le compte Resend de test n’envoie des messages qu’à l’adresse autorisée par le mode de test. Pour une livraison réelle, vérifiez un domaine dans Resend et utilisez une adresse d’expédition de ce domaine via `EMAIL_FROM`. Définissez `RESEND_API_KEY` uniquement dans l’environnement d’exécution. Le frontend utilise `http://localhost:3000/api/v1` par défaut; pour le modifier, copiez `apps/admin/.env.example` vers `apps/admin/.env.local` et adaptez `VITE_API_URL`.

Pour déployer le frontend sur une autre origine, configurez l’origine exacte de l’application dans `CORS_ORIGIN` côté API et `VITE_API_URL` dans l’environnement de build React. En production, utilisez HTTPS pour les deux. Si le frontend et l’API sont sur des sites différents, configurez `COOKIE_SAME_SITE=none` et HTTPS; l’origine exacte et le jeton CSRF restent obligatoires. Si l’API est derrière un reverse proxy, réglez `TRUST_PROXY_HOPS` sur le nombre exact de proxies de confiance (et non sur une valeur arbitraire) afin de conserver des adresses IP fiables pour les journaux et la limitation des tentatives.

La limitation de tentatives de connexion utilise actuellement le stockage mémoire du processus; pour plusieurs instances de l’API, remplacez-le par un stockage partagé avant la mise à l’échelle. L’authentification multifacteur n’est pas incluse dans cette première version et devrait être ajoutée avant une mise en production d’un espace d’administration sensible.

## API métier

- `GET /health` vérifie la connexion PostgreSQL et renvoie `503` si la base est indisponible.
- Catalogue public : `GET /api/v1/categories`, `GET /api/v1/categories/:slug`, `GET /api/v1/categories/:slug/services`, `POST /api/v1/services/search`.
- Prestataires/services : `GET /api/v1/providers/search`, `GET /api/v1/providers/:slug`, profil propre `GET/PATCH /api/v1/providers/me/profile`, demande prestataire `POST /api/v1/providers/register`, et gestion propriétaire sous `/api/v1/providers/:slug/services`.
- Demandes/devis/missions : `/api/v1/requests`, `/api/v1/quotes`, `/api/v1/missions`. Une demande peut recevoir plusieurs devis; l'acceptation est sérialisée en transaction et garantie par une contrainte partielle PostgreSQL, puis crée une mission distincte et une conversation.
- Autres routes métier : réservations, disponibilités, conversations/messages texte, favoris, avis, notifications, adresses et signalements. Les routes privées exigent l'identité de développement décrite ci-dessus jusqu'à l'intégration Yeria.
- Administration : sessions et gestion admin sous `/api/v1/admin`, modération des inscriptions prestataires, gestion des catégories, consultation/suspension de comptes ordinaires et traitement des signalements. Les routes admin conservent les protections de session et CSRF.

Toutes les routes montées sont décrites dans `GET /api-docs` et `docs/openapi-liena.json`. La collection Postman est dans `docs/postman-liena.collection.json`; l'environnement sans secret est `docs/postman-liena.environment.json`.

### Test Postman local

1. Démarrez PostgreSQL et configurez `.env`; pour les routes privées locales, positionnez `DEV_AUTH_ENABLED=true` en `development` uniquement.
2. Créez ou utilisez un utilisateur actif existant dans la base de développement et renseignez son UUID dans `devUserId`. Le header de Postman ne crée pas de compte et n'est pas sûr pour un réseau partagé.
3. Lancez `npm run dev`, importez la collection et l'environnement Postman, puis testez d'abord `/health` et le catalogue.
4. Les essais admin restent séparés : initialisez l'administrateur avec `npm run admin:bootstrap -- admin@liena.fr`, récupérez le CSRF et utilisez le cookie de session.

Les réponses d'erreur utilisent `{ error: { code, message }, requestId }`. PostgreSQL inaccessible ou identifiants invalides produisent `503 DATABASE_UNAVAILABLE`; les conflits d'unicité, de statut et de concurrence produisent `409`.

Les erreurs ont une forme JSON stable (`error.code`, `error.message`, `requestId`). Les validations d'entrée utilisent Zod. Helmet, CORS contrôlé, limite JSON de 1 Mio et identifiant de requête sont activés.

## Intégration Yeria et limites

Le SDK `@numerum-tech/yeriasdk` est installé, mais `YeriaApp.verifyUserToken()` n'est pas encore branché au middleware Express. Aucun token Yeria n'est accepté actuellement. L'authentification Yeria et la correspondance de son `sub` avec un compte Liena sont obligatoires avant tout déploiement en production; `x-user-id` n'est qu'un adaptateur de développement bloqué en production.

Les zones géographiques ne disposent pas encore d'un modèle de référence central ni d'une liste métier validée. Les routes utilisent actuellement ville/quartier en texte libre; l'administration de référentiels géographiques reste à définir.

## Architecture et règles métier

Voir :

- [Architecture de la base](./docs/database-architecture.md)
- [Dictionnaire de données](./docs/data-dictionary.md)
- [Règles métier](./docs/business-rules.md)
- [Validation et migrations](./docs/database-validation.md)

Les contraintes SQL renforcent l'intégrité et les contrôles de propriété applicatifs, mais ne remplacent pas une authentification utilisateur réelle. Les pièces jointes de messagerie ne sont pas disponibles; seuls les messages texte sont acceptés jusqu'à l'intégration d'un stockage sécurisé.
