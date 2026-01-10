"""Stripe payment service."""

import stripe
from datetime import datetime, timezone

from app.config import get_settings

settings = get_settings()


class StripeService:
    """Service for handling Stripe payments."""

    def __init__(self) -> None:
        """Initialize the Stripe service."""
        self._is_configured = bool(settings.stripe_secret_key)
        if self._is_configured:
            stripe.api_key = settings.stripe_secret_key

    @property
    def is_configured(self) -> bool:
        """Check if Stripe is properly configured."""
        return self._is_configured

    @property
    def publishable_key(self) -> str:
        """Get the Stripe publishable key."""
        return settings.stripe_publishable_key

    async def create_checkout_session(
        self,
        *,
        amount_cents: int,
        currency: str = "usd",
        client_name: str,
        client_email: str,
        studio_name: str,
        booking_request_id: str,
        deposit_token: str,
        success_url: str,
        cancel_url: str,
    ) -> dict:
        """
        Create a Stripe Checkout session for deposit payment.

        Args:
            amount_cents: Amount in cents to charge
            currency: Currency code (default: usd)
            client_name: Client's name
            client_email: Client's email
            studio_name: Studio name for the product description
            booking_request_id: The booking request UUID
            deposit_token: The deposit payment token
            success_url: URL to redirect on successful payment
            cancel_url: URL to redirect on cancelled payment

        Returns:
            Dictionary with session_id, checkout_url, or stub info
        """
        if not self._is_configured:
            # Stub mode - simulate successful session creation
            print(f"[STRIPE STUB] Create checkout session:")
            print(f"  Amount: ${amount_cents / 100:.2f} {currency.upper()}")
            print(f"  Client: {client_name} ({client_email})")
            print(f"  Studio: {studio_name}")
            print(f"  Booking ID: {booking_request_id}")
            print(f"  Success URL: {success_url}")
            print(f"  Cancel URL: {cancel_url}")
            return {
                "stub_mode": True,
                "session_id": f"stub_session_{deposit_token}",
                "checkout_url": f"{settings.frontend_url}/pay-deposit/{deposit_token}/stub-checkout",
                "message": "Stripe not configured - using stub mode",
            }

        # Real Stripe integration
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[
                {
                    "price_data": {
                        "currency": currency,
                        "product_data": {
                            "name": f"Tattoo Deposit - {studio_name}",
                            "description": f"Deposit for tattoo booking at {studio_name}",
                        },
                        "unit_amount": amount_cents,
                    },
                    "quantity": 1,
                }
            ],
            mode="payment",
            customer_email=client_email,
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "booking_request_id": booking_request_id,
                "deposit_token": deposit_token,
                "client_name": client_name,
            },
            payment_intent_data={
                "metadata": {
                    "booking_request_id": booking_request_id,
                    "deposit_token": deposit_token,
                }
            },
        )

        return {
            "stub_mode": False,
            "session_id": session.id,
            "checkout_url": session.url,
        }

    def construct_webhook_event(
        self,
        payload: bytes,
        sig_header: str,
    ) -> stripe.Event | None:
        """
        Construct a Stripe webhook event from the payload.

        Args:
            payload: Raw request body
            sig_header: Stripe-Signature header value

        Returns:
            Stripe Event object or None if construction fails
        """
        if not self._is_configured:
            print("[STRIPE STUB] Webhook received (stub mode - no validation)")
            return None

        if not settings.stripe_webhook_secret:
            print("[STRIPE WARNING] No webhook secret configured")
            return None

        try:
            event = stripe.Webhook.construct_event(
                payload,
                sig_header,
                settings.stripe_webhook_secret,
            )
            return event
        except ValueError as e:
            print(f"[STRIPE ERROR] Invalid payload: {e}")
            return None
        except stripe.error.SignatureVerificationError as e:
            print(f"[STRIPE ERROR] Invalid signature: {e}")
            return None

    def handle_payment_success(self, session: dict) -> dict:
        """
        Extract booking info from a successful payment session.

        Args:
            session: The checkout session data

        Returns:
            Dictionary with booking_request_id and payment_intent_id
        """
        metadata = session.get("metadata", {})
        return {
            "booking_request_id": metadata.get("booking_request_id"),
            "deposit_token": metadata.get("deposit_token"),
            "payment_intent_id": session.get("payment_intent"),
            "amount_total": session.get("amount_total"),
            "customer_email": session.get("customer_email"),
        }


# Global instance
stripe_service = StripeService()
