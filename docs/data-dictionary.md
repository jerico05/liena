# Dictionnaire de données

Les clés primaires sont des UUID. Les champs `createdAt`/`updatedAt` sont des instants `timestamptz` UTC; les montants utilisent `numeric(12,2)`. Les noms SQL sont en `snake_case`; Prisma expose les champs en `camelCase`.

| Domaine | Tables Prisma/SQL | Rôle et relations essentielles |
|---|---|---|
| Identité | `User` / `users` | Coordonnées, hash du mot de passe, rôles cumulables, vérifications et statut de compte. |
| Prestataires | `ProviderProfile` / `provider_profiles` | Profil professionnel, statut de vérification, pays/ville/quartier et fuseau IANA; un profil par utilisateur. |
| Adresses | `Address` / `addresses` | Adresses enregistrées par un utilisateur; coordonnées optionnelles validées. |
| Catalogue | `Category` / `categories`; `Service` / `services`; `ServiceImage` / `service_images` | Hiérarchie de catégories, services par prestataire avec prix/devise, images et statuts de publication. |
| Disponibilités | `AvailabilitySlot` / `availability_slots`; `AvailabilityException` / `availability_exceptions` | Horaires hebdomadaires locaux et indisponibilités ponctuelles UTC. |
| Réservations | `Booking` / `bookings`; `BookingStatusHistory` / `booking_status_history` | Demande, créneau confirmé, instantanés commerciaux et d'adresse, transitions historisées. |
| Messagerie | `Conversation` / `conversations`; `ConversationParticipant` / `conversation_participants`; `Message` / `messages`; `MessageAttachment` / `message_attachments` | Membres, messages et pièces jointes. Le FK composite impose que l'expéditeur soit membre. |
| Paiements | `Payment` / `payments`; `PaymentOperation` / `payment_operations`; `PaymentWebhookEvent` / `payment_webhook_events` | État du paiement, opérations distinctes (notamment remboursements partiels) et identifiants d'événements dédupliqués. |
| Réputation | `Review` / `reviews` | Une note de 1 à 5 par réservation terminée, réponse prestataire et statut de modération. |
| Engagement | `Favorite` / `favorites`; `Notification` / `notifications` | Favori avec une seule cible de profil ou service; notifications par utilisateur et état de lecture. |
| Modération | `Report` / `reports` | Signalement avec une FK nullable par type de cible, auteur, modérateur et statut. |
| Traçabilité | `AuditLog` / `audit_logs` | Actions sensibles, acteur facultatif et métadonnées non secrètes. |

## Champs et contraintes clés

- `User.roles`: tableau PostgreSQL `user_role[]`, non vide par contrainte SQL. Il ne remplace ni `User.status` ni `ProviderProfile.status`.
- `Service.price`: absent uniquement pour `PricingType.QUOTE`, sinon décimal non négatif. `currency` est un code de trois lettres majuscules, défaut `XOF`.
- `Booking`: `requestedStartsAt` est l'instant souhaité; `startsAt`/`endsAt` sont le créneau confirmé et conservé en UTC. Les colonnes `*Snapshot` conservent notamment les caractéristiques tarifaires du service, le nom professionnel et l'adresse à la réservation; elles sont des valeurs historiques non normalisées par conception.
- `AvailabilitySlot.dayOfWeek`: entier compatible avec JavaScript `Date.getDay()` (0 dimanche, 1 lundi, ... 6 samedi). Les intervalles ne traversent pas minuit; scinder les horaires sur deux jours.
- `ConversationParticipant.lastReadAt`: dernier instant lu par participant, au lieu d'un seul `readAt` ambigu pour un message à plusieurs lecteurs.
- `PaymentOperation`: montants strictement positifs; les remboursements partiels se représentent par plusieurs opérations `REFUND`, et le service applicatif vérifie le cumul remboursé.
- `PaymentWebhookEvent`: ne stocke que l'identifiant fournisseur et le hash du payload, pas le corps brut ni le secret/signature. La vérification de signature doit précéder l'application de l'événement.
- `Report`: une seule cible par ligne et une FK réelle vers cette cible; les cibles inexistantes sont rejetées.

## Types à retenir côté application

- Utiliser `Prisma.Decimal`/chaînes décimales pour les prix; ne pas convertir en `number` flottant pour les calculs financiers.
- Passer les instants en ISO UTC, conserver le fuseau IANA du profil pour les horaires récurrents.
- Traiter `countryCode` comme ISO 3166-1 alpha-2 et `currency` comme ISO 4217; la validation syntaxique SQL n'atteste pas l'existence réglementaire d'un code.
- Limiter taille, type MIME et accès des pièces jointes dans l'API/stockage objet; la base ne vérifie que `byteSize > 0`.
