# Déploiement Render (API) + Vercel (admin)

Même dépôt Git, **deux hébergeurs** : le backend tourne comme **service Web Node** (pas de Netlify Functions), l’admin reste une **SPA statique**.

## Schéma

```
┌─────────────────────────┐     HTTPS      ┌──────────────────────────┐
│  Vercel — Admin         │ ──────────────►│  Render — Web Service    │
│  *.vercel.app           │  /api/v1/admin │  liena-api.onrender.com  │
│  SPA React (Vite)       │                │  node dist/server.js    │
└─────────────────────────┘                │  + Yeria + Neon         │
                                           └───────────┬──────────────┘
                                                       │
                              App Yeria ◄──────────────┘
                              URL service = Render (racine)
```

---

## 1. Backend — Render

### Création du service

1. [Render](https://render.com) → **New** → **Web Service** (ou **Blueprint** avec `render.yaml` à la racine).
2. Repo Git connecté, branche de prod.
3. **Runtime** : Node.
4. **Build command** : `npm install && npm run build:render`
5. **Start command** : `npm run start --workspace @liena/api`
6. **Health check path** : `/health`

Render injecte **`PORT`** : l’API écoute déjà `process.env.PORT` via `config/env.ts`.

### Variables d’environnement (Render → Environment)

| Variable | Notes |
|----------|--------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Neon **poolée** (`…-pooler…`) |
| `TRUST_PROXY_HOPS` | `1` |
| `PUBLIC_API_URL` / `APP_URL` | `https://VOTRE-SERVICE.onrender.com` (sans slash final) |
| `CORS_ORIGIN` | URL **exacte** de l’admin Vercel, ex. `https://liena-admin.vercel.app` |
| `COOKIE_SAME_SITE` | `none` si admin ≠ backend (HTTPS partout) |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Mot de passe **≥ 12** caractères en prod |
| `YERIA_BASE_URL` | `https://yeria.app` |
| `YERIA_APP_ID` / `YERIA_SERVICE_ID` | Console Yeria |
| `SERVICE_ED25519_PRIVATE_KEY` | PEM complet (multiligne ou une ligne — normalisé au chargement) |
| `CLOUDINARY_*` | Obligatoires en prod |

Pas de `sync-netlify-env` : tout passe par les variables Render.

### Console Yeria

- **URL du service** : `https://VOTRE-SERVICE.onrender.com`
- **Écran d’entrée** : `screens/home` (ou `GET /` équivalent)
- Clé publique : `service_public.pem`

### Vérifications

```bash
curl https://VOTRE-SERVICE.onrender.com/health
curl https://VOTRE-SERVICE.onrender.com/api/v1/categories
curl https://VOTRE-SERVICE.onrender.com/screens/home
```

Plan gratuit Render : **cold start** possible (~30–60 s) après inactivité.

### Migrations Neon

Toujours en local :

```bash
npm run db:migrate:deploy
```

(`DATABASE_URL_UNPOOLED` dans `.env`.)

---

## 2. Admin — Vercel

### Projet Vercel

1. **New Project** → même repo.
2. **Root Directory** : `apps/admin` (Vercel détecte `vercel.json`).
3. **Environment variables** (Production) :

| Variable | Valeur |
|----------|--------|
| `VITE_API_URL` | `https://VOTRE-SERVICE.onrender.com/api/v1` |

Pas de slash final après `v1`. **Redeploy** après chaque changement.

### Fichier `apps/admin/vercel.json`

- Installe les dépendances à la **racine** du monorepo.
- Build : `npm run build --workspace @liena/admin`
- **Rewrites** SPA → `index.html`

### Aligner CORS sur Render

Dès que Vercel attribue l’URL (ex. `https://liena-admin.vercel.app`), mets **exactement** cette origine dans **`CORS_ORIGIN`** sur Render et redeploy l’API.

Preview Vercel (`*.vercel.app` avec hash) : origine différente → soit tester uniquement sur le domaine prod, soit ajouter l’origine preview (CORS ne accepte qu’**une** origine dans Liena aujourd’hui).

---

## 3. Checklist migration Netlify → Render/Vercel

| Étape | Action |
|-------|--------|
| 1 | Créer service Render, copier les variables depuis Netlify (sauf Netlify-spécifique) |
| 2 | `PUBLIC_API_URL` = URL Render |
| 3 | Tester `/health`, `/screens/home`, `/api/v1/admin/csrf` |
| 4 | Créer projet Vercel admin, `VITE_API_URL` = `https://…onrender.com/api/v1` |
| 5 | `CORS_ORIGIN` = URL Vercel admin |
| 6 | Mettre à jour URL service dans **console Yeria** |
| 7 | Désactiver / supprimer les sites Netlify quand tout est validé |

---

## 4. Netlify (legacy)

Les fichiers `netlify/*` restent dans le dépôt si tu gardes un environnement de secours. Production recommandée : **Render + Vercel** + doc [yeria-config.md](../api/yeria-config.md).