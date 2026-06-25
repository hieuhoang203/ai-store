import { BadRequestException, Injectable } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { AuditAction, DeliveryMethod, Prisma, TicketStatus } from '../../../generated/prisma/client.js';
import { InventoryStatus, OrderStatus, PaymentStatus } from '../models/admin-enums.model';
import { PrismaService } from '../../database/prisma.service';
import { DeliveriesService } from '../../deliveries/deliveries.service';
import { InventoryPasswordService } from '../../inventories/inventory-password.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { ADMIN_ENTITIES, ADMIN_ENTITY_MAP } from '../models/admin-entity.model';
import {

  AdminEntityConfig,
  AdminEntitySummary,
  AdminFieldConfig,
  AdminListQuery,
} from '../interfaces/admin-crud.interface';
import { AdminRepository } from '../repositories/admin.repository';
import { RedisService } from '../../redis/redis.service';

type UploadedImageFile = {
  buffer: Buffer;
  mimetype: string;
  originalname?: string;
  size: number;
};

@Injectable()
export class AdminService {
  constructor(
    private readonly repository: AdminRepository,
    private readonly prisma: PrismaService,
    private readonly deliveriesService: DeliveriesService,
    private readonly inventoryPasswordService: InventoryPasswordService,
    private readonly notificationsService: NotificationsService,
    private readonly redisService: RedisService,
  ) {}

  async getEntities(): Promise<AdminEntitySummary[]> {
    return Promise.all(
      ADMIN_ENTITIES.map(async (entity) => ({
        ...entity,
        fields: await Promise.all(
          entity.fields.map(async (field) => ({
            ...field,
            options: field.relation ? await this.getRelationOptions(field) : field.options,
          })),
        ),
        count: await this.repository.count(entity),
      })),
    );
  }

  async list(entityKey: string, query: AdminListQuery) {
    const config = this.getConfig(entityKey);
    const normalizedQuery = this.normalizeQuery(config, query);
    const result = await this.repository.list(config, normalizedQuery);

    return {
      ...result,
      data: result.data.map((record) => this.serializeRecord(config, record)),
    };
  }

  async detail(entityKey: string, recordId: string) {
    const config = this.getConfig(entityKey);
    const record = this.serializeRecord(config, await this.repository.detail(config, recordId));

    if (entityKey === 'users') {
      record.roleId = await this.getUserRoleId(String(record.__recordId));
    }
    this.decryptInventoryPassword(entityKey, record);

    return record;
  }

  async create(entityKey: string, payload: Record<string, unknown>) {
    const config = this.getConfig(entityKey);
    const roleId = entityKey === 'users' ? payload.roleId : undefined;
    const data = this.sanitizePayload(config, payload, 'create');
    this.normalizeCouponPayload(entityKey, data);
    this.encryptInventoryPassword(entityKey, data);
    const record =
      entityKey === 'fulfillment-resources'
        ? await this.deliveriesService.createFulfillmentResource(
            String(data.fulfillmentId),
            String(data.type) as DeliveryMethod,
            this.toInputJsonValue(data.payload),
          )
        : await this.repository.create(config, data);

    if (entityKey === 'users' && roleId) {
      await this.assignUserRole(String((record as Record<string, unknown>).id), String(roleId));
    }
    await this.announceCreatedEntity(entityKey, record);
    await this.auditCouponChange(entityKey, AuditAction.COUPON_CREATE, null, record);
    await this.invalidateCategoryCache(entityKey);

    const serialized = this.serializeRecord(config, record);
    this.decryptInventoryPassword(entityKey, serialized);
    return serialized;
  }

  async update(entityKey: string, recordId: string, payload: Record<string, unknown>) {
    const config = this.getConfig(entityKey);
    const roleId = entityKey === 'users' ? payload.roleId : undefined;
    const previousRecord = entityKey === 'tickets' ? await this.repository.detail(config, recordId) : null;
    const closeReason = typeof payload.closeReason === 'string' ? payload.closeReason : undefined;
    const data = this.sanitizePayload(config, payload, 'update');
    const couponPreviousRecord = entityKey === 'coupons' ? await this.repository.detail(config, recordId) : null;
    this.normalizeCouponPayload(entityKey, data);
    this.encryptInventoryPassword(entityKey, data);
    const record = await this.repository.update(config, recordId, data);

    if (entityKey === 'users' && roleId !== undefined) {
      await this.assignUserRole(recordId, roleId ? String(roleId) : null);
    }
    await this.announceTicketStatusChanged(entityKey, previousRecord, record, closeReason);
    await this.auditCouponChange(
      entityKey,
      data.isActive === false ? AuditAction.COUPON_DISABLE : AuditAction.COUPON_UPDATE,
      couponPreviousRecord,
      record,
    );
    await this.invalidateCategoryCache(entityKey);

    const serialized = this.serializeRecord(config, record);
    this.decryptInventoryPassword(entityKey, serialized);
    return serialized;
  }

  async remove(entityKey: string, recordId: string) {
    const config = this.getConfig(entityKey);
    const previousRecord = entityKey === 'coupons' ? await this.repository.detail(config, recordId) : null;
    const removed = await this.repository.remove(config, recordId);
    await this.auditCouponChange(entityKey, AuditAction.COUPON_DELETE, previousRecord, removed);
    await this.invalidateCategoryCache(entityKey);
    return this.serializeRecord(config, removed);
  }

  async dashboard() {
    const [
      users,
      products,
      variants,
      inventories,
      orders,
      tickets,
      revenue,
      todayOrders,
      paidOrders,
      inventoryRows,
      orderRows,
      recentOrders,
      recentTickets,
    ] = await Promise.all([
      this.repository.count(this.getConfig('users')),
      this.repository.count(this.getConfig('products')),
      this.repository.count(this.getConfig('product-variants')),
      this.repository.count(this.getConfig('inventories')),
      this.repository.count(this.getConfig('orders')),
      this.repository.count(this.getConfig('tickets')),
      this.prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: { status: { in: [OrderStatus.PAID, OrderStatus.DELIVERED] } },
      }),
      this.prisma.order.count({
        where: { createdAt: { gte: this.startOfToday() } },
      }),
      this.prisma.order.count({ where: { paymentStatus: PaymentStatus.PAID } }),
      this.prisma.inventory.groupBy({
        by: ['status'],
        where: { isDeleted: false, status: { in: Object.values(InventoryStatus) } },
        _count: { status: true },
      }),
      this.prisma.order.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      this.prisma.order.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.ticket.findMany({
        take: 8,
        where: { isDeleted: false },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return this.serialize({
      cards: {
        users,
        products,
        variants,
        inventories,
        orders,
        tickets,
        todayOrders,
        paidOrders,
        revenue: revenue._sum.totalAmount ?? 0,
      },
      inventoryByStatus: inventoryRows,
      ordersByStatus: orderRows,
      recentOrders: recentOrders.map((record) => this.serializeRecord(this.getConfig('orders'), record)),
      recentTickets: recentTickets.map((record) => this.serializeRecord(this.getConfig('tickets'), record)),
    });
  }

  async uploadImage(file?: UploadedImageFile) {
    if (!file) {
      throw new BadRequestException('Image file is required');
    }

    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Only image files are supported');
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException('Image file must be 5MB or smaller');
    }

    if (!process.env.CLOUDINARY_URL) {
      throw new BadRequestException('CLOUDINARY_URL is not configured');
    }

    cloudinary.config({ secure: true });
    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const upload = cloudinary.uploader.upload_stream(
        {
          folder: 'ai-store',
          resource_type: 'image',
          use_filename: true,
          unique_filename: true,
        },
        (error, response) => {
          if (error || !response) {
            reject(error || new Error('Cloudinary upload failed'));
            return;
          }

          resolve(response);
        },
      );

      upload.end(file.buffer);
    });

    return {
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes,
    };
  }

  private getConfig(entityKey: string) {
    const config = ADMIN_ENTITY_MAP.get(entityKey);

    if (!config) {
      throw new BadRequestException(`Unknown entity: ${entityKey}`);
    }

    return config;
  }

  private normalizeQuery(config: AdminEntityConfig, query: AdminListQuery): Required<AdminListQuery> {
    const fields = new Set(config.fields.map((field) => field.name));
    const sortBy = query.sortBy && fields.has(query.sortBy) ? query.sortBy : config.defaultSort || 'createdAt';

    return {
      page: Math.max(Number(query.page || 1), 1),
      limit: Math.min(Math.max(Number(query.limit || 10), 1), 100),
      search: query.search || '',
      sortBy,
      sortOrder: query.sortOrder === 'asc' ? 'asc' : 'desc',
      filters: query.filters || {},
    };
  }

  private sanitizePayload(
    config: AdminEntityConfig,
    payload: Record<string, unknown>,
    mode: 'create' | 'update',
  ) {
    const data: Record<string, unknown> = {};
    const writableFields = config.fields.filter((field) => {
      if (field.virtual) return false;
      if (field.readonly || field.hidden) return false;
      if (mode === 'create' && field.create === false) return false;
      if (mode === 'update' && field.update === false) return false;
      return true;
    });

    for (const field of writableFields) {
      if (!(field.name in payload)) {
        if (mode === 'create' && field.required) {
          throw new BadRequestException(`${field.label} is required`);
        }
        continue;
      }

      data[field.name] = this.castValue(field, payload[field.name]);
    }

    return data;
  }

  private castValue(field: AdminFieldConfig, value: unknown) {
    if (value === undefined) return undefined;
    if (value === null || value === '') return field.required ? this.requiredError(field) : null;

    switch (field.type) {
      case 'int':
        return Number(value);
      case 'enum':
      case 'relation':
        return String(value);
      case 'bigint':
        return BigInt(String(value));
      case 'decimal':
        return new Prisma.Decimal(String(value));
      case 'boolean':
        return value === true || value === 'true';
      case 'date':
        return new Date(String(value));
      case 'image':
        return String(value).trim();
      case 'json':
        return typeof value === 'string' ? JSON.parse(value) : value;
      default:
        return String(value).trim();
    }
  }

  private requiredError(field: AdminFieldConfig): never {
    throw new BadRequestException(`${field.label} is required`);
  }

  private serializeRecord(config: AdminEntityConfig, record: unknown) {
    const serialized = this.serialize(record) as Record<string, unknown>;

    serialized.__recordId = config.compositeIdFields?.length
      ? config.compositeIdFields.map((field) => serialized[field]).join(':')
      : serialized[config.idField || 'id'];

    return serialized;
  }

  private serialize(value: unknown): unknown {
    if (typeof value === 'bigint') return value.toString();
    if (value instanceof Date) return value.toISOString();
    if (value instanceof Prisma.Decimal) return value.toString();
    if (Array.isArray(value)) return value.map((item) => this.serialize(item));
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, this.serialize(item)]),
      );
    }
    return value;
  }

  private startOfToday() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }

  private async getRelationOptions(field: AdminFieldConfig) {
    if (!field.relation) return [];

    const config = this.getConfig(field.relation.entityKey);
    const delegate = (this.prisma as unknown as Record<string, any>)[config.delegate];
    const valueField = field.relation.valueField || 'id';
    const labelField = field.relation.labelField;
    const records = await delegate.findMany({
      where: config.softDelete ? { isDeleted: false } : undefined,
      take: 200,
      orderBy: this.getRelationOrderBy(config, labelField),
    });

    return records.map((record: Record<string, unknown>) => ({
      label: this.getRelationLabel(record, labelField),
      value: String(record[valueField]),
    }));
  }

  private getRelationOrderBy(config: AdminEntityConfig, labelField: string) {
    const hasLabelField = config.fields.some((field) => field.name === labelField);
    if (hasLabelField) return { [labelField]: 'asc' };
    return { [config.defaultSort || 'createdAt']: 'desc' };
  }

  private getRelationLabel(record: Record<string, unknown>, labelField: string) {
    const primary = record[labelField];
    const fallback =
      record.name ||
      record.email ||
      record.username ||
      record.fullName ||
      record.orderNo ||
      record.code ||
      record.id;

    return String(primary || fallback || '-');
  }

  private async getUserRoleId(userId: string) {
    const userRole = await this.prisma.userRole.findFirst({
      where: { userId, isDeleted: false },
      orderBy: { updatedAt: 'desc' },
    });

    return userRole?.roleId || null;
  }

  private async assignUserRole(userId: string, roleId: string | null) {
    await this.prisma.userRole.updateMany({
      where: roleId ? { userId, roleId: { not: roleId } } : { userId },
      data: { isDeleted: true },
    });

    if (!roleId) return;

    const existing = await this.prisma.userRole.findFirst({
      where: { userId, roleId },
    });

    if (existing) {
      await this.prisma.userRole.update({
        where: { id: existing.id },
        data: { isDeleted: false },
      });
      return;
    }

    await this.prisma.userRole.create({
      data: { userId, roleId },
    });
  }

  private encryptInventoryPassword(entityKey: string, data: Record<string, unknown>) {
    if (entityKey !== 'inventories') return;
    if (typeof data.encryptedPassword === 'string') {
      data.encryptedPassword = this.inventoryPasswordService.encrypt(data.encryptedPassword);
    }
    this.encryptInviteLinkMetadata(data);
  }

  private decryptInventoryPassword(entityKey: string, record: Record<string, unknown>) {
    if (entityKey !== 'inventories' || typeof record.encryptedPassword !== 'string') return;
    record.encryptedPassword = this.inventoryPasswordService.decrypt(record.encryptedPassword);
  }

  private encryptInviteLinkMetadata(data: Record<string, unknown>) {
    if (!data.metadata || typeof data.metadata !== 'object' || Array.isArray(data.metadata)) return;

    const metadata = { ...(data.metadata as Record<string, unknown>) };
    const inviteLink = typeof metadata.inviteLink === 'string' ? metadata.inviteLink.trim() : '';
    const encryptedInviteLink =
      typeof metadata.encryptedInviteLink === 'string' ? metadata.encryptedInviteLink.trim() : '';

    if (inviteLink) {
      metadata.encryptedInviteLink = this.inventoryPasswordService.encrypt(inviteLink);
      delete metadata.inviteLink;
    } else if (encryptedInviteLink) {
      metadata.encryptedInviteLink = this.inventoryPasswordService.encrypt(encryptedInviteLink);
    }

    if (metadata.inventoryType === 'INVITE_LINK') {
      metadata.usedSlots = Number(metadata.usedSlots || 0);
      metadata.reservedSlots = Array.isArray(metadata.reservedSlots) ? metadata.reservedSlots : [];
    }

    data.metadata = metadata;
  }

  private normalizeCouponPayload(entityKey: string, data: Record<string, unknown>) {
    if (entityKey !== 'coupons') return;
    if (typeof data.code === 'string') {
      data.code = data.code.trim().toUpperCase();
    }
  }

  private toInputJsonValue(value: unknown) {
    return (value === undefined ? {} : value) as Prisma.InputJsonValue;
  }

  private async auditCouponChange(
    entityKey: string,
    action: AuditAction,
    oldData: unknown,
    newData: unknown,
  ) {
    if (entityKey !== 'coupons') return;

    const entityId = String((newData as Record<string, unknown>)?.id || (oldData as Record<string, unknown>)?.id || '');
    await this.prisma.auditLog.create({
      data: {
        entityName: 'coupon',
        entityId: entityId || null,
        action,
        oldData: oldData ? (this.serialize(oldData) as Prisma.InputJsonValue) : undefined,
        newData: newData ? (this.serialize(newData) as Prisma.InputJsonValue) : undefined,
      },
    });
  }

  private async announceCreatedEntity(entityKey: string, record: unknown) {
    const id = String((record as Record<string, unknown>).id || '');
    if (!id) return;

    if (entityKey === 'categories') {
      await this.notificationsService.announceCategoryAdded(id);
      return;
    }

    if (entityKey === 'products') {
      await this.notificationsService.announceProductAdded(id);
      return;
    }

    if (entityKey === 'inventories') {
      await this.notificationsService.announceInventoryRestocked(id, 1);
      return;
    }

    if (entityKey === 'coupons') {
      await this.notificationsService.announceCouponCreated(id);
    }
  }

  private async announceTicketStatusChanged(
    entityKey: string,
    previousRecord: unknown,
    record: unknown,
    closeReason?: string,
  ) {
    if (entityKey !== 'tickets' || !previousRecord || !record) return;

    const previousStatus = String((previousRecord as Record<string, unknown>).status || '');
    const nextStatus = String((record as Record<string, unknown>).status || '');
    const id = String((record as Record<string, unknown>).id || '');
    const notifyStatuses = ['IN_PROGRESS', 'RESOLVED', 'CLOSED'];

    if (!id || previousStatus === nextStatus || !notifyStatuses.includes(nextStatus)) return;

    await this.notificationsService.notifyTicketStatusChanged(
      id,
      nextStatus as TicketStatus,
      closeReason,
    );
  }

  private async invalidateCategoryCache(entityKey: string) {
    if (entityKey === 'categories' || entityKey === 'products') {
      await this.redisService.client.del('ai-store:active-categories');
    }
  }
}
