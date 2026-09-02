"""Custom domains — hostname normalization + verification state machine."""

import types
from datetime import UTC

import pytest

from app.services.domains import (
    STATUS_FAILED,
    STATUS_PENDING_DNS,
    STATUS_PROCESSING,
    STATUS_VALIDATED,
    DomainValidationError,
    advance_verification,
    dns_records_for,
    normalize_hostname,
    public_url_for_domain,
    relative_label,
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
        **overrides,
    }
    return types.SimpleNamespace(
        **values,
        effective_custom_domain_cname_target=(
            values["custom_domain_cname_target"].strip().rstrip(".")
            or f"sites.{values['sites_base_domain'].split(':')[0]}"
        ),
        custom_domain_aws_enabled=bool(
            values["custom_domain_alb_listener_arn"] and values["custom_domain_gateway_tg_arn"]
        ),
        environment=base.environment,
    )


def _domain(**overrides):
    defaults = dict(
        hostname="www.client.com",
        status=STATUS_PENDING_DNS,
        cname_target="sites.forge.rodiumai.io",
        acm_validation_name=None,
        acm_validation_value=None,
        acm_certificate_arn=None,
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
