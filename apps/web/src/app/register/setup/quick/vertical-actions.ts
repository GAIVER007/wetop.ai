'use server';
import { inviteRoleOfLevel } from '@pms/domain';
import {
  ApiError,
  authApi,
  hotelSettingsApi,
  onboardingApi,
  paymentMethodsApi,
  serviceCatalogApi,
  sharedOnboardingApi,
} from '../../../../lib/api';
import { foodApi, restaurantApi } from '../../../../lib/food-api';
import { hotelStaffApi } from '../../../../lib/hotel-staff-api';
import { clientInfo, sessionToken } from '../../../../lib/session';
import { msg } from '../../../../i18n';
import { key } from './model';
import {
  hotelDone,
  hotelIssues,
  hotelPlan,
  restaurantDone,
  restaurantIssues,
  restaurantPlan,
  type HotelDone,
  type HotelStart,
  type RestaurantDone,
  type RestaurantStart,
} from './vertical-model';

/**
 * «Создать» для гостиницы и ресторана (быстрый запуск, владелец 27.10.2026: то же окно во всех вертикалях). Только
 * существующие вызовы API, в том порядке, в каком их делает ручная настройка. Повтор после сбоя не плодит дубли:
 * созданное находится по названию или почте и пропускается.
 */
export interface VerticalResult<T> {
  ok: boolean;
  step?: string;
  error?: string;
  warnings: string[];
  summary?: T;
}
const failure = (e: unknown, step: string) => ({
  ok: false as const,
  step,
  error: e instanceof ApiError ? e.message : msg('Не удалось завершить. Нажмите «Создать» ещё раз: созданное не повторится.'),
  warnings: [] as string[],
});

/** приглашения: ошибка одного не отменяет создание, адрес попадает в предупреждения */
async function sendInvites(list: Array<{ email: string; level: 'PORTAL' | 'STAFF' | 'MANAGER'; employeeId: string }>) {
  const warnings: string[] = [];
  const failed: string[] = [];
  const token = await sessionToken();
  const info = await clientInfo();
  for (const i of list) {
    const role = inviteRoleOfLevel(i.level);
    if (!role) continue;
    try {
      if (!token) throw new Error('no session');
      await authApi.invite(token, i.email, role, info, { employeeId: i.employeeId });
    } catch (e) {
      failed.push(i.email);
      warnings.push(`${i.email}: ${e instanceof ApiError ? e.message : msg('приглашение не отправлено')}`);
    }
  }
  return { warnings, failed };
}

/** все страницы списка ресторана (FoodPage) */
async function all<T>(load: (cursor?: string) => Promise<{ items: T[]; nextCursor: string | null }>): Promise<T[]> {
  const out: T[] = [];
  let cursor: string | undefined;
  for (let n = 0; n < 50; n += 1) {
    const page = await load(cursor);
    out.push(...page.items);
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }
  return out;
}

/* ────────────────────────────── гостиница ────────────────────────────── */

/** способы оплаты, которые окно запуска гостиницы показывает; остальные (депозит, гарантия картой) не трогаем */
const HOTEL_SHOWN = new Set(['CASH', 'CARD_TERMINAL', 'BANK_TRANSFER_LEGAL', 'BANK_TRANSFER_PERSON']);

export async function createQuickHotel(input: HotelStart, attempt: string): Promise<VerticalResult<HotelDone>> {
  void attempt;
  if (hotelIssues(input).some((i) => i.level === 'error'))
    return { ok: false, step: 'check', error: msg('Исправьте отмеченные поля'), warnings: [] };
  const plan = hotelPlan(input);
  let step = 'rooms';
  const invites: Array<{ email: string; level: 'PORTAL' | 'STAFF' | 'MANAGER'; employeeId: string }> = [];
  try {
    // 1. Номера, тариф и цены: тот же запуск, что кнопка «Запустить отель»; повтор после запуска пропускается
    const status = await onboardingApi.status();
    if (status.needed) await onboardingApi.provision(plan.provision);

    // 2. Название, адрес, телефон, заезд и выезд
    step = 'settings';
    await hotelSettingsApi.update(plan.settings);

    // 3. Дополнительные услуги (завтрак, трансфер)
    step = 'extras';
    if (plan.extras.length) {
      const have = new Set((await serviceCatalogApi.list()).map((s) => key(s.name)));
      for (const e of plan.extras) if (!have.has(key(e.name))) await serviceCatalogApi.create({ name: e.name, price: e.price, active: true });
    }

    // 4. Сотрудники и оплата (оклад или без оклада, плюс за уборку)
    step = 'staff';
    const people = (await hotelStaffApi.employees()).items;
    for (const s of plan.staff) {
      let id = people.find((p) => key(p.name) === key(s.name))?.id;
      if (!id) id = (await hotelStaffApi.createEmployee({ name: s.name, phone: s.phone || null, email: s.email || null, personnelKind: 'OTHER_EMPLOYEE' })).id;
      await hotelStaffApi.setPaySettings(id, s.pay);
      if (s.invite && s.email) invites.push({ email: s.email, level: s.invite, employeeId: id });
    }

    // 5. Способы оплаты: показанные в окне по выбору, остальные как были
    step = 'payments';
    const current = (await paymentMethodsApi.get()).methods;
    const chosen = new Set(plan.payments.filter((p) => p.enabled).map((p) => p.method as string));
    await paymentMethodsApi.update(current.map((m) => (HOTEL_SHOWN.has(m.method) ? { ...m, enabled: chosen.has(m.method) } : m)));
  } catch (e) {
    return failure(e, step);
  }
  const sent = await sendInvites(invites);
  return { ok: true, warnings: sent.warnings, summary: hotelDone(plan, sent.failed) };
}

/* ────────────────────────────── ресторан ────────────────────────────── */

export async function createQuickRestaurant(input: RestaurantStart, attempt: string): Promise<VerticalResult<RestaurantDone>> {
  if (restaurantIssues(input).some((i) => i.level === 'error'))
    return { ok: false, step: 'check', error: msg('Исправьте отмеченные поля'), warnings: [] };
  const plan = restaurantPlan(input);
  void attempt;
  let step = 'profile';
  const invites: Array<{ email: string; level: 'PORTAL' | 'STAFF' | 'MANAGER'; employeeId: string }> = [];
  try {
    // 1. Первичная настройка ресторана: название, филиал, валюта, адрес, телефон; шаги проходятся до «Готово»
    let state = await sharedOnboardingApi.status();
    if (!state.completedAt) {
      for (let n = 0; n < 5 && state.currentStep !== 'review'; n += 1)
        state = await sharedOnboardingApi.save({ action: 'next', draft: plan.profile, updatedAt: state.updatedAt });
      state = await sharedOnboardingApi.save({ action: 'complete', draft: plan.profile, updatedAt: state.updatedAt });
    }

    // 2. Залы и столы
    step = 'tables';
    const areas = await all((c) => foodApi.areas(c));
    const tables = await all((c) => foodApi.tables(c));
    let areaOrder = areas.length;
    for (const a of plan.areas) {
      let area = areas.find((x) => key(x.name) === key(a.name));
      if (!area) {
        area = await foodApi.createArea({ name: a.name, sortOrder: areaOrder++, active: true });
        areas.push(area);
      }
      let order = tables.filter((t) => t.areaId === area!.id).length;
      for (const t of a.tables) {
        if (tables.some((x) => x.areaId === area!.id && key(x.name) === key(t.name))) continue;
        tables.push(await foodApi.createTable({ areaId: area.id, name: t.name, capacity: t.capacity, sortOrder: order++, active: true }));
      }
    }

    // 3. Меню: разделы со станцией (кухня или бар) и блюда
    step = 'menu';
    const categories = await all((c) => restaurantApi.categories(c));
    const items = await all((c) => restaurantApi.menuItems(c));
    let catOrder = categories.length;
    for (const c of plan.menu) {
      let cat = categories.find((x) => key(x.name) === key(c.name));
      if (!cat) {
        cat = await restaurantApi.createCategory({ name: c.name, station: c.station, sortOrder: catOrder++, active: true });
        categories.push(cat);
      }
      let order = items.filter((i) => i.categoryId === cat!.id).length;
      for (const i of c.items) {
        if (items.some((x) => key(x.name) === key(i.name))) continue;
        items.push(await restaurantApi.createMenuItem({ categoryId: cat.id, name: i.name, price: i.price, active: true, sortOrder: order++ }));
      }
    }

    // 4. Сотрудники и зарплата
    step = 'staff';
    const people = await all((c) => restaurantApi.employees(c));
    for (const s of plan.staff) {
      let id = people.find((p) => (s.email && p.email && key(p.email) === key(s.email)) || key(p.name) === key(s.name))?.id;
      if (!id) id = (await restaurantApi.createEmployee({ name: s.name, phone: s.phone || null, email: s.email || null, personnelKind: 'OTHER_EMPLOYEE' })).id;
      await restaurantApi.setPaySettings(id, s.pay);
      if (s.invite && s.email) invites.push({ email: s.email, level: s.invite, employeeId: id });
    }

    // 5. Способы оплаты филиала
    step = 'payments';
    await restaurantApi.updatePaymentMethods(plan.payments);
  } catch (e) {
    return failure(e, step);
  }
  const sent = await sendInvites(invites);
  // кэш страниц не сбрасываем: сброс перерисовал бы окно запуска, и оно ушло бы на «Главную» до показа итога;
  // рабочие экраны читают данные при каждом открытии
  return { ok: true, warnings: sent.warnings, summary: restaurantDone(plan, sent.failed) };
}
