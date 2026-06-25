import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  AdminEntityConfig,
  AdminListQuery,
  AdminListResult,
} from '../interfaces/admin-crud.interface';

@Injectable()
export class AdminRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    config: AdminEntityConfig,
    query: Required<AdminListQuery>,
  ): Promise<AdminListResult> {
    const delegate = this.getDelegate(config);
    const where = this.buildWhere(config, query);
    const orderBy = { [query.sortBy || config.defaultSort || 'taoLuc']: query.sortOrder };
    const [data, total] = await Promise.all([
      delegate.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy,
      }),
      delegate.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async detail(config: AdminEntityConfig, recordId: string) {
    const delegate = this.getDelegate(config);
    const where = this.withSoftDelete(config, this.buildUniqueWhere(config, recordId));
    const record = await delegate.findFirst({ where });

    if (!record) {
      throw new NotFoundException(`${config.label} record not found`);
    }

    return record;
  }

  async create(config: AdminEntityConfig, data: Record<string, unknown>) {
    return this.getDelegate(config).create({ data });
  }

  async update(config: AdminEntityConfig, recordId: string, data: Record<string, unknown>) {
    await this.detail(config, recordId);
    return this.getDelegate(config).update({
      where: this.buildUniqueWhere(config, recordId),
      data,
    });
  }

  async remove(config: AdminEntityConfig, recordId: string) {
    await this.detail(config, recordId);

    if (config.softDelete) {
      return this.getDelegate(config).update({
        where: this.buildUniqueWhere(config, recordId),
        data: { daXoa: true },
      });
    }

    return this.getDelegate(config).delete({
      where: this.buildUniqueWhere(config, recordId),
    });
  }

  async count(config: AdminEntityConfig, extraWhere: Record<string, unknown> = {}) {
    return this.getDelegate(config).count({
      where: config.softDelete ? { daXoa: false, ...extraWhere } : extraWhere,
    });
  }

  private getDelegate(config: AdminEntityConfig) {
    const delegate = (this.prisma as unknown as Record<string, any>)[config.delegate];

    if (!delegate) {
      throw new BadRequestException(`Delegate ${config.delegate} is not configured`);
    }

    return delegate;
  }

  private buildWhere(config: AdminEntityConfig, query: Required<AdminListQuery>) {
    const where: Record<string, unknown> = {};

    if (config.softDelete) {
      where.daXoa = false;
    }

    if (query.search && config.searchableFields?.length) {
      where.OR = config.searchableFields.map((field) => ({
        [field]: { contains: query.search, mode: 'insensitive' },
      }));
    }

    for (const [key, value] of Object.entries(query.filters)) {
      if (value !== undefined && value !== null && value !== '') {
        where[key] = value;
      }
    }

    return where;
  }

  private withSoftDelete(config: AdminEntityConfig, where: Record<string, unknown>) {
    return config.softDelete ? { ...where, daXoa: false } : where;
  }

  private buildUniqueWhere(config: AdminEntityConfig, recordId: string) {
    if (config.compositeIdFields?.length) {
      const values = decodeURIComponent(recordId).split(':');

      if (values.length !== config.compositeIdFields.length || !config.compoundWhereName) {
        throw new BadRequestException(`Invalid composite id for ${config.label}`);
      }

      return {
        [config.compoundWhereName]: Object.fromEntries(
          config.compositeIdFields.map((field, index) => [field, values[index]]),
        ),
      };
    }

    return { [config.idField || 'id']: recordId };
  }
}
