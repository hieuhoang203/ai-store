import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client.js';
import { InventoryStatus, OrderStatus, PaymentStatus } from '../models/admin-enums.model';
import { PrismaService } from '../../database/prisma.service';
import { ADMIN_ENTITIES, ADMIN_ENTITY_MAP } from '../models/admin-entity.model';
import {
  AdminEntityConfig,
  AdminFieldConfig,
  AdminListQuery,
} from '../interfaces/admin-crud.interface';
import { AdminRepository } from '../repositories/admin.repository';

@Injectable()
export class AdminService {
  constructor(
    private readonly repository: AdminRepository,
    private readonly prisma: PrismaService,
  ) {}

  getEntities() {
    return ADMIN_ENTITIES;
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
    return this.serializeRecord(config, await this.repository.detail(config, recordId));
  }

  async create(entityKey: string, payload: Record<string, unknown>) {
    const config = this.getConfig(entityKey);
    const data = this.sanitizePayload(config, payload, 'create');
    return this.serializeRecord(config, await this.repository.create(config, data));
  }

  async update(entityKey: string, recordId: string, payload: Record<string, unknown>) {
    const config = this.getConfig(entityKey);
    const data = this.sanitizePayload(config, payload, 'update');
    return this.serializeRecord(config, await this.repository.update(config, recordId, data));
  }

  async remove(entityKey: string, recordId: string) {
    const config = this.getConfig(entityKey);
    return this.serializeRecord(config, await this.repository.remove(config, recordId));
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
        return String(value);
      case 'bigint':
        return BigInt(String(value));
      case 'decimal':
        return new Prisma.Decimal(String(value));
      case 'boolean':
        return value === true || value === 'true';
      case 'date':
        return new Date(String(value));
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
}
