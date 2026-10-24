import pandas as pd

ventes = pd.read_csv("ventes.csv", parse_dates=["date"])
ventes["mois"] = ventes["date"].dt.to_period("M")

par_mois = ventes.groupby("mois")["montant"].sum()
print(par_mois)

top = ventes.groupby("produit")["montant"].sum().nlargest(3)
print(top)
