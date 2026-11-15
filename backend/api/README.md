# @liena/api

Backend Express (TypeScript). Référence : [fullstack-structure.md](../../docs/architecture/fullstack-structure.md).

## Structure `src/`

```
config/           env, database (Prisma), yeria (mobile)
middlewares/      errorHandler, requestId, validateRequest, authenticate, authorize
modules/
  admin/          Console admin (implémenté)
  categories/     squelette
  providers/      squelette
  clients/        squelette
  service-requests/ squelette
types/            express.d.ts
app.ts
server.ts
```

Variables d’environnement : `.env` à la **racine** du monorepo (`.env.example`).  
Clés Yeria (PEM) : [docs/api/yeria-config.md](../../docs/api/yeria-config.md).
