"""Email service with SendGrid integration and console stub."""

import logging
from dataclasses import dataclass

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


@dataclass
class EmailMessage:
    """Email message data class."""

    to_email: str
    subject: str
    body_text: str
    body_html: str | None = None


class EmailService:
    """Email service with SendGrid integration and console stub."""

    def __init__(self) -> None:
        self.is_configured = settings.is_email_configured
        self.from_email = settings.from_email
        self._client = None

        if self.is_configured:
            try:
                import sendgrid
                self._client = sendgrid.SendGridAPIClient(settings.sendgrid_api_key)
            except ImportError:
                logger.warning("sendgrid package not installed, using stub mode")
                self.is_configured = False

    async def send(self, message: EmailMessage) -> bool:
        """Send an email (or log to console if not configured)."""
        if not self.is_configured:
            return await self._send_stub(message)
        return await self._send_sendgrid(message)

    async def _send_stub(self, message: EmailMessage) -> bool:
        """Log email to console (stub mode)."""
        logger.info(
            f"\n[EMAIL STUB] "
            f"\n  To: {message.to_email}"
            f"\n  Subject: {message.subject}"
            f"\n  Body: {message.body_text}"
            f"\n"
        )
        print(
            f"\n{'='*60}\n"
            f"[EMAIL STUB]\n"
            f"To: {message.to_email}\n"
            f"Subject: {message.subject}\n"
            f"Body:\n{message.body_text}\n"
            f"{'='*60}\n"
        )
        return True

    async def _send_sendgrid(self, message: EmailMessage) -> bool:
        """Send email via SendGrid."""
        try:
            from sendgrid.helpers.mail import Content, Email, Mail, To

            from_email = Email(self.from_email)
            to_email = To(message.to_email)
            content = Content("text/plain", message.body_text)
            mail = Mail(from_email, to_email, message.subject, content)

            if message.body_html:
                mail.add_content(Content("text/html", message.body_html))

            response = self._client.send(mail)
            return response.status_code in (200, 201, 202)
        except Exception as e:
            logger.error(f"Failed to send email via SendGrid: {e}")
            return False

    async def send_verification_email(
        self, to_email: str, first_name: str, token: str
    ) -> bool:
        """Send email verification email."""
        verification_url = f"{settings.frontend_url}/verify-email?token={token}"

        body_text = f"""Hi {first_name},

Welcome to InkFlow! Please verify your email address by clicking the link below:

{verification_url}

This link will expire in 24 hours.

If you didn't create an account with InkFlow, you can safely ignore this email.

Best,
The InkFlow Team
"""

        body_html = f"""
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #1a1a1a;">Welcome to InkFlow!</h2>
    <p>Hi {first_name},</p>
    <p>Please verify your email address by clicking the button below:</p>
    <p style="text-align: center; margin: 30px 0;">
        <a href="{verification_url}"
           style="background-color: #e11d48; color: white; padding: 12px 24px;
                  text-decoration: none; border-radius: 6px; font-weight: bold;">
            Verify Email
        </a>
    </p>
    <p style="color: #666; font-size: 14px;">
        Or copy this link: <a href="{verification_url}">{verification_url}</a>
    </p>
    <p style="color: #666; font-size: 14px;">This link expires in 24 hours.</p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    <p style="color: #999; font-size: 12px;">
        If you didn't create an account with InkFlow, you can safely ignore this email.
    </p>
</div>
"""

        return await self.send(
            EmailMessage(
                to_email=to_email,
                subject="Verify your InkFlow email",
                body_text=body_text,
                body_html=body_html,
            )
        )

    async def send_password_reset_email(
        self, to_email: str, first_name: str, token: str
    ) -> bool:
        """Send password reset email."""
        reset_url = f"{settings.frontend_url}/reset-password?token={token}"

        body_text = f"""Hi {first_name},

We received a request to reset your password. Click the link below to set a new password:

{reset_url}

This link will expire in 1 hour.

If you didn't request a password reset, you can safely ignore this email.

Best,
The InkFlow Team
"""

        body_html = f"""
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #1a1a1a;">Reset Your Password</h2>
    <p>Hi {first_name},</p>
    <p>We received a request to reset your password. Click the button below to set a new password:</p>
    <p style="text-align: center; margin: 30px 0;">
        <a href="{reset_url}"
           style="background-color: #e11d48; color: white; padding: 12px 24px;
                  text-decoration: none; border-radius: 6px; font-weight: bold;">
            Reset Password
        </a>
    </p>
    <p style="color: #666; font-size: 14px;">
        Or copy this link: <a href="{reset_url}">{reset_url}</a>
    </p>
    <p style="color: #666; font-size: 14px;">This link expires in 1 hour.</p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    <p style="color: #999; font-size: 12px;">
        If you didn't request a password reset, you can safely ignore this email.
    </p>
</div>
"""

        return await self.send(
            EmailMessage(
                to_email=to_email,
                subject="Reset your InkFlow password",
                body_text=body_text,
                body_html=body_html,
            )
        )


    async def send_invite_email(
        self, to_email: str, first_name: str, token: str
    ) -> bool:
        """Send team member invite email."""
        setup_url = f"{settings.frontend_url}/reset-password?token={token}"

        body_text = f"""Hi {first_name},

You've been invited to join the team on InkFlow!

Click the link below to set your password and access your account:

{setup_url}

This link will expire in 1 hour.

Welcome aboard!

Best,
The InkFlow Team
"""

        body_html = f"""
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #1a1a1a;">Welcome to InkFlow!</h2>
    <p>Hi {first_name},</p>
    <p>You've been invited to join the team on InkFlow!</p>
    <p>Click the button below to set your password and access your account:</p>
    <p style="text-align: center; margin: 30px 0;">
        <a href="{setup_url}"
           style="background-color: #e11d48; color: white; padding: 12px 24px;
                  text-decoration: none; border-radius: 6px; font-weight: bold;">
            Set Up Your Account
        </a>
    </p>
    <p style="color: #666; font-size: 14px;">
        Or copy this link: <a href="{setup_url}">{setup_url}</a>
    </p>
    <p style="color: #666; font-size: 14px;">This link expires in 1 hour.</p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    <p style="color: #999; font-size: 12px;">
        If you weren't expecting this invitation, please contact your studio manager.
    </p>
</div>
"""

        return await self.send(
            EmailMessage(
                to_email=to_email,
                subject="You're invited to join InkFlow",
                body_text=body_text,
                body_html=body_html,
            )
        )


# Singleton instance
email_service = EmailService()
