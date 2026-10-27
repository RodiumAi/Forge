# Configurer la clé

Créez une clé dans votre tableau de bord RodiumAi : elle commence par `rd_sk_` et n'est affichée qu'une fois.

:::tabs group="os"
@tab macOS et Linux
```terminal
$ export RODIUMAI_API_KEY="rd_sk_..."
```
@tab Windows
```terminal
PS> $env:RODIUMAI_API_KEY = "rd_sk_..."
```
:::

:::danger Ne publiez jamais votre clé
Gardez-la dans une variable d'environnement ou un gestionnaire de secrets, jamais dans le code ni dans un dépôt Git.
:::
