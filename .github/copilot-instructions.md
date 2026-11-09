# Conventions de développement Liena

## Programmation orientée objet

- Pour toute nouvelle logique métier ou refactorisation, privilégier une conception orientée objet claire : responsabilités cohésives, état encapsulé et comportement exposé par des API explicites.
- Respecter les principes SOLID : responsabilité unique, extension sans modification inutile, substituabilité des implémentations, interfaces ciblées et inversion des dépendances.
- Injecter les dépendances des services et des cas d’usage plutôt que de les construire ou de les lire globalement à l’intérieur de leur logique.
- Utiliser des interfaces et des abstractions lorsqu’elles rendent les frontières du domaine, les contrats ou les tests plus clairs; éviter les classes « fourre-tout », les utilitaires statiques, l’héritage artificiel et les abstractions sans besoin concret.
- Garder les contrôleurs et routes minces : ils traitent le protocole et la validation d’entrée, puis délèguent les cas d’usage aux objets responsables.
- Dans React, conserver les composants de fonction et les hooks idiomatiques. Extraire la logique métier non liée au rendu vers des classes ou services lorsque cela améliore réellement l’encapsulation et la testabilité; ne pas transformer les composants en classes par principe.
- Faire évoluer progressivement le code existant : lors d’une modification, refactoriser seulement la partie nécessaire, préserver le comportement établi et éviter les réécritures globales.
- Tester le comportement des classes métier et des services à travers leurs contrats publics; ajouter ou adapter les tests liés à toute refactorisation.
