import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Markup, Telegraf } from 'telegraf';
import {
  DeliveryStatus,
  OrderStatus,
  PaymentStatus,
  Prisma,
  RoleName,
} from '../../generated/prisma/client.js';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../database/prisma.service';
import { InventoryPasswordService } from '../inventories/inventory-password.service';

const TELEGRAM_MESSAGE_LIMIT = 3900;
const ORDER_LIST_LIMIT = 10;

type OrderListItem = Prisma.OrderGetPayload<{
  include: {
    items: {
      include: {
        variant: { include: { product: true } };
      };
    };
  };
}>;

type OrderDetail = Prisma.OrderGetPayload<{
  include: {
    payments: true;
    items: {
      include: {
        variant: { include: { product: true } };
        deliveries: {
          include: { inventory: true };
        };
      };
    };
  };
}>;

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);
  private bot?: Telegraf;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly inventoryPasswordService: InventoryPasswordService,
  ) {}

  async onModuleInit() {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      this.logger.warn('TELEGRAM_BOT_TOKEN is not configured. Telegram bot is disabled.');
      return;
    }

    this.bot = new Telegraf(token);
    this.registerCommands(this.bot);
    // Chỉ hiển thị 2 lệnh công khai trong menu gợi ý của Telegram
    await this.bot.telegram.setMyCommands([
      { command: 'start', description: '🛒 Mở AI Store' },
      { command: 'support', description: '🆘 Liên hệ hỗ trợ' },
    ]);
    // Lệnh /admin vẫn hoạt động khi gọi trực tiếp nhưng ẩn khỏi menu
    void this.bot
      .launch()
      .then(() => this.logger.log('Telegram bot launched'))
      .catch((error: Error) => {
        this.logger.error(`Telegram bot launch failed: ${error.message}`);
      });
  }

  async onModuleDestroy() {
    this.bot?.stop('NestJS shutdown');
  }

  async sendMessage(telegramId: bigint | number | string, message: string) {
    if (!this.bot) return;
    for (const chunk of this.chunkMessage(message)) {
      await this.bot.telegram.sendMessage(String(telegramId), chunk);
    }
  }

  async sendHtmlMessage(telegramId: bigint | number | string, message: string) {
    if (!this.bot) return;
    for (const chunk of this.chunkMessage(message)) {
      await this.bot.telegram.sendMessage(String(telegramId), chunk, { parse_mode: 'HTML' });
    }
  }

  private registerCommands(bot: Telegraf) {
    bot.start(async (context) => {
      await this.syncTelegramProfile(context.from);
      await this.replyStartMenu(context);
    });

    bot.action('start', async (context) => {
      await context.answerCbQuery().catch(() => undefined);
      await this.syncTelegramProfile(context.from);
      await this.replyStartMenu(context);
    });

    bot.action('support', async (context) => {
      await context.answerCbQuery().catch(() => undefined);
      await this.syncTelegramProfile(context.from);
      await context.reply(this.renderSupportInfoMessage());
    });

    bot.action('orders', async (context) => {
      await context.answerCbQuery().catch(() => undefined);
      await this.syncTelegramProfile(context.from);
      await this.replyOrderList(context);
    });

    bot.action('orders:back', async (context) => {
      await context.answerCbQuery().catch(() => undefined);
      await this.syncTelegramProfile(context.from);
      await this.replyOrderList(context);
    });

    bot.action(/^order:(.+)$/, async (context) => {
      await context.answerCbQuery().catch(() => undefined);
      await this.syncTelegramProfile(context.from);
      const orderId = context.match[1];
      await this.replyOrderDetail(context, orderId);
    });

    bot.action(/^warranty:(.+)$/, async (context) => {
      await this.syncTelegramProfile(context.from);
      await context.answerCbQuery('Vui lòng nhắn mô tả lỗi, đội hỗ trợ sẽ phản hồi sớm.').catch(() => undefined);
    });

    bot.command('support', async (context) => {
      await this.syncTelegramProfile(context.from);
      await context.reply(this.renderSupportInfoMessage());
    });

    bot.command('admin', async (context) => {
      await this.syncTelegramProfile(context.from);
      const telegramId = BigInt(context.from.id);
      const user = await this.prisma.user.findUnique({
        where: { telegramId },
        include: {
          roles: {
            include: { role: true },
            where: { isDeleted: false },
          },
        },
      });

      const roles = user?.roles.map((item) => item.role.name) || [];
      const allowed = roles.includes(RoleName.ADMIN) || roles.includes(RoleName.SUPER_ADMIN);
      if (!user || !allowed) {
        await context.reply('Bạn không có quyền truy cập trang quản trị.');
        return;
      }

      const token = await this.authService.createAdminLoginToken(user.id);
      const adminUrl = this.configService.getOrThrow<string>('ADMIN_APP_URL');
      await context.reply(`${adminUrl}/auth/login?token=${token}`);
    });
  }

  private async syncTelegramProfile(from?: {
    id: number;
    username?: string;
    first_name?: string;
    last_name?: string;
  }) {
    if (!from?.id) return;

    await this.authService.upsertTelegramUserProfile({
      id: from.id,
      username: from.username,
      firstName: from.first_name,
      lastName: from.last_name,
    });
  }

  private async replyStartMenu(context: { reply: (...args: any[]) => unknown }) {
    const miniAppUrl = this.configService.getOrThrow<string>('TELEGRAM_MINIAPP_URL');
    const launchButtons = this.isHttpsUrl(miniAppUrl)
      ? [[Markup.button.webApp('🛒 Mở AI Store', miniAppUrl)]]
      : [];

    if (!launchButtons.length) {
      this.logger.warn(
        `TELEGRAM_MINIAPP_URL must be an HTTPS URL to open as a Telegram Web App. Current value: ${miniAppUrl}`,
      );
    }

    await context.reply(
      launchButtons.length
        ? 'Chào mừng bạn đến AI Store. Nhấn nút bên dưới để mở Mini App ngay trong Telegram.'
        : 'Chào mừng bạn đến AI Store. Mini App cần URL HTTPS để mở trong Telegram.',
      Markup.inlineKeyboard([
        ...launchButtons,
        [Markup.button.callback('📦 Đơn hàng của tôi', 'orders')],
        [Markup.button.callback('🆘 Hỗ trợ', 'support')],
      ]),
    );
  }

  private renderSupportInfoMessage() {
    const supportName = this.configService.get<string>('SUPPORT_NAME') || 'AI Store Support';
    const phoneNumber =
      this.configService.get<string>('SUPPORT_PHONE') ||
      this.configService.get<string>('SUPPORT_ZALO') ||
      '0966628527';
    const telegramUsername = this.normalizeTelegramUsername(
      this.configService.get<string>('SUPPORT_TELEGRAM') || '@hieuhv203',
    );
    const workingTime = this.configService.get<string>('SUPPORT_WORKING_TIME') || '08:00 - 22:00 hằng ngày';

    return [
      '🆘 THÔNG TIN HỖ TRỢ',
      '',
      'Nếu bạn cần hỗ trợ hoặc gặp sự cố trong quá trình sử dụng dịch vụ, vui lòng liên hệ:',
      '',
      `👤 Hỗ trợ: ${supportName}`,
      `📱 Số điện thoại: ${phoneNumber}`,
      `✈️ Telegram: @${telegramUsername}`,
      '',
      '⏰ Thời gian hỗ trợ:',
      workingTime,
      '',
      'Xin cảm ơn quý khách đã tin tưởng và sử dụng dịch vụ của AI Store! ❤️',
    ].join('\n');
  }

  private async replyOrderList(context: {
    from?: { id: number };
    reply: (...args: any[]) => unknown;
  }) {
    if (!context.from?.id) {
      await context.reply('Không xác định được tài khoản Telegram của bạn.');
      return;
    }

    const orders = await this.getUserOrders(BigInt(context.from.id));
    if (!orders.length) {
      await context.reply(
        'LỊCH SỬ MUA HÀNG\n\nBạn chưa có đơn hàng nào tại AI Store.',
        Markup.inlineKeyboard([[Markup.button.callback('🔙 Quay lại menu', 'start')]]),
      );
      return;
    }

    await context.reply(
      'LỊCH SỬ MUA HÀNG\n\nChọn đơn để xem chi tiết:',
      Markup.inlineKeyboard(
        orders.map((order) => [
          Markup.button.callback(this.formatOrderListButton(order), `order:${order.id}`),
        ]),
      ),
    );
  }

  private async replyOrderDetail(
    context: {
      from?: { id: number };
      reply: (...args: any[]) => unknown;
    },
    orderId: string,
  ) {
    if (!context.from?.id) {
      await context.reply('Không xác định được tài khoản Telegram của bạn.');
      return;
    }

    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        user: { telegramId: BigInt(context.from.id) },
        isDeleted: false,
        OR: [
          { paymentStatus: PaymentStatus.PAID },
          { status: OrderStatus.DELIVERED },
        ],
      },
      include: {
        payments: {
          where: { isDeleted: false },
          orderBy: { createdAt: 'desc' },
        },
        items: {
          orderBy: { createdAt: 'asc' },
          include: {
            variant: { include: { product: true } },
            deliveries: {
              where: { isDeleted: false },
              orderBy: { createdAt: 'asc' },
              include: { inventory: true },
            },
          },
        },
      },
    });

    if (!order) {
      await context.reply('Không tìm thấy đơn hàng hoặc bạn không có quyền xem đơn này.');
      return;
    }

    await context.reply(this.renderOrderDetail(order), {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback(`🛡️ Yêu cầu bảo hành (${this.getWarrantyLabel(order)})`, `warranty:${order.id}`)],
        [Markup.button.callback('🔙 Quay lại danh sách đơn', 'orders:back')],
      ]),
    });
  }

  private getUserOrders(telegramId: bigint) {
    return this.prisma.order.findMany({
      where: {
        user: { telegramId },
        isDeleted: false,
        OR: [
          { paymentStatus: PaymentStatus.PAID },
          { status: OrderStatus.DELIVERED },
        ],
      },
      include: {
        items: {
          orderBy: { createdAt: 'asc' },
          include: {
            variant: { include: { product: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: ORDER_LIST_LIMIT,
    });
  }

  private formatOrderListButton(order: OrderListItem) {
    const firstItem = order.items[0];
    const productLabel = firstItem
      ? `${firstItem.variant.product.name} ${firstItem.variant.name}`
      : 'Đơn hàng AI Store';
    const suffix = order.items.length > 1 ? ` +${order.items.length - 1}` : '';

    return [
      '📦',
      order.orderNo,
      '-',
      `${productLabel}${suffix}`,
      '-',
      `${this.formatMoney(order.totalAmount)}đ`,
      `(${this.formatDateTime(order.createdAt)})`,
    ].join(' ');
  }

  private renderOrderDetail(order: OrderDetail) {
    const payment = order.payments[0];
    const products = order.items
      .map((item) => `${item.variant.product.name} ${item.variant.name}`.trim())
      .join(', ');
    const quantity = order.items.reduce((sum, item) => sum + item.quantity, 0);
    const accounts = this.renderDeliveredAccounts(order);

    return [
      `<b>Chi tiết đơn ${this.escapeHtml(order.orderNo)}</b>`,
      '',
      `Trạng thái: <b>${this.escapeHtml(this.formatOrderStatus(order.status, order.paymentStatus))}</b>`,
      `Sản phẩm: <b>${this.escapeHtml(products || '-')}</b>`,
      `Số lượng: ${quantity}`,
      `Tổng tiền: <b>${this.formatMoney(order.totalAmount)}đ</b>`,
      `Ngân hàng: ${this.escapeHtml(this.getBankName(payment?.qrContent))}`,
      `Mã CK: <code>${this.escapeHtml(payment?.paymentContent || '-')}</code>`,
      `Thời gian: ${this.formatDateTime(order.createdAt)}`,
      '',
      '--------------------',
      '',
      '<b>Thông tin tài khoản</b> (bấm vào dòng mã để copy):',
      '',
      accounts || 'Đơn hàng chưa có thông tin tài khoản được giao.',
    ].join('\n');
  }

  private renderDeliveredAccounts(order: OrderDetail) {
    const lines: string[] = [];
    let accountIndex = 1;

    for (const item of order.items) {
      for (const delivery of item.deliveries) {
        if (delivery.status !== DeliveryStatus.DELIVERED) continue;

        const inventory = delivery.inventory;
        const metadata = this.normalizeMetadata(inventory.metadata);
        const username = metadata.username || inventory.accountEmail || '-';
        const password = this.inventoryPasswordService.decrypt(inventory.encryptedPassword);
        const twoFactor = metadata.twoFactor || metadata.twoFa || metadata['2fa'] || metadata.pass2fa;

        lines.push(`Tài khoản${order.items.length > 1 || item.quantity > 1 ? ` #${accountIndex}` : ''}`);
        lines.push(`- Username: <code>${this.escapeHtml(username)}</code>`);
        lines.push(`- Password: <code>${this.escapeHtml(password || '-')}</code>`);
        if (twoFactor) {
          lines.push(`- 2FA pass: <code>${this.escapeHtml(twoFactor)}</code>`);
        }
        lines.push('');
        accountIndex += 1;
      }
    }

    return lines.join('\n').trim();
  }

  private normalizeMetadata(metadata: Prisma.JsonValue | null) {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return {} as Record<string, string>;
    }

    return Object.fromEntries(
      Object.entries(metadata).map(([key, value]) => [key, value == null ? '' : String(value)]),
    );
  }

  private formatOrderStatus(orderStatus: OrderStatus, paymentStatus: PaymentStatus) {
    if (orderStatus === OrderStatus.DELIVERED) return 'Hoàn thành';
    if (paymentStatus === PaymentStatus.PAID) return 'Đã thanh toán';
    if (paymentStatus === PaymentStatus.FAILED || orderStatus === OrderStatus.CANCELLED) return 'Đã hủy';
    return 'Chờ thanh toán';
  }

  private getWarrantyLabel(order: OrderDetail) {
    const warrantyDays = order.items
      .map((item) => item.variant.warrantyDays)
      .filter((value): value is number => typeof value === 'number' && value > 0);

    if (!warrantyDays.length) return '0 ngày';
    return `${Math.max(...warrantyDays)} ngày`;
  }

  private normalizeTelegramUsername(value: string) {
    return value.trim().replace(/^@+/, '') || 'hieuhv203';
  }

  private getBankName(qrContent?: string | null) {
    if (!qrContent) return '-';

    try {
      const parsed = JSON.parse(qrContent) as { bin?: string; bankName?: string };
      if (parsed.bankName) return parsed.bankName;
      if (parsed.bin === '970422') return 'MB';
      return parsed.bin || '-';
    } catch {
      return '-';
    }
  }

  private formatMoney(value: Prisma.Decimal | number | string) {
    return Number(value).toLocaleString('vi-VN');
  }

  private formatDateTime(value: Date) {
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(value);
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private isHttpsUrl(value: string) {
    try {
      return new URL(value).protocol === 'https:';
    } catch {
      return false;
    }
  }

  private chunkMessage(message: string) {
    if (message.length <= TELEGRAM_MESSAGE_LIMIT) {
      return [message];
    }

    const chunks: string[] = [];
    let current = '';

    for (const line of message.split('\n')) {
      const next = current ? `${current}\n${line}` : line;
      if (next.length <= TELEGRAM_MESSAGE_LIMIT) {
        current = next;
        continue;
      }

      if (current) chunks.push(current);
      current = line;
    }

    if (current) chunks.push(current);
    return chunks;
  }
}
