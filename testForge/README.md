# Raw Works Studio

Export Forge — application **frontend** (Vite / React).

## Prérequis

- Node.js 22+ et npm

## Démarrer en local

```bash
npm install
npm run dev
```

Ouvre l’URL affichée par Vite (souvent `http://localhost:5173`).

Pour un build de production :

```bash
npm run build
npm run preview
```

## Variables d’environnement

Les fichiers `.env` ne sont **pas** inclus dans l’export (secrets).
Crée un `.env` local à partir de `.env.example` s’il est présent,
ou copie les clés `VITE_*` dont ton app a besoin.

---

Généré par [Forge](https://forge.rodium.ai).
