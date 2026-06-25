import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.nguoiDung.findFirst({
      where: { id, daXoa: false },
      include: { vaiTro: { include: { vaiTro: true } } },
    });
  }

  findByTelegramId(telegramId: bigint) {
    return this.prisma.nguoiDung.findUnique({
      where: { telegramId },
      include: { vaiTro: { include: { vaiTro: true } } },
    });
  }
}
