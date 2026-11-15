# Backend Liena

Regroupe **API Express** (`api/`) et **vues Yeria** (`mobile/` = `@liena/mobile`, bibliothèque compilée dans l’API).

| Dossier | Package npm | Rôle |
|---------|-------------|------|
| `api/` | `@liena/api` | HTTP : Yeria, `/api/v1`, admin JSON |
| `mobile/` | `@liena/mobile` | Vues signées (grilles, formulaires, carte) |

## Commandes (depuis la racine du monorepo)

```powershell
npm run dev:api
npm run build:mobile
npm run build:api
npm run test:unit --workspace @liena/api
```

## Déploiement

Déploiement typique : site Netlify avec `netlify/backend.toml` (voir [docs/deploy/netlify-deux-sites.md](../docs/deploy/netlify-deux-sites.md)).

**Yeria** : URL du service = l’URL publique du déploiement de **`backend/api`** (pas de site séparé pour `mobile`).