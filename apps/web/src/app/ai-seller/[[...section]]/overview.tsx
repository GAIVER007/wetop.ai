import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import { Alert, EmptyState, SectionTitle, Table, Panel } from '../../../components/ui';
import { KpiTile } from '../../../components/kpi-tile';
import { Icon } from '../../../components/icon';
import { hotelToday } from '../../../lib/hotel-api';
import { displayDate } from '../../../lib/display-date';
import { formatMoney } from '../../../lib/money';
import { pluralRu } from '../../../lib/plural';
import { conversationChannelLabel, conversationStageLabel, sellerConnected } from '../../../lib/ai-seller';
import { conversionText, countDelta, moneyDelta, salesPeriod } from '../../../lib/sales';
import { salesApi, sellerApi, type SellerStatus } from '../../../lib/api';

import '../../sales/sales.css';

const DASH = '–';
const settle = <T,>(promise: Promise<T>) =>
  promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => {
      unstable_rethrow(error);
      return { ok: false as const, error };
    },
  );

/**
 * «Обзор» ИИ-продавца (макет владельца 09.10.2026): за сутки и за 30 дней. Диалоги, ответы и лиды отдаёт бот, предложения
 * и брони из чата считает платформа (`/sales/summary`). Чего источник не отдал, то тире с причиной, а не ноль.
 */
export async function OverviewView({ status }: { status: SellerStatus }) {
  const today = await hotelToday();
  const period = salesPeriod({ days: '30' }, today);
  const readable = sellerConnected(status);
  const [bot, human, sales] = await Promise.all([
    readable ? settle(sellerApi.summary()) : null,
    readable ? settle(sellerApi.conversations('needs_human')) : null,
    settle(salesApi.summary(period.from, period.to)),
  ]);
  const day = bot?.ok ? bot.value : null;
  const s = sales.ok ? sales.value : null;
  const waiting = human?.ok ? human.value.items : null;
  const why = !readable ? 'Продавец не подключён' : 'Нет данных от продавца';
  return (
    <div className="seller-overview" data-testid="seller-overview">
      {!s && (
        <Alert tone="warning" role="alert" data-testid="seller-overview-sales-error">
          Не удалось посчитать брони из чата. Остальное показано как есть, обновите страницу.
        </Alert>
      )}
      <div className="kpi-row">
        <KpiTile icon="chat" label="Диалогов за сутки" testId="seller-kpi-dialogs" value={day ? String(day.dialogs) : DASH} caption={day ? `ответов продавца: ${day.replies}` : why} href="/ai-seller/dialogs" />
        <KpiTile icon="guests" label="Лидов за сутки" testId="seller-kpi-leads" value={day ? String(day.leads) : DASH} caption={day ? 'гости оставили контакт' : why} />
        <KpiTile icon="incidents" label="Ждут человека" testId="seller-kpi-human" value={waiting ? String(waiting.length) : DASH} caption={waiting ? (waiting.length ? 'продавец просит помощи' : 'всё под контролем') : why} href="/ai-seller/dialogs?mode=needs_human" />
        <KpiTile icon="incidents" label="Просрочили ответ" testId="seller-kpi-sla" value={day ? String(day.slaBreaches) : DASH} caption={day ? 'за сутки' : why} />
        <KpiTile icon="journal" label="Предложений брони" testId="seller-kpi-offers" value={s ? String(s.offers.current) : DASH} delta={s ? countDelta(s.offers.current, s.offers.previous) : undefined} caption={s ? 'за 30 дней' : 'Нет данных'} />
        <KpiTile icon="board" label="Броней из чата" testId="seller-kpi-bookings" value={s ? String(s.bookings.current) : DASH} delta={s ? countDelta(s.bookings.current, s.bookings.previous) : undefined} caption={s ? 'за 30 дней' : 'Нет данных'} href="/ai-seller/analytics" />
        <KpiTile icon="analytics" label="Конверсия в бронь" testId="seller-kpi-conversion" value={(s && conversionText(s.conversionPermille.current)) ?? DASH} caption={s ? (s.offers.current === 0 ? 'предложений ещё не было' : 'брони к предложениям') : 'Нет данных'} />
        <KpiTile icon="money" label="Выручка из чата" testId="seller-kpi-revenue" value={s && s.revenue.currency ? formatMoney(s.revenue.currentMinor, s.revenue.currency) : DASH} delta={s ? moneyDelta(s.revenue.currentMinor, s.revenue.previousMinor) : undefined} caption={s ? 'за 30 дней' : 'Нет данных'} />
      </div>
      <Panel aria-labelledby="seller-overview-human-title" data-testid="seller-overview-human">
        <SectionTitle first id="seller-overview-human-title">
          Ждут человека
        </SectionTitle>
        {waiting === null ? (
          <p className="settings-note">{why}. Подключите продавца на вкладке «Подключения».</p>
        ) : waiting.length === 0 ? (
          <EmptyState icon={<Icon name="chat" />} title="Сейчас никто не ждёт">
            Когда продавец не справится или гость попросит человека, диалог появится здесь.
          </EmptyState>
        ) : (
          <Table size="sm" aria-label="Диалоги, которые ждут человека" data-testid="seller-overview-human-table">
            <thead>
              <tr>
                <th scope="col">Гость</th>
                <th scope="col">Канал</th>
                <th scope="col">Этап</th>
                <th scope="col">Последнее</th>
              </tr>
            </thead>
            <tbody>
              {waiting.slice(0, 5).map((c) => (
                <tr key={c.id}>
                  <th scope="row">
                    <Link href={`/ai-seller/dialogs?mode=needs_human&id=${c.id}`}>{c.clientName ?? 'Гость'}</Link>
                  </th>
                  <td>{conversationChannelLabel(c.channel)}</td>
                  <td>{conversationStageLabel(c.stage)}</td>
                  <td>{c.lastActivityAt ? displayDate(c.lastActivityAt.slice(0, 10), 'numeric') : DASH}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {waiting && waiting.length > 5 && (
          <p className="settings-note">
            Показаны первые 5 из {pluralRu(waiting.length, ['диалога', 'диалогов', 'диалогов'])}.{' '}
            <Link href="/ai-seller/dialogs?mode=needs_human">Открыть все</Link>
          </p>
        )}
      </Panel>
    </div>
  );
}

/**
 * «Аналитика» продавца: путь от предложения до брони за выбранный отрезок и к прошлому такого же. Предложение это
 * момент, когда продавец собрал данные брони и спросил подтверждение; бронь создаётся после явного «да» гостя.
 */
export async function AnalyticsView({ days }: { days: string }) {
  const today = await hotelToday();
  const period = salesPeriod({ days }, today);
  const sales = await settle(salesApi.summary(period.from, period.to));
  const link = (n: '7' | '30') => `/ai-seller/analytics?days=${n}`;
  if (!sales.ok) {
    return (
      <Alert tone="warning" role="alert" data-testid="seller-analytics-error">
        Не удалось посчитать аналитику. Обновите страницу.
      </Alert>
    );
  }
  const s = sales.value;
  const cur = conversionText(s.conversionPermille.current);
  const prev = conversionText(s.conversionPermille.previous);
  const money = (minor: string) => (s.revenue.currency ? formatMoney(minor, s.revenue.currency) : DASH);
  const rows: Array<[string, string, string]> = [
    ['Предложений брони', String(s.offers.current), String(s.offers.previous)],
    ['Броней из чата', String(s.bookings.current), String(s.bookings.previous)],
    ['Конверсия в бронь', cur ?? DASH, prev ?? DASH],
    ['Выручка из чата', money(s.revenue.currentMinor), money(s.revenue.previousMinor)],
  ];
  return (
    <div className="seller-analytics" data-testid="seller-analytics">
      <nav className="chips" aria-label="Период аналитики" data-testid="seller-analytics-period">
        <Link href={link('7')} aria-current={period.preset === '7' ? 'page' : undefined}>
          7 дней
        </Link>
        <Link href={link('30')} aria-current={period.preset === '30' ? 'page' : undefined}>
          30 дней
        </Link>
      </nav>
      <Panel aria-labelledby="seller-analytics-title">
        <SectionTitle first id="seller-analytics-title">
          От предложения до брони
        </SectionTitle>
        <Table size="sm" aria-label="Показатели продавца за период и за прошлый такой же" data-testid="seller-analytics-table">
          <thead>
            <tr>
              <th scope="col">Показатель</th>
              <th scope="col">
                {displayDate(s.period.from, 'numeric')} – {displayDate(s.period.to, 'numeric')}
              </th>
              <th scope="col">
                {displayDate(s.previousPeriod.from, 'numeric')} – {displayDate(s.previousPeriod.to, 'numeric')}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, now, before]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                <td>{now}</td>
                <td>{before}</td>
              </tr>
            ))}
          </tbody>
        </Table>
        <p className="settings-note">
          Предложение: продавец собрал данные брони и спросил подтверждение. Бронь создаётся после явного «да» гостя.
          Конверсия: доля предложений, закончившихся бронью; без предложений это тире, а не 0 %.
        </p>
      </Panel>
    </div>
  );
}
