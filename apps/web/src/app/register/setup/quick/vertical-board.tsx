'use client';
import { useMemo, useRef, useState, useTransition, type ClipboardEvent } from 'react';
import type { BranchPaymentMethod } from '@pms/domain';
import { Alert, Button, Input } from '../../../../components/ui';
import { formatMoney } from '../../../../lib/money';
import { msg } from '../../../../i18n';
import { useT } from '../../../../i18n/locale-provider';
import { parseRows, type VerticalSection } from './model';
import { Chips, DoneLayout, InvitePill, IssueList, Person, RowsTable, Tiles, type Column, type TileState } from './parts';
import { createQuickHotel, createQuickRestaurant, type VerticalResult } from './vertical-actions';
import {
  emptyHotelStart,
  emptyRestaurantStart,
  hotelIssues,
  restaurantIssues,
  type HotelDone,
  type HotelStart,
  type QuickIssue,
  type RestaurantDone,
  type RestaurantStart,
} from './vertical-model';

/**
 * Быстрый запуск гостиницы и ресторана (владелец 27.10.2026: «во всех вертикалях»): то же окно, что у салона.
 * Плитки разделов, поля в окне, вставка строк, проверка до создания, одна кнопка «Создать», итог вариант А.
 */
const PAYMENTS: Array<[BranchPaymentMethod, string]> = [
  ['CASH', msg('Наличные')],
  ['CARD_TERMINAL', msg('Карта')],
  ['BANK_TRANSFER_LEGAL', msg('Перевод на счёт компании')],
  ['BANK_TRANSFER_PERSON', msg('Перевод на личный счёт')],
];
const ROLES: Array<[string, string]> = [
  ['NONE', msg('Без входа')],
  ['PORTAL', msg('Личный кабинет')],
  ['STAFF', msg('Администратор')],
  ['MANAGER', msg('Управляющий')],
];
const PAYMENT_LABEL = Object.fromEntries([...PAYMENTS, ['OTHER', msg('Другое')]]) as Record<string, string>;
const isFilled = (r: object) => Object.values(r).some((v) => (Array.isArray(v) ? v.length : String(v).trim()));

function useSections<S extends string>(issues: QuickIssue[], counts: Record<S, number>) {
  return (id: S): TileState =>
    issues.some((i) => i.section === id && i.level === 'error')
      ? 'error'
      : issues.some((i) => i.section === id)
        ? 'warning'
        : counts[id]
          ? 'done'
          : 'empty';
}

/** вставка строк: колонки по табуляции; строки, где введённые поля пусты (только значения по умолчанию), заменяются */
function paste<R>(columns: Array<keyof R & string>, make: (cells: string[]) => R, set: (fn: (rows: R[]) => R[]) => void, width = columns.length) {
  return (e: ClipboardEvent<HTMLTableSectionElement>) => {
    const text = e.clipboardData.getData('text');
    if (!text.includes('\t') && !text.includes('\n')) return;
    e.preventDefault();
    const added = parseRows(text, width).map(make);
    set((rows) => [...rows.filter((r) => columns.some((c) => String(r[c] ?? '').trim())), ...added]);
  };
}

function Footer({ pending, disabled, label, error, onCreate }: { pending: boolean; disabled: boolean; label: string; error?: string | undefined; onCreate: () => void }) {
  const t = useT();
  return (
    <>
      {error && <Alert>{error}</Alert>}
      <div className="quick-actions">
        <span className="hint">{t('Каждому с почтой придёт приглашение')}</span>
        <Button type="button" className="quick-go" disabled={pending || disabled} onClick={onCreate}>
          {pending ? t('Создаём…') : t(label)}
        </Button>
      </div>
    </>
  );
}

/* ────────────────────────────── гостиница ────────────────────────────── */

type HotelTab = 'hotel' | 'rooms' | 'extras' | 'staff';
export function QuickHotelBoard({ currency, name }: { currency: string; name: string }) {
  const t = useT();
  const [h, setH] = useState<HotelStart>(() => {
    const s = emptyHotelStart(currency);
    return { ...s, hotel: { ...s.hotel, name } };
  });
  const [open, setOpen] = useState<HotelTab>('hotel');
  const [result, setResult] = useState<VerticalResult<HotelDone> | null>(null);
  const [pending, start] = useTransition();
  const attempt = useRef(crypto.randomUUID());
  const issues = useMemo(() => hotelIssues(h), [h]);
  const cell = (section: string) => (row: number, field: string) => {
    const i = issues.find((x) => x.section === section && x.row === row && x.field === field);
    return i ? (i.level === 'error' ? 'quick-cell is-error' : 'quick-cell is-warning') : 'quick-cell';
  };
  const counts = { hotel: h.hotel.name.trim() ? 1 : 0, rooms: h.rooms.filter(isFilled).length, extras: h.extras.filter(isFilled).length, staff: h.staff.filter(isFilled).length };
  const state = useSections<HotelTab>(issues, counts);
  const hotel = (patch: Partial<HotelStart['hotel']>) => setH((p) => ({ ...p, hotel: { ...p.hotel, ...patch } }));
  const rows = <K extends 'rooms' | 'extras' | 'staff'>(k: K) => ({
    change: (i: number, patch: Partial<HotelStart[K][number]>) =>
      setH((p) => ({ ...p, [k]: p[k].map((r, n) => (n === i ? { ...r, ...patch } : r)) })),
    remove: (i: number) => setH((p) => ({ ...p, [k]: p[k].filter((_, n) => n !== i) })),
    set: (fn: (r: HotelStart[K]) => HotelStart[K]) => setH((p) => ({ ...p, [k]: fn(p[k]) })),
  });
  const EMPTY = {
    rooms: { name: '', kind: 'PRIVATE_ROOM', guests: '2', count: '', price: '' },
    extras: { name: '', price: '' },
    staff: { name: '', email: '', phone: '', role: 'PORTAL', pay: 'FIXED', fixed: '', perCleaning: '' },
  } as const;

  if (result?.ok && result.summary) {
    const s = result.summary;
    const money = (m: string) => formatMoney(m, s.line.currency);
    return (
      <DoneLayout
        title={t('{name} готова к работе', { name: s.title })}
        line={[s.line.address, t('заезд {in}, выезд {out}', { in: s.line.checkIn, out: s.line.checkOut }), s.line.currency].filter(Boolean).join(', ')}
        kpis={[
          [s.counts.categories, msg('категории')],
          [s.counts.units, msg('номера и места')],
          [s.counts.extras, msg('услуги')],
          [s.counts.staff, msg('сотрудники')],
          [s.counts.invites, msg('приглашения')],
        ]}
        cards={[
          {
            title: msg('Номера'),
            rows: s.rooms.map((r) => ({ key: r.name, cells: [r.name, t('номеров: {n}, гостей до {g}', { n: r.units, g: r.guests }), money(r.priceMinor)] })),
          },
          {
            title: msg('Команда'),
            rows: s.team.map((m) => ({
              key: m.name,
              cells: [<Person key="p" name={m.name} />, m.pay === 'FIXED' ? money(m.payMinor.fixedMinor) : t('за уборки'), <InvitePill key="i" state={m.invite} />],
            })),
          },
          {
            title: msg('Услуги и оплата'),
            rows: [
              ...s.extras.map((e) => ({ key: `e:${e.name}`, cells: [e.name, money(e.priceMinor)] })),
              ...s.payments.map((m) => ({ key: `p:${m}`, cells: [t(PAYMENT_LABEL[m] ?? m), <span key="o" className="quick-done__ok">{t('включено')}</span>] })),
            ],
          },
        ]}
        warnings={result.warnings}
        actions={[
          { href: '/team', label: msg('Пригласить ещё') },
          { href: '/settings', label: msg('Настройки гостиницы') },
          { href: '/chessboard', label: msg('Открыть шахматку'), primary: true },
        ]}
      />
    );
  }

  const roomCols: Column<HotelStart['rooms'][number]>[] = [
    { field: 'name', label: msg('Категория') },
    { field: 'kind', label: msg('Тип'), kind: 'select', options: [['PRIVATE_ROOM', msg('Номер')], ['DORM_BED', msg('Койко-место')], ['APARTMENT', msg('Апартаменты')]] },
    { field: 'guests', label: msg('Гостей'), kind: 'number' },
    { field: 'count', label: msg('Сколько'), kind: 'number' },
    { field: 'price', label: msg('Цена за ночь'), kind: 'number' },
  ];
  const staffCols: Column<HotelStart['staff'][number]>[] = [
    { field: 'name', label: msg('Имя') },
    { field: 'email', label: msg('Почта'), kind: 'email' },
    { field: 'phone', label: msg('Телефон'), kind: 'tel' },
    { field: 'role', label: msg('Вход'), kind: 'select', options: ROLES },
    { field: 'pay', label: msg('Оплата'), kind: 'select', options: [['FIXED', msg('Оклад')], ['BONUS_ONLY', msg('Без оклада')]] },
    { field: 'fixed', label: msg('Оклад'), kind: 'number', hidden: (r) => r.pay !== 'FIXED' },
    { field: 'perCleaning', label: msg('За уборку'), kind: 'number' },
  ];
  const tab = issues.filter((i) => i.section === open);
  return (
    <section className="quick" data-testid="quick-start" aria-label={t('Запуск гостиницы')}>
      <Tiles<HotelTab>
        open={open}
        onOpen={setOpen}
        tiles={[
          { id: 'hotel', title: msg('Гостиница'), count: counts.hotel, state: state('hotel') },
          { id: 'rooms', title: msg('Номера'), count: counts.rooms, state: state('rooms') },
          { id: 'extras', title: msg('Услуги'), count: counts.extras, state: state('extras'), optional: true },
          { id: 'staff', title: msg('Сотрудники'), count: counts.staff, state: state('staff'), optional: true },
        ]}
      />
      <div className="quick-panel" role="tabpanel">
        {open === 'hotel' && (
          <div className="quick-salon">
            <label className={cell('hotel')(0, 'name')}>
              <span>{t('Название')}</span>
              <Input value={h.hotel.name} maxLength={200} onChange={(e) => hotel({ name: e.target.value })} />
            </label>
            <label className="quick-cell quick-wide">
              <span>{t('Адрес')}</span>
              <Input value={h.hotel.address} maxLength={500} onChange={(e) => hotel({ address: e.target.value })} />
            </label>
            <label className="quick-cell">
              <span>{t('Телефон')}</span>
              <Input type="tel" value={h.hotel.phone} maxLength={50} onChange={(e) => hotel({ phone: e.target.value })} />
            </label>
            <div className={cell('hotel')(0, 'hours')}>
              <span>{t('Заезд и выезд')}</span>
              <div className="quick-pair">
                <Input type="time" aria-label={t('Заезд')} value={h.hotel.checkIn} onChange={(e) => hotel({ checkIn: e.target.value })} />
                <Input type="time" aria-label={t('Выезд')} value={h.hotel.checkOut} onChange={(e) => hotel({ checkOut: e.target.value })} />
              </div>
            </div>
            <div className={cell('hotel')(0, 'payments')}>
              <span>{t('Оплата')}</span>
              <Chips options={PAYMENTS} value={h.hotel.payments} onChange={(payments) => hotel({ payments })} />
            </div>
          </div>
        )}
        {open === 'rooms' && (
          <RowsTable
            rows={h.rooms}
            columns={roomCols}
            cellClass={cell('rooms')}
            onChange={rows('rooms').change}
            onRemove={rows('rooms').remove}
            onPaste={paste(['name', 'count', 'price'], (c) => ({ name: c[0]!, kind: 'PRIVATE_ROOM' as const, guests: c[1] || '2', count: c[2]!, price: c[3]! }) /* колонки: категория, гостей, сколько, цена */, rows('rooms').set, 4)}
          />
        )}
        {open === 'extras' && (
          <RowsTable
            rows={h.extras}
            columns={[
              { field: 'name', label: msg('Услуга') },
              { field: 'price', label: msg('Цена'), kind: 'number' },
            ]}
            cellClass={cell('extras')}
            onChange={rows('extras').change}
            onRemove={rows('extras').remove}
            onPaste={paste(['name', 'price'], (c) => ({ name: c[0]!, price: c[1]! }), rows('extras').set)}
          />
        )}
        {open === 'staff' && (
          <RowsTable
            rows={h.staff}
            columns={staffCols}
            cellClass={cell('staff')}
            onChange={rows('staff').change}
            onRemove={rows('staff').remove}
            onPaste={paste(['name', 'email', 'phone'], (c) => ({ ...EMPTY.staff, name: c[0]!, email: c[1]!, phone: c[2]! }), rows('staff').set)}
          />
        )}
        {open !== 'hotel' && (
          <Button type="button" tone="secondary" onClick={() => rows(open).set((r) => [...r, { ...EMPTY[open] }] as never)}>
            {t('+ Добавить строку')}
          </Button>
        )}
        <IssueList<VerticalSection>
          issues={tab}
          rowName={(i) => (i.section === 'hotel' ? '' : ((h[i.section as 'rooms'][i.row] as { name?: string } | undefined)?.name?.trim() ?? ''))}
          onFix={(i) => {
            if (i.fix?.kind === 'set' && i.section === 'staff') rows('staff').change(i.row, { email: i.fix.value });
            else if (i.fix?.kind === 'remove-row' && i.section !== 'hotel') rows(i.section as 'rooms').remove(i.row);
          }}
        />
      </div>
      <Footer
        pending={pending}
        disabled={issues.some((i) => i.level === 'error')}
        label={msg('Создать гостиницу')}
        error={result?.error}
        onCreate={() => start(async () => setResult(await createQuickHotel(h, attempt.current)))}
      />
    </section>
  );
}

/* ────────────────────────────── ресторан ────────────────────────────── */

type FoodTab = 'restaurant' | 'tables' | 'menu' | 'staff';
export function QuickRestaurantBoard({ currency, timezone, name }: { currency: string; timezone: string; name: string }) {
  const t = useT();
  const [r, setR] = useState<RestaurantStart>(() => {
    const s = emptyRestaurantStart(currency, timezone);
    return { ...s, restaurant: { ...s.restaurant, name } };
  });
  const [open, setOpen] = useState<FoodTab>('restaurant');
  const [result, setResult] = useState<VerticalResult<RestaurantDone> | null>(null);
  const [pending, start] = useTransition();
  const attempt = useRef(crypto.randomUUID());
  const issues = useMemo(() => restaurantIssues(r), [r]);
  const cell = (section: string) => (row: number, field: string) => {
    const i = issues.find((x) => x.section === section && x.row === row && x.field === field);
    return i ? (i.level === 'error' ? 'quick-cell is-error' : 'quick-cell is-warning') : 'quick-cell';
  };
  const counts = {
    restaurant: r.restaurant.name.trim() ? 1 : 0,
    tables: r.tables.filter((x) => x.name.trim() || x.area.trim()).length,
    menu: r.menu.filter((x) => x.name.trim() || x.category.trim()).length,
    staff: r.staff.filter(isFilled).length,
  };
  const state = useSections<FoodTab>(issues, counts);
  const restaurant = (patch: Partial<RestaurantStart['restaurant']>) => setR((p) => ({ ...p, restaurant: { ...p.restaurant, ...patch } }));
  const rows = <K extends 'tables' | 'menu' | 'staff'>(k: K) => ({
    change: (i: number, patch: Partial<RestaurantStart[K][number]>) =>
      setR((p) => ({ ...p, [k]: p[k].map((x, n) => (n === i ? { ...x, ...patch } : x)) })),
    remove: (i: number) => setR((p) => ({ ...p, [k]: p[k].filter((_, n) => n !== i) })),
    set: (fn: (x: RestaurantStart[K]) => RestaurantStart[K]) => setR((p) => ({ ...p, [k]: fn(p[k]) })),
  });
  const EMPTY = {
    tables: { area: '', name: '', seats: '4' },
    menu: { category: '', name: '', price: '', station: 'KITCHEN' },
    staff: { name: '', email: '', phone: '', role: 'PORTAL', pay: 'FIXED', fixed: '', percent: '' },
  } as const;

  if (result?.ok && result.summary) {
    const s = result.summary;
    const money = (m: string) => formatMoney(m, s.line.currency);
    const SHOWN = 9;
    return (
      <DoneLayout
        title={t('{name} готов к работе', { name: s.title })}
        line={[s.line.address, s.line.currency].filter(Boolean).join(', ')}
        kpis={[
          [s.counts.tables, msg('столы')],
          [s.counts.seats, msg('места')],
          [s.counts.dishes, msg('блюда')],
          [s.counts.staff, msg('сотрудники')],
          [s.counts.invites, msg('приглашения')],
        ]}
        cards={[
          {
            title: msg('Команда'),
            rows: s.team.map((m) => ({
              key: m.name,
              cells: [
                <Person key="p" name={m.name} />,
                m.pay === 'PERCENT'
                  ? `${m.payMinor.percent}%`
                  : m.pay === 'FIXED'
                    ? money(m.payMinor.fixedMinor)
                    : `${money(m.payMinor.fixedMinor)} + ${m.payMinor.percent}%`,
                <InvitePill key="i" state={m.invite} />,
              ],
            })),
          },
          {
            title: msg('Меню'),
            rows: s.menu.slice(0, SHOWN).map((d) => ({ key: d.name, cells: [d.name, d.category, money(d.priceMinor)] })),
            ...(s.menu.length > SHOWN ? { more: { href: '/menu', label: t('и ещё {n}', { n: s.menu.length - SHOWN }) } } : {}),
          },
          {
            title: msg('Залы и оплата'),
            rows: [
              ...s.areas.map((a) => ({ key: `a:${a.name}`, cells: [a.name, t('столов: {n}, мест: {s}', { n: a.tables, s: a.seats })] })),
              ...s.payments.map((m) => ({ key: `p:${m}`, cells: [t(PAYMENT_LABEL[m] ?? m), <span key="o" className="quick-done__ok">{t('включено')}</span>] })),
            ],
          },
        ]}
        warnings={result.warnings}
        actions={[
          { href: '/team', label: msg('Пригласить ещё') },
          { href: '/menu', label: msg('Меню') },
          { href: '/floor-plan', label: msg('Открыть зал'), primary: true },
        ]}
      />
    );
  }

  const tab = issues.filter((i) => i.section === open);
  return (
    <section className="quick" data-testid="quick-start" aria-label={t('Запуск ресторана')}>
      <Tiles<FoodTab>
        open={open}
        onOpen={setOpen}
        tiles={[
          { id: 'restaurant', title: msg('Ресторан'), count: counts.restaurant, state: state('restaurant') },
          { id: 'tables', title: msg('Столы'), count: counts.tables, state: state('tables') },
          { id: 'menu', title: msg('Меню'), count: counts.menu, state: state('menu'), optional: true },
          { id: 'staff', title: msg('Сотрудники'), count: counts.staff, state: state('staff'), optional: true },
        ]}
      />
      <div className="quick-panel" role="tabpanel">
        {open === 'restaurant' && (
          <div className="quick-salon">
            <label className={cell('restaurant')(0, 'name')}>
              <span>{t('Название')}</span>
              <Input value={r.restaurant.name} maxLength={200} onChange={(e) => restaurant({ name: e.target.value })} />
            </label>
            <label className="quick-cell quick-wide">
              <span>{t('Адрес')}</span>
              <Input value={r.restaurant.address} maxLength={500} onChange={(e) => restaurant({ address: e.target.value })} />
            </label>
            <label className="quick-cell">
              <span>{t('Телефон')}</span>
              <Input type="tel" value={r.restaurant.phone} maxLength={50} onChange={(e) => restaurant({ phone: e.target.value })} />
            </label>
            <div className={`${cell('restaurant')(0, 'payments')} quick-wide`}>
              <span>{t('Оплата')}</span>
              <Chips options={[...PAYMENTS, ['OTHER', msg('Другое')]]} value={r.restaurant.payments} onChange={(payments) => restaurant({ payments })} />
            </div>
          </div>
        )}
        {open === 'tables' && (
          <RowsTable
            rows={r.tables}
            columns={[
              { field: 'area', label: msg('Зал') },
              { field: 'name', label: msg('Стол') },
              { field: 'seats', label: msg('Мест'), kind: 'number' },
            ]}
            cellClass={cell('tables')}
            onChange={rows('tables').change}
            onRemove={rows('tables').remove}
            onPaste={paste(['area', 'name'], (c) => ({ area: c[0]!, name: c[1]!, seats: c[2] || '4' }), rows('tables').set, 3)}
          />
        )}
        {open === 'menu' && (
          <RowsTable
            rows={r.menu}
            columns={[
              { field: 'category', label: msg('Раздел') },
              { field: 'name', label: msg('Блюдо') },
              { field: 'price', label: msg('Цена'), kind: 'number' },
              { field: 'station', label: msg('Готовит'), kind: 'select', options: [['KITCHEN', msg('Кухня')], ['BAR', msg('Бар')]] },
            ]}
            cellClass={cell('menu')}
            onChange={rows('menu').change}
            onRemove={rows('menu').remove}
            onPaste={paste(['category', 'name', 'price'], (c) => ({ category: c[0]!, name: c[1]!, price: c[2]!, station: 'KITCHEN' as const }), rows('menu').set)}
          />
        )}
        {open === 'staff' && (
          <RowsTable
            rows={r.staff}
            columns={[
              { field: 'name', label: msg('Имя') },
              { field: 'email', label: msg('Почта'), kind: 'email' },
              { field: 'phone', label: msg('Телефон'), kind: 'tel' },
              { field: 'role', label: msg('Вход'), kind: 'select', options: ROLES },
              { field: 'pay', label: msg('Зарплата'), kind: 'select', options: [['FIXED', msg('Оклад')], ['PERCENT', msg('Процент')], ['FIXED_PLUS_PERCENT', msg('Оклад и процент')]] },
              { field: 'fixed', label: msg('Оклад'), kind: 'number', hidden: (x) => x.pay === 'PERCENT' },
              { field: 'percent', label: msg('Процент'), kind: 'number', hidden: (x) => x.pay === 'FIXED' },
            ]}
            cellClass={cell('staff')}
            onChange={rows('staff').change}
            onRemove={rows('staff').remove}
            onPaste={paste(['name', 'email', 'phone'], (c) => ({ ...EMPTY.staff, name: c[0]!, email: c[1]!, phone: c[2]! }), rows('staff').set)}
          />
        )}
        {open !== 'restaurant' && (
          <Button type="button" tone="secondary" onClick={() => rows(open).set((x) => [...x, { ...EMPTY[open] }] as never)}>
            {t('+ Добавить строку')}
          </Button>
        )}
        <IssueList<VerticalSection>
          issues={tab}
          rowName={(i) => (i.section === 'restaurant' ? '' : ((r[i.section as 'menu'][i.row] as { name?: string } | undefined)?.name?.trim() ?? ''))}
          onFix={(i) => {
            if (i.fix?.kind === 'set' && i.section === 'staff') rows('staff').change(i.row, { email: i.fix.value });
            else if (i.fix?.kind === 'remove-row' && i.section !== 'restaurant') rows(i.section as 'menu').remove(i.row);
          }}
        />
      </div>
      <Footer
        pending={pending}
        disabled={issues.some((i) => i.level === 'error')}
        label={msg('Создать ресторан')}
        error={result?.error}
        onCreate={() => start(async () => setResult(await createQuickRestaurant(r, attempt.current)))}
      />
    </section>
  );
}
