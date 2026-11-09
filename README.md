# Liena — monorepo fullstack

Référence : [docs/architecture/fullstack-structure.md](./docs/architecture/fullstack-structure.md).

| App | État |
|-----|------|
| `apps/api` | API Express avec authentification locale de l'administration et accès Prisma |
| `apps/admin` | Interface React opérationnelle |
| `apps/mobile` | **Squelette** Yeria (dossiers vides) |
| `packages/*` | Stubs partagés |
| `prisma/` | Modèle MVP PostgreSQL et migrations Prisma |

## Commandes

```powershell
npm install
copy .env.example .env
neon checkout dev
npm run db:generate
npm run db:migrate:deploy
npm run db:seed
npm run dev:admin      # http://localhost:5173
npm run dev:api        # http://localhost:3000
npm run build
npm test
```

`DATABASE_URL` sert aux connexions de l’API ; `DATABASE_URL_UNPOOLED` sert aux migrations Prisma. Pour Neon, utilise l’URL pooled pour `DATABASE_URL` et l’URL directe pour `DATABASE_URL_UNPOOLED`. Garde les variables de connexion dans `.env`, jamais dans Git.

Le projet doit être lié à Neon avant `neon checkout dev`. Cette commande sélectionne la branche de développement et récupère ses variables d’environnement. Vérifie toujours la branche active avant une migration; ne déploie pas vers `production` sans validation explicite.

`npm run test:db` exige un `TEST_DATABASE_URL` distinct, vers une base dédiée dont le nom contient `test`; ce script applique les migrations et vérifie que le seed est idempotent.

## Connexion à l’administration

Lance l’API et l’interface dans deux terminaux :

```powershell
npm run dev:api
```

```powershell
npm run dev:admin
```

Ouvre ensuite <http://localhost:5173>. Connecte-toi avec `ADMIN_USERNAME` et `ADMIN_PASSWORD` configurés dans le `.env` local. Ce compte d’administration est indépendant de Yeria et de Neon; Neon ne fournit ici que la base de données. Si ces variables ne sont pas définies, ajoute tes propres valeurs dans `.env` (ne les committe pas).

En développement, `ADMIN_MOCK_DATA` vaut `true` par défaut. Pour que l’administration lise les données de la branche Neon `dev`, définis `ADMIN_MOCK_DATA=false` dans `.env`. Le tableau peut alors être vide jusqu’à ce que des prestataires soient créés.

## Documentation

- [Architecture fullstack](./docs/architecture/fullstack-structure.md)
- [Architecture de la base](./docs/architecture/database-architecture.md)
- [Dictionnaire de données](./docs/architecture/data-dictionary.md)
- [Migrations et validation](./docs/architecture/database-validation.md)
- [Product / PDF](./docs/architecture/product/)
