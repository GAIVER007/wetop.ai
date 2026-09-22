'use client';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { HOUSEKEEPING_RU, housekeepingTargets } from '@pms/domain';
import { ActionMenu } from '../../components/action-menu';
import type { IconName } from '../../components/icon';
import { useToast } from '../../components/toast';
import { housekeepingAction } from '../units/[code]/actions';

/**
 * Уборка в строке ячейки шахматки.
 *
 * 21.09.2026: вместо жёлтой плашки со словом «грязно» — значок с доступным именем (§9: цвет **плюс** глиф,
 * слово читает программа чтения) и меню действий прямо в строке, теми же командами, что в карточке.
 *
 * 22.09.2026 (поручение владельца: «требует уборки → убрано → проверено → доступна»): значок стоит, пока с
 * ячейкой надо что-то делать, и говорит, что именно — щётка тоном внимания «требует уборки», значок
 * «убрано, ждёт проверки»; после «Проверено» ячейка доступна, и значка в строке нет. Меню предлагает
 * только следующий шаг цикла и возврат в уборку (`housekeepingTargets`, @pms/domain) — перепрыгнуть
 * проверку нельзя ни отсюда, ни через API (409 словами).
 *
 * Команда та же, что в карточке (`POST /units/:code/housekeeping`) — server action общий, и её
 * `revalidatePath` обновляет шахматку, фонд, доступность, статистику и главную.
 */
type Status = 'DIRTY' | 'CLEAN' | 'INSPECTED';
/** Пункт меню назван результатом: нажал «Убрано» — ячейка убрана (DESIGN.md §14) */
const ITEM_RU: Record<Status, string> = {
  DIRTY: 'Требует уборки',
  CLEAN: 'Убрано',
  INSPECTED: 'Проверено',
};
/** Итог действия словом: «R01 убрана, ждёт проверки» — уведомление называет ячейку и что с ней стало */
const DONE_RU: Record<Status, string> = {
  DIRTY: 'требует уборки',
  CLEAN: 'убрана, ждёт проверки',
  INSPECTED: 'проверена, доступна',
};
const ICON: Record<Exclude<Status, 'INSPECTED'>, IconName> = { DIRTY: 'dirty', CLEAN: 'clean' };

export function HousekeepingMenu({
  code,
  status,
}: {
  code: string;
  /** Значок стоит только у ячейки, с которой надо что-то делать; у проверенной его нет */
  status: Exclude<Status, 'INSPECTED'>;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const set = (next: Status) =>
    start(async () => {
      const result = await housekeepingAction(code, next);
      if (result.error) toast({ text: result.error, tone: 'danger' });
      else {
        toast({ text: `${code} ${DONE_RU[next]}`, tone: 'success' });
        router.refresh();
      }
    });
  return (
    <span
      className={`board-hk board-hk--${status.toLowerCase()}`}
      data-testid="unit-housekeeping"
      data-status={status}
    >
      <ActionMenu
        size="sm"
        icon={ICON[status]}
        className="board-hk__menu"
        label={`Уборка ячейки ${code}: ${HOUSEKEEPING_RU[status]}`}
        items={[
          ...housekeepingTargets(status).map((next) => ({
            label: ITEM_RU[next],
            onSelect: () => set(next),
            disabled: pending,
          })),
          { label: 'Открыть карточку ячейки', href: `/units/${encodeURIComponent(code)}` },
        ]}
      />
    </span>
  );
}
