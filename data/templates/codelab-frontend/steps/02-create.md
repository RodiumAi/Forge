# Créer le projet

:::tabs group="pm"
```terminal title="npm"
$ npm create vite@latest films -- --template react-ts
$ cd films && npm install
$ npm run dev
```
```terminal title="pnpm"
$ pnpm create vite films --template react-ts
$ cd films && pnpm install
$ pnpm dev
```
:::

Le projet ressemble à ceci :

```tree
films/
  index.html
  package.json
  src/
    main.tsx  # point d'entrée
    App.tsx  # composant racine
```
