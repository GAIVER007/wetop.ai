import type { ActionPreview } from './action-preview';
export type { ActionPreview } from './action-preview';

/**
 * Клиент API стойки. Адрес — APP_API_URL (по умолчанию локальный API на 3001).
 * Формы ответов повторяют apps/api (InventorySummaryDto, InventoryUnitDto).
 */
import type { DashboardPeriod } from '@pms/domain';
import { ApiError } from './api-error';
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
  exelyRoomNumber: string | null;
  kind: 'ROOM' | 'BED';
  accommodationTypeCode: string;
  accommodationTypeName: string;
  roomNumber: string;
  roomCapacity: number;
  isDorm: boolean;
}

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
  // иначе неверный пароль отправлял бы на ту же страницу без объяснения (ADR-046).
  if (response.status === 401 && !path.startsWith('/auth/')) {
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

export const api = {
  inventorySummary: () => getJson<InventorySummary>('/inventory/summary'),
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
/** Проживание без ячейки в диапазоне доски (строка «Без ячейки», паритет с «Без номера» в Exely). Без гостей — ПД. */
export interface UnassignedStay {
  confirmationNumber: string;
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
    /** Тариф проживания; null — неизвестен (перенесено из Exely), пересчёт цены требует выбрать тариф */
    ratePlanCode?: string | null;
    ratePlanName?: string | null;
    /** Гостей на проживании — правится с карточки */
    adults: number;
    children: number;
    unitCode: string | null;
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
}
/** Ошибка API с текстом из ответа NestJS (400/404/409/422) — показывается администратору как есть. */
export { ApiError, apiErrorDigest, apiErrorStatus } from './api-error';

async function sendJson<T>(
  method: 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body: unknown,
): Promise<T> {
  const res = await backendFetch(path, {
    method,
    headers: { 'content-type': 'application/json' },
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
  login: (body: { email: string; password: string }) =>
    sendJson<{ token: string; expiresAt: string; user: SignedIn }>('POST', '/auth/login', body),
  me: () => getJson<{ user: SignedIn | null; expiresAt?: string }>('/auth/me'),
  logout: () => sendJson<{ ok: boolean }>('POST', '/auth/logout', {}),
  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    sendJson<{ ok: boolean }>('POST', '/auth/password', body),
  /** «Забыли пароль»: ответ один и тот же, есть такая почта или нет */
  requestReset: (body: { email: string }) =>
    sendJson<{ ok: boolean }>('POST', '/auth/password-reset/request', body),
  /** Пароль по одноразовой ссылке из письма */
  confirmReset: (body: { token: string; password: string }) =>
    sendJson<{ ok: boolean }>('POST', '/auth/password-reset/confirm', body),
  // Вход по коду на почту снят 20.09.2026 (ADR-053): requestCode и verify убраны вместе с ним.
  /**
   * Регистрация: почта, имя, пароль (ADR-053, ADR-060). Ключа сессии в ответе нет — сначала письмо
   * и подтверждение почты. 400 с текстом приходит на кривую форму и на занятый адрес.
   */
  register: (body: { email: string; name: string; hotelName: string; password: string }) =>
    sendJson<{ pendingVerification: true; email: string; name: string; sent: boolean }>(
      'POST',
      '/auth/register',
      body,
    ),
  /** Подтверждение почты по ссылке из письма: ответ тот же, что у входа — ключ, срок, кто вошёл */
  verifyEmail: (body: { token: string }) =>
    sendJson<{ token: string; expiresAt: string; user: SignedIn }>(
      'POST',
      '/auth/email/verify',
      body,
    ),
  /** «Выслать письмо заново»: ответ один и тот же, есть такая почта или нет */
  resendVerification: (body: { email: string }) =>
    sendJson<{ ok: boolean }>('POST', '/auth/email/resend', body),
  // ── Приглашения (срез 13, этап 7) ─────────────────────────────────────────────────────────────
  /** Ожидающие приглашения своей организации. 401 — сессии нет. */
  invites: async (token: string, info: AuthClientInfo): Promise<AuthInvite[]> => {
    const res = await backendFetch('/auth/invites', { headers: authHeaders(info, token) });
    if (!res.ok) throw new ApiError(res.status, await messageOf(res));
    return (await res.json()) as AuthInvite[];
  },
  /** 201 с приглашением; 400 с текстом про почту или «уже в организации»; 401 — сессии нет. */
  invite: async (token: string, email: string, info: AuthClientInfo): Promise<AuthInvite> => {
    const res = await backendFetch('/auth/invites', {
      method: 'POST',
      headers: authHeaders(info, token),
      body: JSON.stringify({ email }),
    });
    if (!res.ok) throw new ApiError(res.status, await messageOf(res));
    return (await res.json()) as AuthInvite;
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
};

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
};
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
  }>;
}
export const guestsApi = {
  search: (q: string) => getJson<GuestSummary[]>(`/guests?q=${encodeURIComponent(q)}`),
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
export const financeApi = {
  report: (from: string, to: string) =>
    getJson<PeriodReport>(
      `/finance/report?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
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
  period: (from: string, to: string) =>
    getJson<DashboardView>(`/desk/dashboard?${new URLSearchParams({ from, to })}`),
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
export const guardApi = {
  status: () => getJson<GuardStatus>('/guard/status'),
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
}

export interface AuthInvitePreview {
  organizationName: string;
  email: string;
  expiresAt: string;
  /** Только у принятия: ключ, по которому человек задаёт себе пароль. null — пароль у него уже есть. */
  setPasswordToken?: string | null;
}
