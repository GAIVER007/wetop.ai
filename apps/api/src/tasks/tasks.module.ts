import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { PrismaService } from '../database/prisma.provider';
import { TasksController } from './tasks.controller';
import { PrismaTasksRepository, TASKS_REPOSITORY } from './tasks.repository';
import { TasksService } from './tasks.service';

@Module({
  controllers: [TasksController],
  providers: [PrismaService, TasksService, { provide: TASKS_REPOSITORY, useClass: PrismaTasksRepository }],
})
export class TasksModule {}
