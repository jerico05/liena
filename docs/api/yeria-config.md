# Configuration Yeria (Liena)

Référence : [documentation Yeria](https://yeria.app/docs/) — intégration provider, clés Ed25519, `YeriaApp` / `YeriaUI`.

## Fichiers de clés (recommandé)

À la **racine du dépôt** (hors git pour la clé privée) :

| Fichier | Rôle |
| -------- | ------ |
| `service_private.pem` | Clé **privée** du service — signe les vues (`app.serve`) et les réponses signées |
| `service_public.pem` | Clé **publique** — à enregistrer dans la [console fournisseur Yeria](https://yeria.app/providers) |

Chemins par défaut dans `.env` :

```env
YERIA_SERVICE_PRIVATE_KEY_PATH=service_private.pem
YERIA_SERVICE_PUBLIC_KEY_PATH=service_public.pem
```

L’API lit ces fichiers au démarrage. **Ne mets pas la clé privée en ligne dans `.env`** (multiligne fragile et risque de fuite).

**Netlify (obligatoire)** : les fichiers PEM ne sont pas déployés. Définir `SERVICE_ED25519_PRIVATE_KEY` (et optionnellement `SERVICE_ED25519_PUBLIC_KEY`) dans l’UI Netlify :

- éditeur **multiligne** (recommandé), ou
- une seule ligne avec `\n` entre les lignes, ou
- une seule ligne **sans** retours (`-----BEGIN…-----MC4…-----END…-----`) — l’API normalise au chargement.

Si les vues (`/`, `/screens/home`) renvoient **500**, vérifier les logs function : erreur du type *public key can’t be parsed* → re-coller la clé ou redeploy après mise à jour du code de normalisation.

En local : `SERVICE_ED25519_PRIVATE_KEY` / `SERVICE_ED25519_PUBLIC_KEY` en une seule ligne, **ou** fichiers PEM à la racine.

## Variables `.env`

| Variable | Description |
| -------- | ------------- |
| `YERIA_BASE_URL` | API plateforme Yeria — **`https://yeria.app`** (pas l’URL ngrok de ton API) |
| `YERIA_APP_ID` | Identifiant d’application (`appId` du SDK) |
| `YERIA_SERVICE_ID` | Identifiant du service chez Yeria (`serviceId`) |
| `YERIA_DEV_KEY_ID` | Optionnel — clé de développement `devkey_...` pour tests sur appareil |
| `APP_URL` / `PUBLIC_API_URL` | URL HTTPS publique du backend (ex. ngrok) enregistrée comme URL du service |
| `TRUST_PROXY_HOPS` | `1` derrière ngrok |

## Console Yeria

1. **URL du service** : base HTTPS de ton API (ex. `https://liena-backend.netlify.app` ou `https://liena-backend.netlify.app/` si l’UI impose un `/` final — les deux conviennent côté chemin).
2. **Clé publique** : contenu de `service_public.pem` (Ed25519).
3. **Écran d’entrée** : `screens/home` ou `/screens/home` (sans répéter le host dans l’URL du service). Yeria appellera en pratique **`https://…/screens/home`**.
4. Si tu **ne peux pas** définir l’écran d’entrée (seulement l’URL avec `/`) : l’API sert **la même vue d’accueil** sur `GET /` et sur `GET /screens/home`.
5. Sur Netlify, aligne **`PUBLIC_API_URL`** / **`APP_URL`** sur la même base que la console (avec ou sans `/` final, mais **cohérent**).
6. Dans **Accès**, invite ton compte Yeria pour *Mes services privés*.

## Routes

- Vues signées : `GET` / `POST` **`/screens/*`**
- Actions ActionList / ActionGrid : l’app appelle **`{urlCourante}/{codeAction}`** (pas le champ `url` du SDK si `code` est défini). L’URL **s’empile** à chaque clic (ex. Parcourir depuis `/screens/home` → `/screens/home/browse`, puis métier → `/screens/home/browse/cat-1`, etc.). L’API accepte ces chemins **profonds** via les routes `/{*trail}` (`browse`, `categories`, `home/browse`, `search/services`, …).
  - Accueil → Parcourir → `GET /screens/home/browse` (ou `GET /browse`)
  - Métier → `GET …/cat-1` (souvent à la **racine** du service : `GET /cat-1`, pas seulement sous `/screens/categories`)
  - Service → `GET …/cat-1/service-1`
  - Fiche prestataire → `GET …/provider-2`
- **FormView** : le POST part vers **l’URL qui a servi l’écran** (ex. `POST /become-provider`, pas seulement `/screens/provider/onboarding`) — candidature prestataire avec jeton Bearer Yeria
- API JSON : **`/api/v1/*`** (catégories, prestataires, demandes — Bearer Yeria)

## Tunnel ngrok (compte)

1. Crée un domaine sur [dashboard.ngrok.com/domains](https://dashboard.ngrok.com/domains) (ou réutilise un domaine existant).
2. Dans `.env` : `NGROK_TUNNEL_URL=https://ton-domaine.ngrok-free.dev` puis `APP_URL` et `PUBLIC_API_URL` avec la **même** URL.
3. Lance :
   ```powershell
   npm run tunnel:ngrok -- -Force
   ```
   Ou sans `.env` :
   ```powershell
   npm run tunnel:ngrok -- -Url https://ton-domaine.ngrok-free.dev -Force
   ```
4. Mets à jour l’URL du service dans la console Yeria.

`-Force` arrête l’ancien processus `ngrok` avant d’en ouvrir un nouveau.  
Si **ERR_NGROK_334** : le domaine est déjà actif ailleurs — choisis un **autre** domaine du compte ou ferme l’autre session.

## Carte

1. `GET /screens/map` — formulaire GPS (obligatoire)
2. `POST /screens/map` — carte centrée sur le client avec les prestataires ayant `location_lat` / `location_lon` en base
3. Clic sur un marqueur → fiche prestataire

## Recherche client

Écran **Rechercher** (`/screens/search`) :

- **Ville ou quartier** (optionnel) — filtre texte sur la zone d’intervention des prestataires
- **Métier** (liste déroulante obligatoire)
- **Position GPS** (obligatoire) — classifie les résultats du plus proche au plus loin

Soumission `POST /screens/search` → liste des prestataires du métier (`liena-provider-results`) ou message « Pas de prestataires disponibles » → fiche prestataire → demande de service.

## Netlify (site backend)

| Variable | Rôle |
|----------|------|
| `PUBLIC_API_URL` / `APP_URL` | Même base que l’URL du service Yeria |
| `YERIA_BASE_URL` | `https://yeria.app` |
| `YERIA_APP_ID` / `YERIA_SERVICE_ID` | Console fournisseur |
| `SERVICE_ED25519_PRIVATE_KEY` | PEM complet (obligatoire) |
| `YERIA_DEV_KEY_ID` | Optionnel (tests appareil) |

Ne pas compter sur `YERIA_SERVICE_PRIVATE_KEY_PATH` en prod (fichier absent).

## Vérification locale

```powershell
npm run dev:api
# Clé chargée si service_private.pem existe à la racine
```

Sans clé privée, `/screens/*` répond `YERIA_NOT_CONFIGURED` ; sans `YERIA_APP_ID` / `YERIA_SERVICE_ID`, l’auth Bearer répond pareil.
