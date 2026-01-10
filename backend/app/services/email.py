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


    async def send_deposit_request_email(
        self,
        to_email: str,
        client_name: str,
        studio_name: str,
        artist_name: str | None,
        design_summary: str,
        quoted_price: int | None,
        deposit_amount: int,
        expires_at: str,
        payment_url: str,
        custom_message: str | None = None,
    ) -> bool:
        """Send deposit request email to client."""
        # Format prices
        deposit_formatted = f"${deposit_amount / 100:.2f}"
        quoted_formatted = f"${quoted_price / 100:.2f}" if quoted_price else "TBD"

        message_section = ""
        message_html = ""
        if custom_message:
            message_section = f"\nMessage from your artist:\n{custom_message}\n"
            message_html = f"""
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 6px; margin: 20px 0;">
                <p style="margin: 0; font-style: italic;">"{custom_message}"</p>
            </div>
            """

        body_text = f"""Hi {client_name},

Great news! We've reviewed your tattoo request and prepared a quote for you.

TATTOO DETAILS
--------------
Design: {design_summary[:100]}...
Studio: {studio_name}
{f"Artist: {artist_name}" if artist_name else ""}

QUOTE
-----
Estimated Total: {quoted_formatted}
Required Deposit: {deposit_formatted}
{message_section}
To secure your appointment, please pay the deposit by {expires_at}.

PAY YOUR DEPOSIT
{payment_url}

This deposit will be applied to your final tattoo cost. If you need to cancel, please do so at least 48 hours before your appointment for a refund.

Questions? Reply to this email or contact the studio directly.

Best,
{studio_name}
Powered by InkFlow
"""

        body_html = f"""
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <div style="background-color: #1a1a1a; padding: 20px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Your Quote is Ready!</h1>
    </div>

    <div style="padding: 30px;">
        <p>Hi {client_name},</p>
        <p>Great news! We've reviewed your tattoo request and prepared a quote for you.</p>

        <div style="background-color: #f8f8f8; padding: 20px; border-radius: 8px; margin: 25px 0;">
            <h3 style="margin: 0 0 15px 0; color: #1a1a1a;">Tattoo Details</h3>
            <p style="margin: 5px 0;"><strong>Design:</strong> {design_summary[:100]}...</p>
            <p style="margin: 5px 0;"><strong>Studio:</strong> {studio_name}</p>
            {"<p style='margin: 5px 0;'><strong>Artist:</strong> " + artist_name + "</p>" if artist_name else ""}
        </div>

        <div style="background-color: #1a1a1a; color: #ffffff; padding: 20px; border-radius: 8px; margin: 25px 0;">
            <h3 style="margin: 0 0 15px 0;">Quote</h3>
            <p style="margin: 5px 0; font-size: 18px;">Estimated Total: <strong>{quoted_formatted}</strong></p>
            <p style="margin: 5px 0; font-size: 24px; color: #e11d48;">Deposit Required: <strong>{deposit_formatted}</strong></p>
        </div>

        {message_html}

        <p style="text-align: center;">
            <strong>Pay your deposit by {expires_at}</strong>
        </p>

        <p style="text-align: center; margin: 30px 0;">
            <a href="{payment_url}"
               style="background-color: #e11d48; color: white; padding: 16px 32px;
                      text-decoration: none; border-radius: 6px; font-weight: bold;
                      font-size: 18px; display: inline-block;">
                Pay Deposit Now
            </a>
        </p>

        <p style="color: #666; font-size: 14px; text-align: center;">
            Or copy this link: <a href="{payment_url}">{payment_url}</a>
        </p>

        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

        <p style="color: #666; font-size: 13px;">
            This deposit will be applied to your final tattoo cost. If you need to cancel,
            please do so at least 48 hours before your appointment for a refund.
        </p>

        <p style="color: #666; font-size: 13px;">
            Questions? Reply to this email or contact the studio directly.
        </p>
    </div>

    <div style="background-color: #f5f5f5; padding: 15px; text-align: center;">
        <p style="color: #999; font-size: 12px; margin: 0;">
            {studio_name} • Powered by <a href="https://inkflow.io" style="color: #e11d48;">InkFlow</a>
        </p>
    </div>
</div>
"""

        return await self.send(
            EmailMessage(
                to_email=to_email,
                subject=f"Your tattoo quote from {studio_name} - Deposit required",
                body_text=body_text,
                body_html=body_html,
            )
        )


# Singleton instance
email_service = EmailService()
