# Charger des données

Remplacez la liste fixe par des données chargées au montage du composant.

```tsx title="src/App.tsx"
import { useEffect, useState } from "react";
import { MovieList, type Movie } from "./MovieList";

export default function App() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/movies.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
      .then(setMovies)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <p role="alert">Erreur : {error}</p>;
  return <MovieList movies={movies} />;
}
```

Placez un fichier `public/movies.json` avec quelques films pour tester.

:::danger
N'appelez jamais `setMovies` en dehors d'un effet ou d'un gestionnaire d'événement : vous provoqueriez une boucle de rendus.
:::
