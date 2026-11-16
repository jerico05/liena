# Netlify — 2 sites (admin + backend)

Même dépôt Git, **deux projets Netlify**. Base de données : **Neon** ; dev local : `npm run dev:api` / `npm run dev:admin`. Variables : [env-par-site.md](./env-par-site.md).

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
| **Backend** | `netlify/backend.toml` | `apps/mobile` + `apps/api` + `db:generate` | `public/netlify-backend` + function |

Dans chaque site Netlify : **Project configuration → Build & deploy → Build settings → Configuration file**.

> **Piège** : Netlify **fusionne** `netlify.toml` (racine) + le fichier indiqué dans l’UI. Un `[build]` admin à la racine forçait `build:admin` même avec `backend.toml` — la racine n’a plus de `[build]`.
>
> Sur le site backend : **Configuration file** = `netlify/backend.toml`, **Functions** = `netlify/functions`. Si la commande admin persiste, ouvre **Build settings** et supprime la **surcharge** du build command dans l’UI (laisser le fichier de config décider).

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

4. **Build command** (UI) : suivre `netlify/backend.toml`, ou  
   `npm install && npm run db:generate && npm run build:mobile && npm run build:api`  
   (éviter `npm ci` si le lockfile est généré sous Windows — optional deps Linux manquantes).

5. Migrations (local, une fois) : `npm run db:migrate:deploy` avec `DATABASE_URL` Neon.

6. **Console Yeria** : URL du service = **site B** uniquement (`https://liena-api…`).

7. Vérifier :

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