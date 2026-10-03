import type { ActionPreview } from './action-preview';
export type { ActionPreview } from './action-preview';

/**
 * Клиент API стойки. Адрес — APP_API_URL (по умолчанию локальный API на 3001).
 * Формы ответов повторяют apps/api (InventorySummaryDto, InventoryUnitDto).
 */
import type {
  AgentStatus,
  CancellationPenaltyPolicy,
  ChannelState,
  DashboardFund,
  DashboardPeriod,
  InviteRole,
  MembershipRole,
  UnitStats,
} from '@pms/domain';
import { ApiError } from './api-error';
import type {
  SupportLastMessage,
  SupportPriority,
  SupportCategory,
  SupportCategoryCounts,
  SupportCategoryFilter,
  SupportQueue,
  SupportQueueCounts,
} from './support-queue';
import { requestScopeHeader } from './scope-pointer';
export interface CategorySummary {
  code: string;
  name: string;
  units: number;
  maxGuests: number;
  /** Вместимость одной единицы категории — предел числа гостей в формах */
  capacityAdults: number;
}

export interface InventorySummary {
  property: { name: string; timezone: string; currency: string };
  totalUnits: number;
  rooms: number;
  beds: number;
  maxGuests: number;
  physicalRooms: number;
  blocks: number;
  byCategory: CategorySummary[];
}

export interface InventoryUnit {
  code: string;
  kind: 'ROOM' | 'BED';
  accommodationTypeCode: string;
  accommodationTypeName: string;
  roomNumber: string;
  roomCapacity: number;
  isDorm: boolean;
  /** Расположение и живое состояние для списка фонда (ADR-108) */
  buildingName: string | null;
  floorName: string | null;
  housekeepingStatus: 'DIRTY' | 'CLEAN' | 'INSPECTED';
  active: boolean;
  block: { dateTo: string; type: string; reason: string | null } | null;
}

/** Пути, 401 от которых не уводит на экран входа (см. backendFetch) */
const QUIET_401_PATHS = ['/auth/', '/assistant/identity', '/wizard/', '/seller-agents'];

/** Explicit test/demo sources are isolated from normal and production API access. */
async function backendFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const endpoint = process.env.APP_API_URL?.trim() || 'http://127.0.0.1:3001';
  const demo =
    process.env.NODE_ENV === 'development' &&
    process.env.APP_DEMO_MODE === '1' &&
    endpoint.replace(/\/$/, '') === 'http://127.0.0.1:4312';
  if (!demo && new URL(endpoint).port === '4312')
    throw new ApiError(503, 'Демонстрационный источник отключён. Подключите рабочий API.');
  const testing = process.env.NODE_ENV !== 'production' && process.env.APP_ALLOW_TEST_DATA === '1';
  if (!testing && new URL(endpoint).port === '4311') {
    throw new ApiError(503, 'Тестовый источник отключён. Подключите рабочий API.');
  }
  let response: Response;
  try {
    response = await fetch(`${endpoint.replace(/\/$/, '')}${path}`, {
      ...options,
      cache: 'no-store',
      headers: {
        ...options.headers,
        ...(await sessionHeader()),
        // указатель выбора Business и филиала (Platform P2, К1): проверяет API, стойка только пересылает
        ...(await requestScopeHeader()),
        ...(testing ? { 'x-wetop-test-client': '1' } : {}),
        ...(demo ? { 'x-wetop-demo-client': '1' } : {}),
      },
      // Чтение и команды ждут одинаково (уточнение ADR-031, 13.09.2026): короткий таймаут чтения обрывал
      // карточку сразу после успешной брони, и форма оставалась на экране с кнопкой «Создать бронь»
      signal: AbortSignal.timeout(60_000),
    });
  } catch (error) {
    // Next.js also throws here to switch static prerendering to request-time rendering.
    // Only translate actual fetch failures; framework control flow must propagate unchanged.
    if (!(
      error instanceof TypeError ||
      (error instanceof DOMException && ['TimeoutError', 'AbortError'].includes(error.name))
    ))
      throw error;
    // No automatic retry: a timed-out payment/booking may already have been committed by the API.
    throw new ApiError(
      503,
      options.method && options.method !== 'GET'
        ? 'Нет ответа API. Проверьте результат операции перед повтором.'
        : 'Нет связи с API. Проверьте подключение.',
    );
  }
  // Сессия кончилась: при включённом замке человека ведём на вход. Ответы самого входа исключены —
  // иначе неверный пароль отправлял бы на ту же страницу без объяснения (ADR-046). Подпись помощника
  // тоже: её просит макет на каждой странице, включая сам экран входа, и 401 там значит «чат анонимный».
  if (response.status === 401 && !QUIET_401_PATHS.some((p) => path.startsWith(p))) {
    const { redirectToLoginIfRequired } = await import('./session');
    await redirectToLoginIfRequired();
  }
  if (!testing && response.headers.get('x-wetop-data-source') === 'synthetic') {
    throw new ApiError(503, 'Тестовый источник отключён. Подключите рабочий API.');
  }
  if (!demo && response.headers.get('x-wetop-data-source') === 'demo')
    throw new ApiError(503, 'Демонстрационный источник отключён. Подключите рабочий API.');
  return response;
}

/**
 * Кто делает запрос: токен сессии из cookie уходит в API заголовком, и `audit_logs.user_id` заполняется сам
 * (DATA_MODEL §13.8). Импорт динамический — `next/headers` не должен попасть в клиентский бандл,
 * потому что из этого файла клиентские компоненты берут ещё и formatMinor с типами.
 */
async function sessionHeader(): Promise<Record<string, string>> {
  try {
    const { sessionToken } = await import('./session');
    const token = await sessionToken();
    return token ? { 'x-wetop-session': token } : {};
  } catch {
    return {};
  }
}

async function getJson<T>(path: string): Promise<T> {
  const res = await backendFetch(path);
  if (!res.ok) {
    // Текст отказа NestJS (400/404/422) — администратору нужен он, а не «HTTP 400» (волна 3)
    let message = `API ${path}: HTTP ${res.status}`;
    if (res.status < 500)
      try {
        const j = (await res.json()) as { message?: string | string[] };
        if (j.message) message = Array.isArray(j.message) ? j.message.join('; ') : j.message;
      } catch {
        /* тело не JSON */
      }
    throw new ApiError(res.status, message);
  }
  return (await res.json()) as T;
}

/** Для страниц, которым нужен произвольный путь API (журнал). */
export const getJsonPublic = getJson;

/** Публичный статус сервиса (H14, ADR-141): четыре части словами, без входа */
export interface PublicServiceStatus {
  checkedAt: string;
  overall: 'ok' | 'degraded' | 'down';
  components: Array<{
    key: 'app' | 'database' | 'channels' | 'booking';
    label: string;
    state: 'ok' | 'degraded' | 'down';
  }>;
}
export const statusApi = {
  public: () => getJson<PublicServiceStatus>('/status/public'),
};

export interface OnboardingStatus {
  needed: boolean;
  name: string;
  currency: string;
}
export interface OnboardingCategoryInput {
  name: string;
  kind: 'PRIVATE_ROOM' | 'DORM_BED' | 'APARTMENT';
  capacityAdults: number;
  units: number;
  priceMinor: number;
}
/** Онбординг нового отеля (plans/onboarding-2026-09-21.md). */
export const onboardingApi = {
  status: () => getJson<OnboardingStatus>('/hotel/onboarding'),
  provision: (body: { currency: string; categories: OnboardingCategoryInput[] }) =>
    sendJson<{ ok: true; categories: number; units: number }>('POST', '/hotel/onboarding', body),
};

/** Правка «Общих» настроек гостиницы владельцем (ТЗ ux-retention п. 3.1). Валюту и пояс API не принимает. */
export const hotelSettingsApi = {
  update: (patch: Record<string, string | null>) =>
    sendJson<unknown>('PATCH', '/hotel/settings', patch),
};

/** Услуга каталога «Настроек объекта» (SET3): весь каталог, с архивными; код — ссылка для правки, в стойке не виден */
export interface CatalogService {
  code: string;
  name: string;
  group: string | null;
  priceMinor: string;
  active: boolean;
}
export type CatalogServiceInput = {
  name?: string;
  group?: string | null;
  price?: string;
  active?: boolean;
};
export const serviceCatalogApi = {
  list: () => getJson<CatalogService[]>('/hotel/services'),
  create: (input: CatalogServiceInput) =>
    sendJson<CatalogService>('POST', '/hotel/services', input),
  update: (code: string, input: CatalogServiceInput) =>
    sendJson<CatalogService>('PATCH', `/hotel/services/${encodeURIComponent(code)}`, input),
};

/** Где лежат данные гостей (ADR-072): `real` — база в Казахстане; `pseudonymized` — имена и контакты не хранятся */
export type PiiStorage = 'real' | 'pseudonymized';

export const api = {
  inventorySummary: () => getJson<InventorySummary>('/inventory/summary'),
  /** Не прочиталось — считаем «не хранятся»: форма без имени безопаснее, чем имя в базе за границей */
  piiStorage: () =>
    getJson<{ storage: PiiStorage }>('/system/pii-storage')
      .then((r): PiiStorage => (r.storage === 'real' ? 'real' : 'pseudonymized'))
      .catch((): PiiStorage => 'pseudonymized'),
  inventoryUnits: (category?: string) =>
    getJson<InventoryUnit[]>(
      category ? `/inventory/units?category=${encodeURIComponent(category)}` : '/inventory/units',
    ),
};

export type CellState = 'FREE' | 'OCCUPIED' | 'BLOCKED';
export interface ChessboardCell {
  date: string;
  state: CellState;
  itemId?: string;
  itemStatus?: string;
  confirmationNumber?: string;
  guestLabel?: string;
  guestPhone?: string | null;
  isArrival?: boolean;
  isLastNight?: boolean;
  /** Откуда бронь и сколько по ней не заплачено (срез 7.1): канал бейджем, долг плашкой суммы */
  source?: string;
  channel?: string | null;
  balanceMinor?: string;
  blockType?: string;
  /** причина блокировки («ремонт: кондиционер») — показывается подсказкой на клетке */
  blockReason?: string | null;
}
export interface ChessboardRow {
  unit: {
    id: string;
    code: string;
    kind: 'ROOM' | 'BED';
    accommodationTypeCode: string;
    accommodationTypeName: string;
    /** Убрана ли ячейка: бейдж в строке и фильтр «Уборка» (срез 7.1) */
    housekeepingStatus?: 'DIRTY' | 'CLEAN' | 'INSPECTED';
  };
  cells: ChessboardCell[];
}
/** Проживание без назначенной ячейки в диапазоне доски; гость — только имя, как на плашке сетки */
export interface UnassignedStay {
  confirmationNumber: string;
  /** id проживания для назначения из ящика «Брони без размещения» (ТЗ «Шахматка v2» §12) */
  itemId?: string;
  guestLabel?: string;
  categoryCode: string;
  categoryName: string;
  arrivalDate: string;
  departureDate: string;
  status: string;
}
export interface Chessboard {
  from: string;
  to: string;
  dates: string[];
  rows: ChessboardRow[];
  summary: Record<string, { occupied: number; blocked: number; free: number }>;
  /** дата → код категории → сколько единиц, занято, заблокировано, свободно */
  byCategory: Record<
    string,
    Record<string, { units: number; occupied: number; blocked: number; free: number }>
  >;
  /** По категории, затем по заезду; ячеек не занимают, в summary не входят */
  unassigned: UnassignedStay[];
}
export interface ReservationCard {
  confirmationNumber: string;
  source: string;
  channel: string | null;
  /** ADR-071: номер брони в канале (ручная бронь OTA) или `unique_id` Channex (`BDC-…`) */
  externalId?: string | null;
  status: string;
  arrivalDate: string;
  departureDate: string;
  adults: number;
  children: number;
  currency: string;
  totalAmountMinor: string;
  notes: string | null;
  primaryGuest: {
    id: string;
    label: string;
    citizenship: string | null;
    phone: string | null;
  } | null;
  items: Array<{
    id: string;
    accommodationTypeCode: string;
    accommodationTypeName: string;
    arrivalDate: string;
    departureDate: string;
    status: string;
    priceMinor: string;
    /** Тариф проживания; null — неизвестен, пересчёт цены требует выбрать тариф */
    ratePlanCode?: string | null;
    ratePlanName?: string | null;
    /** Гостей на проживании — правится с карточки */
    adults: number;
    children: number;
    unitCode: string | null;
    /** Статус уборки ячейки (Q-156): стойка предупреждает о заселении в непроверенную */
    unitHousekeepingStatus?: 'DIRTY' | 'CLEAN' | 'INSPECTED' | null;
    guests: Array<{ label: string; isPrimary: boolean }>;
  }>;
}
export const chessboardApi = {
  board: (from?: string, to?: string) => {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    const s = q.toString();
    return getJson<Chessboard>(`/chessboard${s ? `?${s}` : ''}`);
  },
  reservation: (number: string) =>
    getJson<ReservationCard>(`/reservations/${encodeURIComponent(number)}`),
};
// formatMinor и messengerLinks переехали в ./format — их берут и клиентские компоненты (см. там же)
export { formatMinor, messengerLinks } from './format';

export interface StayOffer {
  /** Сколько тарифов допустимо для проживания */
  plans: number;
  /** Весь срок на всех гостей запроса по самому дешёвому тарифу, тиыны строкой */
  totalMinor: string;
  /** Самая низкая цена ночи за номер целиком или за одну койку */
  perNightMinor: string;
  ratePlanCode: string;
}
export interface StayOffers {
  arrivalDate: string;
  departureDate: string;
  nights: number;
  guests: number;
  currency: string;
  byCategory: Record<string, StayOffer | null>;
}
/** Ближайшая доступность (ADR-110, AV4): по категории первое окно того же срока, где хватает мест */
export interface NearestStays {
  arrivalDate: string;
  departureDate: string;
  guests: number;
  /** Глубина поиска вперёд, дней */
  days: number;
  /** null — за `days` дней мест не нашлось */
  byCategory: Record<string, { arrivalDate: string; departureDate: string } | null>;
}
export interface StayAvailability {
  arrivalDate: string;
  departureDate: string;
  nights: number;
  byCategory: Record<string, { units: number; available: number; availableUnitCodes: string[] }>;
  total: { units: number; available: number };
}
export interface RatePlanOption {
  code: string;
  name: string;
  currency: string;
  /** Правило штрафа тарифа: администратор назначает брони без тарифа только тариф со штрафом (Q-201) */
  cancellationPenalty?: CancellationPenaltyPolicy;
}
/** Ошибка API с текстом из ответа NestJS (400/404/409/422) — показывается администратору как есть. */
export { ApiError, apiErrorDigest, apiErrorStatus } from './api-error';

async function sendJson<T>(
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<T> {
  const res = await backendFetch(path, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const j = (await res.json()) as { message?: string | string[] };
      if (j.message) message = Array.isArray(j.message) ? j.message.join('; ') : j.message;
    } catch {
      /* тело не JSON */
    }
    // Б6: неожиданный сбой сервера после команды не значит «не выполнено» — запись могла пройти, а повтор
    // создаст дубль брони или оплаты. 503 нашего API — осознанный отказ со своим текстом, его не трогаем.
    if (res.status === 500 || res.status === 502 || res.status === 504)
      message = `Сервер ответил ошибкой ${res.status}: операция могла выполниться. Проверьте результат на странице перед повтором.`;
    throw new ApiError(res.status, message);
  }
  return (await res.json()) as T;
}

export interface SignedIn {
  id: string;
  email: string;
  /** Имя необязательно (DATA_MODEL §13.2) — тогда зовём по почте */
  name: string | null;
  /** Организация, под которой открыта сессия (§13.5) */
  organizationId: string;
  /** Имя, состояние и пробный период организации (ADR-046) — их показывает экран входа */
  organization?: SignedInOrganization | null;
  /**
   * Роль в организации сессии (DATA_MODEL §16.1): владелец, управляющий или администратор; права ролей — §16.5, ADR-107.
   * Старый API роли не присылает — тогда считаем администратором
   */
  role?: MembershipRole;
  /** Главный администратор платформы (§16.2): раздел «Платформа» */
  platformAdmin?: boolean;
}

/** Расширение «ИИ-продавец» организации (ADR-083, Q-183): `expired` — срок вышел, раздел только для чтения */
export interface ExtensionAccessView {
  access: 'active' | 'expired' | 'off';
  status: 'TRIAL' | 'ACTIVE' | 'OFF' | null;
  activeUntil: string | null;
  /** Дней до конца срока; бессрочно или выключено — `null` */
  daysLeft: number | null;
}

/** Что открыто организации вошедшего — от этого зависят пункты меню */
export interface DeskAccessView {
  aiSeller: ExtensionAccessView;
}

export interface SignedInOrganization {
  name: string;
  status: 'TRIAL' | 'ACTIVE' | 'READ_ONLY' | 'SUSPENDED' | (string & {});
  trialEndsAt: string | null;
}

/** Заголовки, которые стойка передаёт API от имени браузера: адрес посетителя для пределов и агент для списка сессий. */
export interface AuthClientInfo {
  ip: string | null;
  userAgent: string | null;
}
function authHeaders(info: AuthClientInfo, token?: string | null): Record<string, string> {
  return {
    'content-type': 'application/json',
    ...(info.ip ? { 'cf-connecting-ip': info.ip } : {}),
    ...(info.userAgent ? { 'user-agent': info.userAgent } : {}),
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}
async function messageOf(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { message?: string | string[] };
    if (j.message) return Array.isArray(j.message) ? j.message.join('; ') : j.message;
  } catch {
    /* тело не JSON */
  }
  return `HTTP ${res.status}`;
}

/**
 * Вход в стойку. Два способа живут рядом, пока владелец не выбрал (Q-146): по паролю (DATA_MODEL §13.8,
 * ADR-049) и по одноразовому коду на почту с регистрацией организации (ADR-046). Сессия у обоих одна:
 * таблица `sessions` в API и кука `wetop_session` в стойке. Токен кладёт серверное действие
 * `login/actions.ts`, сюда он потом попадает сам, заголовком (см. sessionHeader); `/auth/me` и
 * `/auth/logout` общие — API узнаёт сессию любого входа.
 */
export const authApi = {
  options: () => getJson<{ registrationEnabled: boolean }>('/auth/options'),
  // адрес посетителя уезжает заголовком: лимиты входа по адресу (С-5, ТЗ аудита 25.09.2026) считает API
  login: (body: { email: string; password: string }, info?: AuthClientInfo) =>
    sendJson<{ token: string; expiresAt: string; user: SignedIn }>(
      'POST',
      '/auth/login',
      body,
      info ? authHeaders(info) : {},
    ),
  me: async () => {
    const result = await getJson<{
      user: SignedIn | null;
      organization?: SignedInOrganization | null;
      expiresAt?: string;
      access?: DeskAccessView;
    }>('/auth/me');
    // whoami returns organization alongside user; older previews nested it inside user.
    return {
      ...result,
      user: result.user
        ? {
            ...result.user,
            organization:
              result.organization !== undefined
                ? result.organization
                : (result.user.organization ?? null),
          }
        : null,
    };
  },
  logout: () => sendJson<{ ok: boolean }>('POST', '/auth/logout', {}),
  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    sendJson<{ ok: boolean }>('POST', '/auth/password', body),
  /** «Забыли пароль»: ответ один и тот же, есть такая почта или нет */
  requestReset: (body: { email: string }, info?: AuthClientInfo) =>
    sendJson<{ ok: boolean }>(
      'POST',
      '/auth/password-reset/request',
      body,
      info ? authHeaders(info) : {},
    ),
  /** Пароль по одноразовой ссылке из письма */
  confirmReset: (body: { token: string; password: string }, info?: AuthClientInfo) =>
    sendJson<{ ok: boolean }>(
      'POST',
      '/auth/password-reset/confirm',
      body,
      info ? authHeaders(info) : {},
    ),
  // Вход по коду на почту снят 20.09.2026 (ADR-053): requestCode и verify убраны вместе с ним.
  /**
   * Регистрация: почта, имя, пароль (ADR-053, ADR-060). Ключа сессии в ответе нет — сначала письмо
   * и подтверждение почты. 400 с текстом приходит на кривую форму и на занятый адрес.
   */
  register: (
    body: {
      email: string;
      name: string;
      hotelName: string;
      password: string;
      phoneCountry: string;
      phone: string;
      privacyAccepted: boolean;
    },
    info?: AuthClientInfo,
  ) =>
    sendJson<{ pendingVerification: true; email: string; name: string; sent: boolean }>(
      'POST',
      '/auth/register',
      body,
      info ? authHeaders(info) : {},
    ),
  /** Подтверждение почты по ссылке из письма: ответ тот же, что у входа — ключ, срок, кто вошёл */
  verifyEmail: (body: { token: string }, info?: AuthClientInfo) =>
    sendJson<{ token: string; expiresAt: string; user: SignedIn }>(
      'POST',
      '/auth/email/verify',
      body,
      info ? authHeaders(info) : {},
    ),
  /** «Выслать письмо заново»: ответ один и тот же, есть такая почта или нет */
  resendVerification: (body: { email: string }, info?: AuthClientInfo) =>
    sendJson<{ ok: boolean }>('POST', '/auth/email/resend', body, info ? authHeaders(info) : {}),
  // ── Приглашения (срез 13, этап 7) ─────────────────────────────────────────────────────────────
  /** Ожидающие приглашения своей организации. 401 — сессии нет. */
  invites: async (token: string, info: AuthClientInfo): Promise<AuthInvite[]> => {
    const res = await backendFetch('/auth/invites', { headers: authHeaders(info, token) });
    if (!res.ok) throw new ApiError(res.status, await messageOf(res));
    return (await res.json()) as AuthInvite[];
  },
  /**
   * 201 с приглашением; 400 с текстом про почту, роль или «уже в организации»; 403 — звать с этой ролью нельзя
   * (управляющих зовёт только владелец, ADR-107); 401 — сессии нет.
   */
  invite: async (
    token: string,
    email: string,
    role: InviteRole,
    info: AuthClientInfo,
  ): Promise<AuthInvite> => {
    const res = await backendFetch('/auth/invites', {
      method: 'POST',
      headers: authHeaders(info, token),
      body: JSON.stringify({ email, role }),
    });
    if (!res.ok) throw new ApiError(res.status, await messageOf(res));
    return (await res.json()) as AuthInvite;
  },
  /** Отозвать ожидающее приглашение (аудит 26.09, С-10): 404 — его нет или оно не по роли вошедшего */
  revokeInvite: async (token: string, id: string, info: AuthClientInfo): Promise<void> => {
    const res = await backendFetch(`/auth/invites/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: authHeaders(info, token),
    });
    if (!res.ok) throw new ApiError(res.status, await messageOf(res));
  },
  // ── Сотрудники (ADR-107, DATA_MODEL §16.1 v1.14) ──────────────────────────────────────────────
  /** Люди своей организации с ролями — владельцу и управляющему; 403 — администратору */
  members: async (token: string, info: AuthClientInfo): Promise<AuthMember[]> => {
    const res = await backendFetch('/auth/members', { headers: authHeaders(info, token) });
    if (!res.ok) throw new ApiError(res.status, await messageOf(res));
    return (await res.json()) as AuthMember[];
  },
  /** Отключить: членство удаляется, его сессии гаснут; 403 со словами, если нельзя */
  removeMember: async (token: string, userId: string, info: AuthClientInfo): Promise<void> => {
    const res = await backendFetch(`/auth/members/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers: authHeaders(info, token),
    });
    if (!res.ok) throw new ApiError(res.status, await messageOf(res));
  },
  /** Роль между управляющим и администратором — только владелец */
  setMemberRole: async (
    token: string,
    userId: string,
    role: InviteRole,
    info: AuthClientInfo,
  ): Promise<void> => {
    const res = await backendFetch(`/auth/members/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      headers: authHeaders(info, token),
      body: JSON.stringify({ role }),
    });
    if (!res.ok) throw new ApiError(res.status, await messageOf(res));
  },
  /** Кто зовёт и кого — по ключу из ссылки. `null` на любую мёртвую ссылку (404). */
  inviteByToken: async (
    rawToken: string,
    info: AuthClientInfo,
  ): Promise<AuthInvitePreview | null> => {
    const res = await backendFetch(`/auth/invites/${encodeURIComponent(rawToken)}`, {
      headers: authHeaders(info),
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new ApiError(res.status, await messageOf(res));
    return (await res.json()) as AuthInvitePreview;
  },
  /** Принять: членство заведено, в ответ ключ «задайте пароль». 404 с текстом на мёртвую ссылку. */
  acceptInvite: async (rawToken: string, info: AuthClientInfo): Promise<AuthInvitePreview> => {
    const res = await backendFetch(`/auth/invites/${encodeURIComponent(rawToken)}/accept`, {
      method: 'POST',
      headers: authHeaders(info),
      body: '{}',
    });
    if (!res.ok) throw new ApiError(res.status, await messageOf(res));
    return (await res.json()) as AuthInvitePreview;
  },
  // ── «Где я вошёл» и «выйти везде» (срез 13, §13.5) ────────────────────────────────────────────
  /** Живые сессии вошедшего, устройство словами, своя помечена. 401 — сессии нет. */
  sessions: async (token: string, info: AuthClientInfo): Promise<AuthSessionRow[]> => {
    const res = await backendFetch('/auth/sessions', { headers: authHeaders(info, token) });
    if (!res.ok) throw new ApiError(res.status, await messageOf(res));
    return (await res.json()) as AuthSessionRow[];
  },
  /** 204 всегда: все сессии человека отозваны, включая эту; мёртвый ключ — не ошибка. */
  logoutAll: async (token: string, info: AuthClientInfo): Promise<void> => {
    const res = await backendFetch('/auth/logout-all', {
      method: 'POST',
      headers: authHeaders(info, token),
      body: '{}',
    });
    if (!res.ok) throw new ApiError(res.status, await messageOf(res));
  },
};

/**
 * Предпросмотр сумм до подтверждения (срез 7.3, Д5): считает сервер теми же функциями, что и запись,
 * ничего не пишет. `null` в сумме — посчитать нельзя (нет тарифа), причина в `problem`.
 */
export interface MovePreview {
  unitCode: string;
  changesCategory: boolean;
  fromCategory: { code: string; name: string } | null;
  toCategory: { code: string; name: string } | null;
  nights: number;
  currentMinor: string;
  newMinor: string | null;
  ratePlanRequired: boolean;
  problem: string | null;
}
export interface ExtendPreview {
  nights: number;
  departureDate: string;
  unitCode: string | null;
  addedMinor: string | null;
  newMinor: string | null;
  ratePlanRequired: boolean;
  /** Ячейка свободна на добавленные ночи (без брони и блокировки); без ячейки — true */
  nextNightsFree: boolean;
  problem: string | null;
}
export interface CancelPreview {
  reason: 'cancel' | 'no_show';
  items: Array<{
    itemId: string;
    unitCode: string | null;
    policy: 'NONE' | 'FIRST_NIGHT' | 'FULL_STAY';
    /** Наступил ли момент штрафа (Q-103): отмена до дня заезда бесплатна */
    dueNow: boolean;
    penaltyMinor: string;
  }>;
  totalPenaltyMinor: string;
}
const query = (params: Record<string, string | number | undefined>) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : '';
};
export const reservationsApi = {
  ratePlans: () => getJson<RatePlanOption[]>('/rate-plans'),
  availability: (arrival: string, departure: string) =>
    getJson<StayAvailability>(
      `/availability?arrival=${encodeURIComponent(arrival)}&departure=${encodeURIComponent(departure)}`,
    ),
  /** Цены «от» для «Свободных мест» (ADR-110, AV2): правило закрытого Q-204 считает API */
  offers: (arrival: string, departure: string, guests: number) =>
    getJson<StayOffers>(`/availability/offers${query({ arrival, departure, guests })}`),
  /** Ближайшая доступность для категорий без мест (ADR-110, AV4) */
  nearest: (arrival: string, departure: string, guests: number) =>
    getJson<NearestStays>(`/availability/nearest${query({ arrival, departure, guests })}`),
  quote: (body: unknown) =>
    sendJson<{
      totalMinor: string;
      currency: string;
      nights?: Array<{ date: string; priceMinor: string }>;
    }>('POST', '/reservations/quote', body),
  create: (body: unknown) => sendJson<ReservationCard>('POST', '/reservations', body),
  changeDates: (number: string, body: unknown) =>
    sendJson<ReservationCard>('PATCH', `/reservations/${encodeURIComponent(number)}/dates`, body),
  /** Правка готовой брони: заметки и источник */
  update: (number: string, body: unknown) =>
    sendJson<ReservationCard>('PATCH', `/reservations/${encodeURIComponent(number)}`, body),
  /** Гостей на проживании */
  updateItem: (number: string, itemId: string, body: unknown) =>
    sendJson<ReservationCard>(
      'PATCH',
      `/reservations/${encodeURIComponent(number)}/items/${encodeURIComponent(itemId)}`,
      body,
    ),
  cancel: (number: string) =>
    sendJson<ReservationCard>('POST', `/reservations/${encodeURIComponent(number)}/cancel`, {}),
  stay: (
    number: string,
    itemId: string,
    action: 'check-in' | 'check-out' | 'no-show',
    body: unknown = {},
  ) =>
    sendJson<ReservationCard>(
      'POST',
      `/reservations/${encodeURIComponent(number)}/items/${encodeURIComponent(itemId)}/${action}`,
      body,
    ),
  /** ratePlanCode — только если у проживания нет своего тарифа (Б8): иначе цена ночи берётся по нему */
  extend: (number: string, itemId: string, nights = 1, ratePlanCode?: string) =>
    sendJson<ReservationCard>(
      'POST',
      `/reservations/${encodeURIComponent(number)}/items/${encodeURIComponent(itemId)}/extend`,
      { nights, ...(ratePlanCode ? { ratePlanCode } : {}) },
    ),
  /** Сколько будет стоить действие — до подтверждения (срез 7.3, Д5). Только чтение. */
  preview: (number: string, itemId: string, query: Record<string, string>) =>
    getJson<ActionPreview>(
      `/reservations/${encodeURIComponent(number)}/items/${encodeURIComponent(itemId)}/preview?${new URLSearchParams(query).toString()}`,
    ),
  /** Срез 7.3, Д5: сумма до подтверждения — только чтение */
  movePreview: (number: string, itemId: string, unitCode: string, ratePlanCode?: string) =>
    getJson<MovePreview>(
      `/reservations/${encodeURIComponent(number)}/items/${encodeURIComponent(itemId)}/move-preview${query({ unitCode, ratePlanCode })}`,
    ),
  extendPreview: (number: string, itemId: string, nights = 1, ratePlanCode?: string) =>
    getJson<ExtendPreview>(
      `/reservations/${encodeURIComponent(number)}/items/${encodeURIComponent(itemId)}/extend-preview${query({ nights, ratePlanCode })}`,
    ),
  cancelPreview: (number: string, reason: 'cancel' | 'no_show', itemId?: string) =>
    getJson<CancelPreview>(
      `/reservations/${encodeURIComponent(number)}/cancel-preview${query({ reason, itemId })}`,
    ),
  assign: (number: string, itemId: string, body: unknown) =>
    sendJson<ReservationCard>(
      'POST',
      `/reservations/${encodeURIComponent(number)}/items/${encodeURIComponent(itemId)}/assign`,
      body,
    ),
};

// ── Цены и ограничения (Slice 3.5 / 4.5) ──
export interface RateCalendarDay {
  date: string;
  prices: Record<string, string>;
  minStay: number | null;
  maxStay: number | null;
  stopSell: boolean;
  closedToArrival: boolean;
  closedToDeparture: boolean;
}
export interface RateCalendar {
  accommodationTypeCode: string;
  ratePlanCode: string;
  currency: string;
  capacityAdults: number;
  days: RateCalendarDay[];
}
export interface RateOptions {
  categories: Array<{ code: string; name: string; capacityAdults: number }>;
  ratePlans: Array<{ code: string; name: string; currency: string; active: boolean }>;
}
export interface RateChangeInput {
  accommodationTypeCode: string;
  ratePlanCode: string;
  dateFrom: string;
  dateTo: string;
  days?: string[] | undefined;
  price?: string | undefined;
  occupancy?: number | undefined;
  minStay?: number | null | undefined;
  maxStay?: number | null | undefined;
  stopSell?: boolean | undefined;
  closedToArrival?: boolean | undefined;
  closedToDeparture?: boolean | undefined;
}
export const ratesApi = {
  options: () => getJson<RateOptions>('/rates/options'),
  calendar: (accommodationTypeCode: string, ratePlanCode: string, from: string, to: string) =>
    getJson<RateCalendar>(
      `/rates?accommodationTypeCode=${encodeURIComponent(accommodationTypeCode)}&ratePlanCode=${encodeURIComponent(ratePlanCode)}&from=${from}&to=${to}`,
    ),
  bulk: (changes: RateChangeInput[]) =>
    sendJson<{ applied: number; rateRows: number; restrictionRows: number; queued: number }>(
      'POST',
      '/rates/bulk',
      { changes },
    ),
  /** «Тарифные планы» (SET4): тарифы с правилом отмены и числом броней, которые его правка заденет */
  plans: () => getJson<RatePlanRow[]>('/rates/plans'),
  updatePlan: (code: string, input: { cancellationPenalty: CancellationPenaltyPolicy }) =>
    sendJson<RatePlanRow>('PATCH', `/rates/plans/${encodeURIComponent(code)}`, input),
  /** Производный тариф (D4, DATA_MODEL §20): процент от тарифа-родителя, окно продаж, минимум ночей */
  createDerived: (input: DerivedPlanInput & { name: string; parentCode: string }) =>
    sendJson<RatePlanRow>('POST', '/rates/plans/derived', input),
  updateDerived: (
    code: string,
    input: Partial<DerivedPlanInput> & { name?: string; active?: boolean },
  ) => sendJson<RatePlanRow>('PATCH', `/rates/plans/${encodeURIComponent(code)}/derived`, input),
  promoCodes: () => getJson<PromoCodeRow[]>('/rates/promo-codes'),
  createPromo: (input: PromoCodeInput) =>
    sendJson<PromoCodeRow>('POST', '/rates/promo-codes', input),
  updatePromo: (
    code: string,
    input: {
      active?: boolean;
      maxUses?: number | null;
      stayFrom?: string | null;
      stayTo?: string | null;
    },
  ) => sendJson<PromoCodeRow>('PATCH', `/rates/promo-codes/${encodeURIComponent(code)}`, input),
};
export interface DerivedPlanInput {
  discountPercent: number;
  minDaysBeforeArrival: number | null;
  maxDaysBeforeArrival: number | null;
  minNights: number | null;
}
export interface PromoCodeInput {
  code: string;
  discountPercent: number;
  stayFrom?: string | null;
  stayTo?: string | null;
  maxUses?: number | null;
}
export interface PromoCodeRow {
  code: string;
  discountPercent: number;
  stayFrom: string | null;
  stayTo: string | null;
  maxUses: number | null;
  active: boolean;
  uses: number;
}
export interface RatePlanRow {
  code: string;
  name: string;
  currency: string;
  active: boolean;
  cancellationPenalty: CancellationPenaltyPolicy;
  /** Названия категорий, к которым привязан тариф */
  categories: string[];
  /** Производный тариф: родитель и условия продажи; у обычного — `null` (D4, DATA_MODEL §20) */
  derived?: {
    parentName: string;
    discountPercent: number;
    minDaysBeforeArrival: number | null;
    maxDaysBeforeArrival: number | null;
    minNights: number | null;
  } | null;
  /** Брони по тарифу, ещё не заехавшие и не отменённые, с выездом сегодня или позже: их задевает правка правила */
  upcomingReservations: number;
}

// ── Каналы (Channex) ──
export interface ChannelMappingRow {
  id: string;
  localAccommodationTypeCode: string | null;
  localRatePlanId: string | null;
  localRatePlanCode: string | null;
  providerPropertyId: string;
  providerRoomTypeId: string | null;
  providerRatePlanId: string | null;
}
export interface OutboxSummary {
  /** ISO-время самой старой неотправленной дельты (T6) */
  oldestPendingAt?: string | null;
  pending: number;
  failed: number;
  sent: number;
  lastSentAt: string | null;
  lastTaskId: string | null;
}
export const channelsApi = {
  connection: () => getJson<ChannelConnection>('/channels/channex/connection'),
  mapping: () => getJson<ChannelMappingRow[]>('/channels/channex/mapping'),
  channexNames: () =>
    getJson<{ roomTypes: Record<string, string>; ratePlans: Record<string, string> }>(
      '/channels/channex/content/names',
    ),
  outbox: () => getJson<OutboxSummary>('/channels/channex/outbox'),
  /** Строки очереди: что именно уехало в Channex (срез 7.2) */
  outboxMessages: (limit = 20) =>
    getJson<OutboxMessage[]>(`/channels/channex/outbox/messages?limit=${limit}`),
  setup: () => sendJson<unknown>('POST', '/channels/channex/setup', {}),
  /** Без `days` — глубина по умолчанию API (DEFAULT_SYNC_DAYS = 500, сертификация Channex §1) */
  sync: (days?: number) =>
    sendJson<{ from: string; to: string; tasks: string[] }>(
      'POST',
      days ? `/channels/channex/sync?days=${days}` : '/channels/channex/sync',
      {},
    ),
  pull: () =>
    sendJson<{ received: number; acknowledged: number; outcomes: unknown[] }>(
      'POST',
      '/channels/channex/pull',
      {},
    ),
  flush: () =>
    sendJson<{ sent: unknown[]; errors: unknown[] }>('POST', '/channels/channex/outbox/flush', {}),
  /** Журнал входящих событий с фильтрами и постраничностью (срез 7.2) */
  events: (q: EventsQuery = {}) => {
    const sp = new URLSearchParams();
    sp.set('limit', String(q.limit ?? 20));
    sp.set('offset', String(q.offset ?? 0));
    if (q.status) sp.set('status', q.status);
    if (q.type) sp.set('type', q.type);
    if (q.q) sp.set('q', q.q);
    return getJson<{ rows: InboundEvent[]; total: number }>(`/channels/channex/events?${sp}`);
  },
  /** Страница «Приём брони из канала»: ревизия без ПД → бронь → ячейки */
  event: (revisionId: string) =>
    getJson<RevisionPage>(`/channels/channex/events/${encodeURIComponent(revisionId)}`),
  /** Строки очереди ARI: что ушло, на какие даты, по каким категориям */
  outboxRows: (status?: OutboxRowStatus, limit = 50) =>
    getJson<OutboxRow[]>(
      `/channels/channex/outbox/rows?limit=${limit}${status ? `&status=${status}` : ''}`,
    ),
  retryEvent: (revisionId: string) =>
    sendJson<{ result: string; confirmationNumber: string | null; error?: string }>(
      'POST',
      `/channels/channex/events/${encodeURIComponent(revisionId)}/retry`,
      {},
    ),
  webhookStatus: () => getJson<WebhookStatus>('/channels/channex/webhook/status'),
  registerWebhook: () =>
    sendJson<{
      id: string;
      callbackUrl: string;
      created: boolean;
      eventMask: string;
      active: boolean;
    }>('POST', '/channels/channex/webhook/register', {}),
  testWebhook: () =>
    sendJson<{ callbackUrl: string; statusCode: number; body: string; verdict: string }>(
      'POST',
      '/channels/channex/webhook/test',
      {},
    ),
  /** Раздел «Каналы» (ADR-140): подключения объекта и каталог каналов Channex, брони за 30 дней из WETOP */
  catalog: () => getJson<ChannelCatalog>('/channels/channex/channels'),
  /** Канал отдаёт уже сделанные у него будущие брони (только владельцу, только каналу с этим действием) */
  loadFutureReservations: (connectionId: string) =>
    sendJson<{ channel: string }>(
      'POST',
      `/channels/channex/channels/${encodeURIComponent(connectionId)}/load-future-reservations`,
      {},
    ),
  /** Окно Channex для подключения и настройки канала: одноразовый адрес, только владельцу */
  connectSession: (channel?: string) =>
    sendJson<{ url: string; expiresInMinutes: number }>(
      'POST',
      '/channels/channex/channels/connect-session',
      channel ? { channel } : {},
    ),
};
/** Статус канала по фактам (ADR-140): «Работает» — включён, событие за 30 дней, нет ошибок входящих за 7 дней */
export type ChannelStatus = 'WORKING' | 'ENABLED' | 'ERRORS' | 'OFF' | 'REMOVING';
export interface ChannelConnectionRow {
  id: string;
  adapterCode: string;
  channelKey: string;
  channelTitle: string;
  connectionTitle: string;
  channelPropertyId: string | null;
  active: boolean;
  removalDate: string | null;
  mappedRatePlans: number;
  actions: string[];
  shortCode: string | null;
  bookings30: number;
  lastBookingAt: string | null;
  lastEventAt: string | null;
  failedEvents7d: number;
  status: ChannelStatus;
}
export interface ChannelAdapterRow {
  code: string;
  channelKey: string;
  title: string;
  kind: string;
  canLoadFutureReservations: boolean;
  shortCode: string | null;
  connected: boolean;
}
export interface ChannelOutsideRow {
  key: string;
  source: string;
  label: string | null;
  bookings30: number;
  lastBookingAt: string | null;
}
export interface ChannelCatalog {
  checkedAt: string;
  environment: 'staging' | 'production' | 'custom';
  propertyConnected: boolean;
  /** Приём броней целиком: последнее входящее событие и все ошибки приёма за 7 дней */
  inbound: { lastEventAt: string | null; failedEvents7d: number };
  state: 'READY' | 'NO_KEY' | 'NO_MAPPING' | 'DENIED' | 'UNREACHABLE';
  message: string;
  connections: ChannelConnectionRow[];
  adapters: ChannelAdapterRow[] | null;
  outside: ChannelOutsideRow[];
}
export interface ChannelConnection {
  checkedAt: string;
  environment: 'staging' | 'production' | 'custom';
  apiConfigured: boolean;
  propertyId: string | null;
  propertyAccessible: boolean;
  mappedCategories: number;
  mappedRatePlans: number;
  lastWebhookAt: string | null;
  lastPullAt: string | null;
  state: string;
  message: string;
}
export interface InboundEvent {
  externalEventId: string;
  receivedVia?: 'WEBHOOK' | 'PULL' | 'MANUAL';
  type: string;
  status: string;
  attempts: number;
  receivedAt: string;
  processedAt: string | null;
  lastError: string | null;
  reservationNumber?: string | null;
  /** Номер брони на стороне канала (`unique_id` ревизии) и канал — срез 7.2 */
  uniqueId?: string | null;
  otaName?: string | null;
  /** Бронь PMS, связанная по `externalId = unique_id`; null — ещё не создана или не сопоставлена */
  confirmationNumber?: string | null;
}
export interface EventsQuery {
  limit?: number;
  offset?: number;
  status?: string;
  type?: string;
  q?: string;
}
export type OutboxRowStatus = 'PENDING' | 'SENT' | 'FAILED';
/** Строка очереди `channel_outbox` для журнала интеграции (срез 7.2) */
export interface OutboxMessage {
  id: string;
  kind: 'AVAILABILITY' | 'RESTRICTIONS';
  status: 'PENDING' | 'SENT' | 'FAILED';
  attempts: number;
  taskId: string | null;
  lastError: string | null;
  createdAt: string;
  sentAt: string | null;
  lines: number;
  dateFrom: string | null;
  dateTo: string | null;
  roomTypeIds: string[];
  ratePlanIds: string[];
}

export interface OutboxRow {
  id: string;
  kind: 'AVAILABILITY' | 'RESTRICTIONS';
  status: OutboxRowStatus;
  attempts: number;
  taskId: string | null;
  lastError: string | null;
  createdAt: string;
  sentAt: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  /** Коды категорий по маппингу; неизвестный id провайдера — как есть */
  roomTypes: string[];
  messages: number;
}
/** Факты ревизии Channex без персональных данных гостя (ADR-018) */
export interface RevisionFacts {
  uniqueId: string | null;
  otaName: string | null;
  otaReservationCode: string | null;
  status: string | null;
  arrivalDate: string | null;
  departureDate: string | null;
  adults: number | null;
  children: number | null;
  amount: string | null;
  currency: string | null;
  paymentCollect: string | null;
  rooms: Array<{
    checkinDate: string | null;
    checkoutDate: string | null;
    roomTypeId: string | null;
    ratePlanId: string | null;
    adults: number | null;
    amount: string | null;
  }>;
}
export interface RevisionPage {
  event: InboundEvent;
  facts: RevisionFacts;
  /** provider room_type_id → код категории PMS */
  categoryByRoomType: Record<string, string>;
  reservation: ReservationCard | null;
  /** остаток счёта по проживанию (тиын, строка) — тот же `folioBalance`, что на карточке */
  balances: Record<string, string>;
}
export interface WebhookStatus {
  registered: boolean;
  id: string | null;
  callbackUrl: string | null;
  eventMask: string | null;
  active: boolean;
  sendData: boolean;
  expectedUrl: string | null;
  secretConfigured: boolean;
  /** Проба зарегистрированного адреса: true — ответил, false — не отвечает, null — не проверяли */
  callbackReachable?: boolean | null;
  callbackCheckedAt?: string | null;
}

// ── Ячейки: блокировки и уборка ──
export interface UnitCard {
  id: string;
  code: string;
  kind: 'ROOM' | 'BED';
  active: boolean;
  housekeepingStatus: 'DIRTY' | 'CLEAN' | 'INSPECTED';
  accommodationTypeCode: string;
  accommodationTypeName: string;
  roomNumber: string;
  /** Расположение и вместимость для панели места (ADR-108, срез I2) */
  buildingName: string;
  floorName: string;
  capacity: number;
  blocks: Array<{
    id: string;
    dateFrom: string;
    dateTo: string;
    type: string;
    reason: string | null;
  }>;
  stays: Array<{
    confirmationNumber: string;
    startDate: string;
    endDate: string;
    status: string;
    guestLabel: string;
  }>;
  housekeepingHistory: Array<{ at: string; from: string; to: string }>;
}
async function deleteJson<T>(path: string): Promise<T> {
  const res = await backendFetch(path, { method: 'DELETE' });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const j = (await res.json()) as { message?: string };
      if (j.message) message = j.message;
    } catch {
      /* не JSON */
    }
    throw new ApiError(res.status, message);
  }
  return (await res.json()) as T;
}
export const unitsApi = {
  card: (code: string) => getJson<UnitCard>(`/units/${encodeURIComponent(code)}`),
  block: (code: string, body: unknown) =>
    sendJson<UnitCard>('POST', `/units/${encodeURIComponent(code)}/blocks`, body),
  unblock: (code: string, blockId: string) =>
    deleteJson<UnitCard>(
      `/units/${encodeURIComponent(code)}/blocks/${encodeURIComponent(blockId)}`,
    ),
  housekeeping: (code: string, status: string) =>
    sendJson<UnitCard>('POST', `/units/${encodeURIComponent(code)}/housekeeping`, { status }),
};

// ── Гости ──
export interface GuestSummary {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  phone: string | null;
  email: string | null;
  citizenship: string | null;
  staysCount: number;
  lastStay: string | null;
}
export interface GuestCard {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  birthDate: string | null;
  citizenship: string | null;
  gender: 'MALE' | 'FEMALE' | 'UNKNOWN';
  phone: string | null;
  email: string | null;
  notes: string | null;
  documents: Array<{
    id: string;
    type: string;
    numberMasked: string;
    issueCountry: string | null;
    issuedAt: string | null;
    expiresAt: string | null;
  }>;
  stays: Array<{
    confirmationNumber: string;
    accommodationTypeName: string;
    arrivalDate: string;
    departureDate: string;
    status: string;
    unitCode: string | null;
    source: string;
    channel: string | null;
    currency: string;
    /** Начислено, оплачено, возвращено и остаток по счёту проживания (из Folio); null — счёта нет */
    chargedMinor: string | null;
    paidMinor: string | null;
    refundedMinor: string | null;
    balanceMinor: string | null;
  }>;
}
/** Справочник «Гости v2» (план guests-v2-2026-09-27): состояние гостя вычислено, статус брони наружу не идёт */
export type GuestDirectoryState = 'INHOUSE' | 'EXPECTED' | 'RECENT' | 'NONE';
export interface GuestDirectoryRow {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  phone: string | null;
  email: string | null;
  staysCount: number;
  state: GuestDirectoryState;
  current: {
    unitCode: string | null;
    accommodationTypeName: string;
    departureDate: string;
    confirmationNumber: string | null;
  } | null;
  next: {
    arrivalDate: string;
    departureDate: string;
    accommodationTypeName: string;
    confirmationNumber: string | null;
  } | null;
  last: {
    arrivalDate: string;
    departureDate: string;
    unitCode: string | null;
    confirmationNumber: string | null;
  } | null;
  lastCancelledAt: string | null;
}
/** Предпросмотр гостя панелью (G3, ТЗ §17): контакты, «сейчас», история, долг из Folio */
export interface GuestPreview extends Omit<GuestDirectoryRow, 'id'> {
  id: string;
  nightsTotal: number;
  hasFolios: boolean;
  debtMinor: string;
  currency: string;
}
export interface GuestDirectoryResult {
  total: number;
  page: number;
  pageSize: number;
  counts: {
    ALL: number;
    INHOUSE: number;
    EXPECTED: number;
    RECENT: number;
    /** G7: без активного проживания — не живёт, не ожидается и не выезжал за 30 дней */
    NONE: number;
  };
  rows: GuestDirectoryRow[];
}
/** «Дни рождения» (Q-249 T0): гость, дата дня рождения в окне и сколько исполняется */
export interface GuestBirthday {
  id: string;
  firstName: string;
  lastName: string;
  date: string;
  age: number;
}
export const guestsApi = {
  search: (q: string) => getJson<GuestSummary[]>(`/guests?q=${encodeURIComponent(q)}`),
  birthdays: (from: string, days: number) =>
    getJson<GuestBirthday[]>(`/guests/birthdays?from=${encodeURIComponent(from)}&days=${days}`),
  directory: (query: Record<string, string>) =>
    getJson<GuestDirectoryResult>(`/guests/directory?${new URLSearchParams(query)}`),
  preview: (id: string) => getJson<GuestPreview>(`/guests/${encodeURIComponent(id)}/preview`),
  card: (id: string) => getJson<GuestCard>(`/guests/${encodeURIComponent(id)}`),
  update: (id: string, body: unknown) =>
    sendJson<GuestCard>('PATCH', `/guests/${encodeURIComponent(id)}`, body),
  addDocument: (id: string, body: unknown) =>
    sendJson<GuestCard>('POST', `/guests/${encodeURIComponent(id)}/documents`, body),
  deleteDocument: (id: string, documentId: string) =>
    deleteJson<GuestCard>(
      `/guests/${encodeURIComponent(id)}/documents/${encodeURIComponent(documentId)}`,
    ),
};

// ── Счета (DATA_MODEL §6) ──
export interface FinanceCharge {
  id: string;
  kind: 'ACCOMMODATION' | 'SERVICE' | 'PENALTY' | 'ADJUSTMENT';
  serviceCode: string | null;
  description: string;
  quantity: number;
  unitPriceMinor: string;
  amountMinor: string;
  serviceDate: string | null;
  createdAt: string;
  voidedAt: string | null;
}
export interface FinancePaymentLine {
  paymentId: string;
  method: string;
  status: 'COMPLETED' | 'VOIDED';
  paidAt: string;
  note: string | null;
  externalReference: string | null;
  /** DATA_MODEL §25: чек по запросу гостя; старый API поля не отдаёт */
  receipt?: { number: string; issuedAt: string } | null;
  paymentAmountMinor: string;
  allocatedMinor: string;
  refundedMinor: string;
}
export interface FinanceRefund {
  id: string;
  paymentId: string;
  amountMinor: string;
  reason: string | null;
  createdAt: string;
}
export interface FinanceFolio {
  id: string;
  reservationItemId: string;
  status: 'OPEN' | 'CLOSED';
  currency: string;
  stay: {
    accommodationTypeName: string;
    arrivalDate: string;
    departureDate: string;
    status: string;
  };
  charges: FinanceCharge[];
  payments: FinancePaymentLine[];
  refunds: FinanceRefund[];
  chargedMinor: string;
  paidMinor: string;
  refundedMinor: string;
  balanceMinor: string;
}
/** Запрос оплаты (DATA_MODEL §23, ADR-141): счёт Kaspi по телефону, ссылка банка или перевод */
export interface PaymentRequest {
  id: string;
  folioId: string;
  amountMinor: string;
  currency: string;
  method: 'KASPI' | 'HALYK' | 'BANK_TRANSFER_PERSON' | 'CARD_TERMINAL';
  link: string | null;
  status: 'PENDING' | 'PAID' | 'CANCELLED';
  paymentId: string | null;
  note: string | null;
  createdAt: string;
  closedAt: string | null;
}
export interface PaymentRequests {
  confirmationNumber: string;
  propertyName: string;
  requests: PaymentRequest[];
}

export interface ReservationFinance {
  confirmationNumber: string;
  currency: string;
  folios: FinanceFolio[];
  chargedMinor: string;
  paidMinor: string;
  refundedMinor: string;
  balanceMinor: string;
}
export interface ServiceOption {
  code: string;
  nameRu: string;
  nameKz: string | null;
  priceMinor: string;
  group: string | null;
}
export interface PeriodReport {
  from: string;
  to: string;
  currency: string;
  chargesByKind: Array<{ kind: string; count: number; amountMinor: string }>;
  paymentsByMethod: Array<{ method: string; count: number; amountMinor: string }>;
  refunds: { count: number; amountMinor: string };
  accommodationByCategory: Array<{ category: string; count: number; amountMinor: string }>;
  chargedMinor: string;
  paidMinor: string;
  refundedMinor: string;
  balanceMinor: string;
}
/** Отчёт по услугам за период (REP2): свод начислений-услуг; `code: null` — начисления вручную */
export interface PeriodServices {
  from: string;
  to: string;
  currency: string;
  count: number;
  /** равен строке SERVICE в `chargesByKind` сводки — то же окно и те же правила */
  totalMinor: string;
  rows: Array<{
    code: string | null;
    name: string | null;
    group: string | null;
    charges: number;
    quantity: number;
    amountMinor: string;
  }>;
}
/** «Брони с остатком к сбору» за период (ADR-113): остаток — по всему счёту брони, как на карточке */
export interface PeriodDebts {
  from: string;
  to: string;
  currency: string;
  count: number;
  balanceMinor: string;
  /** Q-207: просроченный долг — время выезда по часам объекта прошло, остаток не оплачен */
  overdue: { count: number; balanceMinor: string };
  rows: Array<{
    confirmationNumber: string;
    status: string;
    arrivalDate: string;
    departureDate: string;
    guestLabel: string | null;
    chargedMinor: string;
    paidMinor: string;
    refundedMinor: string;
    balanceMinor: string;
    overdue: boolean;
  }>;
  truncated: boolean;
}
/** Оплаты и возвраты за период (ADR-113, F2) — раздел «Оплаты и возвраты» и выгрузка CSV */
export type OperationKind = 'PAYMENT' | 'REFUND' | 'INCOME' | 'EXPENSE' | 'TRANSFER';
export interface PeriodOperations {
  from: string;
  to: string;
  currency: string;
  total: number;
  paidMinor: string;
  refundedMinor: string;
  /** касса (DATA_MODEL §21): проведённые поступления и расходы по отбору; комиссии — в расходах */
  incomeMinor: string;
  expenseMinor: string;
  methods: Array<{ method: string; count: number }>;
  rows: Array<{
    kind: OperationKind;
    id: string;
    at: string;
    localAt: string;
    method: string;
    methodTo: string | null;
    amountMinor: string;
    status: 'COMPLETED' | 'VOIDED';
    confirmationNumber: string | null;
    reservations: number;
    guestLabel: string | null;
    category: string | null;
    note: string | null;
  }>;
  truncated: boolean;
}
/** Остатки кассы по способам (DATA_MODEL §21) — за всё время; статьи и сверки — тем же ответом */
export interface CashBalances {
  currency: string;
  totalMinor: string;
  balances: Array<{ method: string; balanceMinor: string }>;
  categories: CashCategory[];
  /** последняя сверка по каждому способу (§21.4) */
  reconciliations: Array<{
    method: string;
    at: string;
    localAt: string;
    expectedMinor: string;
    countedMinor: string;
    note: string | null;
  }>;
}
export interface CashCategory {
  id: string;
  kind: 'INCOME' | 'EXPENSE';
  name: string;
  active: boolean;
}
export const financeApi = {
  // запросы оплаты (DATA_MODEL §23, ADR-141)
  paymentRequests: (number: string) =>
    getJson<PaymentRequests>(
      `/finance/reservations/${encodeURIComponent(number)}/payment-requests`,
    ),
  createPaymentRequest: (number: string, body: unknown) =>
    sendJson<PaymentRequests>(
      'POST',
      `/finance/reservations/${encodeURIComponent(number)}/payment-requests`,
      body,
    ),
  markPaymentRequestPaid: (id: string) =>
    sendJson<PaymentRequests>(
      'POST',
      `/finance/payment-requests/${encodeURIComponent(id)}/paid`,
      {},
    ),
  cancelPaymentRequest: (id: string) =>
    sendJson<PaymentRequests>(
      'POST',
      `/finance/payment-requests/${encodeURIComponent(id)}/cancel`,
      {},
    ),
  operations: (
    from: string,
    to: string,
    filter: {
      type?: string | undefined;
      method?: string | undefined;
      source?: string | undefined;
      limit?: number;
    } = {},
  ) => {
    const qs = new URLSearchParams({ from, to });
    if (filter.type) qs.set('type', filter.type);
    if (filter.method) qs.set('method', filter.method);
    if (filter.source) qs.set('source', filter.source);
    if (filter.limit) qs.set('limit', String(filter.limit));
    return getJson<PeriodOperations>(`/finance/operations?${qs}`);
  },
  // касса (DATA_MODEL §21)
  cash: () => getJson<CashBalances>('/finance/cash'),
  createCashCategory: (body: unknown) =>
    sendJson<CashCategory[]>('POST', '/finance/cash/categories', body),
  updateCashCategory: (id: string, body: unknown) =>
    sendJson<CashCategory[]>('PATCH', `/finance/cash/categories/${encodeURIComponent(id)}`, body),
  createCashOperation: (body: unknown) =>
    sendJson<CashBalances>('POST', '/finance/cash/operations', body),
  createCashTransfer: (body: unknown) =>
    sendJson<CashBalances>('POST', '/finance/cash/transfers', body),
  createCashReconciliation: (body: unknown) =>
    sendJson<CashBalances>('POST', '/finance/cash/reconciliations', body),
  voidCashOperation: (id: string) =>
    sendJson<CashBalances>('POST', `/finance/cash/operations/${encodeURIComponent(id)}/void`, {}),
  report: (from: string, to: string) =>
    getJson<PeriodReport>(
      `/finance/report?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    ),
  servicesReport: (from: string, to: string) =>
    getJson<PeriodServices>(
      `/finance/services-report?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    ),
  debts: (from: string, to: string) =>
    getJson<PeriodDebts>(
      `/finance/debts?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    ),
  reservation: (number: string) =>
    getJson<ReservationFinance>(`/finance/reservations/${encodeURIComponent(number)}`),
  services: () => getJson<ServiceOption[]>('/finance/services'),
  addCharge: (folioId: string, body: unknown) =>
    sendJson<ReservationFinance>(
      'POST',
      `/finance/folios/${encodeURIComponent(folioId)}/charges`,
      body,
    ),
  voidCharge: (chargeId: string) =>
    sendJson<ReservationFinance>(
      'POST',
      `/finance/charges/${encodeURIComponent(chargeId)}/void`,
      {},
    ),
  pay: (body: unknown) => sendJson<ReservationFinance>('POST', '/finance/payments', body),
  /** Ручное закрытие счёта — только при нулевом балансе */
  addStayExtra: (folioId: string, extra: 'EARLY_CHECK_IN' | 'LATE_CHECK_OUT', time?: string) =>
    sendJson<ReservationFinance>(
      'POST',
      `/finance/folios/${encodeURIComponent(folioId)}/stay-extras`,
      time ? { extra, time } : { extra },
    ),
  closeFolio: (folioId: string) =>
    sendJson<ReservationFinance>(
      'POST',
      `/finance/folios/${encodeURIComponent(folioId)}/close`,
      {},
    ),
  issueReceipt: (paymentId: string, number: string) =>
    sendJson<{ paymentId: string; number: string }>(
      'POST',
      `/finance/payments/${encodeURIComponent(paymentId)}/receipt`,
      { number },
    ),
  refund: (paymentId: string, body: unknown) =>
    sendJson<ReservationFinance>(
      'POST',
      `/finance/payments/${encodeURIComponent(paymentId)}/refunds`,
      body,
    ),
};

// ── Рабочий день стойки ──
export interface DeskRow {
  itemId: string;
  confirmationNumber: string;
  guestLabel: string;
  guestPhone: string | null;
  unitCode: string | null;
  accommodationTypeName: string;
  arrivalDate: string;
  departureDate: string;
  status: string;
  balanceMinor: string;
  citizenship: string | null;
  adults: number;
  guestsRecorded: number;
  blockedReason: string | null;
}
export interface DeskDay {
  date: string;
  arrivals: DeskRow[];
  departures: DeskRow[];
  inHouse: DeskRow[];
  /** Не заехали вовремя: дата заезда прошла, заселения и незаезда нет */
  overdueArrivals: DeskRow[];
  counts: {
    overdueArrivals: number;
    arrivals: number;
    departures: number;
    inHouse: number;
    toCheckIn: number;
    toCheckOut: number;
  };
  debtMinor: string;
}
export const deskApi = {
  today: (date?: string) =>
    getJson<DeskDay>(`/desk/today${date ? `?date=${encodeURIComponent(date)}` : ''}`),
};

// ── Главная собственника: показатели за период (срез 14) ──
export interface DashboardView {
  current: DashboardPeriod;
  /** Тот же расчёт за предыдущий отрезок той же длины */
  previous: DashboardPeriod;
}
export const dashboardApi = {
  /** `fund` — тип фонда «Аналитики»: номера и койки считаются раздельно (ADR-114); по умолчанию весь фонд */
  period: (from: string, to: string, fund: DashboardFund = 'all') =>
    getJson<DashboardView>(
      `/desk/dashboard?${new URLSearchParams(fund === 'all' ? { from, to } : { from, to, fund })}`,
    ),
  /** «По номерам» (REP3): те же клетки шахматки до единицы, под правом отчётов */
  units: (from: string, to: string, fund: DashboardFund = 'all') =>
    getJson<UnitStats>(
      `/desk/dashboard/units?${new URLSearchParams(fund === 'all' ? { from, to } : { from, to, fund })}`,
    ),
};

// ───────────── Аналитика сайта (срез 8) ─────────────
export interface TrackedSite {
  id: string;
  name: string;
  hosts: string[];
  publicKey: string;
  status: 'ACTIVE' | 'PAUSED';
  createdAt: string;
  timezone: string;
  checkInTime: string;
  checkOutTime: string;
  /** Виджет бронирования (срез 9) */
  bookingEnabled: boolean;
  bookingRatePlan: { id: string; code: string; name: string } | null;
}
export interface TrackedSiteCard {
  site: TrackedSite;
  status: { lastEventAt: string | null; sessionsToday: number; pageviewsToday: number };
  snippet: {
    key: string;
    scriptUrl: string;
    code: string;
    demoUrl: string;
    bookingCode: string;
    bookingDemoUrl: string;
  };
}
export interface SiteReport {
  site: { id: string; name: string };
  period: { from: string; to: string; timezone: string };
  summary: {
    sessions: number;
    visitors: number;
    pageviews: number;
    pagesPerSession: number;
    avgDurationSeconds: number;
    mobileSessions: number;
    mobileShare: number;
    bounces: number;
    bounceRate: number;
    bookings: number;
  };
  daily: Array<{
    date: string;
    sessions: number;
    visitors: number;
    pageviews: number;
    mobile: number;
  }>;
  sources: Array<{
    kind: 'DIRECT' | 'SEARCH' | 'SOCIAL' | 'PAID' | 'EMAIL' | 'REFERRAL';
    source: string | null;
    sessions: number;
    visitors: number;
    pageviews: number;
    avgDurationSeconds: number;
    share: number;
    bookings: number;
  }>;
  pages: Array<{ path: string; views: number; share: number }>;
  demand: Array<{ arrival: string; searches: number }>;
  events: Array<{ name: string; count: number; sessions: number }>;
  devices: {
    devices: Array<{ key: string | null; sessions: number; share: number }>;
    browsers: Array<{ key: string | null; sessions: number; share: number }>;
    os: Array<{ key: string | null; sessions: number; share: number }>;
  };
  /** Воронка по сессиям периода (WEB4): сессия, дошедшая дальше, засчитана и на шагах до этого */
  funnel: { visits: number; searches: number; started: number; booked: number; conversion: number };
  /** Брони с источником «Сайт», созданные за период, — по объекту; начислено по их счетам (WEB4, Q-212) */
  siteReservations: {
    count: number;
    cancelled: number;
    noShow: number;
    charged: Array<{ currency: string; chargedMinor: string }>;
  };
}
export const analyticsApi = {
  sites: () => getJson<TrackedSite[]>('/analytics/sites'),
  card: (id: string) => getJson<TrackedSiteCard>(`/analytics/sites/${encodeURIComponent(id)}`),
  create: (body: { name: string; hosts: string[] }) =>
    sendJson<TrackedSiteCard>('POST', '/analytics/sites', body),
  update: (
    id: string,
    body: {
      name?: string;
      hosts?: string[];
      status?: 'ACTIVE' | 'PAUSED';
      bookingEnabled?: boolean;
      bookingRatePlanCode?: string | null;
    },
  ) => sendJson<TrackedSiteCard>('PATCH', `/analytics/sites/${encodeURIComponent(id)}`, body),
  remove: (id: string) =>
    sendJson<{ deleted: true }>('DELETE', `/analytics/sites/${encodeURIComponent(id)}`, {}),
  report: (id: string, from?: string, to?: string) => {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    const qs = q.toString();
    return getJson<SiteReport>(
      `/analytics/sites/${encodeURIComponent(id)}/report${qs ? `?${qs}` : ''}`,
    );
  },
};

// ───────────────────────── Сторож системы (срез 11, ADR-028) ─────────────────────────

export type IncidentClass = 'A' | 'B' | 'C';
export type IncidentStatus = 'OPEN' | 'FIXING' | 'ESCALATED' | 'ACKNOWLEDGED' | 'RESOLVED';
/** Неисправность из одного места (DATA_MODEL §12). Без ФИО и телефонов — только номера и коды. */
export interface Incident {
  id: string;
  kind: string;
  class: IncidentClass;
  severity: 'CRITICAL' | 'WARNING';
  status: IncidentStatus;
  title: string;
  subjectType: string | null;
  subjectId: string | null;
  occurrences: number;
  firstSeenAt: string;
  lastSeenAt: string;
  fixAttempts: number;
  lastFixAt: string | null;
  lastFixResult: string | null;
  alertedAt: string | null;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  resolvedBy: 'GUARD' | 'AGENT' | 'STAFF' | null;
}
export interface GuardStatus {
  running: boolean;
  autofix: boolean;
  propertyLive: boolean;
  notifier: { configured: boolean; recipients: number };
  dbDownSince: string | null;
  lastTick: {
    at: string;
    durationMs: number;
    dbOk: boolean;
    checked: string[];
    checkErrors: Array<{ check: string; error: string }>;
    alertError: string | null;
  } | null;
  open: { total: number; critical: number; escalated: number };
}
/** Подпись вошедшего для виджета ИИ-помощника (ТЗ П1, П2): кладётся в `data-identity` тега */
export interface AssistantIdentity {
  token: string;
  expiresAt: string;
}

export const assistantApi = {
  /**
   * `null` — чат анонимный: не вошёл (401), подпись не настроена (503), API не ответил. Страница из-за чата
   * не падает и на вход не уводит — макет рисуется и на экране входа.
   */
  identity: async (): Promise<AssistantIdentity | null> => {
    try {
      const res = await backendFetch('/assistant/identity');
      if (!res.ok) return null;
      const body = (await res.json()) as Partial<AssistantIdentity>;
      return typeof body.token === 'string' && typeof body.expiresAt === 'string'
        ? { token: body.token, expiresAt: body.expiresAt }
        : null;
    } catch (error) {
      if (error instanceof ApiError) return null;
      throw error;
    }
  },
};

// ── Раздел «ИИ-продавец» (ТЗ ред. 1 П5–П8, ADR-079; контракт — docs/assistant/README.md) ──────────────

export type SellerAddressForm = 'FORMAL' | 'INFORMAL';
export type SellerEmoji = 'NEVER' | 'MODERATE' | 'GREETING_ONLY';
export type SellerReplyLength = 'SHORT' | 'DETAILED';

/** Поля экрана «Настройки» — профиль продавца полями, не текстом промпта (DATA_MODEL §15, ADR-081) */
export interface SellerProfileBody {
  botName: string | null;
  addressForm: SellerAddressForm;
  emoji: SellerEmoji;
  replyLength: SellerReplyLength;
  languages: string[];
  greeting: string;
  includedInPrice: string;
  extraCharges: string;
  houseRules: string;
  /** По одному в строке */
  prohibitions: string[];
  callHumanWhen: string[];
  faq: Array<{ question: string; answer: string }>;
}

export interface SellerProfileView {
  saved: boolean;
  profile: SellerProfileBody;
  updatedAt: string | null;
  applied: boolean;
}

export interface SellerStatus {
  /**
   * `extension-off` — расширение не подключено; `extension-expired` — срок вышел, раздел только для чтения (ADR-083);
   * `not-configured` — у платформы нет адреса и ключа продавца. Состояния `other-organization` больше нет (Э4):
   * продавец общий, вызовы идут с организацией вошедшего.
   */
  state: 'extension-off' | 'extension-expired' | 'not-configured' | 'ready';
  profile: { saved: boolean; updatedAt: string | null; applied: boolean };
  facts: { applied: boolean; appliedAt: string | null };
  lastError: string | null;
  lastErrorAt: string | null;
  /** Отказ временный — платформа повторит сама; `false` — продавец отклонил версию, ждём правки или «Применить» */
  retrying: boolean;
  embedAvailable: boolean;
  /** Расширение организации; старый API его не присылает */
  extension?: ExtensionAccessView | null;
  /** Подключён ли продавец, какое бы ни было расширение: читать диалоги после срока можно, только если он есть */
  connection?: 'not-configured' | 'ready';
  /** Может ли вошедший менять настройки: владелец или управляющий (ADR-107) при действующем расширении */
  canConfigure?: boolean;
}

/** Факты объекта ровно в том виде, в каком их получает продавец (`PUT /seller/facts`, snake_case) */
export interface SellerFactsPayload {
  object_name: string;
  address: string;
  timezone: string;
  check_in: string;
  check_out: string;
  currency: string;
  categories: Array<{
    name: string;
    kind: 'room' | 'bed';
    capacity: number;
    price_minor: number | null;
  }>;
}

/** Цена категории глазами стойки: что ушло продавцу и почему (ADR-081, Q-179) */
export interface SellerCategoryPrice {
  code: string;
  name: string;
  kind: string;
  capacity: number;
  units: number;
  occupancy: number | null;
  /** Тиыны строкой — то, что уходит продавцу; `null` — цена не уходит */
  priceMinor: string | null;
  reason: 'same' | 'varies' | 'none';
  min: string | null;
  max: string | null;
  days: number;
}

/** «Данные объекта»: ровно факты, что уходят продавцу, и для экрана — тариф сайта, окно и разбор цен */
export interface SellerFactsView {
  facts: SellerFactsPayload;
  hash: string;
  applied: boolean;
  ratePlan: { code: string; name: string; currency: string } | null;
  window: { from: string; to: string };
  prices: SellerCategoryPrice[];
}

export interface SellerConversationRow {
  id: string;
  channel: string;
  /** Имя маскирует продавец: в списке контакта нет, он — в карточке */
  clientName: string | null;
  mode: string;
  stage: string;
  lastActivityAt: string | null;
  messages: number;
  hasContact: boolean;
}

export interface SellerConversationCard {
  id: string;
  mode: string;
  stage: string;
  leadData: Record<string, unknown>;
  contact: {
    name: string | null;
    phone: string | null;
    email: string | null;
    channel: string | null;
    externalId: string | null;
  };
  messages: Array<{ role: string; text: string; at: string | null; sentByUs: boolean }>;
}

export interface SellerSummary {
  hours: number;
  dialogs: number;
  replies: number;
  leads: number;
  slaBreaches: number;
}

export interface SellerExtractResult {
  filled: string[];
  skipped: string[];
  rejected: string[];
  unparsed: string[];
  /** Не записывается никуда: адрес, заезд и цены из рассказа — сверить с данными платформы */
  aside: {
    objectName: string | null;
    address: string | null;
    checkIn: string | null;
    checkOut: string | null;
    categories: Array<{ name: string; kind: string; capacity: number; priceMinor: number | null }>;
  };
  profile: SellerProfileView;
}

export interface SellerWhatsAppView {
  set: boolean;
  phoneNumberId: string | null;
  verifyToken: string | null;
  webhookUrl: string | null;
}

/** Инструкция продавцу одним текстом (ADR-097) */
export interface SellerPromptView {
  saved: boolean;
  text: string;
  updatedAt: string | null;
  applied: boolean;
}

/**
 * Карточка каталога «ИИ-агентов» (SA1): рабочий продавец организации или черновик гостевого мастера. Статус и канал —
 * ключи домена (`AgentStatus`, `ChannelState`); слова к ним даёт `lib/ai-agents.ts`.
 */
export interface AgentCardView {
  id: string;
  /** `seller` — рабочий продавец; `agent` — агент с филиалом (SA2); `draft` — черновик гостевого мастера без филиала */
  kind: 'seller' | 'agent' | 'draft';
  name: string;
  status: AgentStatus;
  business: { id: string; name: string } | null;
  location: { id: string; name: string } | null;
  channels: { site: ChannelState; whatsapp: ChannelState } | null;
}

export interface AgentCatalogView {
  extension: ExtensionAccessView | null;
  /** Владелец и управляющий: им доступны кнопки */
  canManage: boolean;
  canConfigure: boolean;
  /** Состояние кнопки «+ Подключить AI-продавца» (SA2): причину словами и доступность считает сервер */
  create: { enabled: boolean; reason: string | null };
  agents: AgentCardView[];
}

/** Куда можно создать AI-продавца: Business → филиалы со словом «занят» (SA2) */
export interface AgentOptionsView {
  extension: ExtensionAccessView | null;
  canCreate: boolean;
  reason: string | null;
  businesses: Array<{
    id: string;
    name: string;
    locations: Array<{ id: string; name: string; free: boolean; reason: string | null }>;
  }>;
}

export interface BusinessAgentView {
  id: string;
  name: string;
  lifecycle: string;
  business: { id: string; name: string };
  location: { id: string; name: string };
  /** Список настройки: готово только «Основное», остальное — статусы, а не шаги мастера */
  setup: Array<{ code: string; label: string; done: boolean }>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentInstructionView {
  text: string;
  saved: boolean;
  updatedAt: string | null;
}
export interface AgentInstructionPreview {
  text: string;
  warnings: string[];
}

export interface TelegramStatusView {
  set: boolean;
  state: 'NOT_CONNECTED' | 'CONFIGURED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';
  username: string | null;
  allowedUserIds: string[];
  lastReceivedAt: string | null;
  lastSentAt: string | null;
  error: string | null;
}
export const businessAgentsApi = {
  telegram: (id: string) =>
    getJson<TelegramStatusView>(`/ai-seller/agents/${encodeURIComponent(id)}/telegram`),
  checkTelegram: (id: string, token: string) =>
    sendJson<{ valid: boolean; username: string | null; conflict: boolean }>(
      'POST',
      `/ai-seller/agents/${encodeURIComponent(id)}/telegram/check`,
      { token },
    ),
  connectTelegram: (id: string, token: string, allowedUserIds: string[]) =>
    sendJson<TelegramStatusView>('PUT', `/ai-seller/agents/${encodeURIComponent(id)}/telegram`, {
      token,
      allowedUserIds,
    }),
  disconnectTelegram: (id: string) =>
    sendJson<TelegramStatusView>(
      'POST',
      `/ai-seller/agents/${encodeURIComponent(id)}/telegram/disconnect`,
      {},
    ),
  instruction: (id: string) =>
    getJson<AgentInstructionView>(`/ai-seller/agents/${encodeURIComponent(id)}/instruction`),
  saveInstruction: (id: string, text: string) =>
    sendJson<AgentInstructionView>(
      'PUT',
      `/ai-seller/agents/${encodeURIComponent(id)}/instruction`,
      { text },
    ),
  generateInstruction: (id: string, story: string) =>
    sendJson<AgentInstructionPreview>(
      'POST',
      `/ai-seller/agents/${encodeURIComponent(id)}/instruction/generate`,
      { story },
    ),
  options: () => getJson<AgentOptionsView>('/ai-seller/agents/options'),
  get: (id: string) => getJson<BusinessAgentView>(`/ai-seller/agents/${encodeURIComponent(id)}`),
  /** `Idempotency-Key` — повтор той же отправки возвращает того же агента; организацию и автора называет сервер */
  create: (key: string, input: { name: string; businessId: string; locationId: string }) =>
    sendJson<BusinessAgentView>('POST', '/ai-seller/agents', input, { 'idempotency-key': key }),
};

export const sellerApi = {
  status: () => getJson<SellerStatus>('/ai-seller/status'),
  /** Каталог AI-агентов организации (SA1): только чтение, права `dialogs` */
  catalog: () => getJson<AgentCatalogView>('/ai-seller/catalog'),
  prompt: () => getJson<SellerPromptView>('/ai-seller/prompt'),
  savePrompt: (text: string) => sendJson<SellerPromptView>('PUT', '/ai-seller/prompt', { text }),
  /** Рассказ своими словами → черновик профиля мастера (С1); занятые поля не затираются */
  extract: (story: string) =>
    sendJson<SellerExtractResult>('POST', '/ai-seller/extract', { story }),
  /** Ключ модели партнёра (С2): хранит бот, наружу — «установлен + последние 4 знака» */
  llmKey: () => getJson<{ set: boolean; last4: string | null }>('/ai-seller/llm-key'),
  saveLlmKey: (key: string) =>
    sendJson<{ set: boolean; last4: string | null }>('PUT', '/ai-seller/llm-key', { key }),
  checkLlmKey: (key: string) =>
    sendJson<{ valid: boolean; reason: string | null }>('POST', '/ai-seller/llm-key/check', {
      key,
    }),
  /** Подключение WhatsApp (С3): токен и секрет Meta живут только у бота */
  whatsapp: () => getJson<SellerWhatsAppView>('/ai-seller/whatsapp'),
  saveWhatsApp: (input: { phoneNumberId: string; token?: string; appSecret?: string }) =>
    sendJson<SellerWhatsAppView>('PUT', '/ai-seller/whatsapp', input),
  checkWhatsApp: (input: { phoneNumberId: string; token: string }) =>
    sendJson<{ valid: boolean; phone: string | null; reason: string | null }>(
      'POST',
      '/ai-seller/whatsapp/check',
      input,
    ),
  profile: () => getJson<SellerProfileView>('/ai-seller/profile'),
  saveProfile: (body: SellerProfileBody) =>
    sendJson<SellerProfileView>('PUT', '/ai-seller/profile', body),
  apply: () =>
    sendJson<{ profileApplied: boolean; factsApplied: boolean }>('POST', '/ai-seller/apply', {}),
  facts: () => getJson<SellerFactsView>('/ai-seller/facts'),
  conversations: (mode?: string) =>
    getJson<{ items: SellerConversationRow[] }>(
      `/ai-seller/conversations${mode ? `?mode=${encodeURIComponent(mode)}` : ''}`,
    ),
  conversation: (id: string) =>
    getJson<SellerConversationCard>(`/ai-seller/conversations/${encodeURIComponent(id)}`),
  switchMode: (id: string, action: 'takeover' | 'release') =>
    sendJson<{ mode: string | null; previousMode: string | null }>(
      'POST',
      `/ai-seller/conversations/${encodeURIComponent(id)}/${action}`,
      {},
    ),
  reply: (id: string, text: string) =>
    sendJson<{ ok: true }>('POST', `/ai-seller/conversations/${encodeURIComponent(id)}/reply`, {
      text,
    }),
  knowledge: () =>
    getJson<{ items: Array<{ source: string; chunks: number; createdAt: string | null }> }>(
      '/ai-seller/knowledge',
    ),
  /** Документ базы знаний: multipart, поле `file`; заголовок с границей ставит сам fetch */
  uploadKnowledge: async (
    file: File,
  ): Promise<{ source: string; created: boolean; chunks: number }> => {
    const form = new FormData();
    form.append('file', file, file.name);
    const res = await backendFetch('/ai-seller/knowledge', { method: 'POST', body: form });
    if (!res.ok) throw new ApiError(res.status, await messageOf(res));
    return (await res.json()) as { source: string; created: boolean; chunks: number };
  },
  summary: () => getJson<SellerSummary>('/ai-seller/summary'),
  sandbox: (text: string) =>
    sendJson<{ reply: string | null; needsHuman: boolean; reasons: string[] }>(
      'POST',
      '/ai-seller/sandbox',
      { text },
    ),
  embed: () => getJson<{ snippet: string | null; hosts?: string[] }>('/ai-seller/embed'),
};

/** Организация глазами главного администратора платформы (ADR-083): без броней, гостей и переписки */
export interface PlatformOrganization {
  id: string;
  name: string;
  status: SignedInOrganization['status'];
  trialEndsAt: string | null;
  createdAt: string;
  members: number;
  owners: string[];
  aiSeller: ExtensionAccessView & { note: string | null; updatedAt: string | null };
}

/** Изменение расширения: статус, дата «до» (`ГГГГ-ММ-ДД`, включительно; пусто — бессрочно) и заметка */
export interface ExtensionChangeBody {
  status: 'TRIAL' | 'ACTIVE' | 'OFF';
  activeUntil: string;
  note: string;
}

/** Раздел «Платформа» (DATA_MODEL §16, ADR-083): только главному администратору, остальным API отвечает 403 */
export const platformApi = {
  organizations: () => getJson<{ items: PlatformOrganization[] }>('/platform/organizations'),
  changeAiSeller: (organizationId: string, body: ExtensionChangeBody) =>
    sendJson<PlatformOrganization>(
      'PUT',
      `/platform/organizations/${encodeURIComponent(organizationId)}/extensions/ai-seller`,
      body,
    ),
  /** Оплата счётом (Q-141 — А, ADR-102): «оплата получена» — ACTIVE, обратно — READ_ONLY */
  changeStatus: (organizationId: string, body: { status: 'ACTIVE' | 'READ_ONLY'; note: string }) =>
    sendJson<PlatformOrganization>(
      'PUT',
      `/platform/organizations/${encodeURIComponent(organizationId)}/status`,
      body,
    ),
};

/** Кто пишет в техподдержку — из подписи стойки; анонимный посетитель wetop.ai — `null` в карточке */
export interface SupportPlatformUser {
  userId: string | null;
  email: string | null;
  organizationId: string | null;
  organizationName: string | null;
  role: 'owner' | 'manager' | 'staff' | null;
}

export type SupportConversationCard = SellerConversationCard & {
  platformUser: SupportPlatformUser | null;
  /** Обращение закрыто: переписка только для чтения */
  closed?: boolean;
};

/** Строка очереди техподдержки (S1): отбор, приоритет и порядок считает API */
export interface SupportQueueItem {
  id: string;
  channel: string;
  clientName: string | null;
  mode: string;
  stage: string;
  startedAt: string | null;
  lastActivityAt: string | null;
  messages: number;
  lastMessage: SupportLastMessage | null;
  /** Первое сообщение пользователя: по нему API считает категорию */
  firstMessage: SupportLastMessage | null;
  category: SupportCategory;
  waitingSince: string | null;
  closed: boolean;
  priority: SupportPriority;
}

/**
 * «Платформа → Техподдержка» (ADR-083, план Э3): панель ИИ-помощника через API платформы — адреса и ключа помощника
 * стойка не знает. Только главному администратору; остальным API отвечает 403.
 */
/** Запись управляемой базы знаний WETOP Support (S3); список отдаёт `excerpt`, запись — `content` и `versions` */
export interface SupportKbEntry {
  id: string | null;
  title: string | null;
  category: string | null;
  visibility: string | null;
  status: string | null;
  version: number;
  source: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  excerpt?: string;
  content?: string;
  versions?: Array<{
    version: number;
    title: string | null;
    category: string | null;
    visibility: string | null;
    content: string | null;
    savedBy: string | null;
    savedAt: string | null;
  }>;
}
export interface SupportKbSource {
  knowledgeId: string | null;
  title: string | null;
  version: number;
  visibility: string | null;
  score: number;
  usedAt: string | null;
}

/** Строка журнала действий бота в диалоге (S6) */
export interface SupportAgentAction {
  id: string | null;
  action: string | null;
  actionClass: string | null;
  status: string | null;
  result: string | null;
  createdAt: string | null;
  executedAt: string | null;
}

export const supportApi = {
  status: () => getJson<{ state: 'not-configured' | 'ready' }>('/platform/support/status'),
  conversations: (mode?: string) =>
    getJson<{ items: SellerConversationRow[] }>(
      `/platform/support/conversations${mode ? `?mode=${encodeURIComponent(mode)}` : ''}`,
    ),
  queue: (queue: SupportQueue, category: SupportCategoryFilter = 'all') =>
    getJson<{
      queue: SupportQueue;
      category: SupportCategoryFilter;
      items: SupportQueueItem[];
      counts: SupportQueueCounts;
      categoryCounts: SupportCategoryCounts;
    }>(
      `/platform/support/queue?queue=${encodeURIComponent(queue)}&category=${encodeURIComponent(category)}`,
    ),
  conversation: (id: string) =>
    getJson<SupportConversationCard>(`/platform/support/conversations/${encodeURIComponent(id)}`),
  close: (id: string) =>
    sendJson<{ closed: true }>(
      'POST',
      `/platform/support/conversations/${encodeURIComponent(id)}/close`,
      {},
    ),
  switchMode: (id: string, action: 'takeover' | 'release') =>
    sendJson<{ mode: string | null; previousMode: string | null }>(
      'POST',
      `/platform/support/conversations/${encodeURIComponent(id)}/${action}`,
      {},
    ),
  reply: (id: string, text: string) =>
    sendJson<{ ok: true }>(
      'POST',
      `/platform/support/conversations/${encodeURIComponent(id)}/reply`,
      { text },
    ),
  knowledge: () =>
    getJson<{ items: Array<{ source: string; chunks: number; createdAt: string | null }> }>(
      '/platform/support/knowledge',
    ),
  /** Документ базы знаний помощника: multipart, поле `file`; заголовок с границей ставит сам fetch */
  uploadKnowledge: async (
    file: File,
  ): Promise<{ source: string; created: boolean; chunks: number }> => {
    const form = new FormData();
    form.append('file', file, file.name);
    const res = await backendFetch('/platform/support/knowledge', { method: 'POST', body: form });
    if (!res.ok) throw new ApiError(res.status, await messageOf(res));
    return (await res.json()) as { source: string; created: boolean; chunks: number };
  },
  summary: () => getJson<SellerSummary>('/platform/support/summary'),
  // ── управляемая база знаний (S3) ──
  kbList: (query: { status?: string; category?: string; visibility?: string; q?: string }) => {
    const params = new URLSearchParams();
    for (const [name, value] of Object.entries(query)) if (value) params.set(name, value);
    const qs = params.toString();
    return getJson<{ items: SupportKbEntry[]; counts: Record<string, number> }>(
      `/platform/support/kb${qs ? `?${qs}` : ''}`,
    );
  },
  kbRead: (id: string) => getJson<SupportKbEntry>(`/platform/support/kb/${encodeURIComponent(id)}`),
  kbCreate: (body: Record<string, unknown>) =>
    sendJson<SupportKbEntry>('POST', '/platform/support/kb', body),
  kbUpdate: (id: string, body: Record<string, unknown>) =>
    sendJson<SupportKbEntry>('PUT', `/platform/support/kb/${encodeURIComponent(id)}`, body),
  kbPublish: (id: string) =>
    sendJson<SupportKbEntry>('POST', `/platform/support/kb/${encodeURIComponent(id)}/publish`, {}),
  kbStatus: (id: string, status: string) =>
    sendJson<SupportKbEntry>('POST', `/platform/support/kb/${encodeURIComponent(id)}/status`, {
      status,
    }),
  conversationSources: (id: string) =>
    getJson<{ items: SupportKbSource[] }>(
      `/platform/support/conversations/${encodeURIComponent(id)}/knowledge`,
    ),
  conversationActions: (id: string) =>
    getJson<{ items: SupportAgentAction[] }>(
      `/platform/support/conversations/${encodeURIComponent(id)}/actions`,
    ),
  knowledgeDraft: (id: string) =>
    sendJson<SupportKbEntry>(
      'POST',
      `/platform/support/conversations/${encodeURIComponent(id)}/knowledge-draft`,
      {},
    ),
  // ── настройка помощника (ADR-084): правила, модель, песочница ──
  prompt: () => getJson<{ text: string }>('/platform/support/prompt'),
  savePrompt: (text: string) =>
    sendJson<{ length: number }>('PUT', '/platform/support/prompt', { text }),
  settings: () => getJson<{ models: string[]; model: string | null }>('/platform/support/settings'),
  saveModel: (model: string) =>
    sendJson<{ model: string | null; previous: string | null }>(
      'PUT',
      '/platform/support/settings/model',
      { model },
    ),
  sandbox: (text: string) =>
    sendJson<{ reply: string | null; needsHuman: boolean; reasons: string[] }>(
      'POST',
      '/platform/support/sandbox',
      { text },
    ),
};

/** X3 (ADR-141): сверка остатков с каналом от сторожа; только организации подключённого объекта */
export interface ChannelReconciliation {
  lastCheckedAt: string | null;
  mismatch: { title: string; since: string; nights: number | null } | null;
}
export const guardApi = {
  status: () => getJson<GuardStatus>('/guard/status'),
  reconciliation: () => getJson<ChannelReconciliation>('/guard/reconciliation'),
  incidents: (status: 'open' | 'all', limit = 100) =>
    getJson<Incident[]>(`/guard/incidents?status=${status}&limit=${limit}`),
  acknowledge: (id: string) =>
    sendJson<Incident>('POST', `/guard/incidents/${encodeURIComponent(id)}/acknowledge`, {}),
  resolve: (id: string) =>
    sendJson<Incident>('POST', `/guard/incidents/${encodeURIComponent(id)}/resolve`, {}),
  tick: () => sendJson<{ observed: unknown[]; resolved: number }>('POST', '/guard/tick', {}),
};

/** Строка «Где вы вошли» (`GET /auth/sessions`): ни ключа, ни отпечатка, ни сырой строки агента. */
export interface AuthSessionRow {
  id: string;
  issuedAt: string;
  expiresAt: string;
  device: string;
  current: boolean;
}

export interface AuthInvite {
  id: string;
  email: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
  /** С какой ролью войдёт (ADR-107); старый API роли не присылает — администратор */
  role?: InviteRole;
  /** Может ли вошедший его отозвать: тот, кто вправе позвать с этой ролью */
  revocable?: boolean;
}

/** Человек своей организации в блоке «Сотрудники» (ADR-107) */
export interface AuthMember {
  userId: string;
  email: string;
  name: string | null;
  role: MembershipRole;
  joinedAt: string;
  /** Последний вход в систему: не входил — null (TEAM1, «Был в системе») */
  lastLoginAt: string | null;
  you: boolean;
  removable: boolean;
  roleEditable: boolean;
}

export interface AuthInvitePreview {
  organizationName: string;
  email: string;
  expiresAt: string;
  /** Только у принятия: ключ, по которому человек задаёт себе пароль. null — пароль у него уже есть. */
  setPasswordToken?: string | null;
}

export interface InventoryCategory {
  code: string;
  name: string;
  kind: 'PRIVATE_ROOM' | 'DORM_BED' | 'APARTMENT';
  capacityAdults: number;
  active: boolean;
  /** Число действующих тарифов категории — сигнал «настроено ли для продаж» (ADR-109) */
  ratePlans: number;
  /** Имена тех же тарифов — для панели категории (C2), цены здесь нет: она своя на каждую дату */
  ratePlanNames: string[];
  /** Что использует категорию (C4, ТЗ §17): брони в истории — разные брони, не проживания */
  reservations: number;
  /** Из них впереди: не отменены и не закрыты, выезд сегодня или позже */
  upcomingReservations: number;
  /** Категория сопоставлена с типом номера в Channex */
  channexMapped: boolean;
}
export const inventoryEditorApi = {
  categories: () => getJson<InventoryCategory[]>('/inventory/categories'),
  save: (resource: 'categories' | 'rooms', body: Record<string, unknown>, code?: string) =>
    sendJson<{ code?: string }>(
      code ? 'PATCH' : 'POST',
      `/inventory/${resource}${code ? `/${encodeURIComponent(code)}` : ''}`,
      body,
    ),
  /** «Настроить тариф» (ADR-119): существующий `ratePlanCode` или новый `newRatePlanName` */
  linkRatePlan: (code: string, body: Record<string, unknown>) =>
    sendJson<{ linked: boolean }>(
      'POST',
      `/inventory/categories/${encodeURIComponent(code)}/rate-plan`,
      body,
    ),
};

/** Visitor address for the API's per-address wizard limit (proxy, not the browser) — never counted if absent. */
const ipHeader = (ip?: string | null): Record<string, string> =>
  ip ? { 'cf-connecting-ip': ip } : {};

/** Fixed guest operations: no browser-supplied backend path or credentials. */
export const wizardApi = {
  open: (token: string, ref: string, ip?: string | null) =>
    sendJson<import('./wizard-types').WizardState>(
      'POST',
      '/wizard/session',
      { ref },
      { ...(token ? { 'x-wizard-token': token } : {}), ...ipHeader(ip) },
    ),
  save: (token: string, body: unknown) =>
    sendJson<import('./wizard-types').WizardState>('PATCH', '/wizard/config', body, {
      'x-wizard-token': token,
    }),
};

export interface SellerAgentCard {
  id: string;
  name: string;
  scenario: string;
  lifecycle: string;
  profile: Record<string, string>;
  updatedAt: string;
}
export const sellerAgentsApi = {
  create: (id: string, profile: Record<string, string>) =>
    sendJson<{ id: string }>('POST', '/seller-agents', { id, profile }),
  get: (id: string) => getJson<SellerAgentCard>('/seller-agents/' + encodeURIComponent(id)),
  update: (id: string, body: unknown) =>
    sendJson<{ id: string; updatedAt: string }>(
      'PATCH',
      '/seller-agents/' + encodeURIComponent(id),
      body,
    ),
  list: () =>
    getJson<{
      items: Array<{
        id: string;
        name: string;
        scenario: string;
        lifecycle: string;
        profile: Record<string, string>;
        updatedAt: string;
      }>;
    }>('/seller-agents'),
  claim: (token: string) =>
    sendJson<{ id: string }>('POST', '/seller-agents/claim', {}, { 'x-wizard-token': token }),
};

export interface BranchItem {
  id: string;
  name: string;
  address: string | null;
  currency: string;
  timezone: string;
  locationId: string;
  location: { businessId: string };
  _count: { inventoryUnits: number; accommodationTypes: number };
}
export const branchesApi = {
  overview: (from: string, to: string) =>
    getJson<{ rows: Array<{ branch: BranchItem; stats: import('@pms/domain').DashboardPeriod }> }>(
      `/branches/overview?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    ),
  list: () =>
    getJson<{
      organization: { id: string; name: string; status: string };
      items: BranchItem[];
      canCreate: boolean;
    }>('/branches'),
  create: (body: {
    id: string;
    name: string;
    address: string;
    currency: string;
    timezone: string;
  }) => sendJson<BranchItem>('POST', '/branches', body),
};
