import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Markup, Telegraf } from 'telegraf';
import {
  NhaCungCapTrangThai,
  TrangThaiLienKetNhaCungCap,
  VaiTroHeThong,
} from '../../generated/prisma/client.js';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../database/prisma.service';

const TELEGRAM_MESSAGE_LIMIT = 3900;

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
    ]);
    void this.bot
      .launch()
      .then(() => this.logger.log('Telegram bot launched'))
      .catch((error: Error) => this.logger.error(`Telegram bot launch failed: ${error.message}`));
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
      const startPayload = this.getStartPayload(context);
      if (startPayload?.startsWith('supplier_')) {
        await this.handleSupplierInvite(context, startPayload.replace(/^supplier_/, ''));
        return;
      }

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

      await this.ensureRole(user.id, VaiTroHeThong.ADMIN);
      const token = await this.authService.createAdminLoginToken(user.id);
      const adminUrl = this.configService.getOrThrow<string>('ADMIN_APP_URL');
      await context.reply(`${adminUrl}/auth/login?token=${token}`);
    });
  }

  private getStartPayload(context: unknown) {
    const directPayload = (context as { startPayload?: unknown }).startPayload;
    if (typeof directPayload === 'string' && directPayload.trim()) return directPayload.trim();

    const text = (context as { message?: { text?: unknown } }).message?.text;
    if (typeof text !== 'string') return null;
    const [, payload] = text.trim().split(/\s+/, 2);
    return payload || null;
  }

  private async handleSupplierInvite(
    context: {
      from?: { id: number; username?: string; first_name?: string; last_name?: string };
      reply: (...args: any[]) => unknown;
    },
    token: string,
  ) {
    if (!context.from?.id) {
      await context.reply('Không xác định được tài khoản Telegram của bạn.');
      return;
    }

    const link = await this.prisma.lienKetNhaCungCap.findUnique({
      where: { maToken: token },
      include: { nhaCungCap: true },
    });
    if (!link) {
      await context.reply('Link mời nhà cung cấp không tồn tại hoặc đã bị thu hồi.');
      return;
    }
    if (link.trangThai !== TrangThaiLienKetNhaCungCap.CHUA_SU_DUNG) {
      await context.reply('Link mời này đã được sử dụng hoặc không còn hiệu lực.');
      return;
    }
    if (link.hetHanLuc && link.hetHanLuc.getTime() <= Date.now()) {
      await this.prisma.lienKetNhaCungCap.update({
        where: { id: link.id },
        data: { trangThai: TrangThaiLienKetNhaCungCap.HET_HAN },
      });
      await context.reply('Link mời này đã hết hạn.');
      return;
    }

    const user = await this.authService.upsertTelegramUserProfile({
      id: context.from.id,
      username: context.from.username,
      firstName: context.from.first_name,
      lastName: context.from.last_name,
    });
    const telegramId = BigInt(context.from.id);
    const displayName =
      user.hoTen ||
      context.from.username ||
      link.tenMoi ||
      `Supplier ${telegramId.toString()}`;

    const supplier = await this.prisma.$transaction(async (tx) => {
      const existing =
        link.nhaCungCapId
          ? await tx.nhaCungCap.findUnique({ where: { id: link.nhaCungCapId } })
          : await tx.nhaCungCap.findFirst({
              where: {
                OR: [{ telegramId }, { nguoiDungId: user.id }],
              },
            });

      const savedSupplier = existing
        ? await tx.nhaCungCap.update({
            where: { id: existing.id },
            data: {
              nguoiDungId: user.id,
              telegramId,
              usernameTelegram: context.from?.username,
              tenHienThi: existing.tenHienThi || displayName,
              trangThai: NhaCungCapTrangThai.DANG_HOAT_DONG,
            },
          })
        : await tx.nhaCungCap.create({
            data: {
              nguoiDungId: user.id,
              telegramId,
              usernameTelegram: context.from?.username,
              tenHienThi: displayName,
              trangThai: NhaCungCapTrangThai.DANG_HOAT_DONG,
            },
          });

      await tx.lienKetNhaCungCap.update({
        where: { id: link.id },
        data: {
          nhaCungCapId: savedSupplier.id,
          telegramIdDaGan: telegramId,
          dungLuc: new Date(),
          trangThai: TrangThaiLienKetNhaCungCap.DA_SU_DUNG,
        },
      });

      return savedSupplier;
    });

    await this.ensureRole(user.id, VaiTroHeThong.NHA_CUNG_CAP);
    await context.reply(
      [
        'Kết nối nhà cung cấp thành công.',
        '',
        `Tên hiển thị: ${supplier.tenHienThi}`,
        `Telegram ID: ${telegramId.toString()}`,
        '',
        'Từ bây giờ hệ thống có thể gửi yêu cầu xử lý đơn hàng tới tài khoản Telegram này.',
      ].join('\n'),
    );
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

  private async ensureRole(userId: string, roleName: VaiTroHeThong) {
    const role = await this.prisma.vaiTro.upsert({
      where: { ten: roleName },
      create: { ten: roleName },
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
