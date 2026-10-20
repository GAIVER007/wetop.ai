'use client';
import Link from 'next/link';
import { useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Field, Input, Select } from '../../components/ui';
import { Icon, type IconName } from '../../components/icon';
import type { FoodWorkspace, ServicePeriod } from '../../lib/food-types';
import type { BookingRules } from '@pms/domain';
import { saveBookingRules, type BookingRulesCommand } from './actions';
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
  { label: 'Часы работы зала', icon: 'clock', section: 'hours' },
  { label: 'Бронирования', icon: 'booking', section: 'bookings' },
  { label: 'Залы и столы', icon: 'board', href: '/dining-areas' },
  { label: 'Уведомления', icon: 'mail', section: 'notifications' },
  // `/website` гостиничный раздел; сайт ресторана собирается в «Продвижении» (аудит 17.10.2026, Д1)
  { label: 'Публичный сайт', icon: 'globe', href: '/marketing/site/editor' },
];

const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/**
 * Настройки ресторана (макет, экран 13). Часы работы это периоды обслуживания по дням недели (§28):
 * строка дня правит первый период дня, выключатель включает или выключает его; включение дня без
 * периода создаёт период «Весь день» 10:00–23:00. Конец раньше начала значит работу после полуночи.
 */
/** Правила брони и будущие закрытые дни (§43); грузятся только для раздела «Бронирования» */
export interface BookingSettings {
  rules: BookingRules;
  closedDays: Array<{ id: string; day: string; reason: string | null }>;
}

export function RestaurantSettings({
  data,
  section,
  booking,
  physicalOpening,
}: {
  data: FoodWorkspace;
  section: SettingsSection;
  booking?: BookingSettings | undefined;
  physicalOpening?: ReactNode;
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
      <section className="rest-settings__body" aria-labelledby={section === 'hours' ? 'physical-opening-title' : 'rest-settings-title'}>
        {section === 'hours' && physicalOpening}
        {section === 'bookings' && <Hours data={data} write={write} />}
        {section === 'bookings' && <Bookings data={data} write={write} />}
        {section === 'bookings' && booking && <BookingRulesForm data={data} write={write} booking={booking} />}
        {section === 'notifications' && (
          <>
            <h2 id="rest-settings-title">Уведомления</h2>
            <p className="muted">
              Подтверждения, напоминания и отмены уходят гостю через подключённые каналы.
            </p>
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
      <h2 id="rest-settings-title">Периоды приёма броней</h2>
      <p className="muted">Эти периоды не определяют физические часы работы зала.</p>
      {error && <Alert>{error}</Alert>}
      <ul className="rest-hours rest-hours--editable" aria-busy={pending}>
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
              <Field className="rest-hours__from" label={<><span aria-hidden="true">С</span><span className="sr-only">{name}, начало</span></>}>
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
              <Field className="rest-hours__to" label={<><span aria-hidden="true">До</span><span className="sr-only">{name}, конец</span></>}>
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
      <h3>Длительность бронирований</h3>
      <p className="muted">Длительность брони по умолчанию для каждого периода обслуживания.</p>
      {error && <Alert>{error}</Alert>}
      {periods.length === 0 ? (
        <p className="muted">Сначала настройте периоды приёма броней выше.</p>
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

const BUFFERS = [0, 10, 15, 20, 30, 45, 60];
const optionalNumber = (raw: FormDataEntryValue | null) => (String(raw ?? '').trim() ? Number(raw) : null);

/** Правила брони столов (§43, ADR-177): буфер, горизонт, предел гостей и закрытые дни */
function BookingRulesForm({ data, write, booking }: { data: FoodWorkspace; write: boolean; booking: BookingSettings }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  function run(command: BookingRulesCommand, done: string) {
    setError('');
    setSaved('');
    start(async () => {
      const r = await saveBookingRules(data.scopeKey, command);
      if (r.error) return setError(r.error);
      setSaved(done);
      router.refresh();
    });
  }
  return (
    <section className="rest-booking-rules" aria-labelledby="rest-booking-rules-title" data-testid="booking-rules">
      <h3 id="rest-booking-rules-title">Правила брони</h3>
      {error && <Alert>{error}</Alert>}
      {saved && <p role="status">{saved}</p>}
      <form
        className="food-form"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          run(
            {
              kind: 'rules',
              rules: {
                bufferMinutes: Number(f.get('buffer')),
                horizonDays: optionalNumber(f.get('horizon')),
                maxPartySize: optionalNumber(f.get('party')),
              },
            },
            'Правила сохранены',
          );
        }}
      >
        <Field label="Перерыв между посадками за одним столом">
          <Select name="buffer" defaultValue={booking.rules.bufferMinutes} disabled={!write || pending}>
            {[...new Set([...BUFFERS, booking.rules.bufferMinutes])]
              .sort((a, b) => a - b)
              .map((m) => (
                <option key={m} value={m}>
                  {m ? `${m} мин` : 'Без перерыва'}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Бронировать вперёд не больше, дней" hint="Пусто: без ограничения" controlId="rest-rules-horizon">
          <Input
            name="horizon"
            type="number"
            min={1}
            max={730}
            defaultValue={booking.rules.horizonDays ?? ''}
            disabled={!write || pending}
          />
        </Field>
        <Field label="Гостей в одной брони не больше" hint="Пусто: по вместимости стола" controlId="rest-rules-party">
          <Input
            name="party"
            type="number"
            min={1}
            max={500}
            defaultValue={booking.rules.maxPartySize ?? ''}
            disabled={!write || pending}
          />
        </Field>
        {write && (
          <Button type="submit" disabled={pending}>
            Сохранить правила
          </Button>
        )}
      </form>
      <h3>Закрытые дни</h3>
      <p className="muted">В закрытый день новые брони не принимаются; уже сделанные остаются, отменяет их человек.</p>
      {booking.closedDays.length === 0 ? (
        <p className="muted">Закрытых дней впереди нет.</p>
      ) : (
        <ul className="rest-closed-days">
          {booking.closedDays.map((d) => (
            <li key={d.id}>
              <time dateTime={d.day}>{d.day.split('-').reverse().join('.')}</time>
              {d.reason && <span className="muted">{d.reason}</span>}
              {write && (
                <Button
                  size="sm"
                  tone="secondary"
                  disabled={pending}
                  aria-label={`Открыть день ${d.day.split('-').reverse().join('.')}`}
                  onClick={() => run({ kind: 'open', id: d.id }, 'День снова открыт для броней')}
                >
                  Открыть
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {write && (
        <form
          className="food-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            run(
              { kind: 'close', day: String(f.get('day')), reason: String(f.get('reason') ?? '').trim() || null },
              'День закрыт для броней',
            );
            e.currentTarget.reset();
          }}
        >
          <Field label="Закрыть день">
            <Input name="day" type="date" required disabled={pending} />
          </Field>
          <Field label="Причина">
            <Input name="reason" maxLength={200} disabled={pending} />
          </Field>
          <Button type="submit" tone="secondary" disabled={pending}>
            Закрыть день
          </Button>
        </form>
      )}
    </section>
  );
}

