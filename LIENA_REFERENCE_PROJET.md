# LIENA - Référence actuelle du projet

> Document de référence évolutif pour la nouvelle phase backend utilisateur.
>
> Priorité des sources :
>
> 1. le schéma Prisma et ses migrations présentes dans le dépôt ;
> 2. le code et les tests présents dans le dépôt ;
> 3. `Plan_API_LIENA_Node_Express.pdf` et `Analyse_UML_Liena.pdf` comme références métier ;
> 4. les consignes de développement actuelles.
>
> L'ancien document `LIENA_REFERENCE_PROJET.md` situé hors du dépôt est
> historique et ne doit plus servir à prendre des décisions.

## 1. Présentation actuelle

LIENA est un service de mise en relation entre des clients et des
professionnels. Il est intégré à Yeria pour l'identité des utilisateurs
ordinaires. LIENA conserve les données métier nécessaires au catalogue, aux
profils professionnels, aux demandes et à leur suivi.

La partie administrateur est considérée comme existante par le nouveau
cadrage. L'audit du dépôt montre toutefois que son implémentation actuelle
est limitée à un périmètre précis ; cette différence doit rester visible.

## 2. Objectif de la nouvelle phase backend

Compléter l'API utilisateur sans dupliquer les fonctionnalités
administrateur :

- vérifier l'identité Yeria ;
- exposer les catégories actives et les profils publics ;
- permettre la création et la gestion d'un profil professionnel ;
- permettre aux clients de créer et consulter leurs demandes ;
- permettre aux prestataires de traiter leurs demandes si le périmètre MVP
  est confirmé ;
- ajouter les tests et la documentation correspondants.

Les sources actuelles ne prévoient pas de système local indépendant de
connexion client/prestataire.

## 3. Périmètre client et prestataire

### Client

- consulter les catégories actives ;
- rechercher des prestataires par catégorie, métier et zone ;
- consulter uniquement des profils approuvés et actifs ;
- créer une demande de service ;
- consulter uniquement ses propres demandes et leur statut.

### Prestataire

- déposer une candidature depuis son identité Yeria ;
- créer un profil professionnel ;
- consulter et modifier son propre profil ;
- soumettre le profil à validation ;
- consulter le statut de sa candidature ;
- consulter et traiter ses demandes reçues si cette fonctionnalité est
  retenue pour le MVP.

## 4. Administration existante et réutilisation

Le backend admin est monté sous `/api/v1/admin` dans
`apps/api/src/app.ts`. Les routes présentes sont :

- `GET /csrf` ;
- `POST /login` ;
- `GET /me` ;
- `POST /logout` ;
- `GET /dashboard` ;
- `GET /providers` ;
- `GET /providers/:id` ;
- `POST /providers/:id/review`.

Les éléments à réutiliser sont :

- Express et la structure routes/contrôleurs/services/repositories ;
- Prisma et l'accès PostgreSQL ;
- Zod et le middleware de validation ;
- la gestion centralisée des erreurs ;
- les modèles et statuts réellement retenus par le schéma ;
- la logique de consultation et de revue des profils existante.

L'authentification admin utilise des identifiants de configuration, une
session par cookie, un jeton CSRF et une protection contre les tentatives
répétées. Elle est distincte de l'identité Yeria utilisateur et ne doit pas
être remplacée par celle-ci.

## 5. Analyse UML

Le modèle retenu dans `prisma/schema.prisma` décrit cinq entités métier persistées :

- `Category` ;
- `ProviderProfile` ;
- `ModerationDecision` ;
- `ServiceRequest` ;
- `RequestEvent`.

Relations et cardinalités indiquées :

- une `Category` regroupe zéro à plusieurs `ProviderProfile` ;
- un `ProviderProfile` possède plusieurs `ModerationDecision` ;
- un `ProviderProfile` reçoit plusieurs `ServiceRequest` ;
- une `ServiceRequest` possède plusieurs `RequestEvent`.

Le modèle UML utilise `yeria_sub` comme référence externe unique du
propriétaire du profil. Il ne crée pas de compte local pour représenter les
comptes Yeria.

Les attributs principaux sont :

- catégorie : identifiant, libellé, activation, ordre d'affichage ;
- profil : identifiant, `yeria_sub`, nom affiché, catégorie, services, zone,
  description, contact, statut et dates ;
- décision : profil, administrateur Yeria, décision, motif et date ;
- demande : client Yeria, profil visé, description, zone, statut et dates ;
- événement : demande, acteur Yeria, ancien statut, nouveau statut, note et
  date.

Les documents de cadrage sont conservés comme références. En cas d'écart avec
le schéma courant, le schéma Prisma et ses migrations font foi. Les API
utilisateur adaptées au MVP utilisent les IDs entiers et les champs de profil,
zone et demandes déjà présents ; elles ne supposent pas de tables de comptes,
services ou réservations.

## 6. Architecture réellement présente

Le dépôt est un monorepo avec `apps/api`, `apps/admin`, `apps/mobile` et des
packages partagés. L'API utilise TypeScript en CommonJS, Express 5, Prisma
7.9, PostgreSQL, Zod, Helmet, CORS et `express-rate-limit`.

L'application Express monte actuellement :

- les middlewares généraux de sécurité et de traçage ;
- `GET /health` ;
- le routeur admin.

Les middlewares utilisateur existent seulement sous forme de squelettes :
`authenticate` et `authorize` laissent passer la requête. La configuration
Yeria indique que l'intégration est désactivée.

Les routes utilisateur décrites dans OpenAPI et Postman ne sont donc pas
considérées comme implémentées tant qu'elles ne sont pas montées et testées
dans le code.

## 7. Technologies et dépendances

Technologies confirmées par le dépôt :

- Node.js 20/22/24 ;
- TypeScript 5.9 ;
- Express 5.3 ;
- PostgreSQL ;
- Prisma 7.9 et `@prisma/adapter-pg` ;
- Zod 4 ;
- tests Node natifs et `tsx`.

Le projet ne contient pas actuellement de dépendance ou d'intégration
Yeria JWT opérationnelle. La bibliothèque de vérification devra être choisie
après confirmation du contrat Yeria, sans introduire inutilement une nouvelle
technologie.

## 8. Entités, attributs, relations et cardinalités réelles

Le schéma Prisma actuel contient notamment :

- `User` : compte local avec identifiants, rôles et statut ;
- `ProviderProfile` : profil rattaché à `User` par `userId` unique ;
- `Category` : hiérarchie parent/enfants ;
- `Service` : prestation rattachée à un profil et une catégorie ;
- `Booking`, historique de réservation, disponibilités ;
- conversations, messages, avis, favoris, notifications et signalements ;
- modèles d'administration et d'audit.

La relation actuelle `User 1 - 0..1 ProviderProfile` garantit déjà un seul
profil par utilisateur local via `ProviderProfile.userId @unique`.

Écart important : la migration
`20261104120000_requests_quotes_missions` crée aussi les tables
`location_zones`, `service_requests`, `quotes` et `missions`, ainsi que des
contraintes PostgreSQL, mais ces modèles ne sont pas déclarés dans
`prisma/schema.prisma`. Les colonnes `profession_category_id` et
`location_zone_id` ajoutées à `provider_profiles` ne sont pas déclarées non
plus dans Prisma.

Avant toute implémentation utilisateur, il faudra traiter cette divergence
entre migrations, schéma Prisma et code.

## 9. Endpoints prévus par le nouveau cadrage

Les chemins ci-dessous sont des exigences de cadrage, pas un constat
d'implémentation :

### Identité

- middleware JWT Yeria pour les routes protégées.

### Catégories et recherche

- `GET /api/categories` ;
- `GET /api/categories/:id` ;
- `GET /api/providers` ;
- `GET /api/providers/:id`.

### Profil prestataire

- `POST /api/providers/profile` ;
- `GET /api/providers/profile/me` ;
- `PUT /api/providers/profile/me` ;
- `POST /api/providers/profile/me/submit` ;
- `GET /api/providers/profile/me/status`.

### Demandes client

- `POST /api/requests` ;
- `GET /api/requests/my-requests` ;
- `GET /api/requests/:id`.

### Demandes prestataire, sous réserve de validation MVP

- `GET /api/providers/requests` ;
- `GET /api/providers/requests/:id` ;
- `PATCH /api/providers/requests/:id/accept` ;
- `PATCH /api/providers/requests/:id/decline` ;
- `PATCH /api/providers/requests/:id/complete`.

Le préfixe `/api/v1` est utilisé par l'application et la documentation
actuelles. Il faudra choisir et appliquer une convention unique avant de
monter les nouvelles routes.

## 10. Règles métier

- les catégories publiques doivent être actives ;
- seuls les profils approuvés et actifs sont publics ;
- un utilisateur ne possède qu'un profil professionnel ;
- un client ne voit et ne modifie que ses demandes ;
- un prestataire ne voit et ne modifie que les demandes de son profil ;
- les identifiants propriétaires ne viennent jamais du body frontend ;
- les transitions de statut sont vérifiées côté backend ;
- les changements de statut d'une demande sont historisés ;
- la gestion des catégories et la modération restent dans l'administration ;
- aucune route utilisateur ne doit dupliquer une route admin.

Les statuts présentent actuellement une divergence à résoudre : le cadrage
parle de `APPROVED`, alors que le code admin et Prisma utilisent
`VERIFIED`. Le modèle UML utilise également `ModerationDecision`, absent du
code actuel.

## 11. Authentification et sécurité Yeria

Le middleware cible doit :

1. refuser l'absence de jeton ;
2. vérifier signature, issuer, audience et expiration ;
3. extraire `sub` uniquement après vérification ;
4. placer l'identité vérifiée dans le contexte de requête ;
5. appliquer les autorisations et contrôles de propriété.

Il ne faut pas accepter un `yeria_sub` fourni librement par le frontend.

Les points à confirmer auprès de Yeria sont : format exact du JWT, clé ou
JWKS, issuer, audience, algorithmes autorisés et procédure de rotation.

## 12. Architecture des modules à développer

La structure doit suivre les conventions admin existantes :

```text
apps/api/src/
  middlewares/
    authenticate.ts
    authorize.ts
  modules/
    categories/
      routes, controller, service, repository, validator
    providers/
      routes, controller, service, repository, validator
    clients/
      routes, controller
    service-requests/
      routes, controller, service, repository, validator
    shared/
      identity, errors, pagination, status transitions
```

Les noms exacts pourront être adaptés après la décision sur le modèle de
données. La logique ne doit pas être concentrée dans les routeurs.

## 13. Plan de développement par phases

### Phase 0 - décisions et cohérence du modèle

- confirmer l'identité Yeria et son rattachement aux données existantes ;
- comparer les migrations avec Prisma ;
- harmoniser les statuts ;
- confirmer le périmètre des demandes prestataire ;
- confirmer la convention `/api/v1`.

### Phase 1 - identité et autorisations

- implémenter la vérification Yeria ;
- enrichir le type Express de l'identité vérifiée ;
- ajouter autorisations et contrôles de propriété ;
- tester les cas d'absence, invalidité et expiration.

### Phase 2 - catégories et découverte

- exposer les catégories actives ;
- rechercher les profils publics ;
- valider filtres et pagination ;
- exclure les profils non approuvés, inactifs ou suspendus.

### Phase 3 - profil prestataire

- création unique ;
- consultation et modification du propriétaire ;
- soumission à validation ;
- lecture du statut ;
- compatibilité avec le workflow admin.

### Phase 4 - demandes client

- création ;
- liste et détail propriétaire ;
- validation du prestataire cible ;
- statuts et historique.

### Phase 5 - demandes prestataire

- confirmer le MVP ;
- lister et consulter les demandes du profil ;
- accepter, refuser et terminer ;
- historiser chaque transition dans une transaction cohérente.

### Phase 6 - tests et documentation

- tests unitaires et HTTP ;
- tests d'intégration PostgreSQL ;
- OpenAPI et Postman ;
- mise à jour du README et du dictionnaire de données.

## 14. Plan de tests

Les tests doivent couvrir :

- absence de token ;
- token invalide, expiré, mauvais issuer ou mauvaise audience ;
- extraction correcte de `sub` ;
- utilisateur sans profil ;
- création d'un profil ;
- tentative de second profil ;
- modification du profil d'un autre utilisateur ;
- exposition d'un profil non approuvé ;
- recherche avec pagination invalide ;
- demande vers un prestataire inexistant ou non approuvé ;
- lecture d'une demande appartenant à un autre client ;
- action d'un prestataire sur la demande d'un autre prestataire ;
- historique correct des changements de statut.

## 15. Documentation et livrables

À maintenir :

- OpenAPI/Swagger ;
- collection Postman ;
- environnement Postman sans secret ;
- règles métier ;
- dictionnaire de données ;
- README ;
- ce document de référence.

Chaque endpoint devra préciser méthode, chemin, paramètres, corps,
authentification, réponses et erreurs possibles.

## 16. État d'avancement réel

### Confirmé dans le code

- monorepo TypeScript ;
- API Express fonctionnelle pour le périmètre admin actuel ;
- connexion Prisma/PostgreSQL configurée ;
- validation Zod et gestion d'erreurs ;
- interface admin connectée ;
- tests admin réussis ;
- schéma métier riche déjà présent en partie.

### Documenté mais non confirmé comme implémenté

- API utilisateur complète ;
- authentification Yeria ;
- routes catégories et prestataires publiques ;
- routes profil et demandes ;
- Swagger réellement servi par Express ;
- historique `ModerationDecision` et `RequestEvent`.

### Blocages à résoudre

1. rattachement Yeria `sub` / modèle local `User` ;
2. divergence migration SQL / schéma Prisma ;
3. harmonisation `APPROVED` / `VERIFIED` ;
4. choix entre le modèle UML minimal et le modèle demande/devis/mission
   déjà introduit par migration ;
5. périmètre MVP des demandes reçues par les prestataires ;
6. convention finale des préfixes de routes.

## Règle d'évolution

Ce document est la référence évolutive du projet. Après chaque phase,
l'état réel, les routes montées, les tests passés, les migrations appliquées
et les décisions confirmées devront être mis à jour ici.

Aucun commit, push, merge, suppression ou remplacement de fichier ne doit

## MVP implemente

- Le middleware Yeria verifie le JWT et expose `req.user.yeriaSub`.
- Les routes publiques, profils prestataires et demandes client sont montees sous `/api/v1`.
- Les nouvelles demandes utilisent `ServiceRequest.clientYeriaSub`.
- `ProviderProfile.yeriaSub` est unique et `userId` reste nullable pour l'historique.
- `APPROVED` est canonique; `VERIFIED` reste lisible pour les anciennes donnees.
- Les trois migrations additives sont pretes mais non appliquees.
- Les tests unitaires et HTTP MVP passent sans connexion reelle a PostgreSQL.

## Mise a jour - demandes prestataire

- Les routes prestataire sont montees sous `/api/v1/providers/requests`.
- L'acces est determine exclusivement par `req.user.yeriaSub` et le profil `ProviderProfile` APPROVED (VERIFIED reste accepte pour les donnees historiques).
- Les transitions autorisees sont `OPEN -> ACCEPTED`, `OPEN -> DECLINED` et `ACCEPTED -> COMPLETED`.
- Chaque transition est realisee dans une transaction et cree un enregistrement `RequestEvent` avec l'identite Yeria verifiee.
- La migration additive `20261108140000_request_events_provider_workflow` est prete mais n'a pas ete appliquee.
- Les tests HTTP couvrent la propriete du profil, les transitions et l'historisation simulee.

## Etat restant

- Tester les quatre migrations sur une base PostgreSQL de test, sans les appliquer en production.
- Executer un test avec un vrai JWT Yeria et verifier le comportement via l'URL publique.
- Nettoyer les anciennes entrees `DevUserId` de la documentation historique lorsqu'elles seront remplacees par les modules correspondants.
- Ajouter les tests d'integration PostgreSQL reels.
être effectué sans demande explicite.
