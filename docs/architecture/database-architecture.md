# Architecture de la base Liena

## Périmètre et hypothèses

Le backend Liena est structuré en modules Express avec Prisma 7.9.0, PostgreSQL et migrations SQL versionnées. Le schéma actuel couvre le catalogue, les comptes, les prestataires, les réservations et le workflow demande/devis/mission.

Hypothèses MVP explicites :

- XOF et le fuseau `Africa/Lome` sont les valeurs par défaut; la devise est conservée sur les offres et les réservations.
- Les données de localisation par défaut sont orientées Togo (`TG`), mais `countryCode` demeure configurable. Les heures de disponibilité sont des heures locales du profil; les instants de réservation sont des `timestamptz` et doivent être transmis en UTC.
- Un compte peut cumuler les rôles client, prestataire et administrateur. Les rôles, l'état du compte et la vérification professionnelle sont des dimensions distinctes.
- Un profil ne conserve pas de note moyenne ni de compteur d'avis dérivés; ces valeurs se calculent à partir des avis publiés.
- Une réservation en attente ne bloque pas un créneau. La confirmation transactionnelle du prestataire le réserve; les réservations acceptées, planifiées, en cours ou litigieuses sont incompatibles avec tout chevauchement.
- Une demande de prestation, un devis, une mission et une réservation sont des concepts distincts. L'acceptation d'un devis crée une mission; elle ne crée pas une réservation.

## Relations structurantes

- `User` possède zéro ou un `ProviderProfile`; `User.roles` est un tableau d'énumérations pour permettre le cumul.
- `ProviderProfile.professionCategoryId` fixe un seul métier enfant pour le profil; les services créés via l'API doivent appartenir à ce métier.
- `ServiceRequest` appartient à un client et un métier; `Quote` appartient à un seul prestataire et une demande; `Mission` référence de manière composite le devis accepté, la demande, le client et le profil prestataire.
- `Service` appartient à un profil prestataire et à une catégorie. `Booking(serviceId, providerProfileId)` référence la paire correspondante de `Service`; une demande ne peut donc pas combiner le service d'un autre prestataire.
- `Booking` conserve le titre, la description, le type/prix/devise/durée de l'offre, le nom professionnel, la catégorie, le prix/devise acceptés et les éléments utiles de l'adresse en colonnes d'instantané. Un trigger vérifie que l'adresse choisie appartient au client; elle peut ensuite être supprimée ou modifiée sans altérer l'historique.
- Une conversation est associée à un client et à un profil prestataire. `ConversationParticipant` autorise les membres; la clé étrangère composite de `Message` exige que son expéditeur soit membre de la conversation. La lecture des conversations reste à protéger côté serveur.
- `Review` cible exactement une réservation ou une mission terminée. Les clés étrangères composites garantissent l'auteur client et le profil associé; un trigger vérifie le statut terminé.
- Les signalements utilisent une colonne FK distincte par type de cible et un `CHECK` impose la correspondance avec `targetType`. Contrairement à un identifiant polymorphe seul, chaque cible possède ainsi une vraie FK.

## Intégrité et concurrence

Prisma n'exprime pas les `CHECK`, les contraintes d'exclusion ni les triggers utilisés ici; ils sont ajoutés dans la migration initiale. `btree_gist` permet l'exclusion des plages `tstzrange` par prestataire. L'index d'exclusion PostgreSQL sérialise les confirmations concurrentes et interdit tout créneau qui se chevauche, sans dépendre d'une vérification préalable sujette à une course.

L'acceptation d'un devis est transactionnelle et sérialisable; un index partiel garantit un seul devis accepté par demande. La planification de réservation ou mission vérifie les disponibilités hebdomadaires, exceptions et chevauchements; les exclusions PostgreSQL restent la garantie finale en cas de requêtes simultanées.

Le fuseau IANA du profil permet de convertir les règles hebdomadaires locales vers des instants UTC. Les exceptions sont stockées comme intervalles UTC indisponibles. Les créneaux réservés sont représentés par les réservations actives et leur contrainte d'exclusion.

## Index de lecture

- Services : index catégorie/statut, prestataire/statut, localisation/statut et statut/date pour le catalogue et les écrans de profil.
- Réservations : client/statut/date et prestataire/statut/date pour les tableaux de bord; statut/heure et service/heure pour les consultations temporelles.
- Notifications : destinataire, date de lecture, création pour la boîte de réception non lue.
- Messages : conversation/date pour l'historique; la clé composite de participation filtre les expéditeurs autorisés.
- Avis : prestataire/statut/date pour les avis visibles.
- Adresses, disponibilités et exceptions : clés propriétaire suivies des critères de consultation usuels.

Les index spatiaux, trigrammes et recherche plein texte ne sont pas ajoutés au MVP faute de requêtes mesurées. PostgreSQL peut les fournir ultérieurement (`pg_trgm`, PostGIS) après validation du besoin et de la disponibilité de ces extensions sur l'hébergeur.

## Suppressions et conservation

- Les comptes sont désactivés/supprimés logiquement avec `status` et `deletedAt`; le `CHECK` exige leur cohérence. L'email et le téléphone sont uniques, y compris pour un compte supprimé; l'anonymisation devra remplacer les coordonnées selon la politique légale avant de libérer ces valeurs.
- Les services, profils et réservations liés à des données commerciales sont protégés par `RESTRICT`; les favoris, images et notifications non historiques peuvent suivre leur propriétaire via `CASCADE`.
- Les instantanés de réservation, l'historique de statuts et les journaux d'audit ne doivent pas être effacés en cascade avec une modification de profil.
- Les journaux d'audit ne doivent contenir ni mot de passe, ni jeton, ni secret.

## Sécurité applicative et limites

L'authentification Yeria n'est pas encore intégrée. `x-user-id` n'est accepté que par l'adaptateur de développement opt-in hors production et est résolu vers un compte actif réel. Il ne constitue pas une authentification de production. Les contrôles de rôle et de propriété sont réalisés au niveau des routes; les contraintes SQL renforcent l'intégrité.

RLS n'est pas activé. Avec un rôle de connexion partagé par Prisma, des politiques basées sur des variables de session exigeraient un protocole fiable de configuration/effacement de contexte à chaque transaction et des tests de pool. L'ajouter sans cette stratégie risquerait une fuite entre requêtes.

Les zones géographiques sont encore des champs texte; aucun référentiel zone administrable n'a été défini. Les pièces jointes de messagerie ne sont pas exposées par l'API, faute de stockage et de contrôle sécurisé des fichiers.
