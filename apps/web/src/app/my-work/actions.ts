'use server';
import { unstable_rethrow } from 'next/navigation';
import { parsePaySettings, parseWorkingHoursWeek, parseTimeOffInput } from '@pms/domain';
import { employeePortalApi, type PortalTarget } from '../../lib/employee-portal-api';
import type { EmployeePortalDto } from '@pms/domain';
import { requestScopeHeader } from '../../lib/scope-pointer';
import { ApiError } from '../../lib/api-error';
export interface PortalResult { data?: EmployeePortalDto; error?: string }
const text = (form: FormData, key: string) => String(form.get(key) ?? '').trim();
const checked = (form: FormData, key: string) => form.get(key) === 'on';
const managerCommands = new Set(['publication', 'account', 'unlink', 'pay', 'pay-policy']);
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
        const input = parsePaySettings({ model: text(form, 'model'), fixedMinor: text(form, 'fixedMinor'), percent: Number(text(form, 'percent')) });
        data = await employeePortalApi.pay(target, { ...input, fixedMinor: input.fixedMinor.toString() }); break;
      }
      case 'pay-policy': {
        const basis = text(form, 'percentBasis');
        if (basis !== 'COMPLETED_SERVICES' && basis !== 'PAID_COMPLETED_SERVICES') return { error: 'Выберите базу процента.' };
        await employeePortalApi.payPolicy(basis, revision || undefined);
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
