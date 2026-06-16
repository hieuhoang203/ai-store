import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Markup, Telegraf } from 'telegraf';
import { RoleName } from '../../generated/prisma/client.js';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);
  private bot?: Telegraf;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async onModuleInit() {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      this.logger.warn('TELEGRAM_BOT_TOKEN is not configured. Telegram bot is disabled.');
      return;
    }

    this.bot = new Telegraf(token);
    this.registerCommands(this.bot);
    await this.bot.telegram.setMyCommands([
      { command: 'start', description: 'Mở AI Store' },
      { command: 'support', description: 'Liên hệ hỗ trợ' },
      { command: 'admin', description: 'Đăng nhập trang quản trị' },
    ]);
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
    await this.bot.telegram.sendMessage(String(telegramId), message, {
      parse_mode: 'HTML',
    });
  }

  private registerCommands(bot: Telegraf) {
    bot.start(async (context) => {
      const miniAppUrl = this.configService.getOrThrow<string>('TELEGRAM_MINIAPP_URL');
      await context.reply(
        'Chào mừng bạn đến AI Store',
        Markup.inlineKeyboard([
          [Markup.button.webApp('🛒 Mở cửa hàng', miniAppUrl)],
          [Markup.button.callback('📦 Đơn hàng của tôi', 'orders')],
          [Markup.button.callback('🎫 Hỗ trợ', 'support')],
        ]),
      );
    });

    bot.command('support', async (context) => {
      await context.reply('Vui lòng mô tả vấn đề của bạn. Đội hỗ trợ sẽ phản hồi sớm nhất.');
    });

    bot.command('admin', async (context) => {
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
}
