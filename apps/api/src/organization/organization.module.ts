import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ChessboardService } from '../chessboard/chessboard.service';
import { CHESSBOARD_REPOSITORY, PrismaChessboardRepository } from '../chessboard/chessboard.repository';
import { DASHBOARD_REPOSITORY, PrismaDashboardRepository } from '../dashboard/dashboard.repository';
import { DashboardService } from '../dashboard/dashboard.service';
import { PrismaService } from '../database/prisma.provider';
import { OrganizationController } from './organization.controller';
import { ORGANIZATION_REPOSITORY, PrismaOrganizationRepository } from './organization.repository';
import { OrganizationService } from './organization.service';

/** Филиалы организации (Platform P3). Показатели филиала считает тот же `DashboardService`, что «Аналитика → Обзор» */
@Module({
  controllers: [OrganizationController],
  providers: [
    PrismaService,
    ChessboardService,
    { provide: CHESSBOARD_REPOSITORY, useClass: PrismaChessboardRepository },
    DashboardService,
    { provide: DASHBOARD_REPOSITORY, useClass: PrismaDashboardRepository },
    { provide: ORGANIZATION_REPOSITORY, useClass: PrismaOrganizationRepository },
    OrganizationService,
  ],
  exports: [OrganizationService],
})
export class OrganizationModule {}
