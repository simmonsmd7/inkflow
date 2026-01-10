"""SMS service with Twilio integration and console stub."""

import logging

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class SMSService:
    """SMS service with Twilio integration and console stub."""

    def __init__(self) -> None:
        self.is_configured = settings.is_sms_configured
        self.from_number = settings.twilio_phone_number
        self._client = None

        if self.is_configured:
            try:
                from twilio.rest import Client
                self._client = Client(
                    settings.twilio_account_sid,
                    settings.twilio_auth_token
                )
            except ImportError:
                logger.warning("twilio package not installed, using stub mode")
                self.is_configured = False

    async def send(self, to_phone: str, message: str) -> bool:
        """Send an SMS (or log to console if not configured)."""
        if not self.is_configured:
            return await self._send_stub(to_phone, message)
        return await self._send_twilio(to_phone, message)

    async def _send_stub(self, to_phone: str, message: str) -> bool:
        """Log SMS to console (stub mode)."""
        logger.info(
            f"\n[SMS STUB] "
            f"\n  To: {to_phone}"
            f"\n  Message: {message}"
            f"\n"
        )

        print(
            f"\n{'='*60}\n"
            f"[SMS STUB]\n"
            f"To: {to_phone}\n"
            f"Message: {message}\n"
            f"{'='*60}\n"
        )
        return True

    async def _send_twilio(self, to_phone: str, message: str) -> bool:
        """Send SMS via Twilio."""
        try:
            # Twilio client is synchronous, but we wrap it for async interface
            self._client.messages.create(
                body=message,
                from_=self.from_number,
                to=to_phone
            )
            return True
        except Exception as e:
            logger.error(f"Failed to send SMS via Twilio: {e}")
            return False

    async def send_appointment_reminder(
        self,
        to_phone: str,
        client_name: str,
        studio_name: str,
        artist_name: str | None,
        scheduled_date: str,
        scheduled_time: str,
        hours_until: int,
    ) -> bool:
        """Send appointment reminder SMS."""
        artist_info = f" with {artist_name}" if artist_name else ""

        if hours_until == 24:
            message = (
                f"Hi {client_name}! Reminder: Your tattoo appointment at {studio_name}"
                f"{artist_info} is tomorrow at {scheduled_time}. "
                f"See you then! Reply HELP for more info."
            )
        elif hours_until == 2:
            message = (
                f"Hi {client_name}! Your tattoo appointment at {studio_name}"
                f"{artist_info} is in 2 hours at {scheduled_time}. "
                f"Don't forget to eat and stay hydrated. See you soon!"
            )
        else:
            message = (
                f"Hi {client_name}! Reminder about your upcoming tattoo appointment "
                f"at {studio_name}{artist_info} on {scheduled_date} at {scheduled_time}."
            )

        return await self.send(to_phone, message)


    async def send_conversation_message(
        self,
        to_phone: str,
        client_name: str,
        sender_name: str,
        studio_name: str | None,
        content: str,
    ) -> tuple[bool, str | None]:
        """
        Send a conversation message via SMS.

        Returns: (success, message_sid or None)
        """
        # Build message with context
        if studio_name:
            prefix = f"[{studio_name}] {sender_name}: "
        else:
            prefix = f"{sender_name}: "

        # SMS has 160 char limit for single message, 1600 for multipart
        # Keep it concise with prefix
        max_content_len = 1500 - len(prefix)
        truncated_content = content[:max_content_len]
        if len(content) > max_content_len:
            truncated_content = truncated_content[:-3] + "..."

        message = f"{prefix}{truncated_content}"

        if not self.is_configured:
            await self._send_stub(to_phone, message)
            return True, "stub_message_id"

        return await self._send_twilio_with_sid(to_phone, message)

    async def _send_twilio_with_sid(
        self,
        to_phone: str,
        message: str,
    ) -> tuple[bool, str | None]:
        """Send SMS via Twilio and return message SID."""
        try:
            msg = self._client.messages.create(
                body=message,
                from_=self.from_number,
                to=to_phone,
            )
            return True, msg.sid
        except Exception as e:
            logger.error(f"Failed to send SMS via Twilio: {e}")
            return False, None


# Singleton instance
sms_service = SMSService()
