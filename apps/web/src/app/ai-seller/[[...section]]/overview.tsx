import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import { Alert, EmptyState, SectionTitle, Table, Panel } from '../../../components/ui';
import { KpiTile } from '../../../components/kpi-tile';
import { Icon } from '../../../components/icon';
import { hotelToday } from '../../../lib/hotel-api';
import { displayDate } from '../../../lib/display-date';
import { formatMoney } from '../../../lib/money';
import { countLabel, msg } from '../../../i18n';
import { currentLocale, serverT } from '../../../i18n/server';
import { conversationChannelLabel, conversationStageLabel, replyTimeText, sellerConnected } from '../../../lib/ai-seller';
import { conversionText as percentText } from '../../../lib/sales';
import { conversionText, countDelta, moneyDelta, salesPeriod } from '../../../lib/sales';
import { salesApi, sellerApi, type SellerStatus } from '../../../lib/api';


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
  const t = await serverT();
  const locale = await currentLocale();
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
  const shown = (n: number) => countLabel(locale, t, n, [msg('диалога'), 'диалогов', msg('диалогов')]); // kk-allow: форма склонения
  const waiting = human?.ok ? human.value.items : null;
  const why = !readable ? t('Продавец не подключён') : t('Нет данных от продавца');
  const noData = t('Нет данных');
  const days30 = t('за 30 дней');
  return (
    <div className="seller-overview" data-testid="seller-overview">
      <div className="seller-overview__actions" aria-label={t('Действия продавца')}>
        <Link className="btn btn--secondary" href="/ai-seller/dialogs">{t('Диалоги')}</Link>
        <Link className="btn btn--secondary" href="/ai-seller/knowledge">{t('База знаний')}</Link>
        <Link className="btn btn--secondary" href="/ai-seller/connections">{t('Подключения')}</Link>
      </div>
      {!s && (
        <Alert tone="warning" role="alert" data-testid="seller-overview-sales-error">
          {t('Не удалось посчитать брони из чата. Остальное показано как есть, обновите страницу.')}
        </Alert>
      )}
      <div className="kpi-row">
        <KpiTile icon="chat" label={t('Диалогов за сутки')} testId="seller-kpi-dialogs" value={day ? String(day.dialogs) : DASH} caption={day ? t('ответов продавца: {n}', { n: day.replies }) : why} href="/ai-seller/dialogs" />
        <KpiTile icon="guests" label={t('Лидов за сутки')} testId="seller-kpi-leads" value={day ? String(day.leads) : DASH} caption={day ? t('гости оставили контакт') : why} />
        <KpiTile icon="incidents" label={t('Ждут человека')} testId="seller-kpi-human" value={waiting ? String(waiting.length) : DASH} caption={waiting ? (waiting.length ? t('продавец просит помощи') : t('всё под контролем')) : why} href="/ai-seller/dialogs?mode=needs_human" />
        <KpiTile icon="incidents" label={t('Просрочили ответ')} testId="seller-kpi-sla" value={day ? String(day.slaBreaches) : DASH} caption={day ? t('за сутки') : why} />
        <KpiTile icon="journal" label={t('Предложений брони')} testId="seller-kpi-offers" value={s ? String(s.offers.current) : DASH} delta={s ? countDelta(s.offers.current, s.offers.previous) : undefined} caption={s ? days30 : noData} />
        <KpiTile icon="board" label={t('Броней из чата')} testId="seller-kpi-bookings" value={s ? String(s.bookings.current) : DASH} delta={s ? countDelta(s.bookings.current, s.bookings.previous) : undefined} caption={s ? days30 : noData} href="/ai-seller/analytics" />
        <KpiTile icon="analytics" label={t('Конверсия в бронь')} testId="seller-kpi-conversion" value={(s && conversionText(s.conversionPermille.current)) ?? DASH} caption={s ? (s.offers.current === 0 ? t('предложений ещё не было') : t('брони к предложениям')) : noData} />
        <KpiTile icon="money" label={t('Выручка из чата')} testId="seller-kpi-revenue" value={s && s.revenue.currency ? formatMoney(s.revenue.currentMinor, s.revenue.currency) : DASH} delta={s ? moneyDelta(s.revenue.currentMinor, s.revenue.previousMinor) : undefined} caption={s ? days30 : noData} />
      </div>
      <Panel aria-labelledby="seller-overview-human-title" data-testid="seller-overview-human">
        <SectionTitle first id="seller-overview-human-title">
          {t('Ждут человека')}
        </SectionTitle>
        {waiting === null ? (
          <p className="settings-note">{why}. {t('Подключите продавца на вкладке «Подключения».')}</p>
        ) : waiting.length === 0 ? (
          <EmptyState icon={<Icon name="chat" />} title={t('Сейчас никто не ждёт')}>
            {t('Когда продавец не справится или гость попросит человека, диалог появится здесь.')}
          </EmptyState>
        ) : (
          <Table size="sm" aria-label={t('Диалоги, которые ждут человека')} data-testid="seller-overview-human-table">
            <thead>
              <tr>
                <th scope="col">{t('Гость')}</th>
                <th scope="col">{t('Канал')}</th>
                <th scope="col">{t('Этап')}</th>
                <th scope="col">{t('Последнее')}</th>
              </tr>
            </thead>
            <tbody>
              {waiting.slice(0, 5).map((c) => (
                <tr key={c.id}>
                  <th scope="row">
                    <Link href={`/ai-seller/dialogs?mode=needs_human&id=${c.id}`}>{c.clientName ?? t('Гость')}</Link>
                  </th>
                  <td>{t(conversationChannelLabel(c.channel))}</td>
                  <td>{t(conversationStageLabel(c.stage))}</td>
                  <td>{c.lastActivityAt ? displayDate(c.lastActivityAt.slice(0, 10), 'numeric') : DASH}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {waiting && waiting.length > 5 && (
          <p className="settings-note">
            {t('Показаны первые 5 из {n}.', { n: shown(waiting.length) })}{' '}
            <Link href="/ai-seller/dialogs?mode=needs_human">{t('Открыть все')}</Link>
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
export async function AnalyticsView({ days, status }: { days: string; status: SellerStatus }) {
  const t = await serverT();
  const today = await hotelToday();
  const period = salesPeriod({ days }, today);
  const [sales, bot] = await Promise.all([
    settle(salesApi.summary(period.from, period.to)),
    sellerConnected(status) ? settle(sellerApi.summary()) : null,
  ]);
  const day = bot?.ok ? bot.value : null;
  const link = (n: '7' | '30') => `/ai-seller/analytics?days=${n}`;
  if (!sales.ok) {
    return (
      <Alert tone="warning" role="alert" data-testid="seller-analytics-error">
        {t('Не удалось посчитать аналитику. Обновите страницу.')}
      </Alert>
    );
  }
  const s = sales.value;
  const cur = conversionText(s.conversionPermille.current);
  const prev = conversionText(s.conversionPermille.previous);
  const money = (minor: string) => (s.revenue.currency ? formatMoney(minor, s.revenue.currency) : DASH);
  const rows: Array<[string, string, string]> = [
    [t('Предложений брони'), String(s.offers.current), String(s.offers.previous)],
    [t('Броней из чата'), String(s.bookings.current), String(s.bookings.previous)],
    [t('Конверсия в бронь'), cur ?? DASH, prev ?? DASH],
    [t('Выручка из чата'), money(s.revenue.currentMinor), money(s.revenue.previousMinor)],
  ];
  return (
    <div className="seller-analytics" data-testid="seller-analytics">
      <nav className="chips" aria-label={t('Период аналитики')} data-testid="seller-analytics-period">
        <Link href={link('7')} aria-current={period.preset === '7' ? 'page' : undefined}>
          {t('7 дней')}
        </Link>
        <Link href={link('30')} aria-current={period.preset === '30' ? 'page' : undefined}>
          {t('30 дней')}
        </Link>
      </nav>
      <Panel aria-labelledby="seller-analytics-day-title" data-testid="seller-analytics-day">
        <SectionTitle first id="seller-analytics-day-title">
          {t('Работа продавца за сутки')}
        </SectionTitle>
        <Table size="sm" aria-label={t('Показатели продавца за сутки')} data-testid="seller-analytics-day-table">
          <tbody>
            <tr>
              <th scope="row">{t('Диалогов')}</th>
              <td>{day ? String(day.dialogs) : DASH}</td>
            </tr>
            <tr>
              <th scope="row">{t('Без участия человека')}</th>
              <td data-testid="seller-metric-automated">{(day && percentText(day.automatedPermille)) ?? DASH}</td>
            </tr>
            <tr>
              <th scope="row">{t('Передано человеку')}</th>
              <td data-testid="seller-metric-handoffs">{day ? String(day.handoffs) : DASH}</td>
            </tr>
            <tr>
              <th scope="row">{t('Среднее время первого ответа')}</th>
              <td data-testid="seller-metric-reply-time">{(day && replyTimeText(day.avgFirstReplySeconds, t)) ?? DASH}</td>
            </tr>
          </tbody>
        </Table>
        <p className="settings-note">
          {t('Передача человеку: в диалоге подключился оператор или продавец позвал человека. Время первого ответа: от первого сообщения гостя до первого ответа продавца. Нет диалогов или ответов: тире, а не 0.')}
        </p>
      </Panel>
      <Panel aria-labelledby="seller-analytics-title">
        <SectionTitle first id="seller-analytics-title">
          {t('От предложения до брони')}
        </SectionTitle>
        <Table size="sm" aria-label={t('Показатели продавца за период и за прошлый такой же')} data-testid="seller-analytics-table">
          <thead>
            <tr>
              <th scope="col">{t('Показатель')}</th>
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
          {t('Предложение: продавец собрал данные брони и спросил подтверждение. Бронь создаётся после явного «да» гостя. Конверсия: доля предложений, закончившихся бронью; без предложений это тире, а не 0 %.')}
        </p>
      </Panel>
    </div>
  );
}
