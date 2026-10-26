# Production deploy (VPS)

Artifacts live in `deploy/`. **Do not run deploy from your laptop over SSH in this guide’s automation** — copy the repo to the server, then run the steps below on the host.

## Target layout

```text
/opt/myheritage/                 # git clone or rsync of this repo
/opt/myheritage/.env.production  # from deploy/.env.production.example
/opt/myheritage/deploy/          # compose, Dockerfiles, nginx, deploy.sh
```

Host: `46.202.163.202`  
App root on server: `/opt/myheritage`

## 1. Prerequisites on the VPS

```bash
# Docker Engine + Compose plugin
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
# Install Docker per https://docs.docker.com/engine/install/ubuntu/
docker version
docker compose version
```

Open firewall ports as needed: `80` (nginx), `3000` (web), `4000` (api). Postgres should stay internal (no public `5432` in prod compose).

## 2. Place the code

```bash
sudo mkdir -p /opt/myheritage
sudo chown "$USER":"$USER" /opt/myheritage
# from your machine (example):
#   rsync -az --exclude node_modules --exclude .next --exclude .git \
#     ./ user@46.202.163.202:/opt/myheritage/
# or on the server:
#   git clone <your-remote> /opt/myheritage
cd /opt/myheritage
```

## 3. Production env

```bash
cp deploy/.env.production.example .env.production
# edit SESSION_SECRET, JWT_SECRET, POSTGRES_PASSWORD if rotating
nano .env.production
```

`TRUST_PROXY` controls which proxies the API believes for the client IP used by the public rate limits
(`/verify`, `/apply`, certificates). The default (`loopback, linklocal, uniquelocal`) is right for
nginx → web → api. Behind a CDN or public load balancer set the hop count (e.g. `TRUST_PROXY=3`),
or every visitor lands in one rate-limit bucket and gets 429 after 30 requests per 15 minutes.

Uploaded files live in the `uploads` volume (`FILE_STORAGE_ROOT=/app/var/uploads`), not in the
synced source tree; the sync scripts also protect any `var/uploads/` folder from `rsync --delete`.

Expected DB URL inside compose network:

```text
postgresql://heritage:HeritagePg!2026@postgres:5432/heritage
```

## 4. Deploy

```bash
cd /opt/myheritage
chmod +x deploy/deploy.sh
./deploy/deploy.sh
```

What `deploy.sh` does:

1. `docker compose -f deploy/docker-compose.prod.yml up -d --build` (postgres, api, web, workers, optional nginx)
2. Waits for Postgres health
3. `prisma migrate deploy` inside the api image
4. Seeds FD-07 demo users (`SEED=1` by default)
5. Hits `/health` on the API

### Flags / env

| Variable | Default | Meaning |
|----------|---------|---------|
| `WITH_NGINX` | `1` | Enable nginx profile (`:80` → web + API paths) |
| `SEED` | `1` | Run `pnpm --filter @myheritage/db seed` |
| `ROOT` | `/opt/myheritage` | Repo path on the server |
| `ENV_FILE` | `$ROOT/.env.production` | Compose env file |

Examples:

```bash
SEED=0 ./deploy/deploy.sh              # migrate only, no re-seed
WITH_NGINX=0 ./deploy/deploy.sh        # web:3000 + api:4000 only
```

### Manual compose (equivalent)

```bash
cd /opt/myheritage
docker compose -f deploy/docker-compose.prod.yml --project-directory . \
  --profile with-nginx --env-file .env.production up -d --build

docker compose -f deploy/docker-compose.prod.yml --project-directory . \
  --env-file .env.production run --rm --no-deps \
  -e DATABASE_URL='postgresql://heritage:HeritagePg!2026@postgres:5432/heritage' \
  api pnpm --filter @myheritage/db exec prisma migrate deploy

docker compose -f deploy/docker-compose.prod.yml --project-directory . \
  --env-file .env.production run --rm --no-deps \
  -e DATABASE_URL='postgresql://heritage:HeritagePg!2026@postgres:5432/heritage' \
  api pnpm --filter @myheritage/db seed
```

### First deploy alternative: `prisma db push`

If migrate history is empty and you only need schema sync once:

```bash
docker compose -f deploy/docker-compose.prod.yml --project-directory . \
  --env-file .env.production run --rm --no-deps \
  -e DATABASE_URL='postgresql://heritage:HeritagePg!2026@postgres:5432/heritage' \
  api pnpm --filter @myheritage/db exec prisma db push
```

Then optionally baseline:

```bash
... api pnpm --filter @myheritage/db exec prisma migrate resolve --applied 20260915094700_init_postgresql
```

See also `packages/db/prisma/MIGRATIONS.md`.

## 5. Verify

```bash
curl -sS http://127.0.0.1:4000/health
curl -sS http://127.0.0.1:4000/api/docs | head
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/

# Full admin live E2E (login + SIS screens + mutation + domain CRUD)
./deploy/smoke-admin-e2e.sh
```

Admin demo login after seed: `admin@heritage.edu` / `Heritage!2026`

Every `/admin/f/*` SIS screen loads from `GET /admin/sis/screen` (DB-backed). Orphan CTAs call `POST /admin/sis/action`. Legacy `/admin/*` aliases redirect into the matching SIS module.
# with nginx:
curl -sS http://127.0.0.1/health
```

Public URLs:

- Web: http://46.202.163.202:3000 (or http://46.202.163.202 with nginx)
- API: http://46.202.163.202:4000
- OpenAPI: http://46.202.163.202:4000/api/openapi.json

### Seed logins

| Role | Email | Password |
|------|-------|----------|
| Instructor | vance.instructor@heritage.edu | Heritage!2026 |
| Student | marcus.vance@heritage.edu | Heritage!2026 |
| Admin | admin@heritage.edu | Heritage!2026 |

## 6. Nginx routing

`deploy/nginx.conf` (profile `with-nginx`):

| Path | Upstream |
|------|----------|
| `/` | `web:3000` |
| `/api/`, `/auth/`, `/grades/`, `/gradebooks/`, `/grade-items/`, `/approvals`, `/messages/`, `/search`, `/health`, `/me/`, `/courses/`, `/notifications/`, `/calendar/` | `api:4000` |

Browser default API base (`apps/web/src/lib/api.ts`):

```ts
process.env.NEXT_PUBLIC_API_URL ?? 'http://46.202.163.202:4000'
```

To use same-origin paths through nginx, set `NEXT_PUBLIC_API_URL=` (empty) in `.env.production` and rebuild `web`.

## 7. Updates

```bash
cd /opt/myheritage
# pull / rsync new code
./deploy/deploy.sh
# or: SEED=0 ./deploy/deploy.sh
```

## Services

| Service | Image / build | Port |
|---------|---------------|------|
| postgres | `pgvector/pgvector:pg16` | internal |
| api | `deploy/Dockerfile.api` | 4000 |
| web | `deploy/Dockerfile.web` | 3000 |
| workers | `deploy/Dockerfile.workers` | — |
| nginx | `nginx:1.27-alpine` | 80 (optional profile) |
