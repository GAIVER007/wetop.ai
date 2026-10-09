import type { ReactNode } from 'react';
import { Icon, type IconName } from './icon';

/**
 * Значок внутри поля (ADR-157, DESIGN.md §8.3): стоит слева, ввод и подпись не меняются. Значок не носитель смысла
 * (подпись поля остаётся над ним), для читалки скрыт. Оборачивает `Input` или `Select`; `id` и `required` дочернему
 * полю задают явно, потому что `Field` передаёт их только прямому ребёнку.
 */
export function IconField({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <span className="field-icon">
      <Icon name={icon} width={18} height={18} />
      {children}
    </span>
  );
}
