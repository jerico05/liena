# Audit technique Liena — novembre 2025

## Synthèse

| Zone | État | Commentaire |
|------|------|-------------|
| Monorepo (api / admin / mobile / shared-schemas) | **Bon** | Mobile = bibliothèque Yeria consommée par l’API |
| Prisma / Neon | **Bon** | Migrations présentes ; seed documenté |
| Parcours Yeria | **Bon** | Routes trail + racine (`/cat-*`, `/map`, recherche GPS) |
| Admin | **Bon** | React + API `/api/v1/admin` |
| Netlify | **À finaliser** | `netlify.toml` + function OK ; variables prod à renseigner |
| Packages `shared-types` / `shared-utils` | **Supprimés** | Anciens placeholders vides |
| Tests | **Partiels** | `yeria-screens` OK ; HTTP/Prisma nécessitent `TEST_DATABASE_URL` |
| Secrets | **Attention** | Ne jamais committer `.env`, `service_private.pem` |

---

## Architecture

```
backend/api   → Express 5, Prisma, Yeria, admin JSON, Cloudinary
backend/mobile → Vues Yeria (build → dist, pas de serveur)
apps/admin    → SPA Vite (Netlify publish)
packages/shared-schemas → Zod, formulaires, géo
prisma/       → PostgreSQL (Neon en prod)
netlify/      → Function serverless (Express wrap)
```

**Point critique déploiement :** `npm run build` doit inclure **mobile puis api** (déjà dans le script racine).

---

## Sécurité

- Auth admin : session cookie, mot de passe ≥ 12 caractères en `NODE_ENV=production`
- API utilisateurs : JWT Yeria (`authenticate`)
- Clés Ed25519 : préférer `SERVICE_ED25519_PRIVATE_KEY` sur Netlify (pas de PEM dans le repo)
- CORS / `APP_URL` / `PUBLIC_API_URL` alignés HTTPS en prod
- `TRUST_PROXY_HOPS=1` derrière Netlify / ngrok

---

## Dette / risques

1. **Netlify serverless** : cold start, timeout, taille bundle Prisma — acceptable MVP, limite si trafic Yeria fort
2. **Redirect catch-all** `/*` → SPA : les routes Yeria sont listées *avant* dans `netlify.toml` — à surveiller si nouvelles routes racine
3. **`.env`** : présent en local ; bien exclus par `.gitignore`
4. **`service_public.pem`** : peut être versionné ou en variable ; **privée jamais**
5. **Branch git** : beaucoup de fichiers non commités (Yeria, assets, migrations) — **commit + push avant Netlify fiable**

---

## Fichiers / dossiers traités lors du nettoyage

| Action | Élément |
|--------|---------|
| Supprimé | Doublon `Liste des écrans.pdf` à la racine (copie dans `docs/architecture/product/`) |
| `.gitignore` | `apps/mobile/dist/`, `skills-lock.json` |
| Dossiers | Suppression des répertoires placeholder (`.gitkeep` seuls) sous `mobile`, `admin`, `api` |

## Recommandations avant déploiement Netlify

1. `git add` / commit de tout le code Yeria, `apps/api/assets`, migrations, `docs/deploy`
2. Variables Netlify (voir `docs/deploy/netlify-deux-sites.md`)
4. `npm run db:migrate:deploy` sur Neon
5. Rebuild admin sur Netlify avec `VITE_API_URL=/api/v1`
6. Tests : `npm run test:unit` avec `TEST_DATABASE_URL` pour suite complète

---

## Commandes de validation

```powershell
npm run db:validate
npm run build
npm run test:unit --workspace @liena/api
curl https://VOTRE-SITE.netlify.app/health
curl https://VOTRE-SITE.netlify.app/screens/home
```