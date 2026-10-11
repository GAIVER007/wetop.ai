import 'reflect-metadata';
import { TurnstileService } from '../web-booking/turnstile';
import { Module } from '@nestjs/common';
import { PrismaService } from '../database/prisma.provider';
import { WizardController } from './wizard.controller';
import { WizardGenerateWorker } from './wizard-generate-worker';
import { WizardScanWorker } from './wizard-scan-worker';
import { WizardService } from './wizard.service';
import { WizardRetentionService } from './wizard-retention.service';

import { SellerAgentsController } from './seller-agents.controller';
import { SellerAgentsService } from './seller-agents.service';

@Module({
  controllers: [WizardController, SellerAgentsController],
  providers: [
    PrismaService,
    WizardService,
    SellerAgentsService,
    WizardRetentionService,
    WizardScanWorker,
    WizardGenerateWorker,
    TurnstileService,
  ],
})
export class WizardModule {}
