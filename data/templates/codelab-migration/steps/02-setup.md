# Installer TypeScript

```terminal
$ npm install --save-dev typescript tsx @types/node @types/express
$ npx tsc --init
```

Remplacez la configuration générée :

```json title="tsconfig.json" {8}
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "strict": true,
    "allowJs": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

`allowJs` laisse les fichiers JavaScript compiler tels quels pendant la migration.
