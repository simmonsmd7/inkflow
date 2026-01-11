# Task: Fix Payment Status Bug

## Objective
When a customer pays a deposit via Stripe, the booking status should update on the employee/owner side. Currently it doesn't.

## The Bug
1. Owner sends deposit request to customer
2. Customer pays via Stripe checkout (payment succeeds)
3. Booking status does NOT update - still shows "Deposit Requested"
4. Owner never sees that payment was received

Investigate and fix this issue.

## Success Criteria
- [ ] After customer pays, booking status updates to "Deposit Paid"
- [ ] Owner sees the updated status in /bookings
- [ ] No build errors

## Context
- Tech: React + Vite (port 5173), FastAPI (port 8000), PostgreSQL, Stripe
- Stripe keys configured in backend/.env

## Test Credentials
- Owner: owner@inkflow-main.com / TestPass123!
- Stripe test card: 4242 4242 4242 4242

## Progress Log
Check `ralph.log` for context. When fixed, append your findings and fix details.

## When Complete
Output "TASK_COMPLETE" after verifying payment updates booking status.
