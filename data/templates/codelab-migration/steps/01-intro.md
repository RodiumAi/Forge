# Stratégie de migration

Réécrire toute une base de code d'un coup est risqué. Vous allez migrer **progressivement** : TypeScript accepte les fichiers `.js` existants, et vous convertissez un fichier à la fois.

:::warning
Gardez les tests verts à chaque étape. Une migration qui casse la production n'est pas une migration, c'est une panne.
:::

```download
starter
```
