"""Custom domains — hostname normalization + verification state machine."""

import types
import uuid
from datetime import UTC, datetime, timedelta

import pytest

from app.services.domains import (
    STATUS_FAILED,
    STATUS_PENDING_DNS,
    STATUS_PROCESSING,
    STATUS_VALIDATED,
    DomainValidationError,
    advance_verification,
    claim_dns_proven,
    dns_records_for,
    new_domain_claim,
    normalize_hostname,
    public_url_for_domain,
    relative_label,
    request_certificate,
)


def _settings(**overrides):
    from app.config import get_settings

    base = get_settings()
    values = {
        "sites_base_domain": "forge.rodiumai.io",
        "preview_public_host": "lvh.me",
        "custom_domain_cname_target": "",
        "custom_domain_alb_listener_arn": "",
        "custom_domain_gateway_tg_arn": "",
        "environment": base.environment,
        **overrides,
    }
    env = values["environment"]
    return types.SimpleNamespace(
        **values,
        effective_custom_domain_cname_target=(
            values["custom_domain_cname_target"].strip().rstrip(".")
            or f"sites.{values['sites_base_domain'].split(':')[0]}"
        ),
        custom_domain_aws_enabled=bool(
            values["custom_domain_alb_listener_arn"] and values["custom_domain_gateway_tg_arn"]
        ),
        is_local=env in ("local", "test"),
    )


def _domain(**overrides):
    defaults = dict(
        hostname="www.client.com",
        status=STATUS_PENDING_DNS,
        cname_target="sites.forge.rodiumai.io",
        acm_validation_name=None,
        acm_validation_value=None,
        acm_certificate_arn=None,
        acm_idempotency_token=None,
        ownership_txt_name=None,
        ownership_txt_value=None,
        ownership_verified_at=datetime.now(UTC),
        last_error=None,
        verified_at=None,
    )
    defaults.update(overrides)
    return types.SimpleNamespace(**defaults)


class TestNormalizeHostname:
    def test_lowercases_and_strips(self):
        assert normalize_hostname("  WWW.Client.COM. ", _settings()) == "www.client.com"

    def test_strips_scheme_path_and_port(self):
        assert normalize_hostname("https://www.client.com:443/x", _settings()) == "www.client.com"

    def test_punycode(self):
        assert normalize_hostname("www.café.fr", _settings()) == "www.xn--caf-dma.fr"

    def test_rejects_apex(self):
        with pytest.raises(DomainValidationError, match="apex_not_supported"):
            normalize_hostname("client.com", _settings())

    def test_rejects_empty_and_invalid(self):
        with pytest.raises(DomainValidationError):
            normalize_hostname("", _settings())
        with pytest.raises(DomainValidationError):
            normalize_hostname("www.bad_label.com", _settings())

    def test_rejects_own_infrastructure(self):
        with pytest.raises(DomainValidationError, match="reserved_hostname"):
            normalize_hostname("evil.forge.rodiumai.io", _settings())
        with pytest.raises(DomainValidationError, match="reserved_hostname"):
            normalize_hostname("sub.demo.lvh.me", _settings())

    def test_relative_label(self):
        assert relative_label("blog.monentreprise.com") == "blog"


class TestDnsRecords:
    def test_routing_only_without_acm(self):
        records = dns_records_for(_domain(), zone="client.com")
        assert [r["purpose"] for r in records] == ["routing"]
        assert records[0]["name"] == "www"
        assert records[0]["value"] == "sites.forge.rodiumai.io"

    def test_two_records_with_acm_relative_name(self):
        d = _domain(
            acm_validation_name="_a1b2.www.client.com.",
            acm_validation_value="_x9y8.acm-validations.aws.",
        )
        records = dns_records_for(d, zone="client.com")
        assert [r["purpose"] for r in records] == ["routing", "acm_validation"]
        assert records[1]["name"] == "_a1b2.www"
        assert records[1]["full_name"] == "_a1b2.www.client.com"

    def test_multi_label_subdomain_relative_to_zone(self):
        # Connecting www.tokui.ptoke.me on a ptoke.me zone: the registrar
        # expects Name `www.tokui` (and `_t.www.tokui` for ACM), not `www`.
        d = _domain(
            hostname="www.tokui.ptoke.me",
            acm_validation_name="_t.www.tokui.ptoke.me.",
            acm_validation_value="_v.acm-validations.aws.",
        )
        records = dns_records_for(d, zone="ptoke.me")
        assert records[0]["name"] == "www.tokui"
        assert records[0]["full_name"] == "www.tokui.ptoke.me"
        assert records[1]["name"] == "_t.www.tokui"

    def test_single_label_subdomain_on_zone(self):
        d = _domain(hostname="tokui.ptoke.me")
        records = dns_records_for(d, zone="ptoke.me")
        assert records[0]["name"] == "tokui"

    def test_relative_to_zone_helper(self):
        from app.services.domains import relative_to_zone

        assert relative_to_zone("ptoke.me", "ptoke.me") == "@"
        assert relative_to_zone("_t.www.tokui.ptoke.me.", "ptoke.me") == "_t.www.tokui"
        assert relative_to_zone("other.example.com", "ptoke.me") == "other.example.com"


class TestOwnershipClaim:
    def _claim(self, **overrides):
        values = dict(
            id=uuid.uuid4(),
            hostname="www.client.com",
            cname_target="sites.forge.rodiumai.io",
            ownership_txt_name="_rodiumai-challenge.www.client.com",
            ownership_txt_value="rodiumai-domain-verification=fresh",
            expires_at=datetime.now(UTC) + timedelta(minutes=30),
            last_error=None,
        )
        values.update(overrides)
        return types.SimpleNamespace(**values)

    def test_dns_records_show_txt_before_routing(self):
        records = dns_records_for(self._claim(), zone="client.com")
        assert [record["purpose"] for record in records] == ["ownership", "routing"]
        assert records[0]["type"] == "TXT"
        assert records[0]["name"] == "_rodiumai-challenge.www"

    def test_requires_txt_and_cname_before_proof(self):
        claim = self._claim()
        assert not claim_dns_proven(
            claim,
            txt_resolver=lambda _name: set(),
            cname_resolver=lambda _name: "sites.forge.rodiumai.io",
        )
        assert claim.last_error == "ownership_txt_missing"
        assert claim_dns_proven(
            claim,
            txt_resolver=lambda _name: {claim.ownership_txt_value},
            cname_resolver=lambda _name: "sites.forge.rodiumai.io",
        )

    def test_expired_claim_cannot_be_proven(self):
        claim = self._claim(expires_at=datetime.now(UTC) - timedelta(seconds=1))
        assert not claim_dns_proven(
            claim,
            txt_resolver=lambda _name: {claim.ownership_txt_value},
            cname_resolver=lambda _name: "sites.forge.rodiumai.io",
        )
        assert claim.last_error == "ownership_challenge_expired"

    def test_new_generation_has_a_distinct_challenge(self):
        project = types.SimpleNamespace(id=uuid.uuid4())
        user_id = uuid.uuid4()
        first = new_domain_claim(project, user_id, "www.client.com", "sites.forge.rodiumai.io")
        second = new_domain_claim(project, first.user_id, "www.client.com", "sites.forge.rodiumai.io")
        assert (first.project_id, first.user_id, first.hostname) == (
            project.id,
            user_id,
            "www.client.com",
        )
        assert first.ownership_txt_value != second.ownership_txt_value

    def test_pending_claim_hostname_is_not_globally_unique(self):
        from sqlalchemy import UniqueConstraint

        from app.models import ProjectDomain, ProjectDomainClaim

        claim_unique_columns = {
            tuple(column.name for column in constraint.columns)
            for constraint in ProjectDomainClaim.__table__.constraints
            if isinstance(constraint, UniqueConstraint)
        }
        active_unique_columns = {
            tuple(column.name for column in constraint.columns)
            for constraint in ProjectDomain.__table__.constraints
            if isinstance(constraint, UniqueConstraint)
        }
        assert ("hostname",) not in claim_unique_columns
        assert ("hostname",) in active_unique_columns


class TestAcmRequest:
    def test_requires_prior_ownership_proof(self):
        domain = _domain(ownership_verified_at=None)
        with pytest.raises(RuntimeError, match="ownership_proof_required"):
            request_certificate(domain, acm=types.SimpleNamespace())

    def test_sends_stable_idempotency_token(self):
        calls = []

        class Acm:
            def request_certificate(self, **kwargs):
                calls.append(kwargs)
                return {"CertificateArn": "arn:cert"}

            def describe_certificate(self, **_kwargs):
                return {
                    "Certificate": {
                        "DomainValidationOptions": [
                            {
                                "ResourceRecord": {
                                    "Name": "_token.www.client.com.",
                                    "Value": "_value.acm-validations.aws.",
                                }
                            }
                        ]
                    }
                }

        domain = _domain(acm_idempotency_token="a" * 32)
        request_certificate(domain, acm=Acm())
        assert calls[0]["IdempotencyToken"] == "a" * 32


class TestProjectDeletion:
    def test_cleans_active_domain_before_project_row(self, monkeypatch, tmp_path):
        from app.routers import sites_v1
        from app.services import project_delete

        project = types.SimpleNamespace(id=uuid.uuid4(), slug="client")
        domain = _domain()
        deleted = []
        cleaned = []
        cache_cleared = []

        class Query:
            def filter(self, *_args):
                return self

            def first(self):
                return domain

        db = types.SimpleNamespace(
            query=lambda *_args: Query(),
            delete=lambda value: deleted.append(value),
            commit=lambda: None,
        )
        monkeypatch.setattr(project_delete.preview_babel, "stop_babel_preview", lambda *_args: None)
        monkeypatch.setattr(project_delete, "project_dir", lambda *_args: tmp_path / "absent")
        monkeypatch.setattr(
            project_delete,
            "get_settings",
            lambda: types.SimpleNamespace(bucket_site_assets=""),
        )
        monkeypatch.setattr(
            "app.providers.objects.get_object_store",
            lambda: types.SimpleNamespace(bucket_site_assets=""),
        )
        monkeypatch.setattr(
            project_delete,
            "cleanup_aws",
            lambda value, _settings: cleaned.append(value),
        )
        monkeypatch.setattr(sites_v1, "clear_resolve_cache", cache_cleared.append)

        project_delete.delete_project_full(db, project)

        assert cleaned == [domain]
        assert cache_cleared == ["www.client.com"]
        assert deleted == [project]


class TestStateMachine:
    def test_routing_cname_missing_stays_pending(self):
        d = advance_verification(_domain(), _settings(), resolver=lambda h: None)
        assert d.status == STATUS_PENDING_DNS
        assert d.last_error == "routing_cname_missing"

    def test_degraded_mode_validates_on_routing_cname(self):
        d = advance_verification(_domain(), _settings(), resolver=lambda h: "sites.forge.rodiumai.io")
        assert d.status == STATUS_VALIDATED
        assert d.last_error is None
        assert d.verified_at is not None and d.verified_at.tzinfo == UTC
        assert public_url_for_domain(d) == "https://www.client.com"

    def test_degraded_mode_refused_outside_local(self):
        d = advance_verification(
            _domain(),
            _settings(environment="production"),
            resolver=lambda h: "sites.forge.rodiumai.io",
        )
        assert d.status == STATUS_FAILED
        assert d.last_error == "custom_domain_aws_required"
        assert d.verified_at is None

    def test_degraded_mode_refused_in_staging(self):
        d = advance_verification(
            _domain(),
            _settings(environment="staging"),
            resolver=lambda h: "sites.forge.rodiumai.io",
        )
        assert d.status == STATUS_FAILED
        assert d.last_error == "custom_domain_aws_required"

    def _aws_settings(self):
        return _settings(
            custom_domain_alb_listener_arn="arn:listener",
            custom_domain_gateway_tg_arn="arn:tg",
        )

    def _resolver(self, mapping):
        return lambda host: mapping.get(host.rstrip("."))

    def test_acm_cname_missing_stays_pending(self):
        d = _domain(
            acm_validation_name="_t.www.client.com.",
            acm_validation_value="_v.acm-validations.aws.",
            acm_certificate_arn="arn:cert",
        )
        resolver = self._resolver({"www.client.com": "sites.forge.rodiumai.io"})
        d = advance_verification(d, self._aws_settings(), resolver=resolver)
        assert d.status == STATUS_PENDING_DNS
        assert d.last_error == "acm_cname_missing"

    def test_cert_not_issued_goes_processing(self):
        d = _domain(
            acm_validation_name="_t.www.client.com.",
            acm_validation_value="_v.acm-validations.aws.",
            acm_certificate_arn="arn:cert",
        )
        resolver = self._resolver(
            {
                "www.client.com": "sites.forge.rodiumai.io",
                "_t.www.client.com": "_v.acm-validations.aws",
            }
        )
        acm = types.SimpleNamespace(
            describe_certificate=lambda CertificateArn: {"Certificate": {"Status": "PENDING_VALIDATION"}}
        )
        d = advance_verification(d, self._aws_settings(), resolver=resolver, acm=acm)
        assert d.status == STATUS_PROCESSING
        assert d.last_error is None

    def test_issued_cert_attaches_and_validates(self):
        d = _domain(
            acm_validation_name="_t.www.client.com.",
            acm_validation_value="_v.acm-validations.aws.",
            acm_certificate_arn="arn:cert",
        )
        resolver = self._resolver(
            {
                "www.client.com": "sites.forge.rodiumai.io",
                "_t.www.client.com": "_v.acm-validations.aws",
            }
        )
        acm = types.SimpleNamespace(
            describe_certificate=lambda CertificateArn: {"Certificate": {"Status": "ISSUED"}}
        )
        calls = []
        elbv2 = types.SimpleNamespace(
            add_listener_certificates=lambda **kw: calls.append(("cert", kw)),
            describe_rules=lambda **kw: {"Rules": []},
            create_rule=lambda **kw: calls.append(("rule", kw)),
        )
        d = advance_verification(d, self._aws_settings(), resolver=resolver, acm=acm, elbv2=elbv2)
        assert d.status == STATUS_VALIDATED
        assert [c[0] for c in calls] == ["cert", "rule"]
        rule_kw = calls[1][1]
        assert rule_kw["Conditions"][0]["Values"] == ["www.client.com"]

    def test_aws_error_marks_failed_but_retryable(self):
        d = _domain(
            acm_validation_name="_t.www.client.com.",
            acm_validation_value="_v.acm-validations.aws.",
            acm_certificate_arn="arn:cert",
        )
        resolver = self._resolver(
            {
                "www.client.com": "sites.forge.rodiumai.io",
                "_t.www.client.com": "_v.acm-validations.aws",
            }
        )

        def boom(**kw):
            raise RuntimeError("acm down")

        acm = types.SimpleNamespace(describe_certificate=boom)
        d = advance_verification(d, self._aws_settings(), resolver=resolver, acm=acm)
        assert d.status == STATUS_FAILED
        assert "acm down" in (d.last_error or "")
        # Retry after the outage succeeds — the machine is re-entrant.
        acm_ok = types.SimpleNamespace(
            describe_certificate=lambda CertificateArn: {"Certificate": {"Status": "ISSUED"}}
        )
        elbv2 = types.SimpleNamespace(
            add_listener_certificates=lambda **kw: None,
            describe_rules=lambda **kw: {"Rules": []},
            create_rule=lambda **kw: None,
        )
        d = advance_verification(d, self._aws_settings(), resolver=resolver, acm=acm_ok, elbv2=elbv2)
        assert d.status == STATUS_VALIDATED

    def test_validated_is_terminal_noop(self):
        d = _domain(status=STATUS_VALIDATED)
        d = advance_verification(d, _settings(), resolver=lambda h: None)
        assert d.status == STATUS_VALIDATED
