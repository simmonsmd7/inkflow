# InkFlow Improvement Phases

## Context
- Tech: React + Vite (port 5173), FastAPI (port 8000), PostgreSQL, Stripe
- Test credentials: owner@inkflow-main.com / TestPass123!
- Stripe test card: 4242 4242 4242 4242
- Check `ralph.log` for previous iteration context

---

## Phase 1: Payment Badge Display Bug

**Problem:** After customer pays deposit, the status badge on /bookings doesn't visually update to show "Deposit Paid" even though the backend status changed.

**Success Criteria:**
- [ ] Badge immediately reflects "Deposit Paid" status after payment
- [ ] No page refresh required to see updated badge
- [ ] Badge styling is clearly visible (green or success color)

---

## Phase 2: Backend-Frontend Sync Verification

**Problem:** Need to verify all backend endpoints properly sync with frontend. Data changes should reflect immediately without manual refresh.

**Success Criteria:**
- [ ] All CRUD operations update UI in real-time
- [ ] Status changes propagate to frontend immediately
- [ ] No stale data issues
- [ ] All API endpoints tested and working
- [ ] Error states handled gracefully

---

## Phase 3: Missing "Send Booking Appointment" Feature

**Problem:** There's no way for owners/employees to send clients a confirmed booking appointment. After quoting and receiving deposit, owners need to send appointment confirmation.

**Success Criteria:**
- [ ] Owner can send appointment confirmation to client
- [ ] Client receives appointment details (date, time, artist, location)
- [ ] Appointment shows in client portal
- [ ] Calendar/scheduling integration if applicable

---

## Phase 4: Page Redundancy Clarification

**Problem:** Several pages seem to overlap or duplicate functionality:
- Are /clients and /bookings the same feature?
- Are /artists and /team the same page?

Investigate and consolidate or clearly differentiate these sections.

**Success Criteria:**
- [ ] Clear distinction between client management and booking management
- [ ] Clear distinction between artists and team management
- [ ] If redundant, consolidate into intuitive sections
- [ ] Navigation makes sense to users
- [ ] No duplicate/confusing sidebar links

---


## Execution Order
Work through phases 1-4 sequentially. After completing each phase, append findings to `ralph.log`.

## When Complete
Output "TASK_COMPLETE" after all phases verified working.
