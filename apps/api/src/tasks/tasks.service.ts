import 'reflect-metadata';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { parseTaskInput, taskBucket, type TaskInput } from '@pms/domain';
import { TASKS_REPOSITORY, type DeskTaskRow, type TasksRepository } from './tasks.repository';

export interface TasksList {
  today: string;
  tasks: Array<DeskTaskRow & { bucket: ReturnType<typeof taskBucket> }>;
  counts: { overdue: number; today: number; upcoming: number; done: number };
}

/** Задачи стойки (DATA_MODEL §22): все роли объекта видят и закрывают (право `desk`) */
@Injectable()
export class TasksService {
  constructor(@Inject(TASKS_REPOSITORY) private readonly repo: TasksRepository) {}

  async list(): Promise<TasksList> {
    const [today, rows] = await Promise.all([this.repo.today(), this.repo.list()]);
    const tasks = rows.map((t) => ({ ...t, bucket: taskBucket({ dueDate: t.dueDate, done: t.doneAt !== null }, today) }));
    const count = (b: string) => tasks.filter((t) => t.bucket === b).length;
    return {
      today,
      tasks,
      counts: { overdue: count('overdue'), today: count('today'), upcoming: count('upcoming'), done: count('done') },
    };
  }

  private async parse(body: unknown, mode: 'create' | 'update'): Promise<TaskInput> {
    const parsed = parseTaskInput(body, mode);
    if (!parsed.ok) throw new BadRequestException(parsed.reason);
    const id = parsed.value.assigneeUserId;
    if (id && !(await this.repo.isMember(id)))
      throw new BadRequestException('Исполнитель — сотрудник вашей организации');
    return parsed.value;
  }

  async create(body: unknown) {
    return this.repo.create(await this.parse(body, 'create'));
  }

  async update(id: string, body: unknown) {
    const input = await this.parse(body, 'update');
    const row = await this.repo.update(id, input);
    if (!row) throw new NotFoundException('Задача не найдена');
    return row;
  }
}
