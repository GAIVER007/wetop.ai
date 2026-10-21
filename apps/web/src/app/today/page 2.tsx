import { Suspense } from 'react';
import Link from 'next/link';
import { resolvePeriod } from '@pms/domain';
import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';
import { hotelApi, hotelToday } from '../../lib/hotel-api';
import { Page } from '../../components/page';
import { Alert } from '../../components/ui';
import { OwnerFinance, OwnerOperations } from './owner-dashboard';
import { DashboardRefresh } from './owner-controls';
import './owner-dashboard.css';

export default async function TodayPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = normalizeSearchParams(await searchParams);
  const today = await hotelToday();
  const hotel = await hotelApi.settings();
  const period = resolvePeriod({ preset: sp.period, from: sp.from, to: sp.to, date: sp.date }, today);
  return <Page title="Главная" width="full" actions={<><DashboardRefresh/><Link className="btn" href="/reservations/new">+ Новая бронь</Link></>}>
    <div className="owner-toolbar">
      <nav aria-label="Период финансов">{[['today','Сегодня'],['week','7 дней'],['month','Месяц']].map(([id,label])=><Link key={id} href={`/today?period=${id}`} aria-current={period.preset===id?'page':undefined}>{label}</Link>)}</nav>
      <form action="/today"><input type="hidden" name="period" value="custom"/><input aria-label="Начало периода" type="date" name="from" defaultValue={period.from} required/><span>—</span><input aria-label="Конец периода" type="date" name="to" defaultValue={period.to} required/><button className="btn btn--secondary">Показать</button></form>
      <span className="owner-property">{hotel.property.name} · {hotel.property.currency}</span>
    </div>
    {period.error && <Alert>{period.error}</Alert>}
    <div className="owner-dashboard" data-testid="owner-dashboard">
      <Suspense key={`${period.from}|${period.to}`} fallback={<div className="owner-finance owner-panel" role="status">Загружаем финансы…</div>}><OwnerFinance period={period} currency={hotel.property.currency} today={today}/></Suspense>
      <Suspense fallback={<div className="owner-operations owner-panel" role="status">Загружаем данные гостиницы…</div>}><OwnerOperations date={today} currency={hotel.property.currency}/></Suspense>
    </div>
  </Page>;
}
