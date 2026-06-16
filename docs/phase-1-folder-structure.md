# AI Store Phase 1 - Folder Structure

The current repository already contains:

```text
ai-store/
  be-ai-store/
  fe-ai-store/
```

The target monorepo structure from the product prompt is:

```text
ai-store/
  frontend-admin/
    src/
    public/
    components/
    features/
    hooks/
    lib/
    providers/
    store/
    services/
    app/
  frontend-miniapp/
    src/
    public/
    components/
    features/
    hooks/
    lib/
    providers/
    store/
    services/
    app/
  backend/
    src/
      auth/
      users/
      roles/
      telegram/
      products/
      inventories/
      orders/
      payments/
      deliveries/
      notifications/
      tickets/
      audit-logs/
      common/
      configs/
      prisma/
      jobs/
  docs/
  docker-compose.yml
  .env.example
  README.md
```

## Migration Strategy

To avoid disrupting the existing runnable apps, Phase 1 keeps the current working directories and documents the target structure. A later repo-restructure phase can rename:

| Current | Target |
| --- | --- |
| be-ai-store | backend |
| fe-ai-store | frontend-admin |
| new app | frontend-miniapp |

This keeps the current backend and admin UI stable while the product architecture is expanded.

