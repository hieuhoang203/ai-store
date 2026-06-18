import { Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, PaymentStatus } from '../../generated/prisma/client.js';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../database/prisma.service';
import { CreateTicketDto, CreateWarrantyTicketDto } from './dto/create-ticket.dto';

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  create(dto: CreateTicketDto) {
    return this.prisma.ticket.create({ data: dto });
  }

  async createWarrantyTicket(dto: CreateWarrantyTicketDto) {
    const user = await this.authService.getOrCreateTelegramUser(dto.initData);
    const order = await this.prisma.order.findFirst({
      where: {
        id: dto.orderId,
        userId: user.id,
        isDeleted: false,
        OR: [
          { paymentStatus: PaymentStatus.PAID },
          { status: OrderStatus.DELIVERED },
        ],
      },
      select: { id: true, orderNo: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const accountLine = dto.accountLabel ? `\nTài khoản: ${dto.accountLabel}` : '';
    const productLine = dto.productName
      ? `\nDịch vụ: ${dto.productName}${dto.variantName ? ` - ${dto.variantName}` : ''}`
      : '';

    return this.prisma.ticket.create({
      data: {
        userId: user.id,
        orderId: order.id,
        subject: `Yêu cầu bảo hành đơn ${order.orderNo}`,
        content: [
          `Khách hàng yêu cầu bảo hành cho đơn ${order.orderNo}.`,
          productLine.trimStart(),
          accountLine.trimStart(),
          '',
          'Lý do:',
          dto.reason.trim(),
        ]
          .filter((line) => line !== '')
          .join('\n'),
      },
    });
  }

  listForUser(userId: string) {
    return this.prisma.ticket.findMany({
      where: { userId, isDeleted: false },
      orderBy: { createdAt: 'desc' },
    });
  }
}
