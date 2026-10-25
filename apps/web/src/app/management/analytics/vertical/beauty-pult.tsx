import { Panel, Table } from '../../../../components/ui';
import { DayBars } from '../../../../components/day-bars';
import { METHOD_RU, wholeTenge } from '../../../../lib/dashboard-format';
import { Tile, moneyDelta, pointsDelta } from '../tiles';
import { msg, translator, type Translate } from '../../../../i18n';
import { Facts, InsightsPanel, ShareList } from './pult-view';
import { moneyText } from './metrics';
import { beautyInsights, type BeautyPult } from './pult';

/** Тон статуса записи в полоске: тот же, что у бейджей журнала */
const TONES = {
  BOOKED: 'info',
  CONFIRMED: 'info',
  IN_PROGRESS: 'warning',
  DONE: 'success',
  NO_SHOW: 'danger',
  CANCELLED: 'neutral',
} as const;

/**
 * Пульт салона (вариант A, решение владельца 25.10.2026): четыре главные цифры со сравнением, выручка по дням и
 * подсказки рядом, ниже записи, клиенты, оплаты, мастера и услуги. Прошлый период может не загрузиться: тогда
 * плитки без сравнения, экран не падает.
 */
export function BeautyPultView({
  p,
  prev,
  labels,
  today,
  t = translator('ru'),
}: {
  p: BeautyPult;
  prev: BeautyPult | null;
  labels: Record<string, string>;
  today: string;
  t?: Translate;
}) {
  const money = (minor: string) => wholeTenge(minor, p.currency);
  const compare = prev !== null;
  const base = prev ?? p;
  const repeatShare = p.clients.total ? Math.round((p.clients.repeat * 100) / p.clients.total) : 0;
  const prevRepeat = base.clients.total
    ? Math.round((base.clients.repeat * 100) / base.clients.total)
    : 0;
  const statusTotal = Object.values(p.counts).reduce((a, b) => a + b, 0);
  const maxDay = p.byDay.reduce(
    (m, d) => (BigInt(d.revenueMinor) > m ? BigInt(d.revenueMinor) : m),
    0n,
  );
  return (
    <div className="pult" data-testid="pult-beauty">
      <section className="kpi-grid" aria-label={t('Главные цифры периода')}>
        <Tile
          id="revenue"
          label={t('Выручка')}
          value={money(p.revenueMinor)}
          hint={t('завершённые визиты по цене записи')}
          delta={moneyDelta(p.revenueMinor, base.revenueMinor)}
          compare={compare}
        />
        <Tile
          id="average"
          label={t('Средний чек')}
          value={p.averageMinor ? money(p.averageMinor) : '—'}
          hint={t('визитов: {n}', { n: p.visits })}
          delta={moneyDelta(p.averageMinor, base.averageMinor)}
          compare={compare}
        />
        <Tile
          id="load"
          label={t('Загрузка мастеров')}
          value={`${p.loadPercent}%`}
          hint={t('занятые часы от рабочих по графику')}
          delta={pointsDelta(p.loadPercent, base.loadPercent, base.visits)}
          compare={compare && prev!.loadPercent > 0}
        />
        <Tile
          id="repeat"
          label={t('Повторные клиенты')}
          value={`${repeatShare}%`}
          hint={t('клиентов за период: {n}', { n: p.clients.total })}
          delta={pointsDelta(repeatShare, prevRepeat, base.clients.total)}
          compare={compare}
        />
      </section>
      {/* точная сумма с копейками для сверки проверками UI (MV9), глазу хватает плитки */}
      <p className="sr-only" data-testid={`revenue-${p.currency}`}>
        {moneyText(p.revenueMinor, p.currency)}
      </p>
      {p.otherCurrencies.length > 0 && (
        <p className="pult-note muted">
          {t('Записи в других валютах в итоги не входят: {list}.', {
            list: p.otherCurrencies.join(', '),
          })}
        </p>
      )}

      <div className="pult-row pult-row--main">
        <Panel title={t('Выручка по дням')}>
          {maxDay > 0n ? (
            <DayBars
              testId="pult-days"
              today={today}
              days={p.byDay.map((d) => ({
                date: d.date,
                height: Number((BigInt(d.revenueMinor) * 100n) / maxDay),
                facts: t('{sum}, визитов {n}', { sum: money(d.revenueMinor), n: d.visits }),
              }))}
            />
          ) : (
            <p className="pult-empty">{t('Завершённых визитов за период нет.')}</p>
          )}
        </Panel>
        <InsightsPanel items={beautyInsights(p)} money={money} t={t} />
      </div>

      <div className="pult-row pult-row--three">
        <Panel title={t('Записи по статусам, всего {n}', { n: statusTotal })}>
          <ShareList
            t={t}
            empty={msg('Записей за период нет.')}
            rows={Object.entries(labels).map(([status, label]) => ({
              key: status,
              label: t(label),
              value: p.counts[status] ?? 0,
              text: p.counts[status] ?? 0,
              tone: TONES[status as keyof typeof TONES] ?? 'neutral',
              testId: `period-${status}`,
            }))}
          />
          {statusTotal === 0 && (
            <ul className="sr-only">
              {Object.keys(labels).map((status) => (
                <li key={status} data-testid={`period-${status}`}>
                  0
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title={t('Клиенты')}>
          <Facts
            rows={[
              { label: t('Пришли за период'), value: p.clients.total },
              { label: t('Были больше одного раза'), value: p.clients.repeat },
              { label: t('Записались онлайн'), value: `${p.onlineShare}%` },
              {
                label: t('Неявки'),
                value: p.noShow.count ? `${p.noShow.count}, ${money(p.noShow.minor)}` : 0,
              },
              { label: t('Не оплачено'), value: p.unpaid.count ? money(p.unpaid.minor) : 0 },
            ]}
          />
        </Panel>
        <Panel title={t('Оплаты по способам')}>
          <ShareList
            t={t}
            empty={msg('Оплат за период нет.')}
            rows={p.payments.map((x) => ({
              key: x.method,
              label: t(METHOD_RU[x.method] ?? x.method),
              value: Number(BigInt(x.amountMinor) / 100n),
              text: money(x.amountMinor),
            }))}
          />
        </Panel>
      </div>

      <div className="pult-row pult-row--two">
        <Panel title={t('Мастера')}>
          {p.masters.length ? (
            <Table>
              <thead>
                <tr>
                  <th>{t('Мастер')}</th>
                  <th className="num">{t('Выручка')}</th>
                  <th className="num">{t('Визиты')}</th>
                  <th className="num">{t('Загрузка')}</th>
                </tr>
              </thead>
              <tbody>
                {p.masters.map((m) => (
                  <tr key={m.id} data-testid={`master-${m.id}`}>
                    <td>{m.name}</td>
                    <td className="num">{money(m.revenueMinor)}</td>
                    <td className="num">{m.visits}</td>
                    <td className="num">{m.loadPercent}%</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <p className="pult-empty">{t('Мастеров с графиком за период нет.')}</p>
          )}
        </Panel>
        <Panel title={t('Услуги по выручке')}>
          <ShareList
            t={t}
            empty={msg('Завершённых визитов за период нет.')}
            rows={p.services.map((x) => ({
              key: x.name,
              label: `${x.name}, ${x.count}`,
              value: Number(BigInt(x.revenueMinor) / 100n),
              text: money(x.revenueMinor),
            }))}
          />
        </Panel>
      </div>
      <p className="pult-note muted">
        {t(
          'Выручка по цене завершённых записей. Загрузка это занятые часы мастеров от часов по графику. Сравнение с таким же отрезком сразу перед периодом.',
        )}
      </p>
    </div>
  );
}
