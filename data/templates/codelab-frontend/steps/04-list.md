# Une liste filtrable

```tsx title="src/MovieList.tsx" {6-8}
import { useState } from "react";

export type Movie = { id: number; title: string; year: number };

export function MovieList({ movies }: { movies: Movie[] }) {
  const [query, setQuery] = useState("");
  const visible = movies.filter((m) =>
    m.title.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <section>
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher" />
      <ul>
        {visible.map((m) => (
          <li key={m.id}>{m.title} ({m.year})</li>
        ))}
      </ul>
    </section>
  );
}
```

:::warning La clé `key`
Chaque élément d'une liste a besoin d'une `key` stable : React s'en sert pour savoir ce qui a changé.
:::
