'use client';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Field, Input, Select } from '../../components/ui';
import { Icon, type IconName } from '../../components/icon';
import type { FoodWorkspace, ServicePeriod } from '../../lib/food-types';
import { saveFoodCatalog } from './actions';

export type SettingsSection = 'hours' | 'bookings' | 'notifications';

/** Порядок недели с понедельника; в модели 0 это воскресенье (`getUTCDay`) */
const WEEK: Array<[number, string]> = [
  [1, 'Понедельник'],
  [2, 'Вторник'],
  [3, 'Среда'],
  [4, 'Четверг'],
  [5, 'Пятница'],
  [6, 'Суббота'],
  [0, 'Воскресенье'],
];

type NavItem = { label: string; icon: IconName } & (
  { section: SettingsSection } | { href: string }
);
const NAV: NavItem[] = [
  { label: 'Основное', icon: 'inventory', href: '/branches' },
  { label: 'Часы работы', icon: 'clock', section: 'hours' },
  { label: 'Бронирования', icon: 'booking', section: 'bookings' },
  { label: 'Залы и столы', icon: 'board', href: '/dining-areas' },
  { label: 'Уведомления', icon: 'mail', section: 'notifications' },
  { label: 'Интеграции', icon: 'channels', href: '/connections' },
  { label: 'Публичный сайт', icon: 'globe', href: '/website' },
];

const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/**
 * Настройки ресторана (макет, экран 13). Часы работы это периоды обслуживания по дням недели (§28):
 * строка дня правит первый период дня, выключатель включает или выключает его; включение дня без
 * периода создаёт период «Весь день» 10:00–23:00. Конец раньше начала значит работу после полуночи.
 */
export function RestaurantSettings({
  data,
  section,
}: {
  data: FoodWorkspace;
  section: SettingsSection;
}) {
  const write = data.canProperty && !data.readOnly;
  return (
    <div className="rest-settings">
      <nav className="rest-settings__nav" aria-label="Разделы настроек">
        {NAV.map((item) =>
          'href' in item ? (
            <Link key={item.label} href={item.href}>
              <Icon name={item.icon} />
              {item.label}
            </Link>
          ) : (
            <Link
              key={item.label}
              href={`/restaurant-settings?section=${item.section}`}
              aria-current={section === item.section ? 'page' : undefined}
            >
              <Icon name={item.icon} />
              {item.label}
            </Link>
          ),
        )}
      </nav>
      <section className="rest-settings__body" aria-labelledby="rest-settings-title">
        {section === 'hours' && <Hours data={data} write={write} />}
        {section === 'bookings' && <Bookings data={data} write={write} />}
        {section === 'notifications' && (
          <>
            <h2 id="rest-settings-title">Уведомления</h2>
            <p className="muted">
              Подтверждения, напоминания и отмены уходят гостю через подключённые каналы. Каналы
              подключаются в разделе «Подключения».
            </p>
            <Link className="btn btn--secondary" href="/connections">
              Открыть подключения
            </Link>
          </>
        )}
      </section>
    </div>
  );
}

function useSave(data: FoodWorkspace) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const save = (id: string | undefined, body: Omit<ServicePeriod, 'id' | 'locationId'>) =>
    start(async () => {
      const result = await saveFoodCatalog(data.scopeKey, { kind: 'period', ...(id ? { id } : {}), body });
      setError(result.error ?? '');
      router.refresh();
    });
  return { pending, error, save };
}

function Hours({ data, write }: { data: FoodWorkspace; write: boolean }) {
  const { pending, error, save } = useSave(data);
  return (
    <>
      <h2 id="rest-settings-title">Часы работы</h2>
      {error && <Alert>{error}</Alert>}
      <ul className="rest-hours" aria-busy={pending}>
        {WEEK.map(([weekday, name]) => {
          const day = data.periods
            .filter((p) => p.weekday === weekday)
            .sort((a, b) => a.timeFrom.localeCompare(b.timeFrom));
          const p = day[0];
          const on = !!p && p.active;
          const body = (patch: Partial<ServicePeriod>) => {
            const next = { ...p!, ...patch };
            return {
              name: next.name,
              weekday: next.weekday,
              timeFrom: next.timeFrom,
              timeTo: next.timeTo,
              defaultDurationMinutes: next.defaultDurationMinutes,
              active: next.active,
              endsNextDay: minutes(next.timeTo) <= minutes(next.timeFrom),
            };
          };
          return (
            <li key={weekday} data-on={on || undefined}>
              <span className="rest-hours__day">{name}</span>
              <Field label={<span className="sr-only">{name}, начало</span>}>
                <Input
                  type="time"
                  disabled={!write || !p}
                  defaultValue={p?.timeFrom ?? '10:00'}
                  key={`${p?.id}-from-${p?.timeFrom}`}
                  onBlur={(e) =>
                    p && e.target.value && e.target.value !== p.timeFrom
                      ? save(p.id, body({ timeFrom: e.target.value }))
                      : undefined
                  }
                />
              </Field>
              <span aria-hidden="true">–</span>
              <Field label={<span className="sr-only">{name}, конец</span>}>
                <Input
                  type="time"
                  disabled={!write || !p}
                  defaultValue={p?.timeTo ?? '23:00'}
                  key={`${p?.id}-to-${p?.timeTo}`}
                  onBlur={(e) =>
                    p && e.target.value && e.target.value !== p.timeTo
                      ? save(p.id, body({ timeTo: e.target.value }))
                      : undefined
                  }
                />
              </Field>
              <label className="switch">
                <span className="switch__text">
                  <span className="switch__label sr-only">{name}: работаем</span>
                </span>
                <input
                  className="switch__input"
                  type="checkbox"
                  role="switch"
                  checked={on}
                  disabled={!write || pending}
                  onChange={() =>
                    p
                      ? save(p.id, body({ active: !p.active }))
                      : save(undefined, {
                          name: 'Весь день',
                          weekday,
                          timeFrom: '10:00',
                          timeTo: '23:00',
                          endsNextDay: false,
                          defaultDurationMinutes: 120,
                          active: true,
                        })
                  }
                />
                <span className="switch__track" aria-hidden="true" />
              </label>
              {day.length > 1 && (
                <small className="muted">
                  ещё периодов: {day.length - 1}, <Link href="/dining-areas">все периоды</Link>
                </small>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

const DURATIONS = [60, 90, 120, 150, 180, 240];

function Bookings({ data, write }: { data: FoodWorkspace; write: boolean }) {
  const { pending, error, save } = useSave(data);
  const periods = [...data.periods].sort(
    (a, b) => ((a.weekday + 6) % 7) - ((b.weekday + 6) % 7) || a.timeFrom.localeCompare(b.timeFrom),
  );
  const dayName = (w: number) => WEEK.find(([d]) => d === w)?.[1] ?? '';
  return (
    <>
      <h2 id="rest-settings-title">Бронирования</h2>
      <p className="muted">Длительность брони по умолчанию для каждого периода обслуживания.</p>
      {error && <Alert>{error}</Alert>}
      {periods.length === 0 ? (
        <p className="muted">Сначала включите дни в разделе «Часы работы».</p>
      ) : (
        <ul className="rest-hours" aria-busy={pending}>
          {periods.map((p) => {
            const { id, name, weekday, timeFrom, timeTo, endsNextDay, active } = p;
            const rest = { name, weekday, timeFrom, timeTo, endsNextDay, active };
            return (
              <li key={id} data-on={p.active || undefined}>
                <span className="rest-hours__day">
                  {dayName(p.weekday)}, {p.name}
                </span>
                <span className="muted">
                  {p.timeFrom}–{p.timeTo}
                </span>
                <Field label={<span className="sr-only">Длительность брони, {dayName(p.weekday)}</span>}>
                  <Select
                    disabled={!write || pending}
                    value={p.defaultDurationMinutes}
                    onChange={(e) => save(id, { ...rest, defaultDurationMinutes: Number(e.target.value) })}
                  >
                    {[...new Set([...DURATIONS, p.defaultDurationMinutes])]
                      .sort((a, b) => a - b)
                      .map((m) => (
                        <option key={m} value={m}>
                          {m % 60 ? `${Math.floor(m / 60)} ч ${m % 60} мин` : `${m / 60} ч`}
                        </option>
                      ))}
                  </Select>
                </Field>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
