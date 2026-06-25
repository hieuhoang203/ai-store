import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminService } from '../services/admin.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('entities')
  entities() {
    return this.adminService.getEntities();
  }

  @Get('dashboard')
  dashboard() {
    return this.adminService.dashboard();
  }

  @Post('uploads/image')
  @UseInterceptors(FileInterceptor('file'))
  uploadImage(@UploadedFile() file?: { buffer: Buffer; mimetype: string; originalname?: string; size: number }) {
    return this.adminService.uploadImage(file);
  }

  @Get(':entity')
  list(
    @Param('entity') entity: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    return this.adminService.list(entity, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
      sortBy,
      sortOrder,
    });
  }

  @Get(':entity/:id')
  detail(@Param('entity') entity: string, @Param('id') id: string) {
    return this.adminService.detail(entity, id);
  }

  @Post(':entity')
  create(@Param('entity') entity: string, @Body() payload: Record<string, unknown>) {
    return this.adminService.create(entity, payload);
  }

  @Patch(':entity/:id')
  update(
    @Param('entity') entity: string,
    @Param('id') id: string,
    @Body() payload: Record<string, unknown>,
  ) {
    return this.adminService.update(entity, id, payload);
  }

  @Put(':entity/:id')
  replace(
    @Param('entity') entity: string,
    @Param('id') id: string,
    @Body() payload: Record<string, unknown>,
  ) {
    return this.adminService.update(entity, id, payload);
  }

  @Patch('ma-giam-gia/:id/status')
  updateCouponStatus(@Param('id') id: string, @Body() payload: { trangThai?: string }) {
    return this.adminService.update('ma-giam-gia', id, {
      trangThai: payload.trangThai || 'DANG_HOAT_DONG',
    });
  }

  @Delete(':entity/:id')
  remove(@Param('entity') entity: string, @Param('id') id: string) {
    return this.adminService.remove(entity, id);
  }
}
