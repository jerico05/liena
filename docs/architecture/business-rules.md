# Règles métier du MVP

## Identité et prestataires

- Yeria authentifie les clients et prestataires. L'API doit vérifier le jeton et dériver le `sub` de l'identité authentifiée; ne jamais accepter cet identifiant comme preuve d'identité depuis un champ libre du client.
- Chaque `ProviderProfile` est associé à un seul `yeria_sub`. Les comptes clients et prestataires ne sont pas dupliqués dans la base Liena.
- Les statuts du profil sont `DRAFT`, `PENDING`, `APPROVED`, `REJECTED`, `SUSPENDED` et `ARCHIVED`. Les transitions autorisées doivent être validées par le service API.
- Une décision de modération doit conserver l'acteur, le résultat et le motif éventuel. Les données d'administration continuent d'utiliser l'authentification locale existante.

## Demandes de service

- Une demande est rattachée à un client Yeria et à un profil prestataire existant.
- Les statuts enregistrés sont `SENT`, `ACCEPTED`, `DECLINED` et `COMPLETED`.
- Toute transition doit autoriser l'acteur selon son identité et son rôle, puis enregistrer le changement dans `RequestEvent` dans la même transaction que la mise à jour de la demande.
- L'historique conserve l'ancien et le nouveau statut, l'acteur et une note facultative. L'autorisation et la validité des transitions relèvent de l'API; les clés étrangères seules ne les garantissent pas.

## Périmètre

Les services proposés par un profil restent un champ texte dans le MVP. Les réservations, paiements, adresses, avis, favoris et conversations ne sont pas modélisés dans le schéma actuel; leur ajout nécessitera des modèles et migrations dédiés.

Les prix indicatifs sont stockés en décimal (`numeric(12,2)`), jamais comme nombres flottants pour des calculs financiers.
