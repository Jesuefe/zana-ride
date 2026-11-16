import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { PartnerApiKeyGuard } from './partner-api-key.guard';
import { PartnerApiService } from './partner-api.service';

type PartnerRequest = { partner: { id: string; scopes: string[] } };

@Controller('partner')
@UseGuards(PartnerApiKeyGuard)
export class PartnerApiController {
  constructor(private readonly service: PartnerApiService) {}

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
