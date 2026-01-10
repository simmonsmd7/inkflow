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

### Phase 10: Future Enhancements (DO NOT IMPLEMENT - requires manual setup)
These features require external service setup that cannot be automated:
- [ ] **P10.1** Instagram DM integration (requires Meta business verification + app review)
- [ ] **P10.2** Facebook Messenger integration (requires Meta approval)
- [ ] **P10.3** WhatsApp Business integration (requires Meta approval)

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

When all Phase 1-9 tasks are checked off:
1. Run full test suite
2. Verify all features work end-to-end
3. Output "INKFLOW_MVP_COMPLETE" in ralph.log
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
