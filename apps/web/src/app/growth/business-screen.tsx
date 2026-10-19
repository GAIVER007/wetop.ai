import Link from 'next/link';
import { Page } from '../../components/page';
import { Icon, type IconName } from '../../components/icon';
import { KpiTile } from '../../components/kpi-tile';
import { Alert, Panel } from '../../components/ui';
import { MarketingHub } from '../marketing/hub';
import { formatMoney } from '../../lib/money';
import { pluralRu } from '../../lib/plural';
import { displayDate } from '../../lib/display-date';
import { verticalCopy } from '../../lib/vertical-copy';
import type { BusinessSalesData, Ranked } from './business-sales';
import '../sales/sales.css';
import './growth.css';

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
  return (
    <Page
      title="Обзор продаж"
      subtitle={
        period
          ? `${restaurant ? 'Заказы и брони столов' : 'Записи и оказанные услуги'} за ${displayDate(period.from)} — ${displayDate(period.to)}`
          : 'Инструменты роста и ИИ-продаж в одном разделе.'
      }
      actions={
        period && (
          <nav className="chips sales-chips" aria-label="Период продаж" data-testid="sales-period">
            <Link href={q('days=7')} aria-current={period.preset === '7' ? 'page' : undefined}>
              7 дней
            </Link>
            <Link href={q('days=30')} aria-current={period.preset === '30' ? 'page' : undefined}>
              30 дней
            </Link>
          </nav>
        )
      }
    >
      <div className="sales-hub growth-hub" data-testid="business-sales">
        {data?.error && (
          <Alert tone="warning" role="alert" data-testid="business-sales-error">
            {data.error}
          </Alert>
        )}
        {period && (
          <form className="growth-period" action="/sales" data-testid="sales-custom-period">
            <label>
              С
              <input type="date" name="from" defaultValue={period.from} required />
            </label>
            <label>
              По
              <input type="date" name="to" defaultValue={period.to} required />
            </label>
            <button className="btn btn--secondary" type="submit">
              Показать
            </button>
            <span className="muted">период до 31 дня</span>
          </form>
        )}
        <div className="kpi-row" data-testid="sales-kpis">
          <KpiTile
            icon="money"
            label="Выручка"
            testId="sales-kpi-revenue"
            value={money(data?.revenueMinor ?? null)}
            caption={restaurant ? 'закрытые заказы' : 'выполненные записи'}
            href={restaurant ? '/restaurant-finance' : '/finance'}
          />
          <KpiTile
            icon="check"
            label={restaurant ? 'Заказов' : 'Оказано услуг'}
            testId="sales-kpi-sold"
            value={count(data?.sold)}
            caption={data?.averageCheckMinor ? `средний чек ${money(data.averageCheckMinor)}` : 'средний чек появится с продажами'}
            href={restaurant ? '/orders' : '/appointments'}
          />
          <KpiTile
            icon="booking"
            label={restaurant ? 'Броней столов' : 'Записей'}
            testId="sales-kpi-bookings"
            value={count(data?.bookings)}
            caption={
              restaurant
                ? data?.guests != null
                  ? `${pluralRu(data.guests, ['гость', 'гостя', 'гостей'])} в заказах`
                  : 'все статусы'
                : conversion
                  ? `${conversion} дошли до визита`
                  : 'все статусы'
            }
            href={restaurant ? '/table-reservations' : '/appointments'}
          />
          <KpiTile
            icon="incidents"
            label="Неявки и отмены"
            testId="sales-kpi-lost"
            value={count(data?.lost)}
            caption={data?.lost ? 'стоит напомнить клиентам о визите' : 'потерь нет'}
            href={restaurant ? '/table-reservations' : '/appointments'}
          />
          <KpiTile
            icon="chat"
            label="Диалогов ИИ-продавца"
            testId="sales-kpi-dialogs"
            value={dialogs ? String(dialogs.dialogs) : DASH}
            caption={dialogs ? 'за 24 часа' : seller?.extensionOff ? 'расширение не подключено' : 'ИИ-продавец не подключён'}
            href="/ai-agents"
          />
          <KpiTile
            icon="guests"
            label="Лидов"
            testId="sales-kpi-leads"
            value={dialogs ? String(dialogs.leads) : DASH}
            caption={dialogs ? 'оставили контакт за 24 часа' : `контакты ${copy.clientsOf} от ИИ-продавца`}
            href="/ai-agents"
          />
        </div>

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
