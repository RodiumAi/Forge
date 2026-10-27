# Tracer un graphique

```py title="analyse.py"
import matplotlib.pyplot as plt

ax = par_mois.plot(kind="bar", color="#2563EB", title="Ventes par mois")
ax.set_ylabel("Montant (€)")
plt.tight_layout()
plt.savefig("ventes-par-mois.png", dpi=150)
```

:::info
Enregistrez le graphique en PNG pour l'intégrer à un rapport ou à une présentation Forge.
:::

Le script complet :

```download
solution
```
