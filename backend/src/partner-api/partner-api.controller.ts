import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { PartnerApiKeyGuard } from './partner-api-key.guard';
import { PartnerApiService } from './partner-api.service';

type PartnerRequest = { partner: { id: string; scopes: string[] } };

@Controller('partner')
@UseGuards(PartnerApiKeyGuard)
export class PartnerApiController {
  constructor(private readonly service: PartnerApiService) {}

  @Post('wallet/reservations')
  reserve(@Req() request: PartnerRequest, @Body() body: { reference: string; amount: number }) {
    return this.service.reserve(request.partner.id, request.partner.scopes, body.reference, body.amount);
  }

  @Post('wallet/reservations/:reference/settle')
  settle(@Req() request: PartnerRequest, @Param('reference') reference: string) {
    return this.service.settle(request.partner.id, request.partner.scopes, reference);
  }

  @Post('wallet/reservations/:reference/release')
  release(@Req() request: PartnerRequest, @Param('reference') reference: string, @Body() body: { reason?: string }) {
    return this.service.release(request.partner.id, request.partner.scopes, reference, body?.reason);
  }

  @Get('account')
  account(@Req() request: PartnerRequest) {
    return this.service.account(request.partner.id, request.partner.scopes);
  }

  @Get('wallet')
  wallet(@Req() request: PartnerRequest) {
    return this.service.wallet(request.partner.id, request.partner.scopes);
  }

  @Get('wallet/transactions')
  transactions(@Req() request: PartnerRequest, @Query('limit') limit?: string) {
    return this.service.transactions(request.partner.id, request.partner.scopes, limit);
  }
}
