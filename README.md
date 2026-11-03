# Liena — API et socle de données

Ce projet contient l'API REST Express et l'interface d'administration React de Liena, le modèle PostgreSQL, les migrations Prisma, le seed du catalogue et les tests.

## Prérequis

- Node.js 20.19+, 22.12+ ou 24+
- PostgreSQL 14+ avec l'extension `btree_gist` disponible
- Prisma ORM 7.9.0




## Préparer et lancer le projet en développement

```powershell
# À la racine du projet, créer puis configurer le fichier .env
Copy-Item .env.example .env
notepad .env

# Dans .env, remplacer les valeurs d'exemple par les vrais identifiants PostgreSQL :
# DATABASE_URL="postgresql://<utilisateur>:<mot-de-passe>@localhost:5432/liena_dev?schema=public"
# TEST_DATABASE_URL="postgresql://<utilisateur>:<mot-de-passe>@localhost:5432/liena_test?schema=public"
# Remplacer les chevrons; encoder les caractères spéciaux du mot de passe au format URL.
# TEST_DATABASE_URL doit désigner une base séparée réservée aux tests.

# Vérifier PostgreSQL démarré, la base liena_dev créée et btree_gist disponible,
# puis préparer le schéma et la base
npm run db:validate
npm run db:generate
npm run db:migrate:dev
npm run db:seed

# Dans un premier terminal, démarrer l'API et la laisser tourner
npm run dev

# Dans un deuxième terminal à la racine du projet, démarrer l'interface
npm run admin:dev

# Une fois l'API démarrée, vérifier la connexion PostgreSQL
# http://localhost:3000/health
```

Les valeurs de `.env.example` sont des exemples, pas des identifiants garantis sur votre ordinateur. Si une commande renvoie `P1000: Authentication failed`, PostgreSQL est joignable mais refuse les identifiants de `DATABASE_URL`; corrigez-les avant de poursuivre. Si la connexion est refusée ou expire, vérifiez que PostgreSQL est démarré et que l'hôte et le port sont corrects. Ne partagez jamais le contenu de `.env`.

L'API est disponible sur `http://localhost:3000` et l'interface d'administration sur `http://localhost:5173`. Le message indiquant que l'API écoute confirme son démarrage, mais pas à lui seul l'accès à PostgreSQL.

## Autres commandes

```powershell
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
- `start` lance l'API compilée; pour le développement local, utilisez `dev` et `admin:dev` dans deux terminaux.
- `admin:bootstrap` crée un lien d'activation de 15 minutes pour le premier super-administrateur, uniquement si aucun administrateur ni bootstrap en attente n'existe. La commande affiche un lien secret une seule fois : exécutez-la dans un terminal privé et ne partagez pas sa sortie.
- `test` valide le schéma Prisma et exécute les tests unitaires HTTP/configuration sans connexion à PostgreSQL; `DATABASE_URL` doit néanmoins être défini dans `.env`.
- `db:generate` régénère le client Prisma après une modification du schéma.
- `test:db` applique les migrations et le seed deux fois sur `TEST_DATABASE_URL`, puis exécute les tests d'intégrité/concurrence. Il ne réinitialise pas la base et refuse un nom de base ne contenant pas `test`.
- `db:seed` est idempotent et ne crée que les catégories du catalogue.

Le seed et les commandes Prisma lisent `DATABASE_URL`. Ne lancez pas les migrations contre une base contenant des données utiles sans avoir compris leur effet. Le fichier `.env` contient des secrets locaux : ne le commitez pas et ne le transmettez pas.

## Authentification de l’administration

1. Renseignez `DATABASE_URL`, `CORS_ORIGIN`, `APP_URL`, `EMAIL_FROM` et `RESEND_API_KEY` dans `.env`. Ne partagez jamais les clés API.
2. Appliquez la migration puis générez le client Prisma : `npm run db:migrate:dev` et `npm run db:generate`.
3. Créez le compte initial avec `npm run admin:bootstrap -- admin@liena.fr`; ouvrez le lien à usage unique affiché dans le terminal.
4. Démarrez l’API avec `npm run dev`, puis l’interface dans un autre terminal avec `npm run admin:dev`.
5. Depuis la console, le super-administrateur peut inviter d’autres administrateurs, modifier leurs rôles et retirer leurs accès. Les inscriptions publiques avec privilèges sont désactivées.

Les invitations expirent après 48 heures; les liens de récupération expirent après 30 minutes et ne peuvent être utilisés qu’une fois. Une demande de récupération renvoie toujours le même message, qu’un compte existe ou non. Les mots de passe utilisent Argon2id (12 caractères minimum). Les sessions serveur sont conservées 12 heures par défaut, ou 30 jours si « Mémoriser cet appareil » est coché; le cookie de session est `HttpOnly`, `SameSite=Lax` par défaut et `Secure` en production. Les mutations exigent un jeton CSRF et l’origine configurée. Le retrait d’accès révoque immédiatement les sessions, et l’application empêche de retirer le dernier super-administrateur actif.

Les invitations et les e-mails de récupération utilisent Resend. Sans `RESEND_API_KEY`, l’interface signale que l’envoi n’est pas configuré et désactive l’envoi d’invitations. Renseignez la clé et `EMAIL_FROM` dans `.env`, puis redémarrez l’API. Le compte Resend de test n’envoie des messages qu’à l’adresse autorisée par le mode de test. Pour une livraison réelle, vérifiez un domaine dans Resend et utilisez une adresse d’expédition de ce domaine via `EMAIL_FROM`. Définissez `RESEND_API_KEY` uniquement dans l’environnement d’exécution. Le frontend utilise `http://localhost:3000/api/v1` par défaut; pour le modifier, copiez `apps/admin/.env.example` vers `apps/admin/.env.local` et adaptez `VITE_API_URL`.

Pour déployer le frontend sur une autre origine, configurez l’origine exacte de l’application dans `CORS_ORIGIN` côté API et `VITE_API_URL` dans l’environnement de build React. En production, utilisez HTTPS pour les deux. Si le frontend et l’API sont sur des sites différents, configurez `COOKIE_SAME_SITE=none` et HTTPS; l’origine exacte et le jeton CSRF restent obligatoires. Si l’API est derrière un reverse proxy, réglez `TRUST_PROXY_HOPS` sur le nombre exact de proxies de confiance (et non sur une valeur arbitraire) afin de conserver des adresses IP fiables pour les journaux et la limitation des tentatives.

La limitation de tentatives de connexion utilise actuellement le stockage mémoire du processus; pour plusieurs instances de l’API, remplacez-le par un stockage partagé avant la mise à l’échelle. L’authentification multifacteur n’est pas incluse dans cette première version et devrait être ajoutée avant une mise en production d’un espace d’administration sensible.

## API initiale

- `GET /health` vérifie la connexion PostgreSQL et renvoie `503` si la base est indisponible.
- `GET /api/v1/categories/:slug` retourne une catégorie active et ses sous-catégories actives.
- `POST /api/v1/services/search` recherche les prestations publiées de prestataires vérifiés. Le corps JSON accepte `categoryId` (UUID), `city`, `page` (1 par défaut) et `pageSize` (20 par défaut, maximum 50).
- `GET /api/v1/admin/csrf`, `POST /api/v1/admin/login`, `GET /api/v1/admin/me` et `POST /api/v1/admin/logout` assurent l’accès à l’espace admin.
- Les invitations, leur acceptation, la récupération du mot de passe et la gestion des administrateurs sont exposées sous `/api/v1/admin`; elles nécessitent les rôles et protections documentés ci-dessus.

Les erreurs ont une forme JSON stable (`error.code`, `error.message`, `requestId`). Les validations d'entrée utilisent Zod. Helmet, CORS contrôlé, limite JSON de 1 Mio et identifiant de requête sont activés.

## Architecture et règles métier

Voir :

- [Architecture de la base](./docs/database-architecture.md)
- [Dictionnaire de données](./docs/data-dictionary.md)
- [Règles métier](./docs/business-rules.md)
- [Validation et migrations](./docs/database-validation.md)

Les contrôles d'accès aux ressources et les contrôles de propriété des fonctions métier restent à implémenter dans l'API. Les contraintes SQL renforcent l'intégrité, mais ne remplacent pas ces contrôles.
