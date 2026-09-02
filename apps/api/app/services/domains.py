"""Custom domains — Vercel-style CNAME flow (v1).

State machine: pending_dns → processing → validated | failed.
Every transition happens inside `advance_verification`, which is re-entrant,
idempotent and fast (< a few seconds): it advances as far as the outside world
allows (DNS propagation, ACM issuance) then returns. The UI re-polls.

Degraded mode (local/dev/CI): when AWS is not configured
(`custom_domain_aws_enabled` is False) there is no ACM record and verify goes
straight from a propagated routing CNAME to `validated`.
"""

from __future__ import annotations

import logging
import re
import time
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.models import Project, ProjectDomain

logger = logging.getLogger("domains")

STATUS_PENDING_DNS = "pending_dns"
STATUS_PROCESSING = "processing"
STATUS_VALIDATED = "validated"
STATUS_FAILED = "failed"

_LABEL_RE = re.compile(r"^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$")

# Verify triggers external DNS lookups + AWS calls — light per-project limit.
VERIFY_MIN_INTERVAL_SECONDS = 5.0
_last_verify_at: dict[str, float] = {}


class DomainValidationError(ValueError):
    """User-facing hostname validation failure."""


def normalize_hostname(raw: str, settings: Settings | None = None) -> str:
    """Lowercase + punycode + structural checks. v1: subdomains only (no apex)."""
    settings = settings or get_settings()
    host = (raw or "").strip().strip(".").lower()
    host = re.sub(r"^https?://", "", host).split("/")[0].split(":")[0]
    if not host:
        raise DomainValidationError("empty_hostname")
    try:
        host = host.encode("idna").decode("ascii")
    except (UnicodeError, UnicodeDecodeError) as exc:
        raise DomainValidationError("invalid_hostname") from exc
    if len(host) > 253:
        raise DomainValidationError("invalid_hostname")
    labels = host.split(".")
    if any(not _LABEL_RE.match(label) for label in labels):
        raise DomainValidationError("invalid_hostname")
    # v1: CNAME only → require a subdomain (www.client.com, blog.x.io, …).
    if len(labels) < 3:
        raise DomainValidationError("apex_not_supported")
    # Never allow claiming our own infrastructure hostnames.
    own = {
        settings.sites_base_domain.split(":")[0],
        settings.preview_public_host.split(":")[0],
        settings.effective_custom_domain_cname_target,
    }
    for suffix in own:
        if suffix and (host == suffix or host.endswith("." + suffix)):
            raise DomainValidationError("reserved_hostname")
    return host


def relative_label(hostname: str) -> str:
    """`www.client.com` → `www` (what the registrar's Name column expects)."""
    return hostname.split(".")[0]


def dns_records_for(domain: ProjectDomain) -> list[dict]:
    records = [
        {
            "purpose": "routing",
            "type": "CNAME",
            "name": relative_label(domain.hostname),
            "full_name": domain.hostname,
            "value": domain.cname_target,
        }
    ]
    if domain.acm_validation_name and domain.acm_validation_value:
        # ACM name is a FQDN like `_token.www.client.com.` — display relative.
        full = domain.acm_validation_name.rstrip(".")
        zone_suffix = "." + ".".join(domain.hostname.split(".")[1:])
        rel = full[: -len(zone_suffix)] if full.endswith(zone_suffix) else full
        records.append(
            {
                "purpose": "acm_validation",
                "type": "CNAME",
                "name": rel,
                "full_name": full,
                "value": domain.acm_validation_value,
            }
        )
    return records


def public_url_for_domain(domain: ProjectDomain | None) -> str | None:
    if domain is not None and domain.status == STATUS_VALIDATED:
        return f"https://{domain.hostname}"
    return None


def get_project_domain(db: Session, project_id) -> ProjectDomain | None:
    return db.query(ProjectDomain).filter(ProjectDomain.project_id == project_id).first()


def sites_url_for_project(settings: Settings, project: Project, domain: ProjectDomain | None) -> str:
    """Public URL: validated custom domain wins, slug URL otherwise."""
    return public_url_for_domain(domain) or settings.sites_url_for_slug(project.slug)


# ── DNS resolution (patched in tests) ────────────────────────────────────────


def resolve_cname(hostname: str) -> str | None:
    """Return the CNAME target of `hostname`, or None when absent/unresolvable."""
    try:
        import dns.resolver  # dnspython
    except ImportError:  # pragma: no cover - dependency present in prod image
        logger.warning("dnspython missing — cannot resolve CNAME for %s", hostname)
        return None
    try:
        answers = dns.resolver.resolve(hostname, "CNAME", lifetime=4.0)
        for rdata in answers:
            return str(rdata.target).rstrip(".").lower()
    except Exception:
        return None
    return None


def _cname_matches(hostname: str, expected: str, resolver) -> bool:
    target = resolver(hostname)
    return bool(target) and target.rstrip(".").lower() == expected.rstrip(".").lower()


# ── AWS (ACM + ALB) — every call optional / degraded-mode aware ─────────────


def _acm_client():  # pragma: no cover - thin boto3 wrapper
    import boto3

    return boto3.client("acm")


def _elbv2_client():  # pragma: no cover - thin boto3 wrapper
    import boto3

    return boto3.client("elbv2")


def request_certificate(domain: ProjectDomain, *, acm=None) -> None:
    """Request an ACM cert and store its DNS validation CNAME on the domain."""
    acm = acm or _acm_client()
    resp = acm.request_certificate(DomainName=domain.hostname, ValidationMethod="DNS")
    arn = resp["CertificateArn"]
    domain.acm_certificate_arn = arn
    # The validation record can lag a few seconds after request_certificate.
    for _ in range(10):
        desc = acm.describe_certificate(CertificateArn=arn)
        options = desc.get("Certificate", {}).get("DomainValidationOptions") or []
        record = (options[0].get("ResourceRecord") if options else None) or {}
        if record.get("Name") and record.get("Value"):
            domain.acm_validation_name = record["Name"]
            domain.acm_validation_value = record["Value"]
            return
        time.sleep(1)
    logger.warning("ACM validation record not ready for %s", domain.hostname)


def certificate_issued(domain: ProjectDomain, *, acm=None) -> bool:
    if not domain.acm_certificate_arn:
        return False
    acm = acm or _acm_client()
    desc = acm.describe_certificate(CertificateArn=domain.acm_certificate_arn)
    return desc.get("Certificate", {}).get("Status") == "ISSUED"


def attach_to_alb(domain: ProjectDomain, settings: Settings, *, elbv2=None) -> None:
    """Attach the issued cert to the HTTPS listener + add the host rule."""
    elbv2 = elbv2 or _elbv2_client()
    listener_arn = settings.custom_domain_alb_listener_arn
    elbv2.add_listener_certificates(
        ListenerArn=listener_arn,
        Certificates=[{"CertificateArn": domain.acm_certificate_arn}],
    )
    existing = elbv2.describe_rules(ListenerArn=listener_arn).get("Rules", [])
    priorities = {int(r["Priority"]) for r in existing if str(r.get("Priority", "")).isdigit()}
    if any(
        c.get("Field") == "host-header" and domain.hostname in (c.get("Values") or [])
        for r in existing
        for c in (r.get("Conditions") or [])
    ):
        return  # idempotent — rule already exists
    priority = 10
    while priority in priorities:
        priority += 1
    elbv2.create_rule(
        ListenerArn=listener_arn,
        Priority=priority,
        Conditions=[{"Field": "host-header", "Values": [domain.hostname]}],
        Actions=[{"Type": "forward", "TargetGroupArn": settings.custom_domain_gateway_tg_arn}],
    )


def cleanup_aws(domain: ProjectDomain, settings: Settings, *, acm=None, elbv2=None) -> None:
    """Best-effort teardown — used by DELETE and by PUT replacement."""
    if not settings.custom_domain_aws_enabled or not domain.acm_certificate_arn:
        return
    listener_arn = settings.custom_domain_alb_listener_arn
    try:
        elbv2 = elbv2 or _elbv2_client()
        for rule in elbv2.describe_rules(ListenerArn=listener_arn).get("Rules", []):
            for cond in rule.get("Conditions") or []:
                if cond.get("Field") == "host-header" and domain.hostname in (cond.get("Values") or []):
                    elbv2.delete_rule(RuleArn=rule["RuleArn"])
        elbv2.remove_listener_certificates(
            ListenerArn=listener_arn,
            Certificates=[{"CertificateArn": domain.acm_certificate_arn}],
        )
    except Exception:
        logger.warning("ALB cleanup failed for %s", domain.hostname, exc_info=True)
    try:
        (acm or _acm_client()).delete_certificate(CertificateArn=domain.acm_certificate_arn)
    except Exception:
        logger.warning("ACM cert delete failed for %s", domain.hostname, exc_info=True)


# ── State machine ────────────────────────────────────────────────────────────


def verify_rate_limited(project_id: str) -> bool:
    now = time.monotonic()
    last = _last_verify_at.get(project_id, 0.0)
    if now - last < VERIFY_MIN_INTERVAL_SECONDS:
        return True
    _last_verify_at[project_id] = now
    return False


def advance_verification(
    domain: ProjectDomain,
    settings: Settings | None = None,
    *,
    resolver=resolve_cname,
    acm=None,
    elbv2=None,
) -> ProjectDomain:
    """One fast, idempotent verification pass. Never blocks on ACM issuance."""
    settings = settings or get_settings()
    if domain.status == STATUS_VALIDATED:
        return domain

    # 1) Routing CNAME must point at us.
    if not _cname_matches(domain.hostname, domain.cname_target, resolver):
        domain.status = STATUS_PENDING_DNS
        domain.last_error = "routing_cname_missing"
        return domain

    # Degraded mode (no AWS): routing CNAME is all we can check.
    if not settings.custom_domain_aws_enabled:
        domain.status = STATUS_VALIDATED
        domain.last_error = None
        domain.verified_at = datetime.now(UTC)
        return domain

    try:
        # 2) ACM validation CNAME must be in place.
        if not domain.acm_validation_name or not domain.acm_validation_value:
            request_certificate(domain, acm=acm)
            if not domain.acm_validation_name:
                domain.status = STATUS_PROCESSING
                domain.last_error = "acm_record_pending"
                return domain
        if not _cname_matches(
            domain.acm_validation_name.rstrip("."), domain.acm_validation_value.rstrip("."), resolver
        ):
            domain.status = STATUS_PENDING_DNS
            domain.last_error = "acm_cname_missing"
            return domain

        # 3) Cert issued yet? If not, stay processing — the UI re-polls.
        if not certificate_issued(domain, acm=acm):
            domain.status = STATUS_PROCESSING
            domain.last_error = None
            return domain

        # 4) Attach to ALB → validated.
        attach_to_alb(domain, settings, elbv2=elbv2)
        domain.status = STATUS_VALIDATED
        domain.last_error = None
        domain.verified_at = datetime.now(UTC)
        return domain
    except Exception as exc:
        logger.warning("domain verification failed for %s", domain.hostname, exc_info=True)
        domain.status = STATUS_FAILED
        domain.last_error = str(exc)[:500]
        return domain
