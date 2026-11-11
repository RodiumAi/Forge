"""Same table as the Nest backend (src/common/validation/signup-email.spec.ts)
and the Forge web app (apps/web/lib/signup-email.test.ts); change all together."""

import pytest

from app.services.signup_email import signup_email_problem

REFUSED = [
    "ops@rodiumai.io",
    "OPS@RodiumAi.IO",
    "  someone@rodiumai.io  ",
    "a@rodiumai.com",
    "a@x.rodiumai.io",
    "rodiumai.dev@gmail.com",
    "myrodiumaiaccount@gmail.com",
    "a@gmail.rodiumai",
    "jane@example.com",
    "jane@example.org",
    "jane@example.net",
    "jane@mail.example.co",
    "jane@foo.test",
    "jane@test.com",
    "jane@site.invalid",
    "jane@localhost",
    "jane@box.local",
    "jane@corp.example",
    "jane@localhost.com",
    "test@gmail.com",
    "test1@gmail.com",
    "test.1@gmail.com",
    "test_42@gmail.com",
    "test-7@gmail.com",
    "test+promo@gmail.com",
    "testing@outlook.com",
    "tester@outlook.com",
    "tests@outlook.com",
    "example@gmail.com",
    "exemple@gmail.com",
    "demo@company.fr",
    "fake@gmail.com",
    "dummy@gmail.com",
    "sample@gmail.com",
    "foo@gmail.com",
    "bar@gmail.com",
    "foobar@gmail.com",
    "baz@gmail.com",
    "asdf@gmail.com",
    "qwerty@gmail.com",
    "azerty@gmail.com",
    "abc@gmail.com",
    "abc123@gmail.com",
    "xxx@gmail.com",
    "aaa@gmail.com",
    "noreply@company.com",
    "no-reply@company.com",
    "nobody@company.com",
    "null@gmail.com",
    "undefined@gmail.com",
    "",
    "no-at-sign",
    "@gmail.com",
    "jane@",
]

ALLOWED = [
    "jane.doe@gmail.com",
    "contest@gmail.com",
    "sample.store@shop.com",
    "testimony@gmail.com",
    "latest@gmail.com",
    "protest@yahoo.fr",
    "demonstration@gmail.com",
    "foobarista@gmail.com",
    "abcd@gmail.com",
    "bart@gmail.com",
    "jane+test@gmail.com",
    "jane@testing.com",
    "jane@contest.io",
    "jane@examples.com",
    "jane@local.fr",
    "jane@company.co.uk",
    "parfait.toke@outlook.com",
    "rodium@gmail.com",
    "jane@rodium.ai",
]


@pytest.mark.parametrize("email", REFUSED)
def test_refuses(email):
    assert signup_email_problem(email) == "invalid_email_address"


@pytest.mark.parametrize("email", ALLOWED)
def test_allows(email):
    assert signup_email_problem(email) is None


# ── POST /auth/register ────────────────────────────────────────────────────


@pytest.mark.parametrize("email", ["ops@rodiumai.io", "rodiumai.dev@gmail.com", "test@gmail.com"])
def test_register_refuses_a_reserved_address_before_any_lookup(monkeypatch, email):
    from unittest.mock import MagicMock

    from fastapi import HTTPException

    from app.routers import auth as auth_mod
    from app.schemas import RegisterRequest

    monkeypatch.setattr(auth_mod.rate_limit, "enforce", lambda *_a, **_k: None)
    sent = MagicMock()
    monkeypatch.setattr(auth_mod, "_send_verification_email", sent)
    request = MagicMock()
    request.headers = {"accept-language": "en"}
    db = MagicMock()

    with pytest.raises(HTTPException) as exc:
        auth_mod.register(
            body=RegisterRequest(email=email, password="Correct-horse-1", name="Ada"),
            request=request,
            db=db,
        )

    assert exc.value.status_code == 400
    assert exc.value.detail == "Please enter a valid email address."
    db.query.assert_not_called()
    db.add.assert_not_called()
    sent.assert_not_called()
