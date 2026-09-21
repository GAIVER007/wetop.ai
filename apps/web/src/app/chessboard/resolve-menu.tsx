'use client';
import { ActionMenu } from '../../components/action-menu';

/**
 * «Разрешить» у брони без ячейки (срез 7.3, Д3): оба пути ведут в карточку, к форме назначения —
 * там список свободных ячеек на весь срок проживания, а не только на видимые ночи шахматки.
 * Переселение в другую категорию — та же форма: ячейка чужой категории покажет окно с новой суммой.
 */
export function ResolveMenu({ number }: { number: string }) {
  const card = `/reservations/${encodeURIComponent(number)}#booking-actions`;
  return (
    <ActionMenu
      label="Разрешить"
      size="sm"
      items={[
        { label: 'Назначить ячейку', href: card },
        { label: 'Переселить в другую категорию', href: card },
      ]}
    />
  );
}
