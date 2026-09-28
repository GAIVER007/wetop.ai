import { Suspense } from 'react';
import Link from 'next/link';
import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';
import { ApiError } from '../../lib/api';
import { hotelApi, hotelToday, validDate } from '../../lib/hotel-api';
import { FALLBACK_TIMEZONE } from '../../lib/property-time';
import { Page } from '../../components/page';
import { Icon } from '../../components/icon';
import { HotelClock } from './dashboard-widgets';
import { DayBar } from './day-bar';
import { DeskSection, DeskSkeleton } from './desk-section';
import { FirstSteps } from './first-steps';
import { MoneyToday } from './money-today';
import { SystemsToday } from './systems-today';
import { Panel } from '../../components/ui';

async function loadHotel() {
  return hotelApi.settings().catch((error: unknown) => {
    if (error instanceof ApiError) return null;
    throw error;
  });
}

async function PropertyName() {
  const hotel = await loadHotel();
  return hotel?.property.name ?? 'Гостиница';
}

async function PropertyClock() {
  const hotel = await loadHotel();
  return <HotelClock timezone={hotel?.property.timezone ?? FALLBACK_TIMEZONE} />;
}

function BlockSkeleton({ title }: { title: string }) {
  return (
    <Panel title={title}>
      <p className="muted">Загружаем…</p>
    </Panel>
  );
}

/**
 * Главная — рабочий экран дня (A1, ADR-103; ТЗ `plans/tz-today-2026-09-27.md`): полоса дня,
 * операционные показатели «На стойке», «Требуют внимания» рядом с быстрыми действиями. Экран живёт
 * одним днём; показатели за период с их пресетами переехали на `/management/dashboard` — `?period=`
 * Главная больше не читает. Каждый блок приходит своим куском (`Suspense`), как и раньше: отказ
 * одного вызова не прячет экран целиком (замечание владельца 16.09.2026).
 */
export default async function TodayPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = normalizeSearchParams(await searchParams);
  const today = await hotelToday();
  // Полоса стойки: явная ?date=, иначе сегодня объекта
  const deskDate = sp.date && validDate(sp.date) ? sp.date : today;
  return (
    <Page
      title="Главная"
      crumbs={
        <span className="eyebrow">
          <Suspense fallback="Гостиница">
            <PropertyName />
          </Suspense>
        </span>
      }
      actions={
        <>
          <Link href="/chessboard" className="btn btn--secondary">
            Шахматка
          </Link>
          <Link href="/reservations/new" className="btn">
            <Icon name="plus" />
            Новая бронь
          </Link>
        </>
      }
    >
      <Suspense fallback={null}>
        <FirstSteps />
      </Suspense>
      <div className="day-bar-row">
        <DayBar date={deskDate} today={today} />
        <Suspense
          fallback={
            <span className="hotel-clock">
              <Icon name="clock" width={14} />— <span>Время гостиницы</span>
            </span>
          }
        >
          <PropertyClock />
        </Suspense>
      </div>
      <Suspense fallback={<DeskSkeleton />}>
        <DeskSection date={deskDate} today={today} />
      </Suspense>
      {/* A2: у денег и систем свои запросы — свои куски, сбой одного не прячет остальное */}
      <div className="dash-grid dash-grid--events">
        <Suspense fallback={<BlockSkeleton title="Деньги сегодня" />}>
          <MoneyToday date={deskDate} />
        </Suspense>
        <Suspense fallback={<BlockSkeleton title="Системы" />}>
          <SystemsToday />
        </Suspense>
      </div>
      {/* Ссылки на модули (ТЗ §4 п. 8): аналитика и финансы живут в своих разделах, не на Главной */}
      <nav className="today-links" aria-label="Отчёты и финансы">
        <Link className="btn btn--secondary" href="/management/dashboard">
          Показатели за период
        </Link>
        <Link className="btn btn--secondary" href={`/finance?from=${deskDate}&to=${deskDate}`}>
          Оплаты
        </Link>
        <Link className="btn btn--secondary" href={`/management/statistics?date=${deskDate}`}>
          Статистика
        </Link>
      </nav>
    </Page>
  );
}
