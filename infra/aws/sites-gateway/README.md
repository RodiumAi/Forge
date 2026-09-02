# Forge Sites Gateway (prod)

Sert les sites publiés `{slug}.forge.rodiumai.io` et les **domaines custom** validés.

## Architecture

```
Client → ALB rodiumai-alb (HTTPS, ACM)
       → forge-sites-gateway-tg
       → ECS forge-sites-gateway (Caddy :80)
           ├─ *.forge.rodiumai.io → slug via map Host
           ├─ custom domain      → forward_auth api-forge /v1/authorize-host
           └─ /*                 → S3 forge-assets-prod/{slug}/…
```

## ARNs prod (eu-west-1, compte 330990434320)

| Ressource | ARN / valeur |
|-----------|----------------|
| ALB DNS | `rodiumai-alb-334140168.eu-west-1.elb.amazonaws.com` |
| Listener HTTPS 443 | `arn:aws:elasticloadbalancing:eu-west-1:330990434320:listener/app/rodiumai-alb/207d44553a3764d8/56e38638ee544466` |
| Target group gateway | `arn:aws:elasticloadbalancing:eu-west-1:330990434320:targetgroup/forge-sites-gateway-tg/4bf460b3badb1eda` |
| ECR image | `330990434320.dkr.ecr.eu-west-1.amazonaws.com/forge/sites-gateway` |

## Checklist one-time (ops)

1. **DNS registrar** `rodiumai.io` : créer `sites.forge.rodiumai.io` → CNAME `rodiumai-alb-334140168.eu-west-1.elb.amazonaws.com`
2. **IAM** : attacher [`../iam/forge-custom-domains-policy.json`](../iam/forge-custom-domains-policy.json) au rôle `rodiumai-ecs-task-role` :
   ```bash
   aws iam put-role-policy \
     --role-name rodiumai-ecs-task-role \
     --policy-name ForgeCustomDomains \
     --policy-document file://infra/aws/iam/forge-custom-domains-policy.json
   ```
3. **ECS task `forge-api`** — ajouter les variables :
   ```
   CUSTOM_DOMAIN_CNAME_TARGET=sites.forge.rodiumai.io
   CUSTOM_DOMAIN_ALB_LISTENER_ARN=arn:aws:elasticloadbalancing:eu-west-1:330990434320:listener/app/rodiumai-alb/207d44553a3764d8/56e38638ee544466
   CUSTOM_DOMAIN_GATEWAY_TG_ARN=arn:aws:elasticloadbalancing:eu-west-1:330990434320:targetgroup/forge-sites-gateway-tg/4bf460b3badb1eda
   ```
4. **Déployer** le gateway : workflow `.github/workflows/deploy-gateway.yml` ou build manuel ECR + `aws ecs update-service`
5. **Test E2E** : domaine que vous contrôlez (ex. `www.test.votredomaine.com`) → 2 CNAME → vérifier dans Forge → `curl -I https://www.test.votredomaine.com`

## Test local (custom domain)

```bash
# 1. Domaine validé en DB (status=validated) pour www.client.com → slug acme
# 2. /etc/hosts : 127.0.0.1 www.client.com
curl -H "Host: www.client.com" http://127.0.0.1:8080/
curl -H "X-Rodium-Forwarded-Host: www.client.com" http://localhost:8100/v1/authorize-host -i
```

## Sécurité

Ne jamais committer de task definitions ECS avec secrets en clair. Utiliser SSM/Secrets Manager et **rotater** toute clé déjà exposée dans l'historique git.
