# Préparer l'environnement

Créez un environnement virtuel puis installez les dépendances.

:::tabs group="os"
@tab macOS et Linux
```terminal
$ python3 -m venv .venv
$ source .venv/bin/activate
$ pip install -r requirements.txt
Successfully installed fastapi uvicorn pytest httpx
```
@tab Windows
```terminal
PS> py -3.12 -m venv .venv
PS> .venv\Scripts\Activate.ps1
PS> pip install -r requirements.txt
Successfully installed fastapi uvicorn pytest httpx
```
:::

Le fichier `requirements.txt` du projet de départ contient :

```txt title="requirements.txt" download="files/starter/requirements.txt"
fastapi[standard]>=0.115
pytest>=8
httpx>=0.27
```

:::tip
Votre invite de commande affiche `(.venv)` quand l'environnement est actif.
:::
