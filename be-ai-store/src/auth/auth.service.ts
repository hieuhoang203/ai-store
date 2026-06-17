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

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async loginWithTelegramInitData(initData: string) {
    const user = await this.getOrCreateTelegramUser(initData);

    return this.issueTokens(user.id, [RoleName.CUSTOMER]);
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

    return this.prisma.user.upsert({
      where: { telegramId: BigInt(telegramUser.id) },
      create: {
        telegramId: BigInt(telegramUser.id),
        username: telegramUser.username,
        fullName: [telegramUser.firstName, telegramUser.lastName]
          .filter(Boolean)
          .join(' '),
        status: UserStatus.ACTIVE,
      },
      update: {
        username: telegramUser.username,
        fullName: [telegramUser.firstName, telegramUser.lastName]
          .filter(Boolean)
          .join(' '),
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

        return this.issueTokens(candidate.userId, roles);
      }
    }

    throw new UnauthorizedException('Invalid or expired admin login token');
  }

  private issueTokens(userId: string, roles: RoleName[]) {
    const accessToken = this.jwtService.sign({
      sub: userId,
      roles,
    });

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: '15m',
    };
  }
}
