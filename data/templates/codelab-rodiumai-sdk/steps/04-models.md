# Lister les modèles

Seuls les modèles listés par `GET /v1/models` sont utilisables. Chaque entrée porte des informations RodiumAi : prix en RODI, capacités, contexte.

```terminal
$ curl -s https://api.rodiumai.io/v1/models -H "Authorization: Bearer $RODIUMAI_API_KEY"
{"object":"list","data":[{"id":"google/gemini-3.7-flash","object":"model", ...}]}
```

:::tip
Filtrez sur `rodiumai_capabilities.supports_vision` pour ne garder que les modèles qui lisent les images.
:::
