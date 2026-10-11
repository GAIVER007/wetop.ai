import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import { formatOccupancy, formatPoints } from '@pms/domain';
import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';
import { hotelToday } from '../../lib/hotel-api';
import {
  marketApi,
  salesApi,
  sellerApi,
  type MarketInsight,
  type MarketView,
} from '../../lib/api';
import { deltaPoints, type Delta } from '../../lib/dashboard-format';
import { requireVertical } from '../../lib/vertical-guard';
import { sellerConnected } from '../../lib/ai-seller';
import { conversionText, competitorsFreshness, salesPeriod } from '../../lib/sales';
import { Page } from '../../components/page';
import { Icon, type IconName } from '../../components/icon';
import { KpiTile } from '../../components/kpi-tile';
import { Alert, Panel, cx } from '../../components/ui';
import { insightText } from '../market/insight-text';
import './sales.css';

/**
 * Хаб «Продажи» по макету владельца 09.10.2026 (экран 1): шесть плиток, три карточки (конкуренты, ИИ-продавец,
 * рекомендации). Хаб ничего не придумывает: число берётся оттуда же, откуда у экрана модуля, у чего источника нет, там
 * знак пропуска и причина. Рынок это среднее по внесённым данным конкурентов, а не измеренная загрузка отелей.
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
const NIGHTS = 14;
const pct = (bp: number | null | undefined) =>
  bp === null || bp === undefined ? DASH : formatOccupancy(Math.round(bp / 100) * 100);
const minusDays = (iso: string, n: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);

export default async function SalesHubPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireVertical(['HOSPITALITY']);
  const sp = normalizeSearchParams(await searchParams);
  const today = await hotelToday();
  const period = salesPeriod({ days: sp.days, from: sp.from, to: sp.to }, today);
  const status = await settle(sellerApi.status());
  const botReadable =
    status.ok && sellerConnected(status.value) && status.value.state !== 'extension-off';
  const [summary, bot, needsHuman, market, weekAgo] = await Promise.all([
    settle(salesApi.summary(period.from, period.to)),
    botReadable ? settle(sellerApi.summary()) : null,
    botReadable ? settle(sellerApi.conversations('needs_human')) : null,
    settle(marketApi.occupancy({ from: today, days: NIGHTS, compare: 0 })),
    // те же ночи по данным недельной давности: изменение средней рынка «за 7 дней»
    settle(marketApi.occupancy({ from: today, days: NIGHTS, compare: 0, asOf: minusDays(today, 7) })),
  ]);
  const sales = summary.ok ? summary.value : null;
  const dialogs = bot?.ok ? bot.value : null;
  const humanCount = needsHuman?.ok ? needsHuman.value.items.length : null;
  const board = market.ok ? market.value.board : null;
  const boardWeek = weekAgo.ok ? weekAgo.value.board : null;
  const noSeller = !botReadable ? 'ИИ-продавец не подключён' : 'Нет данных от продавца';

  const marketDelta: Delta | undefined =
    board?.summary.marketBp != null && boardWeek?.summary.marketBp != null
      ? deltaPoints(board.summary.marketBp / 100, boardWeek.summary.marketBp / 100)
      : undefined;
  const gap = board?.summary.gapBp ?? null;
  const gapDelta: Delta | undefined =
    gap === null ? undefined : { direction: gap > 0 ? 'up' : gap < 0 ? 'down' : 'flat', text: formatPoints(Math.round(gap / 100) * 100) };
  const conversion = sales ? conversionText(sales.conversionPermille.current) : null;
  const conversionDelta: Delta | undefined =
    sales && sales.conversionPermille.current !== null && sales.conversionPermille.previous !== null
      ? deltaPoints(sales.conversionPermille.current / 10, sales.conversionPermille.previous / 10)
      : undefined;
  const added = sales?.competitors.addedLast30 ?? 0;
  const fresh = sales ? competitorsFreshness(sales.competitors, today) : null;

  return (
    <Page
      title="Продажи"
      subtitle="Инструменты роста, анализа рынка и ИИ-продаж в одном разделе."
      actions={
        <nav className="chips sales-chips" aria-label="Период броней и конверсии" data-testid="sales-period">
          <Link href="/sales?days=7" aria-current={period.preset === '7' ? 'page' : undefined}>
            7 дней
          </Link>
          <Link href="/sales?days=30" aria-current={period.preset === '30' ? 'page' : undefined}>
            30 дней
          </Link>
        </nav>
      }
    >
      <div className="sales-hub">
        {!sales && (
          <Alert tone="warning" role="alert" data-testid="sales-summary-error">
            Не удалось посчитать брони и конкурентов. Остальное показано как есть, обновите страницу.
          </Alert>
        )}

        <div className="kpi-row" data-testid="sales-kpis">
          <KpiTile
            icon="channels"
            label="Конкурентов в отслеживании"
            testId="sales-kpi-competitors"
            value={sales ? String(sales.competitors.count) : DASH}
            delta={added > 0 ? { direction: 'up', text: `+${added}` } : undefined}
            caption={
              !sales || !fresh
                ? 'Нет данных'
                : added > 0
                  ? 'с прошлого месяца'
                  : fresh.state === 'empty'
                    ? 'добавьте первого конкурента'
                    : fresh.state === 'none'
                      ? 'снимков загрузки ещё нет'
                      : `обновлено ${sales.competitors.lastObservedOn?.slice(8, 10)}.${sales.competitors.lastObservedOn?.slice(5, 7)}`
            }
            href="/market"
          />
          <KpiTile
            icon="analytics"
            label="Средняя загрузка рынка"
            testId="sales-kpi-market"
            value={pct(board?.summary.marketBp)}
            delta={marketDelta}
            caption={board ? (marketDelta ? 'за последние 7 дней' : 'по внесённым данным') : 'Нет данных'}
            href="/market"
          />
          <KpiTile
            icon="board"
            label="Ваша загрузка vs рынок"
            testId="sales-kpi-own"
            value={pct(board?.summary.ownBp)}
            delta={gapDelta}
            caption={
              gap === null
                ? board
                  ? 'нет данных конкурентов'
                  : 'Нет данных'
                : gap === 0
                  ? 'вровень с рынком'
                  : `${gap > 0 ? 'выше' : 'ниже'} на ${formatPoints(Math.abs(Math.round(gap / 100) * 100)).replace('+', '')}`
            }
            href="/market"
          />
          <KpiTile
            icon="chat"
            label="Активных диалогов"
            testId="sales-kpi-dialogs"
            value={dialogs ? String(dialogs.dialogs) : DASH}
            caption={
              dialogs
                ? humanCount
                  ? `за 24 часа, ${humanCount} ждут человека`
                  : 'за 24 часа'
                : noSeller
            }
            href="/ai-seller/dialogs"
          />
          <KpiTile
            icon="check"
            label="Конверсия в бронь"
            testId="sales-kpi-conversion"
            value={conversion ?? DASH}
            delta={conversionDelta}
            caption={
              !sales
                ? 'Нет данных'
                : conversion === null
                  ? 'за период предложений не было'
                  : `${sales.bookings.current} из ${sales.offers.current} предложений`
            }
            href="/ai-seller/dialogs"
          />
          <KpiTile
            icon="guests"
            label="Лидов"
            testId="sales-kpi-leads"
            value={dialogs ? String(dialogs.leads) : DASH}
            caption={dialogs ? 'оставили контакт за 24 часа' : noSeller}
            href="/ai-seller/dialogs"
          />
        </div>

        <div className="sales-trio">
          <MarketCard board={board} />
          <SellerCard connected={botReadable} extensionOff={status.ok && status.value.state === 'extension-off'} />
          <RecommendationsCard insights={board?.insights ?? null} empty={sales?.competitors.count === 0} />
        </div>
      </div>
    </Page>
  );
}

function CheckList({ items }: { items: string[] }) {
  return (
    <ul className="sales-card__checks">
      {items.map((item) => (
        <li key={item}>
          <Icon name="check" width={16} aria-hidden="true" />
          {item}
        </li>
      ))}
    </ul>
  );
}

/** Мини-столбцы по реальным данным: средняя загрузка рынка на ближайшие ночи; нет данных, нет и картинки */
function MarketBars({ board }: { board: MarketView['board'] | null }) {
  const bars = board?.market.filter((m) => m.bp !== null) ?? [];
  if (!board || bars.length === 0) return null;
  const label = `Средняя загрузка рынка на ближайшие ${board.dates.length} ночей`;
  return (
    <svg className="sales-card__art" viewBox="0 0 112 56" role="img" aria-label={label}>
      {board.market.map((m, i) => {
        const h = m.bp === null ? 0 : Math.max(3, (Math.min(m.bp, 10000) / 10000) * 52);
        return (
          <rect key={m.date} x={i * 8} y={54 - h} width={5} height={h} rx={1.5} fill="var(--chart-1)" opacity={0.35 + 0.65 * (i / board.market.length)}>
            <title>{`${m.date}: ${pct(m.bp)}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

function MarketCard({ board }: { board: MarketView['board'] | null }) {
  return (
    <Panel className="sales-card" aria-labelledby="sales-market-title" data-testid="sales-card-market">
      <div className="sales-card__head">
        <span className="sales-card__icon" aria-hidden="true">
          <Icon name="analytics" />
        </span>
        <div>
          <h2 id="sales-market-title">Загрузка конкурентов</h2>
          <p>Мониторинг рынка, сравнение загрузки, подсказки к цене.</p>
        </div>
      </div>
      <div className="sales-card__body">
        <CheckList items={['Ручной ввод и разрешённые источники', 'Графики загрузки по ночам', 'Подсказки к цене по спросу']} />
        <MarketBars board={board} />
      </div>
      <div className="sales-card__foot">
        <Link className="btn" href="/market">
          Открыть аналитику
          <Icon name="arrow" aria-hidden="true" />
        </Link>
      </div>
    </Panel>
  );
}

function ChatArt() {
  return (
    <svg className="sales-card__art" viewBox="0 0 112 72" aria-hidden="true">
      <rect x="6" y="6" width="68" height="34" rx="12" fill="var(--primary-soft)" />
      <circle cx="26" cy="23" r="3.5" fill="var(--primary)" />
      <circle cx="40" cy="23" r="3.5" fill="var(--primary)" opacity="0.7" />
      <circle cx="54" cy="23" r="3.5" fill="var(--primary)" opacity="0.4" />
      <rect x="38" y="32" width="68" height="34" rx="12" fill="var(--chart-1)" opacity="0.18" />
      <rect x="52" y="44" width="40" height="5" rx="2.5" fill="var(--chart-1)" opacity="0.55" />
      <rect x="52" y="54" width="26" height="5" rx="2.5" fill="var(--chart-1)" opacity="0.35" />
    </svg>
  );
}

function SellerCard({ connected, extensionOff }: { connected: boolean; extensionOff: boolean }) {
  return (
    <Panel className="sales-card" aria-labelledby="sales-seller-title" data-testid="sales-card-seller">
      <div className="sales-card__head">
        <span className="sales-card__icon sales-card__icon--seller" aria-hidden="true">
          <Icon name="chat" />
        </span>
        <div>
          <h2 id="sales-seller-title">ИИ-продавец</h2>
          <p>Сайт и WhatsApp. Ответы на вопросы, заявки и брони.</p>
        </div>
      </div>
      <div className="sales-card__body">
        <CheckList items={['Подключение каналов', 'Умные ответы на вопросы гостей', 'Квалификация и бронирование']} />
        <ChatArt />
      </div>
      {extensionOff && (
        <p className="sales-card__note" data-testid="sales-seller-off">
          Расширение «ИИ-продавец» не подключено: подключает администратор WETOP после оплаты по счёту.
        </p>
      )}
      <div className="sales-card__foot">
        <Link className="btn" href={extensionOff ? '/ai-agents' : '/ai-seller'}>
          {extensionOff ? 'Подробнее' : connected ? 'Открыть ИИ-продавца' : 'Настроить ИИ-продавца'}
          <Icon name="arrow" aria-hidden="true" />
        </Link>
      </div>
    </Panel>
  );
}

const REC_ICON: Record<MarketInsight['kind'], IconName> = {
  'high-behind': 'arrow',
  high: 'arrow',
  'low-ahead': 'check',
  low: 'board',
  missing: 'help',
};

function RecommendationsCard({ insights, empty }: { insights: MarketInsight[] | null; empty: boolean }) {
  const shown = (insights ?? []).slice(0, 3);
  return (
    <Panel className="sales-card" aria-labelledby="sales-recs-title" data-testid="sales-card-recs">
      <div className="sales-card__head">
        <span className="sales-card__icon sales-card__icon--tip" aria-hidden="true">
          <Icon name="sun" />
        </span>
        <div>
          <h2 id="sales-recs-title">Рекомендации сегодня</h2>
          <p>Что видно на рынке на ближайшие две недели.</p>
        </div>
      </div>
      {shown.length > 0 ? (
        <ul className="sales-recs" data-testid="sales-recs">
          {shown.map((i) => {
            const t = insightText(i);
            return (
              <li key={`${i.kind}-${i.from}`} className={cx('sales-rec', `sales-rec--${t.tone}`)}>
                <span className="sales-rec__icon" aria-hidden="true">
                  <Icon name={REC_ICON[i.kind]} />
                </span>
                <div>
                  <strong>{t.title}</strong>
                  <p>{t.text}</p>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="sales-card__note" data-testid="sales-recs-empty">
          {empty
            ? 'Добавьте ближайших конкурентов и внесите их загрузку: WETOP покажет, где рынок полон и цену можно поднять.'
            : insights === null
              ? 'Не удалось получить данные рынка.'
              : 'Пока подсказок нет: на ближайшие ночи рынок без резких перепадов.'}
        </p>
      )}
      <div className="sales-card__foot">
        <Link className="btn btn--secondary" href="/market?add=1">
          Добавить конкурента
          <Icon name="plus" aria-hidden="true" />
        </Link>
      </div>
    </Panel>
  );
}
