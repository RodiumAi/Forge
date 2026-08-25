from __future__ import annotations

from email.message import EmailMessage
from typing import Protocol

from app.config import get_settings
from app.errors import provider_not_configured


class MailProvider(Protocol):
    async def send(self, to: list[str], subject: str, html: str, text: str, from_name: str | None = None) -> str:
        ...


class SmtpMailProvider:
    """Local. Cible Mailpit (http://localhost:8025)."""

    async def send(
        self, to: list[str], subject: str, html: str, text: str, from_name: str | None = None
    ) -> str:
        try:
            import aiosmtplib
        except ImportError as exc:
            raise provider_not_configured("SMTP (aiosmtplib)") from exc

        s = get_settings()
        if not s.smtp_host:
            raise provider_not_configured("SMTP")

        source_name = (from_name or s.ses_from_name or "Forge").strip()
        msg = EmailMessage()
        msg["From"] = f"{source_name} <{s.mail_from}>"
        msg["To"] = ", ".join(to)
        msg["Subject"] = subject
        msg.set_content(text or " ")
        msg.add_alternative(html, subtype="html")
        await aiosmtplib.send(
            msg,
            hostname=s.smtp_host,
            port=s.smtp_port,
            username=s.smtp_user or None,
            password=s.smtp_password or None,
            start_tls=s.smtp_tls,
        )
        return msg["Message-ID"] or "local"


class SesMailProvider:
    async def send(
        self, to: list[str], subject: str, html: str, text: str, from_name: str | None = None
    ) -> str:
        try:
            import boto3
        except ImportError as exc:
            raise provider_not_configured("Amazon SES (boto3)") from exc

        s = get_settings()
        access = s.aws_access_key_id or s.object_store_access_key
        secret = s.aws_secret_access_key or s.object_store_secret_key
        if not access or not secret:
            raise provider_not_configured("Amazon SES")

        source_name = (from_name or s.ses_from_name or "Forge").strip()
        source = f"{source_name} <{s.mail_from or s.ses_from_email}>"
        client = boto3.client(
            "ses",
            region_name=s.ses_region or s.object_store_region,
            aws_access_key_id=access,
            aws_secret_access_key=secret,
        )
        body: dict = {"Html": {"Data": html, "Charset": "UTF-8"}}
        if text:
            body["Text"] = {"Data": text, "Charset": "UTF-8"}
        response = client.send_email(
            Source=source,
            Destination={"ToAddresses": to},
            Message={
                "Subject": {"Data": subject, "Charset": "UTF-8"},
                "Body": body,
            },
        )
        return str(response.get("MessageId") or "")


class ResendMailProvider:
    async def send(
        self, to: list[str], subject: str, html: str, text: str, from_name: str | None = None
    ) -> str:
        import httpx

        from app.errors import SitesError

        s = get_settings()
        api_key = (s.resend_api_key or "").strip()
        if not api_key:
            raise provider_not_configured("Resend")
        from_email = s.mail_from or s.ses_from_email
        payload: dict = {
            "from": f"{from_name or s.ses_from_name} <{from_email}>",
            "to": to,
            "subject": subject,
            "html": html,
        }
        if text:
            payload["text"] = text
        async with httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=10.0)) as client:
            response = await client.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json=payload,
            )
        if response.status_code >= 400:
            raise SitesError(
                502,
                "CONNECTOR_UPSTREAM_ERROR",
                "Resend could not send this email.",
                {"provider": "resend"},
            )
        data = response.json()
        return str(data.get("id") or "")


def build_mail_provider() -> MailProvider:
    s = get_settings()
    return {
        "smtp": SmtpMailProvider,
        "ses": SesMailProvider,
        "resend": ResendMailProvider,
    }[s.mail_provider]()
