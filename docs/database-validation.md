# Migrations et validation de la base

## Règles de coexistence Prisma / SQL

La migration `prisma/migrations/20261028154500_initial/migration.sql` est générée à partir du schéma puis complétée par du SQL personnalisé pour :

- `CHECK` (montants, devise, note, cibles polymorphes, états et horaires);
- l'index fonctionnel d'email insensible à la casse;
- les contraintes d'exclusion `btree_gist` sur disponibilités et créneaux;
- les triggers de transition/historique de réservation, propriété de l'adresse et admissibilité des avis.

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

Le runner applique les migrations, lance le seed deux fois pour éprouver son idempotence puis teste création utilisateur/profil/service/réservation/paiement/avis, contraintes, transition de statut, déduplication d'événement de paiement et deux confirmations concurrentes d'un même créneau. Il n'efface ni ne réinitialise la base; les tests transactionnels annulent leurs données, et le test de concurrence supprime uniquement ses propres fixtures identifiées par UUID.

Après migration, les objets SQL spécifiques peuvent être contrôlés avec :

```sql
SELECT extname FROM pg_extension WHERE extname = 'btree_gist';
SELECT conname FROM pg_constraint
WHERE conname IN (
  'services_price_check',
  'reviews_rating_check',
  'favorites_exactly_one_target_check',
  'bookings_provider_slot_exclusion',
  'bookings_service_price_snapshot_check'
);
SELECT indexname FROM pg_indexes
WHERE indexname = 'users_email_lower_key';
```

Le nom `bookings_status_transition_check` est le nom signalé par le trigger, pas un objet catalogué dans `pg_constraint`. Vérifier les triggers par :

```sql
SELECT tgname FROM pg_trigger
WHERE NOT tgisinternal
  AND tgname IN (
    'bookings_guard_status_transition',
    'bookings_record_initial_status',
    'bookings_guard_address_owner',
    'reviews_require_completed_booking'
  );
```

## Résultats exécutés

Validations réalisées dans un cluster PostgreSQL 18 temporaire et isolé (aucune base préexistante n'a été modifiée) :

- `prisma validate` : réussi.
- `prisma generate` : réussi avec Prisma 7.9.0.
- `tsc --noEmit` : réussi.
- `npm audit` : zéro vulnérabilité après les surcharges de versions transitives épinglées.
- `prisma migrate dev` et `prisma migrate status` : migration initiale appliquée sur une base vierge, schéma déclaré à jour.
- `npm run test:db` : migration initiale appliquée sur une base vierge, seed exécuté deux fois, 10 tests réussis / 0 échoué. Les tests couvrent les prix et notes, FK/relations composites, propriété d'adresse, favoris, unicité d'email, transitions, chevauchements simultanés, expéditeur participant, idempotence d'événement de paiement et parcours réservation-paiement-avis.

L'extension `btree_gist` et le SQL de la migration ont ainsi été exercés sur PostgreSQL réel. Il reste à vérifier que l'instance PostgreSQL de préproduction/production autorise cette extension.

Le dossier ne contient pas d'API. Les tests d'autorisation (propriété des réservations/services, visibilité en lecture des conversations), de rôle d'administrateur, de vérification cryptographique du webhook fournisseur et de refus de validation de paiement depuis le navigateur ne peuvent pas être satisfaits par ces seuls modèles. Ils doivent être ajoutés au projet serveur avant la mise en production. La contrainte FK des messages prouve l'appartenance de l'expéditeur, mais ne remplace pas un contrôle d'accès de lecture côté serveur.
