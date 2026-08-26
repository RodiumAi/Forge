# ALB idle timeout — streams Forge / Sites

Avant le **premier** run agent streamé (SSE) derrière un Application Load Balancer, porter l’idle timeout à **600 secondes**.

Sinon l’ALB coupe la connexion pendant les phases silencieuses (planification LLM, build, etc.), même si l’API est encore vivante.

## AWS CLI

```sh
aws elbv2 modify-load-balancer-attributes \
  --load-balancer-arn "$ALB_ARN" \
  --attributes Key=idle_timeout.timeout_seconds,Value=600
```

Vérifier :

```sh
aws elbv2 describe-load-balancer-attributes \
  --load-balancer-arn "$ALB_ARN" \
  --query "Attributes[?Key=='idle_timeout.timeout_seconds']"
```

## Côté app

| Variable | Défaut | Rôle |
|---|---|---|
| `ALB_IDLE_TIMEOUT_SECONDS` | `600` | Documentation / alignement IaC |
| `SSE_HEARTBEAT_SECONDS` | `15` | Commentaires SSE `: hb …` pour garder proxies / ALB chauds |

Les réponses `text/event-stream` de l’API passent par `with_sse_heartbeats`.
