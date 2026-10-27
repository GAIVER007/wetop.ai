'use server';
import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { inviteRoleOfLevel } from '@pms/domain';
import { ApiError, authApi, barApi, beautyApi, sharedOnboardingApi } from '../../../../lib/api';
import { restaurantApi } from '../../../../lib/food-api';
import { employeePortalApi } from '../../../../lib/employee-portal-api';
import { clientInfo, sessionToken } from '../../../../lib/session';
import { msg } from '../../../../i18n';
import { quickIssues, quickPlan, type QuickStart } from './model';

/**
 * «Создать салон» (быстрый запуск, владелец 27.10.2026): одна кнопка проводит анкету через те же вызовы API, что
 * и ручная настройка: профиль первичной настройки, часы салона, услуги в филиале, мастера с услугами, графиком и
 * оплатой, сотрудники, товары бара, способы оплаты, приглашения. Повтор после сбоя не плодит дубли: существующие
 * услуги, мастера и товары находятся по названию или почте, ключи создания выводятся из попытки и строки.
 */
export interface QuickResult {
  ok: boolean;
  /** на каком шаге остановились (для текста ошибки) */
  step?: string;
  error?: string;
  created: { services: number; masters: number; staff: number; products: number; invites: number };
  /** не остановило создание: приглашение не ушло и т. п. */
  warnings: string[];
}

/** UUID из попытки и строки: тот же ввод при повторе даёт тот же ключ создания (защита от дублей в API) */
function creationId(attempt: string, ...parts: string[]): string {
  const h = createHash('sha256').update([attempt, ...parts].join('\u0000')).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
const low = (v: string) => v.trim().toLocaleLowerCase();
const code = (name: string, n: number) =>
  `Q${n}-${name.normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '').slice(0, 12).toUpperCase() || 'ITEM'}`;

export async function createQuickSalon(input: QuickStart, attempt: string): Promise<QuickResult> {
  const created = { services: 0, masters: 0, staff: 0, products: 0, invites: 0 };
  const warnings: string[] = [];
  const blocking = quickIssues(input).filter((i) => i.level === 'error');
  if (blocking.length) return { ok: false, step: 'check', error: msg('Исправьте отмеченные поля'), created, warnings };
  const plan = quickPlan(input);
  let step = 'profile';
  try {
    // 1. Профиль: название, валюта, пояс, адрес, телефон (первичная настройка, `apply-profile`)
    const state = await sharedOnboardingApi.status();
    await sharedOnboardingApi.save({ action: 'apply-profile', draft: plan.profile, updatedAt: state.updatedAt });

    // 2. Часы салона
    step = 'hours';
    const hours = await beautyApi.locationHours();
    await beautyApi.saveLocationHours({ expectedRevision: hours.revision, intervals: plan.hours });

    // 3. Услуги: есть с таким названием, значит берём её; затем включаем в филиале
    step = 'services';
    const catalog = await beautyApi.services();
    const serviceId = new Map(catalog.items.map((s) => [low(s.name), s.id]));
    for (const s of plan.services) {
      let id = serviceId.get(low(s.name));
      if (!id) {
        id = (
          await beautyApi.createService({
            ...s,
            currency: plan.profile.currency,
            active: true,
            creationId: creationId(attempt, 'service', s.name),
          })
        ).id;
        serviceId.set(low(s.name), id);
        created.services += 1;
      }
      await beautyApi.setLocationService(id, { enabled: true, priceOverrideMinor: '', durationOverrideMinutes: '' });
    }

    // 4. Мастера и сотрудники: карточка, услуги, график, оплата
    step = 'masters';
    const people = (await beautyApi.employees()).items;
    const find = (email: string, name: string) =>
      people.find((e) => (email && e.email && low(e.email) === low(email)) || low(e.name) === low(name));
    const invites: Array<{ employeeId: string; email: string; level: 'PORTAL' | 'STAFF' | 'MANAGER' }> = [];
    for (const m of plan.masters) {
      let row = find(m.email, m.name);
      if (!row) {
        row = await beautyApi.createEmployee({
          name: m.name,
          phone: m.phone,
          email: m.email,
          active: true,
          personnelKind: m.personnelKind,
          creationId: creationId(attempt, 'master', m.email || m.name),
        });
        created.masters += 1;
      }
      const ids = m.services.map((n) => serviceId.get(low(n))).filter((v): v is string => Boolean(v));
      await beautyApi.setEmployeeServices(row.id, ids, row.servicesRevision);
      const week = await beautyApi.schedule(row.id);
      await beautyApi.setWorkingHours(row.id, m.hours, week.weekRevision ?? undefined);
      await employeePortalApi.pay({ employeeId: row.id }, { ...m.pay });
      if (m.invite && m.email) invites.push({ employeeId: row.id, email: m.email, level: m.invite });
    }
    step = 'staff';
    for (const p of plan.staff) {
      let row = find(p.email, p.name);
      if (!row) {
        row = await beautyApi.createEmployee({
          name: p.name,
          phone: p.phone,
          email: p.email,
          active: true,
          personnelKind: p.personnelKind,
          creationId: creationId(attempt, 'staff', p.email || p.name),
        });
        created.staff += 1;
      }
      if (p.invite && p.email) invites.push({ employeeId: row.id, email: p.email, level: p.invite });
    }

    // 5. Товары бара: категории по названию, товар с ценой продажи
    step = 'products';
    if (plan.products.length) {
      const categories = await barApi.categories();
      const categoryId = new Map(categories.map((c) => [low(c.name), c.id]));
      const existing = new Set((await barApi.products()).map((p) => low(p.name)));
      let n = 0;
      for (const p of plan.products) {
        n += 1;
        if (existing.has(low(p.name))) continue;
        let category: string | null = null;
        if (p.category) {
          category = categoryId.get(low(p.category)) ?? null;
          if (!category) {
            category = (await barApi.createCategory({ name: p.category, defaultMarkupBasis: 0 })).id;
            categoryId.set(low(p.category), category);
          }
        }
        await barApi.createProduct({
          code: code(p.name, n),
          name: p.name,
          categoryId: category,
          unitsPerPackage: 1,
          markupBasis: null,
          salePriceMinor: p.salePriceMinor,
          minimumStockUnits: '0',
        });
        created.products += 1;
      }
    }

    // 6. Способы оплаты филиала
    step = 'payments';
    await restaurantApi.updatePaymentMethods(plan.payments);

    // 7. Приглашения: ошибка одного приглашения создание не отменяет
    step = 'invites';
    const token = await sessionToken();
    const info = await clientInfo();
    for (const i of invites) {
      const role = inviteRoleOfLevel(i.level);
      if (!role) continue;
      // без сеанса приглашение не уйдёт: говорим об этом, а не молчим
      if (!token) {
        warnings.push(`${i.email}: ${msg('приглашение не отправлено')}`);
        continue;
      }
      try {
        await authApi.invite(token, i.email, role, info, { employeeId: i.employeeId });
        created.invites += 1;
      } catch (e) {
        warnings.push(`${i.email}: ${e instanceof ApiError ? e.message : msg('приглашение не отправлено')}`);
      }
    }

    // 8. Готово: первичная настройка завершается, если все шаги салона сошлись
    step = 'complete';
    const after = await sharedOnboardingApi.status();
    if (after.readiness?.ready && after.completedFlowVersion !== 2)
      await sharedOnboardingApi.save({ action: 'complete', draft: plan.profile, updatedAt: after.updatedAt });
  } catch (e) {
    return {
      ok: false,
      step,
      error: e instanceof ApiError ? e.message : msg('Не удалось завершить. Нажмите «Создать» ещё раз: созданное не повторится.'),
      created,
      warnings,
    };
  }
  for (const path of ['/register/setup', '/calendar', '/employees', '/services', '/beauty/schedule', '/payroll', '/bar', '/today'])
    revalidatePath(path);
  return { ok: true, created, warnings };
}
