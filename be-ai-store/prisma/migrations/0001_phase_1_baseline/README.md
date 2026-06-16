# Phase 1 Baseline Migration

This folder represents the Phase 1 baseline migration for the target production schema.

Prisma 7 did not emit SQL from `migrate diff` in this workspace because the datasource URL is intentionally not stored in `schema.prisma`. Generate the concrete SQL in the deployment environment after configuring the datasource:

```bash
npx prisma migrate diff --from-empty --to-config-datasource --script
```

For the current Aiven database, do not apply a destructive baseline directly. First create a data migration plan because older tables may store status values as `SMALLINT`.

