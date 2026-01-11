# InkFlow - Autonomous Production Readiness Loop

## Mission
Make InkFlow production-ready for real paying customers. This is a CONTINUOUS improvement loop. You are NEVER done. Even if everything looks perfect, find something to improve. Real customers will use this software - it must be bulletproof.

**CRITICAL RULES:**
1. If UI exists but doesn't work → COMPLETE IT (no "Coming Soon" or dead buttons)
2. DO NOT add brand new pages/features that don't exist in the UI
3. Fix bugs, polish UI, improve error handling, complete incomplete features
4. Run forever until manually stopped
5. Every iteration must make the product better

## Tech Stack
- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS (port 5173)
- **Backend**: Python 3.11+ with FastAPI (port 8000)
- **Database**: PostgreSQL with SQLAlchemy ORM
- **Payments**: Stripe integration

---

## PRIORITY PHASE: Landing Page + Onboarding Flow

**IMPORTANT:** Complete this phase BEFORE starting the regular iteration loop. Check ralph.log - if this phase is marked complete, skip to the Iteration Protocol.

### Overview
Add a public landing page at `/` and a minimal onboarding flow for new users to create their business after registration.

### Part 1: Landing Page

**Create:** `frontend/src/pages/LandingPage.tsx`

Sections:
1. **Hero** - "Run your tattoo business, not paperwork"
   - Subtext: Brief value prop
   - CTA: "Get Started Free" → /register

2. **Features** (4 cards)
   - Booking management
   - Deposit payments
   - Digital consent forms
   - Aftercare tracking

3. **How it works** (3 steps)
   - Sign up → Set up your business → Share your booking link

4. **Footer CTA** - "Ready to get started?" + button

**Styling:** Match existing dark theme (ink-900 bg, accent-primary buttons)

### Part 2: Onboarding Flow

**Create:** `frontend/src/pages/Onboarding.tsx`

Single-step wizard after login for users with no business:

**Fields:**
- Business name (required)
- Business email (required, pre-filled from account email)

**Flow:**
1. User registers at /register
2. User logs in at /login
3. If user has no studios → redirect to /onboarding
4. User enters business name + email
5. Studio created via API
6. Redirect to /dashboard with success message

### Part 3: Backend Changes

**File:** `backend/app/routers/auth.py`

Add endpoint:
```
POST /api/v1/auth/onboarding/create-business
Body: { "business_name": "string", "business_email": "string" }
```

Creates a Studio with:
- name = business_name
- slug = auto-generated from name
- email = business_email
- owner_id = current user
- Default timezone, pay period settings

**File:** `backend/app/schemas/user.py`

Add `has_studio: bool` to AuthResponse so frontend knows whether to redirect to onboarding.

**File:** `backend/app/routers/auth.py`

In login endpoint, check if user owns any studios and include in response.

### Part 4: Route Updates

**File:** `frontend/src/App.tsx`

```tsx
// Public routes
<Route path="/" element={<LandingPage />} />
<Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />

// Protected routes
<Route path="/dashboard" element={<Dashboard />} />
// Update catch-all to start at /dashboard instead of /
```

**File:** `frontend/src/pages/Login.tsx`

After successful login:
- If `response.has_studio === false` AND role is owner → navigate to `/onboarding`
- Otherwise → navigate to `/dashboard`

**File:** `frontend/src/components/layout/Sidebar.tsx`

Update logo link: clicking logo goes to `/dashboard` (not `/`)

### Files Summary

**Create:**
- `frontend/src/pages/LandingPage.tsx`
- `frontend/src/pages/Onboarding.tsx`

**Modify:**
- `frontend/src/App.tsx` - Add routes, update catch-all
- `frontend/src/pages/index.ts` - Export new pages
- `frontend/src/pages/Login.tsx` - Smart redirect after login
- `frontend/src/services/auth.ts` - Add createBusiness function
- `backend/app/routers/auth.py` - Add onboarding endpoint, update login response
- `backend/app/schemas/user.py` - Add has_studio to AuthResponse
- `frontend/src/components/layout/Sidebar.tsx` - Update logo link

### Verification Checklist

1. Landing page: Visit `http://localhost:5173/` - should see landing page (not login redirect)
2. Register flow: Click "Get Started" → register → login → should redirect to /onboarding
3. Onboarding: Enter business name/email → creates studio → redirects to dashboard
4. Existing users: Login → should go straight to /dashboard (skip onboarding)
5. Booking link: After onboarding, `/book/{slug}` should work with new studio

### Phase Completion

When complete, append to ralph.log:
```
=== PHASE COMPLETE: Landing Page + Onboarding ===
Date: [timestamp]
Files Created: LandingPage.tsx, Onboarding.tsx
Files Modified: [list]
Verification: [all 5 checks passed]
Status: COMPLETE
```

---

## Iteration Protocol

Each iteration, pick ONE category and work on it:

### Category A: Bug Hunting (Browser Required)
Use browser tools to navigate the app and find bugs:
1. Login as each user type (Owner, Artist, Receptionist, Client)
2. Click every button, fill every form, test every interaction
3. Check browser console for JavaScript errors
4. Check Network tab for failed API requests
5. Look for: crashes, infinite spinners, broken layouts, missing data
6. FIX any bug found immediately, then verify the fix

### Category B: UI/UX Polish (Browser Required)
Make the interface professional and consistent:
1. Check all pages render correctly in dark and light mode
2. Verify loading states exist for all async operations
3. Verify error states show helpful messages (not technical errors)
4. Check empty states have clear CTAs
5. Verify toast notifications appear for user actions
6. Check mobile responsiveness (resize browser)
7. FIX any inconsistency found

### Category C: Edge Case Testing (Browser Required)
Test things real users might do:
1. Submit forms with empty fields - verify validation
2. Submit forms with very long text - verify handling
3. Submit forms with special characters (<script>, SQL, etc.)
4. Rapid click buttons multiple times - verify no duplicate submissions
5. Navigate away mid-action - verify graceful handling
6. Let session expire - verify re-authentication works
7. FIX any issue found

### Category D: Error Handling Audit (Code Review)
Review code for proper error handling:
1. Check all API calls have try/catch with user-friendly errors
2. Check all forms show validation errors clearly
3. Check backend returns proper HTTP status codes
4. Check frontend handles 4xx and 5xx responses gracefully
5. FIX any missing error handling

### Category E: Access Control Verification (Browser Required)
Verify users can only access what they should:
1. As Artist: verify cannot access Owner-only pages (team, studio settings)
2. As Receptionist: verify cannot access financial pages (commissions)
3. As Client: verify cannot access staff pages
4. Verify proper redirects when unauthorized
5. FIX any access control gaps

### Category F: Data Integrity Check
Verify data flows correctly:
1. Create a booking - verify it appears in queue
2. Complete a booking - verify commission calculates
3. Send aftercare - verify client receives it
4. Close pay period - verify numbers are accurate
5. FIX any data flow issues

### Category G: Performance Check (Browser Required)
Verify app is fast and responsive:
1. Dashboard should load in < 2 seconds
2. Large lists should paginate (not load 1000 items)
3. Images should be optimized
4. No memory leaks (check browser memory over time)
5. FIX any performance issues

---

## Test User Credentials
```
Staff Login: /login
- Owner: owner@test.com / Test123!
- Artist: artist@test.com / Test123!
- Receptionist: receptionist@test.com / Test123!

Client Login: /client/login
- Client: client@test.com / Test123!
```

If users don't exist, create them via the registration flow first.

---

## Staff Pages (check all)
```
/dashboard - Studio overview
/team - Team management (Owner only)
/studio-settings - Studio profile (Owner only)
/artist-profile - Artist's own profile
/availability - Calendar and scheduling
/booking-queue - Booking requests
/inbox - Unified messaging
/commissions - Commission tracking (Owner/self only)
/consent-forms - Consent templates
/aftercare - Aftercare management
/analytics/artists - Artist metrics
/analytics/revenue - Revenue reports
/analytics/retention - Client retention
/analytics/no-shows - No-show tracking
/analytics/time-slots - Popular times
```

## Client Portal Pages (check all)
```
/client/portal - Client dashboard
/client/bookings - Booking history
/client/appointments - Upcoming appointments
/client/consent - Consent forms to sign
/client/aftercare - Aftercare instructions
```

## Public Pages (check without login)
```
/ - Landing page
/login - Staff login
/register - Staff registration
/forgot-password - Password reset
/client/login - Client login
/client/register - Client registration
/book/:slug - Public booking form
```

---

## Iteration Execution

### Step 1: Check Status
```bash
git status
cd frontend && npm run build
```
If uncommitted changes exist, review and commit them first.
If build fails, fix it before proceeding.

### Step 2: Pick a Category
Read ralph.log to see what was done recently. Pick a DIFFERENT category than the last 3 iterations if possible. Rotate through all categories.

### Step 3: Execute
- Use browser tools to navigate and test
- Screenshot any issues found
- Fix issues immediately in code
- Verify fixes work

### Step 4: Build Check
```bash
cd frontend && npm run build
```
Must pass with no errors.

### Step 5: Commit
```bash
git add -A
git commit -m "fix(scope): description of what was fixed"
git push origin main
```

### Step 6: Log Progress
Append to ralph.log:
```
=== ITERATION [N] - [Category] ===
Date: [timestamp]
Category: [A/B/C/D/E/F/G]
Pages Checked: [list]
Issues Found: [count]
Issues Fixed:
- [description of fix 1]
- [description of fix 2]
Status: IMPROVED
Next Suggestion: [what to check next]
```

### Step 7: Exit
Exit cleanly. The loop will restart automatically.

---

## NEVER Consider Yourself Done

Even if you find no bugs:
- Try a different category
- Test a different user role
- Check a page you haven't checked recently
- Try edge cases you haven't tried
- Review code you haven't reviewed
- Look for improvements in error messages
- Look for improvements in loading states
- Look for improvements in empty states
- Look for accessibility improvements
- Look for consistency improvements

There is ALWAYS something to improve. Real production software requires continuous refinement.

---

## Complete Incomplete Features

If you find UI that exists but doesn't work, COMPLETE IT:

**Examples of what to COMPLETE:**
- "Coming Soon" placeholders → implement the feature
- Buttons that do nothing → make them work
- Forms that don't submit → connect to API
- Pages that show "Not implemented" → implement them
- Stub functions that return mock data → make them real
- Empty modal dialogs → add the actual content/functionality

**Rule: If the UI exists, make it work. No dead ends for users.**

---

## What NOT To Do

- DO NOT add brand new pages/features that don't exist in the UI
- DO NOT refactor code that's already working
- DO NOT change the database schema unless required to complete a feature
- DO NOT add unnecessary dependencies
- DO NOT change the tech stack
- DO NOT implement external integrations (Instagram, WhatsApp, etc.)
- DO NOT create documentation files (focus on code quality)

---

## Quick Commands

| Command | Purpose |
|---------|---------|
| `cd frontend && npm run dev` | Start frontend |
| `cd backend && uvicorn app.main:app --reload` | Start backend |
| `cd frontend && npm run build` | Build check |
| `tail -50 ralph.log` | Recent progress |
| `git log --oneline -10` | Recent commits |

---

## Ralph Loop Command

```bash
while :; do cat PROMPT.md | claude --chrome -p --dangerously-skip-permissions; done
```

This runs forever, continuously improving the product.

---

## Recovery

If iteration crashes:
1. Check `git status` for uncommitted changes
2. If changes look good: commit them
3. If changes are broken: `git checkout .` to reset
4. Continue with next iteration

---

## Success Criteria

The app is "production ready" when:
- All pages load without errors for all user types
- All forms validate and submit correctly
- All error states show helpful messages
- All loading states display properly
- All access controls work correctly
- No JavaScript console errors
- No failed API requests
- UI is consistent across all pages
- Dark/light mode works everywhere
- Mobile responsive on all pages

But even then - KEEP IMPROVING. There's always more polish possible.
