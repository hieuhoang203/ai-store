# Phase 4 - Telegram Mini App

Generated app: `frontend-miniapp`

Features:

- Next.js App Router app on port `0405`.
- Telegram provider with `ready`, `expand`, initData, color scheme.
- Hooks:
  - `useTelegramUser`
  - `useTelegramTheme`
  - `useTelegramViewport`
  - `useTelegramBackButton`
  - `useTelegramMainButton`
- Bottom navigation:
  - Home
  - Categories
  - Cart
  - Orders
  - Profile
- Product listing from backend `/products`.
- Zustand cart.
- Checkout integration with backend `/orders/checkout`.

Run:

```bash
cd frontend-miniapp
npm run dev
```

URL: http://localhost:0405

