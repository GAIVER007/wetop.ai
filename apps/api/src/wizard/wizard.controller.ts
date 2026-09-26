import 'reflect-metadata';
import { Body, Controller, Get, Header, Headers, Inject, Patch, Post } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { WizardService } from './wizard.service';

@Controller('wizard')
@Public()
export class WizardController {
  constructor(@Inject(WizardService) private readonly wizard: WizardService) {}
  @Post('session')
  @Header('Cache-Control', 'no-store')
  open(
    @Headers('x-wizard-token') token: string | undefined,
    @Body() body: { ref?: unknown } | undefined,
  ) {
    return this.wizard.open(token, body?.ref);
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
  @Get('quota')
  @Header('Cache-Control', 'no-store')
  quota(@Headers('x-wizard-token') token: string | undefined) {
    return this.wizard.quota(token);
  }
}
