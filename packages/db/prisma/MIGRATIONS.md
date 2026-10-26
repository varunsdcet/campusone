# Prisma migrations (PostgreSQL)

The datasource provider is **postgresql**. The SQLite `dev.db` workflow is retired.

## First deploy (pick one)

### Option A — migrate deploy (preferred once history is applied)

```bash
export DATABASE_URL="postgresql://heritage:HeritagePg!2026@127.0.0.1:5432/heritage"
pnpm --filter @myheritage/db exec prisma migrate deploy
pnpm db:generate
pnpm db:seed
```

### Option B — db push (fastest first bring-up)

Use when `_prisma_migrations` is empty and you only need the schema on a fresh Postgres:

```bash
export DATABASE_URL="postgresql://heritage:HeritagePg!2026@127.0.0.1:5432/heritage"
pnpm --filter @myheritage/db exec prisma db push
pnpm db:generate
pnpm db:seed
```

After Option B, optionally baseline so later `migrate deploy` works:

```bash
pnpm --filter @myheritage/db exec prisma migrate resolve --applied 20260915094700_init_postgresql
```

## Local Docker Postgres

```bash
docker compose up -d postgres
# ensure packages/db/.env or root .env has the postgresql:// URL above
pnpm db:migrate
pnpm db:seed
```
