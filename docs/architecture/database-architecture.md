# Architecture de la base Liena

## Périmètre du MVP

Le schéma PostgreSQL, géré avec Prisma et déployé sur Neon, couvre le catalogue des prestataires, leur modération et les demandes de service. Il suit le modèle MVP des documents de conception; il ne reprend pas les anciens domaines de réservation, paiement, messagerie, avis ou adresses.

Yeria reste le fournisseur d'identité des clients et prestataires. L'API vérifie le jeton Yeria et utilise son `sub` comme identifiant externe; la base ne duplique pas les comptes de ces utilisateurs. L'authentification de l'administration existante reste locale à l'API et n'est pas remplacée par une table d'utilisateurs Prisma.

## Modèle et relations

- `Category` regroupe les prestataires et définit l'ordre d'affichage.
- `ProviderProfile` contient l'identité Yeria unique, les informations professionnelles, les services sous forme de texte, la zone, les coordonnées de contact, les médias et le statut de modération.
- `ModerationDecision` historise chaque décision et son auteur, en préservant le nom d'utilisateur de l'administration locale; `adminYeriaSub` est disponible pour une future identité admin Yeria.
- `ServiceRequest` représente la demande d'un client Yeria à un prestataire.
- `RequestEvent` historise les transitions et notes d'une demande. L'acteur est identifié par son `yeria_sub`.

Les clés étrangères protègent les catégories, profils et demandes référencés contre les suppressions accidentelles (`RESTRICT`). Les identifiants Yeria sont des chaînes externes et ne sont pas des clés étrangères vers Yeria.

## Intégrité et évolutions

Les statuts sont des enums PostgreSQL. `yeria_sub` et le libellé de catégorie sont uniques. Les index couvrent les recherches par statut, catégorie, zone, prestataire et date ainsi que l'historique des demandes et décisions.

La validation des transitions de statut, l'autorisation d'un acteur sur une demande et l'écriture atomique de l'événement associé doivent être garanties par les services API dans une transaction. Le schéma seul ne vérifie pas ces règles métier. Les prix indicatifs utilisent `numeric(12,2)`; les montants doivent rester des décimaux ou des chaînes dans le code.

Le modèle est volontairement restreint au MVP. Ajouter une réservation, des services normalisés ou un autre domaine implique une évolution Prisma et une nouvelle migration versionnée, sans modifier rétroactivement une migration déjà appliquée.

## Connexions Neon

- L'API utilise `DATABASE_URL` (URL poolée) pour le trafic applicatif.
- Prisma Migrate et le seed utilisent `DATABASE_URL_UNPOOLED` (URL directe).
- `.env` et `.neon` sont des fichiers locaux ignorés par Git; ne jamais y copier de secrets dans des fichiers suivis.
- Les migrations sont d'abord appliquées à la branche Neon `dev`, puis vérifiées avant toute décision distincte de déploiement en production.
