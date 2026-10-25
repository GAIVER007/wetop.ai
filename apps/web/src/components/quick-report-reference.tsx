import { CircleCheck, Hourglass, CircleMinus } from 'lucide-react';
import { msg } from '../i18n';
import { useT } from '../i18n/locale-provider';
import { Icon } from './icon';
import { formatMoney } from '../lib/money';
import type { QuickReportData } from './quick-report-data';

function Money({ values }: { values: Record<string, string> | undefined }) {
  const t = useT();
  if (!values || !Object.keys(values).length) return <>{t('Нет данных')}</>;
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
  const t = useT();
  return (
    <div className="reference-row">
      <dt>
        <details className="reference-info">
          <summary aria-label={t('О показателе: {label}', { label: t(label) })}>
            <Icon name="info" />
          </summary>
          <p>{t(hint)}</p>
        </details>
        <span>{t(label)}</span>
      </dt>
      <dd>
        <Money values={values} />
      </dd>
    </div>
  );
}

export function ReferenceReport({ data, scope }: { data: QuickReportData; scope: string[] }) {
  const t = useT();
  const reference = data.reference!;
  const states = reference.statuses.filter((s) => s.key !== 'NO_SHOW' || s.count > 0);
  const metric = (label: string) => data.money.find((m) => m.label === label);
  const revenue = metric('Сумма завершённых услуг'); // kk-allow: сверка с подписью показателя из quick-report-data (русский ключ данных)
  const average = metric('Средняя стоимость завершённой записи'); // kk-allow: сверка с подписью показателя из quick-report-data (русский ключ данных)
  const refunds = metric('Возвращено по записям'); // kk-allow: сверка с подписью показателя из quick-report-data (русский ключ данных)
  const discounts = metric('Скидки на услуги'); // kk-allow: сверка с подписью показателя из quick-report-data (русский ключ данных)
  const discountLabel = msg('Скидка (сумма)');
  const finance = [
    [msg('Оплата наличными'), msg('Оплата наличными')],
    [msg('Оплата безналом'), msg('Оплата безналом')],
  ] as const;
  const unsupported = msg(
    'Источник этого показателя пока не подключён к записям. Отсутствие данных не означает нулевую сумму.',
  );
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
              <dt>{t('Клиентов')}</dt>
              <dd>{data.clients}</dd>
            </div>
            <div>
              <dt>{t('Записей')}</dt>
              <dd>{data.total}</dd>
            </div>
          </dl>
          <h3>{t('Статус записи:')}</h3>
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
                  {t(s.label)}
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
            <span>{t('Записей')}</span>
          </div>
        </div>
      </div>
      <dl className="reference-kpis" aria-label={t('Итоги')}>
        <div>
          <dt>{t('Сумма записей')}</dt>
          <dd>
            <Money values={reference.totalPrices} />
          </dd>
        </div>
        <div>
          <dt>{t('Выручка')}</dt>
          <dd>
            <Money values={revenue?.values} />
          </dd>
        </div>
        <div>
          <dt>{t('Средний чек')}</dt>
          <dd>
            <Money values={average?.values} />
          </dd>
        </div>
      </dl>
      <section className="reference-section" aria-label={t('Финансы')}>
        <h3>{t('Финансы:')}</h3>
        <dl className="quick-report-counts">
          {finance.map(([label, source]) => (
            <ReportRow
              key={label}
              label={label}
              values={metric(source)?.values}
              hint={
                metric(source)?.hint ??
                msg(
                  'Оплаты выбранных записей за всё время. Безнал включает карты и переводы. Возвраты не вычитаются из способа оплаты.',
                )
              }
            />
          ))}
          {refunds && (
            <ReportRow
              label={msg('Возвраты')}
              values={refunds.values}
              hint={refunds.hint}
            />
          )}
        </dl>
      </section>
      <details className="reference-more">
        <summary>{t('Лояльность и WETOP')}</summary>
      <section className="reference-section" aria-label={t('Лояльность')}>
        <h3>{t('Лояльность:')}</h3>
        <dl className="quick-report-counts">
          {[msg('Бонусная карта'), discountLabel, msg('Сертификаты (сумма)'), msg('Абонементы')].map(
            (label) => (
              <ReportRow
                key={label}
                label={label}
                values={label === discountLabel ? discounts?.values : undefined}
                hint={label === discountLabel ? (discounts?.hint ?? unsupported) : unsupported}
              />
            ),
          )}
        </dl>
      </section>
      <section className="reference-section" aria-label="WETOP">
        <h3>WETOP:</h3>
        <dl className="quick-report-counts">
          {[msg('Онлайн оплата'), msg('Сертификат от WETOP'), msg('Подарочная карта от WETOP'), msg('Предоплата')].map(
            (label) => (
              <ReportRow key={label} label={label} values={undefined} hint={unsupported} />
            ),
          )}
        </dl>
      </section>
      </details>
      {data.total === 0 && (
        <p role="status" className="sr-only">
          {t('За выбранный период по этим фильтрам записей нет.')}
        </p>
      )}
    </>
  );
}
