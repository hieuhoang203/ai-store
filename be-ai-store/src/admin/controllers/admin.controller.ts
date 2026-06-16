import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
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

  @Delete(':entity/:id')
  remove(@Param('entity') entity: string, @Param('id') id: string) {
    return this.adminService.remove(entity, id);
  }
}
