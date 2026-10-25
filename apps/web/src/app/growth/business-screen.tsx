import Link from 'next/link';
import { Page } from '../../components/page';
import { Icon, type IconName } from '../../components/icon';
import { Alert, Panel } from '../../components/ui';
import { MarketingHub } from '../marketing/hub';
import { BackToModules } from '../marketing/parts';
import { formatMoney } from '../../lib/money';
import { countLabel, msg, translator, type DeskLocale, type Translate } from '../../i18n';
import { shortPeriod } from '../../lib/human-period';
import { PeriodBar } from '../../lib/period-bar';
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
  locale = 'ru',
}: {
  vertical: BusinessVertical;
  mode: 'sales' | 'marketing';
  data?: BusinessSalesData | null;
  locale?: DeskLocale;
}) {
  if (mode === 'marketing') return <MarketingHub vertical={vertical} locale={locale} />;
  const t = translator(locale);
  const restaurant = vertical === 'FOOD_SERVICE';
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
      title={t('Обзор продаж')}
      subtitle={
        period
          ? t(restaurant ? msg('Заказы и брони столов за {period}') : msg('Записи и оказанные услуги за {period}'), {
              period: shortPeriod(period.from, period.to),
            })
          : t('Инструменты роста и ИИ-продаж в одном разделе.')
      }
    >
      <div className="sales-hub growth-hub" data-testid="business-sales">
        {data?.error && (
          <Alert tone="warning" role="alert" data-testid="business-sales-error">
            {t(data.error)}
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
            note={t('период до 31 дня')}
            presets={[
              { label: t('7 дней'), href: q('days=7'), selected: period.preset === '7' },
              { label: t('30 дней'), href: q('days=30'), selected: period.preset === '30' },
            ]}
          />
        )}
        {/* итоги строкой вместо шести плиток (аудит п. 30) */}
        <dl className="money-summary" data-testid="sales-kpis">
          {kpi('sales-kpi-revenue', t('Выручка'), money(data?.revenueMinor ?? null), t(restaurant ? msg('закрытые заказы') : msg('выполненные записи')), restaurant ? '/restaurant-finance' : '/finance')}
          {kpi(
            'sales-kpi-sold',
            t(restaurant ? msg('Заказов') : msg('Оказано услуг')),
            count(data?.sold),
            data?.averageCheckMinor ? t('средний чек {sum}', { sum: money(data.averageCheckMinor) }) : null,
            restaurant ? '/orders' : '/appointments',
          )}
          {kpi(
            'sales-kpi-bookings',
            t(restaurant ? msg('Броней столов') : msg('Записей')),
            count(data?.bookings),
            restaurant
              ? data?.guests != null
                ? t('{guests} в заказах', { guests: countLabel(locale, t, data.guests, [msg('гость'), msg('гостя'), msg('гостей')]) })
                : null
              : conversion
                ? t('{pct} дошли до визита', { pct: conversion })
                : null,
            restaurant ? '/table-reservations' : '/appointments',
          )}
          {kpi('sales-kpi-lost', t('Неявки и отмены'), count(data?.lost), null, restaurant ? '/table-reservations' : '/appointments')}
          {kpi(
            'sales-kpi-dialogs',
            t('Диалогов ИИ-продавца'),
            dialogs ? String(dialogs.dialogs) : DASH,
            t(dialogs ? msg('за 24 часа') : seller?.extensionOff ? msg('расширение не подключено') : msg('не подключён')),
            '/ai-agents',
          )}
          {kpi(
            'sales-kpi-leads',
            t('Лидов'),
            dialogs ? String(dialogs.leads) : DASH,
            dialogs ? t('за 24 часа') : t(restaurant ? msg('контакты гостей') : msg('контакты клиентов')),
            '/ai-agents',
          )}
        </dl>

        <div className="sales-trio">
          <RankCard
            testId="sales-card-top"
            icon="star"
            title={t(restaurant ? msg('Лучшие блюда') : msg('Лучшие услуги'))}
            text={t('Что приносит больше всего выручки за период.')}
            rows={data?.top ?? []}
            unit={restaurant ? [msg('порция'), 'порции', msg('порций')] : [msg('раз'), 'раза', msg('раз')]} // kk-allow: форма склонения
            currency={data?.currency ?? 'KZT'}
            empty={t(restaurant ? msg('Закрытых заказов за период нет.') : msg('Выполненных записей за период нет.'))}
            href={restaurant ? '/menu' : '/services'}
            cta={t(restaurant ? msg('Меню и цены') : msg('Услуги и цены'))}
            locale={locale}
          />
          <RankCard
            testId="sales-card-team"
            icon="guests"
            title={t(restaurant ? msg('Официанты') : msg('Мастера'))}
            text={t(restaurant ? msg('Заказы и выручка по официантам.') : msg('Услуги и выручка по мастерам.'))}
            rows={data?.team ?? []}
            unit={restaurant ? [msg('заказ'), 'заказа', msg('заказов')] : [msg('услуга'), 'услуги', msg('услуг')]} // kk-allow: форма склонения
            currency={data?.currency ?? 'KZT'}
            empty={t('Пока нет продаж с исполнителем.')}
            href="/employees"
            cta={t('Сотрудники')}
            locale={locale}
          />
          <SellerCard
            connected={seller?.connected ?? false}
            extensionOff={seller?.extensionOff ?? false}
            restaurant={restaurant}
            t={t}
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
  locale,
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
  locale: DeskLocale;
}) {
  const t = translator(locale);
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
                <span className="growth-rank__count muted">{countLabel(locale, t, r.count, unit)}</span>
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
  t,
}: {
  connected: boolean;
  extensionOff: boolean;
  restaurant: boolean;
  t: Translate;
}) {
  return (
    <Panel className="sales-card" aria-labelledby="sales-seller-title" data-testid="sales-card-seller">
      <div className="sales-card__head">
        <span className="sales-card__icon sales-card__icon--seller" aria-hidden="true">
          <Icon name="chat" />
        </span>
        <div>
          <h2 id="sales-seller-title">{t('ИИ-продавец')}</h2>
          <p>{t('Отвечает клиентам в WhatsApp, Telegram и на сайте круглосуточно.')}</p>
        </div>
      </div>
      <ul className="sales-card__checks">
        {[msg('Ответы на вопросы о ценах и услугах'), restaurant ? msg('Бронь столов и заказы') : msg('Запись к мастеру'), msg('Передача сложных диалогов администратору')].map(
          (item) => (
            <li key={item}>
              <Icon name="check" width={16} aria-hidden="true" />
              {t(item)}
            </li>
          ),
        )}
      </ul>
      {extensionOff && (
        <p className="sales-card__note" data-testid="sales-seller-off">
          {t('Расширение «ИИ-продавец» подключает администратор WETOP после оплаты по счёту.')}
        </p>
      )}
      <div className="sales-card__foot">
        <Link className="btn" href="/ai-agents">
          {t(connected ? msg('Открыть ИИ-продавцов') : extensionOff ? msg('Подробнее') : msg('Настроить ИИ-продавца'))}
          <Icon name="arrow" width={16} aria-hidden="true" />
        </Link>
      </div>
    </Panel>
  );
}
