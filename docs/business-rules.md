# Règles métier et transitions

## Rôles et statuts

Un utilisateur peut cumuler `CLIENT`, `PROVIDER` et `ADMIN`. Son compte (`ACTIVE`, `SUSPENDED`, `DELETED`) est indépendant du statut de vérification du profil prestataire (`PENDING`, `VERIFIED`, `REJECTED`, `SUSPENDED`). La base n'autorise pas de tableau de rôles vide. L'API doit contrôler les rôles pour chaque action; un rôle reçu du client n'est jamais fiable.

L'API normalise les adresses e-mail en minuscules; un index fonctionnel PostgreSQL protège également l'unicité sans distinction de casse.

Un profil est créé en attente de vérification. La transition en `VERIFIED` exige `verifiedAt`; la suspension conserve la date de vérification historique.

L'inscription prestataire est une demande attachée à un compte déjà identifié; elle ne crée pas de compte ni de mot de passe. Le profil choisit un seul métier actif (catégorie enfant) et ses prestations doivent rester dans ce métier. Les profils non vérifiés et les comptes inactifs ne sont pas visibles publiquement.

## Demandes, devis et missions

Une `ServiceRequest` est créée par un client et cible un métier. Plusieurs prestataires vérifiés du métier et de la ville peuvent chacun proposer un devis. Un prestataire ne peut proposer qu'un devis par demande.

Le client peut accepter un seul devis. L'API verrouille cette transition dans une transaction sérialisable; l'index partiel PostgreSQL n'autorise qu'un devis `ACCEPTED` par demande. Les autres devis en attente sont refusés dans la même transaction. L'acceptation crée une `Mission` distincte et une conversation entre les participants.

Cycle de mission : `CONFIRMED` → `SCHEDULED` → `IN_PROGRESS` → `COMPLETED`, avec annulation avant démarrage et signalement `DISPUTED` pendant l'exécution. La planification exige un intervalle futur conforme aux disponibilités et exceptions. Une exclusion PostgreSQL interdit les missions actives qui se chevauchent pour un prestataire.

La réservation (`Booking`) reste un flux séparé, indépendant d'une demande de devis et d'une mission. Les avis peuvent cibler une réservation ou une mission terminée, mais jamais les deux à la fois.

## Identité des requêtes métier

`x-user-id` n'est pas une preuve d'identité. Le code actuel ne l'accepte que si `DEV_AUTH_ENABLED=true` en développement/test; il vérifie alors l'UUID et l'existence/statut actif du compte en base. La configuration refuse cette option en production. L'authentification Yeria n'étant pas intégrée, le backend ne doit pas être déployé en production avec ces routes privées accessibles.

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

## Prix des prestations

- `FIXED`, `HOURLY` et `DAILY` ont un prix décimal non négatif; `QUOTE` n'a pas de prix initial.
- Chaque prestation et réservation conserve une devise. XOF est une valeur par défaut MVP, pas une hypothèse universelle.
- Le prix convenu est enregistré dans la réservation lorsqu'elle est acceptée et n'est pas recalculé depuis le service.

## Avis, favoris et messagerie

- Un avis n'est possible que pour une réservation ou une mission terminée, par son client et pour le profil prestataire concerné. Une clé étrangère composite et un trigger protègent la cible; une contrainte exige exactement une référence (`bookingId` ou `missionId`).
- La note est un entier compris entre 1 et 5.
- Un favori doit viser exactement un profil prestataire ou un service. Les clés uniques empêchent de répéter le même favori.
- L'expéditeur d'un message doit être enregistré comme participant à la conversation via FK composite. L'API vérifie l'appartenance avant lecture/écriture. La version actuelle accepte seulement du texte; les pièces jointes nécessitent un stockage et un contrôle de fichiers qui ne sont pas encore présents.

## Suppression et modération

- `DELETED` implique `deletedAt`, et seul ce statut permet une date de suppression. L'effacement légal/anonymisation doit être traité explicitement, en préservant les instantanés commerciaux nécessaires.
- Les signalements utilisent des FKs réelles; un `CHECK` exige une et une seule cible correspondant au type.
- Le statut de modération, les notes et l'identité du modérateur sont stockés, mais la permission d'agir comme modérateur est contrôlée par le serveur.
- Les journaux d'audit sont append-only par convention d'application. N'y inscrire aucun mot de passe, jeton, donnée de carte ou secret.
