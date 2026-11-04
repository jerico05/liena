# Liena — monorepo fullstack

Référence : [docs/architecture/fullstack-structure.md](./docs/architecture/fullstack-structure.md).

| App | État |
|-----|------|
| `apps/api` | **Squelette** (dossiers Express vides) |
| `apps/admin` | Interface React opérationnelle |
| `apps/mobile` | **Squelette** Yeria (dossiers vides) |
| `packages/*` | Stubs partagés |
| `prisma/` | Schéma PostgreSQL |

## Commandes

```powershell
npm install
copy .env.example .env
npm run db:generate
npm run dev:admin      # http://localhost:5173
npm run build
npm run test           # prisma validate
```

L’admin nécessite une API sur le port 3000 : à réimplémenter dans `apps/api` (`app.ts`, `server.ts`).

## Documentation

- [Architecture fullstack](./docs/architecture/fullstack-structure.md)
- [Règles métier](./docs/architecture/business-rules.md)
- [Base de données](./docs/architecture/database-architecture.md)
- [Product / PDF](./docs/architecture/product/)
