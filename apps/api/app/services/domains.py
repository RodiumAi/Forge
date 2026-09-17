"""Custom domains — Vercel-style CNAME flow (v1).

State machine: pending_dns → processing → validated | failed.
Every transition happens inside `advance_verification`, which is re-entrant,
idempotent and fast (< a few seconds): it advances as far as the outside world
allows (DNS propagation, ACM issuance) then returns. The UI re-polls.

Degraded mode (local/dev/CI): when AWS is not configured
(`custom_domain_aws_enabled` is False) there is no ACM record and a claim is
promoted after its ownership TXT and routing CNAME are both proven.
"""

from __future__ import annotations

import logging
import re
import secrets
import time
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.models import Project, ProjectDomain, ProjectDomainClaim

logger = logging.getLogger("domains")

STATUS_PENDING_DNS = "pending_dns"
STATUS_PROCESSING = "processing"
STATUS_VALIDATED = "validated"
STATUS_FAILED = "failed"

_LABEL_RE = re.compile(r"^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$")
CLAIM_TTL = timedelta(hours=24)


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


_zone_cache: dict[str, str] = {}


def zone_for(hostname: str) -> str:
    """DNS zone (registrable domain) that holds `hostname`'s records.

    Registrars expect the Name column *relative to the zone*, not to the
    hostname: connecting `www.tokui.ptoke.me` on a `ptoke.me` zone needs
    Name `www.tokui`, not `www`. We ask the DNS for the real zone cut
    (handles ptoke.me as well as co.uk-style suffixes), falling back to the
    last two labels when resolution is unavailable.
    """
    cached = _zone_cache.get(hostname)
    if cached:
        return cached
    zone = ""
    try:
        import dns.resolver  # dnspython

        zone = str(dns.resolver.zone_for_name(hostname)).rstrip(".").lower()
    except Exception:
        zone = ""
    if not zone or zone == "." or not hostname.endswith(zone) or zone == hostname:
        zone = ".".join(hostname.split(".")[-2:])
    _zone_cache[hostname] = zone
    return zone


def relative_to_zone(fqdn: str, zone: str) -> str:
    """`_t.www.tokui.ptoke.me` relative to zone `ptoke.me` → `_t.www.tokui`."""
    name = fqdn.rstrip(".").lower()
    zone = zone.rstrip(".").lower()
    if name == zone:
        return "@"
    if zone and name.endswith("." + zone):
        return name[: -(len(zone) + 1)]
    return name


def dns_records_for(domain: ProjectDomain | ProjectDomainClaim, *, zone: str | None = None) -> list[dict]:
    zone = zone or zone_for(domain.hostname)
    records = []
    if domain.ownership_txt_name and domain.ownership_txt_value:
        full = domain.ownership_txt_name.rstrip(".")
        records.append(
            {
                "purpose": "ownership",
                "type": "TXT",
                "name": relative_to_zone(full, zone),
                "full_name": full,
                "value": domain.ownership_txt_value,
            }
        )
    records.append(
        {
            "purpose": "routing",
            "type": "CNAME",
            "name": relative_to_zone(domain.hostname, zone),
            "full_name": domain.hostname,
            "value": domain.cname_target,
        }
    )
    if getattr(domain, "acm_validation_name", None) and getattr(domain, "acm_validation_value", None):
        full = domain.acm_validation_name.rstrip(".")
        records.append(
            {
                "purpose": "acm_validation",
                "type": "CNAME",
                "name": relative_to_zone(full, zone),
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


def get_project_domain_claim(db: Session, project_id) -> ProjectDomainClaim | None:
    return db.query(ProjectDomainClaim).filter(ProjectDomainClaim.project_id == project_id).first()


def new_domain_claim(project: Project, user_id, hostname: str, cname_target: str) -> ProjectDomainClaim:
    """Create a fresh generation; prior TXT values can never satisfy it."""
    token = secrets.token_urlsafe(32)
    return ProjectDomainClaim(
        project_id=project.id,
        user_id=user_id,
        hostname=hostname,
        cname_target=cname_target,
        ownership_txt_name=f"_rodiumai-challenge.{hostname}",
        ownership_txt_value=f"rodiumai-domain-verification={token}",
        expires_at=datetime.now(UTC) + CLAIM_TTL,
    )


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


def resolve_txt(hostname: str) -> set[str]:
    """Return normalized TXT payloads from all records at ``hostname``."""
    try:
        import dns.resolver
    except ImportError:  # pragma: no cover
        logger.warning("dnspython missing — cannot resolve TXT for %s", hostname)
        return set()
    try:
        answers = dns.resolver.resolve(hostname, "TXT", lifetime=4.0)
        values = set()
        for rdata in answers:
            if hasattr(rdata, "strings"):
                values.add(b"".join(rdata.strings).decode("utf-8"))
            else:
                values.add(str(rdata).strip('"'))
        return values
    except Exception:
        return set()


def _cname_matches(hostname: str, expected: str, resolver) -> bool:
    target = resolver(hostname)
    return bool(target) and target.rstrip(".").lower() == expected.rstrip(".").lower()


def claim_dns_proven(
    claim: ProjectDomainClaim,
    *,
    cname_resolver=resolve_cname,
    txt_resolver=resolve_txt,
    now: datetime | None = None,
) -> bool:
    """Require both tenant-bound TXT proof and routing before any ACM call."""
    now = now or datetime.now(UTC)
    if claim.expires_at <= now:
        claim.last_error = "ownership_challenge_expired"
        return False
    if claim.ownership_txt_value not in txt_resolver(claim.ownership_txt_name):
        claim.last_error = "ownership_txt_missing"
        return False
    if not _cname_matches(claim.hostname, claim.cname_target, cname_resolver):
        claim.last_error = "routing_cname_missing"
        return False
    claim.last_error = None
    return True


# ── AWS (ACM + ALB) — every call optional / degraded-mode aware ─────────────


def _acm_client():  # pragma: no cover - thin boto3 wrapper
    import boto3

    return boto3.client("acm")


def _elbv2_client():  # pragma: no cover - thin boto3 wrapper
    import boto3

    return boto3.client("elbv2")


def request_certificate(domain: ProjectDomain, *, acm=None) -> None:
    """Request an ACM cert and store its DNS validation CNAME on the domain."""
    if domain.ownership_verified_at is None:
        raise RuntimeError("ownership_proof_required")
    acm = acm or _acm_client()
    if not domain.acm_idempotency_token:
        domain.acm_idempotency_token = uuid.uuid4().hex
    resp = acm.request_certificate(
        DomainName=domain.hostname,
        ValidationMethod="DNS",
        IdempotencyToken=domain.acm_idempotency_token,
    )
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


class DomainClaimConflictError(RuntimeError):
    """The proven hostname became active for another project."""


class DomainClaimStaleError(RuntimeError):
    """The verified generation expired or was replaced."""


def promote_domain_claim(
    db: Session,
    claim_id,
    settings: Settings,
) -> tuple[ProjectDomain, ProjectDomain | None]:
    """Atomically consume one proven generation and reserve its hostname.

    The caller verifies DNS before entering this short transaction. Locking and
    matching the claim id ensure a replaced generation cannot be replayed.
    """
    claim = db.query(ProjectDomainClaim).filter(ProjectDomainClaim.id == claim_id).with_for_update().first()
    if claim is None or claim.expires_at <= datetime.now(UTC):
        raise DomainClaimStaleError

    taken = (
        db.query(ProjectDomain)
        .filter(
            ProjectDomain.hostname == claim.hostname,
            ProjectDomain.project_id != claim.project_id,
        )
        .first()
    )
    if taken is not None:
        raise DomainClaimConflictError

    old_domain = get_project_domain(db, claim.project_id)
    if old_domain is not None and old_domain.hostname == claim.hostname:
        db.delete(claim)
        db.flush()
        return old_domain, None

    if old_domain is not None:
        db.delete(old_domain)
        db.flush()

    domain_id = uuid.uuid4()
    verified_at = datetime.now(UTC)
    domain = ProjectDomain(
        id=domain_id,
        project_id=claim.project_id,
        hostname=claim.hostname,
        status=STATUS_PROCESSING if settings.custom_domain_aws_enabled else STATUS_VALIDATED,
        cname_target=claim.cname_target,
        acm_idempotency_token=domain_id.hex,
        ownership_txt_name=claim.ownership_txt_name,
        ownership_txt_value=claim.ownership_txt_value,
        ownership_verified_at=verified_at,
        verified_at=None if settings.custom_domain_aws_enabled else verified_at,
    )
    db.add(domain)
    db.delete(claim)
    db.flush()
    return domain, old_domain


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

    # Ownership was already proven while promoting the claim. In degraded
    # mode there is no certificate state left to wait for.
    if not settings.custom_domain_aws_enabled:
        domain.status = STATUS_VALIDATED
        domain.last_error = None
        domain.verified_at = datetime.now(UTC)
        return domain

    try:
        # 2) ACM validation CNAME must be in place.
        if not domain.acm_validation_name or not domain.acm_validation_value:
            if domain.ownership_verified_at is None:
                domain.status = STATUS_FAILED
                domain.last_error = "ownership_proof_required"
                return domain
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
