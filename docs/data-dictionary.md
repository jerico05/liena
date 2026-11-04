# Dictionnaire de données

Les clés primaires sont des UUID. Les champs `createdAt`/`updatedAt` sont des instants `timestamptz` UTC; les montants utilisent `numeric(12,2)`. Les noms SQL sont en `snake_case`; Prisma expose les champs en `camelCase`.

| Domaine | Tables Prisma/SQL | Rôle et relations essentielles |
|---|---|---|
| Identité | `User` / `users` | Coordonnées, hash du mot de passe, rôles cumulables, vérifications et statut de compte. |
| Prestataires | `ProviderProfile` / `provider_profiles` | Profil professionnel, statut de vérification, métier unique via `profession_category_id`, pays/ville/quartier et fuseau IANA; un profil par utilisateur. |
| Adresses | `Address` / `addresses` | Adresses enregistrées par un utilisateur; coordonnées optionnelles validées. |
| Catalogue | `Category` / `categories`; `Service` / `services`; `ServiceImage` / `service_images` | Hiérarchie de catégories, services par prestataire avec prix/devise, images et statuts de publication. |
| Disponibilités | `AvailabilitySlot` / `availability_slots`; `AvailabilityException` / `availability_exceptions` | Horaires hebdomadaires locaux et indisponibilités ponctuelles UTC. |
| Réservations | `Booking` / `bookings`; `BookingStatusHistory` / `booking_status_history` | Demande, créneau confirmé, instantanés commerciaux et d'adresse, transitions historisées. |
| Demandes/devis/missions | `ServiceRequest` / `service_requests`; `Quote` / `quotes`; `Mission` / `missions` | Trois étapes distinctes. Plusieurs devis par demande, un seul accepté et au plus une mission par demande/devis. |
| Messagerie | `Conversation` / `conversations`; `ConversationParticipant` / `conversation_participants`; `Message` / `messages`; `MessageAttachment` / `message_attachments` | Membres, messages et pièces jointes. Le FK composite impose que l'expéditeur soit membre. |
| Réputation | `Review` / `reviews` | Une note de 1 à 5 par réservation ou mission terminée, réponse prestataire et statut de modération. |
| Engagement | `Favorite` / `favorites`; `Notification` / `notifications` | Favori avec une seule cible de profil ou service; notifications par utilisateur et état de lecture. |
| Modération | `Report` / `reports` | Signalement avec une FK nullable par type de cible, auteur, modérateur et statut. |
| Traçabilité | `AuditLog` / `audit_logs` | Actions sensibles, acteur facultatif et métadonnées non secrètes. |

## Champs et contraintes clés

- `User.roles`: tableau PostgreSQL `user_role[]`, non vide par contrainte SQL. Il ne remplace ni `User.status` ni `ProviderProfile.status`.
- `Service.price`: absent uniquement pour `PricingType.QUOTE`, sinon décimal non négatif. `currency` est un code de trois lettres majuscules, défaut `XOF`.
- `Booking`: `requestedStartsAt` est l'instant souhaité; `startsAt`/`endsAt` sont le créneau confirmé et conservé en UTC. Les colonnes `*Snapshot` conservent notamment les caractéristiques tarifaires du service, le nom professionnel et l'adresse à la réservation; elles sont des valeurs historiques non normalisées par conception.
- `ServiceRequest.categoryId` et `ProviderProfile.professionCategoryId` ciblent un métier (catégorie enfant). La migration ne backfill que les profils dont les services historiques partagent déjà le même métier enfant; les autres profils restent sans métier assigné jusqu'à vérification.
- `ServiceRequest.acceptedQuoteId` est nullable tant que la demande est ouverte; la demande passe à `ACCEPTED` en même temps que le devis choisi et la mission est créée dans la même transaction.
- `Mission` référence les IDs de demande, devis, client et profil prestataire via des clés étrangères composites; son statut est indépendant de `Booking.status`.
- `Review` exige exactement une source, `bookingId` ou `missionId`, et le trigger vérifie que cette source est terminée et correspond à l'auteur et au prestataire.
- `AvailabilitySlot.dayOfWeek`: entier compatible avec JavaScript `Date.getDay()` (0 dimanche, 1 lundi, ... 6 samedi). Les intervalles ne traversent pas minuit; scinder les horaires sur deux jours.
- `ConversationParticipant.lastReadAt`: dernier instant lu par participant, au lieu d'un seul `readAt` ambigu pour un message à plusieurs lecteurs.
- `Report`: une seule cible par ligne et une FK réelle vers cette cible; les cibles inexistantes sont rejetées.

## Types à retenir côté application

- Utiliser `Prisma.Decimal`/chaînes décimales pour les prix; ne pas convertir en `number` flottant pour les calculs financiers.
- Passer les instants en ISO UTC, conserver le fuseau IANA du profil pour les horaires récurrents.
- Traiter `countryCode` comme ISO 3166-1 alpha-2 et `currency` des prestations/réservations comme ISO 4217; la validation syntaxique SQL n'atteste pas l'existence réglementaire d'un code.
- Limiter taille, type MIME et accès des pièces jointes dans l'API/stockage objet; la base ne vérifie que `byteSize > 0`.
