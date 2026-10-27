# Agréger

```py title="analyse.py" diff
+ventes["mois"] = ventes["date"].dt.to_period("M")
+par_mois = ventes.groupby("mois")["montant"].sum()
+print(par_mois)
+
+top = ventes.groupby("produit")["montant"].sum().nlargest(3)
+print(top)
```

```terminal
$ python analyse.py
mois
2026-01    20.5
2026-02    36.0
2026-03    23.0
```
