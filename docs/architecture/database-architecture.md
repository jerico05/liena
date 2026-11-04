# Architecture de la base Liena

## Périmètre et hypothèses

Le dossier Liena ne contenait ni backend, ni modèle de données, ni version Prisma. Le socle est donc autonome et épingle Prisma CLI/client à 7.9.0, version déjà installée dans le backend voisin, sans réutiliser son modèle fonctionnel. Le schéma utilise PostgreSQL et les migrations SQL de Prisma.

Hypothèses MVP explicites :

- XOF et le fuseau `Africa/Lome` sont les valeurs par défaut; la devise est conservée sur les offres et les réservations.
- Les données de localisation par défaut sont orientées Togo (`TG`), mais `countryCode` demeure configurable. Les heures de disponibilité sont des heures locales du profil; les instants de réservation sont des `timestamptz` et doivent être transmis en UTC.
- Un compte peut cumuler les rôles client, prestataire et administrateur. Les rôles, l'état du compte et la vérification professionnelle sont des dimensions distinctes.
- Un profil ne conserve pas de note moyenne ni de compteur d'avis dérivés; ces valeurs se calculent à partir des avis publiés.
- Une réservation en attente ne bloque pas un créneau. La confirmation transactionnelle du prestataire le réserve; les réservations acceptées, planifiées, en cours ou litigieuses sont incompatibles avec tout chevauchement.

## Relations structurantes

- `User` possède zéro ou un `ProviderProfile`; `User.roles` est un tableau d'énumérations pour permettre le cumul.
- `Service` appartient à un profil prestataire et à une catégorie. `Booking(serviceId, providerProfileId)` référence la paire correspondante de `Service`; une demande ne peut donc pas combiner le service d'un autre prestataire.
- `Booking` conserve le titre, la description, le type/prix/devise/durée de l'offre, le nom professionnel, la catégorie, le prix/devise acceptés et les éléments utiles de l'adresse en colonnes d'instantané. Un trigger vérifie que l'adresse choisie appartient au client; elle peut ensuite être supprimée ou modifiée sans altérer l'historique.
- Une conversation est associée à un client et à un profil prestataire. `ConversationParticipant` autorise les membres; la clé étrangère composite de `Message` exige que son expéditeur soit membre de la conversation. La lecture des conversations reste à protéger côté serveur.
- `Review(bookingId, authorId, providerProfileId)` référence la réservation par clé étrangère composite. L'unicité sur cette clé permet au plus un avis pour la réservation; un trigger exige que la réservation soit terminée.
- Les signalements utilisent une colonne FK distincte par type de cible et un `CHECK` impose la correspondance avec `targetType`. Contrairement à un identifiant polymorphe seul, chaque cible possède ainsi une vraie FK.

## Intégrité et concurrence

Prisma n'exprime pas les `CHECK`, les contraintes d'exclusion ni les triggers utilisés ici; ils sont ajoutés dans la migration initiale. `btree_gist` permet l'exclusion des plages `tstzrange` par prestataire. L'index d'exclusion PostgreSQL sérialise les confirmations concurrentes et interdit tout créneau qui se chevauche, sans dépendre d'une vérification préalable sujette à une course.

L'acceptation doit encore être effectuée dans une transaction applicative : vérifier les disponibilités récurrentes et les exceptions, puis modifier le statut en choisissant le créneau. La contrainte d'exclusion est la dernière garantie pour les réservations concurrentes; elle ne vérifie pas que le créneau respecte les heures hebdomadaires ou les exceptions.

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

Le dépôt Liena n'a pas encore d'API : aucun contrôle HTTP de propriété, de rôle, d'accès à une réservation ou à une conversation ne peut être implémenté ou testé ici. L'API devra authentifier l'acteur, vérifier côté serveur son rôle et sa relation à chaque ressource, et ne jamais se fier à un rôle ou à un prix reçu du navigateur.

RLS n'est pas activé. Avec un rôle de connexion partagé par Prisma, des politiques basées sur des variables de session exigeraient un protocole fiable de configuration/effacement de contexte à chaque transaction et des tests de pool. L'ajouter sans cette stratégie risquerait une fuite entre requêtes.

Le stockage ne valide pas les mots de passe hachés : l'API doit les hacher avec un algorithme adapté. La base garantit que le champ est non nul, pas qu'il contient un hash cryptographiquement valide.
