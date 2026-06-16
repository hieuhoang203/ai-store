import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminTokenLoginDto } from './dto/admin-token-login.dto';
import { TelegramLoginDto } from './dto/telegram-login.dto';
import { AuthService } from './auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('telegram')
  telegramLogin(@Body() dto: TelegramLoginDto) {
    return this.authService.loginWithTelegramInitData(dto.initData);
  }

  @Post('admin/token')
  adminTokenLogin(@Body() dto: AdminTokenLoginDto) {
    return this.authService.loginAdminWithToken(dto.token);
  }
}
