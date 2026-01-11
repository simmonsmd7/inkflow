# InkFlow Improvement Phases

## Context
- Tech: React + Vite (port 5173), FastAPI (port 8000), PostgreSQL, Stripe
- Test credentials: owner@inkflow-main.com / TestPass123!
- Stripe test card: 4242 4242 4242 4242
- Stripe CLI available at: /opt/homebrew/bin/stripe
- Check `ralph.log` for previous iteration context

---

## Phase 1: Payment Badge Display Bug - ✅ COMPLETE
Fixed in Iteration 32. Added 30-second polling to BookingQueue.tsx.

## Phase 2: Backend-Frontend Sync Verification - ✅ COMPLETE
Fixed in Iteration 32. Added polling to Dashboard.tsx and Inbox.tsx.

## Phase 3: Send Booking Appointment Feature - ✅ COMPLETE
Verified in Iteration 32. Feature already exists with calendar invite email.

## Phase 4: Page Redundancy Clarification - ✅ COMPLETE
Fixed in Iteration 32. Removed redundant Clients and Artists sidebar links.

## Phase 5: Booking Flow State Machine & Refunds - ✅ CODE COMPLETE
Implemented in Iteration 33:
- State machine button visibility rules
- Refund database fields (refund_amount, refund_stripe_id, refunded_at, refund_reason, refund_initiated_by_id)
- Stripe refund API integration (process_refund, process_partial_refund)
- Refund endpoints (POST /requests/{id}/refund, POST /requests/{id}/cancel-with-refund)
- Refund confirmation emails
- Booking link sharing on Dashboard

---

## Phase 6a: Start Stripe Webhook Listener (CURRENT - DO THIS FIRST)

**Problem:** Stripe payments complete on Stripe's side but the backend never receives the webhook event to update booking status. The Stripe CLI webhook listener MUST be running for local development.

**Goal:** Start the Stripe CLI webhook listener in the background so payment webhooks are forwarded to the local backend.

### Steps

**Step 1: Start Stripe CLI Webhook Listener in Background**
```bash
/opt/homebrew/bin/stripe listen --forward-to localhost:8000/api/v1/webhooks/stripe > stripe_webhook.log 2>&1 &
echo $! > stripe_webhook.pid
sleep 2
cat stripe_webhook.log | head -20
```

**Step 2: Extract and Update Webhook Secret**
The Stripe CLI outputs a webhook signing secret like `whsec_xxxxx`. Extract it:
```bash
grep -o 'whsec_[a-zA-Z0-9]*' stripe_webhook.log | head -1
```
If this secret differs from `STRIPE_WEBHOOK_SECRET` in `backend/.env`, update the .env file with the new secret and restart the backend.

**Step 3: Verify Webhook Listener is Running**
```bash
ps aux | grep "stripe listen" | grep -v grep
tail -5 stripe_webhook.log
```
You should see the stripe process running and the log showing it's ready.

**Step 4: Test Webhook Endpoint**
```bash
curl -X POST http://localhost:8000/api/v1/webhooks/stripe/test
```
Should return: `{"status":"ok","message":"Stripe webhook is active","stripe_configured":true}`

### Success Criteria
- [ ] Stripe CLI webhook listener running in background
- [ ] Webhook secret in .env matches the one from Stripe CLI (or CLI started with existing secret)
- [ ] `/api/v1/webhooks/stripe/test` returns stripe_configured: true

**IMPORTANT:** If the webhook listener dies, restart it before testing payments. Check with `ps aux | grep stripe`.

---

## Phase 6b: E2E Stripe Payment & Refund Testing

**Problem:** Refund code was implemented but never tested with real Stripe payments. Refund buttons don't appear because test bookings have no `deposit_stripe_payment_intent_id`.

**Goal:** Complete a full payment + refund cycle using Stripe CLI to verify the refund integration works.

### Prerequisites
1. Backend running on port 8000
2. Frontend running on port 5173
3. **Phase 6a COMPLETE** - Stripe CLI webhook listener running in background

**Step 2: Create a New Booking**
- Go to http://localhost:5173/book/inkflow-main
- Fill out the booking form with test data
- Submit and note the booking reference ID

**Step 3: Process Through to Payment**
- Login as owner (owner@inkflow-main.com / TestPass123!)
- Go to /bookings, find the new booking
- Change status: PENDING → REVIEWING → QUOTED (add a quote amount like $300)
- Click "Send Deposit Request" (30% = $90 deposit)
- Copy the payment URL from the modal or check console logs

**Step 4: Complete Stripe Payment**
- Open the payment URL in browser
- Use test card: 4242 4242 4242 4242, any future date, any CVC
- Complete the checkout
- Verify webhook received in Stripe CLI terminal (should show checkout.session.completed → 200)

**Step 5: Verify Payment Recorded**
```bash
psql -d inkflow -c "SELECT id, status, deposit_stripe_payment_intent_id, deposit_paid_at FROM booking_requests ORDER BY created_at DESC LIMIT 1;"
```
- Status should be DEPOSIT_PAID
- deposit_stripe_payment_intent_id should be set (starts with "pi_")

**Step 6: Test Cancel & Refund**
- In /bookings, the booking should now show "Cancel & Refund" button
- Click it, select Full refund, add a reason
- Submit the refund
- Verify webhook shows refund event in Stripe CLI

**Step 7: Verify Refund in Database**
```bash
psql -d inkflow -c "SELECT id, status, refund_amount, refund_stripe_id, refunded_at FROM booking_requests ORDER BY created_at DESC LIMIT 1;"
```
- Status should be CANCELLED
- refund_stripe_id should be set (starts with "re_")
- refunded_at should be set

**Step 8: Verify in Stripe Dashboard**
```bash
stripe refunds list --limit 1
```
Or check https://dashboard.stripe.com/test/payments - the payment should show as refunded.

### Alternative: Test No-Show Refund
1. Instead of cancelling, confirm the appointment first
2. Mark as No-Show
3. Click "Issue Refund" button (should appear for no-show bookings with payment)
4. Test partial refund (e.g., 50% of deposit)

### Success Criteria
- [ ] Stripe CLI receives checkout.session.completed webhook
- [ ] deposit_stripe_payment_intent_id stored in database after payment
- [ ] "Cancel & Refund" button appears for paid bookings
- [ ] Refund processed via Stripe API (check `stripe refunds list`)
- [ ] refund_stripe_id stored in database
- [ ] Refund confirmation email sent (check console or SendGrid)

---

## Execution Order
Phases 1-5 are complete.
1. **Phase 6a FIRST** - Start webhook listener (required for payment webhooks to work)
2. **Phase 6b** - E2E payment + refund testing

After completing, append findings to `ralph.log`.

## When Complete
Output "TASK_COMPLETE" after Phase 6b is verified working with actual Stripe refunds.
