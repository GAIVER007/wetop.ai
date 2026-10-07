import Link from 'next/link';
import type { ReactNode } from 'react';
import { Page } from '../../components/page';
import { EmptyState, Panel, Stat, Stats } from '../../components/ui';
import './vertical-today.css';

/**
 * Общая раскладка «Сегодня» салона и ресторана (MV8): плитки дня, «Требуют внимания», «Впереди».
 * Новых компонентов нет: `Stats`/`Stat`, `Panel`, `EmptyState`; числа приходят готовыми из `vertical-metrics`.
 */
export interface DayStat {
  label: string;
  value: number;
  testId: string;
  hint?: string;
  tone?: 'warn';
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

export function VerticalDay({
  testId,
  subtitle,
  action,
  stats,
  attention,
  upcomingTitle,
  upcoming,
  empty,
}: {
  testId: string;
  subtitle: string;
  action: { href: string; label: string };
  stats: DayStat[];
  attention: DayAttention[];
  upcomingTitle: string;
  upcoming: DayRow[];
  empty: ReactNode;
}) {
  return (
    <Page
      title="Сегодня"
      subtitle={subtitle}
      actions={
        <Link className="btn btn--secondary" href={action.href}>
          {action.label}
        </Link>
      }
    >
      <div className="vertical-today" data-testid={testId}>
        <Stats min={150} aria-label="Показатели дня">
          {stats.map((s) => (
            <Stat
              key={s.testId}
              label={s.label}
              value={s.value}
              testId={s.testId}
              hint={s.hint}
              tone={s.tone && s.value > 0 ? s.tone : undefined}
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
      </div>
    </Page>
  );
}
