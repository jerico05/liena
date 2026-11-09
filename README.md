# Liena

Liena est un monorepo pour l’API Express, la console d’administration et l’application mobile Yeria.

| App | État |
|---|---|
| `apps/api` | API Express avec authentification locale de l’administration et accès Prisma |
| `apps/admin` | Console React de supervision et modération des prestataires |
| `apps/mobile` | Squelette d’intégration Yeria |
| `prisma` | Modèle MVP PostgreSQL et migrations |

## Développement local

Prérequis : Node.js 20.19+ et npm. Pour utiliser Neon, le dépôt doit être lié au projet avant le checkout de sa branche de développement.

```powershell
npm install
Copy-Item .env.example .env
neon checkout dev
npm run db:generate
npm run db:migrate:deploy
npm run db:seed
```

Dans `.env`, configure `ADMIN_USERNAME` et `ADMIN_PASSWORD` pour l’accès à la console. L’authentification admin est locale à l’application; Neon fournit la base de données, pas les identifiants d’administration.

Démarre l’API et l’admin dans deux terminaux :

```powershell
npm run dev:api       # http://localhost:3000
```

```powershell
npm run dev:admin     # http://localhost:5173
```

Ouvre <http://localhost:5173> et connecte-toi avec `ADMIN_USERNAME` et `ADMIN_PASSWORD`. En développement, `ADMIN_MOCK_DATA` vaut `true` par défaut. Pour lire les données de Neon `dev`, définis `ADMIN_MOCK_DATA=false` dans `.env`.

`DATABASE_URL` est l’URL poolée utilisée par l’API. `DATABASE_URL_UNPOOLED` est l’URL directe pour Prisma Migrate et le seed. Ne commite jamais `.env`.

Avant toute migration distante, vérifie la branche Neon sélectionnée. Les migrations sont d’abord validées en développement; aucune migration de production n’est automatique.

## API Yeria

L’API expose les catégories et profils actifs, ainsi que les routes de profil prestataire et de demandes client/prestataire. Les routes personnelles exigent un jeton Bearer Yeria; le `sub` vérifié sert d’identité et n’est jamais accepté depuis le corps de la requête.

Pour activer l’authentification réelle, configure `YERIA_APP_ID` et `YERIA_SERVICE_ID` dans `.env`. `YERIA_BASE_URL` utilise par défaut `https://yeria.app`; `YERIA_DEV_KEY_ID` et `SERVICE_ED25519_PRIVATE_KEY` sont optionnels et ne doivent pas être partagés ni commités. Sans identifiants Yeria, les routes protégées répondent avec une erreur de configuration au lieu d’accepter une identité non vérifiée.

Les nouveaux profils sont créés en `DRAFT`, puis soumis à la modération pour passer à `PENDING`. Le parcours utilise les catégories, statuts et identifiants entiers du schéma Jyoss; il n’ajoute pas de migration.

## Netlify

Netlify publie l’interface d’administration et route `/api/*` vers une Function qui charge l’application `apps/api`. Configure les variables d’environnement côté Netlify : `DATABASE_URL` (URL poolée Neon), `ADMIN_USERNAME`, `ADMIN_PASSWORD` (au moins 12 caractères en production), ainsi que les valeurs de messagerie si elles sont utilisées. `DATABASE_URL_UNPOOLED` sert uniquement aux opérations Prisma et ne doit pas être exposée au client.

La variable de build `DATABASE_URL_UNPOOLED` de `netlify.toml` est une URL locale factice utilisée par Prisma pour générer le client; la compilation ne s’y connecte pas. Ne remplace pas cette valeur par un secret. Aucune migration distante n’est exécutée par le build Netlify.

## Commandes utiles

```powershell
npm run db:validate
npm run db:generate
npm run db:migrate:dev -- --name <nom>
npm run db:migrate:deploy
npm run db:seed
npm test
npm run build
```

`npm run test:db` exige `TEST_DATABASE_URL` vers une base dédiée dont le nom contient `test`; le script refuse de l’exécuter contre la base de l’application.

## Documentation

- [Architecture de la base](./docs/architecture/database-architecture.md)
- [Dictionnaire de données](./docs/architecture/data-dictionary.md)
- [Migrations et validation](./docs/architecture/database-validation.md)
- [Règles métier](./docs/architecture/business-rules.md)
- [Structure fullstack](./docs/architecture/fullstack-structure.md)
