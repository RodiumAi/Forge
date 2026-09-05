# Forge Sites Gateway

Sert les sites publiés `{slug}.<votre-domaine>` et les **domaines custom** validés.

## Architecture

```
Client → ALB (HTTPS, certificat ACM)
       → target group du gateway
       → ECS sites-gateway (Caddy :80)
           ├─ *.<votre-domaine>  → slug via map Host
           ├─ custom domain      → forward_auth API /v1/authorize-host
           └─ /*                 → S3 <bucket-assets>/{slug}/…
```

## Valeurs à renseigner

Ce déploiement dépend de ressources AWS propres à votre compte. Relevez-les une
fois créées, puis reportez-les dans les variables d'environnement de la tâche
ECS de l'API (étape 3 ci-dessous).

| Ressource | Où la trouver | Forme attendue |
|-----------|---------------|----------------|
| DNS de l'ALB | Console EC2 → Load balancers | `<nom>-<id>.<region>.elb.amazonaws.com` |
| Listener HTTPS 443 | Console EC2 → Load balancers → Listeners | `arn:aws:elasticloadbalancing:<region>:<account-id>:listener/app/…` |
| Target group du gateway | Console EC2 → Target groups | `arn:aws:elasticloadbalancing:<region>:<account-id>:targetgroup/…` |
| Image ECR | Console ECR → Repositories | `<account-id>.dkr.ecr.<region>.amazonaws.com/forge/sites-gateway` |

> Ne versionnez pas ces valeurs. Un ARN et un identifiant de compte ne sont pas
> des secrets au sens strict, mais publiés ensemble ils dressent une carte
> précise de votre infrastructure. Gardez-les dans votre outillage de
> déploiement privé (SSM, Secrets Manager, variables de CI).

## Checklist one-time (ops)

1. **DNS registrar** : créer `sites.<votre-domaine>` → CNAME vers le DNS de l'ALB
2. **IAM** : attacher [`../iam/forge-custom-domains-policy.json`](../iam/forge-custom-domains-policy.json) au rôle de tâche ECS :
   ```bash
   aws iam put-role-policy \
     --role-name <votre-role-de-tache-ecs> \
     --policy-name ForgeCustomDomains \
     --policy-document file://infra/aws/iam/forge-custom-domains-policy.json
   ```
3. **Tâche ECS de l'API** — ajouter les variables :
   ```
   CUSTOM_DOMAIN_CNAME_TARGET=sites.<votre-domaine>
   CUSTOM_DOMAIN_ALB_LISTENER_ARN=<arn-du-listener-https>
   CUSTOM_DOMAIN_GATEWAY_TG_ARN=<arn-du-target-group>
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

Ne jamais committer de task definitions ECS avec secrets en clair. Utiliser
SSM/Secrets Manager et **rotater** toute clé déjà exposée dans l'historique git.
