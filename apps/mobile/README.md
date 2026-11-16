# @liena/mobile

Définitions des **vues Yeria** (SGUI) pour l’application Liena, alignées sur le document « Liste des écrans ».

| Écran | Vue SDK | Fichier |
| ----- | ------- | ------- |
| 1 Accueil | ActionListView | `src/views/home.view.ts` |
| 2 Métiers | ActionGridView | `src/views/categories-grid.view.ts` |
| 3 Services du métier / recherche | ActionGridView | `src/views/services-grid.view.ts` |
| 4 Prestataires | ActionGridView | `src/views/provider-results.view.ts` |
| 5 Fiche prestataire | ReaderView | `src/views/provider-detail.view.ts` |
| 5 Carte | MapView | `src/views/providers-map.view.ts` |
| 6 Devenir prestataire | FormView | `src/views/provider-onboarding.view.ts` |
| 7 Gestion | ActionListView | `src/views/provider-manage.view.ts` |

L’API signe et expose ces vues sous `/screens/*` (`apps/api/src/modules/yeria`).

```bash
npm run build --workspace @liena/mobile
```
