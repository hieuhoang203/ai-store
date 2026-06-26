import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Markup, Telegraf } from 'telegraf';
import { VaiTroHeThong } from '../../generated/prisma/client.js';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../database/prisma.service';

const TELEGRAM_MESSAGE_LIMIT = 3900;

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);
  private bot?: Telegraf;

  private botUsername?: string;

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
    try {
      const me = await this.bot.telegram.getMe();
      this.botUsername = me.username;
    } catch (error) {
      this.logger.warn(`Failed to fetch bot info: ${error instanceof Error ? error.message : 'unknown'}`);
    }
    this.registerCommands(this.bot);
    await this.bot.telegram.setMyCommands([
      { command: 'start', description: 'Mở AI Store' },
      { command: 'support', description: 'Liên hệ hỗ trợ' },
    ]);
    void this.bot
      .launch()
      .then(() => this.logger.log('Telegram bot launched'))
      .catch((error: Error) => this.logger.error(`Telegram bot launch failed: ${error.message}`));
  }

  async onModuleDestroy() {
    this.bot?.stop('NestJS shutdown');
  }

  getBotUsername(): string {
    return this.botUsername || this.configService.get<string>('TELEGRAM_BOT_USERNAME') || 'ai_store_bot';
  }

  async sendMessage(telegramId: bigint | number | string, message: string) {
    if (!this.bot) return;
    for (const chunk of this.chunkMessage(message)) {
      await this.bot.telegram.sendMessage(String(telegramId), chunk);
    }
  }

  async sendHtmlMessage(telegramId: bigint | number | string, message: string, replyMarkup?: any) {
    if (!this.bot) return;
    for (const chunk of this.chunkMessage(message)) {
      await this.bot.telegram.sendMessage(String(telegramId), chunk, {
        parse_mode: 'HTML',
        reply_markup: replyMarkup,
      });
    }
  }

  private registerCommands(bot: Telegraf) {
    bot.start(async (context) => {
      await this.syncTelegramProfile(context.from);

      const payload = context.payload || '';
      if (payload.startsWith('connect_')) {
        const token = payload.substring(8);
        const miniAppUrl = this.configService.getOrThrow<string>('TELEGRAM_MINIAPP_URL');
        const separator = miniAppUrl.includes('?') ? '&' : '?';
        const onboardingUrl = `${miniAppUrl}${separator}supplier=connect&token=${token}`;

        await context.reply(
          'Để hoàn tất liên kết tài khoản nhà cung cấp, vui lòng nhấn nút bên dưới để mở Mini App:',
          Markup.inlineKeyboard([[Markup.button.webApp('Kết nối nhà cung cấp', onboardingUrl)]]),
        );
        return;
      }

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

    bot.command('support', async (context) => {
      await this.syncTelegramProfile(context.from);
      await context.reply(this.renderSupportInfoMessage());
    });

    bot.command('admin', async (context) => {
      await this.syncTelegramProfile(context.from);
      const allowedTelegramId = BigInt(this.configService.get<string>('ADMIN_TELEGRAM_ID') || '6665010353');
      if (BigInt(context.from.id) !== allowedTelegramId) {
        await context.reply('Bạn không có quyền truy cập trang quản trị.');
        return;
      }

      const telegramId = BigInt(context.from.id);
      const user = await this.prisma.nguoiDung.findUnique({ where: { telegramId } });
      if (!user) {
        await context.reply('Tài khoản chưa được đăng ký. Vui lòng gõ /start trước.');
        return;
      }

      await this.ensureAdminRole(user.id);
      const token = await this.authService.createAdminLoginToken(user.id);
      const adminUrl = this.configService.getOrThrow<string>('ADMIN_APP_URL');
      await context.reply(`${adminUrl}/auth/login?token=${token}`);
    });

    bot.command('register', async (context) => {
      await this.syncTelegramProfile(context.from);

      const telegramId = BigInt(context.from.id);
      const user = await this.prisma.nguoiDung.findUnique({ where: { telegramId } });
      if (!user) {
        await context.reply('Tài khoản chưa được đăng ký. Vui lòng gõ /start trước.');
        return;
      }

      // Check if user is already a supplier
      const existingSupplier = await this.prisma.nhaCungCap.findUnique({
        where: { telegramId },
      });

      if (existingSupplier && existingSupplier.trangThai === 'DANG_HOAT_DONG' && !existingSupplier.daXoa) {
        await context.reply('Tài khoản của bạn đã được đăng ký làm nhà cung cấp trước đó.');
        return;
      }

      const displayName = user.hoTen || user.username || `Supplier ${user.telegramId}`;

      await this.prisma.$transaction(async (tx) => {
        // Ensure they have the supplier role NHA_CUNG_CAP
        const role = await tx.vaiTro.upsert({
          where: { ten: VaiTroHeThong.NHA_CUNG_CAP },
          create: { ten: VaiTroHeThong.NHA_CUNG_CAP },
          update: {},
        });
        await tx.nguoiDungVaiTro.upsert({
          where: { nguoiDungId_vaiTroId: { nguoiDungId: user.id, vaiTroId: role.id } },
          create: { nguoiDungId: user.id, vaiTroId: role.id },
          update: { daXoa: false },
        });

        await tx.nhaCungCap.upsert({
          where: { telegramId },
          create: {
            nguoiDungId: user.id,
            telegramId,
            usernameTelegram: user.username,
            tenHienThi: displayName,
            kenhNhanViec: 'TELEGRAM_BOT',
            trangThai: 'DANG_HOAT_DONG',
          },
          update: {
            nguoiDungId: user.id,
            usernameTelegram: user.username,
            tenHienThi: displayName,
            kenhNhanViec: 'TELEGRAM_BOT',
            trangThai: 'DANG_HOAT_DONG',
            daXoa: false,
          },
        });
      });

      await context.reply(`Chúc mừng! Tài khoản ${displayName} đã đăng ký làm nhà cung cấp thành công.`);
    });
  }

  private async syncTelegramProfile(from?: { id: number; username?: string; first_name?: string; last_name?: string }) {
    if (!from?.id) return;
    await this.authService.upsertTelegramUserProfile({
      id: from.id,
      username: from.username,
      firstName: from.first_name,
      lastName: from.last_name,
    });
  }

  private async ensureAdminRole(userId: string) {
    const role = await this.prisma.vaiTro.upsert({
      where: { ten: VaiTroHeThong.ADMIN },
      create: { ten: VaiTroHeThong.ADMIN },
      update: {},
    });
    await this.prisma.nguoiDungVaiTro.upsert({
      where: { nguoiDungId_vaiTroId: { nguoiDungId: userId, vaiTroId: role.id } },
      create: { nguoiDungId: userId, vaiTroId: role.id },
      update: { daXoa: false },
    });
  }

  private async replyStartMenu(context: { reply: (...args: any[]) => unknown }) {
    const miniAppUrl = this.configService.getOrThrow<string>('TELEGRAM_MINIAPP_URL');
    const launchButtons = this.isHttpsUrl(miniAppUrl) ? [[Markup.button.webApp('Mở AI Store', miniAppUrl)]] : [];
    await context.reply(
      launchButtons.length
        ? 'Chào mừng bạn đến AI Store. Nhấn nút bên dưới để mở Mini App ngay trong Telegram.'
        : 'Chào mừng bạn đến AI Store. Mini App cần URL HTTPS để mở trong Telegram.',
      Markup.inlineKeyboard([...launchButtons, [Markup.button.callback('Hỗ trợ', 'support')]]),
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
      'THÔNG TIN HỖ TRỢ',
      '',
      `Hỗ trợ: ${supportName}`,
      `Số điện thoại: ${phoneNumber}`,
      `Telegram: @${telegramUsername}`,
      `Thời gian hỗ trợ: ${workingTime}`,
    ].join('\n');
  }

  private normalizeTelegramUsername(value: string) {
    return value.trim().replace(/^@+/, '') || 'hieuhv203';
  }

  private isHttpsUrl(value: string) {
    try {
      return new URL(value).protocol === 'https:';
    } catch {
      return false;
    }
  }

  private chunkMessage(message: string) {
    if (message.length <= TELEGRAM_MESSAGE_LIMIT) return [message];
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
