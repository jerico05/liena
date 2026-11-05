# Liena

## Lancer l'application en local sans Docker

Prérequis : Node.js 20.19+ et PostgreSQL installé et démarré. Depuis la racine du dépôt, dans PowerShell :

```powershell
# Créer la base si elle n'existe pas encore
createdb liena_dev

# Installer les dépendances et créer la configuration locale
npm install
Copy-Item .env.example .env
notepad .env
```

Dans `.env`, vérifiez que `DATABASE_URL` pointe vers votre base PostgreSQL locale et que `CORS_ORIGIN` vaut `http://localhost:5173`. Puis préparez le schéma :

```powershell
npm run db:generate
npm run db:migrate:deploy
```

Lancez l'API et l'interface dans deux terminaux PowerShell distincts, depuis la racine du dépôt :

```powershell
# Terminal 1 : API sur http://localhost:3000
npm run dev
```

```powershell
# Terminal 2 : interface sur http://localhost:5173
npm run admin:dev
```

Ouvrez [http://localhost:5173](http://localhost:5173). Pour créer le premier compte administrateur local, utilisez un autre terminal :

```powershell
npm run admin:bootstrap -- votre-adresse@example.com
```

## Lancer l'application avec Docker

Prérequis : Docker Desktop avec Docker Compose v2. Depuis la racine du dépôt, dans PowerShell :

```powershell
# Créer la configuration locale et remplacer POSTGRES_PASSWORD par un mot de passe long
# composé de lettres et de chiffres. Ne partagez pas et ne commitez pas ce fichier.
Copy-Item .env.docker.example .env.docker
notepad .env.docker

# Construire les images et démarrer la base, l'API et l'interface
docker compose --env-file .env.docker up --build -d

# Vérifier le démarrage
docker compose --env-file .env.docker ps
Invoke-WebRequest http://localhost:8080/health
```

Ouvrez [http://localhost:8080](http://localhost:8080). Si le port 8080 est déjà utilisé, changez `ADMIN_PORT`, `APP_URL` et `CORS_ORIGIN` dans `.env.docker` vers le même port, par exemple `18080`.

### Créer le premier compte administrateur

Chaque nouvelle installation possède sa propre base vide. Créez un compte administrateur sur cette installation :

```powershell
docker compose --env-file .env.docker run --rm migrate npm run admin:bootstrap -- votre-adresse@example.com
```

Ouvrez le lien à usage unique affiché dans le terminal (valable 15 minutes), puis choisissez un mot de passe d'au moins 12 caractères. Le lien est secret : ne le partagez pas.

Un clone du dépôt ne récupère ni votre base locale ni les comptes déjà créés. Pour retrouver le même identifiant de connexion sur une autre installation, relancez le bootstrap avec la même adresse e-mail et choisissez le même mot de passe lors de l'activation. Les comptes resteront indépendants entre les deux bases; pour des raisons de sécurité, préférez un mot de passe distinct.

Le catalogue peut être initialisé facultativement :

```powershell
docker compose --env-file .env.docker run --rm migrate npm run db:seed
```

Pour arrêter l'application sans supprimer les données :

```powershell
docker compose --env-file .env.docker down
```

`docker compose down -v` supprime aussi la base et toutes ses données. Cette configuration est prévue pour le développement local, pas pour une mise en production.
