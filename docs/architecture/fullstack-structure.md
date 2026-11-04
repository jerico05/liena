

1. Backend : Node.js avec Express.js.
2. Application web : React.js ou Next.js.
3. Application mobile : JavaScript avec Yeria.

L'idée est de conserver trois applications indépendantes, mais de centraliser leur code dans un même dépôt. Elles communiqueront avec le même backend Express et pourront partager certains éléments communs.

## 1. Architecture globale

## Projet Full Stack

Application Web

## React / Next.js

Interface navigateur

Application Mobile

## Yeria

Interface mobile JavaScript

API REST — JSON / HTTPS

Backend central

# Node.js + Express.js

Routes • Controllers • Services • Middleware

Base de données

## PostgreSQL

Persistance des données

Le backend est le point central : les deux applications lui envoient leurs requêtes et récupèrent les données nécessaires. Elles ne communiquent pas directement avec la base de données.

## 2. Structure générale du monorepo

Voici une structure professionnelle que tu peux réutiliser pour différents projets :

```
liena
│
├── apps/
│   │
│   ├── api/                      # Backend Express
│   │   ├── src/
│   │   │   ├── config/
│   │   │   ├── routes/
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   ├── models/
│   │   │   ├── repositories/
│   │   │   ├── middlewares/
│   │   │   ├── validators/
│   │   │   ├── utils/
│   │   │   ├── app.js
│   │   │   └── server.js
│   │   ├── tests/
│   │   ├── .env.example
│   │   └── package.json
│   │
│   ├── admin                  
│   │   ├── src/
│   │   │   ├── app/              
│   │   │   ├── components/
│   │   │   ├── features/
│   │   │   ├── hooks/
│   │   │   ├── services/
│   │   │   ├── stores/
│   │   │   ├── layouts/
│   │   │   └── styles/
│   │   ├── public/
│   │   └── package.json
│   │
│   └── mobile/                   
│       ├── src/
│       │   ├── config/
│       │   ├── views/
│       │   ├── modules/
│       │   ├── services/
│       │   ├── actions/
│       │   ├── validators/
│       │   ├── utils/
│       │   └── index.js
│       ├── tests/
│       └── package.json
│
├── packages/                    
│   ├── shared-types/
│   ├── shared-schemas/
│   └── shared-utils/
│
├── docs/
│   ├── architecture/
│   ├── api/
│   └── diagrams/
│
├── prisma/                       # Schéma, migrations, seed (hors apps/, partagé)
├── prisma.config.ts
├── scripts/                      # Outils CI/local (ex. test-database.mjs)
├── .env.example                  # Variables communes (API + Prisma)
├── .gitignore
├── package.json
├── README.md
└── package-lock.json
```

### Écarts volontaires (Liena)

| Élément | Raison |
| -------- | ------ |
| `apps/api/src/app.ts` / `server.ts` | TypeScript (équivalent `app.js` / `server.js`) |
| `apps/api/src/types/` | Extensions Express (`express.d.ts`) |
| `.env` à la racine | Une seule config pour Prisma et l’API |
| `apps/admin/src/lib/` | Client API existant ; migration vers `services/` possible plus tard |
| `docs/architecture/product/` | PDF cahier des charges & écrans |
| `docs/api/`, `docs/diagrams/` | Réservés (OpenAPI, schémas) — dossiers vides pour l’instant |

Remarque : le contenu exact de `mobile/` dépendra du mode d'intégration Yeria retenu.

### État actuel du dépôt (squelette)

- **`apps/api`** et **`apps/mobile`** : uniquement les dossiers (fichiers `.gitkeep`). Pas de `app.ts` / `server.ts` / `index.ts` tant que l’implémentation n’a pas démarré.
- **`apps/admin`** : code existant ; dossiers cibles `features/`, `hooks/`, `services/`, etc. créés vides pour migration future.
- **`packages/shared-*`** : packages vides prêts à recevoir types et schémas Zod partagés.

## 3. Organisation interne de chaque partie

### A. Backend Express.js

Le backend doit suivre une architecture en couches :

| Dossier         | Rôle                                                                 |
| --------------- | -------------------------------------------------------------------- |
| `config/`       | Configuration de la base de données et des variables d'environnement |
| `routes/`       | Déclaration des endpoints                                            |
| `controllers/`  | Réception et traitement des requêtes HTTP                            |
| `services/`     | Logique métier                                                       |
| `repositories/` | Communication avec la base de données                                |
| `models/`       | Définition des entités et modèles                                    |
| `middlewares/`  | Authentification, autorisation et gestion des erreurs                |
| `validators/`   | Validation des données reçues                                        |
| `utils/`        | Fonctions utilitaires                                                |

Exemple de fonctionnement :

```
Requête HTTP
    ↓
Route
    ↓
Middleware
    ↓
Controller
    ↓
Service
    ↓
Repository
    ↓
Base de données
```

### B. Application web React ou Next.js

Je recommande cette organisation :

- `app/` : pages et routes (pour Next.js).
- `components/` : composants réutilisables.
- `features/` : fonctionnalités regroupées par domaine.
- `services/` : communication avec le backend.
- `hooks/` : hooks personnalisés.
- `stores/` : gestion de l'état global.
- `layouts/` : structures communes des pages.
- `styles/` : styles et thèmes.
