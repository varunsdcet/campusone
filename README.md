# MyHeritage AI Campus OS

Contract-first monorepo for MyHeritage. See `docs/CLAUDE.md` and the development plan.

## Quick start

```bash
export PATH="$HOME/.local/bin:$PATH"   # if pnpm installed locally
pnpm install
docker compose up -d postgres          # pgvector/pg16 on :5432
# DATABASE_URL=postgresql://heritage:HeritagePg!2026@127.0.0.1:5432/heritage
cp .env.example .env
cp packages/db/.env.example packages/db/.env
pnpm db:migrate
pnpm db:seed
pnpm --filter @myheritage/api dev      # :4000
pnpm --filter @myheritage/workers dev  # outbox → notifications
pnpm --filter @myheritage/web dev      # :3000
```

Postgres notes: see `packages/db/prisma/MIGRATIONS.md`. Production deploy: `deploy/README.md`.

- Web: http://localhost:3000
- API: http://localhost:4000
- API docs: http://localhost:4000/api/docs

## Seed logins (FD-07)

| Role | Email | Password |
|------|-------|----------|
| Instructor | vance.instructor@heritage.edu | Heritage!2026 |
| Student | marcus.vance@heritage.edu | Heritage!2026 |
| Admin | admin@heritage.edu | Heritage!2026 |

## WP0 proof slice

```bash
# API must be running
pnpm proof
```

Expected: instructor publish → admin approve/apply → student sees published grade → ask-about-grade message → audit + outbox rows.

## Verify

```bash
pnpm --filter @myheritage/tokens contrast
pnpm --filter @myheritage/contracts test
pnpm --filter @myheritage/api openapi:check
pnpm proof
```

## VPS

Keep deployment credentials out of this repo (use a local secret store / env files only).
