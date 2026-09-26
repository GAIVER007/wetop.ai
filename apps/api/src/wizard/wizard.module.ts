import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { PrismaService } from '../database/prisma.provider';
import { WizardController } from './wizard.controller';
import { WizardService } from './wizard.service';

@Module({ controllers: [WizardController], providers: [PrismaService, WizardService] })
export class WizardModule {}
