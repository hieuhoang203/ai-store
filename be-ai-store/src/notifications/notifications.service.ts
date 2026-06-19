import { Injectable, Logger } from '@nestjs/common';
import {
  DiscountType,
  InventoryStatus,
  NotificationType,
  Prisma,
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
import { renderCouponNotification } from './coupon-notification-message';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramService: TelegramService,
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
        await this.telegramService.sendMessage(ticket.user.telegramId, content);
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

  async announceCouponCreated(couponId: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id: couponId },
      include: {
        products: {
          where: { isDeleted: false },
          include: {
            productVariant: {
              include: { product: true },
            },
          },
        },
      },
    });

    if (!coupon || coupon.isDeleted || !coupon.isActive) return;

    const content = renderCouponNotification({
      couponCode: coupon.code,
      discountText: this.renderCouponDiscount(coupon),
      applyScope: this.renderCouponApplyScope(coupon.products),
      remainingUsage: this.renderRemainingUsage(coupon.usageLimit, coupon.usedCount),
      expiredAt: this.renderExpiredAt(coupon.endsAt),
    });

    await this.broadcast({
      title: 'Voucher mới đã phát hành',
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

  private renderCouponDiscount(coupon: {
    discountType: DiscountType;
    discountValue: Prisma.Decimal;
    maxDiscount: Prisma.Decimal | null;
    minOrderAmount: Prisma.Decimal | null;
  }) {
    const lines =
      coupon.discountType === DiscountType.PERCENT
        ? [`${this.formatNumber(coupon.discountValue)}%`]
        : [`${this.formatMoney(coupon.discountValue)}đ`];

    if (coupon.maxDiscount) {
      lines.push(`Tối đa ${this.formatMoney(coupon.maxDiscount)}đ`);
    }

    if (coupon.minOrderAmount) {
      lines.push(`Cho đơn từ ${this.formatMoney(coupon.minOrderAmount)}đ`);
    }

    return lines.join('\n');
  }

  private renderCouponApplyScope(
    products: Array<{
      productVariant: {
        name: string;
        product: { name: string; isDeleted: boolean; isActive: boolean };
        isDeleted: boolean;
        active: boolean;
      };
    }>,
  ) {
    const availableProducts = products.filter(
      ({ productVariant }) =>
        !productVariant.isDeleted &&
        productVariant.active &&
        !productVariant.product.isDeleted &&
        productVariant.product.isActive,
    );

    if (!availableProducts.length) return 'Tất cả sản phẩm';

    const names = availableProducts.map(
      ({ productVariant }) => `${productVariant.product.name} - ${productVariant.name}`,
    );
    const visibleNames = names.slice(0, 5);
    const remainingCount = names.length - visibleNames.length;

    if (remainingCount > 0) {
      visibleNames.push(`và ${remainingCount} sản phẩm khác`);
    }

    return visibleNames.map((name) => `- ${name}`).join('\n');
  }

  private renderRemainingUsage(usageLimit: number | null, usedCount: number) {
    if (usageLimit === null) return 'Không giới hạn';
    return String(Math.max(usageLimit - usedCount, 0));
  }

  private renderExpiredAt(expiredAt: Date | null) {
    if (!expiredAt) return 'Không giới hạn';

    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(expiredAt);
  }

  private formatMoney(value: Prisma.Decimal) {
    return Number(value).toLocaleString('vi-VN');
  }

  private formatNumber(value: Prisma.Decimal) {
    return Number(value).toLocaleString('vi-VN');
  }

  private renderTicketStatusMessage(
    ticketId: string,
    status: TicketStatus,
    closeReason?: string,
  ) {
    const ticketCode = this.formatTicketCode(ticketId);

    if (status === TicketStatus.IN_PROGRESS) {
      return [
        `⚠️ Ticket: ${ticketCode}`,
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
        `✅ Ticket: ${ticketCode}`,
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
        `🔒 Ticket: ${ticketCode} đã được đóng.`,
        '',
        '📝 Lý do:',
        closeReason?.trim() || 'Ticket đã được đóng bởi đội hỗ trợ.',
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
}
