import 'reflect-metadata';
import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Access } from '../auth/access.decorator';
import { TasksService } from './tasks.service';

@Access('desk')
@Controller('tasks')
export class TasksController {
  constructor(@Inject(TasksService) private readonly service: TasksService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Post()
  create(@Body() body: unknown) {
    return this.service.create(body);
  }

  /** Правка полей и «сделана / открыта снова» (`done`) */
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.service.update(id, body);
  }
}
