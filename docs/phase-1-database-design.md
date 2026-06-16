# AI Store Phase 1 - Database Design

## Standards

All persistent tables have:

- `id UUID PRIMARY KEY`
- `created_at TIMESTAMPTZ`
- `updated_at TIMESTAMPTZ`
- `is_deleted BOOLEAN DEFAULT FALSE`

Naming convention:

- PostgreSQL table and column names use `snake_case`.
- Prisma model and field names use `PascalCase` and `camelCase`.
- Prisma maps names via `@@map` and `@map`.

## Enums

- `UserStatus`: `INACTIVE`, `ACTIVE`, `LOCKED`
- `RoleName`: `SUPER_ADMIN`, `ADMIN`, `SUPPORT`, `CUSTOMER`
- `InventoryStatus`: `AVAILABLE`, `RESERVED`, `SOLD`, `LOCKED`
- `OrderStatus`: `PENDING`, `PAID`, `DELIVERED`, `CANCELLED`, `REFUNDED`
- `PaymentStatus`: `PENDING`, `PAID`, `FAILED`, `REFUNDED`
- `DeliveryStatus`: `PENDING`, `DELIVERED`, `FAILED`
- `TicketStatus`: `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`
- `NotificationType`: `SYSTEM`, `ORDER`, `PAYMENT`, `DELIVERY`, `SUPPORT`
- `AuditAction`: `CREATE`, `UPDATE`, `DELETE`, `LOGIN`, `LOGOUT`, `PAYMENT_WEBHOOK`, `DELIVERY_SENT`
- `PaymentProvider`: `BANKING_QR`, `MOMO`, `ZALOPAY`, `VNPAY`
- `AdminLoginTokenStatus`: `PENDING`, `USED`, `EXPIRED`, `REVOKED`

## Important Flows

### Customer Authentication

1. Telegram user opens Mini App.
2. Mini App sends Telegram `initData` to backend.
3. Backend verifies `initData`.
4. Backend creates or updates `users`.
5. Backend issues JWT and refresh token.

### Admin Authentication

1. Admin sends `/admin` to Telegram Bot.
2. Backend checks `users.telegram_id`.
3. Backend checks `ADMIN` or `SUPER_ADMIN` role.
4. Backend creates `admin_login_tokens` with hashed one-time token.
5. Bot sends login URL.
6. Admin web exchanges token for Admin JWT.

### Order Delivery

1. User checks out cart.
2. Backend creates `orders`, `order_items`, and `payments`.
3. Banking QR payment is confirmed.
4. Backend marks payment `PAID`.
5. Backend selects first `AVAILABLE` inventory.
6. Backend marks inventory `SOLD`.
7. Backend creates `deliveries`.
8. Backend sends Telegram delivery message.

## Migration Notes

The Phase 1 Prisma schema is the target production schema. Existing development data may use older `SMALLINT` status columns. Before applying this schema to an existing database, create a data migration plan:

1. Back up Aiven PostgreSQL.
2. Convert numeric statuses to enum strings.
3. Add missing `id`, `updated_at`, and `is_deleted` columns where needed.
4. Add foreign keys after data quality checks.
5. Apply Prisma migration.

