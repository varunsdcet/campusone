# Bluehost Heritage deployment

This file records non-secret deployment details only. Do not commit portal
passwords, SSH private keys, private-key passphrases, application secrets, or
database passwords.

## Server

- Provider: Bluehost self-managed hosting
- Public IPv4: `50.6.243.143`
- Application root: `/opt/myheritage`
- Operating system: Ubuntu 24.04 LTS
- Runtime: Docker Engine with Docker Compose
- Compose file: `deploy/docker-compose.prod.yml`
- Production environment file: `/opt/myheritage/.env.production` (mode `0600`)

Use the repository root as the Compose project directory:

```sh
docker compose \
  -f /opt/myheritage/deploy/docker-compose.prod.yml \
  --project-directory /opt/myheritage \
  --env-file /opt/myheritage/.env.production \
  ps
```

## DNS required before public cutover

Create or update these records to `50.6.243.143`:

- `appslure.app` A record
- `www.appslure.app` A record or CNAME to `appslure.app`
- `bbb.appslure.app` A record

Use a short TTL during cutover. Do not enable the new public application or
BigBlueButton until HTTPS certificates are valid for their hostnames.

## Safe staging mode

While the existing VPS remains live, the Bluehost copy must use:

```dotenv
BIND_HOST=127.0.0.1
ENABLE_API_SCHEDULERS=false
BBB_URL=off
```

Keep the workers service stopped in staging. This prevents public exposure and
duplicate scheduled jobs or notifications.

## BigBlueButton

The Heritage integration reads `BBB_URL`, `BBB_SECRET`, and
`BBB_CHECKSUM_ALGORITHM`. Configure these only after the BigBlueButton hostname,
TLS certificate, firewall ports, and provider health checks are ready.

BigBlueButton is designed for a dedicated host and needs exclusive public web
ports. If it is colocated with Heritage, BigBlueButton's nginx must be the
public reverse proxy for both hostnames. With the current server disk size,
recording should stay disabled unless additional recording storage and a
retention policy are provisioned.

## Cutover checklist

1. Put the old application into a short maintenance window.
2. Take a fresh database dump and upload-volume snapshot.
3. Restore the final snapshot on Bluehost and compare key record counts.
4. Enable HTTPS, switch `WEB_ORIGIN` and `WEB_PUBLIC_URL` to the public domain,
   and keep API/web bound behind the reverse proxy.
5. Start workers and schedulers on Bluehost only after stopping them on the old
   VPS.
6. Change DNS and verify health, authentication boundaries, uploads, logs, and
   container restart counts.
7. Keep the old VPS available for rollback until post-cutover verification is
   complete.
