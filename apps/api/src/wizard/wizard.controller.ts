import 'reflect-metadata';
import { createHmac } from 'node:crypto';
import { ServiceUnavailableException } from '@nestjs/common';
import { TurnstileService, turnstileFailureError } from '../web-booking/turnstile';
import { Body, Controller, Get, Header, Headers, Inject, Ip, Patch, Post } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { visitorIp } from '../web-booking/client-ip';
import { WizardService } from './wizard.service';

@Controller('wizard')
@Public()
export class WizardController {
  constructor(
    @Inject(WizardService) private readonly wizard: WizardService,
    @Inject(TurnstileService) private readonly turnstile: TurnstileService,
  ) {}
  @Post('session')
  @Header('Cache-Control', 'no-store')
  open(
    @Headers('x-wizard-token') token: string | undefined,
    @Body() body: { ref?: unknown } | undefined,
    @Ip() socketIp?: string,
    @Headers('cf-connecting-ip') cfConnectingIp?: string,
  ) {
    return this.wizard.open(token, body?.ref, visitorIp(socketIp, cfConnectingIp));
  }
  @Get('status')
  @Header('Cache-Control', 'no-store')
  status(@Headers('x-wizard-token') token: string | undefined) {
    return this.wizard.status(token);
  }
  @Patch('config')
  @Header('Cache-Control', 'no-store')
  save(@Headers('x-wizard-token') token: string | undefined, @Body() body: unknown) {
    return this.wizard.save(token, body);
  }
  @Post('scan')
  @Header('Cache-Control', 'no-store')
  async scan(
    @Headers('x-wizard-token') token: string | undefined,
    @Body() body: { revision?: unknown; challenge?: unknown } | undefined,
    @Ip() socketIp?: string,
    @Headers('cf-connecting-ip') cfConnectingIp?: string,
  ) {
    const secret = process.env.TURNSTILE_SECRET_KEY;
    const host = process.env.WIZARD_PUBLIC_HOST;
    if (
      process.env.WIZARD_SCAN_ENABLED !== '1' ||
      !secret ||
      !host ||
      !process.env.TURNSTILE_SITE_KEY
    )
      throw new ServiceUnavailableException('Скан сайта пока не включён. Заполните данные вручную');
    await this.wizard.status(token);
    const ip = visitorIp(socketIp, cfConnectingIp);
    const verdict = await this.turnstile.verify(body?.challenge, {
      ip,
      allowedHosts: [host],
      action: 'wizard',
      requireBinding: true,
    });
    if (!verdict.ok) throw turnstileFailureError(verdict.reason);
    return this.wizard.scan(
      token,
      body,
      createHmac('sha256', secret)
        .update(ip ?? 'unknown')
        .digest('hex'),
    );
  }
  @Get('scan')
  @Header('Cache-Control', 'no-store')
  scanStatus(@Headers('x-wizard-token') token: string | undefined) {
    return this.wizard.scanStatus(token);
  }
  @Get('quota')
  @Header('Cache-Control', 'no-store')
  quota(@Headers('x-wizard-token') token: string | undefined) {
    return this.wizard.quota(token);
  }
  @Post('survey')
  @Header('Cache-Control', 'no-store')
  survey(@Headers('x-wizard-token') token: string | undefined, @Body() body: unknown) {
    return this.wizard.survey(token, body);
  }
  @Post('event')
  @Header('Cache-Control', 'no-store')
  event(@Headers('x-wizard-token') token: string | undefined, @Body() body: unknown) {
    return this.wizard.event(token, body);
  }
}
