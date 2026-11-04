# @liena/mobile

Structure **Yeria** sans code — référence : [fullstack-structure.md](../../docs/architecture/fullstack-structure.md).

```
src/
  config/
  views/
  modules/
  services/
  actions/
  validators/
  utils/
  index.ts        ← à créer (point d’entrée)
tests/
```

Les vues signées seront servies par `@liena/api` ; ce package accueille config client, parcours et tests.
