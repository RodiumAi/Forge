# Convertir le serveur

Renommez `src/server.js` en `src/server.ts`, puis remplacez `require` par `import` :

```ts title="src/server.ts" diff
-const express = require("express");
+import express from "express";

-const users = [{ id: 1, name: "Awa", email: "awa@example.com" }];
+type User = { id: number; name: string; email: string };
+
+const users: User[] = [{ id: 1, name: "Awa", email: "awa@example.com" }];
```

```terminal
$ npx tsx src/server.ts
API sur http://localhost:3000
```
