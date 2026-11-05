# Migrations et validation de la base

## Règles de coexistence Prisma / SQL

La migration initiale `prisma/migrations/20261028154500_initial/migration.sql` décrit le schéma historique complet à sa création. Les migrations suivantes retirent la fonctionnalité paiement, ajoutent l'authentification admin, puis introduisent le workflow demande/devis/mission :

- suppression des tables et énumérations de paiement;
- suppression des notifications `PAYMENT` existantes et retrait de cette valeur de l'énumération;
- `CHECK` (prix, note, cibles polymorphes, états et horaires);
- l'index fonctionnel d'email insensible à la casse;
- les contraintes d'exclusion `btree_gist` sur disponibilités et créneaux;
- les triggers de transition/historique de réservation, propriété de l'adresse et admissibilité des avis.
- `20261104120000_requests_quotes_missions` ajoute les catégories métier des profils, les demandes, devis et missions, les notifications correspondantes et les règles d'intégrité du workflow.

La migration métier est additive : elle ne supprime pas les données existantes. Elle ne préremplit un métier prestataire que si toutes ses prestations historiques référencent déjà le même métier enfant actif; les profils ambigus restent à compléter après revue.

La migration de retrait détruit volontairement les données stockées dans `payments`, `payment_operations`, `payment_webhook_events` et les notifications `PAYMENT`. Cette perte de données est irréversible sans sauvegarde. Elle doit être planifiée et sauvegardée avant déploiement sur une base qui contient ces enregistrements.

Prisma n'affiche pas ces objets comme contraintes de modèle. Il faut donc conserver le SQL dans les migrations versionnées, ne pas utiliser `prisma db push` comme procédure de déploiement, et appliquer uniquement `prisma migrate deploy` aux environnements. Toute modification de ces règles après application doit être ajoutée dans une nouvelle migration, jamais ajoutée rétroactivement à une migration déjà déployée.

L'extension `btree_gist` doit être autorisée par le fournisseur PostgreSQL. Vérifier les permissions et la disponibilité de l'extension en préproduction avant la première migration.

## Base de développement

1. Copier `.env.example` en `.env` et adapter `DATABASE_URL`.
2. Créer une base PostgreSQL vide pour Liena.
3. Exécuter `npm run db:validate` et `npm run db:generate`.
4. En développement, lancer `npm run db:migrate:dev`; dans une base de déploiement, lancer `npm run db:migrate:deploy`.
5. Exécuter `npm run db:seed`, puis vérifier les catégories par slug.
6. Vérifier l'état avec `npx prisma migrate status`.

Ne pas exécuter de migration de réinitialisation sur une base utile. La migration initiale crée un nouveau schéma et ne supprime pas de données.

## Tests

`npm run test` valide le modèle Prisma. Les tests PostgreSQL sont intégrationnels et requièrent un serveur accessible :

1. Configurer `TEST_DATABASE_URL` vers une base dédiée dont le nom contient `test`.
2. S'assurer qu'elle est différente de `DATABASE_URL`.
3. Lancer `npm run test:db`.

Le runner applique les migrations, lance le seed deux fois pour éprouver son idempotence puis teste les contraintes relationnelles, la hiérarchie du catalogue, les APIs publiques, les transitions, le workflow devis→mission sous concurrence et le middleware d'identité de développement contre de vrais comptes DB. Il n'efface ni ne réinitialise la base; les tests transactionnels annulent leurs données, et les tests HTTP suppriment uniquement leurs fixtures identifiées par UUID.

Après migration, les objets SQL spécifiques peuvent être contrôlés avec :

```sql
SELECT extname FROM pg_extension WHERE extname = 'btree_gist';
SELECT conname FROM pg_constraint
WHERE conname IN (
  'services_price_check',
  'reviews_rating_check',
  'favorites_exactly_one_target_check',
  'bookings_provider_slot_exclusion',
  'bookings_service_price_snapshot_check',
  'missions_provider_slot_exclusion',
  'reviews_exactly_one_completed_source_check'
);
SELECT indexname FROM pg_indexes
WHERE indexname IN ('users_email_lower_key', 'quotes_one_accepted_per_request_idx');
```

Le nom `bookings_status_transition_check` est le nom signalé par le trigger, pas un objet catalogué dans `pg_constraint`. Vérifier les triggers par :

```sql
SELECT tgname FROM pg_trigger
WHERE NOT tgisinternal
  AND tgname IN (
    'bookings_guard_status_transition',
    'bookings_record_initial_status',
    'bookings_guard_address_owner',
    'reviews_require_completed_booking',
    'missions_guard_transition',
    'service_requests_guard_accepted_quote',
    'quotes_guard_accepted_request'
  );
```

## Vérification de l'environnement courant

- `npm run db:validate` : réussi.
- `npm run db:generate` : réussi avec Prisma 7.9.0.
- `npm run build` : réussi après l'ajout des routeurs métier.
- `npm run test:unit` : 17 tests réussis, 0 échec; cette suite ne dépend pas de PostgreSQL.
- `npm run test:db` : bloqué avant connexion; le script de sécurité a détecté que `TEST_DATABASE_URL` identifie la même base que `DATABASE_URL`. Aucune migration ni seed n'a été exécuté par cette tentative.

La suite PostgreSQL reste donc à exécuter avec un `TEST_DATABASE_URL` réellement distinct, dont le nom contient `test`, et des identifiants valides. Une erreur Prisma `P1000` signifie un échec d'authentification DB; elle n'est pas un échec fonctionnel du workflow.
