'use server';
import { revalidatePath } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { parseMoney, parsePaySettings, parseWorkingHoursWeek, parseTimeOffInput } from '@pms/domain';
import { employeePortalApi, type PortalTarget } from '../../lib/employee-portal-api';
import type { EmployeePortalDto } from '@pms/domain';
import { requestScopeHeader } from '../../lib/scope-pointer';
import { ApiError } from '../../lib/api-error';
import { beautyApi, type BeautyEmployeeServicePriceRow } from '../../lib/api';
import { inputToMinor } from '../../lib/money';
export interface PortalResult { data?: EmployeePortalDto; error?: string }
const text = (form: FormData, key: string) => String(form.get(key) ?? '').trim();
const checked = (form: FormData, key: string) => form.get(key) === 'on';
const managerCommands = new Set(['publication', 'account', 'unlink', 'pay', 'pay-policy', 'active']);
/** Every command re-reads authenticated access and scope; browser flags never confer permission. */
export async function savePortal(target: PortalTarget, scope: string, command: string, form: FormData): Promise<PortalResult> {
  try {
    const currentScope = (await requestScopeHeader())['x-wetop-scope'] ?? '';
    if (scope !== currentScope) return { error: 'Филиал изменился. Откройте карточку заново; ввод сохранён.' };
    const current = await employeePortalApi.load(target);
    if (managerCommands.has(command) && current.access !== 'MANAGER') return { error: 'Эту настройку меняет руководитель.' };
    const revision = text(form, 'expectedRevision');
    let data: EmployeePortalDto;
    switch (command) {
      case 'profile':
        if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(text(form, 'expectedProfileRevision')))
          return { error: 'Исходная версия профиля отсутствует. Загрузите актуальные данные; ввод сохранён.' };
        data = await employeePortalApi.profile(target, {
        name: text(form, 'name'), phone: text(form, 'phone') || null, email: text(form, 'email') || null,
        headline: text(form, 'headline'), biography: text(form, 'biography'),
        practiceSinceYear: text(form, 'practiceSinceYear') ? Number(text(form, 'practiceSinceYear')) : null,
        expectedRevision: revision, expectedProfileRevision: text(form, 'expectedProfileRevision'),
      }); break;
      case 'avatar': case 'add-work': {
        const file = form.get('file');
        if (!(file instanceof File) || !file.size) return { error: 'Выберите изображение.' };
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) return { error: 'Нужно JPG, PNG или WebP до 5 МиБ.' };
        const upload = new FormData(); upload.set('file', file);
        if (command === 'add-work') {
          upload.set('title', text(form, 'title')); upload.set('description', text(form, 'description'));
          if (text(form, 'serviceId')) upload.set('serviceId', text(form, 'serviceId'));
          upload.set('publicationConsent', String(checked(form, 'publicationConsent')));
          upload.set('published', String(current.access === 'MANAGER' && checked(form, 'published')));
        }
        data = command === 'avatar' ? await employeePortalApi.avatar(target, upload) : await employeePortalApi.addWork(target, upload);
        break;
      }
      case 'remove-avatar': data = await employeePortalApi.removeAvatar(target); break;
      case 'work': data = await employeePortalApi.work(target, text(form, 'workId'), {
        title: text(form, 'title'), description: text(form, 'description'), serviceId: text(form, 'serviceId') || null,
        publicationConsent: checked(form, 'publicationConsent'), published: current.access === 'MANAGER' && checked(form, 'published'),
      }); break;
      case 'remove-work': data = await employeePortalApi.removeWork(target, text(form, 'workId')); break;
      case 'publication': data = await employeePortalApi.publication(target, { published: checked(form, 'published'), publicationConsent: checked(form, 'publicationConsent'), expectedRevision: revision }); break;
      case 'services': data = await employeePortalApi.services(target, form.getAll('serviceIds').map(String), revision); break;
      case 'week': {
        const raw = JSON.parse(text(form, 'intervals')) as unknown;
        const parsed = parseWorkingHoursWeek({ intervals: raw });
        if (!parsed.ok) return { error: parsed.reason };
        data = await employeePortalApi.week(target, parsed.value, revision); break;
      }
      case 'time-off': {
        const input = { dateFrom: text(form, 'dateFrom'), dateTo: text(form, 'dateTo'), reason: text(form, 'reason') };
        const parsed = parseTimeOffInput(input); if (!parsed.ok) return { error: parsed.reason };
        data = await employeePortalApi.timeOff(target, input); break;
      }
      case 'remove-time-off': data = await employeePortalApi.removeTimeOff(target, text(form, 'timeOffId')); break;
      case 'account': {
        const userId = text(form, 'userId');
        if (!/^[0-9a-f-]{36}$/i.test(userId)) return { error: 'Выберите подтверждённого участника команды. Идентификатор не создаёт аккаунт.' };
        data = await employeePortalApi.account(target, userId); break;
      }
      case 'unlink': data = await employeePortalApi.unlink(target); break;
      case 'pay': {
        let fixedMinor: bigint;
        try {
          fixedMinor = parseMoney(text(form, 'fixedAmount').replace(/\s/g, ''));
        } catch {
          return { error: 'Введите фиксированную ставку, не больше двух знаков после запятой.' };
        }
        if (fixedMinor < 0n || fixedMinor > BigInt(Number.MAX_SAFE_INTEGER))
          return { error: 'Введите допустимую фиксированную ставку.' };
        const input = parsePaySettings({ model: text(form, 'model'), fixedMinor: Number(fixedMinor), percent: Number(text(form, 'percent')) });
        data = await employeePortalApi.pay(target, { ...input, fixedMinor: input.fixedMinor.toString() }); break;
      }
      case 'pay-policy': {
        const basis = text(form, 'percentBasis');
        if (basis !== 'COMPLETED_SERVICES' && basis !== 'PAID_COMPLETED_SERVICES') return { error: 'Выберите базу процента.' };
        await employeePortalApi.payPolicy(basis, revision || undefined);
        data = await employeePortalApi.load(target); break;
      }
      case 'active': {
        // E5 (паритет с zapis.kz): «В архив / Вернуть» из карточки; право employees.update проверяет API
        await beautyApi.updateEmployee(current.employee.id, { active: text(form, 'active') === 'true' });
        data = await employeePortalApi.load(target); break;
      }
      default: return { error: 'Неизвестное действие.' };
    }
    return { data };
  } catch (error) {
    unstable_rethrow(error);
    return { error: error instanceof ApiError && error.status < 500 ? error.message : 'Не удалось подтвердить сохранение. Ввод сохранён. Проверьте результат перед повтором.' };
  }
}

/** Read-only comparison. The draft's original revision is never refreshed by savePortal. */
export async function loadPortalWeek(target: PortalTarget, scope: string): Promise<PortalResult> {
  try {
    if (scope !== ((await requestScopeHeader())['x-wetop-scope'] ?? '')) return { error: 'Филиал изменился. Откройте карточку заново.' };
    return { data: await employeePortalApi.load(target) };
  } catch (error) {
    unstable_rethrow(error);
    return { error: 'Не удалось перечитать график. Ваш ввод сохранён.' };
  }
}

export interface ServicePriceActionResult {
  items?: BeautyEmployeeServicePriceRow[];
  error: string | null;
}

const employeePriceTypes = new Set<BeautyEmployeeServicePriceRow['priceType']>([
  'FIXED',
  'RANGE',
  'FREE',
  'UNFIXED',
]);

async function servicePriceScopeChanged(scope: string): Promise<boolean> {
  return scope !== ((await requestScopeHeader())['x-wetop-scope'] ?? '');
}

function servicePriceError(error: unknown): ServicePriceActionResult {
  unstable_rethrow(error);
  return {
    error: error instanceof ApiError && error.status < 500
      ? error.message
      : 'Не удалось подтвердить сохранение. Ввод сохранён. Проверьте результат перед повтором.',
  };
}

export async function saveEmployeeServicePrice(
  employeeId: string,
  scope: string,
  form: FormData,
): Promise<ServicePriceActionResult> {
  try {
    if (await servicePriceScopeChanged(scope)) {
      return { error: 'Филиал изменился. Откройте карточку заново; ввод сохранён.' };
    }
    const serviceId = text(form, 'serviceId');
    const priceType = text(form, 'priceType') as BeautyEmployeeServicePriceRow['priceType'];
    const expectedRevision = Number(text(form, 'expectedRevision'));
    const durationMinutes = Number(text(form, 'durationMinutes'));
    const currency = text(form, 'currency').toUpperCase();
    if (!/^[0-9a-f-]{36}$/i.test(employeeId) || !/^[0-9a-f-]{36}$/i.test(serviceId)) {
      return { error: 'Услуга или мастер не найдены.' };
    }
    if (!employeePriceTypes.has(priceType)) return { error: 'Выберите тип цены.' };
    if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
      return { error: 'Версия цены устарела. Перезагрузите карточку.' };
    }
    if (!Number.isInteger(durationMinutes) || durationMinutes <= 0 || durationMinutes > 1440) {
      return { error: 'Укажите длительность от 1 до 1440 минут.' };
    }
    if (!/^[A-Z]{3}$/.test(currency)) return { error: 'Валюта услуги не определена.' };

    let priceMinMinor: string | null = null;
    let priceMaxMinor: string | null = null;
    if (priceType === 'FREE') {
      priceMinMinor = '0';
      priceMaxMinor = '0';
    } else if (priceType === 'FIXED' || priceType === 'RANGE') {
      const min = inputToMinor(text(form, 'priceMin'));
      const max = priceType === 'RANGE' ? inputToMinor(text(form, 'priceMax')) : min;
      if (min === null || min === '' || max === null || max === '') {
        return { error: 'Введите цену, не больше двух знаков после запятой.' };
      }
      if (BigInt(max) < BigInt(min)) return { error: 'Максимальная цена должна быть не меньше минимальной.' };
      priceMinMinor = min;
      priceMaxMinor = max;
    }

    const items = await beautyApi.setEmployeeServicePrice(employeeId, serviceId, {
      expectedRevision,
      priceType,
      priceMinMinor,
      priceMaxMinor,
      durationMinutes,
      currency,
    });
    revalidatePath(`/employees/${employeeId}/profile`);
    return { items, error: null };
  } catch (error) {
    return servicePriceError(error);
  }
}

export async function removeEmployeeServicePrice(
  employeeId: string,
  scope: string,
  form: FormData,
): Promise<ServicePriceActionResult> {
  try {
    if (await servicePriceScopeChanged(scope)) {
      return { error: 'Филиал изменился. Откройте карточку заново.' };
    }
    const serviceId = text(form, 'serviceId');
    const expectedRevision = Number(text(form, 'expectedRevision'));
    if (!/^[0-9a-f-]{36}$/i.test(employeeId) || !/^[0-9a-f-]{36}$/i.test(serviceId)) {
      return { error: 'Услуга или мастер не найдены.' };
    }
    if (!Number.isInteger(expectedRevision) || expectedRevision <= 0) {
      return { error: 'Своя цена мастера ещё не сохранена.' };
    }
    const items = await beautyApi.removeEmployeeServicePrice(employeeId, serviceId, { expectedRevision });
    revalidatePath(`/employees/${employeeId}/profile`);
    return { items, error: null };
  } catch (error) {
    return servicePriceError(error);
  }
}
