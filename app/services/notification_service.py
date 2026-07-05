import smtplib
from email.message import EmailMessage

import httpx

from app.core.config import settings


class NotificationService:
    def send_webhook(self, subject: str, message: str):
        if not settings.WEBHOOK_URL:
            return

        try:
            httpx.post(
                settings.WEBHOOK_URL,
                json={
                    "subject": subject,
                    "message": message,
                },
                timeout=5.0,
            )
        except Exception:
            pass

    def send_email(self, subject: str, message: str):
        required_values = [
            settings.SMTP_HOST,
            settings.SMTP_PORT,
            settings.ALERT_EMAIL_FROM,
            settings.ALERT_EMAIL_TO,
        ]

        if any(value is None for value in required_values):
            return

        email_message = EmailMessage()
        email_message["From"] = settings.ALERT_EMAIL_FROM
        email_message["To"] = settings.ALERT_EMAIL_TO
        email_message["Subject"] = subject
        email_message.set_content(message)

        try:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                if settings.SMTP_USE_TLS:
                    server.starttls()

                if settings.SMTP_USER and settings.SMTP_PASSWORD:
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)

                server.send_message(email_message)
        except Exception:
            pass