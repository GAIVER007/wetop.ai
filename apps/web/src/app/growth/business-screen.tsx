import Link from 'next/link';
import { Page } from '../../components/page';
import { Icon, type IconName } from '../../components/icon';
import { Alert, Panel } from '../../components/ui';
import { MarketingHub } from '../marketing/hub';
import { BackToModules } from '../marketing/parts';
import { formatMoney } from '../../lib/money';
import { pluralRu } from '../../lib/plural';
import { shortPeriod } from '../../lib/human-period';
import { PeriodBar } from '../../lib/period-bar';
import { verticalCopy } from '../../lib/vertical-copy';
import type { BusinessSalesData, Ranked } from './business-sales';
import '../sales/sales.css';
import './growth.css';
import '../finance/summary.css';

type BusinessVertical = 'BEAUTY' | 'FOOD_SERVICE';
const DASH = '–';

/**
 * Хаб «Продажи» салона и ресторана: та же композиция, что у гостиницы (шесть плиток, три карточки), но числа из
 * записей салона и заказов ресторана. Анализа конкурентов у этих направлений пока нет (мониторинг только гостиничный):
 * его место занимают лучшие услуги/блюда и команда, это реальные продажи филиала.
 */
export function BusinessGrowthScreen({
  vertical,
  mode,
  data = null,
}: {
  vertical: BusinessVertical;
  mode: 'sales' | 'marketing';
  data?: BusinessSalesData | null;
}) {
  if (mode === 'marketing') return <MarketingHub vertical={vertical} />;
  const restaurant = vertical === 'FOOD_SERVICE';
  const copy = verticalCopy(vertical);
  const money = (minor: string | null) => (minor === null || !data ? DASH : formatMoney(minor, data.currency));
  const count = (n: number | null | undefined) => (n === null || n === undefined ? DASH : String(n));
  const seller = data?.seller ?? null;
  const dialogs = seller?.summary ?? null;
  const conversion =
    data && data.bookings !== null && data.bookings > 0 && data.sold !== null
      ? `${Math.round((data.sold / data.bookings) * 100)}%`
      : null;
  const period = data?.period;
  const q = (extra: string) => `/sales?${extra}`;
  const kpi = (testId: string, label: string, value: string, note: string | null, href: string) => (
    <div key={testId}>
      <dt>
        <Link href={href}>{label}</Link>
      </dt>
      <dd data-testid={testId}>{value}</dd>
      {note && <dd className="muted">{note}</dd>}
    </div>
  );
  return (
    <Page
      crumbs={<BackToModules />}
      title="Обзор продаж"
      subtitle={
        period
          ? `${restaurant ? 'Заказы и брони столов' : 'Записи и оказанные услуги'} за ${shortPeriod(period.from, period.to)}`
          : 'Инструменты роста и ИИ-продаж в одном разделе.'
      }
    >
      <div className="sales-hub growth-hub" data-testid="business-sales">
        {data?.error && (
          <Alert tone="warning" role="alert" data-testid="business-sales-error">
            {data.error}
          </Alert>
        )}
        {period && (
          // один вид выбора периода с «Финансами» (аудит 21.10.2026 п. 22)
          <PeriodBar
            path="/sales"
            from={period.from}
            to={period.to}
            today={period.to}
            testId="sales-period"
            note="период до 31 дня"
            presets={[
              { label: '7 дней', href: q('days=7'), selected: period.preset === '7' },
              { label: '30 дней', href: q('days=30'), selected: period.preset === '30' },
            ]}
          />
        )}
        {/* итоги строкой вместо шести плиток (аудит п. 30) */}
        <dl className="money-summary" data-testid="sales-kpis">
          {kpi('sales-kpi-revenue', 'Выручка', money(data?.revenueMinor ?? null), restaurant ? 'закрытые заказы' : 'выполненные записи', restaurant ? '/restaurant-finance' : '/finance')}
          {kpi(
            'sales-kpi-sold',
            restaurant ? 'Заказов' : 'Оказано услуг',
            count(data?.sold),
            data?.averageCheckMinor ? `средний чек ${money(data.averageCheckMinor)}` : null,
            restaurant ? '/orders' : '/appointments',
          )}
          {kpi(
            'sales-kpi-bookings',
            restaurant ? 'Броней столов' : 'Записей',
            count(data?.bookings),
            restaurant
              ? data?.guests != null
                ? `${pluralRu(data.guests, ['гость', 'гостя', 'гостей'])} в заказах`
                : null
              : conversion
                ? `${conversion} дошли до визита`
                : null,
            restaurant ? '/table-reservations' : '/appointments',
          )}
          {kpi('sales-kpi-lost', 'Неявки и отмены', count(data?.lost), null, restaurant ? '/table-reservations' : '/appointments')}
          {kpi(
            'sales-kpi-dialogs',
            'Диалогов ИИ-продавца',
            dialogs ? String(dialogs.dialogs) : DASH,
            dialogs ? 'за 24 часа' : seller?.extensionOff ? 'расширение не подключено' : 'не подключён',
            '/ai-agents',
          )}
          {kpi(
            'sales-kpi-leads',
            'Лидов',
            dialogs ? String(dialogs.leads) : DASH,
            dialogs ? 'за 24 часа' : `контакты ${copy.clientsOf}`,
            '/ai-agents',
          )}
        </dl>

        <div className="sales-trio">
          <RankCard
            testId="sales-card-top"
            icon="star"
            title={restaurant ? 'Лучшие блюда' : 'Лучшие услуги'}
            text="Что приносит больше всего выручки за период."
            rows={data?.top ?? []}
            unit={restaurant ? ['порция', 'порции', 'порций'] : ['раз', 'раза', 'раз']}
            currency={data?.currency ?? 'KZT'}
            empty={restaurant ? 'Закрытых заказов за период нет.' : 'Выполненных записей за период нет.'}
            href={restaurant ? '/menu' : '/services'}
            cta={restaurant ? 'Меню и цены' : 'Услуги и цены'}
          />
          <RankCard
            testId="sales-card-team"
            icon="guests"
            title={restaurant ? 'Официанты' : 'Мастера'}
            text={restaurant ? 'Заказы и выручка по официантам.' : 'Услуги и выручка по мастерам.'}
            rows={data?.team ?? []}
            unit={restaurant ? ['заказ', 'заказа', 'заказов'] : ['услуга', 'услуги', 'услуг']}
            currency={data?.currency ?? 'KZT'}
            empty="Пока нет продаж с исполнителем."
            href="/employees"
            cta="Сотрудники"
          />
          <SellerCard
            connected={seller?.connected ?? false}
            extensionOff={seller?.extensionOff ?? false}
            restaurant={restaurant}
          />
        </div>
      </div>
    </Page>
  );
}

function RankCard({
  testId,
  icon,
  title,
  text,
  rows,
  unit,
  currency,
  empty,
  href,
  cta,
}: {
  testId: string;
  icon: IconName;
  title: string;
  text: string;
  rows: Ranked[];
  unit: [string, string, string];
  currency: string;
  empty: string;
  href: string;
  cta: string;
}) {
  const max = rows.reduce((m, r) => (BigInt(r.revenueMinor) > m ? BigInt(r.revenueMinor) : m), 0n);
  return (
    <Panel className="sales-card" aria-labelledby={`${testId}-title`} data-testid={testId}>
      <div className="sales-card__head">
        <span className="sales-card__icon" aria-hidden="true">
          <Icon name={icon} />
        </span>
        <div>
          <h2 id={`${testId}-title`}>{title}</h2>
          <p>{text}</p>
        </div>
      </div>
      {rows.length ? (
        <ol className="growth-rank">
          {rows.map((r) => {
            const share = max > 0n ? Number((BigInt(r.revenueMinor) * 100n) / max) : 0;
            return (
              <li key={r.name}>
                <span className="growth-rank__name">{r.name}</span>
                <span className="growth-rank__value">{formatMoney(r.revenueMinor, currency)}</span>
                <span className="growth-rank__bar" aria-hidden="true">
                  <span style={{ width: `${Math.max(4, share)}%` }} /* slop-allow: inline-style ширина полосы из доли выручки */ />
                </span>
                <span className="growth-rank__count muted">{pluralRu(r.count, unit)}</span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="sales-card__note">{empty}</p>
      )}
      <div className="sales-card__foot">
        <Link className="btn btn--secondary" href={href}>
          {cta} <Icon name="arrow" width={16} aria-hidden="true" />
        </Link>
      </div>
    </Panel>
  );
}

function SellerCard({
  connected,
  extensionOff,
  restaurant,
}: {
  connected: boolean;
  extensionOff: boolean;
  restaurant: boolean;
}) {
  return (
    <Panel className="sales-card" aria-labelledby="sales-seller-title" data-testid="sales-card-seller">
      <div className="sales-card__head">
        <span className="sales-card__icon sales-card__icon--seller" aria-hidden="true">
          <Icon name="chat" />
        </span>
        <div>
          <h2 id="sales-seller-title">ИИ-продавец</h2>
          <p>Отвечает клиентам в WhatsApp, Telegram и на сайте круглосуточно.</p>
        </div>
      </div>
      <ul className="sales-card__checks">
        {['Ответы на вопросы о ценах и услугах', restaurant ? 'Бронь столов и заказы' : 'Запись к мастеру', 'Передача сложных диалогов администратору'].map(
          (t) => (
            <li key={t}>
              <Icon name="check" width={16} aria-hidden="true" />
              {t}
            </li>
          ),
        )}
      </ul>
      {extensionOff && (
        <p className="sales-card__note" data-testid="sales-seller-off">
          Расширение «ИИ-продавец» подключает администратор WETOP после оплаты по счёту.
        </p>
      )}
      <div className="sales-card__foot">
        <Link className="btn" href="/ai-agents">
          {connected ? 'Открыть ИИ-продавцов' : extensionOff ? 'Подробнее' : 'Настроить ИИ-продавца'}
          <Icon name="arrow" width={16} aria-hidden="true" />
        </Link>
      </div>
    </Panel>
  );
}
