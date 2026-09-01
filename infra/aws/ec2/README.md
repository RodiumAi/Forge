# EC2 production stack

See the full runbook:

- [docs/DEPLOYMENT.fr.md](../../docs/DEPLOYMENT.fr.md)
- [docs/DEPLOYMENT.md](../../docs/DEPLOYMENT.md)

Quick start on the instance:

```bash
cp infra/aws/ec2/.env.example infra/aws/ec2/.env
# edit .env
export AWS_REGION=eu-west-1 ECR_REGISTRY=... ECR_REPOSITORY=forge-web-api
./infra/aws/ec2/deploy.sh latest
```
