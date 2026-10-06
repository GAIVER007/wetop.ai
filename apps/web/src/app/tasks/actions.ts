'use server';
import { revalidatePath } from 'next/cache';
import { ApiError, tasksApi } from '../../lib/api';

/** Результат действия «Задач» (DATA_MODEL §22): ошибка словами у формы, введённое не теряется */
export interface TaskActionResult {
  error: string | null;
  /** метка успеха — клиент закрывает панель */
  ok: number;
}
const describe = (e: unknown) =>
  e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e);
const s = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
};

/** Новая задача из формы; «весь день» — пустое время, «на меня» — id вошедшего из скрытого поля */
export async function createTaskAction(_prev: TaskActionResult, fd: FormData): Promise<TaskActionResult> {
  try {
    await tasksApi.create({
      title: s(fd, 'title') ?? '',
      note: s(fd, 'note') ?? null,
      dueDate: s(fd, 'dueDate'),
      dueTime: s(fd, 'dueTime') ?? null,
      priority: s(fd, 'priority') ?? 'NORMAL',
      assigneeUserId: fd.get('assignMe') === 'on' ? (s(fd, 'meId') ?? null) : null,
      reservationNumber: s(fd, 'reservationNumber') ?? null,
    });
  } catch (e) {
    return { error: describe(e), ok: 0 };
  }
  revalidatePath('/tasks');
  revalidatePath('/chessboard');
  return { error: null, ok: Date.now() };
}

/** «Сделана» или «открыть снова»: ответ — строка над списком, список перечитывается */
export async function setTaskDoneAction(id: string, done: boolean): Promise<{ error: string | null }> {
  try {
    await tasksApi.update(id, { done });
  } catch (e) {
    return { error: describe(e) };
  }
  revalidatePath('/tasks');
  revalidatePath('/chessboard');
  return { error: null };
}
