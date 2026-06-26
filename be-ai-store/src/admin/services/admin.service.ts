import { BadRequestException, Injectable } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../database/prisma.service';
import { AdminEntityConfig, AdminFieldConfig, AdminListQuery } from '../interfaces/admin-crud.interface';
import { ADMIN_ENTITIES, ADMIN_ENTITY_MAP } from '../models/admin-entity.model';
import { AdminRepository } from '../repositories/admin.repository';

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
  ) {}

  async getEntities() {
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
    const result = await this.repository.list(config, this.normalizeQuery(config, query));

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

    if (entityKey === 'link-moi-nha-cung-cap') {
      if (!data.maToken) {
        data.maToken = require('crypto').randomBytes(24).toString('hex');
      }
      if (!data.trangThai) {
        data.trangThai = 'CHUA_SU_DUNG';
      }
    }

    const record = await this.repository.create(config, data);
    return this.serializeRecord(config, record);
  }

  async update(entityKey: string, recordId: string, payload: Record<string, unknown>) {
    const config = this.getConfig(entityKey);
    const data = this.sanitizePayload(config, payload, 'update');
    const record = await this.repository.update(config, recordId, data);
    return this.serializeRecord(config, record);
  }

  async remove(entityKey: string, recordId: string) {
    const config = this.getConfig(entityKey);
    return this.serializeRecord(config, await this.repository.remove(config, recordId));
  }

  async dashboard() {
    const [
      nguoiDung,
      loaiSanPham,
      sanPham,
      goiDichVu,
      nhaCungCap,
      donHang,
      thanhToanDaTra,
      doanhThu,
      donHangTheoTrangThai,
      thanhToanTheoTrangThai,
      yeuCauNhaCungCap,
      ticketHoTro,
      donMoi,
      ticketMoi,
    ] = await Promise.all([
      this.repository.count(this.getConfig('nguoi-dung')),
      this.repository.count(this.getConfig('loai-san-pham')),
      this.repository.count(this.getConfig('san-pham')),
      this.repository.count(this.getConfig('goi-dich-vu')),
      this.repository.count(this.getConfig('nha-cung-cap')),
      this.repository.count(this.getConfig('don-hang')),
      this.prisma.thanhToan.count({ where: { trangThai: 'DA_THANH_TOAN', daXoa: false } }),
      this.prisma.donHang.aggregate({
        _sum: { tongTien: true },
        where: { trangThaiThanhToan: 'DA_THANH_TOAN', daXoa: false },
      }),
      this.prisma.donHang.groupBy({ by: ['trangThai'], _count: { trangThai: true } }),
      this.prisma.thanhToan.groupBy({ by: ['trangThai'], _count: { trangThai: true } }),
      this.prisma.yeuCauNhaCungCap.count(),
      this.repository.count(this.getConfig('ticket-ho-tro')),
      this.prisma.donHang.findMany({ take: 8, orderBy: { taoLuc: 'desc' } }),
      this.prisma.ticketHoTro.findMany({ take: 8, where: { daXoa: false }, orderBy: { taoLuc: 'desc' } }),
    ]);

    return this.serialize({
      cards: {
        nguoiDung,
        loaiSanPham,
        sanPham,
        goiDichVu,
        nhaCungCap,
        donHang,
        thanhToanDaTra,
        yeuCauNhaCungCap,
        ticketHoTro,
        doanhThu: doanhThu._sum.tongTien ?? 0,
      },
      inventoryByStatus: [],
      ordersByStatus: donHangTheoTrangThai.map((item) => ({
        status: item.trangThai,
        _count: { status: item._count.trangThai },
      })),
      paymentsByStatus: thanhToanTheoTrangThai.map((item) => ({
        status: item.trangThai,
        _count: { status: item._count.trangThai },
      })),
      recentOrders: donMoi.map((record) => this.serializeRecord(this.getConfig('don-hang'), record)),
      recentTickets: ticketMoi.map((record) => this.serializeRecord(this.getConfig('ticket-ho-tro'), record)),
    });
  }

  async uploadImage(file?: UploadedImageFile) {
    if (!file) throw new BadRequestException('Image file is required');
    if (!file.mimetype.startsWith('image/')) throw new BadRequestException('Only image files are supported');
    if (file.size > 5 * 1024 * 1024) throw new BadRequestException('Image file must be 5MB or smaller');
    if (!process.env.CLOUDINARY_URL) throw new BadRequestException('CLOUDINARY_URL is not configured');

    cloudinary.config({ secure: true });
    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const upload = cloudinary.uploader.upload_stream(
        { folder: 'ai-store', resource_type: 'image', use_filename: true, unique_filename: true },
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
    if (!config) throw new BadRequestException(`Unknown entity: ${entityKey}`);
    return config;
  }

  private normalizeQuery(config: AdminEntityConfig, query: AdminListQuery): Required<AdminListQuery> {
    const fields = new Set(config.fields.map((field) => field.name));
    const sortBy = query.sortBy && fields.has(query.sortBy) ? query.sortBy : config.defaultSort || 'taoLuc';

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
      if (field.virtual || field.readonly || field.hidden) return false;
      if (mode === 'create' && field.create === false) return false;
      if (mode === 'update' && field.update === false) return false;
      return true;
    });

    for (const field of writableFields) {
      if (!(field.name in payload)) {
        if (mode === 'create' && field.required) throw new BadRequestException(`${field.label} is required`);
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
      case 'uuid':
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
    serialized.__recordId = serialized[config.idField || 'id'];
    return serialized;
  }

  private serialize(value: unknown): unknown {
    if (typeof value === 'bigint') return value.toString();
    if (value instanceof Date) return value.toISOString();
    if (value instanceof Prisma.Decimal) return value.toString();
    if (Array.isArray(value)) return value.map((item) => this.serialize(item));
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, this.serialize(item)]));
    }
    return value;
  }

  private async getRelationOptions(field: AdminFieldConfig) {
    if (!field.relation) return [];

    const config = this.getConfig(field.relation.entityKey);
    const delegate = (this.prisma as unknown as Record<string, any>)[config.delegate];
    const valueField = field.relation.valueField || 'id';
    const labelField = field.relation.labelField;
    const records = await delegate.findMany({
      where: config.softDelete ? { daXoa: false } : undefined,
      take: 300,
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
    return { [config.defaultSort || 'taoLuc']: 'desc' };
  }

  private getRelationLabel(record: Record<string, unknown>, labelField: string) {
    return String(
      record[labelField] ||
        record.tenGoi ||
        record.tenSanPham ||
        record.tenLoai ||
        record.tenHienThi ||
        record.hoTen ||
        record.username ||
        record.maDonHang ||
        record.ma ||
        record.id ||
        '-',
    );
  }
}
