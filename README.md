# AI Store

AI Store is a Telegram-native automated digital goods store.

## Apps

| App | Current directory | Target directory | Local URL |
| --- | --- | --- | --- |
| Backend API | `be-ai-store` | `backend` | http://localhost:8903 |
| Admin Web | `fe-ai-store` | `frontend-admin` | http://localhost:2110 |
| Telegram Mini App | not generated yet | `frontend-miniapp` | http://localhost:0405 |

## Phase 1 Documents

- [System Architecture](docs/phase-1-system-architecture.md)
- [Folder Structure](docs/phase-1-folder-structure.md)
- [ERD](docs/phase-1-erd.md)
- [Database Design](docs/phase-1-database-design.md)
- [Backend](docs/phase-2-backend.md)
- [Telegram Bot](docs/phase-3-telegram-bot.md)
- [Telegram Mini App](docs/phase-4-miniapp.md)
- [Admin Dashboard](docs/phase-5-admin-dashboard.md)
- [Docker and Deployment](docs/phase-6-deployment.md)

## Local Development

Backend:

```bash
cd be-ai-store
npm install
npm run start:dev
```

Frontend Admin:

```bash
cd fe-ai-store
npm install
npm run dev
```

Telegram Mini App:

```bash
cd frontend-miniapp
npm install
npm run dev
```
