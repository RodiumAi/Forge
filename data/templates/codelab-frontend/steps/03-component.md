# Un composant compteur

Créez `src/Counter.tsx` :

```tsx title="src/Counter.tsx" {4}
import { useState } from "react";

export function Counter({ start = 0 }: { start?: number }) {
  const [count, setCount] = useState(start);
  return (
    <div className="counter">
      <button onClick={() => setCount((c) => c - 1)} aria-label="Moins">-</button>
      <output>{count}</output>
      <button onClick={() => setCount((c) => c + 1)} aria-label="Plus">+</button>
    </div>
  );
}
```

Puis affichez-le dans `App.tsx` :

```tsx title="src/App.tsx" diff
+import { Counter } from "./Counter";
+
 export default function App() {
-  return <h1>Bonjour</h1>;
+  return (
+    <main>
+      <h1>Films</h1>
+      <Counter start={3} />
+    </main>
+  );
 }
```

:::info
`useState` renvoie la valeur et une fonction pour la changer. Passer une fonction à `setCount` garantit de partir de la dernière valeur.
:::
