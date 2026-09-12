"""Transactional mail for local Forge accounts.

Four transports, chosen by `MAIL_TRANSPORT`:

* ``smtp`` (the default) — plain SMTP, aimed at the Mailpit container the dev
  stack ships. Real delivery semantics with a real inbox at
  http://localhost:8026, and nothing to sign up for. The platform's own API
  uses the same setup, so the two behave alike in development.
* ``console`` — writes the message, link included, to the application log.
  The fallback when someone runs the API outside Docker and has no SMTP
  server at all; everything in the sign-up flow stays real except delivery.
* ``ses`` — AWS SES via boto3, for the hosted instance.
* ``disabled`` — send nothing. Only sensible when every account arrives
  through a federated provider, since verification links become unobtainable.

Sending must never break the request that triggered it. A user who registered
successfully has an account; failing the response because SES was briefly
unreachable would leave them unable to log in with credentials that work. So
every failure is logged and swallowed, and the caller can offer "resend".
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from app.config import get_settings
from app.i18n import Locale, t

logger = logging.getLogger("mail")


@dataclass(frozen=True)
class MailMessage:
    to: str
    subject: str
    text: str
    html: str


def _html_document(title: str, intro: str, cta_label: str, url: str, footer: str) -> str:
    """Deliberately plain HTML.

    Mail clients strip <style> blocks, external CSS and most modern layout, so
    this stays inline-styled and single-column. The text part below carries the
    same information for clients that refuse HTML entirely.
    """
    logo_url = get_settings().web_url("/logo-light.png")
    return f"""\
<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f6f6f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#18181b">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px">
      <div style="text-align:center;margin-bottom:24px">
        <img src="{logo_url}" alt="Forge" width="140" height="40" style="display:inline-block;height:40px;width:auto" />
      </div>
      <h1 style="margin:0 0 16px;font-size:20px;font-weight:600">{title}</h1>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#3f3f46">{intro}</p>
      <p style="margin:0 0 24px">
        <a href="{url}"
           style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;
                  padding:12px 20px;border-radius:8px;font-size:15px;font-weight:500">{cta_label}</a>
      </p>
      <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#71717a">
        {t("mail_fallback_intro", "en")}
      </p>
      <p style="margin:0 0 24px;font-size:12px;word-break:break-all;color:#71717a">{url}</p>
      <p style="margin:0;font-size:13px;line-height:1.6;color:#a1a1aa">{footer}</p>
    </div>
  </body>
</html>"""


def build_verify_email(to: str, url: str, locale: Locale = "en") -> MailMessage:
    title = t("mail_verify_subject", locale)
    intro = t("mail_verify_intro", locale)
    footer = t("mail_verify_footer", locale)
    text = f"{title}\n\n{intro}\n\n{url}\n\n{footer}\n"
    return MailMessage(
        to=to,
        subject=title,
        text=text,
        html=_html_document(title, intro, t("mail_verify_cta", locale), url, footer),
    )


def build_reset_password(to: str, url: str, locale: Locale = "en") -> MailMessage:
    title = t("mail_reset_subject", locale)
    intro = t("mail_reset_intro", locale)
    footer = t("mail_reset_footer", locale)
    text = f"{title}\n\n{intro}\n\n{url}\n\n{footer}\n"
    return MailMessage(
        to=to,
        subject=title,
        text=text,
        html=_html_document(title, intro, t("mail_reset_cta", locale), url, footer),
    )


def build_reset_password_sso_hint(to: str, login_url: str, locale: Locale = "en") -> MailMessage:
    """Inform SSO-only accounts that there is no local password to reset."""
    title = t("mail_reset_sso_subject", locale)
    intro = t("mail_reset_sso_intro", locale)
    footer = t("mail_reset_sso_footer", locale)
    text = f"{title}\n\n{intro}\n\n{login_url}\n\n{footer}\n"
    return MailMessage(
        to=to,
        subject=title,
        text=text,
        html=_html_document(title, intro, t("mail_reset_sso_cta", locale), login_url, footer),
    )


def _send_console(message: MailMessage) -> None:
    # One block, easy to spot in `docker compose logs -f api`.
    logger.info(
        "\n"
        "──────────────────────────── FORGE MAIL ────────────────────────────\n"
        "To:      %s\n"
        "Subject: %s\n"
        "\n%s\n"
        "────────────────────────────────────────────────────────────────────",
        message.to,
        message.subject,
        message.text.strip(),
    )


def _send_smtp(message: MailMessage) -> None:
    """Send through a plain SMTP server (Mailpit locally).

    `smtplib` from the standard library — no dependency for what is a handful
    of lines. Credentials and STARTTLS are optional because Mailpit wants
    neither; a real relay sets them.
    """
    import smtplib
    from email.message import EmailMessage

    settings = get_settings()
    email = EmailMessage()
    email["From"] = settings.mail_from
    email["To"] = message.to
    email["Subject"] = message.subject
    email.set_content(message.text)
    email.add_alternative(message.html, subtype="html")

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
        if settings.smtp_starttls:
            server.starttls()
        if settings.smtp_user:
            server.login(settings.smtp_user, settings.smtp_password)
        server.send_message(email)


def _send_ses(message: MailMessage) -> None:
    import boto3  # imported lazily: a console/disabled deploy should not need it

    settings = get_settings()
    client = boto3.client(
        "ses",
        region_name=settings.aws_s3_region,
        aws_access_key_id=settings.aws_access_key_id or None,
        aws_secret_access_key=settings.aws_secret_access_key or None,
    )
    client.send_email(
        Source=settings.mail_from,
        Destination={"ToAddresses": [message.to]},
        Message={
            "Subject": {"Data": message.subject, "Charset": "UTF-8"},
            "Body": {
                "Text": {"Data": message.text, "Charset": "UTF-8"},
                "Html": {"Data": message.html, "Charset": "UTF-8"},
            },
        },
    )


def send(message: MailMessage) -> bool:
    """Deliver a message. Returns False on failure; never raises."""
    settings = get_settings()
    transport = settings.mail_transport
    if transport == "disabled":
        logger.info("mail transport disabled — dropping %r to %s", message.subject, message.to)
        return False
    try:
        if transport == "ses":
            _send_ses(message)
        elif transport == "smtp":
            _send_smtp(message)
        else:
            _send_console(message)
        return True
    except Exception:
        # Swallowed on purpose — see the module docstring.
        logger.exception("failed to send %r to %s", message.subject, message.to)
        # Outside production, print the message instead of losing it: running
        # the API on the host means no `mailpit` to resolve, and someone who
        # just registered would otherwise have no way to reach their
        # verification link. Never in production — that would be putting live
        # credentials into the log we are careful to keep them out of.
        if settings.is_local:
            logger.warning("mail delivery failed — falling back to the log")
            _send_console(message)
        return False
