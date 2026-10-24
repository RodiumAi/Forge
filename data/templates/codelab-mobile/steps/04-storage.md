# Se souvenir des habitudes

Installez le stockage local :

```terminal
$ npx expo install @react-native-async-storage/async-storage
```

Chargez puis sauvegardez la liste :

```tsx title="app/index.tsx" diff
-import { useState } from "react";
+import { useEffect, useState } from "react";
+import AsyncStorage from "@react-native-async-storage/async-storage";

   const [habits, setHabits] = useState(START);
+
+  useEffect(() => {
+    AsyncStorage.getItem("habits").then((raw) => raw && setHabits(JSON.parse(raw)));
+  }, []);
+
+  useEffect(() => {
+    AsyncStorage.setItem("habits", JSON.stringify(habits));
+  }, [habits]);
```

:::warning
`AsyncStorage` n'est pas chiffré : n'y stockez jamais de mot de passe ou de jeton.
:::
