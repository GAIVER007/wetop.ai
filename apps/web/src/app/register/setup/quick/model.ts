/**
 * Быстрый запуск салона (владелец 27.10.2026): вся анкета нового клиента в одном окне, одна кнопка «Создать».
 * Модель без сети: проверка до создания (`quickIssues`) и план в виде существующих действий WETOP (`quickPlan`):
 * профиль первичной настройки, часы салона, услуги, мастера с услугами, графиком и оплатой, сотрудники, товары
 * бара, способы оплаты, приглашения. Деньги только строками в минорных единицах (AGENTS.md §12).
 */
import { BRANCH_PAYMENT_METHODS, type BranchPaymentMethod } from '@pms/domain';
import { msg } from '../../../../i18n';

export type QuickPay = 'FIXED' | 'PERCENT' | 'FIXED_PLUS_PERCENT';
export type QuickRole = 'STAFF' | 'MANAGER';
export type QuickSection = 'salon' | 'services' | 'masters' | 'staff' | 'products';
/** разделы гостиницы и ресторана (vertical-model.ts) */
export type VerticalSection = 'hotel' | 'rooms' | 'extras' | 'restaurant' | 'tables' | 'menu' | 'staff';

export interface QuickStart {
  salon: {
    name: string;
    address: string;
    phone: string;
    currency: string;
    timezone: string;
    /** дни недели работы, 0 = воскресенье, как у часов салона */
    days: number[];
    timeFrom: string;
    timeTo: string;
    payments: BranchPaymentMethod[];
  };
  services: Array<{ category: string; name: string; minutes: string; price: string }>;
  masters: Array<{
    name: string;
    email: string;
    phone: string;
    services: string[];
    /** пусто: как у салона */
    timeFrom: string;
    timeTo: string;
    pay: QuickPay;
    fixed: string;
    percent: string;
  }>;
  staff: Array<{ name: string; email: string; phone: string; role: QuickRole }>;
  products: Array<{ category: string; name: string; price: string }>;
}

export interface QuickIssue<S extends string = QuickSection> {
  level: 'error' | 'warning';
  section: S;
  row: number;
  field: string;
  text: string;
  /** подстановки в текст при показе: t(text, params) */
  params?: Record<string, string>;
  /** подстановка одним нажатием */
  fix?: { kind: 'set'; value: string; label: string } | { kind: 'remove-row'; label: string };
  /** выбор из двух решений (часы мастера дольше салона) */
  choices?: Array<{ kind: 'salon-until' | 'master-until'; value: string; label: string }>;
}

export interface QuickPlanMaster {
  name: string;
  email: string;
  phone: string;
  personnelKind: 'SPECIALIST' | 'BOTH';
  services: string[];
  hours: Array<{ weekday: number; timeFrom: string; timeTo: string }>;
  pay: { model: QuickPay; fixedMinor: string; percent: number };
  /** уровень входа: мастер видит своё (PORTAL), админ-мастер работает со стойкой (STAFF) */
  invite: 'PORTAL' | 'STAFF' | 'MANAGER' | null;
}

export interface QuickPlan {
  profile: {
    businessName: string;
    locationName: string;
    currency: string;
    timezone: string;
    address: string;
    phone: string;
  };
  hours: Array<{ weekday: number; timeFrom: string; timeTo: string }>;
  services: Array<{ name: string; category: string; durationMinutes: string; priceMinor: string }>;
  masters: QuickPlanMaster[];
  staff: Array<{
    name: string;
    email: string;
    phone: string;
    personnelKind: 'OTHER_EMPLOYEE';
    invite: QuickRole | null;
  }>;
  products: Array<{ category: string; name: string; salePriceMinor: string }>;
  payments: Array<{ method: BranchPaymentMethod; enabled: boolean }>;
}

export const WEEK = [1, 2, 3, 4, 5, 6, 0] as const;
const DEFAULT_PAYMENTS: BranchPaymentMethod[] = ['CASH', 'CARD_TERMINAL'];

export function emptyQuickStart(currency: string, timezone: string): QuickStart {
  return {
    salon: {
      name: '',
      address: '',
      phone: '',
      currency,
      timezone,
      days: [1, 2, 3, 4, 5, 6, 0],
      timeFrom: '10:00',
      timeTo: '20:00',
      payments: [...DEFAULT_PAYMENTS],
    },
    services: [],
    masters: [],
    staff: [],
    products: [],
  };
}

export const trim = (v: string) => v.replace(/\s+/g, ' ').trim();
export const key = (v: string) => trim(v).toLocaleLowerCase();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
/** почтовые сервисы, у которых пользователи путают зону */
const TYPO_DOMAINS: Record<string, string> = {
  'gmail.ru': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'icloud.ru': 'icloud.com',
  'hotmail.ru': 'hotmail.com',
};
/** строки-образцы из шаблона анкеты: в салон не идут */
const SAMPLE = /@pearl-beauty\.example$/i;

/** «380», «380.50», «1 200» → минорные единицы строкой; пусто или не число → null */
export function toMinor(raw: string): string | null {
  const m = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(raw.replace(/[\s\u00a0]/g, ''));
  if (!m) return null;
  return (BigInt(m[1]!) * 100n + BigInt((m[2] ?? '').padEnd(2, '0'))).toString();
}
/** «10:00», «10.00», «10», «10:00AM», «10 PM» → «ЧЧ:ММ»; иначе null */
export function toTime(raw: string): string | null {
  const m = /^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?$/i.exec(trim(raw));
  if (!m) return null;
  let h = Number(m[1]);
  const ampm = m[3]?.toLowerCase();
  if (ampm === 'pm' && h < 12) h += 12;
  if (ampm === 'am' && h === 12) h = 0;
  const t = `${String(h).padStart(2, '0')}:${m[2] ?? '00'}`;
  return TIME.test(t) ? t : null;
}
export const minutesOf = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));

export function emailIssue<S extends string>(section: S, row: number, email: string): QuickIssue<S> | null {
  const value = trim(email);
  if (!value) return null;
  if (!EMAIL.test(value))
    return { level: 'error', section, row, field: 'email', text: msg('Почта записана с ошибкой') };
  const [local, domain] = value.toLowerCase().split('@') as [string, string];
  const right = TYPO_DOMAINS[domain];
  if (right)
    return {
      level: 'error',
      section,
      row,
      field: 'email',
      text: msg('Похоже на опечатку в почте'),
      fix: { kind: 'set', value: `${local}@${right}`, label: `→ ${right}` },
    };
  return null;
}

export const filled = <T extends object>(rows: T[]) =>
  rows.flatMap((r, i) => (Object.values(r).some((v) => (Array.isArray(v) ? v.length : trim(String(v)))) ? [[r, i] as const] : []));

export function quickIssues(q: QuickStart): QuickIssue[] {
  const out: QuickIssue[] = [];
  const req = (section: QuickSection, row: number, field: string, ok: boolean, text: string) => {
    if (!ok) out.push({ level: 'error', section, row, field, text });
  };
  const s = q.salon;
  req('salon', 0, 'name', Boolean(trim(s.name)), msg('Укажите название салона'));
  req('salon', 0, 'days', s.days.length > 0, msg('Отметьте рабочие дни'));
  const from = toTime(s.timeFrom);
  const to = toTime(s.timeTo);
  req('salon', 0, 'hours', Boolean(from && to && minutesOf(from) < minutesOf(to)), msg('Проверьте часы работы'));
  req('salon', 0, 'payments', s.payments.length > 0, msg('Включите хотя бы один способ оплаты'));

  const serviceNames = new Set<string>();
  for (const [r, i] of filled(q.services)) {
    req('services', i, 'name', Boolean(trim(r.name)), msg('Укажите название услуги'));
    const minutes = Number(trim(r.minutes));
    req('services', i, 'minutes', Number.isInteger(minutes) && minutes >= 5 && minutes <= 720, msg('Время услуги в минутах, от 5'));
    req('services', i, 'price', toMinor(r.price) !== null, msg('Цена числом'));
    if (trim(r.name)) {
      if (serviceNames.has(key(r.name)))
        out.push({ level: 'warning', section: 'services', row: i, field: 'name', text: msg('Услуга повторяется'), fix: { kind: 'remove-row', label: msg('Убрать') } });
      serviceNames.add(key(r.name));
    }
  }
  req('services', 0, 'rows', serviceNames.size > 0, msg('Добавьте хотя бы одну услугу'));

  const emails = new Map<string, string>();
  let masters = 0;
  for (const [m, i] of filled(q.masters)) {
    masters += 1;
    req('masters', i, 'name', Boolean(trim(m.name)), msg('Укажите имя мастера'));
    if (SAMPLE.test(trim(m.email)) || /^maria santos$/i.test(trim(m.name)))
      out.push({ level: 'error', section: 'masters', row: i, field: 'name', text: msg('Это строка-пример из образца'), fix: { kind: 'remove-row', label: msg('Убрать') } });
    const mail = emailIssue('masters', i, m.email);
    if (mail) out.push(mail);
    if (trim(m.email)) emails.set(key(m.email), `m${i}`);
    req('masters', i, 'services', m.services.length > 0, msg('Отметьте услуги мастера'));
    const unknown = m.services.filter((n) => !serviceNames.has(key(n)));
    if (unknown.length) out.push({ level: 'error', section: 'masters', row: i, field: 'services', text: msg('Такой услуги нет в списке: {name}'), params: { name: unknown.join(', ') } });
    const mFrom = trim(m.timeFrom) ? toTime(m.timeFrom) : from;
    const mTo = trim(m.timeTo) ? toTime(m.timeTo) : to;
    if (!mFrom || !mTo || minutesOf(mFrom) >= minutesOf(mTo))
      out.push({ level: 'error', section: 'masters', row: i, field: 'timeTo', text: msg('Проверьте часы мастера') });
    else if (from && to && (minutesOf(mTo) > minutesOf(to) || minutesOf(mFrom) < minutesOf(from)))
      out.push({
        level: 'warning',
        section: 'masters',
        row: i,
        field: minutesOf(mTo) > minutesOf(to) ? 'timeTo' : 'timeFrom',
        text: msg('Мастер работает дольше салона: такие записи не получатся'),
        choices:
          minutesOf(mTo) > minutesOf(to)
            ? [
                { kind: 'salon-until', value: mTo, label: msg('Салон до {time}') },
                { kind: 'master-until', value: to, label: msg('Мастер до {time}') },
              ]
            : [
                { kind: 'salon-until', value: mFrom, label: msg('Салон с {time}') },
                { kind: 'master-until', value: from, label: msg('Мастер с {time}') },
              ],
      });
    const fixed = m.pay === 'PERCENT' || toMinor(m.fixed || '0') !== null;
    const pct = Number(trim(m.percent) || '0');
    req('masters', i, 'pay', fixed && Number.isInteger(pct) && pct >= 0 && pct <= 100, msg('Зарплата: оклад числом, процент от 0 до 100'));
  }
  req('masters', 0, 'rows', masters > 0, msg('Добавьте хотя бы одного мастера'));

  for (const [p, i] of filled(q.staff)) {
    req('staff', i, 'name', Boolean(trim(p.name)), msg('Укажите имя сотрудника'));
    const mail = emailIssue('staff', i, p.email);
    if (mail) out.push(mail);
    if (trim(p.email) && emails.get(key(p.email))?.startsWith('m'))
      out.push({ level: 'warning', section: 'staff', row: i, field: 'email', text: msg('Эта почта уже у мастера: будет один сотрудник, и мастер, и администратор') });
    else if (trim(p.email) && emails.has(key(p.email)))
      out.push({ level: 'error', section: 'staff', row: i, field: 'email', text: msg('Почта повторяется') });
    if (trim(p.email)) emails.set(key(p.email), `s${i}`);
  }
  for (const [p, i] of filled(q.products)) {
    req('products', i, 'name', Boolean(trim(p.name)), msg('Укажите название товара'));
    if (trim(p.price) && toMinor(p.price) === null)
      out.push({ level: 'error', section: 'products', row: i, field: 'price', text: msg('Цена числом') });
  }
  return out;
}

export function quickPlan(q: QuickStart): QuickPlan {
  const s = q.salon;
  const from = toTime(s.timeFrom) ?? '10:00';
  const to = toTime(s.timeTo) ?? '20:00';
  const hours = WEEK.filter((d) => s.days.includes(d))
    .sort((a, b) => a - b)
    .map((weekday) => ({ weekday, timeFrom: from, timeTo: to }));
  const staffByEmail = new Map(
    filled(q.staff).filter(([p]) => trim(p.email)).map(([p]) => [key(p.email), p] as const),
  );
  const masters = filled(q.masters)
    .filter(([m]) => !SAMPLE.test(trim(m.email)) && !/^maria santos$/i.test(trim(m.name)))
    .map(([m]): QuickPlanMaster => {
      const alsoStaff = trim(m.email) ? staffByEmail.get(key(m.email)) : undefined;
      const mFrom = (trim(m.timeFrom) && toTime(m.timeFrom)) || from;
      const mTo = (trim(m.timeTo) && toTime(m.timeTo)) || to;
      return {
        name: trim(m.name),
        email: trim(m.email),
        phone: trim(m.phone),
        personnelKind: alsoStaff ? 'BOTH' : 'SPECIALIST',
        services: m.services.map(trim),
        hours: hours.map((h) => ({ ...h, timeFrom: mFrom, timeTo: mTo })),
        pay: {
          model: m.pay,
          fixedMinor: m.pay === 'PERCENT' ? '0' : (toMinor(m.fixed || '0') ?? '0'),
          percent: m.pay === 'FIXED' ? 0 : Number(trim(m.percent) || '0'),
        },
        invite: trim(m.email) ? (alsoStaff ? alsoStaff.role : 'PORTAL') : null,
      };
    });
  const masterEmails = new Set(masters.map((m) => key(m.email)).filter(Boolean));
  return {
    profile: {
      businessName: trim(s.name),
      locationName: trim(s.name),
      currency: s.currency,
      timezone: s.timezone,
      address: trim(s.address),
      phone: trim(s.phone),
    },
    hours,
    services: filled(q.services).map(([r]) => ({
      name: trim(r.name),
      category: trim(r.category),
      durationMinutes: String(Number(trim(r.minutes))),
      priceMinor: toMinor(r.price) ?? '0',
    })),
    masters,
    staff: filled(q.staff)
      .filter(([p]) => !masterEmails.has(key(p.email)))
      .map(([p]) => ({
        name: trim(p.name),
        email: trim(p.email),
        phone: trim(p.phone),
        personnelKind: 'OTHER_EMPLOYEE' as const,
        invite: trim(p.email) ? p.role : null,
      })),
    // бесплатное угощение (кофе, вода) в склад не заводим: продавать нечего
    products: filled(q.products)
      .filter(([p]) => trim(p.name) && (toMinor(p.price) ?? '0') !== '0')
      .map(([p]) => ({ category: trim(p.category), name: trim(p.name), salePriceMinor: toMinor(p.price)! })),
    payments: BRANCH_PAYMENT_METHODS.map((method) => ({ method, enabled: s.payments.includes(method) })),
  };
}

/** Вставка строк (Ctrl+V): строки по переводу строки, колонки по табуляции; пустые строки пропускаются */
export function parseRows(text: string, columns: number): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) => line.split('\t').map(trim))
    .filter((cells) => cells.some(Boolean))
    .map((cells) => Array.from({ length: columns }, (_, i) => cells[i] ?? ''));
}

/**
 * Итоговый экран «Салон готов» (вариант А владельца 27.10.2026): весь экран занят тем, что реально создано.
 * Цифры, команда с условиями оплаты и меткой приглашения, услуги, бар и оплата. Источник: план создания и список
 * адресов, куда приглашение не ушло.
 */
export interface DoneSummary {
  title: string;
  line: { address: string; hours: string; days: number; currency: string };
  counts: { services: number; masters: number; staff: number; products: number; invites: number };
  team: Array<{
    name: string;
    role: 'master' | 'both' | QuickRole;
    services: number;
    pay: { kind: 'PERCENT'; percent: number } | { kind: 'FIXED'; fixedMinor: string } | { kind: 'FIXED_PLUS_PERCENT'; fixedMinor: string; percent: number } | null;
    invite: 'sent' | 'failed' | 'none';
  }>;
  services: Array<{ name: string; minutes: number; priceMinor: string }>;
  bar: { paid: Array<{ name: string; priceMinor: string }>; free: string[] };
  payments: BranchPaymentMethod[];
}

export function doneSummary(plan: QuickPlan, q: QuickStart, failedEmails: string[]): DoneSummary {
  const failed = new Set(failedEmails.map(key));
  const invite = (email: string, level: unknown) =>
    !email || !level ? ('none' as const) : failed.has(key(email)) ? ('failed' as const) : ('sent' as const);
  const pay = (p: QuickPlanMaster['pay']): DoneSummary['team'][number]['pay'] =>
    p.model === 'PERCENT'
      ? { kind: 'PERCENT', percent: p.percent }
      : p.model === 'FIXED'
        ? { kind: 'FIXED', fixedMinor: p.fixedMinor }
        : { kind: 'FIXED_PLUS_PERCENT', fixedMinor: p.fixedMinor, percent: p.percent };
  const team: DoneSummary['team'] = [
    ...plan.masters.map((m) => ({
      name: m.name,
      role: m.personnelKind === 'BOTH' ? ('both' as const) : ('master' as const),
      services: m.services.length,
      pay: pay(m.pay),
      invite: invite(m.email, m.invite),
    })),
    ...plan.staff.map((p) => ({
      name: p.name,
      role: q.staff.find((s) => key(s.name) === key(p.name))?.role ?? ('STAFF' as const),
      services: 0,
      pay: null,
      invite: invite(p.email, p.invite),
    })),
  ];
  const hours = plan.hours[0];
  return {
    title: plan.profile.businessName,
    line: {
      address: plan.profile.address,
      hours: hours ? `${hours.timeFrom}–${hours.timeTo}` : '',
      days: plan.hours.length,
      currency: plan.profile.currency,
    },
    counts: {
      services: plan.services.length,
      masters: plan.masters.length,
      staff: plan.staff.length,
      products: plan.products.length,
      invites: team.filter((m) => m.invite === 'sent').length,
    },
    team,
    services: plan.services.map((s) => ({ name: s.name, minutes: Number(s.durationMinutes), priceMinor: s.priceMinor })),
    bar: {
      paid: plan.products.map((p) => ({ name: p.name, priceMinor: p.salePriceMinor })),
      free: filled(q.products).filter(([p]) => trim(p.name) && (toMinor(p.price) ?? '0') === '0').map(([p]) => trim(p.name)),
    },
    payments: plan.payments.filter((p) => p.enabled).map((p) => p.method),
  };
}
