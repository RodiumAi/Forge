# Prendre des décisions

```py title="meteo.py" {3,5}
temperature = int(input("Quelle température fait-il ? "))

if temperature > 25:
    print("Il fait chaud, pense à boire !")
else:
    print("Prends une veste.")
```

:::warning L'indentation compte
Les lignes décalées de 4 espaces appartiennent au `if`. Un décalage oublié provoque une `IndentationError`.
:::
