# Phase 3 - Telegram Bot

The backend now has a `TelegramModule` using Telegraf.

Commands:

- `/start`: sends Mini App launch button and quick actions.
- `/admin`: checks Telegram user and ADMIN/SUPER_ADMIN role, creates one-time admin login token, sends admin login URL.
- `/support`: starts support guidance.

Required env:

```env
TELEGRAM_BOT_TOKEN="replace-me"
TELEGRAM_MINIAPP_URL="http://localhost:0405"
ADMIN_APP_URL="http://localhost:2110"
```

When `TELEGRAM_BOT_TOKEN` is empty, the bot is disabled and backend still boots.

