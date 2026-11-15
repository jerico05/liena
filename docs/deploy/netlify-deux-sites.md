# Netlify — 2 sites (admin + backend)

Même dépôt Git, **deux projets Netlify**. Base de données : **Neon** ; dev local : `npm run dev:api` / `npm run dev:admin`.

## Schéma

```
┌─────────────────────────┐     HTTPS      ┌──────────────────────────┐
│  Site A — Admin         │ ──────────────►│  Site B — Backend        │
│  liena-admin.netlify…   │  /api/v1/admin │  liena-api.netlify…      │
│  SPA React              │                │  Function Express        │
└─────────────────────────┘                │  + @liena/mobile (Yeria) │
                                           └───────────┬──────────────┘
                                                       │
                              App Yeria ◄──────────────┘
                              URL service = Site B (racine)
```

| Site | Fichier config | Build | Publish |
|------|----------------|-------|---------|
| **Admin** | `netlify/admin.toml` | `npm run build:admin` | `apps/admin/dist` |
| **Backend** | `netlify/backend.toml` | `backend/mobile` + `backend/api` + `db:generate` | `public/netlify-backend` + function |

Arborescence : **`backend/api`** + **`backend/mobile`** (tu gères le déploiement du site backend).

Dans chaque site Netlify : **Project configuration → Build & deploy → Build settings → Configuration file**.

---

## Site A — Admin (existant)

1. **Configuration file** : `netlify/admin.toml` (ou laisser `netlify.toml` racine, équivalent admin seul).
2. **Variable de build** (obligatoire) :

   | Variable | Exemple |
   |----------|---------|
   | `VITE_API_URL` | `https://liena-api.netlify.app/api/v1` |

3. **Pas** de Netlify Functions sur ce site.
4. Redéployer (**Clear cache**) après avoir défini `VITE_API_URL`.

Les appels admin partent vers le **site B** ; cookies admin restent sur le site A.

---

## Site B — Backend (API + Yeria)

1. **Add new site** → même repo Git.
2. **Configuration file** : `netlify/backend.toml`.
3. **Variables** (production) :

   | Variable | Rôle |
   |----------|------|
   | `DATABASE_URL` | Neon (pooler) |
   | `NODE_ENV` | `production` |
   | `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Auth admin (API `/api/v1/admin`) |
   | `APP_URL` | `https://liena-api.netlify.app` |
   | `PUBLIC_API_URL` | idem (Yeria) |
   | `CORS_ORIGIN` | **`https://liena-admin.netlify.app`** (site A, sans slash) |
   | `TRUST_PROXY_HOPS` | `1` |
   | `YERIA_*`, `SERVICE_ED25519_PRIVATE_KEY` | Yeria |
   | `CLOUDINARY_*` | Prod obligatoire |

4. Migrations (local, une fois) : `npm run db:migrate:deploy` avec `DATABASE_URL` Neon.

5. **Console Yeria** : URL du service = **site B** uniquement (`https://liena-api…`).

6. Vérifier :

   - `https://liena-api…/health`
   - `https://liena-api…/screens/home`
   - Admin sur site A : connexion + liste prestataires

---

## CORS (important)

Le backend n’accepte qu’**une** origine (`CORS_ORIGIN`) = URL exacte du site admin (schéma + host, sans chemin). Si l’admin change de domaine custom, mettre à jour **site B**.

---

## Dev local + Yeria

- `npm run dev:api`, `npm run dev:admin`
- Tunnel ngrok : `npm run tunnel:ngrok` (voir [docs/api/yeria-config.md](../api/yeria-config.md))

---

## Checklist rapide

- [ ] Site A : `VITE_API_URL` → API site B  
- [ ] Site B : `CORS_ORIGIN` → admin site A  
- [ ] Site B : `PUBLIC_API_URL` = URL site B  
- [ ] Yeria : URL = site B  
- [ ] Neon migré  
- [ ] Deux deploys **Clear cache**