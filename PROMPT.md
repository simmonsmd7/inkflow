# Task: InkFlow - Tattoo Studio Management Platform

## Objective
Build a modern, all-in-one SaaS platform for tattoo artists and studios that eliminates administrative overhead. The platform handles unified messaging, booking with deposits, commission tracking, digital consent forms, and automated aftercare—replacing the patchwork of generic salon tools that frustrate tattoo professionals.

## Tech Stack
- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS
- **Backend**: Python 3.11+ with FastAPI
- **Database**: PostgreSQL with SQLAlchemy ORM
- **Auth**: JWT-based authentication
- **Payments**: Stripe integration for deposits
- **Dev Server Ports**:
  - Frontend: http://localhost:5173 (Vite)
  - Backend: http://localhost:8000 (FastAPI)

---

## CRITICAL: Dev Server Setup

### Frontend (Terminal 1)
```bash
cd frontend && npm run dev
```
Must run on port 5173. Vite config has `strictPort: true`.

### Backend (Terminal 2)
```bash
cd backend && uvicorn app.main:app --reload --port 8000
```
Must run on port 8000.

---

## Project Structure (Target)
```
tattooproject/
├── PROMPT.md
├── ralph.log
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── index.css
│       ├── components/
│       ├── pages/
│       ├── hooks/
│       ├── services/
│       └── types/
├── backend/
│   ├── requirements.txt
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── routers/
│   │   ├── services/
│   │   └── utils/
│   └── tests/
└── docker-compose.yml (optional)
```

---

## Core Features to Implement

### Phase 1: Foundation
- [ ] **P1.1** Initialize frontend with Vite + React + TypeScript + Tailwind
- [ ] **P1.2** Initialize backend with FastAPI + SQLAlchemy + PostgreSQL
- [ ] **P1.3** Set up CORS and frontend-backend communication
- [ ] **P1.4** Create base UI layout (sidebar nav, header, main content area)
- [ ] **P1.5** Implement dark/light theme toggle (tattoo artists work late)

### Phase 2: Authentication & Users
- [ ] **P2.1** User registration (stub email verification to console if SENDGRID_API_KEY is empty)
- [ ] **P2.2** Login/logout with JWT tokens
- [ ] **P2.3** Password reset flow (stub email to console if SENDGRID_API_KEY is empty)
- [ ] **P2.4** User roles: Owner, Artist, Receptionist
- [ ] **P2.5** Studio profile setup (name, logo, address, hours)
- [ ] **P2.6** Artist profiles (bio, portfolio gallery, specialties)

### Phase 3: Booking System
- [ ] **P3.1** Availability calendar for artists
- [ ] **P3.2** Booking request form (client submits: name, email, phone, design idea, placement, size, reference images)
- [ ] **P3.3** Request queue dashboard for artists to review
- [ ] **P3.4** Quote and deposit request workflow
- [ ] **P3.5** Stripe integration for deposit collection
- [ ] **P3.6** Booking confirmation with calendar invite
- [ ] **P3.7** Automated reminders (24hr, 2hr before appointment)
- [ ] **P3.8** Reschedule and cancellation handling
- [ ] **P3.9** No-show tracking and deposit forfeiture rules

### Phase 4: Unified Inbox
- [ ] **P4.1** Internal messaging system (foundation)
- [ ] **P4.2** Email integration (stub to console if SENDGRID_API_KEY is empty)
- [ ] **P4.3** SMS integration (stub to console if TWILIO_ACCOUNT_SID is empty)
- [ ] **P4.4** Conversation threading and assignment to artists
- [ ] **P4.5** Quick reply templates
- [ ] **P4.6** Message status (unread, pending, resolved)

### Phase 5: Commission & Payroll
- [ ] **P5.1** Commission rules engine (percentage, flat fee, tiered)
- [ ] **P5.2** Per-artist commission settings
- [ ] **P5.3** Automatic calculation on completed appointments
- [ ] **P5.4** Pay period tracking (weekly, bi-weekly, monthly)
- [ ] **P5.5** Payout reports and history
- [ ] **P5.6** Tips tracking and distribution
- [ ] **P5.7** Export to CSV/PDF for accounting

### Phase 6: Consent & Compliance
- [ ] **P6.1** Digital consent form builder
- [ ] **P6.2** Pre-built tattoo consent template
- [ ] **P6.3** Client signature capture (touch/mouse)
- [ ] **P6.4** Photo ID upload and verification
- [ ] **P6.5** Secure storage with encryption
- [ ] **P6.6** Consent form retrieval and audit log
- [ ] **P6.7** Age verification workflow

### Phase 7: Aftercare System
- [ ] **P7.1** Aftercare instruction templates (by tattoo type/location)
- [ ] **P7.2** Automatic send after appointment completion
- [ ] **P7.3** Follow-up check-in messages (day 3, week 1, week 4)
- [ ] **P7.4** Healing issue reporting from clients
- [ ] **P7.5** Touch-up scheduling integration

### Phase 8: Dashboard & Analytics
- [ ] **P8.1** Studio overview dashboard (bookings, revenue, occupancy)
- [ ] **P8.2** Artist performance metrics
- [ ] **P8.3** Revenue reports (daily, weekly, monthly, custom range)
- [ ] **P8.4** Client retention metrics
- [ ] **P8.5** No-show rate tracking
- [ ] **P8.6** Popular time slots analysis

### Phase 9: Client Portal
- [ ] **P9.1** Client login/registration
- [ ] **P9.2** Booking history view
- [ ] **P9.3** Upcoming appointments
- [ ] **P9.4** Consent form signing
- [ ] **P9.5** Aftercare instructions access
- [ ] **P9.6** Rebooking flow

### Phase 10: Final Verification (Browser Testing)
Use Chrome browser tools to systematically verify all features work correctly:

- [x] **P10.1** Verify authentication flows (register new user, login, logout, password reset)
- [x] **P10.2** Verify studio/artist setup (create studio profile, upload logo, set hours, artist bio/portfolio)
- [x] **P10.3** Verify booking system (submit booking request, review queue, send quote, request deposit)
- [x] **P10.4** Verify Stripe integration (deposit payment flow, webhook handling, payment confirmation)
- [x] **P10.5** Verify calendar & scheduling (availability setup, time-off, reminders, reschedule, cancel)
- [x] **P10.6** Verify unified inbox (create conversation, send messages, templates, assign to artist)
- [x] **P10.7** Verify commission system (create rules, assign to artists, calculate payouts, export reports)
- [x] **P10.8** Verify consent forms (create template, client signing flow, signature capture, photo ID upload)
- [x] **P10.9** Verify aftercare system (create templates, send instructions, follow-ups, healing issue reporting)
- [x] **P10.10** Verify dashboard & analytics (overview stats, artist performance, revenue reports, charts)
- [x] **P10.11** Verify client portal (client login, booking history, upcoming appointments, consent signing, aftercare access, rebooking)

**Verification Protocol for each task:**
1. Navigate to the relevant page using browser tools
2. Take a screenshot to document the UI state
3. Interact with forms/buttons to test functionality
4. Check browser console for JavaScript errors
5. Verify API responses are correct (check Network tab if needed)
6. If bugs found: fix immediately, re-verify, then continue
7. Log verification results in ralph.log

### Phase 11: Production Simulation & Stress Test
Seed realistic data and simulate production workflows to ensure system stability:

#### Data Seeding (create seed script: backend/scripts/seed_data.py)
- [ ] **P11.1** Create seed script with realistic test data:
  - 2 studios (main studio + satellite location)
  - 1 owner, 4 artists, 1 receptionist per studio
  - 50+ clients with varied booking histories
  - 100+ bookings across all statuses (pending, confirmed, completed, cancelled, no-show)
  - Commission rules and calculated payouts
  - Consent form templates and signed submissions
  - Aftercare templates and sent instructions
  - Message conversations with varied statuses
  - Run seed script and verify data appears correctly

#### End-to-End Production Workflows (use browser tools)
- [ ] **P11.2** Simulate complete new client journey:
  - Client visits booking page, submits request with reference images
  - Artist reviews queue, sends quote with deposit request
  - Client pays deposit via Stripe (use test card 4242424242424242)
  - Booking confirmed, calendar updated
  - Client signs consent form with signature
  - Appointment completed, commission calculated
  - Aftercare sent, client receives follow-up

- [ ] **P11.3** Simulate busy studio day:
  - Multiple bookings scheduled for same day
  - Process reminders for upcoming appointments
  - Handle one reschedule, one cancellation, one no-show
  - Complete 3+ appointments and verify commissions
  - Check dashboard shows accurate daily stats

- [ ] **P11.4** Simulate pay period close:
  - Review all earned commissions for period
  - Close pay period and mark as paid
  - Export CSV and PDF reports
  - Verify payout history is accurate

#### Stress Testing
- [ ] **P11.5** Test concurrent operations:
  - Open multiple browser tabs simultaneously
  - Submit multiple booking requests rapidly
  - Send multiple messages in quick succession
  - Verify no data corruption or race conditions
  - Check backend logs for errors

- [ ] **P11.6** Test edge cases:
  - Very long text inputs (bio, design ideas, notes)
  - Special characters in all text fields
  - Large file uploads (reference images, photo IDs)
  - Rapid navigation between pages
  - Session timeout and re-authentication

- [ ] **P11.7** Performance verification:
  - Dashboard loads with seeded data < 2 seconds
  - Booking queue pagination works correctly
  - Analytics charts render with large datasets
  - Export functions handle 100+ records
  - No memory leaks after extended usage

#### Final Cleanup
- [ ] **P11.8** Document any issues found and fixes applied
- [ ] **P11.9** Reset to clean state OR keep seeded data (log decision)

**Stress Test Protocol:**
1. Use browser tools to perform actions rapidly
2. Monitor backend console for errors
3. Check browser console for JavaScript errors
4. Verify data integrity after each test
5. Log all findings in ralph.log

### Phase 12: Role-Based Access Audit (Browser Tool Required)
Use browser tools to visit EVERY page as each user type. Identify and fix:
- Pages showing errors (determine if access control issue or real bug)
- Pages accessible to wrong user types (security issue)
- Broken UI, missing data, or infinite loading states

**IMPORTANT**: For each error found, diagnose the root cause:
- If user shouldn't have access → add proper route guards/redirects
- If real bug → fix the bug
- Log all findings and fixes in ralph.log

#### Test Users (create if missing)
```
Owner: owner@test.com / Test123!
Artist: artist@test.com / Test123!
Receptionist: receptionist@test.com / Test123!
Client: client@test.com / Test123!
```

#### Staff Pages to Check (per role)
```
/dashboard
/team
/studio-settings
/artist-profile
/availability
/booking-queue
/inbox
/commissions
/consent-forms
/aftercare
/analytics/artists
/analytics/revenue
/analytics/retention
/analytics/no-shows
/analytics/time-slots
```

#### Client Portal Pages to Check
```
/client/portal
/client/bookings
/client/appointments
/client/consent
/client/aftercare
/client/rebook/:id
```

#### Public Pages to Check (no login)
```
/
/login
/register
/forgot-password
/client/login
/client/register
/book/:studio-slug
```

- [ ] **P12.1** Audit as OWNER: Login as owner, visit ALL staff pages, screenshot each, log errors
- [ ] **P12.2** Audit as ARTIST: Login as artist, visit ALL staff pages, identify which should be blocked vs allowed
- [ ] **P12.3** Audit as RECEPTIONIST: Login as receptionist, visit ALL staff pages, identify access issues
- [ ] **P12.4** Audit as CLIENT: Login as client, visit ALL client portal pages, check for errors
- [ ] **P12.5** Audit PUBLIC pages: No login, visit all public routes, verify no auth-required content leaks
- [ ] **P12.6** Fix all access control issues found (add redirects, guards, proper error messages)
- [ ] **P12.7** Fix all real bugs found (broken UI, API errors, missing data handling)
- [ ] **P12.8** Re-audit all roles to confirm fixes work
- [ ] **P12.9** Log complete audit results: pages checked, issues found, fixes applied

**Diagnosis Guide:**
- "401 Unauthorized" or redirect to login = correct access control (if user shouldn't access)
- "403 Forbidden" with message = correct access control (if user shouldn't access)
- Blank page or crash = BUG - needs fix
- Page loads but shows wrong data = BUG - needs fix
- Page loads but user shouldn't see it = SECURITY ISSUE - add guard

### Phase 13: Future Enhancements (DO NOT IMPLEMENT - requires manual setup)
These features require external service setup that cannot be automated:
- [ ] **P13.1** Instagram DM integration (requires Meta business verification + app review)
- [ ] **P13.2** Facebook Messenger integration (requires Meta approval)
- [ ] **P13.3** WhatsApp Business integration (requires Meta approval)

---

## External Service Stubbing

When credentials are missing, STUB the functionality instead of failing:

### Email (SendGrid)
If `SENDGRID_API_KEY` is empty:
- Log email content to console: `[EMAIL STUB] To: {email}, Subject: {subject}, Body: {body}`
- Return success (don't block the flow)
- Mark verification tokens as auto-verified in dev mode

### SMS (Twilio)
If `TWILIO_ACCOUNT_SID` is empty:
- Log SMS content to console: `[SMS STUB] To: {phone}, Message: {message}`
- Return success (don't block the flow)

This ensures the full application flow works without real credentials.

---

## Iteration Protocol

Each iteration MUST follow this sequence:

### 0. Check for Uncommitted Changes (Recovery)
```bash
git status
git diff --stat
```
If there are uncommitted changes from a previous crashed/interrupted iteration:

**Option A: Changes look complete and working**
- Run build check (`cd frontend && npm run build`)
- If build passes, commit the changes and continue
- Log what you recovered in ralph.log

**Option B: Changes are incomplete but salvageable**
- Review what was started
- Finish the implementation
- Run build check, then commit and continue
- Log in ralph.log: "Recovered and completed work from crashed iteration"

**Option C: Changes are broken beyond repair**
- Reset to remote: `git reset --hard origin/main`
- Log the reset in ralph.log: "Reset due to broken uncommitted changes"
- Start fresh on the task

**Option D: No uncommitted changes**
- Proceed normally to step 1

### 1. Read Progress Log
```bash
cat ralph.log
```
Understand what's been completed and what's next.

### 2. Check Dev Servers
- Verify frontend on http://localhost:5173
- Verify backend on http://localhost:8000
- Start them if not running

### 3. Select ONE Task
Pick the next incomplete task from the checklist above. Work on ONE task per iteration.

### 4. Implement
- Write clean, typed code
- Follow existing patterns in the codebase
- Add appropriate error handling
- Include loading states for async operations

### 5. Test Manually
- Verify the feature works in the browser
- Check for console errors
- Test edge cases

### 6. Run Build Checks
```bash
cd frontend && npm run build
cd backend && python -m pytest (if tests exist)
```
Fix any errors before proceeding.

### 7. Commit and Push Changes
```bash
git add -A
git commit -m "feat(scope): description"
git push origin main
```
Use conventional commits: feat, fix, refactor, style, docs, test

**IMPORTANT**: Always push after committing. This ensures the next iteration can reset to a known good state if needed.

### 8. Log Progress
Append to ralph.log:
```
=== ITERATION [N] ===
Date: [timestamp]
Task: [task ID and name]
Changes:
- [file]: [what changed]
Status: COMPLETE
Next: [suggested next task]
```

### 9. Exit
Exit cleanly so the next iteration can begin fresh.

---

## Progress Log Reference
Always read `ralph.log` at the start of each iteration to understand current state.

---

## MANDATORY VISUAL VERIFICATION (Browser Tools Available)

You have access to Chrome browser tools via MCP. USE THEM.

Before committing any frontend changes:
1. Navigate to http://localhost:5173 using browser tools
2. Take a screenshot to verify the feature appears correctly
3. Check browser console for JavaScript errors
4. Interact with the feature (click buttons, fill forms) to verify functionality
5. Only proceed if verification passes

If you find bugs or errors:
- Fix them immediately
- Re-verify with another screenshot
- Do NOT commit broken code

---

## MANDATORY BUILD CHECK

Before committing:
```bash
cd frontend && npm run build
```
- Fix ALL TypeScript errors
- Fix ALL ESLint warnings
- Do NOT commit broken builds

---

## Code Standards

### Frontend
- Functional components with hooks
- TypeScript strict mode
- Tailwind for all styling (no inline styles, no CSS files per component)
- React Query for server state
- Zustand for client state (if needed)
- Proper loading and error states

### Backend
- FastAPI with async/await
- Pydantic models for request/response validation
- SQLAlchemy with async session
- Proper HTTP status codes
- Comprehensive error responses
- API versioning (/api/v1/...)

### Database
- Alembic for migrations
- UUID primary keys
- created_at/updated_at timestamps on all tables
- Soft deletes where appropriate

---

## UI/UX Guidelines

- **Dark mode first** (tattoo artists work evenings)
- Clean, modern aesthetic (think Linear, Notion)
- Mobile-responsive (artists check on phones)
- Fast transitions (no jarring page reloads)
- Clear empty states with CTAs
- Skeleton loaders for async content
- Toast notifications for actions

---

## DO NOT

- DO NOT skip the build check
- DO NOT commit with TypeScript errors
- DO NOT add features not in the checklist without logging why
- DO NOT modify working features unnecessarily
- DO NOT use `any` type in TypeScript
- DO NOT leave console.logs in production code
- DO NOT hardcode secrets or API keys
- DO NOT skip the progress log update

---

## When Complete

When all Phase 1-12 tasks are checked off (including verification, stress testing, and access audit):
1. Run frontend build check one final time
2. Confirm all verification, stress tests, and access audits passed
3. Output "INKFLOW_MVP_COMPLETE - PRODUCTION READY" in ralph.log
4. Exit

---

## Recovery Notes

If you encounter issues:
- **Build fails**: Read error message, fix the issue, do not skip
- **Server won't start**: Check if port is in use, kill process if needed
- **Database errors**: Run migrations, check connection string
- **Stuck on task**: Log the blocker in ralph.log, move to next task, return later
- **Previous iteration crashed**: Check `git status` for uncommitted changes (see Step 0)
- **Context ran out mid-task**: Next iteration will detect uncommitted changes and recover or reset

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `cd frontend && npm run dev` | Start frontend dev server |
| `cd backend && uvicorn app.main:app --reload` | Start backend dev server |
| `cd frontend && npm run build` | Build check |
| `cat ralph.log` | Check progress |
| `git log --oneline -10` | Recent commits |

---

## Ralph Loop Command

```bash
while :; do cat PROMPT.md | claude --chrome -p --dangerously-skip-permissions; done
```

**Flags:**
- `--chrome` - Enables browser tools for visual verification
- `-p` - Print mode (pipes input as prompt)
- `--dangerously-skip-permissions` - Autonomous file operations
