import Link from 'next/link';
import type { ReactNode } from 'react';
import { Page } from '../../components/page';
import { EmptyState, Panel, Stat, Stats } from '../../components/ui';
import { Icon, type IconName } from '../../components/icon';
import './vertical-today.css';

/**
 * Общая раскладка «Сегодня» салона и ресторана (MV8): плитки дня, «Требуют внимания», «Впереди».
 * Новых компонентов нет: `Stats`/`Stat`, `Panel`, `EmptyState`; числа приходят готовыми из `vertical-metrics`.
 * Салон (ТЗ «Модуль для салонов красоты» 09.10.2026) добавляет необязательные блоки: панель рядом с
 * «Ближайшими» (мастера на смене) и «Быстрые действия»; ресторан их не передаёт и не меняется.
 */
export interface DayStat {
  label: string;
  value: ReactNode;
  testId: string;
  hint?: string;
  tone?: 'warn';
  /** значок плитки по макету «Главная» салона; без него плитка прежняя */
  icon?: IconName;
}
export interface DayAttention {
  text: string;
  href: string;
  action: string;
  testId: string;
}
export interface DayRow {
  id: string;
  time: string;
  title: string;
  detail: string;
  status: string;
}
/** Панель рядом со списком «Впереди»: строка это имя, часы и короткая пометка справа */
export interface DayAside {
  title: string;
  empty: ReactNode;
  rows: Array<{ id: string; title: string; detail: string; note: string }>;
}
export interface DayQuickAction {
  href: string;
  label: string;
  icon: IconName;
}

export function VerticalDay({
  testId,
  title = 'Сегодня',
  subtitle,
  action,
  stats,
  attention,
  upcomingTitle,
  upcoming,
  empty,
  aside,
  quickActions,
}: {
  testId: string;
  /** заголовок экрана: у салона «Главная», как раздел меню (17.10.2026) */
  title?: string;
  subtitle: string;
  /** `primary`: главное действие смены залито `--primary` (DESIGN.md, главная кнопка одна на экран) */
  action: { href: string; label: string; primary?: boolean };
  stats: DayStat[];
  attention: DayAttention[];
  upcomingTitle: string;
  upcoming: DayRow[];
  empty: ReactNode;
  aside?: DayAside;
  quickActions?: DayQuickAction[];
}) {
  const upcomingPanel = (
    <Panel title={upcomingTitle} aria-label={upcomingTitle}>
      {upcoming.length === 0 ? (
        <EmptyState className="vertical-today__empty">{empty}</EmptyState>
      ) : (
        <ol className="vertical-today__rows" data-testid="today-upcoming">
          {upcoming.map((row) => (
            <li key={row.id}>
              <time className="vertical-today__time">{row.time}</time>
              <span className="vertical-today__who">
                <b>{row.title}</b>
                <span>{row.detail}</span>
              </span>
              <span className="vertical-today__status">{row.status}</span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
  return (
    <Page
      title={title}
      subtitle={subtitle}
      actions={
        <Link className={action.primary ? 'btn btn--primary' : 'btn btn--secondary'} href={action.href}>
          {action.label}
        </Link>
      }
    >
      <div className="vertical-today" data-testid={testId}>
        <Stats min={aside ? 200 : 150} aria-label="Показатели дня">
          {stats.map((s) => (
            <Stat
              key={s.testId}
              label={s.label}
              value={s.value}
              testId={s.testId}
              hint={s.hint}
              icon={s.icon ? <Icon name={s.icon} /> : undefined}
              tone={s.tone && (typeof s.value !== 'number' || s.value > 0) ? s.tone : undefined}
            />
          ))}
        </Stats>
        {attention.length > 0 && (
          <Panel title="Требуют внимания" aria-label="Требуют внимания">
            <ul className="vertical-today__attention">
              {attention.map((a) => (
                <li key={a.testId} data-testid={a.testId}>
                  <span>{a.text}</span>
                  <Link className="btn btn--ghost btn--sm" href={a.href}>
                    {a.action}
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        )}
        {aside ? (
          <div className="vertical-today__split">
            {upcomingPanel}
            <Panel title={aside.title} aria-label={aside.title}>
              {aside.rows.length === 0 ? (
                <EmptyState className="vertical-today__empty">{aside.empty}</EmptyState>
              ) : (
                <ul className="vertical-today__masters" data-testid="today-shift-list">
                  {aside.rows.map((row) => (
                    <li key={row.id}>
                      <span className="vertical-today__who">
                        <b>{row.title}</b>
                        <span>{row.detail}</span>
                      </span>
                      <span className="vertical-today__status">{row.note}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        ) : (
          upcomingPanel
        )}
        {quickActions && quickActions.length > 0 && (
          <Panel title="Быстрые действия" aria-label="Быстрые действия">
            <div className="vertical-today__actions">
              {quickActions.map((a) => (
                <Link key={a.href} className="btn btn--secondary" href={a.href}>
                  <Icon name={a.icon} aria-hidden="true" />
                  {a.label}
                </Link>
              ))}
            </div>
          </Panel>
        )}
      </div>
    </Page>
  );
}
