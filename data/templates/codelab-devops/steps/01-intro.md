# Introduction

Une image Docker contient votre application et tout ce dont elle a besoin. La même image tourne sur votre poste, en CI et en production.

```tree
api/
  main.py
  requirements.txt
  Dockerfile  # vous l'écrivez à l'étape 2
  compose.yaml
  .github/
    workflows/
      ci.yml  # étape 4
```
