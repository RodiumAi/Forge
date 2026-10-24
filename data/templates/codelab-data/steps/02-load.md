# Charger les données

```terminal
$ pip install pandas matplotlib
```

```py title="analyse.py" {3}
import pandas as pd

ventes = pd.read_csv("ventes.csv", parse_dates=["date"])
print(ventes.head())
print(ventes.dtypes)
```

```terminal
$ python analyse.py
        date produit  montant
0 2026-01-04    Café     12.5
1 2026-01-09     Thé      8.0
```

:::tip
`parse_dates` convertit la colonne en vraies dates : sans lui, vous ne pourriez pas regrouper par mois.
:::
