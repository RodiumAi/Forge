# Nettoyer

Les données réelles ont des trous. Comptez-les avant de décider quoi faire.

```py title="analyse.py"
print(ventes.isna().sum())
ventes = ventes.dropna(subset=["montant"])
ventes["produit"] = ventes["produit"].str.strip().str.capitalize()
```

:::warning
Supprimer des lignes change les totaux. Notez combien vous en retirez et pourquoi.
:::
