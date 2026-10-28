# Liena — socle de données

Ce dossier contient le modèle de données PostgreSQL de Liena, ses migrations Prisma, le seed du catalogue et ses tests d'intégration. Il ne contient pas encore d'API ni de logique d'autorisation HTTP.

## Prérequis

- Node.js 20.19+, 22.12+ ou 24+
- PostgreSQL 14+ avec l'extension `btree_gist` disponible
- Prisma ORM 7.9.0



## Commandes

```powershell
npm run db:validate
npm run db:generate
npm run db:migrate:dev
npm run db:seed
npm run test
npm run test:db
```

- `db:migrate:dev` crée une migration lors du développement et exige une base accessible.
- `db:migrate:deploy` applique uniquement les migrations versionnées; utilisez-le pour les déploiements.
- `test` valide le schéma Prisma.
- `test:db` applique les migrations et le seed deux fois sur `TEST_DATABASE_URL`, puis exécute les tests d'intégrité/concurrence. Il ne réinitialise pas la base et refuse un nom de base ne contenant pas `test`.
- `db:seed` est idempotent et ne crée que les catégories du catalogue.

Le seed et les commandes Prisma lisent `DATABASE_URL`. Ne lancez pas ces commandes contre une base contenant des données utiles sans avoir compris l'effet de la migration.

## Architecture et règles métier

Voir :

- [Architecture de la base](./docs/database-architecture.md)
- [Dictionnaire de données](./docs/data-dictionary.md)
- [Règles métier](./docs/business-rules.md)
- [Validation et migrations](./docs/database-validation.md)

Les contrôles d'accès aux ressources, la vérification cryptographique des webhooks et les contrôles de propriété doivent être implémentés dans l'API lorsqu'elle existera. Les contraintes SQL renforcent l'intégrité, mais ne remplacent pas ces contrôles.
