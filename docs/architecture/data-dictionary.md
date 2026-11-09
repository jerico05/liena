# Dictionnaire de données

Les noms SQL sont en `snake_case`; Prisma expose les champs en `camelCase`. Les dates sont des instants `timestamptz` UTC; `indicative_price` est un décimal `numeric(12,2)`.

| Domaine | Tables Prisma/SQL | Rôle et relations essentielles |
|---|---|---|
| Catalogue | `Category` / `categories` | Catégories actives et ordre d'affichage; une catégorie peut regrouper plusieurs profils prestataires. |
| Prestataires | `ProviderProfile` / `provider_profiles` | Profil métier lié à un `yeria_sub` unique et à une catégorie; conserve services, zone, contact, médias et statut. |
| Modération | `ModerationDecision` / `moderation_decisions` | Décisions de validation, refus, suspension ou réactivation, avec motif et administrateur auteur. |
| Demandes | `ServiceRequest` / `service_requests` | Demande d'un client identifié par Yeria vers un profil prestataire, avec description, zone et statut. |
| Historique | `RequestEvent` / `request_events` | Historique des changements de statut d'une demande, acteur Yeria et note éventuelle. |

## Contraintes et conventions

- `ProviderProfile.yeriaSub` et `Category.label` sont uniques.
- Les relations vers une catégorie, un profil ou une demande utilisent `RESTRICT` pour éviter la suppression d'éléments encore référencés.
- Les identifiants clients/prestataires sont les `sub` vérifiés par l'API auprès de Yeria; aucune table locale de compte client ou prestataire n'est créée.
- `ModerationDecision.adminUsername` conserve l'identité de l'administration locale existante; `adminYeriaSub` est facultatif.
- Les transitions de demandes et la création de `RequestEvent` doivent être faites dans la même transaction applicative.
- Les services proposés sont du texte libre dans le modèle MVP; ils ne constituent pas une table ou un catalogue normalisé.

Les réservations, paiements, conversations, avis, adresses et comptes utilisateurs ne font pas partie du schéma MVP actuel.
