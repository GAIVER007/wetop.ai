import { Suspense } from 'react';
import Link from 'next/link';
import { Page } from '../../components/page';
import { financeApi } from '../../lib/api';
import { hotelToday, propertyCurrency } from '../../lib/hotel-api';
import { homeCurrency } from './home-currency';
import { periods } from '../../lib/report-periods';
import { OwnerLoad } from '../finance/owner-dashboard';
import { AttentionCard, TodayCard } from '../finance/overview';
import { AttentionPlaceholder, OwnerPlaceholder } from '../finance/owner-loading';
import '../finance/owner-dashboard.css';
import '../finance/attention.css';
import '../finance/overview.css';
import './hospitality-home.css';
import { serverT } from '../../i18n/server';

/**
 * Главная гостиницы (решение владельца 13.10.2026, поверх ADR-152): «Финансы» по эталону стали чисто
 * денежным экраном, а загрузка с прогнозом, события дня и «Что требует внимания» вернулись сюда.
 * Блоки те же, что стояли на «Обзоре бизнеса», расчёты не менялись.
 */
export async function HospitalityToday() {
  const t = await serverT();
  const cal = periods(await hotelToday());
  const period = `/finance?from=${cal.month.from}&to=${cal.month.to}`;
  const debts = await financeApi.debts(cal.month.from, cal.month.to).catch(() => null);
  // Debts already carries the display currency. Only wait for settings if that source is absent.
  const currency = homeCurrency(debts, debts?.currency ?? (await propertyCurrency()));
  return (
    <Page
      title={t('Главная')}
      subtitle={t('Загрузка, события дня и задачи объекта')}
      // главное действие справа, как «+ Новая запись» салона (эталон владельца 25.10.2026)
      actions={
        <Link className="btn btn--primary" href="/reservations/new">
          {t('+ Новая бронь')}
        </Link>
      }
      width="full"
    >
      <div className="biz-overview hospitality-home" data-testid="owner-dashboard">
        <div className="biz-row biz-row--two">
          <Suspense
            fallback={
              <div className="owner-load owner-surface">
                <OwnerPlaceholder variant="load" label={t('Загружаем загрузку…')} />
              </div>
            }
          >
            <OwnerLoad date={cal.today} />
          </Suspense>
          <Suspense
            fallback={
              <div className="biz-today owner-surface">
                <OwnerPlaceholder variant="today" label={t('Загружаем события дня…')} />
              </div>
            }
          >
            <TodayCard
              date={cal.today}
              showDebts={false}
              debts={debts}
              period={period}
              currency={currency}
            />
          </Suspense>
        </div>
        <Suspense fallback={<AttentionPlaceholder />}>
          <AttentionCard date={cal.today} debts={debts} period={period} />
        </Suspense>
      </div>
    </Page>
  );
}
