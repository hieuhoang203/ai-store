# Phase 6 - Docker and Deployment

## Local Docker

```bash
docker compose up --build
```

Services:

- Backend API: http://localhost:8903
- Swagger: http://localhost:8903/docs
- Admin: http://localhost:2110
- Mini App: http://localhost:0405
- MinIO Console: http://localhost:9001

## Production Notes

- Use managed PostgreSQL on Aiven.
- Use Upstash or managed Redis for BullMQ and cache.
- Store `DATABASE_URL`, `REDIS_URL`, `TELEGRAM_BOT_TOKEN`, JWT secrets, and MinIO secrets in a secret manager.
- Replace `sslmode=no-verify` with `sslmode=verify-full` and Aiven CA certificate before production.
- Run Prisma migrations only after backing up the database and completing status enum data migration.

## Production Compose

`docker-compose.prod.yml` reads production values from the deploy environment and fails fast when required secrets are missing.

Required backend variables:

- `DATABASE_URL`
- `REDIS_URL`
- `TELEGRAM_BOT_TOKEN`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `NEXT_PUBLIC_API_BASE_URL`

Example:

```bash
DATABASE_URL='postgres://...' \
REDIS_URL='rediss://...' \
TELEGRAM_BOT_TOKEN='...' \
JWT_ACCESS_SECRET='...' \
JWT_REFRESH_SECRET='...' \
NEXT_PUBLIC_API_BASE_URL='https://api.example.com' \
docker compose -f docker-compose.prod.yml up --build -d
```

