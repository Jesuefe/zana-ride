import { Controller, Get, NotFoundException, Res } from '@nestjs/common';
import { Response } from 'express';
import { existsSync } from 'fs';
import { resolve } from 'path';

@Controller('downloads')
export class DownloadsController {
  @Get('merchant.apk')
  downloadMerchantApk(@Res() res: Response) {
    const filePath = resolve(process.env.ZANA_MERCHANT_APK_PATH || '/var/www/zana-downloads/zana-merchant.apk');
    if (!existsSync(filePath)) {
      throw new NotFoundException('Merchant APK is not available yet');
    }

    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', 'attachment; filename="zana-merchant.apk"');
    return res.sendFile(filePath);
  }
}
