'use client';
import { useRef, useState } from 'react';
import { Overlay } from './overlay';
import { Icon } from './icon';
import { Alert, Button, Help, Input } from './ui';
import { formatMoney } from '../lib/money';
import type { QuickReportData } from './quick-report-data';
import './quick-report.css';
import { ReferenceReport } from './quick-report-reference';
import { periodRange, periodTitle, type PeriodKind } from './quick-report-period';

const CHIPS: Array<{ kind: Exclude<PeriodKind, 'custom'>; label: string }> = [
  { kind: 'day', label: 'День' },
  { kind: 'week', label: 'Неделя' },
  { kind: 'month', label: 'Месяц' },
  { kind: 'prevMonth', label: 'Прошлый месяц' },
];

interface ReportPeriod {
  kind: PeriodKind;
  from: string;
  to: string;
}

/** Быстрые периоды отчёта и «Свой период» двумя датами; считает от даты журнала, грузит родитель. */
function QuickReportPeriodBar({
  date,
  period,
  busy,
  onChange,
}: {
  date: string;
  period: ReportPeriod;
  busy: boolean;
  onChange: (next: ReportPeriod) => void;
}) {
  const [from, setFrom] = useState(period.from);
  const [to, setTo] = useState(period.to);
  const customOpen = period.kind === 'custom';
  return (
    <div className="quick-report-period">
      <div className="quick-report-chips" role="group" aria-label="Период отчёта">
        {CHIPS.map((chip) => (
          <button
            key={chip.kind}
            type="button"
            className="quick-report-chip"
            aria-pressed={period.kind === chip.kind}
            disabled={busy}
            onClick={() => onChange({ kind: chip.kind, ...periodRange(chip.kind, date) })}
          >
            {chip.label}
          </button>
        ))}
        <button
          type="button"
          className="quick-report-chip"
          aria-pressed={customOpen}
          disabled={busy}
          onClick={() => onChange({ kind: 'custom', from, to })}
        >
          Свой период
        </button>
      </div>
      {customOpen && (
        <form
          className="quick-report-custom"
          onSubmit={(event) => {
            event.preventDefault();
            onChange({ kind: 'custom', from, to });
          }}
        >
          <label>
            <span>С</span>
            <Input type="date" required value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            <span>По</span>
            <Input type="date" required value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <Button type="submit" tone="secondary" disabled={busy}>
            Показать
          </Button>
        </form>
      )}
    </div>
  );
}

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
  loadPeriod,
  text,
}: {
  /** видимая подпись рядом со значком (журнал салона, аудит 21.10.2026 п. 14); имя кнопки остаётся «Быстрый отчёт» */
  text?: string;
  date: string;
  /** части подписи отчёта, каждая своей строкой, без разделителя-точки (DESIGN.md §14) */
  scope: string[];
  /** без строк строит отчёт дня экрана; со строками периода (`loadPeriod`) считает по ним */
  build: (periodRows?: unknown[]) => QuickReportData;
  /** включает выбор периода: возвращает записи за отрезок или причину отказа */
  loadPeriod?: (from: string, to: string) => Promise<{ rows?: unknown[]; error?: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState<ReportPeriod>({ kind: 'day', from: date, to: date });
  const [periodRows, setPeriodRows] = useState<unknown[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [periodError, setPeriodError] = useState('');
  const request = useRef(0);
  const choose = async (next: ReportPeriod) => {
    const id = ++request.current;
    setPeriod(next);
    setPeriodError('');
    if (next.kind === 'day') {
      setPeriodRows(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const result: { rows?: unknown[]; error?: string } = await loadPeriod!(
      next.from,
      next.to,
    ).catch(() => ({ error: 'Не удалось загрузить записи за период. Повторите попытку.' }));
    if (id !== request.current) return;
    setLoading(false);
    if (result.rows) setPeriodRows(result.rows);
    else {
      setPeriodRows(null);
      setPeriodError(result.error ?? 'Не удалось загрузить записи за период.');
    }
  };
  const inPeriod = period.kind !== 'day';
  let data: QuickReportData | null = null;
  let failed = false;
  if (open && (!inPeriod || periodRows)) {
    try {
      data = build(inPeriod ? (periodRows ?? undefined) : undefined);
    } catch {
      failed = true;
    }
  }
  const title = periodTitle(period.from, period.to);
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
        {text && <span aria-hidden="true">{text}</span>}
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
        {loadPeriod && (
          <QuickReportPeriodBar date={date} period={period} busy={loading} onChange={choose} />
        )}
        {loading && (
          <p role="status" className="quick-report-empty">
            Загружаем записи за период…
          </p>
        )}
        {periodError && <Alert>{periodError}</Alert>}
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
