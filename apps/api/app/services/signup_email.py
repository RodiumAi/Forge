"""Addresses that may never open a new Forge account.

Same rule as the RodiumAi backend (``src/common/validation/signup-email.ts`` in
the Nest repo), which refuses these addresses with ``invalid_email_address``.
Keep the two rule sets and their test tables identical.

Applied where a new account is born only: local registration and the first
Google/GitHub sign-in. Signing in to an account that already exists, password
reset and accounts that come from a RodiumAi sign-in are not affected (staff
accounts on ``@rodiumai.io`` are created from the RodiumAi admin and sign in
like anyone else).
"""

from __future__ import annotations

import re

INVALID_EMAIL_ADDRESS = "invalid_email_address"

# Domain labels reserved for documentation and testing (RFC 2606 / 6761).
_RESERVED_LABELS = frozenset({"example", "test", "invalid", "localhost"})
# Top-level domains that never route real mail.
_RESERVED_TLDS = frozenset({"test", "example", "invalid", "localhost", "local"})
# Whole local parts that are placeholders, optionally followed by digits.
_PLACEHOLDER_LOCAL = re.compile(
    r"^(test|testing|tester|tests|example|exemple|demo|fake|dummy|sample|foo|bar|foobar|baz"
    r"|asdf|qwerty|azerty|abc|xxx|aaa|noreply|no-reply|nobody|null|undefined)[._-]?\d*$"
)


def signup_email_problem(email: str | None) -> str | None:
    """``"invalid_email_address"`` when ``email`` may not open an account, else ``None``."""
    normalized = (email or "").strip().lower()
    at = normalized.rfind("@")
    if at <= 0 or at == len(normalized) - 1:
        return INVALID_EMAIL_ADDRESS

    # 1. Our own name, anywhere in the address.
    if "rodiumai" in normalized:
        return INVALID_EMAIL_ADDRESS

    # 2. Reserved domains and TLDs.
    labels = normalized[at + 1 :].split(".")
    if any(label in _RESERVED_LABELS for label in labels):
        return INVALID_EMAIL_ADDRESS
    if labels[-1] in _RESERVED_TLDS:
        return INVALID_EMAIL_ADDRESS

    # 3. Placeholder local part (a ``+tag`` suffix is ignored).
    local = normalized[:at].split("+", 1)[0]
    if _PLACEHOLDER_LOCAL.fullmatch(local):
        return INVALID_EMAIL_ADDRESS

    return None
