'use client';
import { useState } from 'react';
import { Overlay } from './overlay';
import { Icon } from './icon';
import { Alert, Button, Help } from './ui';
import { formatMoney } from '../lib/money';
import type { QuickReportData } from './quick-report-data';
import './quick-report.css';
import { ReferenceReport } from './quick-report-reference';

const colors: Record<string, string> = {
  neutral: 'var(--text-2)',
  info: 'var(--info)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  danger: 'var(--danger)',
};

export function QuickReport({
  date,
  scope,
  build,
}: {
  date: string;
  /** части подписи отчёта, каждая своей строкой, без разделителя-точки (DESIGN.md §14) */
  scope: string[];
  build: () => QuickReportData;
}) {
  const [open, setOpen] = useState(false);
  let data: QuickReportData | null = null;
  let failed = false;
  if (open) {
    try {
      data = build();
    } catch {
      failed = true;
    }
  }
  const title = `Статистика за ${new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
    .format(new Date(`${date}T12:00:00Z`))
    .replace(' г.', '')}`;
  let offset = 0;
  return (
    <>
      <Button
        tone="secondary"
        className="quick-report-trigger"
        type="button"
        aria-label="Быстрый отчёт"
        title="Быстрый отчёт"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <Icon name="pie" />
      </Button>
      {/* Новый dialog при открытии сбрасывает прокрутку после смены темы или размера экрана. */}
      <Overlay
        key={open ? 'open' : 'closed'}
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        className={`quick-report ${data?.reference ? 'quick-report-reference' : ''}`}
        trapFocus
      >
        {!data?.reference && (
          <p className="quick-report-scope">
            {scope.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </p>
        )}
        {failed && (
          <Alert>Не удалось составить отчёт: данные некорректны. Обновите страницу.</Alert>
        )}
        {data?.reference && <ReferenceReport data={data} scope={scope} />}
        {data && !data.reference && (
          <>
            <div className="quick-report-top">
              <div>
                <dl className="quick-report-counts">
                  {data.clients !== null && (
                    <div>
                      <dt>Клиентов</dt>
                      <dd>{data.clients}</dd>
                    </div>
                  )}
                  <div>
                    <dt>{data.itemLabel}</dt>
                    <dd>{data.total}</dd>
                  </div>
                </dl>
                <h3>Статусы</h3>
                <dl className="quick-report-statuses">
                  {data.statuses.map((s) => (
                    <div key={s.key}>
                      <dt>
                        <i className={`quick-report-dot--${s.tone}`} aria-hidden="true" />
                        {s.label}
                      </dt>
                      <dd>{s.count}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="quick-report-chart" aria-hidden="true">
                <svg viewBox="0 0 120 120">
                  <circle
                    cx="60"
                    cy="60"
                    r="48"
                    fill="none"
                    stroke="var(--border)"
                    strokeWidth="10"
                  />
                  {data.statuses
                    .filter((s) => s.count > 0)
                    .map((s) => {
                      const length = (s.count / data!.total) * 100;
                      const start = offset;
                      offset += length;
                      return (
                        <circle
                          key={s.key}
                          cx="60"
                          cy="60"
                          r="48"
                          fill="none"
                          stroke={colors[s.tone]}
                          strokeWidth="10"
                          pathLength="100"
                          strokeDasharray={`${length} ${100 - length}`}
                          strokeDashoffset={-start}
                          transform="rotate(-90 60 60)"
                        />
                      );
                    })}
                </svg>
                <div>
                  <strong>{data.total}</strong>
                  <span>{data.itemLabel}</span>
                </div>
              </div>
            </div>
            <section className="quick-report-finance" aria-label="Финансы">
              <h3>Финансы</h3>
              <dl className="quick-report-counts">
                {data.money.map((m) => (
                  <div key={m.label}>
                    <dt>{m.label}</dt>
                    <dd>
                      {Object.keys(m.values).length
                        ? Object.entries(m.values).map(([currency, value]) => (
                            <span key={currency}>{formatMoney(value, currency)}</span>
                          ))
                        : 'Нет операций'}
                    </dd>
                  </div>
                ))}
              </dl>
              {!!data.money.length && (
                <Help title="Как считаются показатели">
                  {data.money.map((m) => (
                    <p key={m.label}>
                      <strong>{m.label}.</strong> {m.hint}
                    </p>
                  ))}
                </Help>
              )}
              <p className="quick-report-note">{data.note}</p>
            </section>
            {data.total === 0 && (
              <p role="status" className="quick-report-empty">
                За выбранный день по этим фильтрам записей нет.
              </p>
            )}
          </>
        )}
      </Overlay>
    </>
  );
}
