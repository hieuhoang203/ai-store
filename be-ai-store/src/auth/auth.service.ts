import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { parse, validate } from '@telegram-apps/init-data-node';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { TrangThaiNguoiDung, VaiTroHeThong } from '../../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service';

export type TelegramProfileInput = {
  id: bigint | number | string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async loginWithTelegramInitData(initData: string) {
    const user = await this.getOrCreateTelegramUser(initData);
    return this.issueTokens(user.id, [VaiTroHeThong.KHACH_HANG], '15m');
  }

  async getOrCreateTelegramUser(initData: string) {
    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!botToken) throw new BadRequestException('TELEGRAM_BOT_TOKEN is not configured');

    validate(initData, botToken);
    const parsed = parse(initData);
    const telegramUser = parsed.user;
    if (!telegramUser) throw new UnauthorizedException('Telegram user payload is missing');

    return this.upsertTelegramUserProfile({
      id: telegramUser.id,
      username: this.toOptionalString(telegramUser.username),
      firstName: this.toOptionalString(telegramUser.firstName),
      lastName: this.toOptionalString(telegramUser.lastName),
    });
  }

  async upsertTelegramUserProfile(profile: TelegramProfileInput) {
    const telegramId = BigInt(profile.id);
    const username = this.normalizeProfileValue(profile.username);
    const hoTen = this.buildFullName(profile.firstName, profile.lastName);

    return this.prisma.nguoiDung.upsert({
      where: { telegramId },
      create: {
        telegramId,
        username,
        hoTen,
        trangThai: TrangThaiNguoiDung.DANG_HOAT_DONG,
      },
      update: {
        ...(username ? { username } : {}),
        ...(hoTen ? { hoTen } : {}),
        trangThai: TrangThaiNguoiDung.DANG_HOAT_DONG,
      },
    });
  }

  async createAdminLoginToken(userId: string) {
    const token = randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(token, 10);
    const hetHanLuc = new Date(Date.now() + 5 * 60 * 1000);

    await this.prisma.tokenDangNhapAdmin.create({
      data: {
        nguoiDungId: userId,
        tokenHash,
        hetHanLuc,
      },
    });

    return token;
  }

  async loginAdminWithToken(token: string) {
    const candidates = await this.prisma.tokenDangNhapAdmin.findMany({
      where: {
        daDung: false,
        hetHanLuc: { gt: new Date() },
        daXoa: false,
      },
      include: {
        nguoiDung: {
          include: {
            vaiTro: {
              include: { vaiTro: true },
              where: { daXoa: false },
            },
          },
        },
      },
      orderBy: { taoLuc: 'desc' },
      take: 20,
    });

    for (const candidate of candidates) {
      if (!(await bcrypt.compare(token, candidate.tokenHash))) continue;

      await this.prisma.tokenDangNhapAdmin.update({
        where: { id: candidate.id },
        data: { daDung: true, dungLuc: new Date() },
      });

      const roles = candidate.nguoiDung.vaiTro.map((item) => item.vaiTro.ten);
      if (!roles.includes(VaiTroHeThong.ADMIN) && !roles.includes(VaiTroHeThong.SUPER_ADMIN)) {
        throw new UnauthorizedException('Admin role is required');
      }

      return this.issueTokens(candidate.nguoiDungId, roles, '8h');
    }

    throw new UnauthorizedException('Invalid or expired admin login token');
  }

  private issueTokens(userId: string, roles: VaiTroHeThong[], expiresIn: string = '15m') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const accessToken = this.jwtService.sign({ sub: userId, roles }, { expiresIn } as any);
    return { accessToken, tokenType: 'Bearer', expiresIn };
  }

  private normalizeProfileValue(value?: string | null) {
    const normalized = value?.trim();
    return normalized || undefined;
  }

  private toOptionalString(value: unknown) {
    return typeof value === 'string' ? value : undefined;
  }

  private buildFullName(firstName?: string | null, lastName?: string | null) {
    const fullName = [firstName, lastName]
      .map((value) => this.normalizeProfileValue(value))
      .filter(Boolean)
      .join(' ');
    return fullName || undefined;
  }
}
