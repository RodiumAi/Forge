# Gérer les erreurs

Deux codes méritent un message clair dans votre interface :

| Code | Signification | Que faire |
| --- | --- | --- |
| 401 | Clé absente ou invalide | Vérifier la variable d'environnement |
| 402 | Crédits insuffisants | Recharger le portefeuille RODI |

```py title="chat.py" diff
+import openai
+
+try:
     stream = client.chat.completions.create(...)
+except openai.AuthenticationError:
+    print("Clé RodiumAi invalide.")
+except openai.APIStatusError as error:
+    if error.status_code == 402:
+        print("Crédits RODI insuffisants : rechargez votre portefeuille.")
+    else:
+        raise
```

Téléchargez les exemples complets :

```download
examples
```
