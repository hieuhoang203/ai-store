import { Injectable, NotFoundException } from '@nestjs/common';
import { TrangThaiDonHang, TrangThaiThanhToan } from '../../generated/prisma/client.js';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../database/prisma.service';
import { CreateTicketDto, CreateWarrantyTicketDto, ListMyTicketsDto } from './dto/create-ticket.dto';

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  create(dto: CreateTicketDto) {
    return this.prisma.ticketHoTro.create({
      data: {
        nguoiDungId: dto.userId,
        donHangId: dto.orderId,
        tieuDe: dto.subject,
        noiDung: dto.content,
      },
    });
  }

  async createWarrantyTicket(dto: CreateWarrantyTicketDto) {
    const user = await this.authService.getOrCreateTelegramUser(dto.initData);
    const order = await this.prisma.donHang.findFirst({
      where: {
        id: dto.orderId,
        nguoiDungId: user.id,
        daXoa: false,
        OR: [{ trangThaiThanhToan: TrangThaiThanhToan.DA_THANH_TOAN }, { trangThai: TrangThaiDonHang.DA_GIAO }],
      },
      select: { id: true, maDonHang: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    const accountLine = dto.accountLabel ? `\nTài khoản: ${dto.accountLabel}` : '';
    const productLine = dto.productName
      ? `\nDịch vụ: ${dto.productName}${dto.variantName ? ` - ${dto.variantName}` : ''}`
      : '';

    return this.prisma.ticketHoTro.create({
      data: {
        nguoiDungId: user.id,
        donHangId: order.id,
        tieuDe: `Yêu cầu bảo hành đơn ${order.maDonHang}`,
        noiDung: [
          `Khách hàng yêu cầu bảo hành cho đơn ${order.maDonHang}.`,
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

  async listMine(dto: ListMyTicketsDto) {
    const user = await this.authService.getOrCreateTelegramUser(dto.initData);
    const tickets = await this.prisma.ticketHoTro.findMany({
      where: { nguoiDungId: user.id, daXoa: false },
      include: { donHang: { select: { id: true, maDonHang: true } } },
      orderBy: { taoLuc: 'desc' },
      take: 50,
    });

    return tickets.map((ticket) => ({
      id: ticket.id,
      code: this.formatTicketCode(ticket.id),
      subject: ticket.tieuDe,
      content: ticket.noiDung,
      status: ticket.trangThai,
      createdAt: ticket.taoLuc,
      updatedAt: ticket.capNhatLuc,
      order: ticket.donHang ? { id: ticket.donHang.id, orderNo: ticket.donHang.maDonHang } : null,
    }));
  }

  listForUser(userId: string) {
    return this.prisma.ticketHoTro.findMany({
      where: { nguoiDungId: userId, daXoa: false },
      orderBy: { taoLuc: 'desc' },
    });
  }

  private formatTicketCode(ticketId: string) {
    return `#${ticketId.slice(0, 8).toUpperCase()}`;
  }
}
