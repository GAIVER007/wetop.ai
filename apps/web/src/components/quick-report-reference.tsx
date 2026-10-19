import { CircleCheck, Hourglass, CircleMinus } from 'lucide-react';
import { Icon } from './icon';
import { formatMoney } from '../lib/money';
import type { QuickReportData } from './quick-report-data';

function Money({ values }: { values: Record<string, string> | undefined }) {
  if (!values || !Object.keys(values).length) return <>Нет данных</>;
  return (
    <>
      {Object.entries(values).map(([currency, amount]) => (
        <span key={currency}>{formatMoney(amount, currency)}</span>
      ))}
    </>
  );
}

function ReportRow({
  label,
  values,
  hint,
}: {
  label: string;
  values: Record<string, string> | undefined;
  hint: string;
}) {
  return (
    <div className="reference-row">
      <dt>
        <details className="reference-info">
          <summary aria-label={`О показателе: ${label}`}>
            <Icon name="info" />
          </summary>
          <p>{hint}</p>
        </details>
        <span>{label}</span>
      </dt>
      <dd>
        <Money values={values} />
      </dd>
    </div>
  );
}

export function ReferenceReport({ data, scope }: { data: QuickReportData; scope: string[] }) {
  const reference = data.reference!;
  const states = reference.statuses.filter((s) => s.key !== 'NO_SHOW' || s.count > 0);
  const metric = (label: string) => data.money.find((m) => m.label === label);
  const finance = [
    ['Средний чек', 'Средняя стоимость завершённой записи'],
    ['Выручка (за один день)', 'Сумма завершённых услуг'],
    ['Оплата наличными', 'Оплата наличными'],
    ['Оплата безналом', 'Оплата безналом'],
  ] as const;
  const unsupported =
    'Источник этого показателя пока не подключён к записям. Отсутствие данных не означает нулевую сумму.';
  let offset = 0;
  return (
    <>
      <p className="reference-scope">
        {scope.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </p>
      <div className="quick-report-top">
        <div>
          <dl className="quick-report-counts">
            <div>
              <dt>Клиентов</dt>
              <dd>{data.clients}</dd>
            </div>
            <div>
              <dt>Записей</dt>
              <dd>{data.total}</dd>
            </div>
          </dl>
          <h3>Статус записи:</h3>
          <dl className="quick-report-statuses">
            {states.map((s) => (
              <div key={s.key}>
                <dt>
                  <span
                    className={`reference-status reference-status--${s.tone}`}
                    aria-hidden="true"
                  >
                    {s.key === 'DONE' ? (
                      <CircleCheck />
                    ) : s.key === 'WAITING' ? (
                      <Hourglass />
                    ) : (
                      <CircleMinus />
                    )}
                  </span>
                  {s.label}
                </dt>
                <dd>{s.count}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="quick-report-chart" aria-hidden="true">
          <svg viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="48" fill="none" stroke="var(--border)" strokeWidth="10" />
            {states
              .filter((s) => s.count > 0)
              .map((s) => {
                const length = (s.count / data.total) * 100;
                const start = offset;
                offset += length;
                return (
                  <circle
                    key={s.key}
                    cx="60"
                    cy="60"
                    r="48"
                    fill="none"
                    stroke={`var(--${s.tone === 'neutral' ? 'text-2' : s.tone})`}
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
            <span>Записей</span>
          </div>
        </div>
      </div>
      <dl className="reference-total quick-report-counts">
        <div>
          <dt>Общая сумма всех записей:</dt>
          <dd>
            <Money values={reference.totalPrices} />
          </dd>
        </div>
      </dl>
      <section className="reference-section" aria-label="Финансы">
        <h3>Финансы:</h3>
        <dl className="quick-report-counts">
          {finance.map(([label, source]) => (
            <ReportRow
              key={label}
              label={label}
              values={metric(source)?.values}
              hint={
                metric(source)?.hint ??
                'Оплаты выбранных записей за всё время. Безнал включает карты и переводы. Возвраты не вычитаются из способа оплаты.'
              }
            />
          ))}
          {metric('Возвращено по записям') && (
            <ReportRow
              label="Возвраты"
              values={metric('Возвращено по записям')?.values}
              hint={metric('Возвращено по записям')!.hint}
            />
          )}
        </dl>
      </section>
      <section className="reference-section" aria-label="Лояльность">
        <h3>Лояльность:</h3>
        <dl className="quick-report-counts">
          {['Бонусная карта', 'Скидка (сумма)', 'Сертификаты (сумма)', 'Абонементы'].map(
            (label) => (
              <ReportRow
                key={label}
                label={label}
                values={label === 'Скидка (сумма)' ? metric('Скидки на услуги')?.values : undefined}
                hint={label === 'Скидка (сумма)' ? metric('Скидки на услуги')?.hint ?? unsupported : unsupported}
              />
            ),
          )}
        </dl>
      </section>
      <section className="reference-section" aria-label="WETOP">
        <h3>WETOP:</h3>
        <dl className="quick-report-counts">
          {['Онлайн оплата', 'Сертификат от WETOP', 'Подарочная карта от WETOP', 'Предоплата'].map(
            (label) => (
              <ReportRow key={label} label={label} values={undefined} hint={unsupported} />
            ),
          )}
        </dl>
      </section>
      {data.total === 0 && (
        <p role="status" className="sr-only">
          За выбранный день по этим фильтрам записей нет.
        </p>
      )}
    </>
  );
}
