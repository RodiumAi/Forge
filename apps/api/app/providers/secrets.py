from __future__ import annotations

from typing import Protocol

from app.config import get_settings


class SecretProvider(Protocol):
    def get(self, name: str) -> str | None:
        ...


class EnvSecretProvider:
    """Lit les secrets depuis Settings / variables d'environnement."""

    def get(self, name: str) -> str | None:
        s = get_settings()
        mapping = {
            "SITE_JWT_MASTER_SECRET": s.site_jwt_master_secret,
            "SITE_JWT_MASTER_SECRET_PREVIOUS": s.site_jwt_master_secret_previous,
            "DEV_MASTER_KEY": s.dev_master_key,
            "RODIUM_OIDC_CLIENT_SECRET": s.rodium_oidc_client_secret,
        }
        value = mapping.get(name)
        if value is not None and str(value).strip():
            return str(value)
        import os

        env = os.environ.get(name)
        return env if env and env.strip() else None


class AwsSecretsManagerProvider:
    """Production. Stub minimal — à brancher quand le secret ARN est disponible."""

    def __init__(self) -> None:
        import boto3

        self._client = boto3.client("secretsmanager", region_name=get_settings().object_store_region)

    def get(self, name: str) -> str | None:
        response = self._client.get_secret_value(SecretId=name)
        return response.get("SecretString")


def build_secret_provider() -> SecretProvider:
    s = get_settings()
    if s.secret_provider == "aws_secrets_manager":
        return AwsSecretsManagerProvider()
    return EnvSecretProvider()
