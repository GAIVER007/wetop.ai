/**
 * Быстрый запуск гостиницы и ресторана (владелец 27.10.2026: «каждую правку во всех вертикалях»). То же окно, что у
 * салона: плитки разделов, поля в окне, проверка до создания с исправлением кнопкой, одна кнопка «Создать».
 * Модель без сети: проверка (`*Issues`), план из существующих действий WETOP (`*Plan`), итоговый экран (`*Done`).
 * Деньги в минорных единицах (AGENTS.md §12): числом там, где их так принимает API (номера, столы, меню, оплата).
 */
import { BRANCH_PAYMENT_METHODS, type BranchPaymentMethod } from '@pms/domain';
import { msg } from '../../../../i18n';
import { emailIssue, filled, key, toMinor, toTime, trim, type QuickIssue as BaseIssue, type VerticalSection } from './model';

export type QuickIssue = BaseIssue<VerticalSection>;
export type InviteChoice = 'NONE' | 'PORTAL' | 'STAFF' | 'MANAGER';
type Invite = Exclude<InviteChoice, 'NONE'> | null;
const invite = (email: string, role: InviteChoice): Invite => (trim(email) && role !== 'NONE' ? role : null);
const minorNumber = (raw: string) => Number(toMinor(raw || '0') ?? '0');
const req = (out: QuickIssue[], section: VerticalSection, row: number, field: string, ok: boolean, text: string) => {
  if (!ok) out.push({ level: 'error', section, row, field, text });
};
const int = (raw: string, min: number, max: number) => {
  const n = Number(trim(raw));
  return Number.isInteger(n) && n >= min && n <= max;
};
/** только поля, которые решают «строка заполнена» (значения по умолчанию вроде «2 гостя» не считаются) */
const pick = <T extends object, K extends keyof T>(rows: T[], keys: K[]) =>
  rows.map((r) => Object.fromEntries(keys.map((k) => [k, r[k]])) as Pick<T, K>);
const DEFAULT_PAYMENTS: BranchPaymentMethod[] = ['CASH', 'CARD_TERMINAL'];

/* ────────────────────────────── гостиница ────────────────────────────── */

export type RoomKind = 'PRIVATE_ROOM' | 'DORM_BED' | 'APARTMENT';
export type HotelPay = 'FIXED' | 'BONUS_ONLY';
export interface HotelStart {
  hotel: { name: string; address: string; phone: string; currency: string; checkIn: string; checkOut: string; payments: BranchPaymentMethod[] };
  rooms: Array<{ name: string; kind: RoomKind; guests: string; count: string; price: string }>;
  extras: Array<{ name: string; price: string }>;
  staff: Array<{ name: string; email: string; phone: string; role: InviteChoice; pay: HotelPay; fixed: string; perCleaning: string }>;
}
export interface HotelPlan {
  provision: { currency: string; categories: Array<{ name: string; kind: RoomKind; capacityAdults: number; units: number; priceMinor: number }> };
  settings: { name: string; address: string; phone: string; checkInTime: string; checkOutTime: string };
  extras: Array<{ name: string; price: string }>;
  staff: Array<{ name: string; email: string; phone: string; invite: Invite; pay: { model: HotelPay; fixedMinor: number; percent: 0; perCleaningMinor: number } }>;
  payments: Array<{ method: BranchPaymentMethod; enabled: boolean }>;
}

export function emptyHotelStart(currency: string): HotelStart {
  return {
    hotel: { name: '', address: '', phone: '', currency, checkIn: '14:00', checkOut: '12:00', payments: [...DEFAULT_PAYMENTS] },
    rooms: [{ name: '', kind: 'PRIVATE_ROOM', guests: '2', count: '', price: '' }],
    extras: [],
    staff: [],
  };
}

export function hotelIssues(h: HotelStart): QuickIssue[] {
  const out: QuickIssue[] = [];
  req(out, 'hotel', 0, 'name', Boolean(trim(h.hotel.name)), msg('Укажите название гостиницы'));
  req(out, 'hotel', 0, 'hours', Boolean(toTime(h.hotel.checkIn) && toTime(h.hotel.checkOut)), msg('Время заезда и выезда в виде 14:00'));
  req(out, 'hotel', 0, 'payments', h.hotel.payments.length > 0, msg('Включите хотя бы один способ оплаты'));
  const names = new Set<string>();
  for (const [r, i] of filled(pick(h.rooms, ['name', 'count', 'price']))) {
    const room = h.rooms[i]!;
    req(out, 'rooms', i, 'name', Boolean(trim(room.name)) && !names.has(key(room.name)), trim(room.name) ? msg('Категория повторяется') : msg('Укажите название категории'));
    if (trim(r.name)) names.add(key(r.name));
    req(out, 'rooms', i, 'guests', int(room.guests, 1, 20), msg('Гостей в номере: от 1 до 20'));
    req(out, 'rooms', i, 'count', int(room.count, 1, 500), msg('Сколько таких номеров: от 1 до 500'));
    req(out, 'rooms', i, 'price', (toMinor(room.price) ?? '0') !== '0', msg('Цена за ночь числом'));
  }
  req(out, 'rooms', 0, 'rows', names.size > 0, msg('Добавьте хотя бы одну категорию номеров'));
  for (const [e, i] of filled(h.extras)) {
    req(out, 'extras', i, 'name', Boolean(trim(e.name)), msg('Укажите название услуги'));
    req(out, 'extras', i, 'price', (toMinor(e.price) ?? '0') !== '0', msg('Цена числом'));
  }
  const emails = new Set<string>();
  for (const [p, i] of filled(pick(h.staff, ['name', 'email', 'phone', 'fixed', 'perCleaning']))) {
    const s = h.staff[i]!;
    req(out, 'staff', i, 'name', Boolean(trim(p.name)), msg('Укажите имя сотрудника'));
    const mail = emailIssue('staff', i, s.email);
    if (mail) out.push(mail);
    if (trim(s.email) && emails.has(key(s.email))) out.push({ level: 'error', section: 'staff', row: i, field: 'email', text: msg('Почта повторяется') });
    if (trim(s.email)) emails.add(key(s.email));
    if (s.role !== 'NONE' && !trim(s.email)) req(out, 'staff', i, 'email', false, msg('Для входа нужна почта'));
    req(out, 'staff', i, 'pay', toMinor(s.fixed || '0') !== null && toMinor(s.perCleaning || '0') !== null, msg('Оплата числом'));
  }
  return out;
}

export function hotelPlan(h: HotelStart): HotelPlan {
  return {
    provision: {
      currency: h.hotel.currency,
      categories: filled(pick(h.rooms, ['name', 'count', 'price'])).map(([, i]) => {
        const r = h.rooms[i]!;
        return { name: trim(r.name), kind: r.kind, capacityAdults: Number(trim(r.guests)), units: Number(trim(r.count)), priceMinor: minorNumber(r.price) };
      }),
    },
    settings: {
      name: trim(h.hotel.name),
      address: trim(h.hotel.address),
      phone: trim(h.hotel.phone),
      checkInTime: toTime(h.hotel.checkIn) ?? '14:00',
      checkOutTime: toTime(h.hotel.checkOut) ?? '12:00',
    },
    // каталог услуг гостиницы принимает цену строкой («45», «45.50»)
    extras: filled(h.extras).map(([e]) => ({ name: trim(e.name), price: trim(e.price).replace(',', '.') })),
    staff: filled(pick(h.staff, ['name', 'email', 'phone', 'fixed', 'perCleaning'])).map(([, i]) => {
      const s = h.staff[i]!;
      return {
        name: trim(s.name),
        email: trim(s.email),
        phone: trim(s.phone),
        invite: invite(s.email, s.role),
        pay: { model: s.pay, fixedMinor: s.pay === 'FIXED' ? minorNumber(s.fixed) : 0, percent: 0 as const, perCleaningMinor: minorNumber(s.perCleaning) },
      };
    }),
    payments: BRANCH_PAYMENT_METHODS.filter((m) => m !== 'OTHER').map((method) => ({ method, enabled: h.hotel.payments.includes(method) })),
  };
}

export interface TeamRow {
  name: string;
  role: Invite;
  pay: string;
  invite: 'sent' | 'failed' | 'none';
}
const inviteState = (email: string, inv: Invite, failed: Set<string>) =>
  !email || !inv ? ('none' as const) : failed.has(key(email)) ? ('failed' as const) : ('sent' as const);

export interface HotelDone {
  title: string;
  line: { address: string; checkIn: string; checkOut: string; currency: string };
  counts: { categories: number; units: number; extras: number; staff: number; invites: number };
  rooms: Array<{ name: string; units: number; guests: number; priceMinor: string }>;
  extras: Array<{ name: string; priceMinor: string }>;
  team: Array<TeamRow & { payMinor: { fixedMinor: string; perCleaningMinor: string } }>;
  payments: BranchPaymentMethod[];
}
export function hotelDone(plan: HotelPlan, failedEmails: string[]): HotelDone {
  const failed = new Set(failedEmails.map(key));
  const team = plan.staff.map((s) => ({
    name: s.name,
    role: s.invite,
    pay: s.pay.model,
    invite: inviteState(s.email, s.invite, failed),
    payMinor: { fixedMinor: String(s.pay.fixedMinor), perCleaningMinor: String(s.pay.perCleaningMinor) },
  }));
  return {
    title: plan.settings.name,
    line: { address: plan.settings.address, checkIn: plan.settings.checkInTime, checkOut: plan.settings.checkOutTime, currency: plan.provision.currency },
    counts: {
      categories: plan.provision.categories.length,
      units: plan.provision.categories.reduce((n, c) => n + c.units, 0),
      extras: plan.extras.length,
      staff: plan.staff.length,
      invites: team.filter((m) => m.invite === 'sent').length,
    },
    rooms: plan.provision.categories.map((c) => ({ name: c.name, units: c.units, guests: c.capacityAdults, priceMinor: String(c.priceMinor) })),
    extras: plan.extras.map((e) => ({ name: e.name, priceMinor: toMinor(e.price) ?? '0' })),
    team,
    payments: plan.payments.filter((p) => p.enabled).map((p) => p.method),
  };
}

/* ────────────────────────────── ресторан ────────────────────────────── */

export type RestaurantPay = 'FIXED' | 'PERCENT' | 'FIXED_PLUS_PERCENT';
export type Station = 'KITCHEN' | 'BAR';
export interface RestaurantStart {
  restaurant: { name: string; address: string; phone: string; currency: string; timezone: string; payments: BranchPaymentMethod[] };
  tables: Array<{ area: string; name: string; seats: string }>;
  menu: Array<{ category: string; name: string; price: string; station: Station }>;
  staff: Array<{ name: string; email: string; phone: string; role: InviteChoice; pay: RestaurantPay; fixed: string; percent: string }>;
}
export interface RestaurantPlan {
  profile: { businessName: string; locationName: string; currency: string; timezone: string; address: string; phone: string };
  areas: Array<{ name: string; tables: Array<{ name: string; capacity: number }> }>;
  menu: Array<{ name: string; station: Station; items: Array<{ name: string; price: number }> }>;
  staff: Array<{ name: string; email: string; phone: string; invite: Invite; pay: { model: RestaurantPay; fixedMinor: number; percent: number } }>;
  payments: Array<{ method: BranchPaymentMethod; enabled: boolean }>;
}

export function emptyRestaurantStart(currency: string, timezone: string): RestaurantStart {
  return {
    restaurant: { name: '', address: '', phone: '', currency, timezone, payments: [...DEFAULT_PAYMENTS] },
    tables: [{ area: '', name: '', seats: '4' }],
    menu: [{ category: '', name: '', price: '', station: 'KITCHEN' }],
    staff: [],
  };
}

export function restaurantIssues(r: RestaurantStart): QuickIssue[] {
  const out: QuickIssue[] = [];
  req(out, 'restaurant', 0, 'name', Boolean(trim(r.restaurant.name)), msg('Укажите название ресторана'));
  req(out, 'restaurant', 0, 'payments', r.restaurant.payments.length > 0, msg('Включите хотя бы один способ оплаты'));
  const tables = new Set<string>();
  let anyTable = false;
  for (const [t, i] of filled(pick(r.tables, ['area', 'name']))) {
    anyTable = true;
    const row = r.tables[i]!;
    req(out, 'tables', i, 'area', Boolean(trim(t.area)), msg('Укажите зал'));
    const id = `${key(t.area)}\u0000${key(t.name)}`;
    req(out, 'tables', i, 'name', Boolean(trim(t.name)) && !tables.has(id), trim(t.name) ? msg('Такой стол в этом зале уже есть') : msg('Укажите номер стола'));
    tables.add(id);
    req(out, 'tables', i, 'seats', int(row.seats, 1, 50), msg('Мест за столом: от 1 до 50'));
  }
  req(out, 'tables', 0, 'rows', anyTable, msg('Добавьте хотя бы один стол'));
  const dishes = new Set<string>();
  for (const [m, i] of filled(pick(r.menu, ['category', 'name', 'price']))) {
    req(out, 'menu', i, 'category', Boolean(trim(m.category)), msg('Укажите раздел меню'));
    req(out, 'menu', i, 'name', Boolean(trim(m.name)), msg('Укажите название блюда'));
    req(out, 'menu', i, 'price', (toMinor(m.price) ?? '0') !== '0', msg('Цена числом'));
    if (trim(m.name)) {
      if (dishes.has(key(m.name)))
        out.push({ level: 'warning', section: 'menu', row: i, field: 'name', text: msg('Блюдо повторяется'), fix: { kind: 'remove-row', label: msg('Убрать') } });
      dishes.add(key(m.name));
    }
  }
  const emails = new Set<string>();
  for (const [p, i] of filled(pick(r.staff, ['name', 'email', 'phone', 'fixed', 'percent']))) {
    const s = r.staff[i]!;
    req(out, 'staff', i, 'name', Boolean(trim(p.name)), msg('Укажите имя сотрудника'));
    const mail = emailIssue('staff', i, s.email);
    if (mail) out.push(mail);
    if (trim(s.email) && emails.has(key(s.email))) out.push({ level: 'error', section: 'staff', row: i, field: 'email', text: msg('Почта повторяется') });
    if (trim(s.email)) emails.add(key(s.email));
    if (s.role !== 'NONE' && !trim(s.email)) req(out, 'staff', i, 'email', false, msg('Для входа нужна почта'));
    const pct = Number(trim(s.percent) || '0');
    req(out, 'staff', i, 'pay', toMinor(s.fixed || '0') !== null && Number.isInteger(pct) && pct >= 0 && pct <= 100, msg('Зарплата: оклад числом, процент от 0 до 100'));
  }
  return out;
}

export function restaurantPlan(r: RestaurantStart): RestaurantPlan {
  const areas: RestaurantPlan['areas'] = [];
  for (const [, i] of filled(pick(r.tables, ['area', 'name']))) {
    const t = r.tables[i]!;
    let area = areas.find((a) => key(a.name) === key(t.area));
    if (!area) areas.push((area = { name: trim(t.area), tables: [] }));
    area.tables.push({ name: trim(t.name), capacity: Number(trim(t.seats)) });
  }
  const menu: RestaurantPlan['menu'] = [];
  for (const [, i] of filled(pick(r.menu, ['category', 'name', 'price']))) {
    const m = r.menu[i]!;
    let cat = menu.find((c) => key(c.name) === key(m.category));
    if (!cat) menu.push((cat = { name: trim(m.category), station: m.station, items: [] }));
    cat.items.push({ name: trim(m.name), price: minorNumber(m.price) });
  }
  return {
    profile: {
      businessName: trim(r.restaurant.name),
      locationName: trim(r.restaurant.name),
      currency: r.restaurant.currency,
      timezone: r.restaurant.timezone,
      address: trim(r.restaurant.address),
      phone: trim(r.restaurant.phone),
    },
    areas,
    menu,
    staff: filled(pick(r.staff, ['name', 'email', 'phone', 'fixed', 'percent'])).map(([, i]) => {
      const s = r.staff[i]!;
      return {
        name: trim(s.name),
        email: trim(s.email),
        phone: trim(s.phone),
        invite: invite(s.email, s.role),
        pay: { model: s.pay, fixedMinor: s.pay === 'PERCENT' ? 0 : minorNumber(s.fixed), percent: s.pay === 'FIXED' ? 0 : Number(trim(s.percent) || '0') },
      };
    }),
    payments: BRANCH_PAYMENT_METHODS.map((method) => ({ method, enabled: r.restaurant.payments.includes(method) })),
  };
}

export interface RestaurantDone {
  title: string;
  line: { address: string; currency: string };
  counts: { areas: number; tables: number; seats: number; dishes: number; staff: number; invites: number };
  areas: Array<{ name: string; tables: number; seats: number }>;
  menu: Array<{ name: string; category: string; priceMinor: string }>;
  team: Array<TeamRow & { payMinor: { fixedMinor: string; percent: number } }>;
  payments: BranchPaymentMethod[];
}
export function restaurantDone(plan: RestaurantPlan, failedEmails: string[]): RestaurantDone {
  const failed = new Set(failedEmails.map(key));
  const team = plan.staff.map((s) => ({
    name: s.name,
    role: s.invite,
    pay: s.pay.model,
    invite: inviteState(s.email, s.invite, failed),
    payMinor: { fixedMinor: String(s.pay.fixedMinor), percent: s.pay.percent },
  }));
  const tables = plan.areas.flatMap((a) => a.tables);
  return {
    title: plan.profile.businessName,
    line: { address: plan.profile.address, currency: plan.profile.currency },
    counts: {
      areas: plan.areas.length,
      tables: tables.length,
      seats: tables.reduce((n, t) => n + t.capacity, 0),
      dishes: plan.menu.reduce((n, c) => n + c.items.length, 0),
      staff: plan.staff.length,
      invites: team.filter((m) => m.invite === 'sent').length,
    },
    areas: plan.areas.map((a) => ({ name: a.name, tables: a.tables.length, seats: a.tables.reduce((n, t) => n + t.capacity, 0) })),
    menu: plan.menu.flatMap((c) => c.items.map((i) => ({ name: i.name, category: c.name, priceMinor: String(i.price) }))),
    team,
    payments: plan.payments.filter((p) => p.enabled).map((p) => p.method),
  };
}
