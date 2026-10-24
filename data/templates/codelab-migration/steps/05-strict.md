# Activer le mode strict

Le mode strict est déjà actif dans `tsconfig.json`. Vérifiez qu'il ne reste aucune erreur :

```terminal
$ npx tsc --noEmit
$ echo $?
0
```

Mettez à jour les scripts du projet :

```json title="package.json" diff
   "scripts": {
-    "start": "node src/server.js"
+    "build": "tsc",
+    "start": "node dist/server.js",
+    "dev": "tsx watch src/server.ts"
   }
```

:::info Et ensuite ?
Retirez `allowJs` quand plus aucun fichier `.js` ne reste dans `src/`.
:::

```download
solution
```
