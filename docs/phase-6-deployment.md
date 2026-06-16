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
- Store `DATABASE_URL`, `REDIS_URL`, JWT secrets, Telegram bot token, and MinIO secrets in a secret manager.
- Replace `sslmode=no-verify` with `sslmode=verify-full` and Aiven CA certificate before production.
- Run Prisma migrations only after backing up the database and completing status enum data migration.

