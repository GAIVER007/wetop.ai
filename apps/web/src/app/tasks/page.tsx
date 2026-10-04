import { tasksApi } from '../../lib/api';
import { Page } from '../../components/page';
import { Alert } from '../../components/ui';
import { currentMe, deskShell } from '../../lib/desk-shell';
import { TaskBoard } from './task-board';

/**
 * «Задачи» (DATA_MODEL §22, ADR-143): что сделать смене, по срокам. Вход — из панели «Сегодня» календаря;
 * `?reservation=` открывает создание сразу со связью с бронью. Ошибка загрузки — словами, не пустой список.
 */
export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ reservation?: string }>;
}) {
  const { reservation } = await searchParams;
  const [list, shell, me] = await Promise.all([
    tasksApi.list().catch(() => null),
    deskShell(),
    currentMe().catch(() => null),
  ]);
  return (
    <Page title="Задачи" subtitle="Что сделать смене: срок, приоритет, ответственный">
      {list === null ? (
        <Alert boxed>Не удалось загрузить задачи. Обновите страницу.</Alert>
      ) : (
        <TaskBoard
          list={list}
          meId={me?.user?.id ?? null}
          canEdit={!shell.readOnly}
          {...(reservation ? { defaultReservation: reservation } : {})}
        />
      )}
    </Page>
  );
}
