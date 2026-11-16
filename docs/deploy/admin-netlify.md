# Redéployer l’admin (connexion à l’API)

L’admin et l’API sont **deux sites Netlify distincts**. L’admin appelle l’API en cross-origin avec cookies — les deux côtés doivent être alignés.

## 1. Site **backend** (`liena-backend.netlify.app` ou équivalent)

Variables **obligatoires** (déjà en place pour Yeria + Neon) :

| Variable | Valeur |
|----------|--------|
| `PUBLIC_API_URL` / `APP_URL` | `https://VOTRE-BACKEND.netlify.app` |
| `CORS_ORIGIN` | **`https://VOTRE-ADMIN.netlify.app`** (origine seule, **sans** `/` final) |
| `COOKIE_SAME_SITE` | `none` (si admin et backend sont des domaines différents ; sinon la function peut l’inférer quand `CORS_ORIGIN` ≠ URL backend) |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Identifiants console admin |

Vérifier : depuis le navigateur, ouvrir  
`https://VOTRE-BACKEND.netlify.app/api/v1/admin/csrf`  
→ doit répondre (souvent 401 sans cookie, pas une erreur CORS).

## 2. Site **admin** (nouveau ou existant)

| Réglage | Valeur |
|---------|--------|
| **Configuration file** | `netlify/admin.toml` |
| **Build command** | `npm run build:netlify-admin` (ou laisser le fichier décider) |
| **Publish** | `apps/admin/dist` |
| **Functions** | vide / par défaut (**pas** de functions sur l’admin) |

### Variable de build (critique)

| Variable | Exemple |
|----------|---------|
| `VITE_API_URL` | `https://liena-backend.netlify.app/api/v1` |

Sans slash final après `v1`. **Injectée au build Vite** : toute modification exige un **nouveau build + deploy** (Clear cache).

Local : `apps/admin/.env.local` avec la même URL pour tester.

## 3. Ordre recommandé

1. Backend déployé et `/health` OK.
2. `CORS_ORIGIN` = URL exacte de l’admin sur le **site backend**.
3. Sur le **site admin** : définir `VITE_API_URL`, puis **Clear cache and deploy**.
4. Ouvrir l’admin → connexion avec `ADMIN_USERNAME` / `ADMIN_PASSWORD`.

## 4. Build Vite (Netlify)

L’admin utilise `cssMinify: "esbuild"` pour éviter les binaires `lightningcss` manquants sur Linux. Utiliser `npm run build:netlify-admin` (contient `npm install`, pas `npm ci`).

## 5. Dépannage

| Symptôme | Cause probable | Action |
|----------|----------------|--------|
| « API injoignable » | `VITE_API_URL` manquant ou localhost au build | Rebuild admin avec `VITE_API_URL` |
| CORS dans la console | `CORS_ORIGIN` ≠ URL admin | Corriger sur **backend**, redeploy backend |
| Login puis 403 CSRF | `COOKIE_SAME_SITE=lax` avec 2 domaines | `COOKIE_SAME_SITE=none` sur backend |
| 502 function | API backend | Logs function `api` sur le site backend |

## 6. URLs d’exemple (à adapter)

- Backend : `https://liena-backend.netlify.app`
- Admin : `https://liena-admin.netlify.app`
- `VITE_API_URL` : `https://liena-backend.netlify.app/api/v1`
- `CORS_ORIGIN` : `https://liena-admin.netlify.app`