import { Injectable } from '@nestjs/common';
import { VaiTroHeThong } from '../../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  ensureRole(ten: VaiTroHeThong) {
    return this.prisma.vaiTro.upsert({
      where: { ten },
      create: { ten },
      update: {},
    });
  }
}
