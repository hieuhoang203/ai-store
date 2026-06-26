import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { SupplierConnectDto, SupplierFulfillRequestDto } from './dto/supplier-onboarding.dto';
import { SupplierOnboardingService } from './supplier-onboarding.service';

@ApiTags('suppliers')
@Controller('suppliers')
export class SupplierOnboardingController {
  constructor(private readonly supplierOnboardingService: SupplierOnboardingService) {}

  @Get('invite-link')
  inviteLink() {
    return { url: this.supplierOnboardingService.getFixedInviteLink() };
  }

  @Get('join')
  join(@Res() response: Response, @Query('token') token?: string) {
    return response.redirect(302, this.supplierOnboardingService.getMiniAppRedirectUrl(token));
  }

  @Post('connect')
  connect(@Body() dto: SupplierConnectDto) {
    return this.supplierOnboardingService.connect(dto);
  }

  @Get('requests/:token')
  requestDetail(@Param('token') token: string, @Query('initData') initData: string) {
    return this.supplierOnboardingService.getRequestByToken(token, initData);
  }

  @Post('requests/:token/fulfill')
  fulfillRequest(@Param('token') token: string, @Body() dto: SupplierFulfillRequestDto) {
    return this.supplierOnboardingService.fulfillRequest(token, dto);
  }
}
