"""Lightweight local seed / environment banner for Forge Web."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
API_ROOT = ROOT / "apps" / "api"
# Inside the API container the package lives at /app.
for candidate in (API_ROOT, Path("/app")):
    if candidate.exists() and str(candidate) not in sys.path:
        sys.path.insert(0, str(candidate))

from app.config import get_settings  # noqa: E402


def main() -> None:
    s = get_settings()
    print("Forge Web — local environment")
    print()
    print(f"Environment     {s.environment}")
    print(f"Object store    {s.object_store_endpoint or 'aws/r2 default'}")
    print(f"Mail            {s.mail_provider}  {s.smtp_host}:{s.smtp_port}")
    print(f"Key provider    {s.key_provider}")
    print(f"Queue           {s.queue_provider}  {s.redis_url}")
    print()
    print(f"Gateway         {s.api_base_url}/docs")
    print(f"Sites           http://<slug>.{s.sites_base_domain}")
    print("Mailpit         http://localhost:18025")
    print("MinIO console   http://localhost:9001  (rodiumdev / rodiumdev123)")
    print("Valkey          redis://localhost:6380/0")
    print()
    print("Checklist:")
    print("  curl http://boutique.lvh.me:8080/_rodium/v1/health")
    print("  curl http://localhost:8100/health")


if __name__ == "__main__":
    main()
