import { Injectable } from '@nestjs/common';
import { LoaiThongBao, TrangThaiTicket } from '../../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateNotificationDto) {
    return this.prisma.thongBao.create({
      data: {
        nguoiDungId: dto.userId,
        loai: dto.type,
        tieuDe: dto.title,
        noiDung: dto.content,
      },
    });
  }

  listForUser(userId: string) {
    return this.prisma.thongBao.findMany({
      where: { nguoiDungId: userId, daXoa: false },
      orderBy: { taoLuc: 'desc' },
      take: 100,
    });
  }

  async notifyTicketStatusChanged(ticketId: string, status: TrangThaiTicket, closeReason?: string) {
    const ticket = await this.prisma.ticketHoTro.findUnique({ where: { id: ticketId } });
    if (!ticket) return;

    await this.prisma.thongBao.create({
      data: {
        nguoiDungId: ticket.nguoiDungId,
        loai: LoaiThongBao.HO_TRO,
        tieuDe: 'Cập nhật ticket hỗ trợ',
        noiDung: closeReason
          ? `Ticket ${ticket.tieuDe} đã chuyển sang trạng thái ${status}.\nLý do: ${closeReason}`
          : `Ticket ${ticket.tieuDe} đã chuyển sang trạng thái ${status}.`,
      },
    });
  }

  async announceCategoryAdded(_id: string) {
    return;
  }

  async announceProductAdded(_id: string) {
    return;
  }

  async announceInventoryRestocked(_id: string, _quantity: number) {
    return;
  }

  async announceCouponCreated(_id: string) {
    return;
  }

  async announceVariantOutOfStock(_id: string) {
    return;
  }
}
