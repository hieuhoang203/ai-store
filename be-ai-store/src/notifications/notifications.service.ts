import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  InventoryStatus,
  NotificationType,
  TicketStatus,
  UserStatus,
} from '../../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import {
  renderNewStockNotification,
  renderOutOfStockNotification,
  type StockNotificationProduct,
} from './stock-notification-message';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramService: TelegramService,
    private readonly configService: ConfigService,
  ) {}

  create(dto: CreateNotificationDto) {
    return this.prisma.notification.create({ data: dto });
  }

  listForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId, isDeleted: false },
      orderBy: { createdAt: 'desc' },
    });
  }

  async notifyTicketStatusChanged(
    ticketId: string,
    status: TicketStatus,
    closeReason?: string,
  ) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { user: true },
    });

    if (!ticket || ticket.isDeleted) return;

    const content = this.renderTicketStatusMessage(ticket.id, status, closeReason);
    if (!content) return;

    await this.prisma.notification.create({
      data: {
        userId: ticket.userId,
        type: NotificationType.SUPPORT,
        title: `Ticket ${this.formatTicketCode(ticket.id)}`,
        content,
      },
    });

    if (ticket.user.telegramId) {
      try {
        const orderWebAppUrl = this.buildOrderWebAppUrl(ticket.orderId);
        const telegramContent = this.renderTicketStatusMessage(
          ticket.id,
          status,
          closeReason,
          ticket.orderId,
          true,
        );
        if (orderWebAppUrl) {
          await this.telegramService.sendHtmlMessageWithWebAppButton(
            ticket.user.telegramId,
            telegramContent || content,
            'Mở đơn hàng',
            orderWebAppUrl,
          );
        } else {
          await this.telegramService.sendHtmlMessage(ticket.user.telegramId, telegramContent || content);
        }
      } catch (error) {
        this.logger.warn(
          `Cannot send ticket notification to ${ticket.user.telegramId}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        );
      }
    }
  }

  async announceInventoryRestocked(inventoryId: string, quantity = 1) {
    const inventory = await this.prisma.inventory.findUnique({
      where: { id: inventoryId },
      include: {
        variant: {
          include: {
            product: { include: { categoryRef: true } },
          },
        },
      },
    });

    if (!inventory || inventory.isDeleted || inventory.status !== InventoryStatus.AVAILABLE) {
      return;
    }

    const product = this.toStockNotificationProduct(inventory.variant);
    const content = renderNewStockNotification({ ...product, quantity });
    await this.broadcast({
      title: 'Hàng mới về kho',
      content,
      type: NotificationType.SYSTEM,
    });
  }

  async announceProductAdded(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { categoryRef: true },
    });

    if (!product || product.isDeleted) return;

    const content = renderNewStockNotification({
      serviceName: product.name,
      categoryName: product.categoryRef?.name,
      variantName: 'Đang cập nhật',
      quantity: 0,
    });

    await this.broadcast({
      title: 'Hàng mới về kho',
      content,
      type: NotificationType.SYSTEM,
    });
  }

  async announceCategoryAdded(categoryId: string) {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category || category.isDeleted) return;

    const content = renderNewStockNotification({
      serviceName: 'Danh mục sản phẩm mới',
      categoryName: category.name,
      variantName: 'Đang cập nhật',
      quantity: 0,
    });

    await this.broadcast({
      title: 'Hàng mới về kho',
      content,
      type: NotificationType.SYSTEM,
    });
  }

  async announceVariantOutOfStock(variantId: string) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: {
        product: { include: { categoryRef: true } },
        _count: {
          select: {
            inventories: {
              where: {
                status: { in: [InventoryStatus.AVAILABLE, InventoryStatus.RESERVED] },
                isDeleted: false,
              },
            },
          },
        },
      },
    });

    if (!variant || variant.isDeleted || variant._count.inventories > 0) {
      return;
    }

    const content = renderOutOfStockNotification(this.toStockNotificationProduct(variant));
    await this.broadcast({
      title: 'Hết hàng',
      content,
      type: NotificationType.SYSTEM,
    });
  }

  private async broadcast({
    title,
    content,
    type,
  }: {
    title: string;
    content: string;
    type: NotificationType;
  }) {
    const users = await this.prisma.user.findMany({
      where: {
        status: UserStatus.ACTIVE,
        isDeleted: false,
      },
      select: { id: true, telegramId: true },
    });

    if (!users.length) return;

    await this.prisma.notification.createMany({
      data: users.map((user) => ({
        userId: user.id,
        type,
        title,
        content,
      })),
    });

    for (const user of users) {
      if (!user.telegramId) continue;
      try {
        await this.telegramService.sendMessage(user.telegramId, content);
      } catch (error) {
        this.logger.warn(
          `Cannot send notification to ${user.telegramId}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        );
      }
    }
  }

  private toStockNotificationProduct(variant: {
    name: string;
    product: {
      name: string;
      categoryRef?: { name: string } | null;
    };
  }): StockNotificationProduct {
    return {
      serviceName: variant.product.name,
      categoryName: variant.product.categoryRef?.name,
      variantName: variant.name,
    };
  }

  private renderTicketStatusMessage(
    ticketId: string,
    status: TicketStatus,
    closeReason?: string,
    orderId?: string | null,
    html = false,
  ) {
    const ticketCode = this.formatTicketCode(ticketId);
    const ticketLabel = html
      ? this.renderTicketCodeLink(ticketCode, orderId)
      : ticketCode;

    if (status === TicketStatus.IN_PROGRESS) {
      return [
        `⚠️ Ticket: ${ticketLabel}`,
        '',
        'Chúng tôi thành thật xin lỗi về sự cố bạn gặp phải.',
        '',
        'Đội ngũ kỹ thuật đang kiểm tra nguyên nhân và khắc phục trong thời gian sớm nhất.',
        '',
        '🙏 Mong bạn thông cảm và chờ thêm ít phút.',
      ].join('\n');
    }

    if (status === TicketStatus.RESOLVED) {
      return [
        `✅ Ticket: ${ticketLabel}`,
        '',
        'Sự cố đã được xử lý thành công.',
        '',
        'Vui lòng kiểm tra lại dịch vụ. Nếu vẫn gặp vấn đề, hãy phản hồi ticket này để được hỗ trợ nhanh nhất.',
        '',
        '🙏 Cảm ơn bạn đã chờ đợi.',
      ].join('\n');
    }

    if (status === TicketStatus.CLOSED) {
      return [
        `🔒 Ticket: ${ticketLabel} đã được đóng.`,
        '',
        '📝 Lý do:',
        html
          ? this.escapeHtml(closeReason?.trim() || 'Ticket đã được đóng bởi đội hỗ trợ.')
          : closeReason?.trim() || 'Ticket đã được đóng bởi đội hỗ trợ.',
        '',
        'Nếu cần hỗ trợ thêm, vui lòng tạo ticket mới.',
        '',
        '❤️ AI Store',
      ].join('\n');
    }

    return null;
  }

  private formatTicketCode(ticketId: string) {
    return `#${ticketId.slice(0, 8).toUpperCase()}`;
  }

  private renderTicketCodeLink(ticketCode: string, orderId?: string | null) {
    const url = this.buildOrderDeepLink(orderId) || this.buildOrderWebAppUrl(orderId);
    if (!url) return this.escapeHtml(ticketCode);

    return `<a href="${this.escapeHtml(url)}">${this.escapeHtml(ticketCode)}</a>`;
  }

  private buildOrderDeepLink(orderId?: string | null) {
    if (!orderId) return null;

    const deepLinkUrl = this.configService.get<string>('TELEGRAM_MINIAPP_DEEP_LINK_URL');
    if (!deepLinkUrl) return null;

    try {
      const url = new URL(deepLinkUrl);
      url.searchParams.set('startapp', `order_${orderId}`);
      return url.toString();
    } catch {
      return null;
    }
  }

  private buildOrderWebAppUrl(orderId?: string | null) {
    if (!orderId) return null;

    const miniAppUrl = this.configService.get<string>('TELEGRAM_MINIAPP_URL');
    if (!miniAppUrl) return null;

    try {
      const url = new URL(miniAppUrl);
      url.searchParams.set('tab', 'orders');
      url.searchParams.set('orderId', orderId);
      return url.toString();
    } catch {
      return null;
    }
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
