import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { GatewayService } from './gateway.service';

@ApiTags('gateway')
@Controller('join')
export class GatewayController {
  constructor(private readonly gatewayService: GatewayService) {}

  @Get(':token')
  async access(@Param('token') token: string, @Req() request: Request, @Res() response: Response) {
    const redirectUrl = await this.gatewayService.access(token, {
      ipAddress: this.getIpAddress(request),
      userAgent: request.get('user-agent') || '',
    });

    return response.redirect(302, redirectUrl);
  }

  private getIpAddress(request: Request): string {
    const forwardedFor = request.get('x-forwarded-for');
    if (forwardedFor) return forwardedFor.split(',')[0]?.trim() || request.ip || 'unknown';
    return request.ip || 'unknown';
  }
}
