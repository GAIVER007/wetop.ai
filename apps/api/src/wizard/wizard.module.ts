import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { PrismaService } from '../database/prisma.provider';
import { WizardController } from './wizard.controller';
import { WizardService } from './wizard.service';
import { WizardRetentionService } from './wizard-retention.service';

import { SellerAgentsController } from './seller-agents.controller';
import { SellerAgentsService } from './seller-agents.service';

@Module({
  controllers: [WizardController, SellerAgentsController],
  providers: [PrismaService, WizardService, SellerAgentsService, WizardRetentionService],
})
export class WizardModule {}
