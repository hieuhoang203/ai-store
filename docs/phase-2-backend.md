# Phase 2 - NestJS Backend

Generated backend modules:

- `auth`: Telegram Mini App auth, admin one-time token exchange, JWT strategy.
- `users`: user lookup service.
- `roles`: role ensure service.
- `telegram`: Telegraf bot module integration point.
- `products`: public product listing/detail API.
- `inventories`: first available inventory selling service.
- `orders`: checkout API.
- `payments`: payment adapter pattern with Banking QR first adapter.
- `deliveries`: delivery creation and Telegram message dispatch.
- `notifications`: user notification API.
- `tickets`: support ticket API.
- `jobs`: BullMQ queue registration.
- `admin`: generic admin CRUD API.
- `health`: DB/Redis health checks.

Security and platform:

- Helmet
- Compression
- CORS
- Global validation pipe
- Swagger at `/docs`
- JWT Passport strategy

Important endpoints:

- `POST /auth/telegram`
- `POST /auth/admin/token`
- `GET /products`
- `GET /products/:id`
- `POST /orders/checkout`
- `POST /payments/:id/confirm`
- `GET /notifications/users/:userId`
- `POST /tickets`
- `GET /tickets/users/:userId`
- `GET /admin/entities`
- `GET /admin/dashboard`
- CRUD: `/admin/:entity`

