import type { ReactNode } from 'react';
import Link from 'next/link';
import { Icon } from '../../components/icon';
import { Badge } from '../../components/ui';
import { msg } from '../../i18n';
import { T } from '../../i18n/locale-provider';
import './marketing.css';

/** Возврат к хабу на экранах модулей, как «Назад к модулям» в макете Marketing 2.0 */
export function BackToModules() {
  return (
    <Link href="/marketing" className="marketing-back">
      <Icon name="back" width={16} aria-hidden="true" />
      <T text={msg('Назад к модулям')} />
    </Link>
  );
}

/**
 * Плашка модуля в разработке. Экран показывает, каким будет модуль, но данных и действий у него ещё нет:
 * кнопки неактивны и ссылаются на эту плашку (`aria-describedby`), числа не выдумываются.
 */
export function ModuleSoon({ id, testId, children }: { id: string; testId: string; children: ReactNode }) {
  return (
    <p id={id} className="marketing-soon" data-testid={testId}>
      <Badge tone="info">
        <T text={msg('Скоро')} />
      </Badge>
      <span>{children}</span>
    </p>
  );
}

const WEEK = [msg('Пн'), msg('Вт'), msg('Ср'), msg('Чт'), msg('Пт'), msg('Сб'), msg('Вс')];

/** План публикаций на неделю: семь пустых дней, пока публикаций нет */
export function WeekPlan({ testId }: { testId: string }) {
  return (
    <ol className="marketing-week" data-testid={testId}>
      {WEEK.map((day) => (
        <li key={day} className="marketing-week__day">
          <span className="marketing-week__name">
            <T text={day} />
          </span>
          <span className="marketing-week__empty">
            <T text={msg('Пусто')} />
          </span>
        </li>
      ))}
    </ol>
  );
}
