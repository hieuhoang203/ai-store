import { Injectable } from '@nestjs/common';
import { RoleName } from '../../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  ensureRole(name: RoleName) {
    return this.prisma.role.upsert({
      where: { name },
      create: { name },
      update: {},
    });
  }
}
