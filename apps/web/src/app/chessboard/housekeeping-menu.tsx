'use client';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { ActionMenu } from '../../components/action-menu';
import { useToast } from '../../components/toast';
import { housekeepingAction } from '../units/[code]/actions';

/**
 * Уборка в строке ячейки шахматки (21.09.2026, поручение владельца по снимку).
 *
 * Было: жёлтая плашка со словом «грязно» в колонке мест — на 88 строках столбик одинаковых слов, и
 * сделать с ним нечего: статус ставился только в карточке ячейки, на два перехода дальше. Стало: значок
 * щётки тоном внимания с доступным именем (§9 — цвет **плюс** глиф, слово читает программа чтения) и то
 * же меню действий, что у плашки проживания (C2): «Убрано», «Проверено», «Открыть карточку ячейки».
 *
 * Команда та же, что в карточке (`POST /units/:code/housekeeping`) — server action общий, и её
 * `revalidatePath` обновляет шахматку, фонд, доступность, статистику и главную.
 */
export const HK_RU = { DIRTY: 'грязно', CLEAN: 'убрано', INSPECTED: 'проверено' } as const;
/** Итог действия словом: «R01 убрана» — уведомление называет ячейку и что с ней стало (§14) */
const DONE_RU = { DIRTY: 'грязная', CLEAN: 'убрана', INSPECTED: 'проверена' } as const;

export function HousekeepingMenu({ code, status }: { code: string; status: keyof typeof HK_RU }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const set = (next: keyof typeof HK_RU) =>
    start(async () => {
      const result = await housekeepingAction(code, next);
      if (result.error) toast({ text: result.error, tone: 'danger' });
      else {
        toast({ text: `${code} ${DONE_RU[next]}`, tone: 'success' });
        router.refresh();
      }
    });
  return (
    <span className="board-hk" data-testid="unit-housekeeping" data-status={status}>
      <ActionMenu
        size="sm"
        icon="dirty"
        className="board-hk__menu"
        label={`Уборка ячейки ${code}: ${HK_RU[status]}`}
        items={[
          { label: 'Убрано', onSelect: () => set('CLEAN'), disabled: pending },
          { label: 'Проверено', onSelect: () => set('INSPECTED'), disabled: pending },
          { label: 'Открыть карточку ячейки', href: `/units/${encodeURIComponent(code)}` },
        ]}
      />
    </span>
  );
}
