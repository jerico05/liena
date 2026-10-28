# Règles métier et transitions

## Rôles et statuts

Un utilisateur peut cumuler `CLIENT`, `PROVIDER` et `ADMIN`. Son compte (`ACTIVE`, `SUSPENDED`, `DELETED`) est indépendant du statut de vérification du profil prestataire (`PENDING`, `VERIFIED`, `REJECTED`, `SUSPENDED`). La base n'autorise pas de tableau de rôles vide. L'API doit contrôler les rôles pour chaque action; un rôle reçu du client n'est jamais fiable.

L'API normalise les adresses e-mail en minuscules; un index fonctionnel PostgreSQL protège également l'unicité sans distinction de casse.

Un profil est créé en attente de vérification. La transition en `VERIFIED` exige `verifiedAt`; la suspension conserve la date de vérification historique.

## Réservations

Cycle de vie retenu :

| État actuel | États suivants autorisés |
|---|---|
| `PENDING` | `ACCEPTED`, `REJECTED`, `CANCELLED` |
| `ACCEPTED` | `SCHEDULED`, `CANCELLED` |
| `SCHEDULED` | `IN_PROGRESS`, `CANCELLED` |
| `IN_PROGRESS` | `COMPLETED`, `DISPUTED` |
| `DISPUTED` | `COMPLETED`, `CANCELLED` |
| `REJECTED`, `CANCELLED`, `COMPLETED` | Aucun |

Un trigger PostgreSQL refuse les transitions non listées et ajoute une ligne d'historique à la création et à chaque changement de statut. Le changement de statut et les modifications de réservation doivent rester dans la même transaction. L'API peut définir `app.actor_id` et `app.status_note` dans la transaction avant l'écriture pour attribuer l'acteur et le commentaire; si l'acteur manque, l'historique reste attribué à `NULL`.

Le passage en `ACCEPTED` (et les états actifs suivants) exige un intervalle complet et un prix convenu, y compris pour un service sur devis. `IN_PROGRESS`, `COMPLETED` et `DISPUTED` exigent une date de début; `COMPLETED` exige `completedAt`; `CANCELLED` exige `cancelledAt`. L'intervalle est semi-ouvert `[startsAt, endsAt)`, donc deux prestations adjacentes sont autorisées. Le prix convenu et la devise sont copiés dans la réservation; la base garantit le montant non négatif.

La contrainte d'exclusion sur le prestataire et la plage de temps arbitre la concurrence, même si deux transactions vérifient simultanément un créneau. Les demandes `PENDING`, rejetées et annulées ne bloquent pas le planning. La disponibilité hebdomadaire et les exceptions sont des règles complémentaires à vérifier transactionnellement par l'API.

## Prix et paiements

- `FIXED`, `HOURLY` et `DAILY` ont un prix décimal non négatif; `QUOTE` n'a pas de prix initial.
- Chaque prestation, réservation, paiement et opération conserve une devise. XOF est une valeur par défaut MVP, pas une hypothèse universelle.
- Le succès d'un paiement ne fait pas évoluer la réservation. Le statut de prestation suit son propre cycle.
- Les montants ne sont validés que par le serveur. Le retour navigateur ne prouve pas le paiement.
- Le serveur vérifie la signature de webhook, insère/déduplique l'événement par `(providerName, providerEventId)`, puis applique la transition du paiement dans une transaction idempotente.
- Les opérations autorisation/capture/remboursement ont leurs propres clés d'idempotence et références fournisseur. Plusieurs opérations `REFUND` permettent les remboursements partiels; le cumul ne peut dépasser le montant encaissé et doit être vérifié par l'application ou un trigger complémentaire avant la mise en production des remboursements.
- Les événements de webhook sont enregistrés avec leur hash et leur état de traitement, sans secret ni payload brut.

## Avis, favoris et messagerie

- Un avis n'est possible que pour une réservation terminée, par son client et pour le profil prestataire de cette réservation. Une clé étrangère composite et un trigger protègent cette règle; `bookingId` ne peut apparaître qu'une fois.
- La note est un entier compris entre 1 et 5.
- Un favori doit viser exactement un profil prestataire ou un service. Les clés uniques empêchent de répéter le même favori.
- L'expéditeur d'un message doit être enregistré comme participant à la conversation via FK composite. Chaque conversation et chaque réservation ne sont pas automatiquement accessibles à tous les utilisateurs; l'API vérifie l'appartenance avant lecture/écriture.

## Suppression et modération

- `DELETED` implique `deletedAt`, et seul ce statut permet une date de suppression. L'effacement légal/anonymisation doit être traité explicitement, en préservant les instantanés commerciaux nécessaires.
- Les signalements utilisent des FKs réelles; un `CHECK` exige une et une seule cible correspondant au type.
- Le statut de modération, les notes et l'identité du modérateur sont stockés, mais la permission d'agir comme modérateur est contrôlée par le serveur.
- Les journaux d'audit sont append-only par convention d'application. N'y inscrire aucun mot de passe, jeton, donnée de carte ou secret.
