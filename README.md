# Liena

Liena est un monorepo pour l’API Express, la console d’administration et l’application mobile Yeria.

| App | État |
|---|---|
| `apps/api` | API Express (Yeria + `/api/v1`) |
| `apps/mobile` | Vues Yeria (`@liena/mobile`, compilées dans l’API) |
| `apps/admin` | Console React de supervision et modération des prestataires |
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

Variables séparées : **`apps/api/.env`** (base, Yeria, `ADMIN_USERNAME` / `ADMIN_PASSWORD`, CORS) et **`apps/admin/.env.local`** (`VITE_API_URL`). Voir [docs/deploy/env-par-site.md](./docs/deploy/env-par-site.md).

Démarre l’API et l’admin dans deux terminaux :

```powershell
npm run dev:api       # http://localhost:3000
```

```powershell
npm run dev:admin     # http://localhost:5173
```

Ouvre <http://localhost:5173> et connecte-toi avec `ADMIN_USERNAME` et `ADMIN_PASSWORD`. L’admin lit les prestataires et le tableau de bord depuis PostgreSQL (`DATABASE_URL`).

`DATABASE_URL` est l’URL poolée utilisée par l’API. `DATABASE_URL_UNPOOLED` est l’URL directe pour Prisma Migrate et le seed. Ne commite jamais `apps/api/.env` ni `apps/admin/.env.local`.

Avant toute migration distante, vérifie la branche Neon sélectionnée. Les migrations sont d’abord validées en développement; aucune migration de production n’est automatique.

## API Yeria

L’API expose les catégories et profils actifs, ainsi que les routes de profil prestataire et de demandes client/prestataire. Les routes personnelles exigent un jeton Bearer Yeria; le `sub` vérifié sert d’identité et n’est jamais accepté depuis le corps de la requête.

Les **vues Yeria** sont dans `apps/mobile`, servies par `apps/api` sous **`GET/POST /screens/*`**. Déploiement : [docs/deploy/netlify-deux-sites.md](./docs/deploy/netlify-deux-sites.md).

### Tester avec Yeria + ngrok (local)

1. `npm run dev:api` (port 3000).
2. Crée un domaine sur [ngrok Domains](https://dashboard.ngrok.com/domains), puis `NGROK_TUNNEL_URL=https://....` dans `apps/api/.env`.
3. `npm run tunnel:ngrok -- -Force` (relance un tunnel propre sur ton compte).
4. Copier la même URL dans `APP_URL` et `PUBLIC_API_URL`, et `TRUST_PROXY_HOPS=1`.
4. Console fournisseur [Yeria](https://yeria.app/providers) : URL du service = cette URL ngrok ; écran d’entrée = `/screens/home`.
5. Garder `YERIA_BASE_URL=https://yeria.app` (plateforme Yeria, pas l’URL ngrok de ton API).

Pour l’intégration Yeria : place `service_private.pem` et `service_public.pem` à la racine (voir [docs/api/yeria-config.md](./docs/api/yeria-config.md)), puis `YERIA_APP_ID`, `YERIA_SERVICE_ID` et `YERIA_BASE_URL=https://yeria.app` dans `.env`. La clé publique s’enregistre dans la console Yeria ; la privée reste locale et n’est jamais commitée. Sans identité ou sans clé privée, les routes protégées ou `/screens/*` renvoient une erreur de configuration.

Les nouveaux profils sont créés en `DRAFT`, puis soumis à la modération pour passer à `PENDING`. Le parcours utilise les catégories, statuts et identifiants entiers du schéma Jyoss; il n’ajoute pas de migration.

## Netlify (2 sites recommandé)

| Site | Config | Rôle |
|------|--------|------|
| **Admin** | `netlify/admin.toml` | SPA uniquement ; `VITE_API_URL` = URL de l’API |
| **Backend** | `netlify/backend.toml` | API + Yeria (`@liena/mobile` compilé dans la function) |

Guide pas à pas : [docs/deploy/netlify-deux-sites.md](./docs/deploy/netlify-deux-sites.md).

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
