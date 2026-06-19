import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { parse, validate } from '@telegram-apps/init-data-node';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import {
  AdminLoginTokenStatus,
  RoleName,
  UserStatus,
} from '../../generated/prisma/client.js';
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
    // Mini App dùng token ngắn hạn 15 phút
    return this.issueTokens(user.id, [RoleName.CUSTOMER], '15m');
  }

  async getOrCreateTelegramUser(initData: string) {
    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!botToken) {
      throw new BadRequestException('TELEGRAM_BOT_TOKEN is not configured');
    }

    validate(initData, botToken);
    const parsed = parse(initData);
    const telegramUser = parsed.user;

    if (!telegramUser) {
      throw new UnauthorizedException('Telegram user payload is missing');
    }

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
    const fullName = this.buildFullName(profile.firstName, profile.lastName);

    return this.prisma.user.upsert({
      where: { telegramId },
      create: {
        telegramId,
        username,
        fullName,
        status: UserStatus.ACTIVE,
      },
      update: {
        ...(username ? { username } : {}),
        ...(fullName ? { fullName } : {}),
        status: UserStatus.ACTIVE,
      },
    });
  }

  async createAdminLoginToken(userId: string) {
    const token = randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(token, 10);
    const expiredAt = new Date(Date.now() + 5 * 60 * 1000);

    await this.prisma.adminLoginToken.create({
      data: {
        userId,
        tokenHash,
        expiredAt,
      },
    });

    return token;
  }

  async loginAdminWithToken(token: string) {
    const candidates = await this.prisma.adminLoginToken.findMany({
      where: {
        status: AdminLoginTokenStatus.PENDING,
        expiredAt: { gt: new Date() },
        isDeleted: false,
      },
      include: {
        user: {
          include: {
            roles: {
              include: { role: true },
              where: { isDeleted: false },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    for (const candidate of candidates) {
      if (await bcrypt.compare(token, candidate.tokenHash)) {
        await this.prisma.adminLoginToken.update({
          where: { id: candidate.id },
          data: {
            status: AdminLoginTokenStatus.USED,
            usedAt: new Date(),
          },
        });

        const roles = candidate.user.roles.map((role) => role.role.name);
        if (!roles.includes(RoleName.ADMIN) && !roles.includes(RoleName.SUPER_ADMIN)) {
          throw new UnauthorizedException('Admin role is required');
        }

        // Admin session kéo dài 8 giờ để không bị out giữa chừng
        return this.issueTokens(candidate.userId, roles, '8h');
      }
    }

    throw new UnauthorizedException('Invalid or expired admin login token');
  }

  private issueTokens(userId: string, roles: RoleName[], expiresIn: string = '15m') {
    const accessToken = this.jwtService.sign(
      { sub: userId, roles },
      { expiresIn },
    );

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn,
    };
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
