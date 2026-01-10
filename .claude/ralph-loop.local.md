---
active: true
iteration: 1
max_iterations: 20
completion_promise: "COMPLETE"
started_at: "2026-01-09T23:42:25Z"
---

## Phase 1:
Build a REST API SaaS endpoint:
- Multi-step Organization registration
    - Step 1: Request minimal org details
    - Step 2: Request minimal owner (user) details
- User invitation to Org (email client placeholder implement EmailClient interface)
- User login, session management, etc (prefer auth.js, user and password or github)
- Implement auth validation on all internal pages and apis
    - Org registration and homepage are not internal, everything else is pretty much internal

## Phase 2:
Build UI for Saas:
- Beatiful modern homepage, showing project features and plan (mostly static, dynamic plans from database) and registration
- Move current homepage to /dashboard, reparent other pages and apis as needed
- Build logging UI (modern standards, secure, etc)

## Phase 3:
Implement unit test for critical functions:
- Org registration
- Login
- Dashboard access if logged in
- No cross org access (user permissions)
- Dashboard not accessible if not logged in

When complete:
- All endpoints implemented and working
- Input validation in place
- Tests passing
- Output: <promise>COMPLETE</promise>
