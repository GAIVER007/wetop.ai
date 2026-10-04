import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { PrismaService } from '../database/prisma.provider';
import { BarController } from './bar.controller';
import { BAR_REPOSITORY, PrismaBarRepository } from './bar.repository';
import { BarService } from './bar.service';

@Module({ controllers: [BarController], providers: [PrismaService, BarService, { provide: BAR_REPOSITORY, useClass: PrismaBarRepository }] })
export class BarModule {}
