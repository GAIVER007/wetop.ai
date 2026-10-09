import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import {
  AGENT_STATUS_WORDS,
  CHANNEL_LABELS,
  channelWord,
  formatOccupancy,
  formatPoints,
  type AgentChannel,
} from '@pms/domain';
import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';
import { hotelToday } from '../../lib/hotel-api';
import {
  marketApi,
  salesApi,
  sellerApi,
  type AgentCardView,
  type MarketView,
  type SalesSummary,
  type SellerStatus,
  type SellerSummary,
} from '../../lib/api';
import { deltaPoints } from '../../lib/dashboard-format';
import { displayDate } from '../../lib/display-date';
import { formatMoney } from '../../lib/money';
import { pluralRu } from '../../lib/plural';
import { requireVertical } from '../../lib/vertical-guard';
import { deskShell } from '../../lib/desk-shell';
import { mayAccess } from '../../lib/navigation';
import { sellerBanner, sellerConnected } from '../../lib/ai-seller';
import {
  competitorsFreshness,
  conversionText,
  countDelta,
  moneyDelta,
  salesPeriod,
} from '../../lib/sales';
import { Page } from '../../components/page';
import { Icon } from '../../components/icon';
import { DateInput } from '../../components/date-field';
import { Alert, Badge, Button, Field, Panel, SectionTitle, Stack, Stat, Stats } from '../../components/ui';
import './sales.css';

/**
 * Хаб «Продажи» (SALES2.2, `plans/sales2-audit-2026-10-09.md`): один вход к «Загрузке конкурентов» и ИИ-продавцу и
 * шесть чисел. Хаб ничего не придумывает: число берётся из того API, что и целевой экран, а у чего источника нет,
 * там знак пропуска и причина, не ноль. Диалоги бот считает за последние сутки (период для них выбрать нельзя,
 * и подпись это говорит); брони, конверсия и выручка идут по выбранному периоду и только по броням из диалогов
 * бота (`seller_booking_intents`). Филиал выбирает общий переключатель в шапке.
 */
const settle = <T,>(promise: Promise<T>) =>
  promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => {
      unstable_rethrow(error);
      return { ok: false as const };
    },
  );

const DASH = '–';
const range = (p: { from: string; to: string }) =>
  p.from === p.to ? displayDate(p.from) : `${displayDate(p.from)} → ${displayDate(p.to)}`;

export default async function SalesHubPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireVertical(['HOSPITALITY']);
  const sp = normalizeSearchParams(await searchParams);
  const today = await hotelToday();
  const period = salesPeriod({ days: sp.days, from: sp.from, to: sp.to }, today);
  const { access } = await deskShell();
  const status = await settle(sellerApi.status());
  // продавец с вышедшим сроком читаются, без расширения нет; не подключённый к платформе боту не звонят
  const botReadable =
    status.ok && sellerConnected(status.value) && status.value.state !== 'extension-off';
  const [summary, bot, needsHuman, catalog, market] = await Promise.all([
    settle(salesApi.summary(period.from, period.to)),
    botReadable ? settle(sellerApi.summary()) : null,
    botReadable ? settle(sellerApi.conversations('needs_human')) : null,
    status.ok && status.value.state !== 'extension-off' ? settle(sellerApi.catalog()) : null,
    // ближайшие две недели: тот же расчёт, что на экране «Загрузка конкурентов» (внесённые данные, а не измеренная загрузка)
    settle(marketApi.occupancy({ from: today, days: 14, compare: 0 })),
  ]);
  const sales = summary.ok ? summary.value : null;
  const dialogs = bot?.ok ? bot.value : null;
  const humanCount = needsHuman?.ok ? needsHuman.value.items.length : null;
  const seller = catalog?.ok ? (catalog.value.agents.find((a) => a.kind === 'seller') ?? null) : null;
  const configure = mayAccess(access, 'seller');

  const periodHint = range(period);
  const noSeller = !botReadable ? 'ИИ-продавец не подключён' : undefined;
  const cur = sales?.revenue.currency ?? 'KZT';
  const conversion = sales ? conversionText(sales.conversionPermille.current) : null;
  const conversionDelta =
    sales && sales.conversionPermille.current !== null && sales.conversionPermille.previous !== null
      ? deltaPoints(sales.conversionPermille.current / 10, sales.conversionPermille.previous / 10)
      : undefined;
  const fresh = sales ? competitorsFreshness(sales.competitors, today) : null;

  return (
    <Page
      title="Продажи"
      subtitle="Анализируйте рынок, управляйте ИИ-продавцом и увеличивайте прямые бронирования."
    >
      <Stack>
        <section className="sales-period" aria-label="Период" data-testid="sales-period">
          <form method="get" className="sales-period__form">
            <Field inline label="С">
              <DateInput key={`from-${period.from}`} name="from" defaultValue={period.from} aria-label="Период: с" />
            </Field>
            <Field inline label="По">
              <DateInput
                key={`to-${period.to}`}
                name="to"
                rangeFromName="from"
                defaultValue={period.to}
                aria-label="Период: по"
              />
            </Field>
            <nav className="chips sales-period__chips" aria-label="Готовые периоды">
              <Link href="/sales?days=7" aria-current={period.preset === '7' ? 'page' : undefined}>
                7 дней
              </Link>
              <Link href="/sales?days=30" aria-current={period.preset === '30' ? 'page' : undefined}>
                30 дней
              </Link>
            </nav>
            <Button tone="secondary">Показать</Button>
          </form>
        </section>

        {!sales && (
          <Alert tone="warning" role="alert" data-testid="sales-summary-error">
            Не удалось посчитать брони и конкурентов. Остальные карточки показаны как есть, обновите страницу.
          </Alert>
        )}

        <Stats min={200} data-testid="sales-kpis">
          <Stat
            label="Диалоги за 24 часа"
            testId="sales-kpi-dialogs"
            value={dialogs ? String(dialogs.dialogs) : DASH}
            hint={dialogs ? `${dialogs.leads} с контактом` : (noSeller ?? 'Нет данных от продавца')}
            href="/ai-seller/dialogs"
          />
          <Stat
            label="Нужен человек"
            testId="sales-kpi-human"
            tone={humanCount ? 'warning' : 'neutral'}
            value={humanCount === null ? DASH : String(humanCount)}
            hint={humanCount === null ? (noSeller ?? 'Нет данных от продавца') : 'диалогов ждут оператора'}
            href="/ai-seller/dialogs?mode=needs_human"
          />
          <Stat
            label="Брони из диалогов"
            testId="sales-kpi-bookings"
            value={sales ? String(sales.bookings.current) : DASH}
            hint={periodHint}
            {...(sales ? { delta: countDelta(sales.bookings.current, sales.bookings.previous) } : {})}
            href="/ai-seller/dialogs"
          />
          <Stat
            label="Конверсия предложений"
            testId="sales-kpi-conversion"
            value={conversion ?? DASH}
            hint={
              !sales
                ? 'Нет данных'
                : conversion === null
                  ? 'За период бот не делал предложений'
                  : `${sales.bookings.current} из ${sales.offers.current} предложений`
            }
            {...(conversionDelta ? { delta: conversionDelta } : {})}
            href="/ai-seller/dialogs"
          />
          <Stat
            label="Выручка связанных броней"
            testId="sales-kpi-revenue"
            value={sales ? formatMoney(sales.revenue.currentMinor, cur) : DASH}
            hint={sales ? 'без отменённых и незаездов' : 'Нет данных'}
            {...(sales ? { delta: moneyDelta(sales.revenue.currentMinor, sales.revenue.previousMinor) } : {})}
            href="/reservations"
          />
          <Stat
            label="Конкуренты под наблюдением"
            testId="sales-kpi-competitors"
            value={sales ? String(sales.competitors.count) : DASH}
            hint={
              !fresh || !sales
                ? 'Нет данных'
                : fresh.state === 'empty'
                  ? 'Добавьте первого конкурента'
                  : fresh.state === 'none'
                    ? 'Снимков загрузки ещё нет'
                    : `обновлено ${displayDate(sales.competitors.lastObservedOn ?? today)}`
            }
            hintTone={fresh?.state === 'stale' ? 'warn' : undefined}
            href="/market"
          />
        </Stats>

        <div className="sales-modules">
          <CompetitorsCard sales={sales} today={today} market={market.ok ? market.value : null} />
          <SellerCard
            status={status.ok ? status.value : null}
            seller={seller}
            dialogs={dialogs}
            humanCount={humanCount}
            sales={sales}
            configure={configure}
            botReadable={botReadable}
          />
        </div>
      </Stack>
    </Page>
  );
}

const pct = (bp: number | null | undefined) =>
  bp === null || bp === undefined ? DASH : formatOccupancy(Math.round(bp / 100) * 100);

function CompetitorsCard({
  sales,
  today,
  market,
}: {
  sales: SalesSummary | null;
  today: string;
  market: MarketView | null;
}) {
  const board = market?.board.summary ?? null;
  const fresh = sales ? competitorsFreshness(sales.competitors, today) : null;
  return (
    <Panel className="sales-module" aria-labelledby="sales-market-title" data-testid="sales-card-market">
      <div className="sales-module__head">
        <span className="sales-module__icon" aria-hidden="true">
          <Icon name="analytics" />
        </span>
        <SectionTitle first id="sales-market-title">
          Загрузка конкурентов
        </SectionTitle>
      </div>
      <p className="sales-module__text">
        Загрузка ближайших отелей рядом с вашей на каждую ночь и подсказки к цене. Данные вносит человек или
        разрешённый источник, пометка источника видна в таблице.
      </p>
      <dl className="sales-facts">
        <div>
          <dt>Под наблюдением</dt>
          <dd>
            {sales
              ? pluralRu(sales.competitors.count, ['конкурент', 'конкурента', 'конкурентов'])
              : DASH}
          </dd>
        </div>
        <div>
          <dt>Последнее обновление</dt>
          <dd>
            {!sales || !fresh
              ? DASH
              : fresh.state === 'fresh' || fresh.state === 'stale'
                ? displayDate(sales.competitors.lastObservedOn ?? today)
                : 'ещё не вносили'}
            {fresh?.state === 'stale' && <Badge tone="warn">данные устарели</Badge>}
          </dd>
        </div>
        <div>
          <dt>Рынок, 14 ночей</dt>
          <dd data-testid="sales-market-bp">{pct(board?.marketBp)}</dd>
        </div>
        <div>
          <dt>Ваша загрузка</dt>
          <dd>{pct(board?.ownBp)}</dd>
        </div>
        <div>
          <dt>Разница с рынком</dt>
          <dd>{board?.gapBp === null || board?.gapBp === undefined ? DASH : formatPoints(Math.round(board.gapBp / 100) * 100)}</dd>
        </div>
        <div>
          <dt>Ночей высокого спроса</dt>
          <dd>{board ? board.highDemandNights : DASH}</dd>
        </div>
      </dl>
      <p className="sales-module__note">
        Рынок это среднее по внесённым данным конкурентов, а не измеренная загрузка отелей.
      </p>
      <div className="sales-module__foot">
        <Link className="btn" href="/market">
          Открыть аналитику
        </Link>
        <Link className="btn btn--secondary" href="/market?add=1">
          Добавить конкурента
        </Link>
      </div>
    </Panel>
  );
}

function SellerCard({
  status,
  seller,
  dialogs,
  humanCount,
  sales,
  configure,
  botReadable,
}: {
  status: SellerStatus | null;
  seller: AgentCardView | null;
  dialogs: SellerSummary | null;
  humanCount: number | null;
  sales: SalesSummary | null;
  configure: boolean;
  botReadable: boolean;
}) {
  const banner = status ? sellerBanner(status) : null;
  const off = status?.state === 'extension-off';
  return (
    <Panel className="sales-module" aria-labelledby="sales-seller-title" data-testid="sales-card-seller">
      <div className="sales-module__head">
        <span className="sales-module__icon" aria-hidden="true">
          <Icon name="chat" />
        </span>
        <SectionTitle first id="sales-seller-title">
          ИИ-продавец
        </SectionTitle>
        {seller ? (
          <Badge tone={seller.status === 'WORKING' ? 'ok' : 'warn'} data-testid="sales-seller-status">
            {AGENT_STATUS_WORDS[seller.status]}
          </Badge>
        ) : banner ? (
          <Badge tone={banner.tone === 'calm' ? 'ok' : 'warn'} data-testid="sales-seller-status">
            {banner.value}
          </Badge>
        ) : null}
      </div>
      <p className="sales-module__text">
        Отвечает гостям на сайте и в WhatsApp, проверяет наличие и цену, оформляет бронь после явного «да» гостя и
        зовёт человека, когда нужно.
      </p>
      {off ? (
        <Alert>
          Расширение «ИИ-продавец» не подключено. Подключает администратор WETOP после оплаты по счёту.
        </Alert>
      ) : !status ? (
        <Alert tone="warning" role="alert">
          Не удалось получить состояние продавца.
        </Alert>
      ) : (
        <dl className="sales-facts">
          <div>
            <dt>Каналы</dt>
            <dd data-testid="sales-seller-channels">
              {seller?.channels
                ? (['site', 'whatsapp'] as AgentChannel[])
                    .map((c) => `${CHANNEL_LABELS[c]}: ${channelWord(c, seller.channels![c]).toLowerCase()}`)
                    .join(', ')
                : DASH}
            </dd>
          </div>
          <div>
            <dt>Диалоги за 24 часа</dt>
            <dd>{dialogs ? dialogs.dialogs : DASH}</dd>
          </div>
          <div>
            <dt>Лиды с контактом</dt>
            <dd>{dialogs ? dialogs.leads : DASH}</dd>
          </div>
          <div>
            <dt>Брони за период</dt>
            <dd>{sales ? sales.bookings.current : DASH}</dd>
          </div>
          <div>
            <dt>Ждут оператора</dt>
            <dd>{humanCount === null ? DASH : humanCount}</dd>
          </div>
          <div>
            <dt>Ответ опоздал</dt>
            <dd>{dialogs ? dialogs.slaBreaches : DASH}</dd>
          </div>
        </dl>
      )}
      {status?.lastError && (
        <Alert tone="warning" data-testid="sales-seller-error">
          Последняя ошибка продавца: {status.lastError}
        </Alert>
      )}
      <div className="sales-module__foot">
        {botReadable && (
          <Link className="btn" href="/ai-seller/dialogs">
            Открыть
          </Link>
        )}
        {configure && (
          <Link className={botReadable ? 'btn btn--secondary' : 'btn'} href={off ? '/ai-agents' : '/ai-seller'}>
            {off ? 'Подробнее' : 'Настроить'}
          </Link>
        )}
      </div>
    </Panel>
  );
}
