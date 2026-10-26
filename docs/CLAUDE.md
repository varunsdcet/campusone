You are working in the MyHeritage monorepo. Read this before any change.

SOURCE OF TRUTH, IN ORDER
1. tools/register/register_v2.csv — what exists, who may do what, approval, audit, event.
2. packages/contracts, packages/tokens, packages/ui/AppShell — the technical and visual contract.
3. The design frame named in your ticket — layout, content, hierarchy and copy ONLY.
   If the frame's navigation, AI button, search placeholder, product name or logo differs
   from AppShell, AppShell wins. Do not reproduce the frame's chrome.
4. docs/spec/*.md — data model, permissions, AI tiers, provenance.

YOU MUST
- Work only on the ticket you were given; one ticket = one PR = one register ID.
- Define every shape in packages/contracts first. Import from it everywhere. Never hand-write a type.
- Put institution_id on every table, query, event, audit row and storage path.
- Write AuditEvent + event_outbox in the same transaction for every mutation.
- Route every consequential write through the approval engine (packages/auth/approvals).
- Route every AI call through packages/ai; never call a model directly; never return
  AI content without sources.
- Use only packages/ui components and packages/tokens values. Never a hex literal.
  Never a <nav>. Never a custom button.
- Implement all six states (loading, empty, error, permission-denied, offline, archived).
- Use FD-07 fixtures only. CAD. Surrey, BC. Marcus Vance is ST-2024-001, born 2003-11-14,
  Computer Science. There is exactly one Marcus.
- Run `pnpm verify` before opening the PR and paste the summary in the PR.
- Fill the DoD checklist in the PR template honestly. An unticked box is fine; a falsely
  ticked box gets the PR closed.

YOU MUST NOT
- Invent fields, endpoints, statuses, roles or menu items that are not in the register or
  contracts. If you need one, stop and open a "contract change" ticket instead.
- Collect, display, match on or log a SIN, SSN, passport number or any government ID.
  Identity match returns a boolean result only.
- Use the words Terminal, Command Center, Console, Navigator, Campus OS, Copilot, Deploy,
  Lumen, or "Powered by" in UI copy.
- Display draft grades to students, or let anyone edit a published grade outside the
  correction workflow.
- Enable the AI tutor while an assessment attempt is open.
- Add a dark theme, a left rail, or a second navigation bar.
- Change packages/contracts, packages/auth, packages/events, the approval engine, the AI
  gateway, packages/tokens or AppShell in the same PR as a feature. Those are separate PRs
  with a human security/design reviewer.
- Skip a failing test by deleting it, marking it skip, or widening its assertion.
- Merge. Humans merge.

WHEN UNSURE
Stop. Write what you are unsure about in the PR description under "Open questions"
and leave the PR in draft. Do not guess.
