# Migrations et validation de la base

## Connexion Neon

Le dépôt utilise Prisma 7 avec `prisma.config.ts`. L'API se connecte avec `DATABASE_URL` (poolée); Prisma Migrate et le seed utilisent `DATABASE_URL_UNPOOLED` (directe). Vérifier que `.neon` cible la branche voulue puis exécuter `neon env pull` avant toute opération distante. Ne jamais afficher ni committer le contenu de `.env`.

## Développement et déploiement

1. Valider le modèle et régénérer le client : `npm run db:validate`, puis `npm run db:generate`.
2. Créer une migration en développement avec `npm run db:migrate:dev -- --name <nom>`. Examiner et versionner le SQL produit.
3. Appliquer le seed idempotent avec `npm run db:seed`; il initialise les catégories.
4. Vérifier l'état avec `npx prisma migrate status` et tester l'application.
5. Pour déployer une migration, confirmer d'abord le bon projet et la branche; appliquer `npm run db:migrate:deploy` uniquement sur l'environnement autorisé.

Les migrations versionnées sont la source de vérité. Ne pas utiliser `prisma db push` comme procédure de déploiement et ne pas modifier une migration déjà appliquée. Tester les migrations sur `dev` avant d'envisager la production. Une branche existante peut contenir des données : vérifier son état avant toute opération destructive.

## Tests

- `npm test` lance la validation Prisma et les tests unitaires API.
- `npm run build` valide la compilation de l'API et de l'interface d'administration.
- `npm run test:db` applique les migrations et exécute deux fois le seed sur `TEST_DATABASE_URL`, base dédiée dont le nom contient `test`. Le script refuse une URL identique à celles de l'application.

Les tests de base de données ne doivent jamais viser la base de l'application. Les vérifications d'intégrité des demandes (autorisation de l'acteur, transition et événement correspondant) nécessitent aussi des tests d'intégration API.
