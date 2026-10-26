import { Panel, Table } from '../../../../components/ui';
import { LineChart } from '../../../../components/line-chart';
import type { BeautyInsights } from '../../../../lib/api';
import { METHOD_RU, wholeTenge } from '../../../../lib/dashboard-format';
import { Tile, countDelta, moneyDelta, pointsDelta } from '../tiles';
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
 * Пульт салона, вариант B владельца 26.10.2026 («ровная сетка»): шесть главных цифр в ряд, затем карточки одной
 * высоты: выручка по дням, оплаты и клиенты; мастера, услуги и столбец «что сделать сейчас» со статусами записей.
 * Прошлый период может не загрузиться: тогда плитки без сравнения, экран не падает.
 */
export function BeautyPultView({
  p,
  prev,
  labels,
  insights = null,
  prevInsights = null,
  pay = null,
  t = translator('ru'),
}: {
  p: BeautyPult;
  prev: BeautyPult | null;
  labels: Record<string, string>;
  /** день «сегодня» филиала; оставлен для совместимости вызова, график линией его не требует */
  today?: string;
  /** сводка API (оценки, новые и повторные, «давно не были»); null, если не загрузилась: блоки без этих строк */
  insights?: BeautyInsights | null;
  prevInsights?: BeautyInsights | null;
  /** ЗП мастера за месяц из «Зарплаты» (итого начислено, минорные единицы); null, если не загрузилась */
  pay?: Map<string, string> | null;
  t?: Translate;
}) {
  const stars = (tenths: number | null) =>
    tenths === null ? '—' : `${(tenths / 10).toFixed(1).replace('.', ',')} ★`;
  const rating = new Map((insights?.employees ?? []).map((e) => [e.employeeId, e]));
  const money = (minor: string) => wholeTenge(minor, p.currency);
  const compare = prev !== null;
  const base = prev ?? p;
  // «Вернулись»: по истории филиала из сводки API, без неё повторные внутри периода
  const share = (part: number, whole: number) => (whole ? Math.round((part * 100) / whole) : 0);
  const repeatShare = insights
    ? share(insights.customers.repeat, insights.customers.total)
    : share(p.clients.repeat, p.clients.total);
  const prevRepeat = prevInsights
    ? share(prevInsights.customers.repeat, prevInsights.customers.total)
    : share(base.clients.repeat, base.clients.total);
  const statusTotal = Object.values(p.counts).reduce((a, b) => a + b, 0);
  const hasRevenue = p.byDay.some((d) => d.revenueMinor !== '0');
  const tenge = (minor: string) => Number(BigInt(minor) / 100n);
  return (
    <div className="pult" data-testid="pult-beauty">
      <section className="kpi-grid pult-kpis" aria-label={t('Главные цифры периода')}>
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
          label={t('Клиенты вернулись')}
          value={`${repeatShare}%`}
          hint={t('клиентов за период: {n}', { n: p.clients.total })}
          delta={pointsDelta(repeatShare, prevRepeat, base.clients.total)}
          compare={compare}
        />
        <Tile
          id="appointments"
          label={t('Записей')}
          value={String(statusTotal)}
          hint={t('завершено {n}', { n: p.counts['DONE'] ?? 0 })}
          delta={countDelta(
            statusTotal,
            Object.values(base.counts).reduce((a, b) => a + b, 0),
          )}
          compare={compare}
        />
        <Tile
          id="noshow"
          label={t('Неявки')}
          value={String(p.noShow.count)}
          hint={t('{n}% записей', { n: share(p.noShow.count, statusTotal) })}
          delta={countDelta(p.noShow.count, base.noShow.count)}
          inverse
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

      <div className="pult-row pult-row--chart">
        <Panel title={t('Выручка по дням')}>
          {hasRevenue ? (
            // эскиз владельца: линия «этот период» и пунктир «прошлый» по дням с начала отрезка
            <LineChart
              testId="pult-days"
              series={[
                {
                  name: t('Этот период'),
                  values: p.byDay.map((d) => tenge(d.revenueMinor)),
                  summary: money(p.revenueMinor),
                },
                ...(prev
                  ? [
                      {
                        name: t('Прошлый период'),
                        values: prev.byDay.map((d) => tenge(d.revenueMinor)),
                        dashed: true,
                        summary: money(prev.revenueMinor),
                      },
                    ]
                  : []),
              ]}
              labels={p.byDay.map((d) => d.date.slice(8, 10) + '.' + d.date.slice(5, 7))}
              format={(v) => wholeTenge(String(Math.round(v) * 100), p.currency)}
            />
          ) : (
            <p className="pult-empty">{t('Завершённых визитов за период нет.')}</p>
          )}
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
        <Panel title={t('Клиенты')}>
          <Facts
            rows={[
              { label: t('Пришли за период'), value: p.clients.total },
              ...(insights
                ? [
                    {
                      label: t('Новые'),
                      value: insights.customers.new,
                      testId: 'pult-clients-new',
                    },
                    {
                      label: t('Повторные'),
                      value: insights.customers.repeat,
                      testId: 'pult-clients-repeat',
                    },
                    {
                      label: t('Не были больше 45 дней'),
                      value: insights.customers.lapsed,
                      testId: 'pult-clients-lapsed',
                    },
                  ]
                : [{ label: t('Были больше одного раза'), value: p.clients.repeat }]),
              { label: t('Записались онлайн'), value: `${p.onlineShare}%` },
              {
                label: t('Неявки'),
                value: p.noShow.count ? `${p.noShow.count}, ${money(p.noShow.minor)}` : 0,
              },
              { label: t('Не оплачено'), value: p.unpaid.count ? money(p.unpaid.minor) : 0 },
            ]}
          />
        </Panel>
      </div>

      <div className="pult-row pult-row--lists">
        <Panel title={t('Мастера')}>
          {p.masters.length ? (
            // колонки владельца 26.10.2026: выручка, визиты, вернулись (к этому мастеру, с LTV), ЗП, оценка
            <Table className="pult-masters">
              <thead>
                <tr>
                  <th>{t('Мастер')}</th>
                  <th className="num">{t('Выручка')}</th>
                  <th className="num">{t('Визиты')}</th>
                  <th className="num">{t('Вернулись')}</th>
                  <th className="num">{t('ЗП')}</th>
                  <th className="num">{t('Оценка')}</th>
                </tr>
              </thead>
              <tbody>
                {p.masters.map((m) => {
                  const r = rating.get(m.id);
                  const paid = pay?.get(m.id);
                  return (
                    <tr key={m.id} data-testid={`master-${m.id}`}>
                      <td>{m.name}</td>
                      <td className="num">{money(m.revenueMinor)}</td>
                      <td className="num">{m.visits}</td>
                      <td className="num">
                        <span data-testid={`master-${m.id}-returned`}>
                          {r?.customers ? `${share(r.returnedToMaster ?? r.returning, r.customers)}%` : '—'}
                        </span>
                        {r?.customers && r.ltvMinor !== undefined ? (
                          <small className="pult-ltv" data-testid={`master-${m.id}-ltv`}>
                            LTV {money(r.ltvMinor)}
                          </small>
                        ) : null}
                      </td>
                      <td className="num" data-testid={`master-${m.id}-pay`}>
                        {paid !== undefined ? money(paid) : '—'}
                      </td>
                      <td className="num">{stars(r?.avgTenths ?? null)}</td>
                    </tr>
                  );
                })}
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
        <div className="pult-stack">
          <InsightsPanel
            items={beautyInsights(p, insights ? { lapsed: insights.customers.lapsed } : {})}
            money={money}
            t={t}
            words={(x) =>
              x.id === 'idle-slot'
                ? { day: t(String(x.vars?.['day'])), part: t(String(x.vars?.['part'])) }
                : {}
            }
          />
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
        </div>
      </div>
      {insights && insights.reviews.count > 0 && (
        <p className="pult-note" data-testid="pult-rating">
          {t('Средняя оценка за период: {stars}, отзывов {n}', {
            stars: stars(insights.reviews.avgTenths),
            n: insights.reviews.count,
          })}
        </p>
      )}
      <p className="pult-note muted">
        {t(
          'Выручка по цене завершённых записей. Загрузка это занятые часы мастеров от часов по графику. Сравнение с таким же отрезком сразу перед периодом.',
        )}
      </p>
    </div>
  );
}
