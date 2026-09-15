'use client';
import { useRouter } from 'next/navigation';
import { ActionMenu } from '../../components/action-menu';

/**
 * «Разрешить» у строки «Без ячейки» (план дизайн-системы, Д3): конфликт — это проживание без места,
 * а разрешение — существующие назначение ячейки и переселение в другую категорию (с суммой до
 * подтверждения). Новых правил нет: оба пункта ведут в карточку брони, к форме назначения.
 */
export function ResolveMenu({ number }: { number: string }) {
  const router = useRouter();
  const href = `/reservations/${encodeURIComponent(number)}#booking-actions`;
  return (
    <ActionMenu
      label="Разрешить"
      className="board-unassigned__assign"
      items={[
        {
          id: 'assign',
          label: 'Назначить ячейку',
          icon: 'bed',
          hint: 'свободные ячейки категории на весь срок',
          onSelect: () => router.push(href),
        },
        {
          id: 'move',
          label: 'Переселить в другую категорию',
          icon: 'arrow',
          hint: 'сумма пересчитается, окно покажет её до подтверждения',
          onSelect: () => router.push(href),
        },
      ]}
    />
  );
}
