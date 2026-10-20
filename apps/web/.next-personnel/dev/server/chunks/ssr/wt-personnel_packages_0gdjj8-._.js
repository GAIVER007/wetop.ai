module.exports = [
"[project]/wt-personnel/packages/domain/src/accounts/extensions.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "EXTENSION_STATUSES",
    ()=>EXTENSION_STATUSES,
    "PLATFORM_TIMEZONE",
    ()=>PLATFORM_TIMEZONE,
    "extensionAccess",
    ()=>extensionAccess,
    "extensionDaysLeft",
    ()=>extensionDaysLeft,
    "isExtensionActive",
    ()=>isExtensionActive,
    "parseExtensionChange",
    ()=>parseExtensionChange
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$web$2d$analytics$2f$metrics$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/web-analytics/metrics.ts [app-ssr] (ecmascript)");
;
const EXTENSION_STATUSES = {
    TRIAL: 'пробный',
    ACTIVE: 'оплачен',
    OFF: 'выключен'
};
function isExtensionActive(row, now) {
    if (!row || row.status === 'OFF') return false;
    if (row.activeUntil === null) return row.status === 'ACTIVE';
    return now < row.activeUntil;
}
function extensionAccess(row, now) {
    if (isExtensionActive(row, now)) return 'active';
    return row && row.status !== 'OFF' ? 'expired' : 'off';
}
function extensionDaysLeft(row, now) {
    if (!row || row.status === 'OFF' || row.activeUntil === null) return null;
    const ms = row.activeUntil.getTime() - now.getTime();
    return ms <= 0 ? 0 : Math.ceil(ms / 86_400_000);
}
const PLATFORM_TIMEZONE = 'Asia/Almaty';
const NOTE_MAX = 300;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
function parseExtensionChange(raw, now) {
    const input = raw && typeof raw === 'object' ? raw : {};
    const errors = [];
    const status = input.status;
    const known = typeof status === 'string' && Object.hasOwn(EXTENSION_STATUSES, status);
    if (!known) errors.push('Статус: пробный, оплачен или выключен');
    const day = typeof input.activeUntil === 'string' ? input.activeUntil.trim() : '';
    let activeUntil = null;
    if (known && status !== 'OFF') {
        if (day === '') {
            if (status === 'TRIAL') errors.push('У пробного доступа нужен срок');
        } else if (!DAY.test(day) || Number.isNaN(Date.parse(`${day}T00:00:00Z`))) {
            errors.push('Срок: дата ГГГГ-ММ-ДД');
        } else {
            const next = new Date(Date.parse(`${day}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
            activeUntil = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$web$2d$analytics$2f$metrics$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["zonedStartOfDay"])(next, PLATFORM_TIMEZONE);
            if (activeUntil <= now) errors.push('Срок уже прошёл');
        }
    }
    const note = typeof input.note === 'string' ? input.note.trim() : '';
    if (note.length > NOTE_MAX) errors.push(`Заметка: не длиннее ${NOTE_MAX} знаков`);
    if (errors.length > 0) return {
        ok: false,
        errors
    };
    return {
        ok: true,
        value: {
            status: status,
            activeUntil,
            note: note === '' ? null : note
        }
    };
}
}),
"[project]/wt-personnel/packages/domain/src/accounts/index.ts [app-ssr] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

/**
 * Учётные записи сотрудников. Вход один — по логину и паролю (ADR-049, ADR-053; `password`,
 * `login`, `reset`). Вход по одноразовому коду на почту (ADR-046) снят 20.09.2026 вместе с модулем
 * `login-code`: владелец выбрал пароль (Q-146). Сроки сессий — `session.ts`.
 */ __turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$accounts$2f$login$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/accounts/login.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$accounts$2f$password$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/accounts/password.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$accounts$2f$roles$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/accounts/roles.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$accounts$2f$permissions$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/accounts/permissions.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$accounts$2f$members$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/accounts/members.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$accounts$2f$extensions$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/accounts/extensions.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$accounts$2f$requester$2d$context$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/accounts/requester-context.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$accounts$2f$scopes$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/accounts/scopes.ts [app-ssr] (ecmascript)");
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
}),
"[project]/wt-personnel/packages/domain/src/accounts/login.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "LOCK_MINUTES",
    ()=>LOCK_MINUTES,
    "MAX_FAILED_ATTEMPTS",
    ()=>MAX_FAILED_ATTEMPTS,
    "decideLogin",
    ()=>decideLogin,
    "evaluateLogin",
    ()=>evaluateLogin
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$accounts$2f$password$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/accounts/password.ts [app-ssr] (ecmascript)");
;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
function decideLogin({ user, passwordOk, now = new Date() }) {
    if (user.status !== 'ACTIVE') return {
        outcome: 'blocked',
        failedAttempts: user.failedAttempts,
        lockedUntil: user.lockedUntil
    };
    const locked = user.lockedUntil !== null && user.lockedUntil.getTime() > now.getTime();
    if (locked) return {
        outcome: 'locked',
        failedAttempts: user.failedAttempts,
        lockedUntil: user.lockedUntil
    };
    if (passwordOk) return {
        outcome: 'ok',
        failedAttempts: 0,
        lockedUntil: null
    };
    const resetCounter = user.lockedUntil !== null;
    const failedAttempts = (resetCounter ? 0 : user.failedAttempts) + 1;
    return {
        outcome: 'wrong',
        failedAttempts,
        lockedUntil: failedAttempts >= MAX_FAILED_ATTEMPTS ? new Date(now.getTime() + LOCK_MINUTES * 60_000) : null,
        resetCounter
    };
}
function evaluateLogin({ user, password, now = new Date() }) {
    const checkable = user.status === 'ACTIVE' && !(user.lockedUntil !== null && user.lockedUntil.getTime() > now.getTime());
    const passwordOk = checkable && user.passwordHash !== '' && (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$accounts$2f$password$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["verifyPassword"])(password, user.passwordHash);
    return decideLogin({
        user,
        passwordOk,
        now
    });
}
}),
"[project]/wt-personnel/packages/domain/src/accounts/members.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "MEMBER_DETAILS_FORBIDDEN_MESSAGE",
    ()=>MEMBER_DETAILS_FORBIDDEN_MESSAGE,
    "MEMBER_MANAGER_REMOVES_STAFF_MESSAGE",
    ()=>MEMBER_MANAGER_REMOVES_STAFF_MESSAGE,
    "MEMBER_NOT_FOUND_MESSAGE",
    ()=>MEMBER_NOT_FOUND_MESSAGE,
    "MEMBER_OWNER_MESSAGE",
    ()=>MEMBER_OWNER_MESSAGE,
    "MEMBER_PHONE_MESSAGE",
    ()=>MEMBER_PHONE_MESSAGE,
    "MEMBER_POSITION_MESSAGE",
    ()=>MEMBER_POSITION_MESSAGE,
    "MEMBER_ROLE_MESSAGE",
    ()=>MEMBER_ROLE_MESSAGE,
    "MEMBER_ROLE_OWNER_ONLY_MESSAGE",
    ()=>MEMBER_ROLE_OWNER_ONLY_MESSAGE,
    "MEMBER_SELF_MESSAGE",
    ()=>MEMBER_SELF_MESSAGE,
    "canEditMemberDetails",
    ()=>canEditMemberDetails,
    "parseMemberDetails",
    ()=>parseMemberDetails
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$web$2d$booking$2f$request$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/web-booking/request.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$accounts$2f$roles$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/accounts/roles.ts [app-ssr] (ecmascript)");
;
;
const MEMBER_NOT_FOUND_MESSAGE = 'Такого сотрудника в организации нет.';
const MEMBER_SELF_MESSAGE = 'Себя отключить или сменить себе роль нельзя.';
const MEMBER_OWNER_MESSAGE = 'Владельца организации отключает и назначает только команда на сервере.';
const MEMBER_MANAGER_REMOVES_STAFF_MESSAGE = 'Управляющий отключает только администраторов.';
const MEMBER_ROLE_MESSAGE = 'Роль сотрудника — «управляющий» или «администратор».';
const MEMBER_ROLE_OWNER_ONLY_MESSAGE = 'Роль сотрудника меняет только владелец организации.';
const MEMBER_PHONE_MESSAGE = 'Проверьте телефон: номер целиком, с 8 или кодом страны.';
const MEMBER_POSITION_MESSAGE = 'Должность: не длиннее 100 знаков.';
const MEMBER_DETAILS_FORBIDDEN_MESSAGE = 'Контакты управляющего меняет владелец, контакты владельца меняет он сам.';
const POSITION_MAX = 100;
function canEditMemberDetails(actor, target, self) {
    return self ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$accounts$2f$roles$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["canManageStaff"])(actor) : (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$accounts$2f$roles$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["canRemoveMember"])(actor, target);
}
function parseMemberDetails(raw) {
    const b = raw && typeof raw === 'object' ? raw : {};
    const text = (v)=>typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : v;
    const phoneRaw = text(b.phone ?? '');
    const position = text(b.position ?? '');
    if (typeof phoneRaw !== 'string') return {
        ok: false,
        message: MEMBER_PHONE_MESSAGE
    };
    const phone = phoneRaw ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$web$2d$booking$2f$request$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["normalizePhone"])(phoneRaw) : null;
    if (phoneRaw && !phone) return {
        ok: false,
        message: MEMBER_PHONE_MESSAGE
    };
    if (typeof position !== 'string' || position.length > POSITION_MAX) return {
        ok: false,
        message: MEMBER_POSITION_MESSAGE
    };
    return {
        ok: true,
        phone,
        position: position || null
    };
}
}),
"[project]/wt-personnel/packages/domain/src/accounts/password.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "MIN_PASSWORD_LENGTH",
    ()=>MIN_PASSWORD_LENGTH,
    "checkPassword",
    ()=>checkPassword,
    "hashPassword",
    ()=>hashPassword,
    "hashPasswordAsync",
    ()=>hashPasswordAsync,
    "hashSessionToken",
    ()=>hashSessionToken,
    "newSessionToken",
    ()=>newSessionToken,
    "verifyPassword",
    ()=>verifyPassword,
    "verifyPasswordAsync",
    ()=>verifyPasswordAsync
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:crypto [external] (node:crypto, cjs)");
;
/**
 * Пароли сотрудников (DATA_MODEL §13.8, ADR-049). Считаем `scrypt` из стандартной библиотеки Node:
 * ни одной новой зависимости, одинаково работает на Mac владельца и на сервере, куда PMS переедет.
 * Формат строки в базе: `scrypt$N$r$p$соль$хеш`, соль своя у каждого пользователя.
 *
 * Сам пароль нигде не остаётся: ни в журнале (`audit_logs`), ни в отчётах, ни в `details` неисправностей.
 *
 * Байты здесь не ходят через глобальный `Buffer` намеренно: как только он появляется в пакете домена,
 * TypeScript подтягивает к нему типы Node и ломает DOM-типы в сквозных тестах Playwright (проверено
 * 15.09.2026: пять ошибок в `tests/e2e` и `tests/ui`, которых до того не было). Соль — строка, она же
 * годная соль для scrypt; сравнение идёт по байтам строк, за одинаковое время.
 */ const N = 16_384;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const SALT_BYTES = 16;
const bytes = new TextEncoder();
const MIN_PASSWORD_LENGTH = 10;
function checkPassword(raw) {
    const value = raw.trim();
    if (value.length < MIN_PASSWORD_LENGTH) return {
        ok: false,
        reason: `пароль короче ${MIN_PASSWORD_LENGTH} символов`
    };
    if (/^\d+$/.test(value)) return {
        ok: false,
        reason: 'пароль из одних цифр'
    };
    return {
        ok: true
    };
}
const derive = (raw, salt, cost)=>(0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["scryptSync"])(raw.normalize('NFKC'), salt, KEY_LENGTH, cost).toString('base64url');
function hashPassword(raw) {
    const salt = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["randomBytes"])(SALT_BYTES).toString('base64url');
    return `scrypt$${N}$${R}$${P}$${salt}$${derive(raw, salt, {
        N,
        r: R,
        p: P
    })}`;
}
async function hashPasswordAsync(raw) {
    const salt = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["randomBytes"])(SALT_BYTES).toString('base64url');
    const key = await new Promise((resolve, reject)=>(0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["scrypt"])(raw.normalize('NFKC'), salt, KEY_LENGTH, {
            N,
            r: R,
            p: P
        }, (err, derived)=>err ? reject(err) : resolve(derived.toString('base64url'))));
    return `scrypt$${N}$${R}$${P}$${salt}$${key}`;
}
function verifyPassword(raw, stored) {
    const parts = stored.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
    const [, n, r, p, salt, expected] = parts;
    const cost = {
        N: Number(n),
        r: Number(r),
        p: Number(p)
    };
    if (!Number.isInteger(cost.N) || !Number.isInteger(cost.r) || !Number.isInteger(cost.p)) return false;
    if (cost.N < 1024 || cost.r < 1 || cost.p < 1 || salt === '' || expected === '') return false;
    try {
        const actual = derive(raw, salt, cost);
        if (actual.length !== expected.length) return false;
        return (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["timingSafeEqual"])(bytes.encode(actual), bytes.encode(expected));
    } catch  {
        return false;
    }
}
async function verifyPasswordAsync(raw, stored) {
    const parts = stored.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
    const [, n, r, p, salt, expected] = parts;
    const cost = {
        N: Number(n),
        r: Number(r),
        p: Number(p)
    };
    if (!Number.isInteger(cost.N) || !Number.isInteger(cost.r) || !Number.isInteger(cost.p)) return false;
    if (cost.N < 1024 || cost.r < 1 || cost.p < 1 || salt === '' || expected === '') return false;
    const actual = await new Promise((resolve)=>{
        try {
            (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["scrypt"])(raw.normalize('NFKC'), salt, KEY_LENGTH, cost, (err, key)=>resolve(err ? null : key.toString('base64url')));
        } catch  {
            resolve(null);
        }
    });
    if (actual === null || actual.length !== expected.length) return false;
    return (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["timingSafeEqual"])(bytes.encode(actual), bytes.encode(expected));
}
function newSessionToken() {
    return (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["randomBytes"])(32).toString('base64url');
}
function hashSessionToken(token) {
    return (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["createHash"])('sha256').update(token).digest('hex');
}
}),
"[project]/wt-personnel/packages/domain/src/accounts/permissions.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ADJUSTMENT_DOWN_MESSAGE",
    ()=>ADJUSTMENT_DOWN_MESSAGE,
    "PERMISSIONS",
    ()=>PERMISSIONS,
    "RATE_PLAN_CHANGE_MESSAGE",
    ()=>RATE_PLAN_CHANGE_MESSAGE,
    "RATE_PLAN_SOFT_MESSAGE",
    ()=>RATE_PLAN_SOFT_MESSAGE,
    "accessDeniedMessage",
    ()=>accessDeniedMessage,
    "can",
    ()=>can,
    "mayAssignPlanWithoutRates",
    ()=>mayAssignPlanWithoutRates,
    "permissionsOf",
    ()=>permissionsOf,
    "plansToChoose",
    ()=>plansToChoose,
    "rolesWith",
    ()=>rolesWith
]);
const PERMISSIONS = {
    // своё: профиль, пароль, сеансы, подпись помощника
    self: {
        label: 'Своя учётная запись'
    },
    // главная, шахматка, брони, гости, заселение и выселение, оплаты и начисления в счёт, печать, ячейка, неисправности
    desk: {
        label: 'Работа с гостями'
    },
    dialogs: {
        label: 'Диалоги ИИ-продавца'
    },
    // статистика и «Оплаты» — на просмотр
    reports: {
        label: 'Статистика и оплаты'
    },
    // возврат оплаты, сторно начисления (снятие штрафа за отмену — это сторно), корректировка на уменьшение
    refunds: {
        label: 'Возврат оплаты и сторно'
    },
    property: {
        label: 'Номерной фонд'
    },
    rates: {
        label: 'Тарифы и цены'
    },
    channels: {
        label: 'Каналы продаж'
    },
    // настройки гостиницы, правила отмены, услуги, интеграции, первичная настройка
    settings: {
        label: 'Настройки гостиницы'
    },
    // раздел «Маркетинг» и «Продвижение»: сайт и его аналитика, бюджет, аналитика маркетинга (ADR-MKT-B7, §16.5 v2.35)
    marketing: {
        label: 'Маркетинг и продвижение'
    },
    // запуск рекламы в подключённом кабинете (тратит деньги) и её остановка (ADR-MKT-LAUNCH, §57)
    ads_launch: {
        label: 'Запуск и остановка рекламы'
    },
    journal: {
        label: 'История действий'
    },
    seller: {
        label: 'Настройки ИИ-продавца'
    },
    staff: {
        label: 'Сотрудники и приглашения'
    },
    owner: {
        label: 'Управляющие, роли и платные расширения'
    }
};
const ALL = Object.keys(PERMISSIONS);
/**
 * Ответы владельца 27.09.2026: владельцу — всё; управляющему — «всё, кроме владельческого»; администратору — работа с
 * гостями, диалоги продавца и «плюс просмотр отчётов».
 */ const ROLE_PERMISSIONS = {
    OWNER: ALL,
    MANAGER: ALL.filter((p)=>p !== 'owner' && p !== 'journal'),
    STAFF: [
        'self',
        'desk',
        'dialogs',
        'reports'
    ]
};
const ROLE_ORDER = [
    'OWNER',
    'MANAGER',
    'STAFF'
];
/** Родительный падеж — для строки отказа «доступ есть у владельца и управляющего» */ const GENITIVE = {
    OWNER: 'владельца',
    MANAGER: 'управляющего',
    STAFF: 'администратора'
};
const ADJUSTMENT_DOWN_MESSAGE = 'Корректировку счёта на уменьшение делают владелец и управляющий — как возврат и сторно.';
const RATE_PLAN_CHANGE_MESSAGE = 'Тариф у брони меняют владелец и управляющий: администратор меняет даты и место в том же тарифе.';
/** Строже какой политики штрафа: чем выше, тем больше удерживается при отмене (Q-103) */ const PENALTY_STRENGTH = {
    NONE: 0,
    FIRST_NIGHT: 1,
    FULL_STAY: 2
};
function mayAssignPlanWithoutRates(penalty) {
    return PENALTY_STRENGTH[penalty] >= PENALTY_STRENGTH.FIRST_NIGHT;
}
const RATE_PLAN_SOFT_MESSAGE = 'Брони без тарифа администратор назначает тариф со штрафом не мягче «первых суток»; другой — владелец и управляющий.';
function plansToChoose(plans, opts) {
    if (opts.mayChangePlan) return [
        ...plans
    ];
    if (opts.hasPlan) return [];
    return plans.filter((p)=>p.cancellationPenalty !== undefined && mayAssignPlanWithoutRates(p.cancellationPenalty));
}
function permissionsOf(role) {
    const granted = role ? ROLE_PERMISSIONS[role] : undefined;
    return granted ? ALL.filter((p)=>granted.includes(p)) : [];
}
function can(role, permission) {
    return permissionsOf(role).includes(permission);
}
function rolesWith(permission) {
    return ROLE_ORDER.filter((role)=>can(role, permission));
}
function accessDeniedMessage(permission) {
    const roles = rolesWith(permission).map((role)=>GENITIVE[role]);
    const who = roles.length === 1 ? `только у ${roles[0]}` : `у ${roles.slice(0, -1).join(', ')} и ${roles[roles.length - 1]}`;
    return `«${PERMISSIONS[permission].label}»: доступ есть ${who}.`;
}
}),
"[project]/wt-personnel/packages/domain/src/accounts/registration.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Регистрация организации (срез 13, ADR-053; было ADR-046).
 *
 * До 20.09.2026 регистрация была запросом кода на почту с побочным действием. Владелец выбрал
 * вход по паролю (Q-146 закрыт), и регистрация стала обычной формой: почта, имя, пароль. Человек
 * получает организацию с пробным периодом, членство и сессию сразу — письма в этом пути нет,
 * а значит нет и зависимости от настроенной почтовой службы.
 *
 * Плата за это названа вслух: форма регистрации отвечает «адрес занят» и тем самым говорит, есть ли
 * у нас такой клиент. Иначе человеку нечего ответить на попытку зарегистрироваться дважды. Форма
 * входа по-прежнему молчит: там ответ один на неверную почту и неверный пароль.
 *
 * Форма собирает почту, имя, название отеля и пароль (SaaS-онбординг, решение владельца 21.09.2026):
 * `organizations.name` — это название отеля, введённое человеком, а не производное от его имени.
 * Переименовать объект можно потом в настройках.
 */ /** Как в колонке `organizations.name` — `varchar(200)`. */ __turbopack_context__.s([
    "ORGANIZATION_NAME_MAX",
    ()=>ORGANIZATION_NAME_MAX,
    "PERSON_NAME_MAX",
    ()=>PERSON_NAME_MAX,
    "REGISTRATION_EMAIL_MESSAGE",
    ()=>REGISTRATION_EMAIL_MESSAGE,
    "REGISTRATION_NAME_MESSAGE",
    ()=>REGISTRATION_NAME_MESSAGE,
    "REGISTRATION_NAME_TAKEN_MESSAGE",
    ()=>REGISTRATION_NAME_TAKEN_MESSAGE,
    "REGISTRATION_PERSON_NAME_MESSAGE",
    ()=>REGISTRATION_PERSON_NAME_MESSAGE,
    "REGISTRATION_TAKEN_MESSAGE",
    ()=>REGISTRATION_TAKEN_MESSAGE,
    "isOrganizationNameShaped",
    ()=>isOrganizationNameShaped,
    "isPersonNameShaped",
    ()=>isPersonNameShaped,
    "normalizeOrganizationName",
    ()=>normalizeOrganizationName,
    "normalizePersonName",
    ()=>normalizePersonName,
    "workspaceNameFor",
    ()=>workspaceNameFor
]);
const ORGANIZATION_NAME_MAX = 200;
const PERSON_NAME_MAX = 200;
function normalizeOrganizationName(raw) {
    return raw.trim().replace(/\s+/g, ' ');
}
function isOrganizationNameShaped(raw) {
    const name = normalizeOrganizationName(raw);
    return name.length >= 1 && name.length <= ORGANIZATION_NAME_MAX;
}
function normalizePersonName(raw) {
    return raw.trim().replace(/\s+/g, ' ');
}
function isPersonNameShaped(raw) {
    const name = normalizePersonName(raw);
    return name.length >= 1 && name.length <= PERSON_NAME_MAX;
}
function workspaceNameFor(personName) {
    return normalizePersonName(personName).slice(0, ORGANIZATION_NAME_MAX);
}
const REGISTRATION_EMAIL_MESSAGE = 'Укажите почту — ею же вы будете входить.';
const REGISTRATION_NAME_MESSAGE = `Укажите название организации, до ${ORGANIZATION_NAME_MAX} знаков.`;
const REGISTRATION_NAME_TAKEN_MESSAGE = 'Объект с таким названием уже есть в WETOP. Добавьте город или уточнение — например, «Хостел на Абая, Астана».';
const REGISTRATION_PERSON_NAME_MESSAGE = `Укажите имя, до ${PERSON_NAME_MAX} знаков.`;
const REGISTRATION_TAKEN_MESSAGE = 'Этот адрес уже зарегистрирован. Войдите по паролю или восстановите его на экране входа.';
}),
"[project]/wt-personnel/packages/domain/src/accounts/requester-context.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "REQUESTER_MAX_BUSINESSES",
    ()=>REQUESTER_MAX_BUSINESSES,
    "REQUESTER_MAX_LOCATIONS",
    ()=>REQUESTER_MAX_LOCATIONS,
    "accountStatusOf",
    ()=>accountStatusOf,
    "buildRequesterContext",
    ()=>buildRequesterContext
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$accounts$2f$permissions$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/accounts/permissions.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$accounts$2f$trial$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/accounts/trial.ts [app-ssr] (ecmascript)");
;
;
const REQUESTER_MAX_BUSINESSES = 5;
const REQUESTER_MAX_LOCATIONS = 10;
function accountStatusOf(organization, now) {
    const status = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$accounts$2f$trial$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["statusAfterTrial"])(organization.status, organization.trialEndsAt, now);
    const trialEnded = organization.status === 'TRIAL' && status === 'READ_ONLY';
    const showTrialEnd = status === 'TRIAL' || trialEnded;
    return {
        status,
        canMutate: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$accounts$2f$trial$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["canWrite"])(organization.status, organization.trialEndsAt, now),
        trialEndsAt: showTrialEnd && organization.trialEndsAt ? organization.trialEndsAt.toISOString() : null,
        reasonCode: trialEnded ? 'TRIAL_ENDED' : status === 'READ_ONLY' ? 'READ_ONLY_BY_PLATFORM' : status === 'SUSPENDED' ? 'SUSPENDED' : null
    };
}
function buildRequesterContext(input) {
    const permissions = Object.fromEntries(Object.keys(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$accounts$2f$permissions$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["PERMISSIONS"]).map((permission)=>[
            permission,
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$accounts$2f$permissions$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["can"])(input.role, permission)
        ]));
    return {
        requester: {
            ref: input.userRef,
            role: input.role.toLowerCase(),
            kind: input.platformAdmin ? 'PLATFORM_ADMIN' : 'TENANT_USER'
        },
        organization: {
            displayName: input.organization.name
        },
        scope: 'ORGANIZATION',
        businesses: input.businesses.slice(0, REQUESTER_MAX_BUSINESSES).map((business)=>({
                displayName: business.name,
                vertical: business.vertical,
                locations: business.locations.slice(0, REQUESTER_MAX_LOCATIONS).map((location)=>({
                        displayName: location.name
                    }))
            })),
        account: accountStatusOf(input.organization, input.now),
        permissions
    };
}
}),
"[project]/wt-personnel/packages/domain/src/accounts/roles.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "MEMBERSHIP_ROLES",
    ()=>MEMBERSHIP_ROLES,
    "canChangeRole",
    ()=>canChangeRole,
    "canConfigureSeller",
    ()=>canConfigureSeller,
    "canInvite",
    ()=>canInvite,
    "canManageStaff",
    ()=>canManageStaff,
    "canRemoveMember",
    ()=>canRemoveMember,
    "canSetRoleAtDesk",
    ()=>canSetRoleAtDesk,
    "identityRole",
    ()=>identityRole,
    "invitableRoles",
    ()=>invitableRoles,
    "parseInviteRole",
    ()=>parseInviteRole,
    "parseMembershipRole",
    ()=>parseMembershipRole
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$accounts$2f$permissions$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/accounts/permissions.ts [app-ssr] (ecmascript)");
;
const MEMBERSHIP_ROLES = {
    OWNER: 'владелец',
    MANAGER: 'управляющий',
    STAFF: 'администратор'
};
function canManageStaff(role) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$accounts$2f$permissions$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["can"])(role, 'staff');
}
function canConfigureSeller(role) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$accounts$2f$permissions$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["can"])(role, 'seller');
}
function invitableRoles(actor) {
    if (!canManageStaff(actor)) return [];
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$accounts$2f$permissions$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["can"])(actor, 'owner') ? [
        'MANAGER',
        'STAFF'
    ] : [
        'STAFF'
    ];
}
function canInvite(actor, role) {
    return invitableRoles(actor).includes(role);
}
function canRemoveMember(actor, target) {
    return canInvite(actor, target);
}
function canSetRoleAtDesk(actor, current, next) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$accounts$2f$permissions$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["can"])(actor, 'owner') && current !== 'OWNER' && next !== 'OWNER';
}
function identityRole(role) {
    return role.toLowerCase();
}
function parseMembershipRole(raw) {
    const value = raw.trim().toUpperCase();
    return value === 'OWNER' || value === 'MANAGER' || value === 'STAFF' ? value : null;
}
function parseInviteRole(raw) {
    if (typeof raw !== 'string') return null;
    const value = parseMembershipRole(raw);
    return value === 'MANAGER' || value === 'STAFF' ? value : null;
}
function canChangeRole(input) {
    if (input.current === 'OWNER' && input.next !== 'OWNER' && input.owners <= 1) return {
        ok: false,
        reason: 'Это единственный владелец организации: сначала назначьте другого'
    };
    return {
        ok: true
    };
}
}),
"[project]/wt-personnel/packages/domain/src/accounts/scopes.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ORGANIZATION_LEVEL_PERMISSIONS",
    ()=>ORGANIZATION_LEVEL_PERMISSIONS,
    "RESTRICTED_CATALOG_WRITE_MESSAGE",
    ()=>RESTRICTED_CATALOG_WRITE_MESSAGE,
    "RESTRICTED_GUESTS_MESSAGE",
    ()=>RESTRICTED_GUESTS_MESSAGE,
    "RESTRICTED_ORGANIZATION_MESSAGE",
    ()=>RESTRICTED_ORGANIZATION_MESSAGE,
    "SCOPES_MAX",
    ()=>SCOPES_MAX,
    "SCOPES_MESSAGE",
    ()=>SCOPES_MESSAGE,
    "SCOPE_CHOOSE_MESSAGE",
    ()=>SCOPE_CHOOSE_MESSAGE,
    "SCOPE_FORBIDDEN_MESSAGE",
    ()=>SCOPE_FORBIDDEN_MESSAGE,
    "SCOPE_REJECTED_MESSAGE",
    ()=>SCOPE_REJECTED_MESSAGE,
    "canAt",
    ()=>canAt,
    "higherRole",
    ()=>higherRole,
    "isRestricted",
    ()=>isRestricted,
    "isUnrestricted",
    ()=>isUnrestricted,
    "membershipRoleFor",
    ()=>membershipRoleFor,
    "parseScopeAssignments",
    ()=>parseScopeAssignments,
    "roleAt",
    ()=>roleAt,
    "validateAssignments",
    ()=>validateAssignments,
    "visibleLocations",
    ()=>visibleLocations
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$accounts$2f$permissions$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/accounts/permissions.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$accounts$2f$roles$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/accounts/roles.ts [app-ssr] (ecmascript)");
;
;
const RANK = {
    OWNER: 3,
    MANAGER: 2,
    STAFF: 1
};
function higherRole(a, b) {
    return RANK[a] >= RANK[b] ? a : b;
}
function isUnrestricted(assignments) {
    return assignments.length === 0;
}
function roleAt(membershipRole, assignments, target) {
    if (membershipRole === 'OWNER') return 'OWNER';
    if (isUnrestricted(assignments)) return membershipRole;
    let best = null;
    for (const a of assignments){
        if (a.businessId !== target.businessId) continue;
        const covers = a.locationId === null || a.locationId === target.locationId;
        if (covers) best = best ? higherRole(best, a.role) : a.role;
    }
    return best;
}
function visibleLocations(membershipRole, assignments, locations) {
    return locations.filter((l)=>roleAt(membershipRole, assignments, {
            businessId: l.businessId,
            locationId: l.id
        }) !== null);
}
function membershipRoleFor(assignments, fallback) {
    if (assignments.length === 0) return fallback;
    return assignments.map((a)=>a.role).reduce(higherRole, 'STAFF');
}
function validateAssignments(input) {
    const seen = new Set();
    const wholeBusiness = new Set(input.assignments.filter((a)=>a.locationId === null).map((a)=>a.businessId));
    for (const a of input.assignments){
        if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$accounts$2f$roles$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["canInvite"])(input.actor, a.role)) return {
            ok: false,
            reason: 'Эту роль вы назначить не можете: она выше ваших полномочий'
        };
        const business = input.known.find((b)=>b.businessId === a.businessId);
        if (!business) return {
            ok: false,
            reason: 'Бизнес не найден в вашей организации'
        };
        if (a.locationId !== null && !business.locationIds.includes(a.locationId)) return {
            ok: false,
            reason: 'Филиал не относится к выбранному бизнесу'
        };
        const key = `${a.businessId}:${a.locationId ?? ''}`;
        if (seen.has(key)) return {
            ok: false,
            reason: 'Одно и то же назначение указано дважды'
        };
        seen.add(key);
        if (a.locationId !== null && wholeBusiness.has(a.businessId)) return {
            ok: false,
            reason: 'Бизнес уже назначен целиком: отдельное назначение на его филиал лишнее'
        };
    }
    return {
        ok: true
    };
}
const SCOPES_MESSAGE = 'Назначения: список из роли (управляющий или администратор), бизнеса и, если нужно, филиала.';
const SCOPES_MAX = 50;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function parseScopeAssignments(raw) {
    if (raw === undefined || raw === null) return {
        ok: true,
        assignments: []
    };
    if (!Array.isArray(raw) || raw.length > SCOPES_MAX) return {
        ok: false,
        message: SCOPES_MESSAGE
    };
    const assignments = [];
    for (const item of raw){
        if (!item || typeof item !== 'object') return {
            ok: false,
            message: SCOPES_MESSAGE
        };
        const o = item;
        const role = typeof o.role === 'string' ? o.role.trim().toUpperCase() : '';
        const businessId = o.businessId;
        const locationId = o.locationId ?? null;
        if (role !== 'MANAGER' && role !== 'STAFF') return {
            ok: false,
            message: SCOPES_MESSAGE
        };
        if (typeof businessId !== 'string' || !UUID_RE.test(businessId)) return {
            ok: false,
            message: SCOPES_MESSAGE
        };
        if (locationId !== null && (typeof locationId !== 'string' || !UUID_RE.test(locationId))) return {
            ok: false,
            message: SCOPES_MESSAGE
        };
        assignments.push({
            role,
            businessId,
            locationId
        });
    }
    return {
        ok: true,
        assignments
    };
}
const ORGANIZATION_LEVEL_PERMISSIONS = [
    'staff',
    'owner',
    'journal',
    'seller',
    'dialogs'
];
const RESTRICTED_ORGANIZATION_MESSAGE = 'Этот раздел для сотрудников без ограничения по филиалам: у вас доступ к выбранным бизнесам и филиалам.';
const RESTRICTED_GUESTS_MESSAGE = 'Гости общие для всей организации: их открывают сотрудникам без ограничения по филиалам.';
const RESTRICTED_CATALOG_WRITE_MESSAGE = 'Каталог общий для всех филиалов бизнеса: менять его могут сотрудники без ограничения по филиалам.';
const SCOPE_REJECTED_MESSAGE = 'Выбранный бизнес или филиал недоступен. Выберите филиал заново.';
const SCOPE_CHOOSE_MESSAGE = 'Выберите доступный вам филиал.';
const SCOPE_FORBIDDEN_MESSAGE = 'У вас нет доступа к этому бизнесу или филиалу.';
function isRestricted(role, assignments) {
    return role !== 'OWNER' && !isUnrestricted(assignments);
}
function canAt(role, assignments, permission, target) {
    if (!isRestricted(role, assignments)) return (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$accounts$2f$permissions$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["can"])(role, permission);
    if (ORGANIZATION_LEVEL_PERMISSIONS.includes(permission)) return false;
    if (!target) return permission === 'self';
    const here = roleAt(role, assignments, target);
    return here !== null && (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$accounts$2f$permissions$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["can"])(here, permission);
}
}),
"[project]/wt-personnel/packages/domain/src/accounts/trial.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Пробный период (срез 13, ADR-046).
 *
 * Семь дней с момента создания организации (решение владельца 17.10.2026, ADR-TRIAL-7-DAYS-20261017;
 * было 14 по ADR-102, до него 7 по ADR-046). Уже созданные организации сохраняют свой `trial_ends_at`.
 * По истечении организация не удаляется и вход не закрывается: она читает свои данные, но не пишет, пока главный
 * администратор не подтвердит оплату (Q-144 — Б). Данные человека остаются на месте — иначе первый же забытый триал
 * превращается в потерю чужой работы.
 */ __turbopack_context__.s([
    "READ_ONLY_MESSAGE",
    ()=>READ_ONLY_MESSAGE,
    "TRIAL_DAYS",
    ()=>TRIAL_DAYS,
    "canWrite",
    ()=>canWrite,
    "daysLeft",
    ()=>daysLeft,
    "statusAfterTrial",
    ()=>statusAfterTrial,
    "trialEndsAt",
    ()=>trialEndsAt,
    "writeBlocked",
    ()=>writeBlocked
]);
const TRIAL_DAYS = 7;
function trialEndsAt(createdAt) {
    return new Date(createdAt.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
}
function daysLeft(trialEnd, now) {
    const ms = trialEnd.getTime() - now.getTime();
    return ms <= 0 ? 0 : Math.ceil(ms / (24 * 60 * 60 * 1000));
}
function canWrite(status, trialEnd, now) {
    if (status === 'ACTIVE') return true;
    if (status !== 'TRIAL') return false;
    return trialEnd !== null && now < trialEnd;
}
function statusAfterTrial(status, trialEnd, now) {
    if (status !== 'TRIAL') return status;
    if (trialEnd === null || now < trialEnd) return status;
    return 'READ_ONLY';
}
const READ_ONLY_MESSAGE = 'Пробный период закончился — оплатите подписку. Данные доступны для просмотра, изменения — после оплаты.';
const READ_METHODS = new Set([
    'GET',
    'HEAD',
    'OPTIONS'
]);
function writeBlocked(input) {
    if (READ_METHODS.has(input.method.toUpperCase())) return false;
    if (!input.organization) return false;
    const path = input.path.split('?')[0] ?? '';
    if (path === '/auth' || path.startsWith('/auth/')) return false;
    if (input.platformAdmin && (path === '/platform' || path.startsWith('/platform/'))) return false;
    return !canWrite(input.organization.status, input.organization.trialEndsAt, input.now);
}
}),
"[project]/wt-personnel/packages/domain/src/ai-agents/index.ts [app-ssr] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
;
;
}),
"[project]/wt-personnel/packages/domain/src/ai-seller/facts.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SELLER_FACTS_DAYS",
    ()=>SELLER_FACTS_DAYS,
    "SELLER_FACTS_DOCUMENT",
    ()=>SELLER_FACTS_DOCUMENT,
    "buildSellerFacts",
    ()=>buildSellerFacts,
    "sellerCategoryPrices",
    ()=>sellerCategoryPrices,
    "sellerFactsHash",
    ()=>sellerFactsHash,
    "sellerFactsWindow",
    ()=>sellerFactsWindow
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:crypto [external] (node:crypto, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$web$2d$analytics$2f$metrics$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/web-analytics/metrics.ts [app-ssr] (ecmascript)");
;
;
const SELLER_FACTS_DAYS = 60;
const SELLER_FACTS_DOCUMENT = 'platform:facts.md';
/** Пределы модели бота `ObjectFacts` */ const LIMITS = {
    objectName: 120,
    address: 300,
    timezone: 64,
    categories: 50,
    categoryName: 120,
    capacity: 50
};
const addDays = (date, n)=>{
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
};
function sellerFactsWindow(now, timezone) {
    const from = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$web$2d$analytics$2f$metrics$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["localDate"])(now, timezone);
    return {
        from,
        to: addDays(from, SELLER_FACTS_DAYS - 1)
    };
}
const byCode = (list)=>[
        ...list
    ].sort((a, b)=>a.code.localeCompare(b.code));
function sellerCategoryPrices(source) {
    return byCode(source.categories).map((c)=>{
        const capacity = Math.max(1, c.capacityAdults);
        const rows = source.ratePlan ? source.rates.filter((r)=>r.categoryCode === c.code && r.occupancy <= capacity) : [];
        const base = {
            code: c.code,
            name: c.name,
            kind: c.kind,
            capacity,
            units: c.units
        };
        if (rows.length === 0) return {
            ...base,
            occupancy: null,
            priceMinor: null,
            reason: 'none',
            min: null,
            max: null,
            days: 0
        };
        const occupancy = Math.max(...rows.map((r)=>r.occupancy));
        const at = rows.filter((r)=>r.occupancy === occupancy);
        let min = at[0].priceMinor;
        let max = min;
        for (const r of at){
            if (r.priceMinor < min) min = r.priceMinor;
            if (r.priceMinor > max) max = r.priceMinor;
        }
        const same = min === max;
        return {
            ...base,
            occupancy,
            priceMinor: same ? min.toString() : null,
            reason: same ? 'same' : 'varies',
            min: min.toString(),
            max: max.toString(),
            days: new Set(at.map((r)=>r.date)).size
        };
    });
}
/** Время заезда и выезда — ЧЧ:ММ, как требует бот (в карточке бывает и «14:00:00», и «9:30») */ const hhmm = (value)=>{
    const m = /^(\d{1,2}):(\d{2})/.exec(value.trim());
    return m ? `${m[1].padStart(2, '0')}:${m[2]}` : value.trim();
};
/** Цена числом для тела: тиыны больше безопасного целого JavaScript — не шлём, чем исказить */ const minorNumber = (minor)=>{
    if (minor === null) return null;
    const n = BigInt(minor);
    return n <= BigInt(Number.MAX_SAFE_INTEGER) && n >= 0n ? Number(n) : null;
};
function buildSellerFacts(source) {
    const address = source.property.address?.trim() ?? '';
    const prices = new Map(sellerCategoryPrices(source).map((p)=>[
            p.code,
            p
        ]));
    return {
        object_name: source.property.name.trim().slice(0, LIMITS.objectName),
        address: address.length > LIMITS.address ? '' : address,
        timezone: source.property.timezone.slice(0, LIMITS.timezone),
        check_in: hhmm(source.property.checkInTime),
        check_out: hhmm(source.property.checkOutTime),
        currency: source.ratePlan?.currency ?? source.property.currency,
        categories: byCode(source.categories).slice(0, LIMITS.categories).map((c)=>({
                name: c.name.trim().slice(0, LIMITS.categoryName),
                kind: c.kind === 'DORM_BED' ? 'bed' : 'room',
                capacity: Math.min(Math.max(1, c.capacityAdults), LIMITS.capacity),
                price_minor: minorNumber(prices.get(c.code)?.priceMinor ?? null)
            }))
    };
}
function sellerFactsHash(payload) {
    return (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["createHash"])('sha256').update(JSON.stringify(payload), 'utf8').digest('hex');
}
}),
"[project]/wt-personnel/packages/domain/src/ai-seller/index.ts [app-ssr] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$ai$2d$seller$2f$facts$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/ai-seller/facts.ts [app-ssr] (ecmascript)");
;
;
}),
"[project]/wt-personnel/packages/domain/src/ai-seller/profile.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Профиль ИИ-продавца (DATA_MODEL §15, ТЗ ред. 1 П5, Б6; ADR-079, ADR-081): поля экрана «Настройки».
 *
 * Платформа передаёт продавцу профиль полями, а не текстом промпта: промпт собирает бот из неизменяемого ядра правил
 * и этих полей (ТЗ §2 п. 2). Поэтому здесь нет и не может быть поля «текст промпта» — из свободного текста можно
 * стереть «не считай деньги» и «не обещай действий, которых не делаешь». Лишние ключи на входе отбрасываются.
 *
 * Перечисления и пределы — ровно модели бота `SellerProfile` (`apps/ai-seller/src/ai/seller_prompt.py`): она
 * принимает профиль с `extra='forbid'`, и лишнее поле или значение вне списка у неё — отказ 422.
 */ __turbopack_context__.s([
    "DEFAULT_SELLER_PROFILE",
    ()=>DEFAULT_SELLER_PROFILE,
    "SELLER_ADDRESS_FORMS",
    ()=>SELLER_ADDRESS_FORMS,
    "SELLER_EMOJI",
    ()=>SELLER_EMOJI,
    "SELLER_LANGUAGES",
    ()=>SELLER_LANGUAGES,
    "SELLER_PROFILE_LIMITS",
    ()=>SELLER_PROFILE_LIMITS,
    "SELLER_REPLY_LENGTHS",
    ()=>SELLER_REPLY_LENGTHS,
    "parseSellerProfile",
    ()=>parseSellerProfile,
    "pickSellerProfile",
    ()=>pickSellerProfile,
    "sellerProfilePayload",
    ()=>sellerProfilePayload
]);
const SELLER_LANGUAGES = {
    ru: 'Русский',
    kk: 'Казахский',
    en: 'Английский',
    zh: 'Китайский',
    uz: 'Узбекский',
    ky: 'Киргизский',
    tr: 'Турецкий',
    ko: 'Корейский',
    de: 'Немецкий',
    fr: 'Французский',
    es: 'Испанский',
    ar: 'Арабский'
};
const SELLER_ADDRESS_FORMS = {
    FORMAL: 'на «вы»',
    INFORMAL: 'на «ты»'
};
const SELLER_EMOJI = {
    NEVER: 'без эмодзи',
    MODERATE: 'изредка',
    GREETING_ONLY: 'только в приветствии'
};
const SELLER_REPLY_LENGTHS = {
    SHORT: 'коротко',
    DETAILED: 'развёрнуто'
};
const SELLER_PROFILE_LIMITS = {
    botName: 40,
    greeting: 300,
    includedInPrice: 1000,
    extraCharges: 1000,
    houseRules: 2000,
    /** Строк в списках «Запреты» и «Когда звать человека» */ listItems: 30,
    listItem: 300,
    faqItems: 50,
    faqQuestion: 300,
    faqAnswer: 1000,
    languagesMax: 6,
    /** Название объекта у бота обязательно и не длиннее 120 знаков */ objectName: 120
};
const DEFAULT_SELLER_PROFILE = {
    botName: null,
    addressForm: 'FORMAL',
    emoji: 'NEVER',
    replyLength: 'SHORT',
    languages: [
        'ru',
        'kk',
        'en',
        'zh'
    ],
    greeting: '',
    includedInPrice: '',
    extraCharges: '',
    houseRules: '',
    prohibitions: [],
    callHumanWhen: [],
    faq: []
};
const TEXT_FIELDS = [
    [
        'greeting',
        'Приветствие'
    ],
    [
        'includedInPrice',
        'Что входит в цену'
    ],
    [
        'extraCharges',
        'Что за доплату'
    ],
    [
        'houseRules',
        'Правила проживания'
    ]
];
const LIST_FIELDS = [
    [
        'prohibitions',
        'Запреты'
    ],
    [
        'callHumanWhen',
        'Когда звать человека'
    ]
];
/** Нулевой символ PostgreSQL в тексте не хранит — вычищается, края обрезаются */ const clean = (value)=>typeof value === 'string' ? value.replaceAll('\u0000', '').trim() : '';
const oneOf = (value, allowed)=>typeof value === 'string' && Object.hasOwn(allowed, value);
function parseSellerProfile(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {
        ok: false,
        errors: [
            'Профиль: ожидается объект'
        ]
    };
    const input = raw;
    const errors = [];
    const has = (key)=>input[key] !== undefined;
    const botName = has('botName') ? clean(input.botName) : '';
    if (botName.length > SELLER_PROFILE_LIMITS.botName) errors.push(`Имя бота: не длиннее ${SELLER_PROFILE_LIMITS.botName} знаков`);
    const addressForm = has('addressForm') ? input.addressForm : DEFAULT_SELLER_PROFILE.addressForm;
    if (!oneOf(addressForm, SELLER_ADDRESS_FORMS)) errors.push('Обращение: «вы» или «ты»');
    const emoji = has('emoji') ? input.emoji : DEFAULT_SELLER_PROFILE.emoji;
    if (!oneOf(emoji, SELLER_EMOJI)) errors.push('Эмодзи: без эмодзи, изредка или только в приветствии');
    const replyLength = has('replyLength') ? input.replyLength : DEFAULT_SELLER_PROFILE.replyLength;
    if (!oneOf(replyLength, SELLER_REPLY_LENGTHS)) errors.push('Длина реплик: коротко или развёрнуто');
    const languages = [];
    const rawLanguages = has('languages') ? input.languages : DEFAULT_SELLER_PROFILE.languages;
    if (!Array.isArray(rawLanguages)) errors.push('Языки: ожидается список');
    else {
        for (const item of rawLanguages){
            const code = clean(item).toLowerCase();
            if (!Object.hasOwn(SELLER_LANGUAGES, code)) {
                errors.push(`Языки: неизвестный код «${code}»`);
                continue;
            }
            if (!languages.includes(code)) languages.push(code);
        }
        if (rawLanguages.length === 0) errors.push('Языки: нужен хотя бы один');
        else if (languages.length > SELLER_PROFILE_LIMITS.languagesMax) errors.push(`Языки: не больше ${SELLER_PROFILE_LIMITS.languagesMax}`);
    }
    const texts = {};
    for (const [field, label] of TEXT_FIELDS){
        const value = has(field) ? clean(input[field]) : '';
        const max = SELLER_PROFILE_LIMITS[field];
        if (value.length > max) errors.push(`${label}: не длиннее ${max} знаков`);
        texts[field] = value;
    }
    const lists = {};
    for (const [field, label] of LIST_FIELDS){
        const rawList = has(field) ? input[field] : [];
        if (!Array.isArray(rawList)) {
            errors.push(`${label}: ожидается список`);
            lists[field] = [];
            continue;
        }
        // пустая строка формы — не правило, а незаполненное поле
        const items = rawList.map(clean).filter((item)=>item !== '');
        if (items.length > SELLER_PROFILE_LIMITS.listItems) errors.push(`${label}: не больше ${SELLER_PROFILE_LIMITS.listItems} строк`);
        items.forEach((item, i)=>{
            if (item.length > SELLER_PROFILE_LIMITS.listItem) errors.push(`${label}, строка ${i + 1}: не длиннее ${SELLER_PROFILE_LIMITS.listItem} знаков`);
        });
        lists[field] = items;
    }
    const faq = [];
    const rawFaq = has('faq') ? input.faq : [];
    if (!Array.isArray(rawFaq)) errors.push('Частые вопросы: ожидается список');
    else {
        const rows = rawFaq.map((row)=>{
            const r = row && typeof row === 'object' ? row : {};
            return {
                question: clean(r.question),
                answer: clean(r.answer)
            };
        })// строка, где не заполнено ничего, — пустая строка формы, а не ошибка
        .filter((r)=>r.question !== '' || r.answer !== '');
        if (rows.length > SELLER_PROFILE_LIMITS.faqItems) errors.push(`Частые вопросы: не больше ${SELLER_PROFILE_LIMITS.faqItems}`);
        rows.forEach((r, i)=>{
            const line = `Частые вопросы, строка ${i + 1}`;
            if (r.question === '' || r.answer === '') errors.push(`${line}: нужны и вопрос, и ответ`);
            else if (r.question.length > SELLER_PROFILE_LIMITS.faqQuestion) errors.push(`${line}: вопрос не длиннее ${SELLER_PROFILE_LIMITS.faqQuestion} знаков`);
            else if (r.answer.length > SELLER_PROFILE_LIMITS.faqAnswer) errors.push(`${line}: ответ не длиннее ${SELLER_PROFILE_LIMITS.faqAnswer} знаков`);
            faq.push(r);
        });
    }
    if (errors.length > 0) return {
        ok: false,
        errors
    };
    return {
        ok: true,
        value: {
            botName: botName === '' ? null : botName,
            addressForm: addressForm,
            emoji: emoji,
            replyLength: replyLength,
            languages,
            ...texts,
            ...lists,
            faq
        }
    };
}
function pickSellerProfile(row) {
    return {
        botName: row.botName,
        addressForm: row.addressForm,
        emoji: row.emoji,
        replyLength: row.replyLength,
        languages: [
            ...row.languages
        ],
        greeting: row.greeting,
        includedInPrice: row.includedInPrice,
        extraCharges: row.extraCharges,
        houseRules: row.houseRules,
        prohibitions: [
            ...row.prohibitions
        ],
        callHumanWhen: [
            ...row.callHumanWhen
        ],
        faq: row.faq.map((f)=>({
                question: f.question,
                answer: f.answer
            }))
    };
}
function sellerProfilePayload(profile, objectName) {
    return {
        object_name: objectName.trim().slice(0, SELLER_PROFILE_LIMITS.objectName),
        bot_name: profile.botName,
        address_form: profile.addressForm === 'INFORMAL' ? 'ty' : 'vy',
        emoji: profile.emoji.toLowerCase(),
        reply_length: profile.replyLength.toLowerCase(),
        languages: profile.languages.map((code)=>(SELLER_LANGUAGES[code] ?? code).toLowerCase()),
        greeting: profile.greeting,
        included_in_price: profile.includedInPrice,
        extra_charges: profile.extraCharges,
        house_rules: profile.houseRules,
        prohibitions: [
            ...profile.prohibitions
        ],
        call_human_when: [
            ...profile.callHumanWhen
        ],
        faq: profile.faq.map((f)=>({
                q: f.question,
                a: f.answer
            }))
    };
}
}),
"[project]/wt-personnel/packages/domain/src/assistant/index.ts [app-ssr] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$assistant$2f$user$2d$errors$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/assistant/user-errors.ts [app-ssr] (ecmascript)");
;
;
}),
"[project]/wt-personnel/packages/domain/src/assistant/user-errors.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "USER_ERRORS_RETENTION_DAYS",
    ()=>USER_ERRORS_RETENTION_DAYS,
    "UserErrorDedupe",
    ()=>UserErrorDedupe,
    "isUserErrorRecorded",
    ()=>isUserErrorRecorded,
    "userErrorMessage",
    ()=>userErrorMessage,
    "userErrorSection",
    ()=>userErrorSection,
    "userErrorsCutoff",
    ()=>userErrorsCutoff
]);
/**
 * Журнал ошибок, которые видит человек (DATA_MODEL §14, ТЗ ред. 1, П3; ADR-079). ИИ-помощник читает его, чтобы
 * ответить «что у меня сломалось»: раздел, код, текст — ровно то, что получил человек.
 *
 * В строку идут шаблон маршрута и текст ответа, который API отдал сам. Тела запроса, значений из адреса и данных
 * гостей нет по построению; текст проходит ту же маску, что неисправности (почта, телефоны, секреты).
 */ var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$incidents$2f$redact$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/incidents/redact.ts [app-ssr] (ecmascript)");
;
const USER_ERRORS_RETENTION_DAYS = 30;
const DAY_MS = 86_400_000;
const MESSAGE_MAX = 500;
/** Что отвечает Nest на необработанное исключение — его и видит человек */ const NEST_INTERNAL = 'Internal server error';
/** Разделы стойки по префиксу маршрута API: сначала частные, потом общие. Имена — как в меню стойки */ const SECTIONS = [
    [
        '/hotel/onboarding',
        'Настройка отеля'
    ],
    [
        '/hotel/reservations',
        'Брони'
    ],
    [
        '/hotel/channel-report',
        'Менеджер каналов'
    ],
    [
        '/hotel',
        'Настройки объекта'
    ],
    [
        '/reservations',
        'Брони'
    ],
    [
        '/chessboard',
        'Шахматка'
    ],
    [
        '/availability',
        'Доступность номеров'
    ],
    [
        '/rates',
        'Тарифы'
    ],
    [
        '/rate-plans',
        'Тарифы'
    ],
    [
        '/guests',
        'Гости'
    ],
    [
        '/finance',
        'Оплаты'
    ],
    [
        '/desk',
        'Главная'
    ],
    [
        '/units',
        'Номера'
    ],
    [
        '/inventory',
        'Номерной фонд'
    ],
    [
        '/channels',
        'Менеджер каналов'
    ],
    [
        '/analytics',
        'Сайт и онлайн-бронирование'
    ],
    [
        '/guard',
        'Неисправности'
    ],
    [
        '/audit',
        'Журнал действий'
    ],
    [
        '/auth',
        'Вход и учётная запись'
    ],
    [
        '/system',
        'Система'
    ],
    [
        '/ai-seller',
        'ИИ-продавец'
    ]
];
/** Маршруты помощника в журнал не пишутся: «подпись не настроена» иначе попадала бы туда на каждой странице */ const SKIPPED_PREFIX = '/assistant';
const underPrefix = (route, prefix)=>route === prefix || route.startsWith(`${prefix}/`);
function userErrorSection(route) {
    for (const [prefix, section] of SECTIONS)if (underPrefix(route, prefix)) return section;
    return 'Прочее';
}
function userErrorMessage(response) {
    let text = null;
    if (typeof response === 'string') text = response;
    else if (response && typeof response === 'object' && 'message' in response) {
        const message = response.message;
        if (typeof message === 'string') text = message;
        else if (Array.isArray(message)) text = message.filter((m)=>typeof m === 'string').join('; ');
    }
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$incidents$2f$redact$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["redactText"])(text && text.trim() !== '' ? text : NEST_INTERNAL, MESSAGE_MAX);
}
function isUserErrorRecorded(status, route) {
    if (!Number.isInteger(status) || status < 400 || status > 599) return false;
    if (route === '') return false;
    return !underPrefix(route, SKIPPED_PREFIX);
}
function userErrorsCutoff(now) {
    return new Date(now.getTime() - USER_ERRORS_RETENTION_DAYS * DAY_MS);
}
class UserErrorDedupe {
    windowMs;
    maxEntries;
    seen;
    constructor(windowMs = 60_000, maxEntries = 5_000){
        this.windowMs = windowMs;
        this.maxEntries = maxEntries;
        this.seen = new Map();
    }
    get size() {
        return this.seen.size;
    }
    /** `true` — ошибку пора писать; отметка ставится сразу */ firstSeen(key, nowMs) {
        const id = [
            key.userId,
            key.method,
            key.route,
            key.status,
            key.message
        ].join('\u0000');
        const last = this.seen.get(id);
        if (last !== undefined && nowMs - last < this.windowMs) return false;
        this.seen.delete(id);
        this.seen.set(id, nowMs);
        if (this.seen.size > this.maxEntries) this.prune(nowMs);
        return true;
    }
    prune(nowMs) {
        for (const [id, at] of this.seen)if (nowMs - at >= this.windowMs) this.seen.delete(id);
        // все отметки свежие, а предел превышен — уходят самые старые (Map хранит порядок вставки)
        while(this.seen.size > this.maxEntries){
            const oldest = this.seen.keys().next().value;
            if (oldest === undefined) break;
            this.seen.delete(oldest);
        }
    }
}
}),
"[project]/wt-personnel/packages/domain/src/availability/availability.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "availableUnitsForStay",
    ()=>availableUnitsForStay,
    "capStayAvailability",
    ()=>capStayAvailability
]);
/**
 * Доступность ячеек для проживания [arrival, departure): ячейка подходит, только если свободна КАЖДУЮ ночь
 * и не заблокирована. Это число уходит в Channex как availability по категории (docs/channex/how-channex-works-for-us.md §2).
 * Чистая функция поверх buildChessboard; итоговую гарантию от овербукинга даёт БД (exclusion constraint).
 */ var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$chessboard$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/chessboard/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$chessboard$2f$build$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/chessboard/build.ts [app-ssr] (ecmascript)");
;
const addDays = (d, n)=>{
    const x = new Date(`${d}T00:00:00Z`);
    x.setUTCDate(x.getUTCDate() + n);
    return x.toISOString().slice(0, 10);
};
function capStayAvailability(stay, perNightByCategory) {
    const byCategory = {};
    let available = 0;
    for (const [code, cat] of Object.entries(stay.byCategory)){
        const nights = perNightByCategory.get(code);
        const channel = nights && nights.size ? Math.min(...nights.values()) : cat.available;
        const capped = {
            ...cat,
            available: Math.min(cat.available, Math.max(0, channel))
        };
        byCategory[code] = capped;
        available += capped.available;
    }
    return {
        ...stay,
        total: {
            ...stay.total,
            available
        },
        byCategory
    };
}
function availableUnitsForStay(input) {
    if (input.departureDate <= input.arrivalDate) {
        throw new Error(`Проживание должно содержать хотя бы одну ночь: заезд ${input.arrivalDate}, выезд ${input.departureDate}`);
    }
    const lastNight = addDays(input.departureDate, -1);
    const board = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$chessboard$2f$build$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildChessboard"])({
        ...input,
        from: input.arrivalDate,
        to: lastNight
    });
    const byCategory = {};
    let available = 0;
    for (const row of board.rows){
        const cat = byCategory[row.unit.accommodationTypeCode] ?? (byCategory[row.unit.accommodationTypeCode] = {
            units: 0,
            available: 0,
            availableUnitCodes: []
        });
        cat.units += 1;
        if (row.cells.every((c)=>c.state === 'FREE')) {
            cat.available += 1;
            cat.availableUnitCodes.push(row.unit.code);
            available += 1;
        }
    }
    return {
        arrivalDate: input.arrivalDate,
        departureDate: input.departureDate,
        nights: board.dates.length,
        total: {
            units: board.rows.length,
            available
        },
        byCategory
    };
}
}),
"[project]/wt-personnel/packages/domain/src/availability/category.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "categoryAvailability",
    ()=>categoryAvailability
]);
/**
 * Доступность категории для каналов продаж (DATA_MODEL §7): на каждую ночь
 * активные ячейки − заблокированные ячейки − проданные проживания (назначена ячейка или нет).
 * Не путать с «свободными ячейками» шахматки: проживание без ячейки здесь уже продано.
 */ var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$chessboard$2f$build$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/chessboard/build.ts [app-ssr] (ecmascript)");
;
function categoryAvailability(input) {
    const dates = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$chessboard$2f$build$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["dateRange"])(input.from, input.to);
    const out = new Map();
    for (const u of input.units){
        const perDate = new Map();
        for (const d of dates){
            const blocked = new Set(input.blocks.filter((b)=>b.accommodationTypeCode === u.code && b.dateFrom <= d && d < b.dateTo).map((b, index)=>b.unitId ?? index)).size;
            const sold = input.items.filter((i)=>i.accommodationTypeCode === u.code && i.arrivalDate <= d && d < i.departureDate).length;
            perDate.set(d, Math.max(0, u.active - blocked - sold));
        }
        out.set(u.code, perDate);
    }
    return out;
}
}),
"[project]/wt-personnel/packages/domain/src/availability/index.ts [app-ssr] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$availability$2f$availability$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/availability/availability.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$availability$2f$category$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/availability/category.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$availability$2f$stay$2d$offer$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/availability/stay-offer.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$availability$2f$nearest$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/availability/nearest.ts [app-ssr] (ecmascript)");
;
;
;
;
;
}),
"[project]/wt-personnel/packages/domain/src/availability/nearest.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Ближайшая доступность для экрана «Свободные места» (ADR-110, ТЗ §7, шаг AV4): «с 1-го нет, но есть с 3-го».
 * Своего правила нет: тот же срок сдвигается вперёд по дню, и каждое окно считается так же, как
 * `GET /availability` — `sellableStay`. Глубина поиска — параметр интерфейса, не бизнес-правило (ТЗ §7).
 */ __turbopack_context__.s([
    "NEAREST_DAYS_DEFAULT",
    ()=>NEAREST_DAYS_DEFAULT,
    "nearestAvailability",
    ()=>nearestAvailability,
    "sellableStay",
    ()=>sellableStay
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$availability$2f$availability$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/availability/availability.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$availability$2f$category$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/availability/category.ts [app-ssr] (ecmascript)");
;
;
const NEAREST_DAYS_DEFAULT = 14;
const addDays = (d, n)=>{
    const x = new Date(`${d}T00:00:00Z`);
    x.setUTCDate(x.getUTCDate() + n);
    return x.toISOString().slice(0, 10);
};
function sellableStay(input) {
    const stay = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$availability$2f$availability$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["availableUnitsForStay"])({
        arrivalDate: input.arrivalDate,
        departureDate: input.departureDate,
        units: input.units,
        allocations: input.allocations,
        blocks: input.blocks
    });
    const unitCategory = new Map(input.units.map((u)=>[
            u.id,
            u.accommodationTypeCode
        ]));
    const active = new Map();
    for (const u of input.units)active.set(u.accommodationTypeCode, (active.get(u.accommodationTypeCode) ?? 0) + 1);
    const perNight = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$availability$2f$category$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["categoryAvailability"])({
        from: input.arrivalDate,
        to: addDays(input.departureDate, -1),
        units: [
            ...active
        ].map(([code, count])=>({
                code,
                active: count
            })),
        blocks: input.blocks.map((b)=>({
                unitId: b.unitId,
                accommodationTypeCode: unitCategory.get(b.unitId) ?? '',
                dateFrom: b.dateFrom,
                dateTo: b.dateTo
            })),
        items: input.sold
    });
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$availability$2f$availability$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["capStayAvailability"])(stay, perNight);
}
function nearestAvailability(input) {
    const out = {};
    const pending = new Set(Object.keys(input.need));
    for(let shift = 0; shift <= input.days && pending.size; shift += 1){
        const arrivalDate = addDays(input.arrivalDate, shift);
        const departureDate = addDays(input.departureDate, shift);
        const window = sellableStay({
            ...input,
            arrivalDate,
            departureDate
        });
        for (const code of [
            ...pending
        ])if ((window.byCategory[code]?.available ?? 0) >= input.need[code]) {
            out[code] = {
                arrivalDate,
                departureDate
            };
            pending.delete(code);
        }
    }
    for (const code of pending)out[code] = null;
    return out;
}
}),
"[project]/wt-personnel/packages/domain/src/availability/stay-offer.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "stayOffer",
    ()=>stayOffer
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$reservations$2f$reservations$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/reservations/reservations.ts [app-ssr] (ecmascript)");
;
function stayOffer(input) {
    const eligible = [];
    for (const plan of input.plans){
        if (plan.currency !== input.currency) continue;
        try {
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$reservations$2f$reservations$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["assertRestrictionsAllow"])({
                arrivalDate: input.arrivalDate,
                departureDate: input.departureDate,
                categoryName: input.categoryName,
                restrictions: plan.restrictions
            });
        } catch (e) {
            if (e instanceof __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$reservations$2f$reservations$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["RestrictionViolationError"]) continue;
            throw e;
        }
        let price;
        try {
            price = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$reservations$2f$reservations$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["priceStay"])({
                arrivalDate: input.arrivalDate,
                departureDate: input.departureDate,
                occupancy: input.occupancy,
                rates: [
                    ...plan.rates
                ]
            });
        } catch (e) {
            if (e instanceof __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$reservations$2f$reservations$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ReservationRuleError"]) continue;
            throw e;
        }
        eligible.push({
            code: plan.code,
            totalMinor: price.totalMinor * BigInt(input.units),
            perNightMinor: price.nights.reduce((min, n)=>n.priceMinor < min ? n.priceMinor : min, price.nights[0].priceMinor)
        });
    }
    if (!eligible.length) return null;
    const cheapest = eligible.reduce((a, b)=>b.totalMinor < a.totalMinor ? b : a);
    return {
        plans: eligible.length,
        totalMinor: cheapest.totalMinor,
        perNightMinor: eligible.reduce((min, p)=>p.perNightMinor < min ? p.perNightMinor : min, eligible[0].perNightMinor),
        ratePlanCode: cheapest.code,
        currency: input.currency
    };
}
}),
"[project]/wt-personnel/packages/domain/src/bar/index.ts [app-ssr] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
;
;
}),
"[project]/wt-personnel/packages/domain/src/beauty/access.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/** Owner-approved BEAUTY-ACCESS-20261018. Names are labels, only explicit grants authorize. */ __turbopack_context__.s([
    "BEAUTY_ACTIONS",
    ()=>BEAUTY_ACTIONS,
    "BEAUTY_ACTION_LABELS",
    ()=>BEAUTY_ACTION_LABELS,
    "BEAUTY_SECTIONS",
    ()=>BEAUTY_SECTIONS,
    "BEAUTY_SECTION_LABELS",
    ()=>BEAUTY_SECTION_LABELS,
    "beautyPermissionScope",
    ()=>beautyPermissionScope,
    "parseBeautyPermissions",
    ()=>parseBeautyPermissions,
    "resolveBeautyPositionAccess",
    ()=>resolveBeautyPositionAccess
]);
const BEAUTY_SECTIONS = [
    'journal',
    'appointments',
    'customers',
    'employees',
    'services',
    'finance',
    'stock',
    'settings',
    'payroll',
    'reviews'
];
const BEAUTY_ACTIONS = [
    'view',
    'create',
    'update',
    'delete',
    'refund'
];
const BEAUTY_SECTION_LABELS = {
    journal: 'Календарь и график',
    appointments: 'Записи',
    customers: 'Клиенты',
    employees: 'Сотрудники',
    services: 'Услуги и техкарты',
    finance: 'Финансы',
    stock: 'Склад',
    settings: 'Настройки салона',
    payroll: 'Зарплата',
    reviews: 'Отзывы'
};
const BEAUTY_ACTION_LABELS = {
    view: 'Просмотр',
    create: 'Создание',
    update: 'Изменение',
    delete: 'Удаление',
    refund: 'Возврат'
};
const OWN_SECTIONS = new Set([
    'journal',
    'appointments',
    'payroll',
    'reviews'
]);
function parseBeautyPermissions(raw) {
    if (!Array.isArray(raw) || raw.length > BEAUTY_SECTIONS.length * 4 + 1) return {
        ok: false,
        reason: 'Пришлите список прав должности'
    };
    const value = [];
    const seen = new Set();
    for (const entry of raw){
        if (!entry || typeof entry !== 'object' || Array.isArray(entry) || Object.keys(entry).some((key)=>![
                'section',
                'action',
                'scope'
            ].includes(key))) return {
            ok: false,
            reason: 'Проверьте поля права должности'
        };
        const { section, action, scope } = entry;
        if (!BEAUTY_SECTIONS.includes(section) || !BEAUTY_ACTIONS.includes(action) || typeof scope !== 'string' || ![
            'OWN',
            'BUSINESS'
        ].includes(scope)) return {
            ok: false,
            reason: 'Неизвестный раздел, действие или область доступа'
        };
        const permission = {
            section,
            action,
            scope
        };
        if (action === 'refund' && (section !== 'finance' || scope !== 'BUSINESS')) return {
            ok: false,
            reason: 'Возврат разрешается отдельным правом финансов'
        };
        if (scope === 'OWN' && (action !== 'view' || !OWN_SECTIONS.has(permission.section))) return {
            ok: false,
            reason: 'Своя область доступна только для просмотра записей, графика, зарплаты и отзывов'
        };
        const key = `${section}:${action}`;
        if (seen.has(key)) return {
            ok: false,
            reason: 'Право раздела повторяется'
        };
        seen.add(key);
        value.push(permission);
    }
    return {
        ok: true,
        value
    };
}
function beautyPermissionScope(permissions, section, action) {
    const matches = permissions.filter((permission)=>permission.section === section && permission.action === action);
    return matches.some((permission)=>permission.scope === 'BUSINESS') ? 'BUSINESS' : matches.some((permission)=>permission.scope === 'OWN') ? 'OWN' : null;
}
function resolveBeautyPositionAccess(assignments, target) {
    if (!assignments.length) return {
        mode: 'LEGACY',
        assigned: false,
        permissions: []
    };
    const applicable = assignments.filter((row)=>row.revokedAt === null && row.position.archivedAt === null && row.businessId === target.businessId && (row.locationId === null || row.locationId === target.locationId));
    const grants = new Map();
    for (const row of applicable)for (const permission of row.position.permissions){
        const key = `${permission.section}:${permission.action}`;
        if (grants.get(key)?.scope !== 'BUSINESS') grants.set(key, {
            ...permission
        });
    }
    return {
        mode: 'ASSIGNED',
        assigned: applicable.length > 0,
        permissions: [
            ...grants.values()
        ]
    };
}
}),
"[project]/wt-personnel/packages/domain/src/beauty/appointments.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "NO_SHOW_BEFORE_START_MESSAGE",
    ()=>NO_SHOW_BEFORE_START_MESSAGE,
    "nextStatuses",
    ()=>nextStatuses,
    "parseAppointmentInput",
    ()=>parseAppointmentInput,
    "planAppointment",
    ()=>planAppointment,
    "statusChange",
    ()=>statusChange
]);
/**
 * Запись клиента к мастеру: правила, которых нет в базе (DATA_MODEL §19.1, срез B5).
 *
 * Пересечение записей одного мастера держит сама база (`EXCLUDE USING gist` на `appointments`), поэтому
 * здесь его нет. Здесь то, чего база не знает: продаётся ли услуга в этом филиале, попадает ли время в
 * график мастера, не стоит ли на этот день отсутствие, и какой снимок цены уходит в запись.
 *
 * Деньги целыми тиынами (ADR-008). Цена записи это **снимок на момент записи**, не ссылка на каталог:
 * прайс завтра поменяется, а записанный клиент придёт по вчерашней цене.
 */ var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$beauty$2f$beauty$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/beauty/beauty.ts [app-ssr] (ecmascript)");
;
const NAME_LIMIT = 100;
const PHONE_LIMIT = 32;
const NOTES_LIMIT = 2000;
function planAppointment(input) {
    const { startsAt, timezone, service, locationCurrency, locationService } = input;
    const effective = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$beauty$2f$beauty$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["effectiveService"])({
        service,
        locationCurrency,
        locationService
    });
    if (!effective.sellable) {
        const reason = effective.reason === 'SERVICE_INACTIVE' ? 'Услуга в архиве' : effective.reason === 'NOT_ENABLED' ? 'Филиал эту услугу не оказывает' : 'У услуги нет цены в валюте филиала';
        return {
            ok: false,
            reason
        };
    }
    const endsAt = new Date(startsAt.getTime() + effective.durationMinutes * 60_000);
    const fit = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$beauty$2f$beauty$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fitsSchedule"])({
        startsAt,
        endsAt,
        timezone,
        workingHours: input.workingHours,
        timeOffs: input.timeOffs
    });
    if (!fit.ok) return {
        ok: false,
        reason: fit.reason === 'TIME_OFF' ? 'У мастера в этот день отсутствие' : 'Мастер в это время не работает'
    };
    return {
        ok: true,
        value: {
            startsAt,
            endsAt,
            priceMinor: effective.priceMinor,
            currency: effective.currency,
            durationMinutes: effective.durationMinutes
        }
    };
}
// ───────────── жизнь записи ─────────────
/**
 * Куда запись может перейти из текущего состояния.
 *
 * Выполненная, отменённая и незаезд это конец пути: вернуть их обратно нельзя. Так осторожнее, потому что
 * за выполненной записью стоят деньги, а решения по ним ещё нет (Q-252). Понадобится «вернуть» (ошиблись
 * кнопкой) это отдельное решение владельца, а не тихое послабление здесь.
 */ const NEXT = {
    BOOKED: [
        'CONFIRMED',
        'IN_PROGRESS',
        'DONE',
        'NO_SHOW',
        'CANCELLED'
    ],
    CONFIRMED: [
        'IN_PROGRESS',
        'DONE',
        'NO_SHOW',
        'CANCELLED'
    ],
    // клиент пришёл, мастер работает (§58): незаезда уже не бывает
    IN_PROGRESS: [
        'DONE',
        'CANCELLED'
    ],
    DONE: [],
    NO_SHOW: [],
    CANCELLED: []
};
const NO_SHOW_BEFORE_START_MESSAGE = 'Можно после начала визита';
function nextStatuses(from, time) {
    const next = NEXT[from] ?? [];
    return time && time.now < time.startsAt ? next.filter((status)=>status !== 'NO_SHOW') : next;
}
function statusChange(from, to, time) {
    if (from === to) return {
        ok: false,
        reason: 'Запись уже в этом состоянии'
    };
    if (!nextStatuses(from).includes(to)) return {
        ok: false,
        reason: 'Из этого состояния запись так не меняют'
    };
    if (to === 'NO_SHOW' && time && time.now < time.startsAt) return {
        ok: false,
        reason: NO_SHOW_BEFORE_START_MESSAGE
    };
    return {
        ok: true
    };
}
function parseAppointmentInput(raw) {
    const body = raw ?? {};
    const rawItems = Array.isArray(body['items']) ? body['items'] : [
        {
            employeeId: body['employeeId'],
            serviceId: body['serviceId']
        }
    ];
    if (rawItems.length === 0) return {
        ok: false,
        reason: 'Добавьте хотя бы одну услугу'
    };
    const items = [];
    for (const rawItem of rawItems){
        const item = rawItem ?? {};
        const employeeId = text(item['employeeId']);
        if (!employeeId) return {
            ok: false,
            reason: 'Выберите мастера'
        };
        const serviceId = text(item['serviceId']);
        if (!serviceId) return {
            ok: false,
            reason: 'Выберите услугу'
        };
        const durationMinutes = optionalPositiveInteger(item['durationMinutes']);
        if (durationMinutes === false) return {
            ok: false,
            reason: 'Длительность услуги должна быть целым числом минут'
        };
        const basePriceMinor = optionalMoney(item['basePriceMinor']);
        if (basePriceMinor === false) return {
            ok: false,
            reason: 'Цена услуги должна быть целым числом в минимальных единицах'
        };
        const discountMinor = optionalMoney(item['discountMinor']);
        if (discountMinor === false) return {
            ok: false,
            reason: 'Скидка должна быть целым числом в минимальных единицах'
        };
        const surchargeMinor = optionalMoney(item['surchargeMinor']);
        if (surchargeMinor === false) return {
            ok: false,
            reason: 'Доплата должна быть целым числом в минимальных единицах'
        };
        const discountPercent = optionalPercent(item['discountPercent']);
        if (discountPercent === false) return {
            ok: false,
            reason: 'Скидка должна быть целым процентом от 0 до 100'
        };
        if (discountPercent !== null && discountMinor !== null) return {
            ok: false,
            reason: 'Укажите скидку суммой или процентом'
        };
        items.push({
            employeeId,
            serviceId,
            durationMinutes,
            basePriceMinor,
            discountMinor: discountMinor ?? 0n,
            discountPercent,
            surchargeMinor: surchargeMinor ?? 0n
        });
    }
    const rawStart = text(body['startsAt']);
    if (!rawStart) return {
        ok: false,
        reason: 'Укажите время записи'
    };
    const startsAt = new Date(rawStart);
    if (Number.isNaN(startsAt.getTime())) return {
        ok: false,
        reason: 'Время записи не разобрать'
    };
    const customerId = text(body['customerId']);
    const firstName = text(body['firstName']);
    if (!customerId && !firstName) return {
        ok: false,
        reason: 'Выберите клиента или впишите имя'
    };
    if (firstName.length > NAME_LIMIT) return {
        ok: false,
        reason: `Имя клиента: не больше ${NAME_LIMIT} символов`
    };
    const lastName = text(body['lastName']);
    if (lastName.length > NAME_LIMIT) return {
        ok: false,
        reason: `Фамилия клиента: не больше ${NAME_LIMIT} символов`
    };
    const phone = text(body['phone']);
    if (phone.length > PHONE_LIMIT) return {
        ok: false,
        reason: `Телефон: не больше ${PHONE_LIMIT} символов`
    };
    const notes = text(body['notes']);
    if (notes.length > NOTES_LIMIT) return {
        ok: false,
        reason: 'Заметка слишком длинная'
    };
    return {
        ok: true,
        value: {
            startsAt,
            items,
            customer: customerId ? {
                kind: 'existing',
                id: customerId
            } : {
                kind: 'new',
                firstName,
                lastName: lastName || null,
                phone: phone || null
            },
            notes: notes || null
        }
    };
}
function optionalPositiveInteger(raw) {
    if (raw === undefined || raw === null || raw === '') return null;
    return typeof raw === 'number' && Number.isInteger(raw) && raw > 0 ? raw : false;
}
function optionalPercent(raw) {
    if (raw === undefined || raw === null || raw === '') return null;
    return typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && raw <= 100 ? raw : false;
}
function optionalMoney(raw) {
    if (raw === undefined || raw === null || raw === '') return null;
    if (typeof raw !== 'string' && typeof raw !== 'number' && typeof raw !== 'bigint') return false;
    const value = String(raw);
    if (!/^\d+$/.test(value)) return false;
    return BigInt(value);
}
function text(raw) {
    return typeof raw === 'string' ? raw.trim() : '';
}
}),
"[project]/wt-personnel/packages/domain/src/beauty/beauty.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "appointmentWindow",
    ()=>appointmentWindow,
    "assertTimeOffRange",
    ()=>assertTimeOffRange,
    "effectiveService",
    ()=>effectiveService,
    "fitsSchedule",
    ()=>fitsSchedule
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$beauty$2f$schedule$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/beauty/schedule.ts [app-ssr] (ecmascript)");
;
function effectiveService(input) {
    const { service, locationCurrency, locationService } = input;
    if (!service.active) return {
        sellable: false,
        reason: 'SERVICE_INACTIVE'
    };
    if (!locationService || !locationService.enabled) {
        return {
            sellable: false,
            reason: 'NOT_ENABLED'
        };
    }
    const priceOverride = locationService.priceOverrideMinor ?? null;
    const durationOverride = locationService.durationOverrideMinutes ?? null;
    if (priceOverride === null && service.currency !== locationCurrency) {
        return {
            sellable: false,
            reason: 'CURRENCY_MISMATCH'
        };
    }
    return {
        sellable: true,
        priceMinor: priceOverride ?? service.priceMinor,
        currency: priceOverride === null ? service.currency : locationCurrency,
        durationMinutes: durationOverride ?? service.durationMinutes,
        overridden: priceOverride !== null || durationOverride !== null
    };
}
function appointmentWindow(startsAt, durationMinutes) {
    if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
        throw new Error('Длительность услуги: целое число минут больше нуля');
    }
    return {
        startsAt,
        endsAt: new Date(startsAt.getTime() + durationMinutes * 60_000)
    };
}
function fitsSchedule(input) {
    // Identity and branch assignment are checked by the existing booking/slot caller.
    const result = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$beauty$2f$schedule$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["resolveWorkingTime"])({
        ...input,
        supported: true,
        employeeActive: true,
        worksHere: true
    });
    return result.ok ? result : {
        ok: false,
        reason: result.reason === 'TIME_OFF' ? 'TIME_OFF' : 'OUTSIDE_WORKING_HOURS'
    };
}
function assertTimeOffRange(input) {
    if (input.dateTo < input.dateFrom) {
        throw new Error('Отсутствие: конец раньше начала, проверьте даты');
    }
}
}),
"[project]/wt-personnel/packages/domain/src/beauty/customers.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "BEAUTY_CUSTOMER_IMPORT_MAX_ROWS",
    ()=>BEAUTY_CUSTOMER_IMPORT_MAX_ROWS,
    "BeautyCustomerImportError",
    ()=>BeautyCustomerImportError,
    "normalizeBeautyCustomerPhone",
    ()=>normalizeBeautyCustomerPhone,
    "parseBeautyCustomerInput",
    ()=>parseBeautyCustomerInput,
    "parseBeautyCustomersCsv",
    ()=>parseBeautyCustomersCsv
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$expense$2d$import$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/expense-import.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$web$2d$booking$2f$request$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/web-booking/request.ts [app-ssr] (ecmascript)");
;
;
const BEAUTY_CUSTOMER_IMPORT_MAX_ROWS = 500;
class BeautyCustomerImportError extends Error {
    constructor(message){
        super(message);
        this.name = 'BeautyCustomerImportError';
    }
}
const cleanName = (raw, label, max)=>{
    const value = typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : '';
    if (!value) throw new BeautyCustomerImportError(`${label}: обязательное поле`);
    if (value.length > max) throw new BeautyCustomerImportError(`${label}: не больше ${max} символов`);
    return value;
};
function normalizeBeautyCustomerPhone(raw) {
    const phone = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$web$2d$booking$2f$request$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["normalizePhone"])(raw);
    if (!phone) throw new BeautyCustomerImportError('Телефон: укажите от 10 до 15 цифр');
    return phone;
}
function parseBeautyCustomerInput(raw) {
    if (!raw || typeof raw !== 'object') throw new BeautyCustomerImportError('Заполните данные клиента');
    const input = raw;
    const phone = normalizeBeautyCustomerPhone(input.phone);
    if (typeof input.name === 'string') {
        const fullName = cleanName(input.name, 'Имя', 100);
        return {
            firstName: fullName,
            lastName: null,
            fullName,
            phone
        };
    }
    const firstName = cleanName(input.firstName, 'Имя', 100);
    const lastName = typeof input.lastName === 'string' && input.lastName.trim() ? cleanName(input.lastName, 'Фамилия', 100) : null;
    return {
        firstName,
        lastName,
        fullName: [
            firstName,
            lastName
        ].filter(Boolean).join(' '),
        phone
    };
}
function parseBeautyCustomersCsv(text) {
    if (typeof text !== 'string') throw new BeautyCustomerImportError('Выберите CSV-файл');
    const body = text.replace(/^\uFEFF/, '');
    const firstLine = body.split(/\r?\n/, 1)[0] ?? '';
    const records = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$expense$2d$import$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["splitRecords"])(body, (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$expense$2d$import$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["delimiterOf"])(firstLine));
    const [header = [], ...rest] = records;
    const names = header.map((cell)=>cell.trim().toLowerCase());
    const nameAt = names.indexOf('имя');
    const phoneAt = names.indexOf('телефон');
    if (nameAt < 0) throw new BeautyCustomerImportError('В файле нет колонки «Имя»');
    if (phoneAt < 0) throw new BeautyCustomerImportError('В файле нет колонки «Телефон»');
    const lines = rest.map((cells, index)=>({
            cells,
            line: index + 2
        })).filter(({ cells })=>cells.some((cell)=>cell.trim() !== ''));
    if (lines.length === 0) throw new BeautyCustomerImportError('В файле нет ни одного клиента');
    if (lines.length > BEAUTY_CUSTOMER_IMPORT_MAX_ROWS) {
        throw new BeautyCustomerImportError(`За раз не больше ${BEAUTY_CUSTOMER_IMPORT_MAX_ROWS} строк, в файле ${lines.length}`);
    }
    const rows = [];
    const errors = [];
    for (const { cells, line } of lines){
        try {
            const parsed = parseBeautyCustomerInput({
                name: cells[nameAt] ?? '',
                phone: cells[phoneAt] ?? ''
            });
            rows.push({
                line,
                name: parsed.fullName,
                phone: parsed.phone
            });
        } catch (error) {
            if (!(error instanceof BeautyCustomerImportError)) throw error;
            errors.push(`Строка ${line}: ${error.message}`);
        }
    }
    if (errors.length > 0) {
        const shown = errors.slice(0, 10);
        if (errors.length > 10) shown.push(`и ещё ${errors.length - 10} строк с ошибками`);
        throw new BeautyCustomerImportError(`Файл не загружен, ничего не записано:\n${shown.join('\n')}`);
    }
    return rows;
}
}),
"[project]/wt-personnel/packages/domain/src/beauty/index.ts [app-ssr] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$beauty$2f$beauty$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/beauty/beauty.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$beauty$2f$schedule$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/beauty/schedule.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$beauty$2f$appointments$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/beauty/appointments.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$beauty$2f$slots$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/beauty/slots.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$beauty$2f$customers$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/beauty/customers.ts [app-ssr] (ecmascript)");
;
;
;
;
;
;
;
;
}),
"[project]/wt-personnel/packages/domain/src/beauty/schedule.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "dayOffsetUtc",
    ()=>dayOffsetUtc,
    "parseTimeOffInput",
    ()=>parseTimeOffInput,
    "parseWorkingHoursWeek",
    ()=>parseWorkingHoursWeek,
    "resolveWorkingTime",
    ()=>resolveWorkingTime,
    "timeOffWindow",
    ()=>timeOffWindow,
    "weekTemplate",
    ()=>weekTemplate
]);
/**
 * График мастера и его отсутствия (DATA_MODEL §19.1, Q-251, срез B4).
 *
 * График это недельный шаблон: строки `working_hours` на мастера и филиал, день недели как у
 * `Date.getDay()` (0 воскресенье). Наложение интервалов в одном дне база не ловит (в §19.1 у
 * `working_hours` только уникальность по началу), поэтому его ловят здесь.
 *
 * Отсутствие (`time_offs`) это календарные даты включительно с обеих сторон и на всю сеть: у таблицы
 * нет филиала, мастер уехал целиком. Отсутствие само записи не отменяет, отмена записи это деньги
 * (Q-252 открыт), поэтому наложение на уже созданные записи только показывается человеку.
 */ var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$property$2f$settings$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/property/settings.ts [app-ssr] (ecmascript)");
;
const REASON_LIMIT = 200;
const INTERVALS_PER_DAY = 4;
const MAX_TIME_OFF_DAYS = 366;
function resolveWorkingTime(input) {
    if (!input.supported) return {
        ok: false,
        reason: 'UNSUPPORTED'
    };
    if (!input.employeeActive) return {
        ok: false,
        reason: 'EMPLOYEE_INACTIVE'
    };
    if (!input.worksHere) return {
        ok: false,
        reason: 'NOT_ASSIGNED'
    };
    const local = (at)=>{
        const p = new Map(fmt(input.timezone).formatToParts(at).map((part)=>[
                part.type,
                part.value
            ]));
        const date = `${p.get('year')}-${p.get('month')}-${p.get('day')}`;
        return {
            date,
            weekday: new Date(`${date}T00:00:00Z`).getUTCDay(),
            minute: Number(p.get('hour')) * 60 + Number(p.get('minute')) + Number(p.get('second')) / 60 + at.getUTCMilliseconds() / 60000
        };
    };
    const start = local(input.startsAt);
    const end = input.endsAt ? local(input.endsAt) : start;
    if (input.timeOffs.some((off)=>off.dateFrom <= start.date && start.date <= off.dateTo || off.dateFrom <= end.date && end.date <= off.dateTo)) return {
        ok: false,
        reason: 'TIME_OFF'
    };
    if (!input.workingHours.length) return {
        ok: false,
        reason: 'NO_SCHEDULE'
    };
    const fits = (!input.endsAt || input.endsAt > input.startsAt) && start.date === end.date && input.workingHours.some((h)=>h.weekday === start.weekday && minutes(h.timeFrom) <= start.minute && start.minute < minutes(h.timeTo) && end.minute <= minutes(h.timeTo));
    return fits ? {
        ok: true
    } : {
        ok: false,
        reason: 'OUTSIDE_WORKING_HOURS'
    };
}
function parseWorkingHoursWeek(raw) {
    const body = raw ?? {};
    const rows = body['intervals'];
    if (!Array.isArray(rows)) return {
        ok: false,
        reason: 'Пришлите график списком интервалов'
    };
    const value = [];
    for (const row of rows){
        const item = row ?? {};
        const weekday = parseWeekday(item['weekday']);
        if (weekday === null) return {
            ok: false,
            reason: 'День недели: число от 0 (воскресенье) до 6'
        };
        const timeFrom = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$property$2f$settings$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["normalizeClockTime"])(item['timeFrom']);
        const timeTo = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$property$2f$settings$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["normalizeClockTime"])(item['timeTo']);
        if (timeFrom === null || timeTo === null) return {
            ok: false,
            reason: 'Время графика в часах и минутах, например 09:00'
        };
        if (minutes(timeTo) <= minutes(timeFrom)) return {
            ok: false,
            reason: 'Конец рабочего времени должен быть позже начала'
        };
        value.push({
            weekday,
            timeFrom,
            timeTo
        });
    }
    value.sort((a, b)=>a.weekday - b.weekday || minutes(a.timeFrom) - minutes(b.timeFrom));
    for(let i = 1; i < value.length; i += 1){
        const prev = value[i - 1];
        const cur = value[i];
        // вплотную можно (09:00-13:00 и 13:00-20:00), внахлёст нельзя
        if (prev.weekday === cur.weekday && minutes(cur.timeFrom) < minutes(prev.timeTo)) return {
            ok: false,
            reason: 'Интервалы в одном дне накладываются друг на друга'
        };
    }
    for(let day = 0; day <= 6; day += 1){
        if (value.filter((i)=>i.weekday === day).length > INTERVALS_PER_DAY) return {
            ok: false,
            reason: 'В одном дне не больше четырёх интервалов'
        };
    }
    return {
        ok: true,
        value
    };
}
function weekTemplate(rows) {
    return [
        1,
        2,
        3,
        4,
        5,
        6,
        0
    ].map((weekday)=>({
            weekday,
            intervals: rows.filter((r)=>r.weekday === weekday).slice().sort((a, b)=>minutes(a.timeFrom) - minutes(b.timeFrom)).map((r)=>({
                    timeFrom: r.timeFrom,
                    timeTo: r.timeTo
                }))
        }));
}
function parseTimeOffInput(raw) {
    const body = raw ?? {};
    const dateFrom = parseDate(body['dateFrom']);
    const dateTo = parseDate(body['dateTo']);
    if (dateFrom === null || dateTo === null) return {
        ok: false,
        reason: 'Дата отсутствия в виде ГГГГ-ММ-ДД'
    };
    if (dateTo < dateFrom) return {
        ok: false,
        reason: 'Отсутствие: конец раньше начала, проверьте даты'
    };
    if (dayDiff(dateFrom, dateTo) + 1 > MAX_TIME_OFF_DAYS) return {
        ok: false,
        reason: 'Отсутствие длиннее года: проверьте даты'
    };
    const rawReason = body['reason'];
    const reason = typeof rawReason === 'string' ? rawReason.trim() : '';
    if (reason.length > REASON_LIMIT) return {
        ok: false,
        reason: `Причина отсутствия: не больше ${REASON_LIMIT} символов`
    };
    return {
        ok: true,
        value: {
            dateFrom,
            dateTo,
            reason: reason || null
        }
    };
}
function timeOffWindow(input) {
    return {
        fromUtc: localMidnightUtc(input.dateFrom, input.timezone),
        toUtcExclusive: localMidnightUtc(dayOffsetUtc(input.dateTo, 1), input.timezone)
    };
}
function dayOffsetUtc(date, days) {
    const at = new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000);
    return at.toISOString().slice(0, 10);
}
// ───────────── местное время филиала ─────────────
/** Момент UTC, в который в этом поясе начинаются сутки `date` */ function localMidnightUtc(date, timezone) {
    const naive = Date.parse(`${date}T00:00:00Z`);
    // смещение зависит от самого момента, поэтому берём его дважды: первая догадка попадает в нужные сутки
    let guess = naive - zoneOffsetMs(new Date(naive), timezone);
    guess = naive - zoneOffsetMs(new Date(guess), timezone);
    return new Date(guess);
}
const fmtCache = new Map();
function fmt(timezone) {
    let f = fmtCache.get(timezone);
    if (!f) {
        f = new Intl.DateTimeFormat('en-CA', {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hourCycle: 'h23'
        });
        fmtCache.set(timezone, f);
    }
    return f;
}
/** Насколько местное время впереди UTC в этот момент, в миллисекундах */ function zoneOffsetMs(at, timezone) {
    const parts = new Map(fmt(timezone).formatToParts(at).map((p)=>[
            p.type,
            p.value
        ]));
    const asUtc = Date.UTC(Number(parts.get('year')), Number(parts.get('month')) - 1, Number(parts.get('day')), Number(parts.get('hour')), Number(parts.get('minute')), Number(parts.get('second')));
    return asUtc - at.getTime();
}
// ───────────── разбор полей ─────────────
function parseWeekday(raw) {
    const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() ? Number(raw) : NaN;
    if (!Number.isInteger(n) || n < 0 || n > 6) return null;
    return n;
}
function parseDate(raw) {
    if (typeof raw !== 'string') return null;
    const text = raw.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
    // «2026-02-30» формату отвечает, а в календаре такого дня нет
    const at = new Date(`${text}T00:00:00Z`);
    if (Number.isNaN(at.getTime()) || at.toISOString().slice(0, 10) !== text) return null;
    return text;
}
function dayDiff(from, to) {
    return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}
function minutes(clock) {
    const [hh, mm] = clock.split(':');
    return Number(hh) * 60 + Number(mm);
}
}),
"[project]/wt-personnel/packages/domain/src/beauty/slots.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "BEAUTY_SLOT_STEP_MINUTES",
    ()=>BEAUTY_SLOT_STEP_MINUTES,
    "freeBeautySlots",
    ()=>freeBeautySlots
]);
/**
 * Свободные окна записи к мастеру для формы сайта (SITE-4, ADR-185, план `plans/site-seo-flow-2026-10-15.md` §2).
 *
 * Правило то же, что у стойки: запись целиком внутри одного интервала графика мастера в этом филиале, не в день его
 * отсутствия (`fitsSchedule`) и не пересекается с его записями, которые занимают место (`BOOKED`, `CONFIRMED`, `DONE`).
 * Окна идут от начала каждого интервала графика с шагом `stepMinutes`; прошедшее время не предлагается. Окончательно
 * место проверяет запись (под замком филиала и `EXCLUDE` базы): окно это подсказка, а не бронь.
 */ var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$beauty$2f$beauty$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/beauty/beauty.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$beauty$2f$schedule$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/beauty/schedule.ts [app-ssr] (ecmascript)");
;
;
const BEAUTY_SLOT_STEP_MINUTES = 15;
function clockMinutes(v) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(v);
    if (!m) return null;
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    return hh > 24 || mm > 59 ? null : hh * 60 + mm;
}
const clock = (minutes)=>`${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
/** День недели календарной даты: 0 воскресенье, как `working_hours.weekday` */ const weekdayOf = (date)=>new Date(`${date}T00:00:00Z`).getUTCDay();
function freeBeautySlots(input) {
    const { date, timezone, durationMinutes, masters, now } = input;
    const step = input.stepMinutes ?? BEAUTY_SLOT_STEP_MINUTES;
    if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) return [];
    if (!Number.isInteger(step) || step <= 0) return [];
    const midnight = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$beauty$2f$schedule$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["timeOffWindow"])({
        dateFrom: date,
        dateTo: date,
        timezone
    }).fromUtc.getTime();
    const weekday = weekdayOf(date);
    const byStart = new Map();
    for (const master of masters){
        for (const h of master.workingHours){
            if (h.weekday !== weekday) continue;
            const from = clockMinutes(h.timeFrom);
            const to = clockMinutes(h.timeTo);
            if (from === null || to === null) continue;
            for(let m = from; m + durationMinutes <= to; m += step){
                const startsAt = new Date(midnight + m * 60_000);
                const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
                if (startsAt.getTime() <= now.getTime()) continue;
                // тот же график, что проверяет запись: местное время, отсутствие, один интервал
                const fit = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$beauty$2f$beauty$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fitsSchedule"])({
                    startsAt,
                    endsAt,
                    timezone,
                    workingHours: master.workingHours,
                    timeOffs: master.timeOffs
                });
                if (!fit.ok) continue;
                if (master.busy.some((b)=>b.startsAt < endsAt && b.endsAt > startsAt)) continue;
                const key = startsAt.getTime();
                const slot = byStart.get(key) ?? {
                    startsAt,
                    endsAt,
                    time: clock(m),
                    employeeIds: []
                };
                if (!slot.employeeIds.includes(master.id)) slot.employeeIds.push(master.id);
                byStart.set(key, slot);
            }
        }
    }
    return [
        ...byStart.values()
    ].sort((a, b)=>a.startsAt.getTime() - b.startsAt.getTime());
}
}),
"[project]/wt-personnel/packages/domain/src/chessboard/build.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Шахматка: ячейки × даты. Чистая функция, без БД (ADR-002: домен не знает про Prisma).
 * Правила: ночь — полуинтервал [start_date, end_date): день выезда ночь не занимает (AGENTS.md §13, DATA_MODEL §2).
 * Пересечение двух назначений на одной ячейке — ошибка данных (риск №6 PLAN.md: овербукинг), не «первая победила».
 */ __turbopack_context__.s([
    "MAX_CHESSBOARD_DAYS",
    ()=>MAX_CHESSBOARD_DAYS,
    "buildChessboard",
    ()=>buildChessboard,
    "dateRange",
    ()=>dateRange,
    "daySpan",
    ()=>daySpan
]);
const MAX_CHESSBOARD_DAYS = 62;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const toUtc = (d)=>new Date(`${d}T00:00:00Z`);
const fmt = (d)=>d.toISOString().slice(0, 10);
const addDays = (d, n)=>{
    const x = toUtc(d);
    x.setUTCDate(x.getUTCDate() + n);
    return fmt(x);
};
const DAY_MS = 86_400_000;
function dateRange(from, to) {
    if (!ISO.test(from) || !ISO.test(to)) throw new Error(`dateRange: даты должны быть YYYY-MM-DD, получено ${from}..${to}`);
    if (from > to) throw new Error(`dateRange: from ${from} позже to ${to}`);
    const out = [];
    const end = toUtc(to).getTime();
    for(let t = toUtc(from).getTime(); t <= end; t += DAY_MS)out.push(fmt(new Date(t)));
    return out;
}
function daySpan(from, to) {
    return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / DAY_MS) + 1;
}
function buildChessboard(input) {
    const dates = dateRange(input.from, input.to);
    if (dates.length > MAX_CHESSBOARD_DAYS) {
        throw new Error(`Шахматка: максимум ${MAX_CHESSBOARD_DAYS} дней за запрос, запрошено ${dates.length}`);
    }
    const unitIndex = new Map(input.units.map((u, i)=>[
            u.id,
            i
        ]));
    const rows = input.units.map((unit)=>({
            unit,
            cells: dates.map((date)=>({
                    date,
                    state: 'FREE'
                }))
        }));
    const dateIdx = new Map(dates.map((d, i)=>[
            d,
            i
        ]));
    /**
   * Первая клетка доски для отрезка, начатого `start`: обходим только окно доски, а не весь отрезок. Блокировка до 9999
   * года обходилась день за днём — 2,9 млн шагов на каждую отрисовку (аудит 26.09, С-37). `undefined` — отрезок
   * начинается после доски.
   */ const firstCell = (start)=>start <= input.from ? 0 : dateIdx.get(start);
    for (const a of input.allocations){
        const ri = unitIndex.get(a.unitId);
        if (ri === undefined) continue; // ячейка вне запрошенного фонда
        const lastNight = addDays(a.endDate, -1);
        const first = firstCell(a.startDate);
        if (first === undefined) continue;
        for(let ci = first; ci < dates.length && dates[ci] < a.endDate; ci += 1){
            const d = dates[ci];
            const cell = rows[ri].cells[ci];
            if (cell.state === 'OCCUPIED') {
                throw new Error(`Пересечение назначений на ячейке ${rows[ri].unit.code} за ${d}: брони ${cell.confirmationNumber} и ${a.confirmationNumber}`);
            }
            Object.assign(cell, {
                state: 'OCCUPIED',
                itemId: a.itemId,
                itemStatus: a.itemStatus,
                confirmationNumber: a.confirmationNumber,
                guestLabel: a.guestLabel,
                isArrival: d === a.startDate,
                isLastNight: d === lastNight,
                ...a.source === undefined ? {} : {
                    source: a.source
                },
                ...a.channel === undefined ? {} : {
                    channel: a.channel
                },
                ...a.balanceMinor === undefined ? {} : {
                    balanceMinor: a.balanceMinor
                }
            });
        }
    }
    for (const b of input.blocks){
        const ri = unitIndex.get(b.unitId);
        if (ri === undefined) continue;
        const first = firstCell(b.dateFrom);
        if (first === undefined) continue;
        for(let ci = first; ci < dates.length && dates[ci] < b.dateTo; ci += 1){
            const cell = rows[ri].cells[ci];
            if (cell.state === 'FREE') Object.assign(cell, {
                state: 'BLOCKED',
                blockType: b.type,
                blockReason: b.reason ?? null
            });
        }
    }
    const summary = {};
    const byCategory = {};
    for (const [ci, date] of dates.entries()){
        const day = {
            occupied: 0,
            blocked: 0,
            free: 0
        };
        const cats = {};
        for (const row of rows){
            const c = cats[row.unit.accommodationTypeCode] ?? (cats[row.unit.accommodationTypeCode] = {
                units: 0,
                occupied: 0,
                blocked: 0,
                free: 0
            });
            c.units += 1;
            const st = row.cells[ci].state;
            if (st === 'OCCUPIED') {
                day.occupied += 1;
                c.occupied += 1;
            } else if (st === 'BLOCKED') {
                day.blocked += 1;
                c.blocked += 1;
            } else {
                day.free += 1;
                c.free += 1;
            }
        }
        summary[date] = day;
        byCategory[date] = cats;
    }
    const unassigned = [
        ...input.unassigned ?? []
    ].sort((a, b)=>a.categoryCode.localeCompare(b.categoryCode) || a.arrivalDate.localeCompare(b.arrivalDate) || a.confirmationNumber.localeCompare(b.confirmationNumber));
    return {
        from: input.from,
        to: input.to,
        dates,
        rows,
        summary,
        byCategory,
        unassigned
    };
}
}),
"[project]/wt-personnel/packages/domain/src/chessboard/index.ts [app-ssr] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
;
}),
"[project]/wt-personnel/packages/domain/src/customer-import-job.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CUSTOMER_IMPORT_CHUNK_MAX_ROWS",
    ()=>CUSTOMER_IMPORT_CHUNK_MAX_ROWS,
    "CUSTOMER_IMPORT_ENVELOPE_MAX_BYTES",
    ()=>CUSTOMER_IMPORT_ENVELOPE_MAX_BYTES,
    "CUSTOMER_IMPORT_MAX_ROWS",
    ()=>CUSTOMER_IMPORT_MAX_ROWS,
    "CustomerImportError",
    ()=>CustomerImportError,
    "canUndoCustomerImport",
    ()=>canUndoCustomerImport,
    "customerImportRowInput",
    ()=>customerImportRowInput,
    "parseCustomerImportChunk",
    ()=>parseCustomerImportChunk,
    "parseCustomerImportStart",
    ()=>parseCustomerImportStart
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$customers$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/customers.ts [app-ssr] (ecmascript)");
;
const CUSTOMER_IMPORT_MAX_ROWS = 50_000;
const CUSTOMER_IMPORT_CHUNK_MAX_ROWS = 1_000;
const CUSTOMER_IMPORT_ENVELOPE_MAX_BYTES = 65_536;
class CustomerImportError extends Error {
    code;
    constructor(code){
        super(code), this.code = code;
        this.name = 'CustomerImportError';
    }
}
function envelopeBytes(raw) {
    try {
        const serialized = JSON.stringify(raw);
        if (typeof serialized !== 'string') throw new CustomerImportError('INVALID_ENVELOPE');
        return new TextEncoder().encode(serialized).byteLength;
    } catch (error) {
        if (error instanceof CustomerImportError) throw error;
        throw new CustomerImportError('INVALID_ENVELOPE');
    }
}
function boundedEnvelope(raw) {
    if (envelopeBytes(raw) > CUSTOMER_IMPORT_ENVELOPE_MAX_BYTES) {
        throw new CustomerImportError('PAYLOAD_TOO_LARGE');
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new CustomerImportError('INVALID_ENVELOPE');
    }
    return raw;
}
function parseCustomerImportStart(raw) {
    const body = boundedEnvelope(raw);
    const clientRequestId = body['clientRequestId'];
    const totalRows = body['totalRows'];
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (typeof clientRequestId !== 'string' || !uuid.test(clientRequestId) || !Number.isInteger(totalRows) || totalRows < 1 || totalRows > CUSTOMER_IMPORT_MAX_ROWS) {
        throw new CustomerImportError('INVALID_ENVELOPE');
    }
    return {
        clientRequestId,
        totalRows: totalRows
    };
}
function parseCustomerImportChunk(raw) {
    const body = boundedEnvelope(raw);
    const offset = body['offset'];
    const rows = body['rows'];
    if (!Number.isSafeInteger(offset) || offset < 0 || offset >= CUSTOMER_IMPORT_MAX_ROWS || !Array.isArray(rows) || rows.length < 1 || rows.length > CUSTOMER_IMPORT_CHUNK_MAX_ROWS || offset + rows.length > CUSTOMER_IMPORT_MAX_ROWS) {
        throw new CustomerImportError('INVALID_ENVELOPE');
    }
    const parsedRows = rows.map((rawRow)=>{
        if (!rawRow || typeof rawRow !== 'object' || Array.isArray(rawRow)) {
            throw new CustomerImportError('INVALID_ENVELOPE');
        }
        const row = rawRow;
        if (!Number.isSafeInteger(row['sourceLine']) || row['sourceLine'] < 2 || row['sourceLine'] > 2_147_483_647) {
            throw new CustomerImportError('INVALID_ENVELOPE');
        }
        return {
            sourceLine: row['sourceLine'],
            firstName: row['firstName'],
            lastName: row['lastName'],
            phone: row['phone']
        };
    });
    return {
        offset: offset,
        rows: parsedRows
    };
}
function customerImportRowInput(row) {
    if (typeof row.firstName !== 'string') return {
        ok: false,
        code: 'INVALID_FIRST_NAME'
    };
    const firstName = row.firstName.trim();
    if (firstName.length > 100) return {
        ok: false,
        code: 'INVALID_FIRST_NAME'
    };
    if (row.lastName !== null && typeof row.lastName !== 'string') return {
        ok: false,
        code: 'INVALID_LAST_NAME'
    };
    const lastName = typeof row.lastName === 'string' ? row.lastName.trim() : '';
    if (lastName.length > 100) return {
        ok: false,
        code: 'INVALID_LAST_NAME'
    };
    if (row.phone !== null && typeof row.phone !== 'string') return {
        ok: false,
        code: 'INVALID_PHONE'
    };
    const phone = typeof row.phone === 'string' ? row.phone.trim() : '';
    if (phone.length > 32 || phone && !(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$customers$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["customerPhoneKey"])(phone)) return {
        ok: false,
        code: 'INVALID_PHONE'
    };
    if (!firstName && !phone) return {
        ok: false,
        code: 'MISSING_NAME_AND_PHONE'
    };
    return {
        ok: true,
        value: {
            firstName: firstName || 'Клиент',
            lastName: lastName || null,
            phone: phone || null
        }
    };
}
function canUndoCustomerImport(undoDeadline, now) {
    if (!undoDeadline) return false;
    const deadlineMs = undoDeadline.getTime();
    const nowMs = now.getTime();
    return Number.isFinite(deadlineMs) && Number.isFinite(nowMs) && nowMs < deadlineMs;
}
}),
"[project]/wt-personnel/packages/domain/src/customer-import.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CUSTOMER_CSV_MAX_BYTES",
    ()=>CUSTOMER_CSV_MAX_BYTES,
    "CUSTOMER_CSV_MAX_ROWS",
    ()=>CUSTOMER_CSV_MAX_ROWS,
    "previewCustomerCsv",
    ()=>previewCustomerCsv,
    "readCustomerCsv",
    ()=>readCustomerCsv
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$customers$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/customers.ts [app-ssr] (ecmascript)");
;
const CUSTOMER_CSV_MAX_ROWS = 50_000;
const CUSTOMER_CSV_MAX_BYTES = 10 * 1024 * 1024;
/** Строгий CSV: не исправляем повреждённые кавычки и не теряем исходные номера строк. */ function recordsOf(text, delimiter) {
    const records = [];
    let cells = [], field = '', quoted = false, closed = false, line = 1, start = 1;
    const pushField = ()=>{
        cells.push(field);
        field = '';
        closed = false;
        if (cells.length > 100) throw new Error('В CSV не больше 100 колонок');
    };
    const pushRecord = ()=>{
        pushField();
        records.push({
            cells,
            line: start
        });
        cells = [];
        if (records.length > CUSTOMER_CSV_MAX_ROWS + 1) throw new Error('В CSV не больше 50 000 строк');
    };
    for(let i = 0; i < text.length; i += 1){
        const c = text[i];
        if (quoted) {
            if (c === '"' && text[i + 1] === '"') {
                field += '"';
                i += 1;
            } else if (c === '"') {
                quoted = false;
                closed = true;
            } else {
                field += c;
                if (c === '\n' || c === '\r' && text[i + 1] !== '\n') line += 1;
            }
        } else if (c === delimiter) pushField();
        else if (c === '\r' || c === '\n') {
            if (c === '\r' && text[i + 1] === '\n') i += 1;
            pushRecord();
            line += 1;
            start = line;
        } else if (c === '"' && !field && !closed) quoted = true;
        else {
            if (closed || c === '"') throw new Error(`Строка ${start}: проверьте кавычки CSV`);
            field += c;
        }
    }
    if (quoted) throw new Error(`Строка ${start}: не закрыты кавычки CSV`);
    if (field || cells.length || closed) pushRecord();
    return records;
}
function readCustomerCsv(text) {
    if (new TextEncoder().encode(text).length > CUSTOMER_CSV_MAX_BYTES) throw new Error('Файл больше 10 МБ');
    const body = text.replace(/^\uFEFF/, '');
    if (!body.trim()) throw new Error('Файл пуст');
    // Разделитель выбираем по первому логическому заголовку, игнорируя символы в кавычках.
    let quoted = false;
    const counts = new Map([
        [
            ';',
            0
        ],
        [
            ',',
            0
        ],
        [
            '\t',
            0
        ]
    ]);
    for(let i = 0; i < body.length; i += 1){
        const c = body[i];
        if (c === '"') {
            if (quoted && body[i + 1] === '"') i += 1;
            else quoted = !quoted;
        }
        if (!quoted && (c === '\n' || c === '\r')) break;
        if (!quoted && counts.has(c)) counts.set(c, counts.get(c) + 1);
    }
    const delimiter = [
        ...counts
    ].sort((a, b)=>b[1] - a[1])[0][0];
    const [header, ...records] = recordsOf(body, delimiter);
    const headers = header.cells.map((s)=>s.trim());
    if (!headers.some(Boolean)) throw new Error('В CSV нет заголовков колонок');
    if (!records.length) throw new Error('В CSV нет строк клиентов');
    const aliases = {
        firstName: [
            'имя',
            'first name',
            'firstname',
            'name'
        ],
        lastName: [
            'фамилия',
            'last name',
            'lastname'
        ],
        phone: [
            'телефон',
            'phone',
            'номер телефона',
            'мобильный'
        ]
    };
    const mapping = {
        firstName: null,
        lastName: null,
        phone: null
    };
    for (const key of Object.keys(aliases)){
        const matches = headers.flatMap((name, i)=>aliases[key].includes(name.toLowerCase()) ? [
                i
            ] : []);
        if (matches.length === 1) mapping[key] = matches[0];
    }
    return {
        headers,
        records,
        mapping
    };
}
function previewCustomerCsv(file, mapping) {
    const selected = Object.values(mapping).filter((v)=>v !== null);
    if (selected.some((v)=>!Number.isInteger(v) || v < 0 || v >= file.headers.length)) throw new Error('Проверьте номера колонок');
    if (new Set(selected).size !== selected.length) throw new Error('Колонку нельзя выбрать дважды');
    if (mapping.firstName === null && mapping.phone === null) throw new Error('Выберите колонку имени или телефона');
    const seen = new Map();
    const counts = {
        ready: 0,
        warning: 0,
        duplicate: 0,
        skipped: 0
    };
    const rows = file.records.map(({ cells, line })=>{
        const get = (key)=>mapping[key] === null ? '' : (cells[mapping[key]] ?? '').trim();
        const row = {
            line,
            firstName: get('firstName'),
            lastName: get('lastName'),
            phone: get('phone'),
            phoneNormalized: null,
            status: 'ready',
            reason: 'Готова к переносу'
        };
        row.phoneNormalized = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$customers$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["customerPhoneKey"])(row.phone);
        if (cells.length > file.headers.length) {
            row.status = 'skipped';
            row.reason = 'Число ячеек не совпадает с заголовком';
        } else if (!row.firstName && !row.phone) {
            row.status = 'skipped';
            row.reason = 'Нет имени и телефона';
        } else if (row.firstName.length > 100 || row.lastName.length > 100 || row.phone.length > 32) {
            row.status = 'skipped';
            row.reason = 'Слишком длинное имя, фамилия или телефон';
        } else if (row.phone && !row.phoneNormalized) {
            row.status = 'skipped';
            row.reason = 'Проверьте телефон';
        } else if (row.phoneNormalized && seen.has(row.phoneNormalized)) {
            row.status = 'duplicate';
            row.duplicateOf = seen.get(row.phoneNormalized);
            row.reason = `Повтор номера из строки ${row.duplicateOf}`;
        } else {
            if (row.phoneNormalized) seen.set(row.phoneNormalized, line);
            if (!row.firstName || !row.phone) {
                row.status = 'warning';
                row.reason = !row.firstName ? 'Имя не указано: при импорте будет «Клиент»' : 'Нет телефона: онлайн-запись недоступна';
            }
        }
        counts[row.status] += 1;
        return row;
    });
    return {
        rows,
        counts
    };
}
}),
"[project]/wt-personnel/packages/domain/src/customers.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "customerPhoneKey",
    ()=>customerPhoneKey,
    "parseCustomerInput",
    ()=>parseCustomerInput
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$web$2d$booking$2f$request$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/web-booking/request.ts [app-ssr] (ecmascript)");
;
function customerPhoneKey(raw) {
    if (typeof raw !== 'string') return null;
    const phone = raw.replace(/[\u00a0\u202f]/g, ' ').replace(/^[ \t\r\n\v\f]+|[ \t\r\n\v\f]+$/g, '');
    if (!/^\+?[0-9 ().\t\r\n\v\f-]+$/.test(phone)) return null;
    const digits = phone.replace(/\D/g, '');
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$web$2d$booking$2f$request$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["normalizePhone"])(digits.length === 10 && !phone.startsWith('+') ? `7${digits}` : phone);
}
function parseCustomerInput(raw) {
    const body = raw ?? {};
    const firstName = typeof body['firstName'] === 'string' ? body['firstName'].trim() : '';
    if (!firstName || firstName.length > 100) return {
        ok: false,
        reason: 'Имя клиента: от 1 до 100 символов'
    };
    const lastName = typeof body['lastName'] === 'string' ? body['lastName'].trim() : '';
    if (lastName.length > 100) return {
        ok: false,
        reason: 'Фамилия клиента: не больше 100 символов'
    };
    const phone = typeof body['phone'] === 'string' ? body['phone'].trim() : '';
    if (phone.length > 32 || !customerPhoneKey(phone)) return {
        ok: false,
        reason: 'Укажите телефон клиента: +7, 8 или 10 цифр местного номера'
    };
    return {
        ok: true,
        value: {
            firstName,
            lastName: lastName || null,
            phone
        }
    };
}
}),
"[project]/wt-personnel/packages/domain/src/dashboard/index.ts [app-ssr] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$dashboard$2f$metrics$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/dashboard/metrics.ts [app-ssr] (ecmascript)");
;
;
;
;
;
}),
"[project]/wt-personnel/packages/domain/src/dashboard/metrics.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DASHBOARD_FUNDS",
    ()=>DASHBOARD_FUNDS,
    "buildDashboard",
    ()=>buildDashboard
]);
/**
 * Дашборд собственника за период (срез 14, план plans/slice-14-dashboard-2026-09-16.md).
 * Только арифметика над тем, что уже посчитали шахматка и счета — правил здесь нет.
 * Деньги — integer minor units (ADR-008), наружу строки; доли и проценты — с одним знаком после запятой.
 */ var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$chessboard$2f$build$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/chessboard/build.ts [app-ssr] (ecmascript)");
;
const DASHBOARD_FUNDS = [
    'all',
    'rooms',
    'beds'
];
const FUND_KIND = {
    rooms: 'ROOM',
    beds: 'BED'
};
const inactive = new Set([
    'CANCELLED',
    'NO_SHOW'
]);
const s = (v)=>v.toString();
/** Проценты с одним знаком после запятой, без float-накопления: считаем в десятых долях */ const percent = (part, whole)=>whole > 0 ? Math.round(part * 1000 / whole) / 10 : 0;
const divide = (amount, by)=>by > 0 ? s(amount / BigInt(by)) : null;
/**
 * Оставляет только категории одного типа фонда: дни пересобираются из `byCategory`, проживания,
 * начисления и «без ячейки» — по коду категории. Платежи и возвраты не трогаются (см. `DashboardInput`).
 */ function restrictToFund(input, fund) {
    if (fund === 'all') return input;
    const kind = FUND_KIND[fund];
    return restrictToCategories(input, input.categories.filter((c)=>c.kind === kind));
}
/** Одна категория (RPT2.2c-2, фильтр отчёта): та же пересборка, что у типа фонда; код вне фонда даёт пустой фонд */ function restrictToCategory(input, code) {
    return restrictToCategories(input, input.categories.filter((c)=>c.code === code));
}
function restrictToCategories(input, categories) {
    const codes = new Set(categories.map((c)=>c.code));
    const days = input.days.map((d)=>{
        const byCategory = Object.fromEntries(Object.entries(d.byCategory).filter(([code])=>codes.has(code)));
        const sum = (key)=>Object.values(byCategory).reduce((n, c)=>n + c[key], 0);
        return {
            date: d.date,
            occupied: sum('occupied'),
            free: sum('free'),
            blocked: sum('blocked'),
            byCategory
        };
    });
    return {
        ...input,
        categories,
        days,
        unassignedByCategory: Object.fromEntries(Object.entries(input.unassignedByCategory).filter(([code])=>codes.has(code))),
        stays: input.stays.filter((st)=>codes.has(st.categoryCode)),
        charges: input.charges.filter((ch)=>codes.has(ch.categoryCode))
    };
}
/**
 * Выручка за ночи (ADR-155, Q-290, `docs/metrics.md` §2): цена места делится поровну по его ночам, остаток тиынов
 * достаётся последней ночи, так что сумма по всем ночам равна цене. Берутся действующие проживания; в расчёт идут
 * только ночи внутри периода. Начисление по дню заезда это другая база («Начислено»), здесь она не участвует.
 */ function nightlyRevenue(stays, dates) {
    const inPeriod = new Set(dates);
    const out = new Map();
    for (const st of stays){
        if (inactive.has(st.status) || inactive.has(st.reservationStatus)) continue;
        const nightsOfStay = Math.max(1, Math.round((Date.parse(`${st.departureDate}T00:00:00Z`) - Date.parse(`${st.arrivalDate}T00:00:00Z`)) / 86_400_000));
        const base = st.priceMinor / BigInt(nightsOfStay);
        const rest = st.priceMinor - base * BigInt(nightsOfStay);
        for(let i = 0; i < nightsOfStay; i += 1){
            const date = new Date(Date.parse(`${st.arrivalDate}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10);
            if (!inPeriod.has(date)) continue;
            out.set(date, (out.get(date) ?? 0n) + base + (i === nightsOfStay - 1 ? rest : 0n));
        }
    }
    return out;
}
function buildDashboard(whole, fund = 'all', filter = {}) {
    const fundUnits = (kind)=>whole.categories.filter((c)=>c.kind === kind).reduce((n, c)=>n + c.units, 0);
    const funds = {
        rooms: fundUnits('ROOM'),
        beds: fundUnits('BED')
    };
    const byFund = restrictToFund(whole, fund);
    const input = filter.category ? restrictToCategory(byFund, filter.category) : byFund;
    const dates = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$chessboard$2f$build$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["dateRange"])(input.from, input.to);
    if (input.days.length !== dates.length || input.days.some((d, i)=>d.date !== dates[i])) throw new Error(`buildDashboard: ожидалось ${dates.length} дней ${input.from}…${input.to}, получено ${input.days.length}`);
    const units = input.categories.reduce((n, c)=>n + c.units, 0);
    const nights = dates.length;
    const occupiedNights = input.days.reduce((n, d)=>n + d.occupied, 0);
    const blockedNights = input.days.reduce((n, d)=>n + d.blocked, 0);
    const freeNights = input.days.reduce((n, d)=>n + d.free, 0);
    const unitNights = units * nights;
    const byKind = (kind)=>input.charges.filter((c)=>c.kind === kind).reduce((a, c)=>a + c.amountMinor, 0n);
    const accommodation = byKind('ACCOMMODATION');
    const services = byKind('SERVICE');
    const penalties = byKind('PENALTY');
    const adjustments = byKind('ADJUSTMENT');
    const methods = new Map();
    for (const p of input.payments){
        const v = methods.get(p.method) ?? {
            count: 0,
            amountMinor: 0n
        };
        methods.set(p.method, {
            count: v.count + 1,
            amountMinor: v.amountMinor + p.amountMinor
        });
    }
    const byMethod = [
        ...methods
    ].map(([method, v])=>({
            method,
            count: v.count,
            amountMinor: v.amountMinor
        })).sort((a, b)=>a.amountMinor === b.amountMinor ? 0 : a.amountMinor > b.amountMinor ? -1 : 1).map((x)=>({
            ...x,
            amountMinor: s(x.amountMinor)
        }));
    const paid = input.payments.reduce((a, p)=>a + p.amountMinor, 0n);
    const inPeriod = (d)=>d >= input.from && d <= input.to;
    const arrivalsAll = input.stays.filter((st)=>inPeriod(st.arrivalDate));
    const arrivals = arrivalsAll.filter((st)=>!inactive.has(st.status));
    const departures = input.stays.filter((st)=>inPeriod(st.departureDate) && !inactive.has(st.status));
    // Брони периода (Q-209): проживания с заездом в периоде, сгруппированные по Reservation
    const reservationMap = new Map();
    for (const st of arrivalsAll){
        const r = reservationMap.get(st.reservationId) ?? {
            status: st.reservationStatus,
            stays: []
        };
        r.stays.push(st);
        reservationMap.set(st.reservationId, r);
    }
    const reservations = [
        ...reservationMap.values()
    ];
    const activeReservations = reservations.filter((r)=>!inactive.has(r.status)).map((r)=>({
            ...r,
            stays: r.stays.filter((st)=>!inactive.has(st.status))
        }));
    const stayValue = (stays)=>stays.reduce((a, st)=>a + st.priceMinor, 0n);
    // Источники — бронями (Q-209): источник и канал у брони один, сумма — её действующие места
    const sourceMap = new Map();
    for (const r of activeReservations){
        const first = r.stays[0];
        if (!first) continue;
        const key = `${first.source}|${first.channel ?? ''}`;
        const v = sourceMap.get(key) ?? {
            source: first.source,
            channel: first.channel,
            count: 0,
            amount: 0n,
            amountMinor: '0',
            share: 0
        };
        sourceMap.set(key, {
            ...v,
            count: v.count + 1,
            amount: v.amount + stayValue(r.stays)
        });
    }
    const sources = [
        ...sourceMap.values()
    ].sort((a, b)=>b.count - a.count || (a.amount === b.amount ? 0 : a.amount > b.amount ? -1 : 1)).map(({ amount, ...v })=>({
            ...v,
            amountMinor: s(amount),
            share: percent(v.count, activeReservations.length)
        }));
    const categories = input.categories.map((c)=>{
        const sumOf = (key)=>input.days.reduce((n, d)=>n + (d.byCategory[c.code]?.[key] ?? 0), 0);
        const occupied = sumOf('occupied');
        const revenue = input.charges.filter((ch)=>ch.kind === 'ACCOMMODATION' && ch.categoryCode === c.code).reduce((a, ch)=>a + ch.amountMinor, 0n);
        const catNights = c.units * nights;
        const catNightRevenue = [
            ...nightlyRevenue(input.stays.filter((st)=>st.categoryCode === c.code), dates).values()
        ].reduce((n, v)=>n + v, 0n);
        return {
            code: c.code,
            name: c.name,
            kind: c.kind,
            units: c.units,
            unitNights: catNights,
            occupiedNights: occupied,
            freeNights: sumOf('free'),
            blockedNights: sumOf('blocked'),
            unassigned: input.unassignedByCategory[c.code] ?? 0,
            percent: percent(occupied, catNights - sumOf('blocked')),
            revenueMinor: s(revenue),
            adrMinor: divide(catNightRevenue, occupied)
        };
    });
    const revenueByDay = new Map();
    for (const ch of input.charges)if (ch.kind === 'ACCOMMODATION') revenueByDay.set(ch.serviceDate, (revenueByDay.get(ch.serviceDate) ?? 0n) + ch.amountMinor);
    const nightRevenueByDay = nightlyRevenue(input.stays, dates);
    const nightsRevenue = [
        ...nightRevenueByDay.values()
    ].reduce((n, v)=>n + v, 0n);
    const daily = input.days.map((d)=>({
            date: d.date,
            occupied: d.occupied,
            free: d.free,
            blocked: d.blocked,
            percent: percent(d.occupied, units - d.blocked),
            arrivals: arrivals.filter((st)=>st.arrivalDate === d.date).length,
            departures: departures.filter((st)=>st.departureDate === d.date).length,
            revenueMinor: s(revenueByDay.get(d.date) ?? 0n),
            nightRevenueMinor: s(nightRevenueByDay.get(d.date) ?? 0n)
        }));
    const cancelledStays = arrivalsAll.filter((st)=>st.status === 'CANCELLED').length;
    const noShowStays = arrivalsAll.filter((st)=>st.status === 'NO_SHOW').length;
    const cancelled = reservations.filter((r)=>r.status === 'CANCELLED').length;
    const noShow = reservations.filter((r)=>r.status === 'NO_SHOW').length;
    const bookedStays = activeReservations.flatMap((r)=>r.stays);
    const bookingsValue = stayValue(bookedStays);
    return {
        from: input.from,
        to: input.to,
        fund,
        funds,
        nights,
        units,
        occupancy: {
            unitNights,
            occupiedNights,
            blockedNights,
            freeNights,
            sellableNights: unitNights - blockedNights,
            percent: percent(occupiedNights, unitNights - blockedNights)
        },
        unassigned: Object.values(input.unassignedByCategory).reduce((n, v)=>n + v, 0),
        revenue: {
            accommodationMinor: s(accommodation),
            servicesMinor: s(services),
            penaltiesMinor: s(penalties),
            adjustmentsMinor: s(adjustments),
            totalMinor: s(accommodation + services + penalties + adjustments),
            nightsMinor: s(nightsRevenue)
        },
        payments: {
            totalMinor: s(paid),
            count: input.payments.length,
            byMethod
        },
        refundsMinor: s(input.refundsMinor),
        adrMinor: divide(nightsRevenue, occupiedNights),
        revparMinor: divide(nightsRevenue, unitNights - blockedNights),
        arrivals: {
            count: arrivals.length,
            guests: arrivals.reduce((n, st)=>n + st.adults + st.children, 0),
            cancelled: cancelledStays,
            noShow: noShowStays
        },
        departures: {
            count: departures.length
        },
        bookings: {
            total: reservations.length,
            active: activeReservations.length,
            stays: bookedStays.length,
            cancelled,
            noShow,
            cancelledPercent: percent(cancelled, reservations.length),
            noShowPercent: percent(noShow, reservations.length),
            valueMinor: s(bookingsValue),
            averageMinor: divide(bookingsValue, activeReservations.length)
        },
        sources,
        categories,
        categoryOptions: byFund.categories.map(({ code, name, kind })=>({
                code,
                name,
                kind
            })),
        daily
    };
}
}),
"[project]/wt-personnel/packages/domain/src/finance/cash.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CASH_METHODS",
    ()=>CASH_METHODS,
    "DEFAULT_CASH_METHODS",
    ()=>DEFAULT_CASH_METHODS,
    "NON_CASH_METHODS",
    ()=>NON_CASH_METHODS,
    "assertCashOperation",
    ()=>assertCashOperation,
    "assertCashReconciliation",
    ()=>assertCashReconciliation,
    "cashBalances",
    ()=>cashBalances,
    "commissionFromPercent",
    ()=>commissionFromPercent,
    "reconciliationAdjustment",
    ()=>reconciliationAdjustment
]);
/**
 * Касса (DATA_MODEL §21, план plans/finance-cashbox-2026-10-02.md): движения денег мимо счетов
 * гостей и остатки по способам оплаты. Гостевые оплаты в кассу не дублируются — остаток по способу
 * вычисляется из платежей, возвратов и операций кассы. Деньги — integer minor units (ADR-008).
 */ var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$finance$2f$finance$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/finance/finance.ts [app-ssr] (ecmascript)");
;
const NON_CASH_METHODS = [
    'EXTERNAL',
    'DEPOSIT',
    'CARD_GUARANTEE'
];
const DEFAULT_CASH_METHODS = [
    'CASH',
    'KASPI',
    'HALYK',
    'CARD_TERMINAL'
];
const CASH_METHODS = [
    ...DEFAULT_CASH_METHODS,
    'BANK_TRANSFER_PERSON',
    'BANK_TRANSFER_LEGAL'
];
const isCash = (method)=>CASH_METHODS.includes(method);
function assertCashOperation(input) {
    if (input.amountMinor <= 0n) throw new __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$finance$2f$finance$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["FinanceRuleError"]('Сумма операции должна быть больше нуля');
    if (!isCash(input.method)) throw new __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$finance$2f$finance$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["FinanceRuleError"](`Способ ${input.method} в кассе не участвует`);
    if (input.kind === 'TRANSFER') {
        if (!input.methodTo) throw new __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$finance$2f$finance$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["FinanceRuleError"]('У перевода нужен способ «куда»');
        if (input.methodTo === input.method) throw new __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$finance$2f$finance$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["FinanceRuleError"]('Перевод в тот же способ не имеет смысла');
        if (!isCash(input.methodTo)) throw new __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$finance$2f$finance$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["FinanceRuleError"](`Способ ${input.methodTo} в кассе не участвует`);
        if (input.categoryKind != null) throw new __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$finance$2f$finance$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["FinanceRuleError"]('У перевода статья не указывается');
        return;
    }
    if (input.methodTo) throw new __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$finance$2f$finance$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["FinanceRuleError"]('Способ «куда» бывает только у перевода');
    if (input.categoryKind != null && input.categoryKind !== input.kind) throw new __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$finance$2f$finance$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["FinanceRuleError"]('Статья другого вида: у поступления — статья дохода, у расхода — расхода');
}
function cashBalances(input, /**
   * Настройка способов объекта (§21.6): `always` — плитки, видимые и при нуле (по умолчанию
   * DEFAULT_CASH_METHODS), `order` — порядок показа; способы с движениями видны всегда
   */ options) {
    const by = new Map();
    const touched = new Set();
    const add = (method, delta)=>{
        if (!isCash(method)) return;
        by.set(method, (by.get(method) ?? 0n) + delta);
        touched.add(method);
    };
    for (const p of input.payments)add(p.method, p.amountMinor);
    for (const r of input.refunds)add(r.method, -r.amountMinor);
    for (const o of input.operations){
        if (o.kind === 'INCOME') add(o.method, o.amountMinor);
        else if (o.kind === 'EXPENSE') add(o.method, -o.amountMinor);
        else {
            add(o.method, -o.amountMinor);
            if (o.methodTo) add(o.methodTo, o.amountMinor);
        }
    }
    const always = options?.always ?? DEFAULT_CASH_METHODS;
    const order = [
        ...options?.order ?? [],
        ...CASH_METHODS
    ].filter((m, i, all)=>isCash(m) && all.indexOf(m) === i);
    const balances = order.filter((m)=>always.includes(m) || touched.has(m)).map((method)=>({
            method,
            balanceMinor: by.get(method) ?? 0n
        }));
    return {
        balances,
        totalMinor: balances.reduce((s, b)=>s + b.balanceMinor, 0n)
    };
}
function commissionFromPercent(amountMinor, percent) {
    const m = /^(\d{1,3})(?:[.,](\d{1,2}))?$/.exec(String(percent).trim());
    if (!m) throw new __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$finance$2f$finance$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["FinanceRuleError"](`Процент «${percent}» — число с не более чем двумя знаками после запятой`);
    const hundredths = BigInt(m[1]) * 100n + BigInt((m[2] ?? '').padEnd(2, '0'));
    if (hundredths <= 0n || hundredths > 10_000n) throw new __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$finance$2f$finance$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["FinanceRuleError"]('Процент комиссии — больше нуля и не больше 100');
    return amountMinor * hundredths / 10_000n;
}
function assertCashReconciliation(input) {
    if (input.countedMinor < 0n) throw new __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$finance$2f$finance$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["FinanceRuleError"]('Пересчитанная сумма не бывает отрицательной');
    if (!isCash(input.method)) throw new __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$finance$2f$finance$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["FinanceRuleError"](`Способ ${input.method} в кассе не участвует`);
}
function reconciliationAdjustment(expectedMinor, countedMinor) {
    const delta = countedMinor - expectedMinor;
    if (delta === 0n) return null;
    return delta > 0n ? {
        kind: 'INCOME',
        amountMinor: delta
    } : {
        kind: 'EXPENSE',
        amountMinor: -delta
    };
}
}),
"[project]/wt-personnel/packages/domain/src/finance/cashflow.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "buildCashFlow",
    ()=>buildCashFlow
]);
/**
 * Деньги за период (RPT2.4a, ADR-155, `docs/metrics.md` §2): поступления, возвраты, расходы и денежный поток раздельно,
 * по дням и за период. Источник один, общая лента денег (`GET /finance/operations`): оплаты и возвраты броней и операции
 * кассы. Аннулированное не считается, переводы между кассами в потоке не участвуют. Деньги целыми минорными единицами,
 * наружу строками (ADR-008). Начисления, долг и прибыль сюда не входят.
 */ var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$chessboard$2f$build$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/chessboard/build.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$finance$2f$cash$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/finance/cash.ts [app-ssr] (ecmascript)");
;
;
const NO_CATEGORY = 'Без статьи';
const offCash = (method)=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$finance$2f$cash$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["NON_CASH_METHODS"].includes(method);
const zero = ()=>({
        receipts: 0n,
        receiptsCash: 0n,
        refunds: 0n,
        refundsCash: 0n,
        income: 0n,
        expense: 0n
    });
function view(a) {
    return {
        receiptsMinor: a.receipts.toString(),
        receiptsCashMinor: a.receiptsCash.toString(),
        receiptsOffCashMinor: (a.receipts - a.receiptsCash).toString(),
        refundsMinor: a.refunds.toString(),
        refundsCashMinor: a.refundsCash.toString(),
        netReceiptsMinor: (a.receipts - a.refunds).toString(),
        incomeMinor: a.income.toString(),
        expenseMinor: a.expense.toString(),
        cashFlowMinor: (a.receiptsCash - a.refundsCash + a.income - a.expense).toString()
    };
}
function buildCashFlow(rows, from, to) {
    const dates = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$chessboard$2f$build$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["dateRange"])(from, to);
    const byDay = new Map(dates.map((d)=>[
            d,
            zero()
        ]));
    const total = zero();
    const categories = new Map();
    for (const r of rows){
        if (r.status !== 'COMPLETED' || r.kind === 'TRANSFER') continue;
        const day = byDay.get(r.localAt.slice(0, 10));
        if (!day) continue;
        for (const a of [
            day,
            total
        ]){
            if (r.kind === 'PAYMENT') {
                a.receipts += r.amountMinor;
                if (!offCash(r.method)) a.receiptsCash += r.amountMinor;
            } else if (r.kind === 'REFUND') {
                a.refunds += r.amountMinor;
                if (!offCash(r.method)) a.refundsCash += r.amountMinor;
            } else if (r.kind === 'INCOME') a.income += r.amountMinor;
            else a.expense += r.amountMinor;
        }
        if (r.kind === 'EXPENSE') {
            const key = r.category?.trim() || NO_CATEGORY;
            categories.set(key, (categories.get(key) ?? 0n) + r.amountMinor);
        }
    }
    return {
        from,
        to,
        days: dates.map((date)=>({
                date,
                ...view(byDay.get(date))
            })),
        totals: view(total),
        expensesByCategory: [
            ...categories
        ].sort((a, b)=>a[1] === b[1] ? a[0].localeCompare(b[0], 'ru') : a[1] > b[1] ? -1 : 1).map(([category, amount])=>({
                category,
                amountMinor: amount.toString()
            }))
    };
}
}),
"[project]/wt-personnel/packages/domain/src/finance/finance.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Финансы счёта гостя (DATA_MODEL §6, ADR-014: счёт на проживание). Деньги — только integer minor units (ADR-008).
 * Ни HTTP, ни Prisma: чистая арифметика и правила.
 */ __turbopack_context__.s([
    "FinanceRuleError",
    ()=>FinanceRuleError,
    "adjacentNight",
    ()=>adjacentNight,
    "assertAllocationsMatch",
    ()=>assertAllocationsMatch,
    "assertPaymentReversible",
    ()=>assertPaymentReversible,
    "assertRefundWithin",
    ()=>assertRefundWithin,
    "channelPrepaymentToKeep",
    ()=>channelPrepaymentToKeep,
    "discountMinor",
    ()=>discountMinor,
    "folioBalance",
    ()=>folioBalance,
    "parseCancellationPenalty",
    ()=>parseCancellationPenalty,
    "parseMoney",
    ()=>parseMoney,
    "penaltyAmount",
    ()=>penaltyAmount,
    "penaltyDue",
    ()=>penaltyDue,
    "stayExtraDefaultMinor",
    ()=>stayExtraDefaultMinor,
    "stayExtraPercent",
    ()=>stayExtraPercent
]);
class FinanceRuleError extends Error {
    name = 'FinanceRuleError';
}
function folioBalance(input) {
    const chargedMinor = input.charges.filter((c)=>!c.voided).reduce((s, c)=>s + c.amountMinor, 0n);
    const paidMinor = input.allocations.reduce((s, a)=>s + a.amountMinor, 0n);
    const refundedMinor = input.refunds.reduce((s, r)=>s + r.amountMinor, 0n);
    return {
        chargedMinor,
        paidMinor,
        refundedMinor,
        balanceMinor: chargedMinor - paidMinor + refundedMinor
    };
}
function assertAllocationsMatch(amountMinor, allocations) {
    if (amountMinor <= 0n) throw new FinanceRuleError('Сумма платежа должна быть больше нуля');
    if (allocations.length === 0) throw new FinanceRuleError('Платёж должен быть распределён хотя бы на один счёт');
    const seen = new Set();
    let sum = 0n;
    for (const a of allocations){
        if (a.amountMinor <= 0n) throw new FinanceRuleError('Распределение на счёт должно быть больше нуля');
        if (seen.has(a.folioId)) throw new FinanceRuleError(`Счёт ${a.folioId} встречается в платеже дважды`);
        seen.add(a.folioId);
        sum += a.amountMinor;
    }
    if (sum !== amountMinor) throw new FinanceRuleError(`Распределено ${sum}, а сумма платежа ${amountMinor} — должно совпадать`);
}
function assertRefundWithin(input) {
    if (input.refundMinor <= 0n) throw new FinanceRuleError('Сумма возврата должна быть больше нуля');
    const available = input.allocatedMinor - input.refundedMinor;
    if (input.refundMinor > available) throw new FinanceRuleError(`Вернуть можно не больше ${available} (внесено ${input.allocatedMinor}, уже возвращено ${input.refundedMinor})`);
}
function parseMoney(value) {
    const m = /^(-)?(\d+)(?:[.,](\d{1,2}))?$/.exec(String(value).trim());
    if (!m) throw new FinanceRuleError(`Сумма «${value}» — число с не более чем двумя знаками после запятой`);
    const minor = BigInt(m[2]) * 100n + BigInt((m[3] ?? '').padEnd(2, '0'));
    return m[1] ? -minor : minor;
}
const CANCELLATION_PENALTIES = [
    'NONE',
    'FIRST_NIGHT',
    'FULL_STAY'
];
function parseCancellationPenalty(v) {
    return CANCELLATION_PENALTIES.find((p)=>p === v) ?? null;
}
function penaltyAmount(policy, stay) {
    if (policy === 'NONE' || stay.totalMinor <= 0n) return 0n;
    if (policy === 'FULL_STAY') return stay.totalMinor;
    if (stay.firstNightMinor !== null && stay.firstNightMinor > 0n) return stay.firstNightMinor;
    if (stay.nights <= 0) return 0n;
    return stay.totalMinor / BigInt(stay.nights);
}
function penaltyDue(input) {
    if (input.reason === 'no_show') return true;
    return input.on >= input.arrivalDate;
}
function stayExtraDefaultMinor(totalMinor, nights) {
    if (nights <= 0 || totalMinor <= 0n) return 0n;
    const halfNight = totalMinor / BigInt(nights) / 2n;
    return halfNight / 100n * 100n;
}
function stayExtraPercent(extra, time) {
    const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
    if (!m) throw new Error(`время должно быть в формате ЧЧ:ММ, получено «${time}»`);
    const minutes = Number(m[1]) * 60 + Number(m[2]);
    if (extra === 'EARLY_CHECK_IN') {
        if (minutes < 6 * 60) return 100;
        if (minutes < 12 * 60) return 50;
        return 0;
    }
    if (minutes <= 12 * 60) return 0;
    if (minutes < 18 * 60) return 50;
    return 100;
}
function adjacentNight(extra, arrivalDate, departureDate) {
    const shift = (d, days)=>{
        const x = new Date(`${d}T00:00:00Z`);
        x.setUTCDate(x.getUTCDate() + days);
        return x.toISOString().slice(0, 10);
    };
    return extra === 'EARLY_CHECK_IN' ? {
        from: shift(arrivalDate, -1),
        toExclusive: arrivalDate
    } : {
        from: departureDate,
        toExclusive: shift(departureDate, 1)
    };
}
function channelPrepaymentToKeep(input) {
    const penalty = input.penaltyMinor < 0n ? 0n : input.penaltyMinor;
    return penalty < input.prepaidMinor ? penalty : input.prepaidMinor;
}
function assertPaymentReversible(input) {
    if (input.status !== 'COMPLETED') throw new FinanceRuleError('Платёж уже аннулирован');
    if (input.refundedMinor > 0n) throw new FinanceRuleError('По платежу есть возврат: аннулировать и менять его нельзя. Остаток верните возвратом');
    if (input.receiptNumber) throw new FinanceRuleError(`По платежу выдан чек № ${input.receiptNumber}: аннулировать и менять его нельзя, оформите возврат`);
}
function discountMinor(baseMinor, percent) {
    if (!Number.isInteger(percent) || percent < 0 || percent > 100) throw new FinanceRuleError('Процент скидки — целое число от 0 до 100');
    if (baseMinor <= 0n) return 0n;
    return baseMinor * BigInt(percent) / 100n;
}
}),
"[project]/wt-personnel/packages/domain/src/finance/index.ts [app-ssr] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$finance$2f$cash$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/finance/cash.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$finance$2f$payment$2d$request$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/finance/payment-request.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$finance$2f$payment$2d$methods$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/finance/payment-methods.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$finance$2f$cashflow$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/finance/cashflow.ts [app-ssr] (ecmascript)");
;
;
;
;
;
;
;
}),
"[project]/wt-personnel/packages/domain/src/finance/payment-methods.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CONFIGURABLE_PAYMENT_METHODS",
    ()=>CONFIGURABLE_PAYMENT_METHODS,
    "DEFAULT_PAYMENT_METHOD_SETTINGS",
    ()=>DEFAULT_PAYMENT_METHOD_SETTINGS,
    "PAYMENT_METHOD_RU",
    ()=>PAYMENT_METHOD_RU,
    "assertPaymentMethodEnabled",
    ()=>assertPaymentMethodEnabled,
    "enabledPaymentMethods",
    ()=>enabledPaymentMethods,
    "parsePaymentMethodSettings",
    ()=>parsePaymentMethodSettings,
    "paymentMethodRu",
    ()=>paymentMethodRu,
    "resolvePaymentMethodSettings",
    ()=>resolvePaymentMethodSettings
]);
/**
 * Способы оплаты объекта (DATA_MODEL §21.6, ADR-185, план plans/property-directories-2026-10-07.md).
 * Способы остаются системными кодами `PaymentMethod` (§6): на них завязаны отчёты, сверка наличных,
 * CHECK в базе и запросы оплаты. Объект решает, какие из восьми стойка предлагает при приёме денег
 * и в каком порядке; EXTERNAL не настраивается: это платёж площадки, его ставят каналы.
 */ var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$finance$2f$finance$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/finance/finance.ts [app-ssr] (ecmascript)");
;
const CONFIGURABLE_PAYMENT_METHODS = [
    'CASH',
    'CARD_TERMINAL',
    'KASPI',
    'HALYK',
    'BANK_TRANSFER_PERSON',
    'BANK_TRANSFER_LEGAL',
    'DEPOSIT',
    'CARD_GUARANTEE'
];
const PAYMENT_METHOD_RU = {
    CASH: 'Наличные',
    CARD_TERMINAL: 'Карта (терминал)',
    KASPI: 'Kaspi',
    HALYK: 'Halyk',
    BANK_TRANSFER_PERSON: 'Перевод от физлица',
    BANK_TRANSFER_LEGAL: 'Перевод от юрлица',
    DEPOSIT: 'Депозит',
    CARD_GUARANTEE: 'Гарантия картой',
    EXTERNAL: 'Внешний канал'
};
const paymentMethodRu = (method)=>PAYMENT_METHOD_RU[method] ?? method;
const isConfigurable = (method)=>CONFIGURABLE_PAYMENT_METHODS.includes(method);
const defaultIndex = (method)=>CONFIGURABLE_PAYMENT_METHODS.indexOf(method);
const DEFAULT_PAYMENT_METHOD_SETTINGS = CONFIGURABLE_PAYMENT_METHODS.map((method)=>({
        method,
        enabled: true
    }));
function resolvePaymentMethodSettings(rows) {
    const out = [];
    const seen = new Set();
    const known = rows.filter((r)=>isConfigurable(r.method)).sort((a, b)=>a.sortOrder - b.sortOrder || defaultIndex(a.method) - defaultIndex(b.method));
    for (const r of known){
        if (seen.has(r.method)) continue;
        seen.add(r.method);
        out.push({
            method: r.method,
            enabled: r.enabled
        });
    }
    for (const method of CONFIGURABLE_PAYMENT_METHODS)if (!seen.has(method)) out.push({
        method,
        enabled: true
    });
    return out;
}
const enabledPaymentMethods = (settings)=>settings.filter((s)=>s.enabled).map((s)=>s.method);
function parsePaymentMethodSettings(raw) {
    if (!raw || typeof raw !== 'object') return {
        ok: false,
        reason: 'Нечего сохранять'
    };
    const methods = raw.methods;
    if (!Array.isArray(methods)) return {
        ok: false,
        reason: 'methods: список способов оплаты в порядке показа'
    };
    const out = [];
    const seen = new Set();
    for (const item of methods){
        const method = item && typeof item === 'object' ? item.method : undefined;
        const enabled = item && typeof item === 'object' ? item.enabled : undefined;
        if (typeof method !== 'string' || !isConfigurable(method)) return {
            ok: false,
            reason: `Неизвестный способ оплаты: ${String(method)}`
        };
        if (typeof enabled !== 'boolean') return {
            ok: false,
            reason: `enabled у способа «${paymentMethodRu(method)}»: true или false`
        };
        if (seen.has(method)) return {
            ok: false,
            reason: `Способ «${paymentMethodRu(method)}» указан дважды`
        };
        seen.add(method);
        out.push({
            method,
            enabled
        });
    }
    const missing = CONFIGURABLE_PAYMENT_METHODS.filter((m)=>!seen.has(m));
    if (missing.length > 0) return {
        ok: false,
        reason: `В списке не хватает: ${missing.map(paymentMethodRu).join(', ')}`
    };
    if (!out.some((s)=>s.enabled)) return {
        ok: false,
        reason: 'Хотя бы один способ оплаты должен быть включён'
    };
    return {
        ok: true,
        value: out
    };
}
function assertPaymentMethodEnabled(method, enabled) {
    if (!isConfigurable(method)) return;
    if (!enabled.includes(method)) throw new __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$finance$2f$finance$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["FinanceRuleError"](`Способ оплаты «${paymentMethodRu(method)}» выключен в настройках объекта`);
}
}),
"[project]/wt-personnel/packages/domain/src/finance/payment-request.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "PAYMENT_REQUEST_LINK_MAX",
    ()=>PAYMENT_REQUEST_LINK_MAX,
    "PAYMENT_REQUEST_METHODS",
    ()=>PAYMENT_REQUEST_METHODS,
    "parsePaymentRequestInput",
    ()=>parsePaymentRequestInput,
    "paymentRequestMessage",
    ()=>paymentRequestMessage
]);
/**
 * Запрос оплаты (DATA_MODEL §24, ADR-144): счёт Kaspi по номеру телефона, ссылка банка или перевод, привязанные к
 * счёту проживания. Здесь только разбор формы и текст гостю; запись и превращение в платёж — в API под блокировкой.
 * У Kaspi официального API оплаты для внешнего софта нет: счёт выставляется в Kaspi Pay вручную, здесь он учитывается.
 */ var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$finance$2f$finance$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/finance/finance.ts [app-ssr] (ecmascript)");
;
const PAYMENT_REQUEST_METHODS = [
    'KASPI',
    'HALYK',
    'BANK_TRANSFER_PERSON',
    'CARD_TERMINAL'
];
const PAYMENT_REQUEST_LINK_MAX = 500;
function parsePaymentRequestInput(raw) {
    const b = raw && typeof raw === 'object' ? raw : {};
    const method = PAYMENT_REQUEST_METHODS.find((m)=>m === b.method);
    if (!method) return {
        ok: false,
        reason: 'Способ: Kaspi, Halyk, перевод или терминал'
    };
    const amountText = typeof b.amount === 'number' ? String(b.amount) : typeof b.amount === 'string' ? b.amount : '';
    let amountMinor;
    try {
        amountMinor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$finance$2f$finance$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["parseMoney"])(amountText.replace(/\s/g, ''));
    } catch (e) {
        if (e instanceof __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$finance$2f$finance$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["FinanceRuleError"]) return {
            ok: false,
            reason: 'Сумма: число больше нуля, до двух знаков после запятой'
        };
        throw e;
    }
    if (amountMinor <= 0n) return {
        ok: false,
        reason: 'Сумма: число больше нуля, до двух знаков после запятой'
    };
    const linkRaw = typeof b.link === 'string' ? b.link.trim() : '';
    let link = null;
    if (linkRaw) {
        let ok;
        try {
            ok = new URL(linkRaw).protocol === 'https:';
        } catch  {
            ok = false;
        }
        if (!ok || !linkRaw.startsWith('https://') || linkRaw.length > PAYMENT_REQUEST_LINK_MAX) return {
            ok: false,
            reason: `Ссылка: адрес банка, начинается с https://, до ${PAYMENT_REQUEST_LINK_MAX} знаков`
        };
        link = linkRaw;
    }
    const noteRaw = typeof b.note === 'string' ? b.note.trim().slice(0, 300) : '';
    return {
        ok: true,
        value: {
            method,
            amountMinor,
            link,
            note: noteRaw || null
        }
    };
}
/** 1200000 → «12 000 ₸»; копейки только когда есть */ function money(minor, currency) {
    const digits = minor.replace(/^-/, '').padStart(3, '0');
    const int = digits.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const frac = digits.slice(-2);
    return `${int}${frac === '00' ? '' : `,${frac}`} ${currency === 'KZT' ? '₸' : currency}`;
}
const howOf = (m, link)=>link ? 'link' : m === 'KASPI' ? 'kaspi' : m === 'CARD_TERMINAL' ? 'desk' : 'transfer';
const TEXT = {
    ru: {
        head: (p, n, sum)=>`${p}: счёт на оплату брони ${n}, ${sum}.`,
        kaspi: ()=>'Счёт выставлен в Kaspi на ваш номер телефона: откройте Kaspi.kz, раздел «Платежи», и подтвердите оплату.',
        link: (l)=>`Оплатить по ссылке: ${l}`,
        transfer: ()=>'Реквизиты для перевода пришлёт администратор.',
        desk: ()=>'Оплатить картой можно на стойке при заселении.'
    },
    kk: {
        head: (p, n, sum)=>`${p}: ${n} брондауын төлеу шоты, ${sum}.`,
        kaspi: ()=>'Шот Kaspi-де телефон нөміріңізге қойылды: Kaspi.kz ашып, «Төлемдер» бөлімінде төлемді растаңыз.',
        link: (l)=>`Сілтеме арқылы төлеу: ${l}`,
        transfer: ()=>'Аударым деректемелерін әкімші жібереді.',
        desk: ()=>'Картамен орналасу кезінде ресепшнде төлеуге болады.'
    },
    en: {
        head: (p, n, sum)=>`${p}: payment request for booking ${n}, ${sum}.`,
        kaspi: ()=>'The invoice is issued in Kaspi to your phone number: open Kaspi.kz, go to Payments and confirm.',
        link: (l)=>`Pay by link: ${l}`,
        transfer: ()=>'The front desk will send transfer details.',
        desk: ()=>'You can pay by card at the front desk on arrival.'
    },
    zh: {
        head: (p, n, sum)=>`${p}：预订 ${n} 的付款单，${sum}。`,
        kaspi: ()=>'账单已通过 Kaspi 发送到您的手机号：打开 Kaspi.kz，在“付款”中确认支付。',
        link: (l)=>`通过链接付款：${l}`,
        transfer: ()=>'前台将发送转账信息。',
        desk: ()=>'入住时可在前台刷卡付款。'
    }
};
function paymentRequestMessage(input) {
    const t = TEXT[input.lang] ?? TEXT.ru;
    const how = howOf(input.method, input.link);
    return `${t.head(input.propertyName, input.confirmationNumber, money(input.amountMinor, input.currency))} ${t[how](input.link ?? '')}`;
}
}),
"[project]/wt-personnel/packages/domain/src/food/booking-rules.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DEFAULT_BOOKING_RULES",
    ()=>DEFAULT_BOOKING_RULES,
    "bookingRuleViolation",
    ()=>bookingRuleViolation,
    "parseBookingRules",
    ()=>parseBookingRules,
    "parseClosedDay",
    ()=>parseClosedDay
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/food/food.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$stock$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/food/stock.ts [app-ssr] (ecmascript)");
;
;
const DEFAULT_BOOKING_RULES = {
    bufferMinutes: 0,
    horizonDays: null,
    maxPartySize: null
};
const optional = (v, min, max)=>v == null ? null : (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodInt"])(v, min, max);
function parseBookingRules(raw) {
    const b = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodObject"])(raw, [
        'bufferMinutes',
        'horizonDays',
        'maxPartySize'
    ]);
    return {
        bufferMinutes: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodInt"])(b.bufferMinutes, 0, 240),
        horizonDays: optional(b.horizonDays, 1, 730),
        maxPartySize: optional(b.maxPartySize, 1, 500)
    };
}
function parseClosedDay(raw) {
    const b = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodObject"])(raw, [
        'day',
        'reason'
    ]);
    return {
        day: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$stock$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["stockDate"])(b.day),
        reason: typeof b.reason === 'string' && b.reason.trim() ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodText"])(b.reason, 200) : null
    };
}
/** 1 день, 2 дня, 5 дней */ const plural = (n, [one, few, many])=>{
    const d = n % 10, h = n % 100;
    return d === 1 && h !== 11 ? one : d >= 2 && d <= 4 && (h < 12 || h > 14) ? few : many;
};
const dayNumber = (day)=>Date.parse(`${day}T00:00:00Z`) / 86_400_000;
function bookingRuleViolation(input) {
    const { rules } = input;
    if (input.closed) return 'В этот день заведение не принимает брони';
    if (rules.horizonDays !== null && dayNumber(input.day) - dayNumber(input.today) > rules.horizonDays) return `Бронь принимается не дальше чем на ${rules.horizonDays} ${plural(rules.horizonDays, [
        'день',
        'дня',
        'дней'
    ])} вперёд`;
    if (rules.maxPartySize !== null && input.partySize > rules.maxPartySize) return `В одной брони не больше ${rules.maxPartySize} ${plural(rules.maxPartySize, [
        'гостя',
        'гостей',
        'гостей'
    ])}`;
    return null;
}
}),
"[project]/wt-personnel/packages/domain/src/food/cash.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "FOOD_CASH_KINDS",
    ()=>FOOD_CASH_KINDS,
    "FOOD_PAYMENT_METHODS",
    ()=>FOOD_PAYMENT_METHODS,
    "foodCashBalances",
    ()=>foodCashBalances,
    "orderPayment",
    ()=>orderPayment,
    "orderRefund",
    ()=>orderRefund,
    "parseFoodCashOperation",
    ()=>parseFoodCashOperation,
    "parseFoodPayment",
    ()=>parseFoodPayment,
    "parseFoodPayout",
    ()=>parseFoodPayout,
    "parseFoodReconciliation",
    ()=>parseFoodReconciliation,
    "payoutCheck",
    ()=>payoutCheck
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/food/food.ts [app-ssr] (ecmascript)");
;
const FOOD_PAYMENT_METHODS = [
    'CASH',
    'CARD_TERMINAL',
    'KASPI',
    'HALYK',
    'BANK_TRANSFER_PERSON',
    'BANK_TRANSFER_LEGAL'
];
const FOOD_CASH_KINDS = [
    'INCOME',
    'EXPENSE',
    'TRANSFER'
];
function orderPayment(status, total, paid, amount) {
    if (status === 'CLOSED') throw new Error('Заказ уже закрыт');
    if (status === 'CANCELLED') throw new Error('Заказ отменён');
    if (amount <= 0n) throw new Error('Сумма больше нуля');
    if (paid + amount > total) throw new Error('Сумма больше остатка к оплате');
    const paidAfter = paid + amount;
    return {
        paidAfter,
        close: status === 'SERVED' && paidAfter === total
    };
}
function orderRefund(status, paidNet, amount) {
    if (status !== 'CLOSED') throw new Error('Возврат оформляют по закрытому заказу: до этого аннулируйте платёж');
    if (amount <= 0n) throw new Error('Сумма больше нуля');
    if (amount > paidNet) throw new Error('Сумма больше оплаченного по заказу');
}
function foodCashBalances(payments, operations) {
    const out = Object.fromEntries(FOOD_PAYMENT_METHODS.map((m)=>[
            m,
            0n
        ]));
    const add = (m, v)=>out[m] = (out[m] ?? 0n) + v;
    for (const p of payments)if (p.status === 'COMPLETED') add(p.method, p.amount);
    for (const o of operations){
        if (o.status !== 'COMPLETED') continue;
        if (o.kind === 'INCOME') add(o.method, o.amount);
        else add(o.method, -o.amount);
        if (o.kind === 'TRANSFER' && o.methodTo) add(o.methodTo, o.amount);
    }
    return out;
}
function payoutCheck(due, paid, amount) {
    if (amount <= 0n) throw new Error('Сумма больше нуля');
    if (amount > due - paid) throw new Error('Сумма больше остатка к выплате');
}
function amountOf(v, min) {
    if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < min) throw new Error('Сумма — целое число minor units');
    return BigInt(v);
}
function methodOf(v) {
    if (!FOOD_PAYMENT_METHODS.includes(v)) throw new Error('Неизвестный способ оплаты');
    return v;
}
const noteOf = (v)=>v == null ? null : (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodText"])(v, 500);
function parseFoodPayment(raw) {
    const b = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodObject"])(raw, [
        'method',
        'amount',
        'idempotencyKey'
    ]);
    return {
        method: methodOf(b.method),
        amount: amountOf(b.amount, 1),
        idempotencyKey: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodText"])(b.idempotencyKey, 100)
    };
}
function parseFoodCashOperation(raw) {
    const b = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodObject"])(raw, [
        'kind',
        'method',
        'methodTo',
        'amount',
        'note'
    ]);
    if (!FOOD_CASH_KINDS.includes(b.kind)) throw new Error('Неизвестный вид операции');
    const kind = b.kind;
    const method = methodOf(b.method);
    let methodTo = null;
    if (kind === 'TRANSFER') {
        methodTo = methodOf(b.methodTo);
        if (methodTo === method) throw new Error('Перевод в тот же способ');
    } else if (b.methodTo != null) throw new Error('Способ «куда» только у перевода');
    return {
        kind,
        method,
        methodTo,
        amount: amountOf(b.amount, 1),
        note: noteOf(b.note)
    };
}
function parseFoodReconciliation(raw) {
    const b = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodObject"])(raw, [
        'method',
        'counted',
        'note'
    ]);
    return {
        method: methodOf(b.method),
        counted: amountOf(b.counted, 0),
        note: noteOf(b.note)
    };
}
function parseFoodPayout(raw) {
    const b = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodObject"])(raw, [
        'period',
        'method',
        'amount'
    ]);
    const period = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodText"])(b.period, 7);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new Error('Период в формате ГГГГ-ММ');
    return {
        period: `${period}-01`,
        method: methodOf(b.method),
        amount: amountOf(b.amount, 1)
    };
}
}),
"[project]/wt-personnel/packages/domain/src/food/consumption.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "foodCostSummary",
    ()=>foodCostSummary,
    "orderConsumption",
    ()=>orderConsumption,
    "splitShortage",
    ()=>splitShortage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$stock$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/food/stock.ts [app-ssr] (ecmascript)");
;
function orderConsumption(lines) {
    const need = new Map();
    for (const line of lines)for (const i of line.ingredients){
        if (!i.productId) continue;
        need.set(i.productId, (need.get(i.productId) ?? 0n) + (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$stock$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["milliOf"])(i.normQty) * BigInt(line.qty));
    }
    return need;
}
function splitShortage(available, need) {
    const take = available < need ? available > 0n ? available : 0n : need;
    return {
        take,
        shortage: need - take
    };
}
function foodCostSummary(revenueMinor, movements) {
    let cost = 0n;
    const short = new Map();
    for (const m of movements){
        if (m.lotId && (m.kind === 'CONSUMPTION' || m.kind === 'CONSUMPTION_RETURN')) cost -= m.cost;
        if (!m.lotId && (m.kind === 'SHORTAGE' || m.kind === 'CONSUMPTION_RETURN')) short.set(m.productId, (short.get(m.productId) ?? 0n) - (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$stock$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["milliOf"])(m.qty));
    }
    return {
        costMinor: cost,
        grossProfitMinor: revenueMinor - cost,
        foodCostPct: revenueMinor > 0n ? Number((cost * 100n + revenueMinor / 2n) / revenueMinor) : null,
        shortages: [
            ...short.entries()
        ].filter(([, milli])=>milli > 0n).map(([productId, milli])=>({
                productId,
                milli
            }))
    };
}
}),
"[project]/wt-personnel/packages/domain/src/food/customer-marks.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "birthdayInDays",
    ()=>birthdayInDays,
    "parseCustomerMarks",
    ()=>parseCustomerMarks
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/food/food.ts [app-ssr] (ecmascript)");
;
/** VIP-метка и день рождения клиента (DATA_MODEL §36, ADR-166). Даты — `ГГГГ-ММ-ДД` по дню филиала. */ const ymd = (s)=>s.split('-').map(Number);
const leap = (y)=>y % 4 === 0 && y % 100 !== 0 || y % 400 === 0;
/** День рождения в году `y`: 29 февраля в невисокосный год — 28-го */ const birthdayIn = (y, m, d)=>Date.UTC(y, m - 1, m === 2 && d === 29 && !leap(y) ? 28 : d);
function birthdayInDays(birthDate, today) {
    const [, m, d] = ymd(birthDate);
    const [y, tm, td] = ymd(today);
    const now = Date.UTC(y, tm - 1, td);
    let next = birthdayIn(y, m, d);
    if (next < now) next = birthdayIn(y + 1, m, d);
    return Math.round((next - now) / 86_400_000);
}
function realDate(v) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}
function parseCustomerMarks(raw, today) {
    const b = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodObject"])(raw, [
        'isVip',
        'birthDate'
    ]);
    const out = {};
    if (b.isVip !== undefined) {
        if (typeof b.isVip !== 'boolean') throw new Error('Метка VIP: да или нет');
        out.isVip = b.isVip;
    }
    if (b.birthDate !== undefined) {
        if (b.birthDate === null) out.birthDate = null;
        else {
            if (typeof b.birthDate !== 'string' || !realDate(b.birthDate)) throw new Error('Дата рождения в формате ГГГГ-ММ-ДД');
            if (b.birthDate < '1900-01-01' || b.birthDate > today) throw new Error('Дата рождения не в будущем и не раньше 1900 года');
            out.birthDate = b.birthDate;
        }
    }
    if (Object.keys(out).length === 0) throw new Error('Нечего менять');
    return out;
}
}),
"[project]/wt-personnel/packages/domain/src/food/food.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "FOOD_STATUSES",
    ()=>FOOD_STATUSES,
    "FOOD_UUID",
    ()=>FOOD_UUID,
    "foodCapacity",
    ()=>foodCapacity,
    "foodClock",
    ()=>foodClock,
    "foodEnd",
    ()=>foodEnd,
    "foodFingerprint",
    ()=>foodFingerprint,
    "foodId",
    ()=>foodId,
    "foodInstant",
    ()=>foodInstant,
    "foodInt",
    ()=>foodInt,
    "foodLocal",
    ()=>foodLocal,
    "foodNext",
    ()=>foodNext,
    "foodObject",
    ()=>foodObject,
    "foodText",
    ()=>foodText,
    "parseFoodCatalog",
    ()=>parseFoodCatalog,
    "parseFoodCreate",
    ()=>parseFoodCreate
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:crypto [external] (node:crypto, cjs)");
;
const FOOD_STATUSES = [
    'BOOKED',
    'CONFIRMED',
    'SEATED',
    'COMPLETED',
    'NO_SHOW',
    'CANCELLED'
];
const FOOD_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function foodNext(status) {
    return ({
        BOOKED: [
            'CONFIRMED',
            'SEATED',
            'CANCELLED',
            'NO_SHOW'
        ],
        CONFIRMED: [
            'SEATED',
            'CANCELLED',
            'NO_SHOW'
        ],
        SEATED: [
            'COMPLETED'
        ],
        COMPLETED: [],
        NO_SHOW: [],
        CANCELLED: []
    })[status];
}
const foodCapacity = (party, capacity)=>party > 0 && party <= capacity;
function foodObject(raw, allowed) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Пришлите объект');
    const b = raw;
    if (Object.keys(b).some((k)=>!allowed.includes(k))) throw new Error('Неизвестное поле запроса');
    return b;
}
function foodText(v, max) {
    if (typeof v !== 'string' || !v.trim() || v.trim().length > max) throw new Error('Некорректный текст');
    return v.trim();
}
function foodId(v) {
    if (typeof v !== 'string' || !FOOD_UUID.test(v)) throw new Error('Некорректный идентификатор');
    return v.toLowerCase();
}
function foodInt(v, min = 1, max = 2147483647) {
    if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) throw new Error('Некорректное целое число');
    return v;
}
function foodInstant(v) {
    if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.test(v) || !Number.isFinite(Date.parse(v))) throw new Error('Нужна дата и время с часовым поясом');
    const date = v.slice(0, 10);
    if (new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) !== date || Number(v.slice(11, 13)) > 23) throw new Error('Некорректная календарная дата');
    return new Date(v).toISOString();
}
function foodClock(v) {
    if (typeof v !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) throw new Error('Время в формате ЧЧ:ММ');
    return v;
}
function parseFoodCatalog(kind, raw, partial = false) {
    const keys = kind === 'area' ? [
        'name',
        'sortOrder',
        'active'
    ] : kind === 'table' ? [
        'areaId',
        'name',
        'capacity',
        'sortOrder',
        'active'
    ] : [
        'name',
        'weekday',
        'timeFrom',
        'timeTo',
        'endsNextDay',
        'defaultDurationMinutes',
        'active'
    ];
    const b = foodObject(raw, partial ? keys.filter((k)=>k !== 'areaId') : keys);
    const out = {};
    if (!partial || b.name !== undefined) out.name = foodText(b.name, kind === 'area' ? 200 : 100);
    if (b.sortOrder !== undefined) out.sortOrder = foodInt(b.sortOrder, -2147483648);
    for (const k of [
        'active',
        'endsNextDay'
    ])if (b[k] !== undefined) {
        if (typeof b[k] !== 'boolean') throw new Error('Нужно логическое значение');
        out[k] = b[k];
    }
    if (kind === 'table') {
        if (!partial) out.areaId = foodId(b.areaId);
        if (!partial || b.capacity !== undefined) out.capacity = foodInt(b.capacity);
    }
    if (kind === 'period') {
        if (!partial || b.weekday !== undefined) out.weekday = foodInt(b.weekday, 0, 6);
        if (!partial || b.timeFrom !== undefined) out.timeFrom = foodClock(b.timeFrom);
        if (!partial || b.timeTo !== undefined) out.timeTo = foodClock(b.timeTo);
        if (!partial || b.defaultDurationMinutes !== undefined) out.defaultDurationMinutes = foodInt(b.defaultDurationMinutes);
        if (!partial && !out.endsNextDay && out.timeTo <= out.timeFrom) throw new Error('Конец периода должен быть позже начала');
    }
    return out;
}
function parseFoodCreate(raw) {
    const b = foodObject(raw, [
        'servicePeriodId',
        'startsAt',
        'partySize',
        'customerId',
        'customer',
        'tableId',
        'notes',
        'source'
    ]);
    if (b.customerId !== undefined === (b.customer !== undefined)) throw new Error('Выберите клиента или создайте нового');
    const out = {
        servicePeriodId: foodId(b.servicePeriodId),
        startsAt: foodInstant(b.startsAt),
        partySize: foodInt(b.partySize),
        tableId: b.tableId == null ? null : foodId(b.tableId),
        notes: b.notes == null ? null : foodText(b.notes, 4000),
        source: 'DESK'
    };
    if (b.source !== undefined && b.source !== 'DESK' && b.source !== 'WALK_IN') throw new Error('Неизвестный источник');
    out.source = b.source ?? 'DESK';
    if (out.source === 'WALK_IN' && !out.tableId) throw new Error('Для walk-in нужен стол');
    if (b.customerId !== undefined) out.customerId = foodId(b.customerId);
    else {
        const c = foodObject(b.customer, [
            'firstName',
            'lastName',
            'phone'
        ]);
        out.customer = {
            firstName: foodText(c.firstName, 100),
            lastName: c.lastName == null ? null : foodText(c.lastName, 100),
            phone: c.phone == null ? null : foodText(c.phone, 32)
        };
    }
    return out;
}
const foodFingerprint = (input)=>(0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["createHash"])('sha256').update(JSON.stringify(input)).digest('hex');
function foodLocal(at, tz) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23'
    }).formatToParts(at);
    const get = (k)=>parts.find((p)=>p.type === k).value;
    const date = `${get('year')}-${get('month')}-${get('day')}`;
    return {
        date,
        stamp: Date.parse(`${date}T${get('hour')}:${get('minute')}:${get('second')}Z`) + at.getUTCMilliseconds()
    };
}
function foodEnd(period, startsAt, tz) {
    const start = new Date(startsAt), end = new Date(start.getTime() + period.defaultDurationMinutes * 60000);
    if (!Number.isFinite(end.getTime())) throw new Error('Некорректная длительность');
    const local = foodLocal(start, tz), finish = foodLocal(end, tz).stamp;
    const midnight = Date.parse(local.date + 'T00:00:00Z');
    const mins = (time)=>Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
    for (const offset of [
        0,
        -1
    ]){
        const day = midnight + offset * 86400000;
        if (new Date(day).getUTCDay() !== period.weekday) continue;
        const from = day + mins(period.timeFrom) * 60000, to = day + (period.endsNextDay ? 86400000 : 0) + mins(period.timeTo) * 60000;
        if (local.stamp >= from && local.stamp < to && finish <= to && finish >= from) return end;
    }
    throw new Error('Бронь не помещается в период обслуживания');
}
}),
"[project]/wt-personnel/packages/domain/src/food/layout.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "LAYOUT_SIZE",
    ()=>LAYOUT_SIZE,
    "TABLE_SHAPES",
    ()=>TABLE_SHAPES,
    "layoutSpots",
    ()=>layoutSpots,
    "parseAreaLayout",
    ()=>parseAreaLayout,
    "tableShapeOf",
    ()=>tableShapeOf
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/food/food.ts [app-ssr] (ecmascript)");
;
const LAYOUT_SIZE = 1000;
const TABLE_SHAPES = [
    'ROUND',
    'SQUARE',
    'RECT'
];
function tableShapeOf(t) {
    return t.shape ?? (t.capacity <= 2 ? 'ROUND' : t.capacity <= 4 ? 'SQUARE' : 'RECT');
}
function layoutSpots(tables) {
    const out = new Map();
    const free = tables.filter((t)=>t.posX === null || t.posY === null);
    const rows = Math.max(1, Math.ceil(free.length / 5));
    free.forEach((t, i)=>out.set(t.id, {
            x: 100 + i % 5 * 200,
            y: Math.round((Math.floor(i / 5) + 0.5) * LAYOUT_SIZE / rows)
        }));
    for (const t of tables)if (t.posX !== null && t.posY !== null) out.set(t.id, {
        x: t.posX,
        y: t.posY
    });
    return out;
}
function parseAreaLayout(raw) {
    const b = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodObject"])(raw, [
        'tables'
    ]);
    if (!Array.isArray(b.tables) || b.tables.length === 0 || b.tables.length > 300) throw new Error('Пришлите столы зоны списком');
    const seen = new Set();
    return b.tables.map((row)=>{
        const t = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodObject"])(row, [
            'id',
            'posX',
            'posY',
            'shape',
            'scale',
            'rotation'
        ]);
        const id = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodId"])(t.id);
        if (seen.has(id)) throw new Error('Стол указан дважды');
        seen.add(id);
        if (t.shape !== null && !TABLE_SHAPES.includes(t.shape)) throw new Error('Форма стола: круг, квадрат или прямоугольник');
        if (t.rotation !== 0 && t.rotation !== 90) throw new Error('Поворот стола: 0 или 90 градусов');
        return {
            id,
            posX: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodInt"])(t.posX, 0, LAYOUT_SIZE),
            posY: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodInt"])(t.posY, 0, LAYOUT_SIZE),
            shape: t.shape ?? null,
            scale: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodInt"])(t.scale, 50, 200),
            rotation: t.rotation
        };
    });
}
}),
"[project]/wt-personnel/packages/domain/src/food/ratings.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "parseOrderRating",
    ()=>parseOrderRating,
    "ratingSummary",
    ()=>ratingSummary
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/food/food.ts [app-ssr] (ecmascript)");
;
function parseOrderRating(raw) {
    const b = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodObject"])(raw, [
        'stars',
        'comment'
    ]);
    if (typeof b.stars !== 'number' || !Number.isInteger(b.stars) || b.stars < 1 || b.stars > 5) throw new Error('Оценка: от 1 до 5 звёзд');
    const comment = b.comment == null || typeof b.comment === 'string' && !b.comment.trim() ? null : (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodText"])(b.comment, 500);
    return {
        stars: b.stars,
        comment
    };
}
function ratingSummary(stars) {
    if (!stars.length) return {
        average: null,
        count: 0
    };
    return {
        average: Math.round(stars.reduce((a, b)=>a + b, 0) / stars.length * 10) / 10,
        count: stars.length
    };
}
}),
"[project]/wt-personnel/packages/domain/src/food/restaurant.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "INGREDIENT_UNITS",
    ()=>INGREDIENT_UNITS,
    "ORDER_DELAY_MINUTES",
    ()=>ORDER_DELAY_MINUTES,
    "ORDER_STATUSES",
    ()=>ORDER_STATUSES,
    "PAY_MODELS",
    ()=>PAY_MODELS,
    "ingredientCost",
    ()=>ingredientCost,
    "orderDelayed",
    ()=>orderDelayed,
    "orderNext",
    ()=>orderNext,
    "parseIngredientInput",
    ()=>parseIngredientInput,
    "parseMenuCategoryInput",
    ()=>parseMenuCategoryInput,
    "parseMenuItemInput",
    ()=>parseMenuItemInput,
    "parseOrderCreate",
    ()=>parseOrderCreate,
    "parseOrderItems",
    ()=>parseOrderItems,
    "parsePayAdjustment",
    ()=>parsePayAdjustment,
    "parsePaySettings",
    ()=>parsePaySettings,
    "payrollTotals",
    ()=>payrollTotals,
    "techCardTotals",
    ()=>techCardTotals
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/food/food.ts [app-ssr] (ecmascript)");
;
const ORDER_STATUSES = [
    'NEW',
    'COOKING',
    'READY',
    'SERVED',
    'CLOSED',
    'CANCELLED'
];
const ORDER_DELAY_MINUTES = 20;
function orderNext(status) {
    return ({
        NEW: [
            'COOKING',
            'CANCELLED'
        ],
        COOKING: [
            'READY',
            'CANCELLED'
        ],
        READY: [
            'SERVED',
            'CANCELLED'
        ],
        SERVED: [
            'CLOSED'
        ],
        CLOSED: [],
        CANCELLED: []
    })[status];
}
function orderDelayed(status, openedAt, now) {
    return (status === 'NEW' || status === 'COOKING') && now.getTime() - openedAt.getTime() >= ORDER_DELAY_MINUTES * 60000;
}
const INGREDIENT_UNITS = [
    'г',
    'мл',
    'шт'
];
/** Округление половины вверх на неотрицательных значениях */ const divRound = (a, b)=>(a + b / 2n) / b;
/** Норма приходит numeric(12,3) строкой; тысячные доли держим целым числом */ function qtyMilli(normQty) {
    if (!/^\d{1,9}(\.\d{1,3})?$/.test(normQty)) throw new Error('Некорректная норма');
    const [whole = '0', frac = ''] = normQty.split('.');
    const milli = BigInt(whole) * 1000n + BigInt(frac.padEnd(3, '0'));
    if (milli <= 0n) throw new Error('Некорректная норма');
    return milli;
}
function ingredientCost(row) {
    const milli = qtyMilli(row.normQty);
    return row.unit === 'шт' ? divRound(milli * row.unitCost, 1000n) : divRound(milli * row.unitCost, 1000000n);
}
function techCardTotals(price, rows) {
    const cost = rows.reduce((sum, row)=>sum + ingredientCost(row), 0n);
    return {
        cost,
        profit: price - cost,
        foodCostPct: price > 0n ? Number(divRound(cost * 100n, price)) : null,
        marginPct: cost > 0n ? Number(divRound((price - cost) * 100n, cost)) : null
    };
}
const PAY_MODELS = [
    'FIXED',
    'PERCENT',
    'FIXED_PLUS_PERCENT',
    'BONUS_ONLY'
];
function payrollTotals(setting, closedOrdersTotal, adjustments) {
    const base = setting.model === 'FIXED' || setting.model === 'FIXED_PLUS_PERCENT' ? setting.fixedMinor : 0n;
    const percentPart = setting.model === 'PERCENT' || setting.model === 'FIXED_PLUS_PERCENT' ? divRound(closedOrdersTotal * BigInt(setting.percent), 100n) : 0n;
    const bonus = adjustments.filter((a)=>a > 0n).reduce((s, a)=>s + a, 0n);
    const penalty = adjustments.filter((a)=>a < 0n).reduce((s, a)=>s + a, 0n);
    return {
        base,
        percentPart,
        bonus,
        penalty,
        total: base + percentPart + bonus + penalty
    };
}
function money(v, min = 0) {
    if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < min) throw new Error('Деньги — целое число minor units');
    return BigInt(v);
}
function parseMenuCategoryInput(raw, partial = false) {
    const b = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodObject"])(raw, [
        'name',
        'sortOrder',
        'active'
    ]);
    const out = {};
    if (!partial || b.name !== undefined) out.name = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodText"])(b.name, 100);
    if (b.sortOrder !== undefined) out.sortOrder = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodInt"])(b.sortOrder, -2147483648);
    if (b.active !== undefined) {
        if (typeof b.active !== 'boolean') throw new Error('Нужно логическое значение');
        out.active = b.active;
    }
    return out;
}
function parseMenuItemInput(raw, partial = false) {
    const b = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodObject"])(raw, [
        'categoryId',
        'name',
        'weightGrams',
        'price',
        'active',
        'techNotes',
        'sortOrder'
    ]);
    const out = {};
    if (!partial || b.categoryId !== undefined) out.categoryId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodId"])(b.categoryId);
    if (!partial || b.name !== undefined) out.name = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodText"])(b.name, 200);
    if (!partial || b.price !== undefined) out.price = money(b.price);
    if (b.weightGrams !== undefined) out.weightGrams = b.weightGrams === null ? null : (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodInt"])(b.weightGrams);
    if (b.techNotes !== undefined) out.techNotes = b.techNotes === null ? null : (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodText"])(b.techNotes, 8000);
    if (b.sortOrder !== undefined) out.sortOrder = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodInt"])(b.sortOrder, -2147483648);
    if (b.active !== undefined) {
        if (typeof b.active !== 'boolean') throw new Error('Нужно логическое значение');
        out.active = b.active;
    }
    return out;
}
function parseIngredientInput(raw) {
    const b = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodObject"])(raw, [
        'name',
        'normQty',
        'unit',
        'unitCost',
        'sortOrder',
        'productId'
    ]);
    if (!INGREDIENT_UNITS.includes(b.unit)) throw new Error('Единица: г, мл или шт');
    const normQty = typeof b.normQty === 'number' ? String(b.normQty) : (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodText"])(b.normQty, 13);
    qtyMilli(normQty);
    const out = {
        name: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodText"])(b.name, 200),
        normQty,
        unit: b.unit,
        unitCost: money(b.unitCost)
    };
    if (b.sortOrder !== undefined) out.sortOrder = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodInt"])(b.sortOrder, -2147483648);
    if (b.productId !== undefined) out.productId = b.productId === null ? null : (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodId"])(b.productId);
    return out;
}
function parseOrderItems(raw) {
    if (!Array.isArray(raw) || raw.length === 0) throw new Error('Добавьте хотя бы одно блюдо');
    if (raw.length > 100) throw new Error('Слишком много строк заказа');
    return raw.map((item)=>{
        const b = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodObject"])(item, [
            'menuItemId',
            'qty',
            'notes'
        ]);
        return {
            menuItemId: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodId"])(b.menuItemId),
            qty: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodInt"])(b.qty, 1, 999),
            notes: b.notes == null ? null : (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodText"])(b.notes, 500)
        };
    });
}
function parseOrderCreate(raw) {
    const b = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodObject"])(raw, [
        'tableId',
        'waiterId',
        'guestCount',
        'notes',
        'items'
    ]);
    return {
        tableId: b.tableId == null ? null : (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodId"])(b.tableId),
        waiterId: b.waiterId == null ? null : (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodId"])(b.waiterId),
        guestCount: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodInt"])(b.guestCount, 1, 1000),
        notes: b.notes == null ? null : (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodText"])(b.notes, 4000),
        items: parseOrderItems(b.items)
    };
}
function parsePaySettings(raw) {
    const b = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodObject"])(raw, [
        'model',
        'fixedMinor',
        'percent'
    ]);
    if (!PAY_MODELS.includes(b.model)) throw new Error('Неизвестная модель оплаты');
    return {
        model: b.model,
        fixedMinor: money(b.fixedMinor),
        percent: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodInt"])(b.percent, 0, 100)
    };
}
function parsePayAdjustment(raw) {
    const b = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodObject"])(raw, [
        'period',
        'amountMinor',
        'reason'
    ]);
    const period = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodText"])(b.period, 7);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new Error('Период в формате ГГГГ-ММ');
    if (typeof b.amountMinor !== 'number' || !Number.isSafeInteger(b.amountMinor) || !b.amountMinor) throw new Error('Сумма — целое число minor units, не ноль');
    return {
        period: `${period}-01`,
        amountMinor: BigInt(b.amountMinor),
        reason: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodText"])(b.reason, 200)
    };
}
}),
"[project]/wt-personnel/packages/domain/src/food/stock.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "allocateStock",
    ()=>allocateStock,
    "inventoryDelta",
    ()=>inventoryDelta,
    "milliOf",
    ()=>milliOf,
    "milliText",
    ()=>milliText,
    "parseInventory",
    ()=>parseInventory,
    "parseKitchenProduct",
    ()=>parseKitchenProduct,
    "parseKitchenReceipt",
    ()=>parseKitchenReceipt,
    "parseWriteOff",
    ()=>parseWriteOff,
    "stockCost",
    ()=>stockCost,
    "stockDate",
    ()=>stockDate,
    "stockQty",
    ()=>stockQty,
    "surplusUnitCost",
    ()=>surplusUnitCost
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/food/food.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$restaurant$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/food/restaurant.ts [app-ssr] (ecmascript)");
;
;
function stockQty(v, allowZero = false) {
    const raw = typeof v === 'number' ? String(v) : typeof v === 'string' ? v.trim().replace(',', '.') : '';
    // до 9 целых знаков: тот же предел, что у нормы техкарты (ingredientCost)
    if (!/^\d{1,9}(\.\d{1,3})?$/.test(raw)) throw new Error('Количество: число, не больше трёх знаков после запятой');
    const [whole = '0', frac = ''] = raw.split('.');
    const milli = BigInt(whole) * 1000n + BigInt(frac.padEnd(3, '0'));
    if (milli === 0n && !allowZero) throw new Error('Количество должно быть больше нуля');
    return milli;
}
function milliText(milli) {
    const neg = milli < 0n;
    const abs = neg ? -milli : milli;
    const frac = (abs % 1000n).toString().padStart(3, '0').replace(/0+$/, '');
    return `${neg ? '-' : ''}${abs / 1000n}${frac ? `.${frac}` : ''}`;
}
function milliOf(v) {
    const s = typeof v === 'string' ? v : v.toString();
    const neg = s.startsWith('-');
    const milli = stockQty(neg ? s.slice(1) : s, true);
    return neg ? -milli : milli;
}
function stockCost(milli, unit, unitCost) {
    if (milli === 0n) return 0n;
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$restaurant$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ingredientCost"])({
        normQty: milliText(milli),
        unit,
        unitCost
    });
}
function allocateStock(lots, milli, unit) {
    if (milli <= 0n) throw new Error('Количество должно быть больше нуля');
    const available = lots.reduce((sum, lot)=>sum + (lot.remaining > 0n ? lot.remaining : 0n), 0n);
    if (available < milli) throw new Error(`Недостаточно на складе: есть ${milliText(available)} ${unit}, нужно ${milliText(milli)} ${unit}`);
    const ordered = [
        ...lots
    ].sort((a, b)=>a.receivedOn.localeCompare(b.receivedOn) || a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
    let left = milli;
    const allocations = [];
    for (const lot of ordered){
        if (left === 0n) break;
        if (lot.remaining <= 0n) continue;
        const take = lot.remaining < left ? lot.remaining : left;
        allocations.push({
            lotId: lot.id,
            milli: take,
            cost: stockCost(take, unit, lot.unitCost)
        });
        left -= take;
    }
    return {
        allocations,
        cost: allocations.reduce((sum, a)=>sum + a.cost, 0n)
    };
}
function surplusUnitCost(lots) {
    // Keep the accumulator dynamic for Next NFT: it otherwise folds the guarded average with qty = 0n.
    let qty = BigInt(0), sum = 0n;
    for (const l of lots){
        qty += l.remaining;
        sum += l.remaining * l.unitCost;
    }
    if (qty <= 0n) return null;
    const avg = (sum + qty / 2n) / qty;
    return avg > 0n ? avg : 1n;
}
function inventoryDelta(onHand, actual) {
    if (actual === onHand) return {
        kind: 'equal'
    };
    return actual < onHand ? {
        kind: 'shortage',
        milli: onHand - actual
    } : {
        kind: 'surplus',
        milli: actual - onHand
    };
}
function stockUnit(v) {
    if (typeof v !== 'string' || !__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$restaurant$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["INGREDIENT_UNITS"].some((u)=>u === v)) throw new Error('Единица: г, мл или шт');
    return v;
}
function stockDate(v) {
    const d = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodText"])(v, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !Number.isFinite(Date.parse(d)) || new Date(d).toISOString().slice(0, 10) !== d) throw new Error('Нужна календарная дата');
    return d;
}
/** Цена партии в minor units за кг, л или штуку: целое, больше нуля */ function stockPrice(v) {
    const raw = typeof v === 'number' ? v : typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : NaN;
    if (!Number.isSafeInteger(raw) || raw <= 0) throw new Error('Цена: целое число тиынов больше нуля');
    return BigInt(raw);
}
function parseKitchenProduct(raw, partial = false) {
    const b = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodObject"])(raw, [
        'name',
        'unit',
        'minQty',
        'active'
    ]);
    const out = {};
    if (!partial || b.name !== undefined) out.name = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodText"])(b.name, 200);
    if (!partial || b.unit !== undefined) out.unit = stockUnit(b.unit);
    if (b.minQty !== undefined) out.minQty = stockQty(b.minQty, true);
    if (b.active !== undefined) {
        if (typeof b.active !== 'boolean') throw new Error('Нужно логическое значение');
        out.active = b.active;
    }
    return out;
}
function parseKitchenReceipt(raw) {
    const b = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodObject"])(raw, [
        'supplier',
        'document',
        'receivedOn',
        'lines'
    ]);
    if (!Array.isArray(b.lines) || b.lines.length === 0 || b.lines.length > 50) throw new Error('В приходе от 1 до 50 строк');
    return {
        supplier: b.supplier == null || b.supplier === '' ? null : (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodText"])(b.supplier, 200),
        document: b.document == null || b.document === '' ? null : (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodText"])(b.document, 100),
        receivedOn: b.receivedOn == null || b.receivedOn === '' ? null : stockDate(b.receivedOn),
        lines: b.lines.map((line)=>{
            const l = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodObject"])(line, [
                'productId',
                'qty',
                'unitCost',
                'expiresOn'
            ]);
            return {
                productId: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodId"])(l.productId),
                qty: stockQty(l.qty),
                unitCost: stockPrice(l.unitCost),
                expiresOn: l.expiresOn == null || l.expiresOn === '' ? null : stockDate(l.expiresOn)
            };
        })
    };
}
function parseWriteOff(raw) {
    const b = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodObject"])(raw, [
        'productId',
        'qty',
        'reason'
    ]);
    return {
        productId: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodId"])(b.productId),
        qty: stockQty(b.qty),
        reason: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodText"])(b.reason, 500)
    };
}
function parseInventory(raw) {
    const b = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodObject"])(raw, [
        'productId',
        'actualQty',
        'reason',
        'unitCost'
    ]);
    return {
        productId: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodId"])(b.productId),
        actualQty: stockQty(b.actualQty, true),
        reason: b.reason == null || b.reason === '' ? null : (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["foodText"])(b.reason, 500),
        // цена излишка вручную, когда остатка нет (Q-KITCHEN-9); в тех же единицах, что у прихода
        unitCost: b.unitCost == null ? null : stockPrice(b.unitCost)
    };
}
}),
"[project]/wt-personnel/packages/domain/src/guests/index.ts [app-ssr] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
;
;
;
}),
"[project]/wt-personnel/packages/domain/src/housekeeping/index.ts [app-ssr] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
;
}),
"[project]/wt-personnel/packages/domain/src/incidents/index.ts [app-ssr] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

/** Неисправности системы (срез 11, ADR-028): политика сторожа, будильник, маскирование, сигналы. */ __turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$incidents$2f$redact$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/incidents/redact.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$incidents$2f$signals$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/incidents/signals.ts [app-ssr] (ecmascript)");
;
;
;
;
;
}),
"[project]/wt-personnel/packages/domain/src/incidents/redact.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "redactDetails",
    ()=>redactDetails,
    "redactText",
    ()=>redactText
]);
/**
 * Маскирование того, что уходит в неисправность и в сообщение (DATA_MODEL §12). Два правила:
 * поле, по имени похожее на персональные данные гостя или карту, скрывается целиком; в тексте маскируются
 * секреты — JWT, Bearer, пароль в строке подключения, длинные ключи. UUID и номера броней остаются: без них
 * неисправность не разобрать.
 */ var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$shared$2f$src$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/packages/shared/src/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$shared$2f$src$2f$pii$2d$residency$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/shared/src/pii-residency.ts [app-ssr] (ecmascript)");
;
const MAX_TEXT = 500;
const MAX_DEPTH = 4;
const MAX_ITEMS = 20;
const HIDDEN = '[скрыто]';
const PII_KEY = /name|surname|phone|e-?mail|mail|passport|document|birth|address|card|guarantee|cvv|customer|guest|token|secret|password|api[-_]?key/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function redactText(text, max = MAX_TEXT) {
    // Маскируем не больше, чем может попасть в ответ, с запасом на то, что маска укорачивает: раньше маска шла по всему
    // тексту — эхо ввода в 100 КБ стоило секунд остановленного API (аудит 26.09, С-38). Недописанное последнее слово
    // отбрасывается, чтобы на границе не осталось почты или ключа без маски.
    const limit = Math.max(max * 4, 2_000);
    let head = text.length > limit ? text.slice(0, limit) : text;
    if (head.length < text.length) {
        const tail = head.search(/\S*$/);
        // Короткий хвост — разрезанная почта или ключ, отбрасывается. От длинного слова остаётся только начало до первого
        // знака препинания: обрубок почты или адреса в его конце («…@mail» без окончания) под маску уже не подходит
        // (проверка исправлений 26.09), а начало из букв и цифр снимет правило длинных ключей
        if (head.length - tail < 200) head = head.slice(0, tail);
        else head = head.slice(0, tail) + /^[\w-]*/.exec(head.slice(tail))[0];
    }
    // Выражения начинаются на границе слова: без якоря каждое перебирало все позиции длинного слова
    const masked = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$shared$2f$src$2f$pii$2d$residency$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["maskContacts"])(head.replace(/(?<![\w-])eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[jwt]').replace(/\b(Bearer|Basic)\s+\S+/gi, '$1 [скрыто]').replace(/(?<!\w)(\w+:\/\/[^\s:/@]+:)[^\s@/]+@/g, '$1***@').replace(/[A-Za-z0-9_-]{32,}/g, (m)=>UUID.test(m) ? m : `${m.slice(0, 4)}…`));
    return masked.length > max || head.length < text.length ? `${masked.slice(0, max)}…` : masked;
}
function redactDetails(value, depth = 0) {
    if (value === null || value === undefined) return value;
    if (typeof value === 'string') return redactText(value);
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (typeof value === 'bigint') return value.toString();
    if (depth >= MAX_DEPTH) return '[…]';
    if (Array.isArray(value)) {
        const items = value.slice(0, MAX_ITEMS).map((v)=>redactDetails(v, depth + 1));
        return value.length > MAX_ITEMS ? [
            ...items,
            `… ещё ${value.length - MAX_ITEMS}`
        ] : items;
    }
    if (typeof value === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(value).slice(0, MAX_ITEMS))out[k] = PII_KEY.test(k) ? HIDDEN : redactDetails(v, depth + 1);
        return out;
    }
    return String(value);
}
}),
"[project]/wt-personnel/packages/domain/src/incidents/signals.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "BACKUP_STALE_MS",
    ()=>BACKUP_STALE_MS,
    "LOCAL_FILE_FRESH_MS",
    ()=>LOCAL_FILE_FRESH_MS,
    "channelOversold",
    ()=>channelOversold,
    "classifyError",
    ()=>classifyError,
    "failingSuites",
    ()=>failingSuites,
    "latestReportResults",
    ()=>latestReportResults,
    "narrowsTestSelection",
    ()=>narrowsTestSelection,
    "overbookedNights",
    ()=>overbookedNights,
    "parseBackupStatus",
    ()=>parseBackupStatus,
    "reportIsFresh",
    ()=>reportIsFresh,
    "suiteRunIsFresh",
    ()=>suiteRunIsFresh
]);
/**
 * Сигналы, из которых сторож собирает неисправности: текст ошибки (временная или постоянная), отчёты сверок,
 * журнал прогонов тестов, овербукинг по ночам. Всё — чистые функции над уже прочитанными данными.
 */ var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$chessboard$2f$build$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/chessboard/build.ts [app-ssr] (ecmascript)");
;
/**
 * Временная ошибка — сеть, таймаут, 5xx и 429 Channex, обрыв соединения с базой: повтор имеет смысл.
 * Всё остальное (правило ADR-024, валидация, 4xx, неизвестный текст) — постоянная: повторять бессмысленно,
 * нужен человек. Сомнение решается в сторону «постоянная» — лучше разбудить, чем крутить повтор.
 * Формы текста — из `packages/integrations/src/channex/client.ts`: «сеть — …» и «HTTP <код>».
 */ const TRANSIENT = [
    /сеть —/i,
    /\bHTTP (?:5\d\d|429)\b/,
    /fetch failed|socket hang up|network/i,
    /\bE(?:CONNRESET|CONNREFUSED|TIMEDOUT|NOTFOUND|AI_AGAIN|PIPE)\b/,
    /time(?:d)? ?out|aborted/i,
    /\bP(?:1001|1002|1017|2024)\b|Can't reach database|Connection terminated|terminating connection/i,
    /\b08006\b|\b08001\b|EAUTHTIMEOUT|Database error\. Code: `08/i,
    // Prisma P1017: код лежит в `e.code`, в тексте — только эта фраза. 20.09.2026 такой обрыв с Mac
    // разработчика записался неисправностью «ошибка программы» и ждал человека сутки.
    /Server has closed the connection|Connection reset by peer/i
];
function classifyError(text) {
    if (!text) return 'permanent';
    return TRANSIENT.some((re)=>re.test(text)) ? 'transient' : 'permanent';
}
const LOCAL_FILE_FRESH_MS = 48 * 3_600_000;
function reportIsFresh(file, now) {
    const day = /-(\d{4}-\d{2}-\d{2})\.md$/.exec(file)?.[1];
    const at = day ? Date.parse(`${day}T00:00:00Z`) : NaN;
    return Number.isFinite(at) && now.getTime() - at <= LOCAL_FILE_FRESH_MS;
}
function suiteRunIsFresh(startedAt, now) {
    const at = Date.parse(startedAt);
    return Number.isFinite(at) && now.getTime() - at <= LOCAL_FILE_FRESH_MS;
}
function latestReportResults(files, kinds, read) {
    const out = [];
    for (const kind of kinds){
        const re = new RegExp(`^${kind.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-\\d{4}-\\d{2}-\\d{2}\\.md$`);
        const file = files.filter((f)=>re.test(f)).sort().at(-1);
        if (!file) continue;
        const line = read(file).split('\n').find((l)=>/RESULT/.test(l))?.trim() ?? null;
        const result = line ? /FAIL/.test(line) ? 'FAIL' : /PASS/.test(line) ? 'PASS' : null : null;
        out.push({
            kind,
            file,
            result,
            line
        });
    }
    return out;
}
/**
 * Аргументы, сужающие набор тестов. Прогон с ними набор не доказывает — ни в плюс, ни в минус.
 * Флаги вида «как запускать» (сколько воркеров, какой отчёт, сколько повторов) набор не сужают:
 * на машине с 8 ГБ сквозные идут только `--workers=1`, и такой прогон обязан считаться полным,
 * иначе полного прогона на ней не бывает вовсе (15.09.2026: неисправность «падает e2e» висела двое суток).
 */ const NARROWING_FLAGS = new Set([
    '-g',
    '--grep',
    '--grep-invert',
    '-t',
    '--testNamePattern',
    '--project',
    '--config',
    '-c',
    '--dir',
    '--shard',
    '--last-failed',
    '--only-changed',
    '--changed'
]);
/** Флаги «как запускать», берущие значение отдельным словом: это слово — не путь к тестам */ const VALUE_FLAGS = new Set([
    '--workers',
    '-j',
    '--reporter',
    '--retries',
    '--timeout',
    '--global-timeout',
    '--max-failures',
    '--output',
    '--outputFile',
    '--trace'
]);
function narrowsTestSelection(args) {
    for(let i = 0; i < args.length; i++){
        const arg = args[i].trim();
        if (!arg) continue;
        // Позиционный аргумент — путь или кусок имени файла: это выбор конкретных тестов
        if (!arg.startsWith('-')) return true;
        const name = arg.split('=')[0];
        if (NARROWING_FLAGS.has(name)) return true;
        // Значение флага пропускаем, иначе «--workers 1» прочиталось бы как путь к тестам.
        // Незнакомый флаг со значением отдельным словом даст «сужает» — сторона безопасная:
        // такой прогон просто не засчитается как доказательство набора.
        if (VALUE_FLAGS.has(name) && !arg.includes('=')) i++;
    }
    return false;
}
function failingSuites(jsonl) {
    const last = new Map();
    for (const raw of jsonl.split('\n')){
        let r;
        try {
            r = JSON.parse(raw);
        } catch  {
            continue;
        }
        if (!r.suite || !r.startedAt || !r.status || narrowsTestSelection(r.args ?? []) || r.status === 'interrupted') continue;
        const prev = last.get(r.suite);
        if (!prev || r.startedAt >= prev.startedAt) last.set(r.suite, {
            status: r.status,
            startedAt: r.startedAt,
            failures: r.failures ?? []
        });
    }
    return [
        ...last.entries()
    ].filter(([, r])=>r.status === 'failed').map(([suite, r])=>({
            suite,
            startedAt: r.startedAt,
            failures: r.failures.length,
            first: r.failures[0] ? `${r.failures[0].file ?? '?'}: ${r.failures[0].message ?? ''}`.trim() : null
        }));
}
function overbookedNights(input) {
    const out = [];
    for (const u of input.units)for (const date of (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$chessboard$2f$build$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["dateRange"])(input.from, input.to)){
        const blocked = input.blocks.filter((b)=>b.accommodationTypeCode === u.code && b.dateFrom <= date && date < b.dateTo).length;
        const sold = input.items.filter((i)=>i.accommodationTypeCode === u.code && i.arrivalDate <= date && date < i.departureDate).length;
        const capacity = Math.max(0, u.active - blocked);
        if (sold > capacity) out.push({
            code: u.code,
            date,
            capacity,
            sold
        });
    }
    return out;
}
function channelOversold(input) {
    const out = [];
    for (const [code, perDate] of input.pms)for (const [date, pms] of perDate){
        const channel = input.channel.get(code)?.get(date);
        if (channel !== undefined && channel > pms) out.push({
            code,
            date,
            pms,
            channel
        });
    }
    return out;
}
const BACKUP_STALE_MS = 26 * 3_600_000;
const positiveInteger = (v)=>Number.isInteger(v) && v > 0;
function parseBackupStatus(text) {
    let raw;
    try {
        raw = JSON.parse(text);
    } catch  {
        return null;
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const { at, file, bytes, tables } = raw;
    if (typeof at !== 'string' || Number.isNaN(Date.parse(at))) return null;
    // только имя файла, без пути: статус описывает копию в своей папке
    if (typeof file !== 'string' || !/^[\w.-]+$/.test(file) || file.startsWith('.')) return null;
    if (!positiveInteger(bytes) || !positiveInteger(tables)) return null;
    return {
        at: new Date(at),
        file,
        bytes,
        tables
    };
}
}),
"[project]/wt-personnel/packages/domain/src/index.ts [app-ssr] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

/** @pms/domain — бизнес-логика PMS. Не знает про Channex/eQonaq/HTTP/Prisma. */ __turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$property$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/property/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$inventory$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/inventory/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$chessboard$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/chessboard/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$availability$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/availability/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$bar$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/bar/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$rates$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/rates/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$reservations$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/reservations/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$guests$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/guests/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$tasks$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/tasks/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$finance$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/finance/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$web$2d$analytics$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/web-analytics/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$web$2d$booking$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/web-booking/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$incidents$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/incidents/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$accounts$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/accounts/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$dashboard$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/dashboard/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$onboarding$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/onboarding/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$housekeeping$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/housekeeping/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$assistant$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/assistant/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$ai$2d$seller$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/ai-seller/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$ai$2d$agents$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/ai-agents/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$beauty$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/beauty/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$market$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/market/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$verticals$2f$registry$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/verticals/registry.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$food$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/food/food.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$restaurant$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/food/restaurant.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$stock$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/food/stock.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$consumption$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/food/consumption.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$ratings$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/food/ratings.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$cash$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/food/cash.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$customer$2d$marks$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/food/customer-marks.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$layout$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/food/layout.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$booking$2d$rules$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/food/booking-rules.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$customers$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/customers.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$customer$2d$import$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/customer-import.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$customer$2d$import$2d$job$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/customer-import-job.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$personnel$2d$revenue$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/personnel-revenue.ts [app-ssr] (ecmascript)");
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
}),
"[project]/wt-personnel/packages/domain/src/inventory/index.ts [app-ssr] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
;
;
}),
"[project]/wt-personnel/packages/domain/src/market/index.ts [app-ssr] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

/** Загрузка конкурентов (DATA_MODEL §23, ADR-142): разбор ввода, сводка «вы и рынок», подсказки. */ __turbopack_context__.s([]);
/** Цены конкурентов (DATA_MODEL §23.1, ADR-155): разбор ввода и ценовая доска. */ var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$market$2f$rates$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/market/rates.ts [app-ssr] (ecmascript)");
;
;
}),
"[project]/wt-personnel/packages/domain/src/market/occupancy.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Загрузка конкурентов (DATA_MODEL §23, ADR-142): разбор ввода и сводка «вы и рынок» по ночам.
 *
 * Проценты живут целыми базисными пунктами (85,5 % = 8 550), как деньги в тиынах (ADR-008): средние и разницы
 * считаются без чисел с плавающей точкой в хранении. Своя загрузка приходит готовыми клетками календаря
 * (занято, свободно, блок), тем же знаменателем, что «Аналитика → Загрузка».
 */ __turbopack_context__.s([
    "COMPETITOR_MONITORING",
    ()=>COMPETITOR_MONITORING,
    "FEW_LEFT_MAX",
    ()=>FEW_LEFT_MAX,
    "GAP_BP",
    ()=>GAP_BP,
    "HIGH_DEMAND_BP",
    ()=>HIGH_DEMAND_BP,
    "LOW_DEMAND_BP",
    ()=>LOW_DEMAND_BP,
    "MARKET_MAX_COMPETITORS",
    ()=>MARKET_MAX_COMPETITORS,
    "MARKET_MAX_DAYS",
    ()=>MARKET_MAX_DAYS,
    "MarketInputError",
    ()=>MarketInputError,
    "availabilityLevelFromBp",
    ()=>availabilityLevelFromBp,
    "availabilityLevelFromPage",
    ()=>availabilityLevelFromPage,
    "buildMarketBoard",
    ()=>buildMarketBoard,
    "buildNightHistory",
    ()=>buildNightHistory,
    "competitorPlatform",
    ()=>competitorPlatform,
    "demandLevel",
    ()=>demandLevel,
    "estimateNightOccupancy",
    ()=>estimateNightOccupancy,
    "formatOccupancy",
    ()=>formatOccupancy,
    "formatPoints",
    ()=>formatPoints,
    "marketDates",
    ()=>marketDates,
    "parseCompetitorInput",
    ()=>parseCompetitorInput,
    "parseOccupancyPercent",
    ()=>parseOccupancyPercent,
    "platformNightUrl",
    ()=>platformNightUrl
]);
class MarketInputError extends Error {
}
const MARKET_MAX_DAYS = 31;
const MARKET_MAX_COMPETITORS = 15;
const HIGH_DEMAND_BP = 8500;
const LOW_DEMAND_BP = 5000;
const GAP_BP = 1000;
const MAX_INSIGHTS = 5;
function parseOccupancyPercent(raw) {
    if (raw === null || raw === undefined) return null;
    const text = String(raw).replace(/%/g, '').replace(',', '.').trim();
    if (text === '') return null;
    if (!/^-?\d+(\.\d+)?$/.test(text)) throw new MarketInputError('Загрузка: число процентов от 0 до 100, например 85 или 85,5');
    const [whole, frac = ''] = text.replace('-', '').split('.');
    if (frac.length > 2) throw new MarketInputError('Загрузка: не больше двух знаков после запятой');
    const bp = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
    if (text.startsWith('-') || bp > 10000) throw new MarketInputError('Загрузка: число процентов от 0 до 100');
    return bp;
}
function formatOccupancy(bp) {
    const whole = Math.trunc(bp / 100);
    const frac = String(Math.abs(bp % 100)).padStart(2, '0').replace(/0+$/, '');
    return `${whole}${frac ? `,${frac}` : ''} %`;
}
function formatPoints(bp) {
    const sign = bp > 0 ? '+' : bp < 0 ? '−' : '';
    return `${sign}${formatOccupancy(Math.abs(bp)).replace(' %', '')} п.п.`;
}
function demandLevel(bp) {
    if (bp === null || bp === undefined) return null;
    if (bp >= HIGH_DEMAND_BP) return 'high';
    if (bp <= LOW_DEMAND_BP) return 'low';
    return 'mid';
}
const COMPETITOR_MONITORING = [
    'OCCUPANCY',
    'PRICE',
    'BOTH'
];
const optionalInt = (raw, label, min)=>{
    if (raw === undefined) return undefined;
    if (raw === null || String(raw).trim() === '') return null;
    const n = Number(String(raw).replace(/\s/g, ''));
    if (!Number.isInteger(n) || n < min || n > 1_000_000) throw new MarketInputError(`${label}: целое число${min > 0 ? ' больше нуля' : ' от нуля'}`);
    return n;
};
const optionalText = (raw, label, max)=>{
    if (raw === undefined) return undefined;
    const text = raw === null ? '' : String(raw).trim();
    if (text === '') return null;
    if (text.length > max) throw new MarketInputError(`${label}: не длиннее ${max} знаков`);
    return text;
};
function parseCompetitorInput(dto, mode) {
    const out = {};
    if (dto.name !== undefined || mode === 'create') {
        const name = String(dto.name ?? '').trim();
        if (!name) throw new MarketInputError('Название конкурента обязательно');
        if (name.length > 120) throw new MarketInputError('Название: не длиннее 120 знаков');
        out.name = name;
    }
    const distanceM = optionalInt(dto.distanceM, 'Расстояние в метрах', 0);
    if (distanceM !== undefined) out.distanceM = distanceM;
    const unitsTotal = optionalInt(dto.unitsTotal, 'Номеров у конкурента', 1);
    if (unitsTotal !== undefined) out.unitsTotal = unitsTotal;
    const url = optionalText(dto.url, 'Ссылка', 500);
    if (url !== undefined) {
        if (url !== null && !/^https?:\/\/[^\s]+$/i.test(url)) throw new MarketInputError('Ссылка: адрес страницы, начинается с https://');
        out.url = url;
    }
    const note = optionalText(dto.note, 'Заметка', 500);
    if (note !== undefined) out.note = note;
    const district = optionalText(dto.district, 'Район', 80);
    if (district !== undefined) out.district = district;
    const category = optionalText(dto.category, 'Тип объекта', 60);
    if (category !== undefined) out.category = category;
    const address = optionalText(dto.address, 'Адрес', 200);
    if (address !== undefined) out.address = address;
    const dataSource = optionalText(dto.dataSource, 'Источник данных', 40);
    if (dataSource !== undefined) out.dataSource = dataSource;
    if (dto.monitoring !== undefined) {
        if (!COMPETITOR_MONITORING.includes(dto.monitoring)) throw new MarketInputError('Что отслеживать: только загрузку, только цены или то и другое');
        out.monitoring = dto.monitoring;
    }
    if (dto.refreshHours !== undefined) {
        if (dto.refreshHours === null || String(dto.refreshHours).trim() === '') out.refreshHours = null;
        else {
            const hours = Number(String(dto.refreshHours).trim());
            if (!Number.isInteger(hours) || hours < 1 || hours > 168) throw new MarketInputError('Частота обновления: от 1 до 168 часов');
            out.refreshHours = hours;
        }
    }
    if (dto.autoRefresh !== undefined) out.autoRefresh = dto.autoRefresh === true;
    return out;
}
const plusDays = (iso, n)=>{
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
};
function marketDates(from, days) {
    return Array.from({
        length: days
    }, (_, i)=>plusDays(from, i));
}
const mean = (xs)=>xs.length ? Math.round(xs.reduce((a, b)=>a + b, 0) / xs.length) : null;
/** Последний снимок каждой пары «конкурент, ночь» с днём снимка не позже `asOf` */ function latestAsOf(readings, asOf) {
    const out = new Map();
    for (const r of readings){
        if (r.observedOn > asOf) continue;
        const key = `${r.competitorId}|${r.stayDate}`;
        const prev = out.get(key);
        if (!prev || r.observedOn > prev.observedOn) out.set(key, r);
    }
    return out;
}
const INSIGHT_ORDER = [
    'high-behind',
    'high',
    'low-ahead',
    'low',
    'missing'
];
/** Почти полна половина соседей с уровнем и больше (Q-MKT-LVL-2): рынок почти полон и без процентов */ const tightMarket = (m)=>m.withLevel > 0 && m.tight * 2 >= m.withLevel;
function nightKind(market, own, tight) {
    if (market !== null && market >= HIGH_DEMAND_BP || tight) return market !== null && own !== null && own <= market - GAP_BP ? 'high-behind' : 'high';
    if (market === null) return null;
    if (market <= LOW_DEMAND_BP) return own !== null && own >= market + GAP_BP ? 'low-ahead' : 'low';
    return null;
}
function buildMarketBoard(input) {
    const { dates, asOf, compareDays } = input;
    const current = latestAsOf(input.readings, asOf);
    const compareOn = compareDays > 0 ? plusDays(asOf, -compareDays) : null;
    const earlier = compareOn ? latestAsOf(input.readings, compareOn) : new Map();
    let ownOccupied = 0;
    let ownTotal = 0;
    const own = dates.map((date)=>{
        const d = input.own[date];
        const total = d ? d.occupied + d.free + d.blocked : 0;
        if (!d || total === 0) return {
            date,
            bp: null
        };
        ownOccupied += d.occupied;
        ownTotal += total;
        return {
            date,
            bp: Math.round(d.occupied * 10000 / total)
        };
    });
    const sorted = [
        ...input.competitors
    ].sort((a, b)=>(a.distanceM ?? Number.MAX_SAFE_INTEGER) - (b.distanceM ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name, 'ru'));
    const competitors = sorted.map((c)=>{
        const sources = new Set();
        let lastObservedOn = null;
        const cells = dates.map((date)=>{
            const now = current.get(`${c.id}|${date}`);
            if (!now) return {
                date,
                bp: null,
                deltaBp: null,
                source: null,
                level: null
            };
            sources.add(now.source);
            if (!lastObservedOn || now.observedOn > lastObservedOn) lastObservedOn = now.observedOn;
            const before = compareOn && now.observedOn > compareOn ? earlier.get(`${c.id}|${date}`) : undefined;
            const bp = now.occupancyBp;
            return {
                date,
                bp,
                deltaBp: before && bp !== null && before.occupancyBp !== null ? bp - before.occupancyBp : null,
                source: now.source,
                level: now.level ?? (bp === null ? null : availabilityLevelFromBp(bp))
            };
        });
        return {
            ...c,
            cells,
            sources: [
                ...sources
            ].sort(),
            lastObservedOn
        };
    });
    const market = dates.map((date, i)=>{
        const values = competitors.flatMap((c)=>c.cells[i].bp === null ? [] : [
                c.cells[i].bp
            ]);
        const levels = competitors.flatMap((c)=>c.cells[i].level === null ? [] : [
                c.cells[i].level
            ]);
        return {
            date,
            bp: mean(values),
            count: values.length,
            tight: levels.filter((l)=>l !== 'AVAILABLE').length,
            withLevel: levels.length
        };
    });
    const gap = dates.map((date, i)=>{
        const m = market[i].bp;
        const o = own[i].bp;
        return {
            date,
            bp: m === null || o === null ? null : o - m
        };
    });
    const marketBp = mean(market.flatMap((m)=>m.bp === null ? [] : [
            m.bp
        ]));
    const ownBp = ownTotal ? Math.round(ownOccupied * 10000 / ownTotal) : null;
    const withData = competitors.filter((c)=>c.lastObservedOn !== null);
    // Подсказки: ночи одного правила подряд: один отрезок
    const ranges = [];
    let open = null;
    const close = ()=>{
        if (!open) return;
        const ms = open.idx.flatMap((i)=>market[i].bp === null ? [] : [
                market[i].bp
            ]);
        const os = open.idx.flatMap((i)=>own[i].bp === null ? [] : [
                own[i].bp
            ]);
        ranges.push({
            kind: open.kind,
            from: dates[open.idx[0]],
            to: dates[open.idx.at(-1)],
            nights: open.idx.length,
            // средняя рынка у подсказки, только если она известна на каждой ночи отрезка: иначе это процент части ночей
            marketBp: ms.length === open.idx.length ? mean(ms) : null,
            ownBp: mean(os)
        });
        open = null;
    };
    dates.forEach((_, i)=>{
        const kind = nightKind(market[i].bp, own[i].bp, tightMarket(market[i]));
        if (open && open.kind === kind) open.idx.push(i);
        else {
            close();
            if (kind) open = {
                kind,
                idx: [
                    i
                ]
            };
        }
    });
    close();
    const missing = competitors.filter((c)=>c.lastObservedOn === null).map((c)=>c.name);
    if (missing.length && dates.length) ranges.push({
        kind: 'missing',
        from: dates[0],
        to: dates.at(-1),
        nights: dates.length,
        marketBp: null,
        ownBp: null,
        competitors: missing
    });
    const insights = ranges.sort((a, b)=>INSIGHT_ORDER.indexOf(a.kind) - INSIGHT_ORDER.indexOf(b.kind) || a.from.localeCompare(b.from)).slice(0, MAX_INSIGHTS);
    return {
        dates,
        asOf,
        compareDays,
        own,
        competitors,
        market,
        gap,
        summary: {
            marketBp,
            ownBp,
            gapBp: marketBp === null || ownBp === null ? null : ownBp - marketBp,
            highDemandNights: market.filter((m)=>m.bp !== null && m.bp >= HIGH_DEMAND_BP || tightMarket(m)).length,
            competitors: competitors.length,
            competitorsWithData: withData.length
        },
        insights
    };
}
function buildNightHistory(input) {
    const ids = new Set(input.competitors.map((c)=>c.id));
    const readings = input.readings.filter(// история ночи строится из процентов: снимок только с уровнем (§23.1) в ней не участвует
    (r)=>r.stayDate === input.stayDate && ids.has(r.competitorId) && r.occupancyBp !== null);
    const byDay = new Map();
    for (const r of readings){
        const day = byDay.get(r.observedOn) ?? new Map();
        day.set(r.competitorId, r.occupancyBp);
        byDay.set(r.observedOn, day);
    }
    const allDays = [
        ...byDay.keys()
    ].sort();
    const last = new Map();
    const days = allDays.map((observedOn)=>{
        const today = byDay.get(observedOn);
        for (const [id, bp] of today)last.set(id, bp);
        const values = input.competitors.map((c)=>({
                competitorId: c.id,
                bp: last.get(c.id) ?? null,
                observed: today.has(c.id)
            }));
        const known = values.flatMap((v)=>v.bp === null ? [] : [
                v.bp
            ]);
        return {
            observedOn,
            values,
            marketBp: mean(known),
            count: known.length
        };
    });
    const shown = days.slice(-(input.maxDays ?? 30));
    const withMarket = shown.filter((d)=>d.marketBp !== null);
    const pickupBp = withMarket.length >= 2 ? withMarket.at(-1).marketBp - withMarket[0].marketBp : null;
    return {
        stayDate: input.stayDate,
        competitors: input.competitors,
        days: shown,
        pickupBp
    };
}
/**
 * Площадка по ссылке конкурента: стойка подписывает «Сбор не подключён» у соседа со ссылкой на площадку. Будет ли
 * сборщик читать площадки, не решено (Q-257 открыт; ADR-142 автоматический сбор с площадок запрещает).
 */ const PLATFORMS = [
    [
        /(^|\.)booking\.com$/,
        'Booking.com'
    ],
    [
        /(^|\.)trip\.com$/,
        'Trip.com'
    ],
    [
        /(^|\.)ostrovok\.ru$/,
        'Ostrovok'
    ],
    [
        /(^|\.)airbnb\.[a-z.]+$/,
        'Airbnb'
    ]
];
function competitorPlatform(url) {
    if (!url) return null;
    let host;
    try {
        host = new URL(url).hostname.toLowerCase();
    } catch  {
        return null;
    }
    return PLATFORMS.find(([re])=>re.test(host))?.[1] ?? null;
}
const FEW_LEFT_MAX = 5;
function availabilityLevelFromPage(o) {
    if (o.status === 'sold_out') return 'SOLD_OUT';
    if (o.status !== 'available') return null;
    // самый малый видимый остаток; если площадка показала только сумму, решает она
    const low = o.fewestLeft ?? o.roomsLeft;
    return low != null && low <= FEW_LEFT_MAX ? 'FEW_LEFT' : 'AVAILABLE';
}
function availabilityLevelFromBp(bp) {
    if (bp >= 10000) return 'SOLD_OUT';
    return bp >= HIGH_DEMAND_BP ? 'FEW_LEFT' : 'AVAILABLE';
}
function estimateNightOccupancy(o, unitsTotal) {
    if (o.status === 'sold_out') return 10000;
    if (o.status !== 'available' || o.roomsLeft === null || !unitsTotal) return null;
    const free = Math.min(Math.max(o.roomsLeft, 0), unitsTotal);
    return Math.round((unitsTotal - free) / unitsTotal * 10000);
}
function platformNightUrl(url, night) {
    const platform = competitorPlatform(url);
    const out = new URL(url);
    const next = plusDays(night, 1);
    if (platform === 'Booking.com') {
        out.searchParams.set('checkin', night);
        out.searchParams.set('checkout', next);
        out.searchParams.set('group_adults', '1');
        out.searchParams.set('group_children', '0');
        out.searchParams.set('no_rooms', '1');
        return out.toString();
    }
    if (platform === 'Ostrovok') {
        // выдача кладёт в ссылку свою сессию поиска (room, search_chain_id, q): она не нужна и устаревает
        const ru = (iso)=>iso.split('-').reverse().join('.');
        return `${out.origin}${out.pathname}?dates=${ru(night)}-${ru(next)}&guests=1`;
    }
    if (platform === 'Trip.com') {
        out.searchParams.set('checkIn', night);
        out.searchParams.set('checkOut', next);
        out.searchParams.set('adult', '1');
        return out.toString();
    }
    return null;
}
}),
"[project]/wt-personnel/packages/domain/src/market/rates.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "buildPriceBoard",
    ()=>buildPriceBoard,
    "parsePriceInput",
    ()=>parsePriceInput
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$market$2f$occupancy$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/market/occupancy.ts [app-ssr] (ecmascript)");
;
/**
 * Цены конкурентов (DATA_MODEL §23.1, ADR-155): разбор ввода и «ценовая доска». Всё в минорных единицах целым
 * (ADR-008). Правило то же, что у загрузки: значение на день снимка D это последний снимок с `observed_on ≤ D`.
 * Неизвестное не равно нулю: нет цены на ночь, значит `null`, а не 0.
 */ const MAX_MAJOR = 100_000_000n;
function parsePriceInput(raw) {
    if (raw === undefined || raw === null) return null;
    const text = String(raw).replace(/\s/g, '').replace(',', '.');
    if (text === '') return null;
    const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);
    if (!match) throw new __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$market$2f$occupancy$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["MarketInputError"]('Цена: число, например 42 000 или 42000,50');
    const major = BigInt(match[1]);
    const minor = BigInt((match[2] ?? '').padEnd(2, '0') || '0');
    const total = major * 100n + minor;
    if (total <= 0n) throw new __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$market$2f$occupancy$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["MarketInputError"]('Цена: больше нуля');
    if (major >= MAX_MAJOR) throw new __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$market$2f$occupancy$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["MarketInputError"]('Цена: слишком большое число');
    return total;
}
const plusDays = (iso, n)=>{
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
};
/** Среднее целым с округлением к ближайшему; пусто это `null` */ const mean = (values)=>{
    if (values.length === 0) return null;
    const n = BigInt(values.length);
    const sum = values.reduce((a, b)=>a + b, 0n);
    return (sum * 2n + n) / (n * 2n);
};
function latestAsOf(readings, asOf) {
    const out = new Map();
    for (const r of readings){
        if (r.observedOn > asOf) continue;
        const key = `${r.competitorId}|${r.stayDate}`;
        const prev = out.get(key);
        if (!prev || r.observedOn > prev.observedOn) out.set(key, r);
    }
    return out;
}
function buildPriceBoard(input) {
    const { dates, asOf, compareDays } = input;
    const current = latestAsOf(input.readings, asOf);
    const compareOn = compareDays > 0 ? plusDays(asOf, -compareDays) : null;
    const earlier = compareOn ? latestAsOf(input.readings, compareOn) : new Map();
    let currency = null;
    const competitors = input.competitors.map((c)=>{
        let lastObservedOn = null;
        let nowSum = 0n;
        let beforeSum = 0n;
        let both = 0;
        const cells = dates.map((date)=>{
            const now = current.get(`${c.id}|${date}`);
            if (!now) return {
                date,
                priceMinor: null,
                source: null
            };
            currency ??= now.currency;
            if (!lastObservedOn || now.observedOn > lastObservedOn) lastObservedOn = now.observedOn;
            const before = compareOn && now.observedOn > compareOn ? earlier.get(`${c.id}|${date}`) : undefined;
            if (before) {
                nowSum += now.priceMinor;
                beforeSum += before.priceMinor;
                both += 1;
            }
            return {
                date,
                priceMinor: now.priceMinor,
                source: now.source
            };
        });
        const prices = cells.flatMap((cell)=>cell.priceMinor === null ? [] : [
                cell.priceMinor
            ]);
        return {
            id: c.id,
            cells,
            avgMinor: mean(prices),
            changePermille: both > 0 && beforeSum > 0n ? Number((nowSum - beforeSum) * 1000n / beforeSum) : null,
            lastObservedOn
        };
    });
    const market = dates.map((date, i)=>{
        const values = competitors.flatMap((c)=>c.cells[i].priceMinor === null ? [] : [
                c.cells[i].priceMinor
            ]);
        return {
            date,
            avgMinor: mean(values),
            minMinor: values.length ? values.reduce((a, b)=>b < a ? b : a) : null,
            maxMinor: values.length ? values.reduce((a, b)=>b > a ? b : a) : null,
            count: values.length
        };
    });
    const known = market.filter((m)=>m.avgMinor !== null);
    return {
        currency,
        competitors,
        market,
        summary: {
            marketAvgMinor: mean(known.map((m)=>m.avgMinor)),
            minMinor: known.length ? known.map((m)=>m.minMinor).reduce((a, b)=>b < a ? b : a) : null,
            maxMinor: known.length ? known.map((m)=>m.maxMinor).reduce((a, b)=>b > a ? b : a) : null,
            competitorsWithData: competitors.filter((c)=>c.lastObservedOn !== null).length
        }
    };
}
}),
"[project]/wt-personnel/packages/domain/src/marketing/ad-launch.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Запуск рекламы из WETOP (DATA_MODEL §57, ADR-MKT-LAUNCH): правило денег и проверка настроек мастера. Чистые функции:
 * сервис API считает суммы из базы и зовёт их до Meta. Деньги целыми minor units (ADR-008), курс десятичной строкой.
 */ __turbopack_context__.s([
    "checkLaunchBudget",
    ()=>checkLaunchBudget,
    "daysLeftInMonth",
    ()=>daysLeftInMonth,
    "launchBudgetRoom",
    ()=>launchBudgetRoom,
    "parseLaunchInput",
    ()=>parseLaunchInput,
    "toBaseMinor",
    ()=>toBaseMinor
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$budget$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/budget.ts [app-ssr] (ecmascript)");
;
const fail = (msg)=>{
    throw new __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$budget$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["MarketingBudgetError"](msg);
};
function daysLeftInMonth(today) {
    const [y, m, d] = today.split('-').map(Number);
    return new Date(Date.UTC(y, m, 0)).getUTCDate() - d + 1;
}
const RATE = /^(\d{1,8})(?:\.(\d{1,6}))?$/;
function toBaseMinor(minor, fxRate) {
    const m = RATE.exec(fxRate);
    if (!m) return fail('Курс к валюте отчётности: число, до 6 знаков после точки');
    const scaled = BigInt(m[1]) * 1_000_000n + BigInt((m[2] ?? '').padEnd(6, '0'));
    if (scaled <= 0n) return fail('Курс к валюте отчётности должен быть больше нуля');
    return (minor * scaled + 999_999n) / 1_000_000n;
}
const major = (minor)=>{
    const whole = (minor / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const cents = minor % 100n;
    return cents === 0n ? whole : `${whole},${cents.toString().padStart(2, '0')}`;
};
function checkLaunchBudget(q) {
    if (q.planMinor === null) fail('Нет плана канала Meta на этот месяц: задайте его в «Бюджете», запуск сверяется с планом');
    const left = q.planMinor - q.spentMinor;
    if (left <= 0n) fail('План канала Meta на этот месяц исчерпан: увеличьте план в «Бюджете»');
    const days = BigInt(q.daysLeft);
    if ((q.activeDailyMinor + q.newDailyMinor) * days > left) {
        const room = left / days - q.activeDailyMinor;
        fail(room > 0n ? `Остаток плана Meta на месяц позволяет новой кампании не больше ${major(room)} в день (в валюте отчётности)` : 'Остаток плана Meta на месяц уже занят идущими кампаниями: остановите одну или увеличьте план');
    }
}
function launchBudgetRoom(q) {
    if (q.planMinor === null) return null;
    const room = (q.planMinor - q.spentMinor) / BigInt(q.daysLeft) - q.activeDailyMinor;
    return room > 0n ? room : 0n;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const META_ID = /^\d{1,40}$/;
const str = (v, max)=>{
    if (typeof v !== 'string') return null;
    const s = v.trim();
    return s === '' ? null : s.slice(0, max);
};
const id = (v, what, required)=>{
    const s = str(v, 40);
    if (s === null) return required ? fail(`Не выбрано: ${what}`) : null;
    return META_ID.test(s) ? s : fail(`Неверный номер: ${what}`);
};
function parseLaunchInput(raw) {
    const b = raw && typeof raw === 'object' ? raw : {};
    const requestKey = typeof b.requestKey === 'string' && UUID.test(b.requestKey) ? b.requestKey.toLowerCase() : fail('Повторите запуск из мастера');
    const creativeId = typeof b.creativeId === 'string' && UUID.test(b.creativeId) ? b.creativeId.toLowerCase() : fail('Загрузите креатив');
    const destination = b.destination;
    if (destination === 'MESSENGER' || destination === 'INSTAGRAM_DIRECT') fail('Реклама в Messenger и Instagram Direct из WETOP пока не запускается');
    if (![
        'LEAD_FORM',
        'WHATSAPP',
        'WEBSITE'
    ].includes(destination)) fail('Выберите, куда ведёт реклама');
    const budget = typeof b.dailyBudgetMinor === 'string' && /^\d{1,15}$/.test(b.dailyBudgetMinor) ? BigInt(b.dailyBudgetMinor) : 0n;
    if (budget <= 0n) fail('Бюджет в день: целая сумма больше нуля');
    const fxRate = typeof b.fxRate === 'string' ? b.fxRate.trim() : '';
    toBaseMinor(1n, fxRate);
    const headline = str(b.headline, 40) ?? fail('Нужен заголовок');
    const primaryText = str(b.primaryText, 500) ?? fail('Нужен текст объявления');
    const leadFormId = id(b.leadFormId, 'форма заявок', destination === 'LEAD_FORM');
    const link = str(b.link, 1000);
    if (destination === 'WEBSITE' && !(link && /^https:\/\/[^\s/]+\.[^\s]+$/.test(link))) fail('Адрес сайта: полный, с https://');
    const countryCode = typeof b.countryCode === 'string' && /^[A-Z]{2}$/.test(b.countryCode) ? b.countryCode : fail('Укажите страну');
    const cities = (Array.isArray(b.cities) ? b.cities : []).slice(0, 25).map((c)=>{
        const o = c && typeof c === 'object' ? c : {};
        const key = typeof o.key === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(o.key) ? o.key : fail('Город выберите из списка');
        return {
            key,
            name: str(o.name, 100) ?? key
        };
    });
    const age = (v)=>typeof v === 'number' && Number.isInteger(v) && v >= 18 && v <= 65 ? v : fail('Возраст от 18 до 65');
    const ageMin = age(b.ageMin);
    const ageMax = age(b.ageMax);
    if (ageMin > ageMax) fail('Возраст «от» больше, чем «до»');
    const advantageAudience = b.advantageAudience === true;
    if (advantageAudience && ageMin > 25) fail('С расширением аудитории Meta минимальный возраст только 18–25');
    const genders = Array.isArray(b.genders) && b.genders.length === 1 && (b.genders[0] === 1 || b.genders[0] === 2) ? [
        b.genders[0]
    ] : [];
    const w = b.welcome && typeof b.welcome === 'object' ? b.welcome : null;
    const text = w ? str(w.text, 200) : null;
    const autofill = w ? str(w.autofill, 100) : null;
    return {
        requestKey,
        creativeId,
        destination,
        dailyBudgetMinor: budget,
        fxRate,
        headline,
        primaryText,
        description: str(b.description, 30),
        pageId: id(b.pageId, 'страница Facebook', true),
        instagramUserId: id(b.instagramUserId, 'Instagram', false),
        leadFormId,
        link: destination === 'WEBSITE' ? link : null,
        countryCode,
        cities,
        ageMin,
        ageMax,
        genders,
        advantageAudience,
        welcome: destination === 'WHATSAPP' && text && autofill ? {
            text,
            autofill
        } : null,
        proposal: b.proposal && typeof b.proposal === 'object' ? b.proposal : null
    };
}
}),
"[project]/wt-personnel/packages/domain/src/marketing/ad-proposal.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AD_DESTINATIONS",
    ()=>AD_DESTINATIONS,
    "normalizeAdProposal",
    ()=>normalizeAdProposal
]);
/**
 * Предложение ИИ-таргетолога (DATA_MODEL §57, ADR-MKT-LAUNCH, контракт `ad-proposal/0`): модель советует, код решает.
 * Ответ модели приводится к правилам: длины по рекомендациям Meta и экрана, возраст 18–65, пол только «все», мужчины
 * или женщины, приветствие только у рекламы в переписку. Бюджет, город и кнопку модель не выбирает.
 */ var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$budget$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/budget.ts [app-ssr] (ecmascript)");
;
const AD_DESTINATIONS = [
    'LEAD_FORM',
    'WHATSAPP',
    'MESSENGER',
    'INSTAGRAM_DIRECT',
    'WEBSITE'
];
const MESSAGING = [
    'WHATSAPP',
    'MESSENGER',
    'INSTAGRAM_DIRECT'
];
/** Строка без длинного тире (правило проекта) и не длиннее предела; пусто: null */ const clean = (v, max)=>{
    if (typeof v !== 'string') return null;
    const s = v.replace(/\s*\u2014\s*/g, ', ').replace(/\s+/g, ' ').trim().slice(0, max).trim();
    return s === '' ? null : s;
};
const list = (v, count, max)=>(Array.isArray(v) ? v : []).map((x)=>clean(x, max)).filter((x)=>x !== null).slice(0, count);
const age = (v, fallback)=>typeof v === 'number' && Number.isInteger(v) ? Math.min(65, Math.max(18, v)) : fallback;
function normalizeAdProposal(spec, destination) {
    if (!spec || typeof spec !== 'object') throw new __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$budget$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["MarketingBudgetError"]('ИИ ответил не по схеме');
    const s = spec;
    const headline = clean(s.headline, 40);
    if (!headline) throw new __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$budget$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["MarketingBudgetError"]('ИИ не предложил заголовок');
    const primaryText = clean(s.primaryText, 500);
    if (!primaryText) throw new __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$budget$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["MarketingBudgetError"]('ИИ не предложил текст объявления');
    const a = age(s.ageMin, 18);
    const b = age(s.ageMax, 65);
    const g = Array.isArray(s.genders) && s.genders.length === 1 && (s.genders[0] === 1 || s.genders[0] === 2) ? [
        s.genders[0]
    ] : [];
    const text = clean(s.welcomeMessage, 200);
    const autofill = clean(s.autofill, 100);
    return {
        headline,
        primaryText,
        description: clean(s.description, 30),
        ageMin: Math.min(a, b),
        ageMax: Math.max(a, b),
        genders: g,
        interests: list(s.interests, 5, 40),
        welcome: MESSAGING.includes(destination) && text && autofill ? {
            text,
            autofill
        } : null,
        notes: list(s.notes, 3, 200)
    };
}
}),
"[project]/wt-personnel/packages/domain/src/marketing/assets.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SITE_ASSET_ALT_MAX",
    ()=>SITE_ASSET_ALT_MAX,
    "SITE_ASSET_KINDS",
    ()=>SITE_ASSET_KINDS,
    "SITE_ASSET_LIMITS",
    ()=>SITE_ASSET_LIMITS,
    "parseAssetKind",
    ()=>parseAssetKind,
    "parseDefaultAlt",
    ()=>parseDefaultAlt,
    "siteAssetStorageKey",
    ()=>siteAssetStorageKey,
    "siteSpecAssetRefs",
    ()=>siteSpecAssetRefs,
    "sniffImageType",
    ()=>sniffImageType
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$spec$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/site-spec.ts [app-ssr] (ecmascript)");
;
const SITE_ASSET_KINDS = [
    'IMAGE',
    'LOGO',
    'FAVICON'
];
const SITE_ASSET_LIMITS = Object.freeze({
    maxUploadBytes: 10 * 1024 * 1024,
    maxInputPixels: 40_000_000,
    maxInputSide: 12_000,
    imageMaxSide: 2400,
    logoMaxSide: 1600,
    faviconSide: 512,
    webpQuality: 82
});
const isRec = (v)=>v !== null && typeof v === 'object' && !Array.isArray(v);
const list = (v)=>Array.isArray(v) ? v : [];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Секции с одной картинкой `image` (§8 SiteSpec): герой, «о нас», призыв */ const SINGLE_IMAGE_SECTIONS = new Set([
    'hero',
    'about',
    'cta'
]);
function siteSpecAssetRefs(spec) {
    const refs = [];
    const add = (value, expectedKind, path)=>{
        if (typeof value === 'string' && UUID_RE.test(value)) refs.push({
            assetId: value.toLowerCase(),
            expectedKind,
            path
        });
    };
    const image = (value, path)=>{
        if (isRec(value)) add(value['assetId'], 'IMAGE', `${path}.assetId`);
    };
    const images = (value, path)=>list(value).forEach((img, i)=>image(img, `${path}[${i}]`));
    if (!isRec(spec)) return refs;
    const site = isRec(spec['site']) ? spec['site'] : {};
    const brand = isRec(site['brand']) ? site['brand'] : {};
    if (isRec(brand['logo'])) add(brand['logo']['assetId'], 'LOGO', 'site.brand.logo.assetId');
    add(brand['faviconAssetId'], 'FAVICON', 'site.brand.faviconAssetId');
    list(spec['pages']).forEach((page, p)=>{
        if (!isRec(page)) return;
        const seo = isRec(page['seo']) ? page['seo'] : {};
        if (isRec(seo['og'])) add(seo['og']['imageAssetId'], 'IMAGE', `pages[${p}].seo.og.imageAssetId`);
        list(page['sections']).forEach((section, s)=>{
            if (!isRec(section)) return;
            const at = `pages[${p}].sections[${s}]`;
            const type = section['type'];
            if (typeof type === 'string' && SINGLE_IMAGE_SECTIONS.has(type)) image(section['image'], `${at}.image`);
            else if (type === 'gallery') images(section['images'], `${at}.images`);
            else if (type === 'accommodations') list(section['items']).forEach((item, i)=>{
                if (isRec(item)) images(item['images'], `${at}.items[${i}].images`);
            });
            else if (type === 'staff') list(section['items']).forEach((item, i)=>{
                if (isRec(item)) image(item['image'], `${at}.items[${i}].image`);
            });
            else if (type === 'menu') list(section['categories']).forEach((cat, c)=>{
                if (isRec(cat)) list(cat['items']).forEach((item, i)=>{
                    if (isRec(item)) image(item['image'], `${at}.categories[${c}].items[${i}].image`);
                });
            });
        });
    });
    return refs;
}
const startsWith = (b, sig, at = 0)=>b.length >= at + sig.length && sig.every((x, i)=>b[at + i] === x);
const ascii = (s)=>[
        ...s
    ].map((c)=>c.charCodeAt(0));
function sniffImageType(b) {
    if (startsWith(b, [
        0xff,
        0xd8,
        0xff
    ])) return 'jpeg';
    if (startsWith(b, [
        0x89,
        0x50,
        0x4e,
        0x47,
        0x0d,
        0x0a,
        0x1a,
        0x0a
    ])) return 'png';
    if (startsWith(b, ascii('RIFF')) && startsWith(b, ascii('WEBP'), 8)) return 'webp';
    return null;
}
function parseAssetKind(value) {
    return typeof value === 'string' && SITE_ASSET_KINDS.includes(value) ? value : null;
}
const ALT_LOCALES = [
    'ru',
    'kk',
    'en'
];
const SITE_ASSET_ALT_MAX = 150;
function parseDefaultAlt(value) {
    if (value === null || value === undefined) return {
        ok: true,
        value: null
    };
    if (!isRec(value)) return {
        ok: false,
        message: 'ALT: объект вида { "ru": "…" }'
    };
    const out = {};
    for (const [locale, raw] of Object.entries(value)){
        if (!ALT_LOCALES.includes(locale)) return {
            ok: false,
            message: `ALT: язык «${locale}» не поддерживается`
        };
        if (typeof raw !== 'string') return {
            ok: false,
            message: 'ALT: ожидается строка'
        };
        const problem = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$spec$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["plainTextProblem"])(raw);
        if (problem) return {
            ok: false,
            message: `ALT: ${problem}`
        };
        const trimmed = raw.trim();
        if ([
            ...trimmed
        ].length > SITE_ASSET_ALT_MAX) return {
            ok: false,
            message: `ALT: не длиннее ${SITE_ASSET_ALT_MAX} знаков`
        };
        if (trimmed) out[locale] = trimmed;
    }
    return {
        ok: true,
        value: Object.keys(out).length ? out : null
    };
}
function siteAssetStorageKey(locationId, assetId, sha256, kind) {
    return `site-assets/${locationId}/${assetId}/${sha256}.${kind === 'FAVICON' ? 'png' : 'webp'}`;
}
}),
"[project]/wt-personnel/packages/domain/src/marketing/brief.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "BRIEF_TEXT_LIMITS",
    ()=>BRIEF_TEXT_LIMITS,
    "SITE_BRIEF_LOCALES",
    ()=>SITE_BRIEF_LOCALES,
    "SITE_BRIEF_SCHEMA_VERSION",
    ()=>SITE_BRIEF_SCHEMA_VERSION,
    "buildSiteBrief",
    ()=>buildSiteBrief
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$ai$2d$seller$2f$profile$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/ai-seller/profile.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$canonical$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/canonical.ts [app-ssr] (ecmascript)");
;
;
const SITE_BRIEF_SCHEMA_VERSION = 'site-brief/0';
const SITE_BRIEF_LOCALES = [
    'ru',
    'kk',
    'en'
];
const BRIEF_TEXT_LIMITS = {
    title: 200,
    description: 4000,
    importantInformation: 2000,
    website: 300,
    address: 500,
    city: 100,
    policy: 200,
    facilities: 50,
    facilityTitle: 120,
    facilityCategory: 60,
    photoDescriptions: 20,
    photoDescription: 200,
    /** SITE-2: пределы каталога, чтобы бриф ресторана с большим меню не раздувал промпт */ services: 60,
    staff: 30,
    menuCategories: 30,
    menuItems: 300,
    catalogName: 200,
    catalogCategory: 100
};
// ---------- правила ----------
/** Сравнение строк по кодовым единицам: не зависит от ICU и локали процесса */ const byCode = (a, b)=>a < b ? -1 : a > b ? 1 : 0;
const textOf = (value)=>{
    if (typeof value !== 'string') return null;
    const t = value.replaceAll('\u0000', '').trim();
    return t === '' ? null : t;
};
/** Сравнение без пробелов по краям, с одним пробелом внутри и без регистра */ const loose = (value)=>value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru');
const digits = (value)=>value.replace(/\D/g, '');
/** Время `ЧЧ:ММ`; если не похоже на время, строка без изменений */ function clock(value) {
    const m = /^\s*(\d{1,2}):(\d{2})/.exec(value);
    return m ? `${m[1].padStart(2, '0')}:${m[2]}` : value.trim();
}
const CHANNEX_UNCONNECTED = [
    'NO_KEY',
    'NO_MAPPING'
];
function buildSiteBrief(snapshot, collectedAt) {
    const truncations = [];
    /** Текст в пределе по символам; усечение пишется в метаданные без исходника */ const bounded = (value, max, source, field)=>{
        const t = textOf(value);
        if (t === null) return null;
        const chars = Array.from(t);
        if (chars.length <= max) return t;
        truncations.push({
            source,
            field,
            originalLength: chars.length
        });
        return chars.slice(0, max).join('');
    };
    const { location, property, categories } = snapshot.platform;
    const vf = snapshot.platform.vertical ?? null;
    const L = BRIEF_TEXT_LIMITS;
    // --- Channex: только белый список, адресов фото нет ---
    const cx = snapshot.channex.state === 'READY' ? snapshot.channex.content : null;
    const cxp = cx?.property ?? null;
    const cxTitle = bounded(cxp?.title, L.title, 'CHANNEX', 'title');
    const cxPhone = bounded(cxp?.phone, L.policy, 'CHANNEX', 'phone');
    const cxEmail = bounded(cxp?.email, L.policy, 'CHANNEX', 'email');
    const cxAddress = bounded(cxp?.address, L.address, 'CHANNEX', 'address');
    const cxCity = bounded(cxp?.city, L.city, 'CHANNEX', 'city');
    const cxCountryRaw = textOf(cxp?.country);
    const cxCountry = cxCountryRaw && /^[A-Za-z]{2}$/.test(cxCountryRaw) ? cxCountryRaw.toUpperCase() : null;
    let channelContent = null;
    if (cx) {
        const allFacilities = cx.facilities.map((f, i)=>({
                title: bounded(f.title, L.facilityTitle, 'CHANNEX', `facilities[${i}].title`),
                category: bounded(f.category, L.facilityCategory, 'CHANNEX', `facilities[${i}].category`)
            })).filter((f)=>f.title !== null).sort((a, b)=>byCode(a.category ?? '', b.category ?? '') || byCode(a.title, b.title));
        if (allFacilities.length > L.facilities) truncations.push({
            source: 'CHANNEX',
            field: 'facilities',
            originalLength: allFacilities.length
        });
        const described = cx.photos.map((p)=>textOf(p.description)).filter((d)=>d !== null);
        if (described.length > L.photoDescriptions) truncations.push({
            source: 'CHANNEX',
            field: 'photoDescriptions',
            originalLength: described.length
        });
        const p = cx.policy;
        const policies = p && {
            maxGuests: typeof p.maxGuests === 'number' && Number.isFinite(p.maxGuests) ? p.maxGuests : null,
            pets: bounded(p.pets, L.policy, 'CHANNEX', 'policy.pets'),
            smoking: bounded(p.smoking, L.policy, 'CHANNEX', 'policy.smoking'),
            internet: bounded(p.internet, L.policy, 'CHANNEX', 'policy.internet'),
            parking: bounded(p.parking, L.policy, 'CHANNEX', 'policy.parking')
        };
        channelContent = {
            description: bounded(cxp?.description, L.description, 'CHANNEX', 'description'),
            importantInformation: bounded(cxp?.importantInformation, L.importantInformation, 'CHANNEX', 'importantInformation'),
            website: bounded(cxp?.website, L.website, 'CHANNEX', 'website'),
            policies,
            facilities: allFacilities.slice(0, L.facilities),
            photoSummary: {
                total: cx.photos.length,
                propertyPhotos: cx.photos.filter((ph)=>!ph.forRoomType).length,
                roomTypePhotos: cx.photos.filter((ph)=>ph.forRoomType).length,
                descriptions: described.slice(0, L.photoDescriptions).map((d, i)=>bounded(d, L.photoDescription, 'CHANNEX', `photoDescriptions[${i}]`))
            }
        };
    }
    // --- профиль продавца: только белый список ---
    let sellerContent = null;
    if (snapshot.seller.state === 'READY') {
        const s = snapshot.seller.profile;
        const S = __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$ai$2d$seller$2f$profile$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SELLER_PROFILE_LIMITS"];
        const langs = Array.isArray(s.languages) ? s.languages.map((x)=>String(x).toLowerCase()) : [];
        sellerContent = {
            siteLocaleHints: langs.filter((code, i)=>SITE_BRIEF_LOCALES.includes(code) && langs.indexOf(code) === i),
            includedInPrice: bounded(s.includedInPrice, S.includedInPrice, 'SELLER_PROFILE', 'includedInPrice'),
            extraCharges: bounded(s.extraCharges, S.extraCharges, 'SELLER_PROFILE', 'extraCharges'),
            houseRules: bounded(s.houseRules, S.houseRules, 'SELLER_PROFILE', 'houseRules'),
            faq: (Array.isArray(s.faq) ? s.faq : []).slice(0, S.faqItems).map((f, i)=>({
                    question: bounded(f?.question, S.faqQuestion, 'SELLER_PROFILE', `faq[${i}].question`),
                    answer: bounded(f?.answer, S.faqAnswer, 'SELLER_PROFILE', `faq[${i}].answer`)
                })).filter((f)=>f.question !== null && f.answer !== null)
        };
    }
    // --- старшинство полей платформы ---
    const pick = (...candidates)=>{
        for (const [value, source] of candidates)if (value !== null) return [
            value,
            source
        ];
        return [
            null,
            null
        ];
    };
    const locationName = textOf(location.name) ?? '';
    const propertyName = textOf(property?.name);
    const [address, addressSource] = pick([
        bounded(location.address, L.address, 'PLATFORM', 'location.address'),
        'PLATFORM'
    ], [
        bounded(property?.address, L.address, 'PLATFORM', 'property.address'),
        'PLATFORM'
    ], [
        cxAddress,
        'CHANNEX'
    ]);
    // телефон и почта объекта в бриф не берутся: это контакты печатных форм, а не утверждённые публичные контакты
    const [phone, phoneSource] = pick([
        textOf(location.phone),
        'PLATFORM'
    ], [
        cxPhone,
        'CHANNEX'
    ]);
    const [email, emailSource] = pick([
        textOf(location.email),
        'PLATFORM'
    ], [
        cxEmail,
        'CHANNEX'
    ]);
    const [city] = pick([
        textOf(property?.city),
        'PLATFORM'
    ], [
        cxCity,
        'CHANNEX'
    ]);
    const platformCountry = textOf(property?.countryCode);
    const [countryCode] = pick([
        platformCountry ? platformCountry.toUpperCase() : null,
        'PLATFORM'
    ], [
        cxCountry,
        'CHANNEX'
    ]);
    const [displayName, displayNameSource] = pick([
        cxTitle,
        'CHANNEX'
    ], [
        locationName || null,
        'PLATFORM'
    ], [
        propertyName,
        'PLATFORM'
    ]);
    const input = {
        identity: {
            displayNameCandidate: displayName ?? '',
            displayNameSource: displayNameSource ?? 'PLATFORM',
            locationName,
            propertyName,
            address,
            addressSource,
            city,
            countryCode,
            propertyType: textOf(property?.channexPropertyType),
            timezone: property?.timezone ?? location.timezone,
            currency: property?.currency ?? location.currency,
            phone,
            phoneSource,
            email,
            emailSource
        },
        stay: {
            checkInTime: property ? clock(property.checkInTime) : null,
            checkOutTime: property ? clock(property.checkOutTime) : null
        },
        accommodations: [
            ...categories
        ].sort((a, b)=>byCode(a.code, b.code)).map((c)=>({
                categoryCode: c.code,
                name: c.name,
                kind: c.kind,
                capacityAdults: c.capacityAdults,
                activeUnits: c.activeUnits
            })),
        capabilities: vf ? {
            booking: false,
            fromPrice: false
        } : {
            booking: true,
            fromPrice: true
        },
        sellerContent,
        channelContent,
        ...vf ? verticalInput(vf, bounded, truncations) : {}
    };
    // --- расхождения: значение платформы остаётся, Channex рядом ---
    const conflicts = [];
    const conflict = (code, mine, theirs, same)=>{
        if (mine === null || theirs === null || same(mine) === same(theirs)) return;
        conflicts.push({
            code,
            authoritativeSource: 'PLATFORM',
            authoritativeValue: mine,
            otherSource: 'CHANNEX',
            otherValue: theirs
        });
    };
    if (cx) {
        conflict('address_mismatch', addressSource === 'PLATFORM' ? address : null, cxAddress, loose);
        conflict('phone_mismatch', phoneSource === 'PLATFORM' ? phone : null, cxPhone, digits);
        conflict('email_mismatch', emailSource === 'PLATFORM' ? email : null, cxEmail, loose);
        const cxIn = textOf(cx.policy?.checkInTime);
        const cxOut = textOf(cx.policy?.checkOutTime);
        conflict('checkin_mismatch', input.stay.checkInTime, cxIn && clock(cxIn), clock);
        conflict('checkout_mismatch', input.stay.checkOutTime, cxOut && clock(cxOut), clock);
        const platformNames = [
            locationName,
            propertyName
        ].filter((n)=>!!n).map(loose);
        if (cxTitle && platformNames.length > 0 && !platformNames.includes(loose(cxTitle))) conflicts.push({
            code: 'name_mismatch',
            authoritativeSource: 'PLATFORM',
            authoritativeValue: locationName || propertyName || '',
            otherSource: 'CHANNEX',
            otherValue: cxTitle
        });
    }
    conflicts.sort((a, b)=>byCode(a.code, b.code));
    // --- найдено ---
    const found = [
        {
            code: 'platform.identity',
            source: 'PLATFORM'
        }
    ];
    const add = (cond, code, source)=>{
        if (cond) found.push({
            code,
            source
        });
    };
    add(addressSource === 'PLATFORM', 'platform.address', 'PLATFORM');
    add(phoneSource === 'PLATFORM' || emailSource === 'PLATFORM', 'platform.contacts', 'PLATFORM');
    add(property, 'platform.stay_times', 'PLATFORM');
    add(input.accommodations.length > 0, 'platform.accommodations', 'PLATFORM');
    add(input.services?.length, 'platform.services', 'PLATFORM');
    add(input.staff?.length, 'platform.staff', 'PLATFORM');
    add(input.menu?.length, 'platform.menu', 'PLATFORM');
    add(input.hours?.length, 'platform.hours', 'PLATFORM');
    if (sellerContent) {
        add(sellerContent.siteLocaleHints.length > 0, 'seller.languages', 'SELLER_PROFILE');
        add(sellerContent.includedInPrice, 'seller.included_in_price', 'SELLER_PROFILE');
        add(sellerContent.extraCharges, 'seller.extra_charges', 'SELLER_PROFILE');
        add(sellerContent.houseRules, 'seller.house_rules', 'SELLER_PROFILE');
        add(sellerContent.faq.length > 0, 'seller.faq', 'SELLER_PROFILE');
    }
    if (channelContent) {
        add(cxTitle, 'channex.title', 'CHANNEX');
        add(channelContent.description, 'channex.description', 'CHANNEX');
        add(channelContent.importantInformation, 'channex.important_information', 'CHANNEX');
        add(cxPhone || cxEmail, 'channex.contacts', 'CHANNEX');
        add(cxAddress, 'channex.address', 'CHANNEX');
        add(channelContent.website, 'channex.website', 'CHANNEX');
        const pol = channelContent.policies;
        add(pol && Object.values(pol).some((v)=>v !== null), 'channex.policies', 'CHANNEX');
        add(channelContent.facilities.length > 0, 'channex.facilities', 'CHANNEX');
        add(channelContent.photoSummary.total > 0, 'channex.photos', 'CHANNEX');
    }
    found.sort((a, b)=>byCode(a.code, b.code));
    const has = (code)=>found.some((f)=>f.code === code);
    // --- нет: только проверенное; недоступный Channex не значит «нет» ---
    const state = snapshot.channex.state;
    const channexKnown = state === 'READY' || CHANNEX_UNCONNECTED.includes(state);
    const missing = [];
    const miss = (cond, code, dependsOnChannex)=>{
        if (cond && (!dependsOnChannex || channexKnown)) missing.push({
            code
        });
    };
    if (!vf) miss(input.accommodations.length === 0, 'accommodations', false);
    if (vf?.vertical === 'BEAUTY') {
        miss(!input.services?.length, 'services', false);
        miss(!input.staff?.length, 'staff', false);
    }
    if (vf?.vertical === 'FOOD_SERVICE') miss(!input.menu?.length, 'menu', false);
    if (vf) miss(!input.hours?.length, 'hours', false);
    miss(!address, 'public.address', true);
    miss(!city, 'public.city', true);
    miss(!countryCode, 'public.country', true);
    miss(!phone && !email, 'public.contact', true);
    miss(!has('channex.description') && !has('channex.important_information'), 'marketing.description', true);
    miss(!has('channex.facilities') && !has('seller.included_in_price'), 'amenities', true);
    miss(!has('seller.faq'), 'faq', false);
    miss(!has('channex.photos'), 'photos', true);
    missing.sort((a, b)=>byCode(a.code, b.code));
    const sourceUnavailable = channexKnown ? [] : [
        {
            source: 'CHANNEX',
            code: state
        }
    ];
    // --- предлагаемая структура: не SiteSpec и не текст ---
    const sections = [];
    const evidence = (...candidates)=>candidates.filter(has).sort(byCode);
    const suggest = (type, reason, ev, extra = {})=>sections.push({
            type,
            reasonCodes: [
                reason
            ],
            evidenceCodes: ev,
            ...extra
        });
    const contacts = [
        ...new Set([
            addressSource === 'PLATFORM' ? 'platform.address' : addressSource === 'CHANNEX' ? 'channex.address' : null,
            phoneSource === 'PLATFORM' || emailSource === 'PLATFORM' ? 'platform.contacts' : null,
            phoneSource === 'CHANNEX' || emailSource === 'CHANNEX' ? 'channex.contacts' : null
        ].filter((c)=>c !== null))
    ].sort(byCode);
    suggest('hero', 'always', [
        'platform.identity'
    ]);
    if (vf) {
        // SITE-2, план §1 шаг 4: сайт для заявок салона или ресторана; порядок блоков тот же, что у заготовки
        if (has('platform.services')) suggest('services', 'active_services', [
            'platform.services'
        ]);
        if (has('platform.staff')) suggest('staff', 'active_staff', [
            'platform.staff'
        ]);
        if (has('platform.menu')) suggest('menu', 'active_menu', [
            'platform.menu'
        ]);
        const mode = vf.vertical === 'BEAUTY' ? has('platform.services') ? 'appointment' : 'callback' : 'table';
        suggest('leadForm', `lead_${mode}`, [
            'platform.identity'
        ], {
            requires: [
                mode === 'callback' ? 'SITE5_LEADS' : 'SITE4_CALENDAR'
            ]
        });
        if (has('seller.faq')) suggest('faq', 'seller_faq', [
            'seller.faq'
        ]);
        if (has('platform.hours')) suggest('hours', 'opening_hours', [
            'platform.hours'
        ]);
        if (contacts.length) suggest('contacts', 'public_contacts', contacts);
        suggest('cta', 'always', [
            'platform.identity'
        ]);
    } else {
        const about = evidence('channex.description', 'channex.important_information');
        if (about.length) suggest('about', 'channex_description', about);
        if (has('platform.accommodations')) {
            suggest('accommodations', 'active_categories', [
                'platform.accommodations'
            ]);
            suggest('pricing', 'live_from_price', [
                'platform.accommodations'
            ], {
                bindings: [
                    'B-FROMPRICE'
                ]
            });
        }
        const amenities = evidence('channex.facilities', 'seller.included_in_price');
        if (amenities.length) suggest('amenities', 'facilities_or_included', amenities);
        if (has('channex.photos')) suggest('gallery', 'channex_photos', [
            'channex.photos'
        ], {
            requires: [
                'MKT8_MEDIA_IMPORT'
            ]
        });
        if (has('seller.faq')) suggest('faq', 'seller_faq', [
            'seller.faq'
        ]);
        suggest('booking', 'hospitality_booking_capability', [
            'platform.identity'
        ], {
            requires: [
                'MKT7_TRACKED_SITE'
            ]
        });
        if (contacts.length) suggest('contacts', 'public_contacts', contacts);
        suggest('cta', 'always', [
            'platform.identity'
        ]);
    }
    const proposedStructure = {
        pages: [
            {
                kind: 'HOME',
                sections
            }
        ]
    };
    truncations.sort((a, b)=>byCode(a.source, b.source) || byCode(a.field, b.field));
    const briefHash = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$canonical$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["siteSpecHash"])({
        schemaVersion: SITE_BRIEF_SCHEMA_VERSION,
        input,
        missing: missing.map((m)=>m.code),
        conflicts,
        proposedStructure
    });
    return {
        schemaVersion: SITE_BRIEF_SCHEMA_VERSION,
        collectedAt,
        briefHash,
        input,
        sources: {
            platform: {
                state: 'READY'
            },
            seller: snapshot.seller.state === 'READY' ? {
                state: 'READY'
            } : {
                state: 'MISSING',
                reason: snapshot.seller.reason
            },
            channex: {
                state,
                checkedAt: snapshot.channex.checkedAt
            }
        },
        found,
        missing,
        sourceUnavailable,
        conflicts,
        truncations,
        proposedStructure
    };
}
const MINOR_RE = /^(?:0|[1-9][0-9]{0,14})$/;
const CLOCK_RE = /^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/;
/**
 * SITE-2: факты салона или ресторана в бриф. Только белый список полей, тексты в пределах, цена как есть строкой
 * minor units (неверная строка: позиция не попадает), порядок детерминирован: услуги по группе, имени и коду, мастера
 * по имени и id, меню в порядке ресторана, часы по дню недели и времени открытия. Лишнее сверх предела отрезается и
 * пишется в усечения.
 */ function verticalInput(vf, bounded, truncations) {
    const L = BRIEF_TEXT_LIMITS;
    const cap = (items, max, field)=>{
        if (items.length > max) truncations.push({
            source: 'PLATFORM',
            field,
            originalLength: items.length
        });
        return items.slice(0, max);
    };
    const services = cap(vf.services.map((sv, i)=>({
            code: sv.code,
            name: bounded(sv.name, L.catalogName, 'PLATFORM', `services[${i}].name`),
            category: bounded(sv.category, L.catalogCategory, 'PLATFORM', `services[${i}].category`),
            durationMin: sv.durationMin,
            priceMinor: sv.priceMinor,
            currency: sv.currency
        })).filter((sv)=>sv.name !== null && MINOR_RE.test(sv.priceMinor) && Number.isInteger(sv.durationMin) && sv.durationMin > 0).sort((a, b)=>byCode(a.category ?? '', b.category ?? '') || byCode(a.name, b.name) || byCode(a.code, b.code)), L.services, 'services');
    const staff = cap(vf.staff.map((st, i)=>({
            id: st.id,
            name: bounded(st.name, L.catalogName, 'PLATFORM', `staff[${i}].name`),
            specialization: bounded(st.specialization, L.catalogName, 'PLATFORM', `staff[${i}].specialization`)
        })).filter((st)=>st.name !== null).sort((a, b)=>byCode(a.name, b.name) || byCode(a.id, b.id)), L.staff, 'staff');
    let left = L.menuItems;
    const allItems = vf.menu.reduce((n, cat)=>n + cat.items.length, 0);
    if (allItems > L.menuItems) truncations.push({
        source: 'PLATFORM',
        field: 'menu.items',
        originalLength: allItems
    });
    const menu = cap(vf.menu, L.menuCategories, 'menu').map((cat, c)=>{
        const items = cat.items.map((it, i)=>({
                code: it.code,
                name: bounded(it.name, L.catalogName, 'PLATFORM', `menu[${c}].items[${i}].name`),
                weightGrams: typeof it.weightGrams === 'number' && Number.isInteger(it.weightGrams) && it.weightGrams > 0 ? it.weightGrams : null,
                priceMinor: it.priceMinor,
                currency: it.currency,
                hasPhoto: it.hasPhoto === true
            })).filter((it)=>it.name !== null && MINOR_RE.test(it.priceMinor));
        const kept = items.slice(0, Math.max(0, left));
        left -= kept.length;
        return {
            title: bounded(cat.title, L.catalogCategory, 'PLATFORM', `menu[${c}].title`),
            items: kept
        };
    }).filter((cat)=>cat.title !== null && cat.items.length > 0);
    const hours = vf.hours.filter((h)=>Number.isInteger(h.weekday) && h.weekday >= 0 && h.weekday <= 6 && CLOCK_RE.test(h.open) && CLOCK_RE.test(h.close)).map((h)=>({
            weekday: h.weekday,
            open: h.open,
            close: h.close
        })).sort((a, b)=>a.weekday - b.weekday || byCode(a.open, b.open));
    return {
        vertical: vf.vertical,
        services,
        staff,
        menu,
        hours
    };
}
}),
"[project]/wt-personnel/packages/domain/src/marketing/budget.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Учёт бюджета и расходов маркетинга (МКТ-В1/В2, DATA_MODEL §41, ADR-MKT-B1).
 * Деньги BigInt в minor units (ADR-008). Мультивалютность по ТЗ §8.3: сумма в валюте ввода,
 * курс к валюте отчётности фиксируется на дату операции, пересчёт считается здесь целыми
 * числами (курс в миллионных долях), float в деньгах запрещён.
 */ __turbopack_context__.s([
    "MARKETING_PLATFORMS",
    ()=>MARKETING_PLATFORMS,
    "MarketingBudgetError",
    ()=>MarketingBudgetError,
    "isoDate",
    ()=>isoDate,
    "parseMarketingBudgetInput",
    ()=>parseMarketingBudgetInput,
    "parseMarketingBudgetLinesInput",
    ()=>parseMarketingBudgetLinesInput,
    "parseMarketingExpenseInput",
    ()=>parseMarketingExpenseInput
]);
class MarketingBudgetError extends Error {
}
const MARKETING_PLATFORMS = [
    'META',
    'GOOGLE',
    'TIKTOK',
    'INSTAGRAM',
    'YOUTUBE',
    'WHATSAPP',
    'SITE',
    'PHONE',
    'OTHER'
];
const fail = (msg)=>{
    throw new MarketingBudgetError(msg);
};
const str = (v)=>typeof v === 'string' ? v.trim() : '';
const optional = (v, max, name)=>{
    const s = str(v);
    if (s === '') return null;
    if (s.length > max) fail(`${name}: не больше ${max} знаков`);
    return s;
};
const isoDate = (v, name)=>{
    const s = str(v);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) fail(`${name}: дата в виде ГГГГ-ММ-ДД`);
    const d = new Date(`${s}T00:00:00Z`);
    if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) fail(`${name}: такой даты нет`);
    return s;
};
/** «120», «456.23», «0,5» → minor units > 0 (свой разбор: расходу нужен отказ на нуле и минусе) */ const money = (v, name)=>{
    const m = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(str(v));
    if (!m) fail(`${name}: число не больше двух знаков после запятой`);
    const minor = BigInt(m[1]) * 100n + BigInt((m[2] ?? '').padEnd(2, '0'));
    if (minor <= 0n) fail(`${name}: сумма должна быть больше нуля`);
    if (minor > 10n ** 15n) fail(`${name}: сумма неправдоподобно велика`);
    return minor;
};
const RATE_SCALE = 1_000_000n;
/** Курс десятичной строкой → миллионные доли (целое). «543.27» → 543270000n */ const rateMicros = (v)=>{
    const m = /^(\d{1,8})(?:[.,](\d{1,6}))?$/.exec(str(v));
    if (!m) fail('Курс: число не больше шести знаков после запятой');
    const micros = BigInt(m[1]) * RATE_SCALE + BigInt((m[2] ?? '').padEnd(6, '0'));
    if (micros <= 0n) fail('Курс должен быть больше нуля');
    return micros;
};
const rateString = (micros)=>{
    const whole = micros / RATE_SCALE;
    const frac = (micros % RATE_SCALE).toString().padStart(6, '0').replace(/0+$/, '');
    return frac === '' ? whole.toString() : `${whole}.${frac}`;
};
/** Пересчёт в валюту отчётности: целыми, округление к ближайшему */ const toBase = (amount, rateMicros)=>(amount * rateMicros + RATE_SCALE / 2n) / RATE_SCALE;
/** Кампания расхода: пусто или uuid */ const campaignIdOf = (v)=>{
    const s = str(v);
    if (s === '') return null;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) fail('Кампания: выберите из списка');
    return s.toLowerCase();
};
function parseMarketingExpenseInput(body, ctx) {
    const date = isoDate(body.date, 'Дата');
    const platform = MARKETING_PLATFORMS.find((p)=>p === str(body.platform));
    if (!platform) fail('Платформа: выберите из списка каналов');
    const category = str(body.category);
    if (category === '') fail('Статья расхода обязательна');
    if (category.length > 100) fail('Статья: не больше 100 знаков');
    const campaign = optional(body.campaign, 200, 'Кампания');
    const description = optional(body.description, 500, 'Описание');
    const amount = money(body.amount, 'Сумма');
    const currency = (str(body.currency) || ctx.reportingCurrency).toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) fail('Валюта: трёхбуквенный код, например KZT или USD');
    let micros;
    if (currency === ctx.reportingCurrency.toUpperCase()) {
        micros = RATE_SCALE; // курс 1: пересчёт не нужен, присланное значение не ломает сумму
    } else {
        if (str(body.fxRate) === '') fail(`Курс ${currency} к ${ctx.reportingCurrency} на дату расхода обязателен`);
        micros = rateMicros(body.fxRate);
    }
    return {
        date,
        platform: platform,
        campaign,
        category,
        description,
        amount,
        currency,
        fxRate: rateString(micros),
        baseAmount: toBase(amount, micros),
        countedInBudget: body.countedInBudget === undefined ? true : body.countedInBudget === true,
        campaignId: campaignIdOf(body.campaignId)
    };
}
/** «2026-10» или полная дата → первое число месяца */ const firstOfMonth = (v)=>{
    const m = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(str(v));
    if (!m) fail('Месяц: в виде ГГГГ-ММ');
    const mm = Number(m[2]);
    if (mm < 1 || mm > 12) fail('Месяц: такого месяца нет');
    return `${m[1]}-${m[2]}-01`;
};
function parseMarketingBudgetInput(body) {
    return {
        month: firstOfMonth(body.month),
        amount: money(body.amount, 'План')
    };
}
function parseMarketingBudgetLinesInput(body) {
    const month = firstOfMonth(body.month);
    if (!Array.isArray(body.lines)) fail('Каналы: нужен список');
    const seen = new Set();
    const lines = [];
    for (const raw of body.lines){
        const line = raw ?? {};
        const platform = MARKETING_PLATFORMS.find((p)=>p === str(line.platform));
        if (!platform) fail('Канал: выберите из списка каналов');
        if (seen.has(platform)) fail(`Канал ${platform} указан дважды`);
        seen.add(platform);
        const amount = str(line.amount).replace(/\s/g, '');
        if (amount === '') continue;
        lines.push({
            platform: platform,
            amount: money(amount, `План канала ${platform}`)
        });
    }
    return {
        month,
        lines
    };
}
}),
"[project]/wt-personnel/packages/domain/src/marketing/builder.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "BOOKMARKS_PER_SITE",
    ()=>BOOKMARKS_PER_SITE,
    "BOOKMARK_LABEL_MAX",
    ()=>BOOKMARK_LABEL_MAX,
    "BUILDER_INSTRUCTIONS_MAX",
    ()=>BUILDER_INSTRUCTIONS_MAX,
    "DESIGN_DIRECTIONS",
    ()=>DESIGN_DIRECTIONS,
    "PLAN_QUESTIONS_MAX",
    ()=>PLAN_QUESTIONS_MAX,
    "SITE_AI_ASSISTANT_TEXT_MAX",
    ()=>SITE_AI_ASSISTANT_TEXT_MAX,
    "SITE_AI_MODES",
    ()=>SITE_AI_MODES,
    "SITE_AI_PAYLOAD_MAX_BYTES",
    ()=>SITE_AI_PAYLOAD_MAX_BYTES,
    "SITE_AI_REQUESTS_PER_HOUR",
    ()=>SITE_AI_REQUESTS_PER_HOUR,
    "SITE_AI_USER_TEXT_MAX",
    ()=>SITE_AI_USER_TEXT_MAX,
    "SITE_ASSISTANT_SCHEMA_VERSION",
    ()=>SITE_ASSISTANT_SCHEMA_VERSION,
    "applyDesignDirection",
    ()=>applyDesignDirection,
    "bootstrapSlug",
    ()=>bootstrapSlug,
    "decodeDesignInstruction",
    ()=>decodeDesignInstruction,
    "designInstructionText",
    ()=>designInstructionText,
    "encodeDesignInstruction",
    ()=>encodeDesignInstruction,
    "inlineTextTargets",
    ()=>inlineTextTargets,
    "parseAssistantResult",
    ()=>parseAssistantResult,
    "parseAssistantText",
    ()=>parseAssistantText,
    "parseBookmarkLabel",
    ()=>parseBookmarkLabel,
    "parseBuilderInstructions",
    ()=>parseBuilderInstructions,
    "setInlineText",
    ()=>setInlineText,
    "siteBuilderAccess",
    ()=>siteBuilderAccess,
    "siteBuilderDenied",
    ()=>siteBuilderDenied
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$canonical$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/canonical.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/editor.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$edit$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/edit.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$slug$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/site-slug.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$spec$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/site-spec.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$accounts$2f$extensions$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/accounts/extensions.ts [app-ssr] (ecmascript)");
;
;
;
;
;
;
const isRec = (v)=>v !== null && typeof v === 'object' && !Array.isArray(v);
const list = (v)=>Array.isArray(v) ? v : [];
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u0009\u000b-\u001f\u007f]/;
const SITE_ASSISTANT_SCHEMA_VERSION = 'site-assistant/0';
const SITE_AI_USER_TEXT_MAX = 4000;
const SITE_AI_ASSISTANT_TEXT_MAX = 12000;
const SITE_AI_PAYLOAD_MAX_BYTES = 32_768;
const BUILDER_INSTRUCTIONS_MAX = 5000;
const BOOKMARK_LABEL_MAX = 120;
const BOOKMARKS_PER_SITE = 20;
const SITE_AI_REQUESTS_PER_HOUR = 10;
const PLAN_QUESTIONS_MAX = 4;
const DESIGN_DIRECTIONS = 3;
const SITE_AI_MODES = [
    'CHAT',
    'PLAN',
    'DESIGN'
];
function siteBuilderAccess(row, now) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$accounts$2f$extensions$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["extensionAccess"])(row, now);
}
function siteBuilderDenied(access) {
    return access === 'expired' ? {
        code: 'SITE_BUILDER_EXPIRED',
        message: 'Срок лицензии конструктора сайта вышел: сайт доступен только для чтения'
    } : {
        code: 'SITE_BUILDER_NOT_ENABLED',
        message: 'Конструктор сайта не подключён для этого филиала'
    };
}
function bootstrapSlug(name, taken) {
    const base = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$slug$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["suggestMarketingSlug"])(name);
    if (!taken.has(base)) return base;
    for(let n = 2; n < 1000; n += 1){
        const suffix = `-${n}`;
        const candidate = `${base.slice(0, 40 - suffix.length).replace(/-+$/g, '')}${suffix}`;
        if (!taken.has(candidate)) return candidate;
    }
    throw new Error('Не нашлось свободного адреса сайта');
}
function cleanText(raw, max, optional, label) {
    if (raw === undefined || raw === null) return optional ? {
        ok: true,
        value: null
    } : {
        ok: false,
        message: `${label}: обязательно`
    };
    if (typeof raw !== 'string') return {
        ok: false,
        message: `${label}: строка`
    };
    const value = raw.replace(/\r\n?/g, '\n').trim();
    if (!value) return optional ? {
        ok: true,
        value: null
    } : {
        ok: false,
        message: `${label}: обязательно`
    };
    if (CONTROL_RE.test(value)) return {
        ok: false,
        message: `${label}: управляющие символы недопустимы`
    };
    if ([
        ...value
    ].length > max) return {
        ok: false,
        message: `${label}: не длиннее ${max} знаков`
    };
    return {
        ok: true,
        value
    };
}
function parseBuilderInstructions(raw) {
    return cleanText(raw, BUILDER_INSTRUCTIONS_MAX, true, 'Знания проекта');
}
function parseBookmarkLabel(raw) {
    return cleanText(raw, BOOKMARK_LABEL_MAX, false, 'Подпись закладки');
}
function parseAssistantText(raw, optional) {
    return cleanText(raw, SITE_AI_USER_TEXT_MAX, optional, 'Запрос');
}
const ID_RE = /^[a-z0-9][a-z0-9-]{0,47}$/;
const URL_RE = /https?:\/\/|www\./i;
const TAG_RE = /<\/?[a-z!]|[{}]/i;
class Reader {
    errors = [];
    keys(v, path, allowed, required = allowed) {
        if (!isRec(v)) {
            this.errors.push(`${path}: объект`);
            return false;
        }
        for (const k of Object.keys(v))if (!allowed.includes(k)) this.errors.push(`${path}.${k}: лишнее поле`);
        for (const k of required)if (!(k in v)) this.errors.push(`${path}.${k}: нет поля`);
        return true;
    }
    /** Текст для человека: без разметки, кода и ссылок, если `plain` */ text(v, path, max, plain = false) {
        if (typeof v !== 'string' || !v.trim()) {
            this.errors.push(`${path}: непустая строка`);
            return '';
        }
        const t = v.replace(/\r\n?/g, '\n').trim();
        if ([
            ...t
        ].length > max) this.errors.push(`${path}: не длиннее ${max}`);
        if (CONTROL_RE.test(t)) this.errors.push(`${path}: управляющие символы`);
        if (plain && (URL_RE.test(t) || TAG_RE.test(t))) this.errors.push(`${path}: без разметки и ссылок`);
        return t;
    }
    strings(v, path, min, max, itemMax, plain = true) {
        if (!Array.isArray(v) || v.length < min || v.length > max) {
            this.errors.push(`${path}: от ${min} до ${max} строк`);
            return [];
        }
        return v.map((s, i)=>this.text(s, `${path}[${i}]`, itemMax, plain));
    }
    bool(v, path) {
        if (v === undefined) return false;
        if (typeof v !== 'boolean') this.errors.push(`${path}: да или нет`);
        return v === true;
    }
    oneOf(v, path, allowed) {
        if (typeof v !== 'string' || !allowed.includes(v)) this.errors.push(`${path}: одно из ${allowed.join(', ')}`);
        return String(v);
    }
}
function readDirection(r, v, path) {
    if (!r.keys(v, path, [
        'id',
        'name',
        'shortDescription',
        'theme',
        'heroVariant',
        'sectionOrder'
    ])) return null;
    const id = typeof v['id'] === 'string' && ID_RE.test(v['id']) ? v['id'] : (r.errors.push(`${path}.id: идентификатор`), '');
    const name = r.text(v['name'], `${path}.name`, 60, true);
    const shortDescription = r.text(v['shortDescription'], `${path}.shortDescription`, 200, true);
    const themeKeys = Object.keys(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$spec$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SITE_SPEC_THEME"]);
    const theme = {};
    if (r.keys(v['theme'], `${path}.theme`, themeKeys)) for (const key of themeKeys)theme[key] = r.oneOf(v['theme'][key], `${path}.theme.${key}`, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$spec$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SITE_SPEC_THEME"][key]);
    const heroVariant = r.oneOf(v['heroVariant'], `${path}.heroVariant`, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$spec$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SITE_SPEC_SECTIONS"]['hero'] ?? []);
    const order = list(v['sectionOrder']);
    if (!Array.isArray(v['sectionOrder']) || order.length < 1 || order.length > Object.keys(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$spec$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SITE_SPEC_SECTIONS"]).length) r.errors.push(`${path}.sectionOrder: список типов секций`);
    const sectionOrder = order.map((t, i)=>r.oneOf(t, `${path}.sectionOrder[${i}]`, Object.keys(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$spec$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SITE_SPEC_SECTIONS"])));
    if (new Set(sectionOrder).size !== sectionOrder.length) r.errors.push(`${path}.sectionOrder: без повторов`);
    return {
        id,
        name,
        shortDescription,
        theme,
        heroVariant,
        sectionOrder
    };
}
function parseAssistantResult(mode, raw) {
    const r = new Reader();
    let assistantText = '';
    let payload = null;
    if (mode === 'CHAT') {
        if (r.keys(raw, 'result', [
            'answer',
            'suggestBuild',
            'suggestPublish'
        ], [
            'answer'
        ])) {
            assistantText = r.text(raw['answer'], 'result.answer', SITE_AI_ASSISTANT_TEXT_MAX);
            payload = {
                kind: 'CHAT',
                suggestBuild: r.bool(raw['suggestBuild'], 'result.suggestBuild'),
                suggestPublish: r.bool(raw['suggestPublish'], 'result.suggestPublish')
            };
        }
    } else if (mode === 'PLAN') {
        const kind = isRec(raw) ? raw['kind'] : undefined;
        if (kind === 'QUESTIONS') {
            if (r.keys(raw, 'result', [
                'kind',
                'intro',
                'questions'
            ], [
                'kind',
                'questions'
            ])) {
                const intro = raw['intro'] === undefined ? null : r.text(raw['intro'], 'result.intro', 500);
                const items = list(raw['questions']);
                if (!Array.isArray(raw['questions']) || items.length < 1 || items.length > PLAN_QUESTIONS_MAX) r.errors.push(`result.questions: от 1 до ${PLAN_QUESTIONS_MAX}`);
                const questions = items.map((q, i)=>{
                    const p = `result.questions[${i}]`;
                    if (!r.keys(q, p, [
                        'id',
                        'question',
                        'options',
                        'allowCustom'
                    ], [
                        'id',
                        'question',
                        'options'
                    ])) return {
                        id: '',
                        question: '',
                        options: [],
                        allowCustom: false
                    };
                    const id = typeof q['id'] === 'string' && ID_RE.test(q['id']) ? q['id'] : (r.errors.push(`${p}.id: идентификатор`), '');
                    return {
                        id,
                        question: r.text(q['question'], `${p}.question`, 300, true),
                        options: r.strings(q['options'], `${p}.options`, 2, 6, 120),
                        allowCustom: r.bool(q['allowCustom'], `${p}.allowCustom`)
                    };
                });
                if (new Set(questions.map((q)=>q.id)).size !== questions.length) r.errors.push('result.questions: id без повторов');
                assistantText = intro ?? 'Чтобы составить план, ответьте на несколько вопросов.';
                payload = {
                    kind: 'QUESTIONS',
                    questions
                };
            }
        } else if (kind === 'PLAN') {
            if (r.keys(raw, 'result', [
                'kind',
                'summary',
                'affectedPages',
                'affectedSections',
                'steps',
                'tradeoffs',
                'buildInstruction'
            ])) {
                const ids = (v, p)=>{
                    if (!Array.isArray(v) || v.length > 50 || !v.every((x)=>typeof x === 'string' && ID_RE.test(x))) {
                        r.errors.push(`${p}: список id`);
                        return [];
                    }
                    return v;
                };
                const summary = r.text(raw['summary'], 'result.summary', 600, true);
                payload = {
                    kind: 'PLAN',
                    summary,
                    affectedPages: ids(raw['affectedPages'], 'result.affectedPages'),
                    affectedSections: ids(raw['affectedSections'], 'result.affectedSections'),
                    steps: r.strings(raw['steps'], 'result.steps', 1, 10, 300),
                    tradeoffs: r.strings(raw['tradeoffs'], 'result.tradeoffs', 0, 5, 300),
                    buildInstruction: r.text(raw['buildInstruction'], 'result.buildInstruction', __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$edit$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["PATCH_INSTRUCTION_MAX"])
                };
                assistantText = summary;
            }
        } else r.errors.push('result.kind: QUESTIONS или PLAN');
    } else {
        if (r.keys(raw, 'result', [
            'directions'
        ])) {
            const items = list(raw['directions']);
            if (!Array.isArray(raw['directions']) || items.length !== DESIGN_DIRECTIONS) r.errors.push(`result.directions: ровно ${DESIGN_DIRECTIONS}`);
            const directions = items.map((d, i)=>readDirection(r, d, `result.directions[${i}]`)).filter((d)=>d !== null);
            if (new Set(directions.map((d)=>d.id)).size !== directions.length) r.errors.push('result.directions: id без повторов');
            assistantText = 'Три варианта оформления: выберите один.';
            payload = {
                kind: 'DESIGN',
                directions
            };
        }
    }
    if (payload && new TextEncoder().encode(JSON.stringify(payload)).length > SITE_AI_PAYLOAD_MAX_BYTES) r.errors.push('result: больше 32 КиБ');
    if (r.errors.length || !payload) return {
        ok: false,
        errors: r.errors.length ? r.errors : [
            'result: пусто'
        ]
    };
    return {
        ok: true,
        assistantText,
        payload
    };
}
function applyDesignDirection(spec, direction) {
    const next = structuredClone(isRec(spec) ? spec : {});
    next['theme'] = {
        ...isRec(next['theme']) ? next['theme'] : {},
        ...direction.theme
    };
    for (const page of list(next['pages'])){
        if (!isRec(page) || page['isHome'] !== true) continue;
        const sections = list(page['sections']).filter(isRec);
        const rank = (s)=>{
            const i = direction.sectionOrder.indexOf(String(s['type']));
            return i < 0 ? direction.sectionOrder.length : i;
        };
        const ordered = sections.map((s, i)=>({
                s,
                i
            })).sort((a, b)=>rank(a.s) - rank(b.s) || a.i - b.i).map((x)=>x.s);
        page['sections'] = ordered.map((s)=>{
            if (s['type'] !== 'hero' || s['variant'] === direction.heroVariant) return s;
            const needsImage = direction.heroVariant !== 'TEXT_ONLY';
            if (needsImage && !isRec(s['image'])) return s;
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["applySectionVariant"])(s, direction.heroVariant);
        });
    }
    return next;
}
function encodeDesignInstruction(design, text) {
    const out = `${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$canonical$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["canonicalJson"])({
        v: 1,
        design
    })}\n${text ?? ''}`;
    if ([
        ...out
    ].length > __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$edit$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["INSTRUCTION_COLUMN_MAX"]) throw new Error('Конверт оформления длиннее колонки');
    return out;
}
function decodeDesignInstruction(raw) {
    if (!raw) return null;
    const cut = raw.indexOf('\n');
    if (cut < 0) return null;
    let value;
    try {
        value = JSON.parse(raw.slice(0, cut));
    } catch  {
        return null;
    }
    if (!isRec(value) || Object.keys(value).sort().join(',') !== 'design,v' || value['v'] !== 1) return null;
    const r = new Reader();
    const design = readDirection(r, value['design'], 'design');
    if (!design || r.errors.length) return null;
    const rest = raw.slice(cut + 1);
    return {
        design,
        text: rest.trim() ? rest : null
    };
}
function designInstructionText(decoded) {
    const d = decoded.design;
    const line = `Оформление «${d.name}»: ${d.shortDescription}. Порядок блоков главной: ${d.sectionOrder.join(', ')}.`;
    return decoded.text ? `${decoded.text}\n\n${line}` : line;
}
function fieldTargets(record, fields, base, locale, out) {
    // целью становятся только текст, список текстов, подпись кнопки и тексты внутри списков; выбор категории, картинки,
    // карта, переключатели и значки сюда не попадают ни одной веткой
    for (const field of fields){
        const value = record[field.key];
        const path = `${base}.${field.key}`;
        if (field.spec.kind === 'text') {
            if (isRec(value)) out.push({
                path,
                max: field.spec.max,
                value: String(value[locale] ?? '')
            });
        } else if (field.spec.kind === 'textList') {
            const max = field.spec.max;
            list(value).forEach((v, i)=>isRec(v) && out.push({
                    path: `${path}[${i}]`,
                    max,
                    value: String(v[locale] ?? '')
                }));
        } else if (field.spec.kind === 'cta') {
            if (isRec(value) && isRec(value['label'])) out.push({
                path: `${path}.label`,
                max: 30,
                value: String(value['label'][locale] ?? '')
            });
        } else if (field.spec.kind === 'list') {
            const item = field.spec.item;
            list(value).forEach((v, i)=>isRec(v) && fieldTargets(v, item, `${path}[${i}]`, locale, out));
        }
    }
}
function inlineTextTargets(spec, locale) {
    const out = [];
    if (!isRec(spec)) return out;
    const site = isRec(spec['site']) ? spec['site'] : {};
    const brand = isRec(site['brand']) ? site['brand'] : {};
    if (isRec(brand['tagline'])) out.push({
        path: 'site.brand.tagline',
        max: 120,
        value: String(brand['tagline'][locale] ?? '')
    });
    const nav = isRec(spec['navigation']) ? spec['navigation'] : {};
    for (const [key, max] of [
        [
            'header',
            30
        ],
        [
            'footer',
            40
        ]
    ])list(nav[key]).forEach((item, i)=>{
        if (isRec(item) && isRec(item['label'])) out.push({
            path: `navigation.${key}[${i}].label`,
            max,
            value: String(item['label'][locale] ?? '')
        });
    });
    list(spec['pages']).forEach((page, p)=>{
        if (!isRec(page)) return;
        list(page['sections']).forEach((section, s)=>{
            if (!isRec(section)) return;
            const shape = __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SITE_EDITOR_SECTIONS"][String(section['type'])];
            if (!shape) return;
            const variant = String(section['variant']);
            fieldTargets(section, shape.fields.filter((f)=>!f.variants || f.variants.includes(variant)), `pages[${p}].sections[${s}]`, locale, out);
        });
    });
    return out;
}
/** Путь в части: `a.b[2].c` → ['a','b',2,'c'] */ function pathParts(path) {
    if (!/^[a-zA-Z]+(?:\[\d+\]|\.[a-zA-Z]+)*$/.test(path)) return null;
    const parts = [];
    for (const m of path.matchAll(/([a-zA-Z]+)|\[(\d+)\]/g))parts.push(m[1] !== undefined ? m[1] : Number(m[2]));
    return parts;
}
function setInlineText(spec, path, locale, raw) {
    const target = inlineTextTargets(spec, locale).find((t)=>t.path === path);
    if (!target) return {
        ok: false,
        message: 'Этот текст на сайте не правится: откройте форму блока'
    };
    const parsed = cleanText(raw, target.max, false, 'Текст');
    if (!parsed.ok) return {
        ok: false,
        message: parsed.message
    };
    const parts = pathParts(path);
    if (!parts) return {
        ok: false,
        message: 'Неверный путь'
    };
    const next = structuredClone(spec);
    let node = next;
    for (const part of parts)node = node[part];
    if (!isRec(node)) return {
        ok: false,
        message: 'Неверный путь'
    };
    node[locale] = parsed.value;
    return {
        ok: true,
        spec: next
    };
}
}),
"[project]/wt-personnel/packages/domain/src/marketing/campaigns.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CAMPAIGN_STATS_MAX_ROWS",
    ()=>CAMPAIGN_STATS_MAX_ROWS,
    "MARKETING_CAMPAIGN_STATUSES",
    ()=>MARKETING_CAMPAIGN_STATUSES,
    "campaignMetrics",
    ()=>campaignMetrics,
    "parseCampaignInput",
    ()=>parseCampaignInput,
    "parseCampaignStatsCsv",
    ()=>parseCampaignStatsCsv,
    "parseCampaignStatsInput",
    ()=>parseCampaignStatsInput
]);
/**
 * Рекламные кампании и их статистика по дням (DATA_MODEL §53, ADR-MKT-B3, этап МКТ-В3 ручная часть). Показы, клики и
 * лиды площадки вводятся вручную или CSV; деньги кампании это её расходы из журнала (§41.1), отдельной суммы нет.
 * Показатели считаются целыми: CTR в сотых долях процента, CPC, CPM и CPL в minor units (ADR-008).
 */ var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$budget$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/budget.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$expense$2d$import$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/expense-import.ts [app-ssr] (ecmascript)");
;
;
const MARKETING_CAMPAIGN_STATUSES = [
    'ACTIVE',
    'PAUSED',
    'FINISHED'
];
const fail = (msg)=>{
    throw new __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$budget$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["MarketingBudgetError"](msg);
};
const str = (v)=>typeof v === 'string' ? v.trim() : '';
const optionalDate = (v, name)=>str(v) === '' ? null : (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$budget$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["isoDate"])(v, name);
function parseCampaignInput(body) {
    const platform = __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$budget$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["MARKETING_PLATFORMS"].find((p)=>p === str(body.platform));
    if (!platform) fail('Платформа: выберите из списка каналов');
    const name = str(body.name).replace(/\s+/g, ' ');
    if (name === '') fail('Название кампании обязательно');
    if (name.length > 200) fail('Название: не больше 200 знаков');
    const status = str(body.status) === '' ? 'ACTIVE' : MARKETING_CAMPAIGN_STATUSES.find((s)=>s === str(body.status));
    if (!status) fail('Статус: идёт, на паузе или завершена');
    const startsOn = optionalDate(body.startsOn, 'Начало');
    const endsOn = optionalDate(body.endsOn, 'Окончание');
    if (startsOn && endsOn && endsOn < startsOn) fail('Окончание не может быть раньше начала');
    return {
        platform: platform,
        name,
        status: status,
        startsOn,
        endsOn
    };
}
/** Неотрицательное целое; пустое это ноль; пробелы в тысячах допустимы */ const count = (v, name)=>{
    const s = (typeof v === 'number' ? String(v) : str(v)).replace(/\s/g, '');
    if (s === '') return 0;
    if (!/^\d{1,10}$/.test(s)) fail(`${name}: целое число не меньше нуля`);
    const n = Number(s);
    if (n > 2_000_000_000) fail(`${name}: число неправдоподобно велико`);
    return n;
};
function parseCampaignStatsInput(body) {
    const date = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$budget$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["isoDate"])(body.date, 'Дата');
    const impressions = count(body.impressions, 'Показы');
    const clicks = count(body.clicks, 'Клики');
    const leads = count(body.leads, 'Лиды');
    if (clicks > impressions) fail('Кликов не может быть больше показов');
    return {
        date,
        impressions,
        clicks,
        leads
    };
}
const COLUMNS = {
    date: 'дата',
    impressions: 'показы',
    clicks: 'клики',
    leads: 'лиды'
};
const CAMPAIGN_STATS_MAX_ROWS = 400;
function parseCampaignStatsCsv(text) {
    const body = text.replace(/^\uFEFF/, '');
    const [header = [], ...rest] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$expense$2d$import$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["splitRecords"])(body, (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$expense$2d$import$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["delimiterOf"])(body.split(/\r?\n/, 1)[0] ?? ''));
    const names = header.map((h)=>h.trim().toLowerCase());
    const at = (k)=>names.indexOf(COLUMNS[k]);
    if (at('date') < 0) fail('В файле нет колонки «Дата»');
    const lines = rest.map((cells, i)=>({
            cells,
            line: i + 2
        })).filter(({ cells })=>cells.some((c)=>c.trim() !== ''));
    if (lines.length === 0) fail('В файле нет ни одной строки статистики');
    if (lines.length > CAMPAIGN_STATS_MAX_ROWS) fail(`За раз не больше ${CAMPAIGN_STATS_MAX_ROWS} дней, в файле ${lines.length}`);
    const rows = [];
    const errors = [];
    const seen = new Set();
    for (const { cells, line } of lines){
        const cell = (k)=>at(k) < 0 ? '' : (cells[at(k)] ?? '').trim();
        try {
            const row = parseCampaignStatsInput({
                date: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$expense$2d$import$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["excelDate"])(cell('date')),
                impressions: cell('impressions'),
                clicks: cell('clicks'),
                leads: cell('leads')
            });
            if (seen.has(row.date)) fail(`день ${row.date} указан дважды`);
            seen.add(row.date);
            rows.push({
                line,
                ...row
            });
        } catch (e) {
            if (!(e instanceof __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$budget$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["MarketingBudgetError"])) throw e;
            errors.push(`Строка ${line}: ${e.message}`);
        }
    }
    if (errors.length > 0) {
        const shown = errors.slice(0, 10);
        if (errors.length > 10) shown.push(`и ещё ${errors.length - 10} строк с ошибками`);
        fail(`Файл не загружен, ничего не записано:\n${shown.join('\n')}`);
    }
    return rows;
}
const divRound = (a, b)=>(a * 2n + b) / (b * 2n);
function campaignMetrics(m) {
    const per = (count, scale = 1n)=>m.spendMinor > 0n && count > 0 ? divRound(m.spendMinor * scale, BigInt(count)) : null;
    return {
        ctrBp: m.impressions > 0 ? Number(divRound(BigInt(m.clicks) * 10000n, BigInt(m.impressions))) : null,
        cpcMinor: per(m.clicks),
        cpmMinor: per(m.impressions, 1000n),
        cplMinor: per(m.leads)
    };
}
}),
"[project]/wt-personnel/packages/domain/src/marketing/canonical.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "canonicalByteLength",
    ()=>canonicalByteLength,
    "canonicalJson",
    ()=>canonicalJson,
    "siteSpecHash",
    ()=>siteSpecHash
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:crypto [external] (node:crypto, cjs)");
;
function canonicalJson(value) {
    if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) throw new TypeError('canonicalJson: число вне JSON');
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) return `[${value.map((item)=>canonicalJson(item ?? null)).join(',')}]`;
    if (typeof value === 'object') {
        const record = value;
        const keys = Object.keys(record).filter((key)=>record[key] !== undefined).sort((a, b)=>a < b ? -1 : a > b ? 1 : 0);
        return `{${keys.map((key)=>`${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
    }
    throw new TypeError(`canonicalJson: ${typeof value} вне JSON`);
}
function siteSpecHash(value) {
    return (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["createHash"])('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}
function canonicalByteLength(value) {
    return Buffer.byteLength(canonicalJson(value), 'utf8');
}
}),
"[project]/wt-personnel/packages/domain/src/marketing/conversation.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ASSISTANT_HISTORY_MAX_CHARS",
    ()=>ASSISTANT_HISTORY_MAX_CHARS,
    "ASSISTANT_HISTORY_MAX_TURNS",
    ()=>ASSISTANT_HISTORY_MAX_TURNS,
    "BUILD_HISTORY_REPLY",
    ()=>BUILD_HISTORY_REPLY,
    "PLAN_ANSWER_MAX",
    ()=>PLAN_ANSWER_MAX,
    "boundAssistantHistory",
    ()=>boundAssistantHistory,
    "historyChars",
    ()=>historyChars,
    "parsePlanAnswers",
    ()=>parsePlanAnswers,
    "planFollowUpText",
    ()=>planFollowUpText
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$builder$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/builder.ts [app-ssr] (ecmascript)");
;
const ASSISTANT_HISTORY_MAX_TURNS = 12;
const ASSISTANT_HISTORY_MAX_CHARS = 16_000;
const PLAN_ANSWER_MAX = 400;
const BUILD_HISTORY_REPLY = 'Изменение применено к сайту';
function historyChars(items) {
    return [
        ...JSON.stringify(items)
    ].length;
}
function boundAssistantHistory(chronological) {
    const kept = [];
    let chars = 2; // скобки массива
    for(let i = chronological.length - 1; i >= 0 && kept.length < ASSISTANT_HISTORY_MAX_TURNS; i -= 1){
        const item = chronological[i];
        const size = [
            ...JSON.stringify(item)
        ].length + (kept.length ? 1 : 0);
        if (chars + size > ASSISTANT_HISTORY_MAX_CHARS) break;
        chars += size;
        kept.unshift(item);
    }
    return kept;
}
function parsePlanAnswers(raw, questions) {
    if (!Array.isArray(raw) || raw.length !== questions.length) return {
        ok: false,
        message: `answers: ответ на каждый из ${questions.length} вопросов ровно один раз`
    };
    const byId = new Map(questions.map((q)=>[
            q.id,
            q
        ]));
    const seen = new Map();
    for (const [i, item] of raw.entries()){
        if (!item || typeof item !== 'object' || Array.isArray(item)) return {
            ok: false,
            message: `answers[${i}]: объект`
        };
        const extra = Object.keys(item).filter((key)=>key !== 'questionId' && key !== 'answer');
        if (extra.length) return {
            ok: false,
            message: `answers[${i}]: лишние поля ${extra.join(', ')}`
        };
        const { questionId, answer } = item;
        const question = typeof questionId === 'string' ? byId.get(questionId) : undefined;
        if (!question) return {
            ok: false,
            message: `answers[${i}].questionId: такого вопроса в плане нет`
        };
        if (seen.has(question.id)) return {
            ok: false,
            message: `answers[${i}].questionId: вопрос «${question.id}» уже отвечен`
        };
        const text = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$builder$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["parseAssistantText"])(answer, false);
        if (!text.ok || !text.value || [
            ...text.value
        ].length > PLAN_ANSWER_MAX) return {
            ok: false,
            message: `answers[${i}].answer: от 1 до ${PLAN_ANSWER_MAX} знаков`
        };
        if (!question.options.includes(text.value) && !question.allowCustom) return {
            ok: false,
            message: `answers[${i}].answer: выберите один из вариантов вопроса «${question.id}»`
        };
        seen.set(question.id, text.value);
    }
    return {
        ok: true,
        answers: questions.map((q)=>({
                questionId: q.id,
                answer: seen.get(q.id)
            }))
    };
}
function planFollowUpText(parentUserText, questions, answers, extra) {
    const parts = [
        `Исходный запрос:\n${parentUserText}`,
        `Уточняющие вопросы:\n${questions.map((q)=>`${q.id}: ${q.question}`).join('\n')}`,
        `Ответы:\n${answers.map((a)=>`${a.questionId}: ${a.answer}`).join('\n')}`
    ];
    if (extra) parts.push(`Дополнение:\n${extra}`);
    return parts.join('\n\n');
}
}),
"[project]/wt-personnel/packages/domain/src/marketing/design-presets.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DESIGN_PRESETS",
    ()=>DESIGN_PRESETS,
    "designPresetById",
    ()=>designPresetById,
    "designPresetDirection",
    ()=>designPresetDirection,
    "designTripleCount",
    ()=>designTripleCount,
    "pickDesignTriple",
    ()=>pickDesignTriple
]);
// Порядок блоков главной: типы всех трёх направлений (гостиница, салон, ресторан); чего на сайте нет, то пропускается
const HOME_SALES = [
    'hero',
    'features',
    'accommodations',
    'services',
    'menu',
    'pricing',
    'staff',
    'booking',
    'leadForm',
    'hours',
    'gallery',
    'faq',
    'contacts'
];
const HOME_STORY = [
    'hero',
    'about',
    'gallery',
    'staff',
    'accommodations',
    'services',
    'menu',
    'features',
    'hours',
    'booking',
    'leadForm',
    'faq',
    'contacts'
];
const HOME_BOOKING_FIRST = [
    'hero',
    'booking',
    'leadForm',
    'accommodations',
    'services',
    'menu',
    'pricing',
    'staff',
    'hours',
    'features',
    'gallery',
    'contacts',
    'faq'
];
const DESIGN_PRESETS = Object.freeze([
    // ---------- светлые ----------
    {
        id: 'light-minimal',
        family: 'LIGHT',
        name: 'Светлый минимал',
        shortDescription: 'Белый фон, много воздуха, строгий шрифт без засечек и цены сразу под первым экраном',
        theme: {
            preset: 'CALM',
            accent: 'TEAL',
            typography: 'MODERN',
            radius: 'SOFT',
            density: 'COMFORTABLE',
            colorScheme: 'LIGHT'
        },
        heroVariant: 'TEXT_ONLY',
        sectionOrder: HOME_SALES
    },
    {
        id: 'light-coast',
        family: 'LIGHT',
        name: 'Лёгкий бриз',
        shortDescription: 'Свежие морские оттенки, округлый шрифт и мягкие углы, спокойный рассказ о месте',
        theme: {
            preset: 'COAST',
            accent: 'FOREST',
            typography: 'ROUNDED',
            radius: 'ROUND',
            density: 'COMFORTABLE',
            colorScheme: 'LIGHT'
        },
        heroVariant: 'IMAGE_SIDE',
        sectionOrder: HOME_STORY
    },
    {
        id: 'light-swiss',
        family: 'LIGHT',
        name: 'Чёткая сетка',
        shortDescription: 'Плотная раскладка, прямые углы, синий акцент и кнопка записи выше всего',
        theme: {
            preset: 'CALM',
            accent: 'INDIGO',
            typography: 'MODERN',
            radius: 'SHARP',
            density: 'COMPACT',
            colorScheme: 'LIGHT'
        },
        heroVariant: 'TEXT_ONLY',
        sectionOrder: HOME_BOOKING_FIRST
    },
    // ---------- глубокие, премиальные ----------
    {
        id: 'deep-premium',
        family: 'DEEP',
        name: 'Глубокий премиум',
        shortDescription: 'Глубокий холодный фон, графит и антиква, большой первый экран с фото',
        theme: {
            preset: 'NIGHT',
            accent: 'GRAPHITE',
            typography: 'CLASSIC',
            radius: 'SHARP',
            density: 'COMFORTABLE',
            colorScheme: 'LIGHT'
        },
        heroVariant: 'IMAGE_FULL',
        sectionOrder: HOME_STORY
    },
    {
        id: 'deep-gold',
        family: 'DEEP',
        name: 'Вечерний город',
        shortDescription: 'Холодная гамма с золотым акцентом, антиква и бронь сразу после первого экрана',
        theme: {
            preset: 'NIGHT',
            accent: 'GOLD',
            typography: 'CLASSIC',
            radius: 'SOFT',
            density: 'COMPACT',
            colorScheme: 'LIGHT'
        },
        heroVariant: 'IMAGE_SIDE',
        sectionOrder: HOME_BOOKING_FIRST
    },
    {
        id: 'deep-indigo',
        family: 'DEEP',
        name: 'Ночной индиго',
        shortDescription: 'Насыщенный индиго, современный шрифт, преимущества и цены крупными карточками',
        theme: {
            preset: 'NIGHT',
            accent: 'INDIGO',
            typography: 'MODERN',
            radius: 'ROUND',
            density: 'COMFORTABLE',
            colorScheme: 'LIGHT'
        },
        heroVariant: 'TEXT_ONLY',
        sectionOrder: HOME_SALES
    },
    // ---------- тёплые, яркие ----------
    {
        id: 'warm-bright',
        family: 'WARM',
        name: 'Яркий тёплый',
        shortDescription: 'Кремовый фон, терракотовый акцент, округлый шрифт и дружелюбные крупные кнопки',
        theme: {
            preset: 'WARM',
            accent: 'TERRACOTTA',
            typography: 'ROUNDED',
            radius: 'ROUND',
            density: 'COMFORTABLE',
            colorScheme: 'LIGHT'
        },
        heroVariant: 'IMAGE_FULL',
        sectionOrder: HOME_SALES
    },
    {
        id: 'warm-classic',
        family: 'WARM',
        name: 'Тёплый дом',
        shortDescription: 'Тёплая бумага, антиква и золотистый акцент, неспешный рассказ с галереей',
        theme: {
            preset: 'WARM',
            accent: 'GOLD',
            typography: 'CLASSIC',
            radius: 'SOFT',
            density: 'COMFORTABLE',
            colorScheme: 'LIGHT'
        },
        heroVariant: 'IMAGE_SIDE',
        sectionOrder: HOME_STORY
    },
    {
        id: 'warm-garden',
        family: 'WARM',
        name: 'Зелёный сад',
        shortDescription: 'Тёплый фон и лесной зелёный акцент, плотная раскладка, запись в одно касание',
        theme: {
            preset: 'WARM',
            accent: 'FOREST',
            typography: 'MODERN',
            radius: 'SOFT',
            density: 'COMPACT',
            colorScheme: 'LIGHT'
        },
        heroVariant: 'TEXT_ONLY',
        sectionOrder: HOME_BOOKING_FIRST
    }
]);
function designPresetById(id) {
    return typeof id === 'string' ? DESIGN_PRESETS.find((p)=>p.id === id) ?? null : null;
}
function designPresetDirection(preset) {
    return {
        id: preset.id,
        name: preset.name,
        shortDescription: preset.shortDescription,
        theme: {
            ...preset.theme
        },
        heroVariant: preset.heroVariant,
        sectionOrder: [
            ...preset.sectionOrder
        ]
    };
}
const FAMILIES = [
    'LIGHT',
    'DEEP',
    'WARM'
];
/** Сдвиг по направлению бизнеса: салон, ресторан и гостиница начинают с разных троек */ const VERTICAL_SHIFT = {
    HOSPITALITY: 0,
    BEAUTY: 1,
    FOOD_SERVICE: 2
};
function designTripleCount() {
    return Math.max(...FAMILIES.map((f)=>DESIGN_PRESETS.filter((p)=>p.family === f).length));
}
function pickDesignTriple(vertical, page) {
    const shift = VERTICAL_SHIFT[vertical ?? ''] ?? 0;
    const n = Number.isFinite(page) ? Math.trunc(page) : 0;
    return FAMILIES.map((family, i)=>{
        const pool = DESIGN_PRESETS.filter((p)=>p.family === family);
        const at = ((n + shift + i) % pool.length + pool.length) % pool.length;
        return pool[at];
    });
}
}),
"[project]/wt-personnel/packages/domain/src/marketing/diff.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "diffSiteSpecs",
    ()=>diffSiteSpecs
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$canonical$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/canonical.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$assets$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/assets.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/editor.ts [app-ssr] (ecmascript)");
;
;
;
const isRec = (v)=>v !== null && typeof v === 'object' && !Array.isArray(v);
const list = (v)=>Array.isArray(v) ? v : [];
const same = (a, b)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$canonical$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["canonicalJson"])(a ?? null) === (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$canonical$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["canonicalJson"])(b ?? null);
const SITE_FIELDS = [
    [
        'displayName',
        (s)=>s['site']?.['displayName']
    ],
    [
        'tagline',
        (s)=>s['site']?.['brand']?.['tagline']
    ],
    [
        'locales',
        (s)=>[
                s['site']?.['locales'],
                s['site']?.['defaultLocale']
            ]
    ],
    [
        'contacts',
        (s)=>s['site']?.['contacts']
    ],
    [
        'legal',
        (s)=>s['site']?.['legal']
    ],
    [
        'seo',
        (s)=>s['site']?.['seo']
    ],
    [
        'theme',
        (s)=>s['theme']
    ],
    [
        'integrations',
        (s)=>s['integrations']
    ],
    [
        'navigation',
        (s)=>s['navigation']
    ]
];
function pagesOf(spec) {
    return list(spec['pages']).filter(isRec).filter((p)=>typeof p['id'] === 'string').map((p)=>({
            id: p['id'],
            page: p,
            sections: list(p['sections']).filter(isRec).filter((s)=>typeof s['id'] === 'string').map((s)=>({
                    id: s['id'],
                    section: s
                }))
        }));
}
/** Элементы, не входящие в наибольшую общую подпоследовательность: они и «переставлены» */ function movedIds(from, to) {
    const common = new Set(from.filter((id)=>to.includes(id)));
    const a = from.filter((id)=>common.has(id));
    const b = to.filter((id)=>common.has(id));
    const dp = Array.from({
        length: a.length + 1
    }, ()=>new Array(b.length + 1).fill(0));
    for(let i = a.length - 1; i >= 0; i -= 1)for(let j = b.length - 1; j >= 0; j -= 1)dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    const keep = new Set();
    let i = 0;
    let j = 0;
    while(i < a.length && j < b.length){
        if (a[i] === b[j]) {
            keep.add(a[i]);
            i += 1;
            j += 1;
        } else if (dp[i + 1][j] >= dp[i][j + 1]) i += 1;
        else j += 1;
    }
    return new Set(b.filter((id)=>!keep.has(id)));
}
/** Содержимое секции без служебных полей и без ссылок на картинки: картинки идут отдельными событиями */ function content(section) {
    const strip = (v)=>{
        if (Array.isArray(v)) return v.map(strip);
        if (!isRec(v)) return v;
        const out = {};
        for (const [k, x] of Object.entries(v))if (![
            'assetId',
            'imageAssetId',
            'faviconAssetId'
        ].includes(k)) out[k] = strip(x);
        return out;
    };
    const rest = {
        ...section
    };
    delete rest['id'];
    delete rest['type'];
    delete rest['variant'];
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$canonical$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["canonicalJson"])(strip(rest));
}
function slotsOf(spec) {
    const pages = list(spec['pages']);
    const slots = new Map();
    for (const ref of (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$assets$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["siteSpecAssetRefs"])(spec)){
        let slot;
        if (ref.path.startsWith('site.brand.logo')) slot = 'logo';
        else if (ref.path === 'site.brand.faviconAssetId') slot = 'favicon';
        else {
            const m = /^pages\[(\d+)\](?:\.sections\[(\d+)\]\.(images|image|items|categories)\b)?/.exec(ref.path);
            const page = m ? pages[Number(m[1])] : undefined;
            if (!m || !page) continue;
            if (!m[2]) slot = `page:${String(page['id'])}:og`;
            else {
                const section = list(page['sections'])[Number(m[2])];
                slot = `section:${String(section?.['id'])}:${m[3]}`;
            }
        }
        const ids = slots.get(slot) ?? [];
        if (!ids.includes(ref.assetId)) ids.push(ref.assetId);
        slots.set(slot, ids);
    }
    return slots;
}
const SINGLE = (slot)=>slot === 'logo' || slot === 'favicon' || slot.endsWith(':og') || slot.endsWith(':image');
function diffSiteSpecs(fromSpec, toSpec) {
    const from = isRec(fromSpec) ? fromSpec : {};
    const to = isRec(toSpec) ? toSpec : {};
    const locale = String(to['site']?.['defaultLocale'] ?? from['site']?.['defaultLocale'] ?? 'ru');
    const out = [];
    for (const [field, get] of SITE_FIELDS)if (!same(get(from), get(to))) out.push({
        area: 'site',
        kind: 'changed',
        field
    });
    // страницы
    const fromPages = pagesOf(from);
    const toPages = pagesOf(to);
    const fromById = new Map(fromPages.map((p)=>[
            p.id,
            p
        ]));
    const toIds = new Set(toPages.map((p)=>p.id));
    const movedPages = movedIds(fromPages.map((p)=>p.id), toPages.map((p)=>p.id));
    for (const p of toPages){
        const label = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["localizedText"])(p.page['title'], locale);
        const before = fromById.get(p.id);
        if (!before) {
            out.push({
                area: 'page',
                kind: 'added',
                pageId: p.id,
                label
            });
            continue;
        }
        if (movedPages.has(p.id)) out.push({
            area: 'page',
            kind: 'moved',
            pageId: p.id,
            label
        });
        for (const [field, key] of [
            [
                'title',
                'title'
            ],
            [
                'slug',
                'slug'
            ],
            [
                'seo',
                'seo'
            ],
            [
                'settings',
                'isHome'
            ]
        ])if (!same(before.page[key], p.page[key])) out.push({
            area: 'page',
            kind: 'changed',
            field,
            pageId: p.id,
            label
        });
    }
    for (const p of fromPages)if (!toIds.has(p.id)) out.push({
        area: 'page',
        kind: 'removed',
        pageId: p.id,
        label: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["localizedText"])(p.page['title'], locale)
    });
    // секции: id уникален во всём документе, поэтому перенос на другую страницу тоже узнаётся
    const fromSections = new Map();
    for (const p of fromPages)for (const s of p.sections)fromSections.set(s.id, {
        pageId: p.id,
        section: s.section
    });
    const toSectionIds = new Set();
    for (const p of toPages){
        const before = fromById.get(p.id);
        const stayed = p.sections.filter((s)=>fromSections.get(s.id)?.pageId === p.id).map((s)=>s.id);
        const beforeOrder = (before?.sections ?? []).map((s)=>s.id).filter((id)=>stayed.includes(id));
        const moved = movedIds(beforeOrder, stayed);
        for (const s of p.sections){
            toSectionIds.add(s.id);
            const type = String(s.section['type']);
            const label = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["localizedText"])(s.section['heading'], locale);
            const was = fromSections.get(s.id);
            const base = {
                area: 'section',
                pageId: p.id,
                sectionId: s.id,
                sectionType: type,
                label
            };
            if (!was) {
                out.push({
                    ...base,
                    kind: 'added'
                });
                continue;
            }
            if (was.pageId !== p.id) out.push({
                ...base,
                kind: 'moved',
                field: 'page',
                from: was.pageId,
                to: p.id
            });
            else if (moved.has(s.id)) out.push({
                ...base,
                kind: 'moved'
            });
            if (was.section['variant'] !== s.section['variant']) out.push({
                ...base,
                kind: 'variant',
                from: String(was.section['variant']),
                to: String(s.section['variant'])
            });
            if (content(was.section) !== content(s.section) || was.section['type'] !== s.section['type']) out.push({
                ...base,
                kind: 'changed'
            });
        }
    }
    for (const p of fromPages)for (const s of p.sections)if (!toSectionIds.has(s.id)) out.push({
        area: 'section',
        kind: 'removed',
        pageId: p.id,
        sectionId: s.id,
        sectionType: String(s.section['type']),
        label: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["localizedText"])(s.section['heading'], locale)
    });
    // картинки по местам
    const before = slotsOf(from);
    const after = slotsOf(to);
    const slots = [
        ...new Set([
            ...before.keys(),
            ...after.keys()
        ])
    ].sort();
    for (const slot of slots){
        const a = before.get(slot) ?? [];
        const b = after.get(slot) ?? [];
        if (SINGLE(slot) && a.length === 1 && b.length === 1) {
            if (a[0] !== b[0]) out.push({
                area: 'asset',
                kind: 'replaced',
                slot,
                from: a[0],
                to: b[0]
            });
            continue;
        }
        for (const id of [
            ...b
        ].sort())if (!a.includes(id)) out.push({
            area: 'asset',
            kind: 'added',
            slot,
            to: id
        });
        for (const id of [
            ...a
        ].sort())if (!b.includes(id)) out.push({
            area: 'asset',
            kind: 'removed',
            slot,
            from: id
        });
    }
    return out;
}
}),
"[project]/wt-personnel/packages/domain/src/marketing/edit.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "INSTRUCTION_COLUMN_MAX",
    ()=>INSTRUCTION_COLUMN_MAX,
    "PATCH_INSTRUCTION_MAX",
    ()=>PATCH_INSTRUCTION_MAX,
    "SECTION_DEFAULT_INSTRUCTION",
    ()=>SECTION_DEFAULT_INSTRUCTION,
    "SECTION_INSTRUCTION_MAX",
    ()=>SECTION_INSTRUCTION_MAX,
    "SITE_EDIT_SCHEMA_VERSION",
    ()=>SITE_EDIT_SCHEMA_VERSION,
    "checkEditedSpec",
    ()=>checkEditedSpec,
    "decodeSectionInstruction",
    ()=>decodeSectionInstruction,
    "encodeSectionInstruction",
    ()=>encodeSectionInstruction,
    "findSection",
    ()=>findSection,
    "parseEditInstruction",
    ()=>parseEditInstruction
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$canonical$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/canonical.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$assets$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/assets.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$generation$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/generation.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$spec$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/site-spec.ts [app-ssr] (ecmascript)");
;
;
;
;
const SITE_EDIT_SCHEMA_VERSION = 'site-edit/0';
const PATCH_INSTRUCTION_MAX = 1800;
const SECTION_INSTRUCTION_MAX = 1500;
const INSTRUCTION_COLUMN_MAX = 2000;
const SECTION_DEFAULT_INSTRUCTION = 'Пересобери эту секцию, сохранив её назначение.';
const ID_RE = /^[a-z0-9][a-z0-9-]{0,47}$/;
// управляющие символы, кроме перевода строки: команда это обычный текст в несколько строк
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u0009\u000b-\u001f\u007f]/;
const isRec = (v)=>v !== null && typeof v === 'object' && !Array.isArray(v);
const list = (v)=>Array.isArray(v) ? v : [];
const same = (a, b)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$canonical$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["canonicalJson"])(a ?? null) === (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$canonical$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["canonicalJson"])(b ?? null);
function parseEditInstruction(raw, max, optional) {
    if (raw === undefined || raw === null) return optional ? {
        ok: true,
        text: null
    } : {
        ok: false,
        message: 'instruction: напишите, что изменить'
    };
    if (typeof raw !== 'string') return {
        ok: false,
        message: 'instruction: строка'
    };
    const text = raw.replace(/\r\n?/g, '\n').trim();
    if (!text) return optional ? {
        ok: true,
        text: null
    } : {
        ok: false,
        message: 'instruction: напишите, что изменить'
    };
    if (CONTROL_RE.test(text)) return {
        ok: false,
        message: 'instruction: управляющие символы недопустимы'
    };
    if ([
        ...text
    ].length > max) return {
        ok: false,
        message: `instruction: не длиннее ${max} знаков`
    };
    return {
        ok: true,
        text
    };
}
function encodeSectionInstruction(target, text) {
    if (!ID_RE.test(target.pageId) || !ID_RE.test(target.sectionId)) throw new Error('Неверный id цели');
    if (text !== null && ([
        ...text
    ].length > SECTION_INSTRUCTION_MAX || CONTROL_RE.test(text) || !text.trim())) throw new Error('Неверный текст команды');
    const out = `${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$canonical$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["canonicalJson"])({
        v: 1,
        pageId: target.pageId,
        sectionId: target.sectionId
    })}\n${text ?? ''}`;
    if ([
        ...out
    ].length > INSTRUCTION_COLUMN_MAX) throw new Error('Конверт команды длиннее колонки');
    return out;
}
function decodeSectionInstruction(raw) {
    if (!raw) return null;
    const cut = raw.indexOf('\n');
    if (cut < 0) return null;
    let value;
    try {
        value = JSON.parse(raw.slice(0, cut));
    } catch  {
        return null;
    }
    if (!isRec(value)) return null;
    if (Object.keys(value).sort().join(',') !== 'pageId,sectionId,v' || value['v'] !== 1) return null;
    const { pageId, sectionId } = value;
    if (typeof pageId !== 'string' || !ID_RE.test(pageId) || typeof sectionId !== 'string' || !ID_RE.test(sectionId)) return null;
    const rest = raw.slice(cut + 1);
    if (rest === '') return {
        target: {
            pageId,
            sectionId
        },
        text: null
    };
    if (!rest.trim() || [
        ...rest
    ].length > SECTION_INSTRUCTION_MAX || CONTROL_RE.test(rest)) return null;
    return {
        target: {
            pageId,
            sectionId
        },
        text: rest
    };
}
function findSection(spec, target) {
    if (!isRec(spec)) return null;
    const pages = list(spec['pages']);
    const pageIndex = pages.findIndex((p)=>isRec(p) && p['id'] === target.pageId);
    if (pageIndex < 0) return null;
    const sections = list(pages[pageIndex]['sections']);
    const sectionIndex = sections.findIndex((s)=>isRec(s) && s['id'] === target.sectionId);
    return sectionIndex < 0 ? null : {
        pageIndex,
        sectionIndex,
        section: sections[sectionIndex]
    };
}
/** Все внешние адреса документа (ссылки и кнопки EXTERNAL, соцсети) */ function externalUrls(value, out = new Set()) {
    if (Array.isArray(value)) value.forEach((v)=>externalUrls(v, out));
    else if (isRec(value)) {
        if ((value['kind'] === 'EXTERNAL' || typeof value['network'] === 'string') && typeof value['url'] === 'string') out.add(value['url']);
        for (const v of Object.values(value))externalUrls(v, out);
    }
    return out;
}
function categoryCodes(value, path, out) {
    if (Array.isArray(value)) value.forEach((v, i)=>categoryCodes(v, `${path}[${i}]`, out));
    else if (isRec(value)) {
        if (value['categoryCode'] !== undefined) out.push({
            path: `${path}.categoryCode`,
            code: value['categoryCode']
        });
        list(value['categoryCodes']).forEach((code, i)=>out.push({
                path: `${path}.categoryCodes[${i}]`,
                code
            }));
        for (const [k, v] of Object.entries(value))if (k !== 'categoryCodes') categoryCodes(v, path ? `${path}.${k}` : k, out);
    }
    return out;
}
function checkEditedSpec(spec, baseSpec, input, edit) {
    const checked = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$spec$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["validateSiteSpec"])(spec);
    const errors = checked.ok ? [] : [
        ...checked.errors
    ];
    if (!isRec(spec) || !isRec(baseSpec)) return checked.ok ? {
        ok: false,
        errors: [
            {
                path: '',
                code: 'type',
                message: 'Ожидается объект'
            }
        ]
    } : checked;
    const fail = (path, code, message)=>errors.push({
            path,
            code,
            message
        });
    const known = new Set(input.accommodations.map((a)=>a.categoryCode));
    if (edit.mode === 'SECTION') {
        const before = findSection(baseSpec, edit.target);
        const after = findSection(spec, edit.target);
        if (!before) fail('', 'unknown_target', 'Цели нет в базовой версии');
        else if (!after || after.pageIndex !== before.pageIndex || after.sectionIndex !== before.sectionIndex) fail(`pages[${before.pageIndex}].sections[${before.sectionIndex}]`, 'target_moved', 'Секция осталась на своём месте');
        else {
            const path = `pages[${after.pageIndex}].sections[${after.sectionIndex}]`;
            if (after.section['id'] !== before.section['id'] || after.section['type'] !== before.section['type']) fail(path, 'target_identity', 'У секции тот же id и тип');
            // всё, кроме цели, канонически как в базе: цель в выходе подменяется базовой и документы сравниваются целиком
            const probe = structuredClone(spec);
            probe['pages'][after.pageIndex]['sections'][after.sectionIndex] = before.section;
            if (!same(probe, baseSpec)) fail('', 'outside_target', 'Меняется только выбранная секция');
            const baseAssets = new Set((0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$assets$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["siteSpecAssetRefs"])({
                pages: [
                    {
                        sections: [
                            before.section
                        ]
                    }
                ]
            }).map((r)=>r.assetId));
            for (const ref of (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$assets$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["siteSpecAssetRefs"])({
                pages: [
                    {
                        sections: [
                            after.section
                        ]
                    }
                ]
            }))if (!baseAssets.has(ref.assetId)) fail(ref.path.replace(/^pages\[0\]\.sections\[0\]/, path), 'foreign_asset', 'Новые картинки выбирает человек');
            const baseUrls = externalUrls(before.section);
            for (const url of externalUrls(after.section))if (!baseUrls.has(url)) fail(path, 'invented_link', 'Новые внешние ссылки не допускаются');
            for (const ref of categoryCodes(after.section, path, []))if (typeof ref.code !== 'string' || !known.has(ref.code)) fail(ref.path, 'unknown_category', 'Категории нет в брифе');
            errors.push(...(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$generation$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["catalogFactErrors"])(after.section, input, path));
        }
        return errors.length ? {
            ok: false,
            errors
        } : checked;
    }
    const site = isRec(spec['site']) ? spec['site'] : {};
    const baseSite = isRec(baseSpec['site']) ? baseSpec['site'] : {};
    for (const key of [
        'vertical',
        'displayName',
        'locales',
        'defaultLocale',
        'contacts',
        'legal',
        'seo'
    ])if (!same(site[key], baseSite[key])) fail(`site.${key}`, 'immutable_field', 'ИИ это поле не меняет');
    if (!same(spec['integrations'], baseSpec['integrations'])) fail('integrations', 'immutable_field', 'ИИ это поле не меняет');
    const pages = list(spec['pages']);
    const basePages = list(baseSpec['pages']);
    if (pages.length !== basePages.length) fail('pages', 'immutable_field', 'ИИ не добавляет и не удаляет страницы');
    basePages.forEach((bp, i)=>{
        const p = pages[i];
        if (!isRec(bp) || !isRec(p)) return;
        for (const key of [
            'id',
            'slug',
            'isHome',
            'seo'
        ])if (!same(p[key], bp[key])) fail(`pages[${i}].${key}`, 'immutable_field', 'ИИ это поле не меняет');
    });
    // разметка FAQ для поисковиков: настройка человека (MKT11 отвечает за ИИ-SEO)
    const baseFaq = new Map();
    for (const bp of basePages)for (const s of list(isRec(bp) ? bp['sections'] : null))if (isRec(s)) baseFaq.set(String(s['id']), s['emitStructuredData']);
    pages.forEach((p, i)=>list(isRec(p) ? p['sections'] : null).forEach((s, j)=>{
            if (isRec(s) && s['type'] === 'faq' && !same(s['emitStructuredData'], baseFaq.get(String(s['id'])))) fail(`pages[${i}].sections[${j}].emitStructuredData`, 'immutable_field', 'ИИ это поле не меняет');
        }));
    const baseAssets = new Set((0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$assets$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["siteSpecAssetRefs"])(baseSpec).map((r)=>r.assetId));
    for (const ref of (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$assets$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["siteSpecAssetRefs"])(spec))if (!baseAssets.has(ref.assetId)) fail(ref.path, 'foreign_asset', 'Новые картинки выбирает человек');
    const baseUrls = externalUrls(baseSpec);
    for (const url of externalUrls(spec))if (!baseUrls.has(url)) fail('', 'invented_link', 'Новые внешние ссылки не допускаются');
    for (const ref of categoryCodes(spec, '', []))if (typeof ref.code !== 'string' || !known.has(ref.code)) fail(ref.path.replace(/^\./, ''), 'unknown_category', 'Категории нет в брифе');
    errors.push(...(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$generation$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["catalogFactErrors"])(spec, input));
    return errors.length ? {
        ok: false,
        errors
    } : checked;
}
}),
"[project]/wt-personnel/packages/domain/src/marketing/editor.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "EDITOR_ICON_OPTIONS",
    ()=>EDITOR_ICON_OPTIONS,
    "EDITOR_LOCALES",
    ()=>EDITOR_LOCALES,
    "LEAD_MODE_LABEL",
    ()=>LEAD_MODE_LABEL,
    "LOCALE_LABEL",
    ()=>LOCALE_LABEL,
    "SITE_EDITOR_SECTIONS",
    ()=>SITE_EDITOR_SECTIONS,
    "SITE_EDITOR_SECTION_TYPES",
    ()=>SITE_EDITOR_SECTION_TYPES,
    "THEME_OPTIONS",
    ()=>THEME_OPTIONS,
    "WEEKDAY_LABEL",
    ()=>WEEKDAY_LABEL,
    "WEEKDAY_OPTIONS",
    ()=>WEEKDAY_OPTIONS,
    "accommodationCardCodes",
    ()=>accommodationCardCodes,
    "applySectionVariant",
    ()=>applySectionVariant,
    "duplicateSection",
    ()=>duplicateSection,
    "errorLocation",
    ()=>errorLocation,
    "localizedText",
    ()=>localizedText,
    "moveItem",
    ()=>moveItem,
    "newPage",
    ()=>newPage,
    "newSection",
    ()=>newSection,
    "newSpecId",
    ()=>newSpecId,
    "normalizePageSlug",
    ()=>normalizePageSlug,
    "pageReferences",
    ()=>pageReferences,
    "removeLocale",
    ()=>removeLocale,
    "sectionReferences",
    ()=>sectionReferences,
    "specIds",
    ()=>specIds
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$lead$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/site-lead.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$spec$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/site-spec.ts [app-ssr] (ecmascript)");
;
;
const isRec = (v)=>v !== null && typeof v === 'object' && !Array.isArray(v);
const list = (v)=>Array.isArray(v) ? v : [];
const ICON_LABEL = {
    CLOCK: 'Часы',
    PARKING: 'Парковка',
    WIFI: 'Wi-Fi',
    BREAKFAST: 'Завтрак',
    LAUNDRY: 'Прачечная',
    LUGGAGE: 'Багаж',
    KITCHEN: 'Кухня',
    AIRCON: 'Кондиционер',
    TRANSFER: 'Трансфер',
    PETS: 'Животные',
    ACCESSIBLE: 'Доступная среда',
    FAMILY: 'Семья',
    QUIET: 'Тишина',
    CENTER: 'Центр',
    STATION: 'Вокзал',
    STAR: 'Звезда'
};
const EDITOR_ICON_OPTIONS = __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$spec$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SITE_SPEC_ICONS"].map((value)=>({
        value,
        label: ICON_LABEL[value] ?? value
    }));
const text = (key, label, max, required = false, multiline = max > 200)=>({
        key,
        label,
        required,
        spec: {
            kind: 'text',
            max,
            multiline
        }
    });
const bool = (key, label)=>({
        key,
        label,
        required: false,
        spec: {
            kind: 'bool'
        }
    });
const icon = {
    key: 'icon',
    label: 'Значок',
    required: true,
    spec: {
        kind: 'enum',
        options: EDITOR_ICON_OPTIONS
    }
};
const heading = text('heading', 'Заголовок секции', 80, true);
const option = (value, label)=>({
        value,
        label
    });
const WEEKDAY_LABEL = [
    'Воскресенье',
    'Понедельник',
    'Вторник',
    'Среда',
    'Четверг',
    'Пятница',
    'Суббота'
];
const WEEKDAY_OPTIONS = [
    1,
    2,
    3,
    4,
    5,
    6,
    0
].map((d)=>option(String(d), WEEKDAY_LABEL[d]));
const LEAD_MODE_LABEL = Object.freeze({
    HOTEL_BOOKING: 'Бронь номера',
    BEAUTY_APPOINTMENT: 'Запись к мастеру',
    TABLE_RESERVATION: 'Бронь стола',
    CALLBACK: 'Перезвоните мне'
});
const LEAD_MODE_OPTIONS = __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$lead$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SITE_LEAD_MODES"].map((m)=>option(m, LEAD_MODE_LABEL[m]));
const SITE_EDITOR_SECTIONS = Object.freeze({
    hero: {
        type: 'hero',
        label: 'Первый экран',
        variants: [
            option('IMAGE_FULL', 'Фото на весь экран'),
            option('IMAGE_SIDE', 'Фото сбоку'),
            option('TEXT_ONLY', 'Только текст')
        ],
        fields: [
            heading,
            text('subheading', 'Подзаголовок', 200),
            {
                key: 'image',
                label: 'Фото',
                required: true,
                spec: {
                    kind: 'image'
                },
                variants: [
                    'IMAGE_FULL',
                    'IMAGE_SIDE'
                ]
            },
            {
                key: 'primaryAction',
                label: 'Главная кнопка',
                required: true,
                spec: {
                    kind: 'cta'
                }
            },
            {
                key: 'secondaryAction',
                label: 'Вторая кнопка',
                required: false,
                spec: {
                    kind: 'cta'
                }
            }
        ]
    },
    about: {
        type: 'about',
        label: 'О гостинице',
        variants: [
            option('TEXT_ONLY', 'Только текст'),
            option('TEXT_IMAGE', 'Текст и фото')
        ],
        fields: [
            heading,
            {
                key: 'paragraphs',
                label: 'Абзацы',
                required: true,
                spec: {
                    kind: 'textList',
                    max: 600,
                    min: 1,
                    maxItems: 6
                }
            },
            {
                key: 'image',
                label: 'Фото',
                required: true,
                spec: {
                    kind: 'image'
                },
                variants: [
                    'TEXT_IMAGE'
                ]
            }
        ]
    },
    features: {
        type: 'features',
        label: 'Преимущества',
        variants: [
            option('GRID', 'Сетка'),
            option('LIST', 'Список')
        ],
        fields: [
            heading,
            {
                key: 'items',
                label: 'Преимущества',
                required: true,
                spec: {
                    kind: 'list',
                    min: 2,
                    max: 8,
                    itemLabel: 'Преимущество',
                    item: [
                        icon,
                        text('title', 'Название', 60, true),
                        text('text', 'Текст', 200, true, false)
                    ]
                }
            }
        ]
    },
    accommodations: {
        type: 'accommodations',
        label: 'Номера',
        variants: [
            option('CARDS', 'Карточки'),
            option('ROWS', 'Строки')
        ],
        fields: [
            heading,
            {
                key: 'items',
                label: 'Категории',
                required: true,
                spec: {
                    kind: 'list',
                    min: 1,
                    max: 20,
                    itemLabel: 'Категория',
                    item: [
                        {
                            key: 'categoryCode',
                            label: 'Категория гостиницы',
                            required: true,
                            spec: {
                                kind: 'category'
                            }
                        },
                        text('title', 'Название на сайте', 60, true),
                        text('description', 'Описание', 400, true),
                        {
                            key: 'images',
                            label: 'Фото категории',
                            required: false,
                            spec: {
                                kind: 'images',
                                min: 0,
                                max: 6
                            }
                        },
                        {
                            key: 'highlights',
                            label: 'Коротко о главном',
                            required: false,
                            spec: {
                                kind: 'textList',
                                max: 40,
                                min: 0,
                                maxItems: 6
                            }
                        }
                    ]
                }
            },
            bool('showLiveCapacity', 'Показывать вместимость'),
            bool('showFromPrice', 'Показывать цену «от»'),
            {
                key: 'itemAction',
                label: 'Кнопка у категории',
                required: false,
                spec: {
                    kind: 'cta'
                }
            }
        ]
    },
    amenities: {
        type: 'amenities',
        label: 'Удобства',
        variants: [
            option('LIST', 'Список'),
            option('ICONS', 'Значки')
        ],
        fields: [
            heading,
            {
                key: 'items',
                label: 'Удобства',
                required: true,
                spec: {
                    kind: 'list',
                    min: 1,
                    max: 24,
                    itemLabel: 'Удобство',
                    item: [
                        icon,
                        text('label', 'Название', 60, true),
                        text('note', 'Пояснение', 120)
                    ]
                }
            }
        ]
    },
    pricing: {
        type: 'pricing',
        label: 'Цены',
        variants: [
            option('FROM_PRICES', 'Цены «от»')
        ],
        fields: [
            heading,
            {
                key: 'categoryCodes',
                label: 'Категории',
                required: true,
                spec: {
                    kind: 'categoryCodes'
                },
                hint: 'Цена «от» загружается автоматически по тарифу бронирования.'
            },
            text('note', 'Примечание', 300)
        ]
    },
    gallery: {
        type: 'gallery',
        label: 'Галерея',
        variants: [
            option('GRID', 'Сетка'),
            option('CAROUSEL', 'Карусель')
        ],
        fields: [
            heading,
            {
                key: 'images',
                label: 'Фото',
                required: true,
                spec: {
                    kind: 'images',
                    min: 3,
                    max: 24
                }
            }
        ]
    },
    booking: {
        type: 'booking',
        label: 'Бронирование',
        variants: [
            option('INLINE', 'Форма на странице')
        ],
        fields: [
            heading,
            text('note', 'Примечание', 300),
            bool('showCheckInOut', 'Показывать время заезда и выезда')
        ]
    },
    contacts: {
        type: 'contacts',
        label: 'Контакты',
        variants: [
            option('PLAIN', 'Без карты'),
            option('WITH_MAP', 'С картой')
        ],
        fields: [
            heading,
            bool('showPhone', 'Показывать телефон'),
            bool('showWhatsapp', 'Показывать WhatsApp'),
            bool('showEmail', 'Показывать почту'),
            bool('showAddress', 'Показывать адрес'),
            {
                key: 'map',
                label: 'Карта',
                required: false,
                spec: {
                    kind: 'map'
                },
                variants: [
                    'WITH_MAP'
                ]
            },
            text('directions', 'Как добраться', 400)
        ]
    },
    faq: {
        type: 'faq',
        label: 'Вопросы и ответы',
        variants: [
            option('ACCORDION', 'Раскрывающиеся'),
            option('LIST', 'Список')
        ],
        fields: [
            heading,
            {
                key: 'items',
                label: 'Вопросы',
                required: true,
                spec: {
                    kind: 'list',
                    min: 1,
                    max: 30,
                    itemLabel: 'Вопрос',
                    item: [
                        text('question', 'Вопрос', 200, true, false),
                        text('answer', 'Ответ', 1000, true)
                    ]
                }
            },
            bool('emitStructuredData', 'Разметка вопросов для поисковиков')
        ]
    },
    cta: {
        type: 'cta',
        label: 'Призыв',
        variants: [
            option('BANNER', 'Полоса'),
            option('SPLIT', 'С фото')
        ],
        fields: [
            heading,
            {
                key: 'action',
                label: 'Кнопка',
                required: true,
                spec: {
                    kind: 'cta'
                }
            },
            text('text', 'Текст', 300),
            {
                key: 'image',
                label: 'Фото',
                required: true,
                spec: {
                    kind: 'image'
                },
                variants: [
                    'SPLIT'
                ]
            }
        ]
    },
    services: {
        type: 'services',
        label: 'Услуги',
        variants: [
            option('LIST', 'Список'),
            option('CARDS', 'Карточки')
        ],
        fields: [
            heading,
            {
                key: 'items',
                label: 'Услуги',
                required: true,
                spec: {
                    kind: 'list',
                    min: 1,
                    max: __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$spec$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SITE_SPEC_LIMITS"].servicesItems,
                    itemLabel: 'Услуга',
                    item: [
                        {
                            key: 'serviceCode',
                            label: 'Услуга салона',
                            required: true,
                            spec: {
                                kind: 'dataRef',
                                ref: 'service'
                            }
                        },
                        text('title', 'Название на сайте', 80, true),
                        text('description', 'Описание', 300),
                        text('category', 'Группа', 60),
                        {
                            key: 'durationMin',
                            label: 'Длительность, мин',
                            required: false,
                            spec: {
                                kind: 'int',
                                min: 1,
                                max: 1440
                            },
                            hint: 'Из данных салона'
                        },
                        {
                            key: 'price',
                            label: 'Цена',
                            required: false,
                            spec: {
                                kind: 'money'
                            },
                            hint: 'Из данных салона; на сайте меняется кнопкой «Обновить данными WETOP»'
                        },
                        bool('priceFrom', 'Цена «от»')
                    ]
                }
            },
            bool('showPrices', 'Показывать цены'),
            bool('showDuration', 'Показывать длительность'),
            bool('groupByCategory', 'Группировать по группам'),
            {
                key: 'itemAction',
                label: 'Кнопка у услуги',
                required: false,
                spec: {
                    kind: 'cta'
                }
            }
        ]
    },
    staff: {
        type: 'staff',
        label: 'Мастера',
        variants: [
            option('CARDS', 'Карточки'),
            option('LIST', 'Список')
        ],
        fields: [
            heading,
            {
                key: 'items',
                label: 'Мастера',
                required: true,
                spec: {
                    kind: 'list',
                    min: 1,
                    max: __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$spec$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SITE_SPEC_LIMITS"].staffItems,
                    itemLabel: 'Мастер',
                    item: [
                        {
                            key: 'employeeId',
                            label: 'Мастер салона',
                            required: true,
                            spec: {
                                kind: 'dataRef',
                                ref: 'employee'
                            }
                        },
                        text('name', 'Имя на сайте', 80, true),
                        text('specialization', 'Специализация', 120),
                        {
                            key: 'image',
                            label: 'Фото',
                            required: false,
                            spec: {
                                kind: 'image'
                            }
                        }
                    ]
                }
            }
        ]
    },
    menu: {
        type: 'menu',
        label: 'Меню',
        variants: [
            option('LIST', 'Список'),
            option('CARDS', 'Карточки')
        ],
        fields: [
            heading,
            {
                key: 'categories',
                label: 'Разделы меню',
                required: true,
                spec: {
                    kind: 'list',
                    min: 1,
                    max: __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$spec$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SITE_SPEC_LIMITS"].menuCategories,
                    itemLabel: 'Раздел',
                    item: [
                        text('title', 'Раздел', 80, true),
                        {
                            key: 'items',
                            label: 'Блюда',
                            required: true,
                            spec: {
                                kind: 'list',
                                min: 1,
                                max: __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$spec$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SITE_SPEC_LIMITS"].menuItemsPerCategory,
                                itemLabel: 'Блюдо',
                                item: [
                                    {
                                        key: 'itemCode',
                                        label: 'Блюдо ресторана',
                                        required: true,
                                        spec: {
                                            kind: 'dataRef',
                                            ref: 'menuItem'
                                        }
                                    },
                                    text('title', 'Название на сайте', 120, true),
                                    text('description', 'Описание', 300),
                                    {
                                        key: 'weightGrams',
                                        label: 'Выход, г',
                                        required: false,
                                        spec: {
                                            kind: 'int',
                                            min: 1,
                                            max: 100_000
                                        },
                                        hint: 'Из данных ресторана'
                                    },
                                    {
                                        key: 'price',
                                        label: 'Цена',
                                        required: false,
                                        spec: {
                                            kind: 'money'
                                        },
                                        hint: 'Из данных ресторана'
                                    },
                                    {
                                        key: 'image',
                                        label: 'Фото',
                                        required: false,
                                        spec: {
                                            kind: 'image'
                                        }
                                    }
                                ]
                            }
                        }
                    ]
                }
            },
            bool('showPhotos', 'Показывать фото блюд')
        ]
    },
    hours: {
        type: 'hours',
        label: 'Часы работы',
        variants: [
            option('TABLE', 'Таблица'),
            option('COMPACT', 'Коротко')
        ],
        fields: [
            heading,
            {
                key: 'days',
                label: 'Дни',
                required: true,
                spec: {
                    kind: 'list',
                    min: 1,
                    max: 7,
                    itemLabel: 'День',
                    item: [
                        {
                            key: 'weekday',
                            label: 'День недели',
                            required: true,
                            spec: {
                                kind: 'weekday'
                            }
                        },
                        {
                            key: 'open',
                            label: 'Открытие',
                            required: true,
                            spec: {
                                kind: 'clock'
                            }
                        },
                        {
                            key: 'close',
                            label: 'Закрытие',
                            required: true,
                            spec: {
                                kind: 'clock'
                            }
                        }
                    ]
                }
            },
            text('note', 'Примечание', 300)
        ]
    },
    leadForm: {
        type: 'leadForm',
        label: 'Форма заявки',
        variants: [
            option('INLINE', 'На странице'),
            option('CARD', 'Карточкой')
        ],
        fields: [
            heading,
            {
                key: 'mode',
                label: 'Что делает форма',
                required: true,
                spec: {
                    kind: 'enum',
                    options: LEAD_MODE_OPTIONS
                }
            },
            text('note', 'Примечание', 300),
            bool('showComment', 'Поле комментария'),
            text('submitLabel', 'Подпись кнопки', 30)
        ]
    }
});
const SITE_EDITOR_SECTION_TYPES = Object.keys(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$spec$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SITE_SPEC_SECTIONS"]);
const LOCALE_LABEL = Object.freeze({
    ru: 'RU',
    kk: 'KK',
    en: 'EN'
});
const EDITOR_LOCALES = __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$spec$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SITE_SPEC_LOCALES"];
const THEME_OPTIONS = Object.freeze({
    preset: __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$spec$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SITE_SPEC_THEME"].preset.map((v)=>option(v, {
            CALM: 'Спокойная',
            WARM: 'Тёплая',
            NIGHT: 'Вечерняя',
            COAST: 'Морская'
        }[v])),
    accent: __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$spec$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SITE_SPEC_THEME"].accent.map((v)=>option(v, {
            TEAL: 'Бирюзовый',
            INDIGO: 'Индиго',
            TERRACOTTA: 'Терракота',
            FOREST: 'Хвойный',
            GRAPHITE: 'Графит',
            GOLD: 'Золотой'
        }[v])),
    typography: __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$spec$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SITE_SPEC_THEME"].typography.map((v)=>option(v, {
            MODERN: 'Современный',
            CLASSIC: 'Классический',
            ROUNDED: 'Мягкий'
        }[v])),
    radius: __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$spec$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SITE_SPEC_THEME"].radius.map((v)=>option(v, {
            SHARP: 'Прямые углы',
            SOFT: 'Слегка скруглённые',
            ROUND: 'Скруглённые'
        }[v])),
    density: __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$spec$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SITE_SPEC_THEME"].density.map((v)=>option(v, {
            COMPACT: 'Плотно',
            COMFORTABLE: 'Свободно'
        }[v])),
    colorScheme: __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$spec$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SITE_SPEC_THEME"].colorScheme.map((v)=>option(v, 'Светлая'))
});
function localizedText(value, locale) {
    if (typeof value === 'string') return value;
    if (!isRec(value)) return '';
    const own = value[locale];
    if (typeof own === 'string' && own.trim()) return own;
    const first = Object.values(value).find((v)=>typeof v === 'string' && v.trim());
    return typeof first === 'string' ? first : '';
}
function specIds(spec) {
    const ids = new Set();
    if (!isRec(spec)) return ids;
    for (const page of list(spec['pages'])){
        if (!isRec(page)) continue;
        if (typeof page['id'] === 'string') ids.add(page['id']);
        for (const s of list(page['sections']))if (isRec(s) && typeof s['id'] === 'string') ids.add(s['id']);
    }
    return ids;
}
function newSpecId(prefix, taken) {
    const base = prefix.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'id';
    for(let n = 1;; n += 1){
        const id = `${base}-${n}`;
        if (!taken.has(id)) return id;
    }
}
const t = (locale, value)=>({
        [locale]: value
    });
function newSection(type, ctx) {
    const shape = SITE_EDITOR_SECTIONS[type];
    if (!shape) throw new Error(`Секции «${type}» нет в реестре`);
    const id = newSpecId(`sec-${type}`, ctx.taken);
    const l = ctx.locale;
    const book = {
        label: t(l, 'Забронировать'),
        action: {
            kind: 'BOOK'
        }
    };
    const base = {
        id,
        type,
        variant: shape.variants[0].value,
        heading: t(l, shape.label)
    };
    switch(type){
        case 'hero':
            return {
                ...base,
                variant: 'TEXT_ONLY',
                primaryAction: book
            };
        case 'about':
            return {
                ...base,
                variant: 'TEXT_ONLY',
                paragraphs: [
                    t(l, 'Расскажите о гостинице.')
                ]
            };
        case 'features':
            return {
                ...base,
                items: [
                    {
                        icon: 'STAR',
                        title: t(l, 'Преимущество'),
                        text: t(l, 'Коротко о нём.')
                    },
                    {
                        icon: 'CLOCK',
                        title: t(l, 'Преимущество'),
                        text: t(l, 'Коротко о нём.')
                    }
                ]
            };
        case 'accommodations':
            return {
                ...base,
                items: [
                    {
                        categoryCode: ctx.categories[0] ?? '',
                        title: t(l, 'Номер'),
                        description: t(l, 'Описание номера.')
                    }
                ]
            };
        case 'amenities':
            return {
                ...base,
                items: [
                    {
                        icon: 'WIFI',
                        label: t(l, 'Wi-Fi')
                    }
                ]
            };
        case 'pricing':
            return {
                ...base,
                categoryCodes: ctx.cardCodes.slice(0, 1)
            };
        case 'gallery':
            return {
                ...base,
                images: []
            };
        case 'faq':
            return {
                ...base,
                items: [
                    {
                        question: t(l, 'Вопрос'),
                        answer: t(l, 'Ответ.')
                    }
                ]
            };
        case 'cta':
            return {
                ...base,
                variant: 'BANNER',
                action: book
            };
        case 'hours':
            return {
                ...base,
                days: [
                    1,
                    2,
                    3,
                    4,
                    5
                ].map((weekday)=>({
                        weekday,
                        open: '10:00',
                        close: '20:00'
                    }))
            };
        case 'leadForm':
            return {
                ...base,
                mode: 'CALLBACK'
            };
        // услуги, мастера и меню ссылаются на записи WETOP: пустой список подсветит проверка, человек выбирает из данных
        case 'services':
        case 'staff':
            return {
                ...base,
                items: []
            };
        case 'menu':
            return {
                ...base,
                categories: []
            };
        default:
            return base;
    }
}
function duplicateSection(section, taken) {
    const copy = structuredClone(section);
    copy['id'] = newSpecId(`sec-${String(section['type'] ?? 'section')}`, taken);
    return copy;
}
function newPage(ctx) {
    const id = newSpecId('page', ctx.taken);
    let n = 1;
    while(ctx.slugs.has(`page-${n}`))n += 1;
    return {
        id,
        slug: `page-${n}`,
        isHome: false,
        title: t(ctx.locale, 'Новая страница'),
        seo: {
            index: true,
            includeInSitemap: true,
            canonical: 'SELF'
        },
        sections: [
            {
                id: newSpecId('sec-about', new Set([
                    ...ctx.taken,
                    id
                ])),
                type: 'about',
                variant: 'TEXT_ONLY',
                heading: t(ctx.locale, 'О гостинице'),
                paragraphs: [
                    t(ctx.locale, 'Текст страницы.')
                ]
            }
        ]
    };
}
function normalizePageSlug(raw) {
    return raw.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-/, '').slice(0, 60);
}
function applySectionVariant(section, variant) {
    const shape = SITE_EDITOR_SECTIONS[String(section['type'])];
    const next = {
        ...section,
        variant
    };
    for (const field of shape?.fields ?? [])if (field.variants && !field.variants.includes(variant)) delete next[field.key];
    return next;
}
function moveItem(items, from, to) {
    const out = [
        ...items
    ];
    if (from < 0 || from >= out.length || to < 0 || to >= out.length || from === to) return out;
    const [item] = out.splice(from, 1);
    out.splice(to, 0, item);
    return out;
}
function whereOf(spec, path, locale) {
    const nav = /^navigation\.(header|footer)\[(\d+)\]/.exec(path);
    if (nav) {
        const item = list(spec['navigation']?.[nav[1]])[Number(nav[2])];
        const label = localizedText(isRec(item) ? item['label'] : null, locale);
        return `${nav[1] === 'header' ? 'Шапка' : 'Подвал'}: ${label || `пункт ${Number(nav[2]) + 1}`}`;
    }
    if (path.startsWith('navigation.headerCta')) return 'Кнопка в шапке';
    if (path === 'site.legal.privacyPageId') return 'Политика конфиденциальности сайта';
    const sec = /^pages\[(\d+)\]\.sections\[(\d+)\]/.exec(path);
    if (sec) {
        const page = list(spec['pages'])[Number(sec[1])];
        const section = list(page?.['sections'])[Number(sec[2])];
        return `Страница «${localizedText(page?.['title'], locale)}», секция «${localizedText(section?.['heading'], locale)}»`;
    }
    return path;
}
/** Все ссылки PAGE и SECTION документа (навигация, кнопки секций) и страница политики */ function allReferences(spec) {
    const out = [];
    const walk = (value, path)=>{
        if (Array.isArray(value)) value.forEach((v, i)=>walk(v, `${path}[${i}]`));
        else if (isRec(value)) {
            if ((value['kind'] === 'PAGE' || value['kind'] === 'SECTION') && typeof value['pageId'] === 'string') out.push({
                path,
                pageId: value['pageId'],
                ...value['kind'] === 'SECTION' && typeof value['sectionId'] === 'string' ? {
                    sectionId: value['sectionId']
                } : {}
            });
            for (const [k, v] of Object.entries(value))walk(v, path ? `${path}.${k}` : k);
        }
    };
    walk(spec['navigation'], 'navigation');
    list(spec['pages']).forEach((p, i)=>walk(p, `pages[${i}]`));
    const privacy = spec['site']?.['legal']?.['privacyPageId'];
    if (typeof privacy === 'string') out.push({
        path: 'site.legal.privacyPageId',
        pageId: privacy
    });
    return out;
}
function pageReferences(spec, pageId, locale) {
    if (!isRec(spec)) return [];
    const index = list(spec['pages']).findIndex((p)=>isRec(p) && p['id'] === pageId);
    const own = `pages[${index}]`;
    return allReferences(spec).filter((r)=>r.pageId === pageId && !(r.path === own || r.path.startsWith(`${own}.`))).map((r)=>({
            path: r.path,
            where: whereOf(spec, r.path, locale)
        }));
}
function sectionReferences(spec, pageId, sectionId, locale) {
    if (!isRec(spec)) return [];
    const pages = list(spec['pages']);
    const p = pages.findIndex((x)=>isRec(x) && x['id'] === pageId);
    const s = list(pages[p]?.['sections']).findIndex((x)=>isRec(x) && x['id'] === sectionId);
    const own = `pages[${p}].sections[${s}]`;
    return allReferences(spec).filter((r)=>r.pageId === pageId && r.sectionId === sectionId && !(r.path === own || r.path.startsWith(`${own}.`))).map((r)=>({
            path: r.path,
            where: whereOf(spec, r.path, locale)
        }));
}
const isLocalizedText = (v)=>isRec(v) && Object.keys(v).length > 0 && Object.entries(v).every(([k, x])=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$spec$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SITE_SPEC_LOCALES"].includes(k) && typeof x === 'string');
function removeLocale(spec, locale) {
    const copy = structuredClone(spec);
    const walk = (value)=>{
        if (Array.isArray(value)) value.forEach(walk);
        else if (isRec(value)) for (const [key, v] of Object.entries(value)){
            if (isLocalizedText(v)) {
                delete v[locale];
                if (Object.keys(v).length === 0) delete value[key];
            } else walk(v);
        }
    };
    walk(copy);
    const site = copy['site'];
    site['locales'] = list(site['locales']).filter((l)=>l !== locale);
    return copy;
}
function errorLocation(path) {
    const m = /^pages\[(\d+)\](?:\.sections\[(\d+)\])?\.?(.*)$/.exec(path);
    if (m) return {
        area: 'page',
        pageIndex: Number(m[1]),
        sectionIndex: m[2] === undefined ? null : Number(m[2]),
        rest: m[3] ?? ''
    };
    return {
        area: 'site',
        rest: path
    };
}
function accommodationCardCodes(spec) {
    const out = [];
    if (!isRec(spec)) return out;
    for (const page of list(spec['pages']))for (const s of list(isRec(page) ? page['sections'] : null))if (isRec(s) && s['type'] === 'accommodations') {
        for (const item of list(s['items']))if (isRec(item) && typeof item['categoryCode'] === 'string' && item['categoryCode'] && !out.includes(item['categoryCode'])) out.push(item['categoryCode']);
    }
    return out;
}
}),
"[project]/wt-personnel/packages/domain/src/marketing/expense-import.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "MARKETING_IMPORT_MAX_ROWS",
    ()=>MARKETING_IMPORT_MAX_ROWS,
    "MARKETING_PLATFORM_LABELS",
    ()=>MARKETING_PLATFORM_LABELS,
    "delimiterOf",
    ()=>delimiterOf,
    "excelDate",
    ()=>excelDate,
    "parseMarketingExpensesCsv",
    ()=>parseMarketingExpensesCsv,
    "splitRecords",
    ()=>splitRecords
]);
/**
 * Импорт расходов маркетинга из CSV (МКТ-В2, ТЗ «Модуль Маркетинг» 1.0 «импорт данных»).
 * Формат тот же, что у выгрузки «Бюджета»: выгрузил, поправил в Excel, загрузил обратно.
 * Колонки ищутся по заголовку, порядок не важен; «Сумма, KZT» из файла не берётся, пересчёт по курсу
 * делает тот же разбор, что у ручного ввода. Файл принимается целиком или не принимается вовсе.
 */ var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$budget$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/budget.ts [app-ssr] (ecmascript)");
;
const MARKETING_PLATFORM_LABELS = {
    META: 'Meta Ads',
    GOOGLE: 'Google Ads',
    TIKTOK: 'TikTok Ads',
    INSTAGRAM: 'Instagram',
    YOUTUBE: 'YouTube',
    WHATSAPP: 'WhatsApp',
    SITE: 'Сайт',
    PHONE: 'Телефон',
    OTHER: 'Прочие'
};
const MARKETING_IMPORT_MAX_ROWS = 1000;
const COLUMNS = {
    date: 'дата',
    platform: 'платформа',
    campaign: 'кампания',
    category: 'статья',
    description: 'описание',
    amount: 'сумма',
    currency: 'валюта',
    fxRate: 'курс',
    countedInBudget: 'в бюджете'
};
const REQUIRED = [
    'date',
    'platform',
    'category',
    'amount'
];
const fail = (msg)=>{
    throw new __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$budget$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["MarketingBudgetError"](msg);
};
function delimiterOf(header) {
    return [
        ';',
        ',',
        '\t'
    ].reduce((best, c)=>header.split(c).length > header.split(best).length ? c : best);
}
function splitRecords(text, delimiter) {
    const out = [];
    let row = [];
    let field = '';
    let quoted = false;
    for(let i = 0; i < text.length; i += 1){
        const c = text[i];
        if (quoted) {
            if (c === '"' && text[i + 1] === '"') {
                field += '"';
                i += 1;
            } else if (c === '"') quoted = false;
            else field += c;
        } else if (c === '"' && field === '') quoted = true;
        else if (c === delimiter) {
            row.push(field);
            field = '';
        } else if (c === '\n' || c === '\r') {
            if (c === '\r' && text[i + 1] === '\n') i += 1;
            out.push([
                ...row,
                field
            ]);
            row = [];
            field = '';
        } else field += c;
    }
    if (field !== '' || row.length) out.push([
        ...row,
        field
    ]);
    return out;
}
const excelDate = (s)=>{
    const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s);
    return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : s;
};
/** Код или подпись платформы без учёта регистра; неизвестное уходит как есть, отказ даст общий разбор */ const platformOf = (s)=>{
    const v = s.toLowerCase();
    return __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$budget$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["MARKETING_PLATFORMS"].find((p)=>p.toLowerCase() === v || MARKETING_PLATFORM_LABELS[p].toLowerCase() === v) ?? s;
};
const countedOf = (s, line)=>{
    const v = s.toLowerCase();
    if (v === '' || v === 'да') return true;
    if (v === 'нет') return false;
    return fail(`Строка ${line}: В бюджете: «да» или «нет»`);
};
function parseMarketingExpensesCsv(text, ctx) {
    const body = text.replace(/^\uFEFF/, '');
    const firstLine = body.split(/\r?\n/, 1)[0] ?? '';
    const records = splitRecords(body, delimiterOf(firstLine));
    const [header = [], ...rest] = records;
    const at = new Map();
    const names = header.map((h)=>h.trim().toLowerCase());
    for (const [key, name] of Object.entries(COLUMNS)){
        const i = names.indexOf(name);
        if (i >= 0) at.set(key, i);
    }
    const lines = rest.map((cells, i)=>({
            cells,
            line: i + 2
        })).filter(({ cells })=>cells.some((c)=>c.trim() !== ''));
    if (lines.length === 0) fail('В файле нет ни одной строки расходов');
    const missing = REQUIRED.find((k)=>!at.has(k));
    if (missing) fail(`В файле нет колонки «${COLUMNS[missing][0].toUpperCase()}${COLUMNS[missing].slice(1)}»`);
    if (lines.length > MARKETING_IMPORT_MAX_ROWS) fail(`За раз не больше ${MARKETING_IMPORT_MAX_ROWS} строк, в файле ${lines.length}`);
    const rows = [];
    const errors = [];
    for (const { cells, line } of lines){
        const cell = (k)=>at.has(k) ? (cells[at.get(k)] ?? '').trim() : '';
        try {
            rows.push({
                line,
                ...(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$budget$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["parseMarketingExpenseInput"])({
                    date: excelDate(cell('date')),
                    platform: platformOf(cell('platform')),
                    campaign: cell('campaign'),
                    category: cell('category'),
                    description: cell('description'),
                    amount: cell('amount').replace(/\s/g, ''),
                    currency: cell('currency'),
                    fxRate: cell('fxRate').replace(/\s/g, ''),
                    countedInBudget: countedOf(cell('countedInBudget'), line)
                }, ctx)
            });
        } catch (e) {
            if (!(e instanceof __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$budget$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["MarketingBudgetError"])) throw e;
            errors.push(e.message.startsWith('Строка ') ? e.message : `Строка ${line}: ${e.message}`);
        }
    }
    if (errors.length > 0) {
        const shown = errors.slice(0, 10);
        if (errors.length > 10) shown.push(`и ещё ${errors.length - 10} строк с ошибками`);
        fail(`Файл не загружен, ничего не записано:\n${shown.join('\n')}`);
    }
    return rows;
}
}),
"[project]/wt-personnel/packages/domain/src/marketing/generation.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GENERATION_ERROR_CODES",
    ()=>GENERATION_ERROR_CODES,
    "GENERATION_ERROR_TEXT",
    ()=>GENERATION_ERROR_TEXT,
    "SITE_GENERATION_BACKOFF_MS",
    ()=>SITE_GENERATION_BACKOFF_MS,
    "SITE_GENERATION_DEFAULT_BUDGET",
    ()=>SITE_GENERATION_DEFAULT_BUDGET,
    "SITE_GENERATION_LEASE_MS",
    ()=>SITE_GENERATION_LEASE_MS,
    "SITE_GENERATION_MAX_ATTEMPTS",
    ()=>SITE_GENERATION_MAX_ATTEMPTS,
    "SITE_GENERATION_SCHEMA_VERSION",
    ()=>SITE_GENERATION_SCHEMA_VERSION,
    "addUsage",
    ()=>addUsage,
    "bindCatalogFacts",
    ()=>bindCatalogFacts,
    "catalogFactErrors",
    ()=>catalogFactErrors,
    "checkGeneratedSpec",
    ()=>checkGeneratedSpec,
    "decodeValidationErrors",
    ()=>decodeValidationErrors,
    "encodeValidationErrors",
    ()=>encodeValidationErrors,
    "generationRetry",
    ()=>generationRetry,
    "generationTargetLocales",
    ()=>generationTargetLocales,
    "isGenerationErrorCode",
    ()=>isGenerationErrorCode,
    "sameUtcDay",
    ()=>sameUtcDay,
    "siteGenerationBudget",
    ()=>siteGenerationBudget,
    "tokensSpent",
    ()=>tokensSpent,
    "utcDayStart",
    ()=>utcDayStart
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$brief$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/brief.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$spec$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/site-spec.ts [app-ssr] (ecmascript)");
;
;
const SITE_GENERATION_SCHEMA_VERSION = 'site-generation/0';
const SITE_GENERATION_DEFAULT_BUDGET = 150_000;
const SITE_GENERATION_MAX_ATTEMPTS = 3;
const SITE_GENERATION_LEASE_MS = 5 * 60_000;
const SITE_GENERATION_BACKOFF_MS = [
    30_000,
    60_000,
    120_000
];
const GENERATION_ERROR_CODES = [
    'SCHEMA_INVALID',
    'MODEL_UNAVAILABLE',
    'BUDGET_EXCEEDED',
    'TIMEOUT',
    'REJECTED_CONTENT',
    'USAGE_UNAVAILABLE',
    'BRIEF_CHANGED',
    'BASE_VERSION_CHANGED',
    /** Повтор дожил до следующих суток UTC: вчерашний run не тратит сегодняшний бюджет */ 'BUDGET_DAY_CHANGED',
    /** MKT9.2: лицензия конструктора филиала кончилась или выключена до платного вызова; не повторяется */ 'LICENSE_UNAVAILABLE'
];
const RETRYABLE = new Set([
    'MODEL_UNAVAILABLE',
    'TIMEOUT',
    'SCHEMA_INVALID'
]);
const GENERATION_ERROR_TEXT = {
    SCHEMA_INVALID: 'ИИ вернул документ, который не прошёл проверку',
    MODEL_UNAVAILABLE: 'Модель ИИ недоступна',
    BUDGET_EXCEEDED: 'Дневной лимит генерации сайтов исчерпан: попробуйте завтра',
    TIMEOUT: 'ИИ не ответил вовремя',
    REJECTED_CONTENT: 'Модель ИИ отказалась отвечать на эти данные',
    USAGE_UNAVAILABLE: 'Расход токенов неизвестен: новые генерации сегодня остановлены',
    BRIEF_CHANGED: 'Данные филиала изменились: запустите генерацию заново',
    BASE_VERSION_CHANGED: 'Сайт уже изменили: генерация не применена',
    BUDGET_DAY_CHANGED: 'Повтор перешёл на следующие сутки: запустите генерацию заново',
    LICENSE_UNAVAILABLE: 'Конструктор сайта не активен для этого филиала: ИИ не запускался'
};
function isGenerationErrorCode(value) {
    return typeof value === 'string' && GENERATION_ERROR_CODES.includes(value);
}
function siteGenerationBudget(raw) {
    const value = raw?.trim() ?? '';
    if (value === '') return {
        enabled: true,
        budget: SITE_GENERATION_DEFAULT_BUDGET
    };
    if (!/^[0-9]+$/.test(value)) return {
        enabled: false,
        reason: 'SITE_GENERATION_DAILY_TOKEN_BUDGET не целое число'
    };
    const budget = Number(value);
    if (!Number.isSafeInteger(budget) || budget <= 0) return {
        enabled: false,
        reason: 'SITE_GENERATION_DAILY_TOKEN_BUDGET не больше нуля: генерация выключена'
    };
    return {
        enabled: true,
        budget
    };
}
function tokensSpent(usage) {
    return (usage.input ?? 0) + (usage.output ?? 0);
}
const plus = (a, b)=>a === null ? b : b === null ? a : a + b;
function addUsage(total, add) {
    return {
        input: plus(total.input, add.input),
        cached: plus(total.cached, add.cached),
        output: plus(total.output, add.output)
    };
}
function utcDayStart(at) {
    return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
}
function sameUtcDay(a, b) {
    return utcDayStart(a).getTime() === utcDayStart(b).getTime();
}
function generationRetry(code, attempts, now) {
    if (!RETRYABLE.has(code) || attempts >= SITE_GENERATION_MAX_ATTEMPTS) return {
        retry: false
    };
    const pause = SITE_GENERATION_BACKOFF_MS[Math.max(0, attempts - 1)] ?? SITE_GENERATION_BACKOFF_MS.at(-1);
    return {
        retry: true,
        at: new Date(now.getTime() + pause)
    };
}
function generationTargetLocales(input) {
    const allowed = __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$brief$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SITE_BRIEF_LOCALES"];
    const out = [];
    for (const locale of input.sellerContent?.siteLocaleHints ?? [])if (allowed.includes(locale) && !out.includes(locale)) out.push(locale);
    return out.length > 0 ? out : [
        'ru'
    ];
}
const isRec = (v)=>v !== null && typeof v === 'object' && !Array.isArray(v);
const digits = (v)=>v.replace(/[^0-9]/g, '');
/** Поля картинок SiteSpec v0: до SiteAsset (MKT8) у ИИ их быть не может */ const ASSET_KEYS = new Set([
    'assetId',
    'imageAssetId',
    'faviconAssetId',
    'image',
    'images',
    'logo'
]);
/** Обход документа: каждый объект с путём, как пишет пути валидатор */ /** Факт брифа без перефразирования: пробелы по краям, повторы пробелов и регистр не в счёт */ function normFact(text) {
    return text.trim().replace(/\s+/g, ' ').toLowerCase();
}
/** Текст документа (строка или тексты по языкам) на каждом языке равен факту брифа; факта нет: не равен */ function sameFact(value, fact) {
    if (fact === null) return false;
    const want = normFact(fact);
    if (typeof value === 'string') return normFact(value) === want;
    if (!isRec(value)) return false;
    const texts = Object.values(value);
    return texts.length > 0 && texts.every((t)=>typeof t === 'string' && normFact(t) === want);
}
function walk(value, path, visit) {
    if (Array.isArray(value)) value.forEach((v, i)=>walk(v, `${path}[${i}]`, visit));
    else if (isRec(value)) {
        visit(value, path);
        for (const [key, v] of Object.entries(value))walk(v, path ? `${path}.${key}` : key, visit);
    }
}
function checkGeneratedSpec(spec, input, targetLocales) {
    const base = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$spec$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["validateSiteSpec"])(spec);
    const errors = base.ok ? [] : [
        ...base.errors
    ];
    if (!isRec(spec)) return base.ok ? {
        ok: false,
        errors: [
            {
                path: '',
                code: 'type',
                message: 'Ожидается объект'
            }
        ]
    } : base;
    const fail = (path, code, message)=>errors.push({
            path,
            code,
            message
        });
    const site = isRec(spec['site']) ? spec['site'] : {};
    const vertical = input.vertical ?? 'HOSPITALITY';
    if (site['vertical'] !== vertical) fail('site.vertical', 'vertical_mismatch', `Направление сайта: ${vertical}`);
    const locales = site['locales'];
    if (!Array.isArray(locales) || locales.length !== targetLocales.length || locales.some((l, i)=>l !== targetLocales[i]) || site['defaultLocale'] !== targetLocales[0]) fail('site.locales', 'locales_mismatch', `Языки сайта: ${targetLocales.join(', ')}, по умолчанию ${targetLocales[0]}`);
    const known = new Set(input.accommodations.map((a)=>a.categoryCode));
    const website = input.channelContent?.website ?? null;
    walk(spec, '', (rec, path)=>{
        for (const key of Object.keys(rec))if (ASSET_KEYS.has(key)) fail(path ? `${path}.${key}` : key, 'asset_not_allowed', 'Картинок до загрузки фото (MKT8) нет');
        if (rec['type'] === 'gallery') fail(path, 'section_not_allowed', 'Галерея появится с загрузкой фото (MKT8)');
        if (typeof rec['categoryCode'] === 'string' && !known.has(rec['categoryCode'])) fail(`${path}.categoryCode`, 'unknown_category', 'Категории нет в брифе');
        if (Array.isArray(rec['categoryCodes'])) rec['categoryCodes'].forEach((code, i)=>{
            if (typeof code !== 'string' || !known.has(code)) fail(`${path}.categoryCodes[${i}]`, 'unknown_category', 'Категории нет в брифе');
        });
        if (rec['kind'] === 'EXTERNAL' && (website === null || rec['url'] !== website)) fail(`${path}.url`, 'invented_link', 'Внешняя ссылка только на сайт гостиницы из брифа');
    });
    for (const e of catalogFactErrors(spec, input))errors.push(e);
    const contacts = isRec(site['contacts']) ? site['contacts'] : null;
    if (contacts) {
        const identity = input.identity;
        if (contacts['phone'] !== undefined && (identity.phone === null || digits(String(contacts['phone'])) !== digits(identity.phone))) fail('site.contacts.phone', 'invented_contact', 'Телефон только из брифа');
        if (contacts['email'] !== undefined && (identity.email === null || String(contacts['email']).trim().toLowerCase() !== identity.email.trim().toLowerCase())) fail('site.contacts.email', 'invented_contact', 'Почта только из брифа');
        if (contacts['address'] !== undefined && !sameFact(contacts['address'], identity.address)) fail('site.contacts.address', 'invented_contact', 'Адрес только как в брифе');
        for (const key of [
            'whatsapp',
            'geo',
            'social'
        ])if (contacts[key] !== undefined) fail(`site.contacts.${key}`, 'invented_contact', 'Этих данных в брифе нет');
    }
    if (site['legal'] !== undefined) fail('site.legal', 'legal_not_allowed', 'Юридические данные в брифе не передаются');
    if (!sameFact(site['displayName'], input.identity.displayNameCandidate)) fail('site.displayName', 'invented_identity', 'Название только как в брифе');
    const seo = isRec(site['seo']) ? site['seo'] : null;
    const structured = seo && isRec(seo['structuredData']) ? seo['structuredData'] : null;
    if (structured) {
        if (structured['includeGeo'] === true) fail('site.seo.structuredData.includeGeo', 'unsupported_binding', 'Координат в брифе нет');
        if (structured['includeAddress'] === true && input.identity.address === null) fail('site.seo.structuredData.includeAddress', 'unsupported_binding', 'Адреса в брифе нет');
    }
    return errors.length > 0 ? {
        ok: false,
        errors
    } : base;
}
function catalogFactErrors(spec, input, root = '') {
    const errors = [];
    const fail = (path, code, message)=>errors.push({
            path,
            code,
            message
        });
    const services = new Map((input.services ?? []).map((s)=>[
            s.code,
            s
        ]));
    const dishes = new Map((input.menu ?? []).flatMap((c)=>c.items).map((i)=>[
            i.code,
            i
        ]));
    const staff = new Set((input.staff ?? []).map((s)=>s.id.toLowerCase()));
    const hours = new Set((input.hours ?? []).map((h)=>`${h.weekday} ${h.open} ${h.close}`));
    const samePrice = (value, fact)=>isRec(value) && value['minor'] === fact.priceMinor && value['currency'] === fact.currency;
    walk(spec, root, (rec, path)=>{
        const at = (key)=>path ? `${path}.${key}` : key;
        if (rec['type'] === 'services') list(rec['items']).forEach((item, i)=>{
            if (!isRec(item)) return;
            const ip = `${at('items')}[${i}]`;
            const fact = typeof item['serviceCode'] === 'string' ? services.get(item['serviceCode']) : undefined;
            if (!fact) return fail(`${ip}.serviceCode`, 'unknown_service', 'Услуги нет в данных салона');
            if (item['price'] !== undefined && !samePrice(item['price'], fact)) fail(`${ip}.price`, 'invented_price', 'Цена только из данных салона');
            if (item['durationMin'] !== undefined && item['durationMin'] !== fact.durationMin) fail(`${ip}.durationMin`, 'invented_fact', 'Длительность только из данных салона');
        });
        if (rec['type'] === 'staff') list(rec['items']).forEach((item, i)=>{
            if (isRec(item) && (typeof item['employeeId'] !== 'string' || !staff.has(item['employeeId'].toLowerCase()))) fail(`${at('items')}[${i}].employeeId`, 'unknown_employee', 'Мастера нет в данных салона');
        });
        if (rec['type'] === 'menu') list(rec['categories']).forEach((cat, c)=>list(isRec(cat) ? cat['items'] : null).forEach((item, i)=>{
                if (!isRec(item)) return;
                const ip = `${at('categories')}[${c}].items[${i}]`;
                const fact = typeof item['itemCode'] === 'string' ? dishes.get(item['itemCode']) : undefined;
                if (!fact) return fail(`${ip}.itemCode`, 'unknown_menu_item', 'Блюда нет в меню ресторана');
                if (item['price'] !== undefined && !samePrice(item['price'], fact)) fail(`${ip}.price`, 'invented_price', 'Цена только из меню ресторана');
                if (item['weightGrams'] !== undefined && item['weightGrams'] !== fact.weightGrams) fail(`${ip}.weightGrams`, 'invented_fact', 'Выход блюда только из меню ресторана');
            }));
        if (rec['type'] === 'hours') list(rec['days']).forEach((d, i)=>{
            if (isRec(d) && !hours.has(`${String(d['weekday'])} ${String(d['open'])} ${String(d['close'])}`)) fail(`${at('days')}[${i}]`, 'invented_hours', 'Часы работы только из данных филиала');
        });
    });
    return errors;
}
const list = (v)=>Array.isArray(v) ? v : [];
function bindCatalogFacts(spec, input) {
    if (!isRec(spec)) return spec;
    const out = structuredClone(spec);
    const services = new Map((input.services ?? []).map((s)=>[
            s.code,
            s
        ]));
    const dishes = new Map((input.menu ?? []).flatMap((c)=>c.items).map((i)=>[
            i.code,
            i
        ]));
    const set = (rec, key, value)=>{
        if (value === undefined || value === null) delete rec[key];
        else rec[key] = value;
    };
    walk(out, '', (rec)=>{
        if (rec['type'] === 'services') for (const item of list(rec['items'])){
            const fact = isRec(item) && typeof item['serviceCode'] === 'string' ? services.get(item['serviceCode']) : undefined;
            if (!isRec(item) || !fact) continue;
            set(item, 'price', {
                minor: fact.priceMinor,
                currency: fact.currency
            });
            set(item, 'durationMin', fact.durationMin);
        }
        if (rec['type'] === 'menu') for (const cat of list(rec['categories']))for (const item of list(isRec(cat) ? cat['items'] : null)){
            const fact = isRec(item) && typeof item['itemCode'] === 'string' ? dishes.get(item['itemCode']) : undefined;
            if (!isRec(item) || !fact) continue;
            set(item, 'price', {
                minor: fact.priceMinor,
                currency: fact.currency
            });
            set(item, 'weightGrams', fact.weightGrams);
        }
        if (rec['type'] === 'hours' && (input.hours ?? []).length) rec['days'] = (input.hours ?? []).map((h)=>({
                weekday: h.weekday,
                open: h.open,
                close: h.close
            }));
    });
    return out;
}
const PATH_RE = /^[A-Za-z0-9_.[\]-]{0,160}$/;
const CODE_RE = /^[a-z_]{1,40}$/;
/** Путь без чужого текста: ключ из ответа модели может нести что угодно, оставляем только последнюю годную часть */ function safePath(path) {
    if (PATH_RE.test(path)) return path;
    const parts = path.split('.');
    while(parts.length > 0 && !PATH_RE.test(parts.join('.')))parts.pop();
    return parts.join('.');
}
function encodeValidationErrors(errors) {
    const lines = [];
    let length = 0;
    for (const e of errors){
        if (!CODE_RE.test(e.code)) continue;
        const line = `${safePath(e.path)} ${e.code}`;
        if (length + line.length + 1 > 500) break;
        lines.push(line);
        length += line.length + 1;
    }
    return lines.join('\n');
}
function decodeValidationErrors(message) {
    if (!message) return [];
    const out = [];
    for (const line of message.split('\n')){
        const match = /^(\S*) ([a-z_]{1,40})$/.exec(line);
        if (match && PATH_RE.test(match[1])) out.push({
            path: match[1],
            code: match[2]
        });
    }
    return out;
}
}),
"[project]/wt-personnel/packages/domain/src/marketing/host.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "normalizeSiteHost",
    ()=>normalizeSiteHost,
    "parseSitesBaseDomain",
    ()=>parseSitesBaseDomain,
    "platformHost",
    ()=>platformHost,
    "previewHost",
    ()=>previewHost
]);
/**
 * Хосты управляемых сайтов (MKT4, MKT7; Q-271 RESOLVED OWNER 07.10.2026). Один нормализатор на управление, служебный
 * рантайм API и Worker `apps/sites` (Worker импортирует этот файл напрямую, поэтому здесь нет импортов и нет Node API:
 * только WHATWG `URL`, он есть и в Node, и в Workers).
 */ const HOST_LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const NOT_A_HOST_RE = /[\s/\\?#@[\]%]/;
function normalizeSiteHost(raw) {
    if (typeof raw !== 'string') return null;
    let host = raw.trim();
    if (!host || NOT_A_HOST_RE.test(host)) return null;
    const colon = host.lastIndexOf(':');
    if (colon !== -1) {
        const port = host.slice(colon + 1);
        if (!/^\d{1,5}$/.test(port) || Number(port) > 65535) return null;
        host = host.slice(0, colon);
    }
    if (host.includes(':')) return null;
    if (host.endsWith('.')) host = host.slice(0, -1);
    if (!host) return null;
    let ascii;
    try {
        ascii = new URL(`http://${host}`).hostname;
    } catch  {
        return null;
    }
    if (ascii.endsWith('.')) ascii = ascii.slice(0, -1);
    if (ascii.length === 0 || ascii.length > 253) return null;
    const labels = ascii.split('.');
    if (labels.length < 2 || /^\d+$/.test(labels[labels.length - 1])) return null;
    return labels.every((label)=>HOST_LABEL_RE.test(label)) ? ascii : null;
}
function parseSitesBaseDomain(raw) {
    if (typeof raw !== 'string' || raw.trim() === '') return {
        ok: false,
        message: 'SITES_BASE_DOMAIN не задан'
    };
    const value = raw.trim();
    const domain = /[:/]/.test(value) ? null : normalizeSiteHost(value);
    if (!domain) return {
        ok: false,
        message: 'SITES_BASE_DOMAIN: только имя хоста, без схемы, пути и порта'
    };
    if (domain === 'wetop.ai' || domain.endsWith('.wetop.ai')) return {
        ok: false,
        message: 'SITES_BASE_DOMAIN: не wetop.ai и не его поддомен (Q-271)'
    };
    return {
        ok: true,
        domain
    };
}
function platformHost(slug, baseDomain) {
    return `${slug}.${baseDomain}`;
}
function previewHost(baseDomain) {
    return `preview.${baseDomain}`;
}
}),
"[project]/wt-personnel/packages/domain/src/marketing/index.ts [app-ssr] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$canonical$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/canonical.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$spec$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/site-spec.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$runtime$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/runtime.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$brief$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/brief.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$generation$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/generation.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$assets$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/assets.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/editor.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$diff$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/diff.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$edit$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/edit.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$builder$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/builder.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$design$2d$presets$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/design-presets.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$templates$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/site-templates.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$live$2d$sync$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/live-sync.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$simple$2d$edit$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/simple-edit.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$copy$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/site-copy.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$conversation$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/conversation.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$lead$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/site-lead.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$facts$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/site-facts.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$starter$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/starter.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$expense$2d$import$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/expense-import.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$campaigns$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/campaigns.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$ad$2d$proposal$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/ad-proposal.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$ad$2d$launch$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/ad-launch.ts [app-ssr] (ecmascript)");
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
}),
"[project]/wt-personnel/packages/domain/src/marketing/live-sync.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "liveSiteSpec",
    ()=>liveSiteSpec
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$starter$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/starter.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$spec$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/site-spec.ts [app-ssr] (ecmascript)");
;
;
const CODE_RE = /^[A-Za-z0-9_-]{1,64}$/;
const MINOR_RE = /^(?:0|[1-9][0-9]{0,14})$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Те же пределы, что у заготовки сайта (`starter.ts`) */ const LIMIT = {
    services: 60,
    staff: 30,
    menuCategories: 30,
    menuPerCategory: 80,
    menuTotal: 300
};
const isRec = (v)=>typeof v === 'object' && v !== null && !Array.isArray(v);
const money = (i)=>i.price && MINOR_RE.test(i.price.minor) && /^[A-Z]{3}$/.test(i.price.currency) ? {
        minor: i.price.minor,
        currency: i.price.currency
    } : undefined;
/** Текст на языке сайта из WETOP, переводы на другие языки остаются */ const text = (old, locale, value)=>({
        ...isRec(old) ? old : {},
        [locale]: value
    });
function services(section, facts, locale) {
    if (facts.catalog.kind !== 'services') return null;
    const items = facts.catalog.items.filter((i)=>CODE_RE.test(i.code) && (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$starter$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["starterText"])(i.name, 80)).slice(0, LIMIT.services);
    if (!items.length) return null;
    const old = new Map((section['items'] ?? []).filter(isRec).map((i)=>[
            String(i['serviceCode']),
            i
        ]));
    const next = items.map((i)=>{
        const prev = old.get(i.code) ?? {};
        const price = money(i);
        const category = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$starter$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["starterText"])(i.category, 60);
        const out = {
            serviceCode: i.code,
            title: text(prev['title'], locale, (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$starter$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["starterText"])(i.name, 80))
        };
        if (typeof prev['description'] !== 'undefined') out['description'] = prev['description'];
        if (category) out['category'] = text(prev['category'], locale, category);
        if (typeof i.durationMin === 'number' && Number.isInteger(i.durationMin) && i.durationMin > 0 && i.durationMin <= 1440) out['durationMin'] = i.durationMin;
        if (price) out['price'] = price;
        if (price && prev['priceFrom'] === true) out['priceFrom'] = true;
        return out;
    });
    return {
        ...section,
        items: next
    };
}
function staff(section, facts, locale) {
    const people = facts.staff.filter((s)=>UUID_RE.test(s.id) && (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$starter$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["starterText"])(s.name, 80)).slice(0, LIMIT.staff);
    if (!people.length) return null;
    const old = new Map((section['items'] ?? []).filter(isRec).map((i)=>[
            String(i['employeeId']).toLowerCase(),
            i
        ]));
    const next = people.map((s)=>{
        const id = s.id.toLowerCase();
        const prev = old.get(id) ?? {};
        const spec = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$starter$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["starterText"])(s.specialization, 120);
        const out = {
            employeeId: id,
            name: text(prev['name'], locale, (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$starter$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["starterText"])(s.name, 80))
        };
        // специализацию, которую владелец написал на сайте сам, не затираем списком услуг
        if (prev['specialization'] !== undefined) out['specialization'] = prev['specialization'];
        else if (spec) out['specialization'] = text(undefined, locale, spec);
        if (prev['image'] !== undefined) out['image'] = prev['image'];
        return out;
    });
    return {
        ...section,
        items: next
    };
}
function menu(section, facts, locale) {
    if (facts.catalog.kind !== 'menu') return null;
    const old = new Map();
    const oldCats = new Map();
    for (const cat of (section['categories'] ?? []).filter(isRec)){
        const title = isRec(cat['title']) ? String(cat['title'][locale] ?? '') : '';
        if (title) oldCats.set(title, cat);
        for (const i of (cat['items'] ?? []).filter(isRec))old.set(String(i['itemCode']), i);
    }
    const cats = [];
    const byTitle = new Map();
    let total = 0;
    for (const i of facts.catalog.items){
        if (total >= LIMIT.menuTotal) break;
        if (!CODE_RE.test(i.code) || !(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$starter$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["starterText"])(i.name, 120)) continue;
        const title = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$starter$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["starterText"])(i.category, 80) ?? 'Меню';
        let cat = byTitle.get(title);
        if (!cat) {
            if (cats.length >= LIMIT.menuCategories) continue;
            cat = {
                title: text(oldCats.get(title)?.['title'], locale, title),
                items: []
            };
            byTitle.set(title, cat);
            cats.push(cat);
        }
        if (cat.items.length >= LIMIT.menuPerCategory) continue;
        const prev = old.get(i.code) ?? {};
        const price = money(i);
        const out = {
            itemCode: i.code,
            title: text(prev['title'], locale, (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$starter$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["starterText"])(i.name, 120))
        };
        if (prev['description'] !== undefined) out['description'] = prev['description'];
        if (typeof i.weightGrams === 'number' && Number.isInteger(i.weightGrams) && i.weightGrams > 0 && i.weightGrams <= 100_000) out['weightGrams'] = i.weightGrams;
        if (price) out['price'] = price;
        if (prev['image'] !== undefined) out['image'] = prev['image'];
        cat.items.push(out);
        total += 1;
    }
    if (!cats.length) return null;
    return {
        ...section,
        categories: cats
    };
}
function hours(section, facts) {
    const seen = new Set();
    const days = facts.hours.days.filter((d)=>Number.isInteger(d.weekday) && d.weekday >= 0 && d.weekday <= 6 && d.open !== d.close).filter((d)=>seen.has(d.weekday) ? false : (seen.add(d.weekday), true)).map((d)=>({
            weekday: d.weekday,
            open: d.open,
            close: d.close
        }));
    return days.length ? {
        ...section,
        days
    } : null;
}
function liveSiteSpec(spec, facts) {
    const site = isRec(spec['site']) ? spec['site'] : {};
    const locale = typeof site['defaultLocale'] === 'string' ? site['defaultLocale'] : 'ru';
    const pages = Array.isArray(spec['pages']) ? spec['pages'] : [];
    const nextPages = pages.map((page)=>{
        if (!isRec(page) || !Array.isArray(page['sections'])) return page;
        return {
            ...page,
            sections: page['sections'].map((s)=>{
                if (!isRec(s)) return s;
                const type = s['type'];
                const fresh = type === 'services' ? services(s, facts, locale) : type === 'staff' ? staff(s, facts, locale) : type === 'menu' ? menu(s, facts, locale) : type === 'hours' ? hours(s, facts) : null;
                return fresh ?? s;
            })
        };
    });
    const contacts = isRec(site['contacts']) ? {
        ...site['contacts']
    } : null;
    if (contacts) {
        const phone = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$starter$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["starterPhone"])(facts.location.phone);
        const address = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$starter$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["starterText"])(facts.location.address, 200);
        if (phone && 'phone' in contacts) contacts['phone'] = phone;
        if (address && 'address' in contacts) contacts['address'] = text(contacts['address'], locale, address);
    }
    const next = {
        ...spec,
        pages: nextPages,
        ...contacts ? {
            site: {
                ...site,
                contacts
            }
        } : {}
    };
    if (JSON.stringify(next) === JSON.stringify(spec)) return spec;
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$spec$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["validateSiteSpec"])(next).ok ? next : spec;
}
}),
"[project]/wt-personnel/packages/domain/src/marketing/runtime.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "parseDevSiteHosts",
    ()=>parseDevSiteHosts,
    "siteSpecCategoryCodes",
    ()=>siteSpecCategoryCodes
]);
/**
 * Чистые правила публичного рантайма сайта (MKT4, `docs/marketing/README.md` §4). Здесь нет базы и HTTP: разбор карты
 * хостов для dev и test и коды категорий опубликованной версии для `publicFacts`. Нормализатор хоста в `host.ts` (MKT7).
 */ var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$host$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/host.ts [app-ssr] (ecmascript)");
;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function parseDevSiteHosts(raw) {
    const map = new Map();
    for (const pair of (raw ?? '').split(',')){
        const eq = pair.indexOf('=');
        if (eq === -1) continue;
        const host = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$host$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["normalizeSiteHost"])(pair.slice(0, eq));
        const siteId = pair.slice(eq + 1).trim().toLowerCase();
        if (host && UUID_RE.test(siteId)) map.set(host, siteId);
    }
    return map;
}
function siteSpecCategoryCodes(spec) {
    const codes = [];
    const add = (code)=>{
        if (typeof code === 'string' && !codes.includes(code)) codes.push(code);
    };
    const pages = Array.isArray(spec['pages']) ? spec['pages'] : [];
    for (const page of pages){
        const sections = Array.isArray(page?.['sections']) ? page['sections'] : [];
        for (const raw of sections){
            const section = raw ?? {};
            if (section['type'] === 'accommodations' && Array.isArray(section['items'])) for (const item of section['items'])add(item?.['categoryCode']);
            if (section['type'] === 'pricing' && Array.isArray(section['categoryCodes'])) for (const code of section['categoryCodes'])add(code);
        }
    }
    return codes;
}
}),
"[project]/wt-personnel/packages/domain/src/marketing/simple-edit.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SIMPLE_BLOCKS",
    ()=>SIMPLE_BLOCKS,
    "setAboutText",
    ()=>setAboutText,
    "setGalleryPhotos",
    ()=>setGalleryPhotos,
    "setHeroPhoto",
    ()=>setHeroPhoto,
    "setHeroText",
    ()=>setHeroText,
    "simpleSiteState",
    ()=>simpleSiteState,
    "toggleSiteBlock",
    ()=>toggleSiteBlock
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$spec$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/site-spec.ts [app-ssr] (ecmascript)");
;
const SIMPLE_BLOCKS = Object.freeze([
    {
        type: 'features',
        label: 'Преимущества',
        hint: 'Почему выбирают вас'
    },
    {
        type: 'staff',
        label: 'Мастера',
        hint: 'Из сотрудников WETOP'
    },
    {
        type: 'hours',
        label: 'Часы работы',
        hint: 'Из графика WETOP'
    },
    {
        type: 'cta',
        label: 'Призыв записаться',
        hint: 'Блок в конце страницы'
    }
]);
const isRec = (v)=>typeof v === 'object' && v !== null && !Array.isArray(v);
const clone = (v)=>JSON.parse(JSON.stringify(v));
const localeOf = (spec)=>{
    const site = isRec(spec['site']) ? spec['site'] : {};
    return typeof site['defaultLocale'] === 'string' ? site['defaultLocale'] : 'ru';
};
const textIn = (v, locale)=>isRec(v) && typeof v[locale] === 'string' ? v[locale] : '';
function homeOf(spec) {
    const pages = Array.isArray(spec['pages']) ? spec['pages'] : [];
    return pages.find((p)=>p['isHome'] === true) ?? pages[0] ?? null;
}
const sectionsOf = (page)=>page && Array.isArray(page['sections']) ? page['sections'] : [];
const asImage = (v)=>isRec(v) && typeof v['assetId'] === 'string' && isRec(v['alt']) ? {
        assetId: v['assetId'],
        alt: v['alt']
    } : null;
/** Правка копии главной; итог прошёл валидатор, иначе входной документ */ function edit(spec, fn) {
    const doc = clone(spec);
    const home = homeOf(doc);
    if (!home) return spec;
    fn(home, doc);
    if (JSON.stringify(doc) === JSON.stringify(spec)) return spec;
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$spec$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["validateSiteSpec"])(doc).ok ? doc : spec;
}
/** Уникальный id секции в документе */ function freeId(doc, base) {
    const used = new Set((doc['pages'] ?? []).flatMap((p)=>sectionsOf(p).map((s)=>String(s['id']))));
    if (!used.has(base)) return base;
    let n = 2;
    while(used.has(`${base}-${n}`))n += 1;
    return `${base}-${n}`;
}
/** Куда вставить новый блок: после первого найденного из списка, иначе перед формой или контактами, иначе в конец */ function insertAfter(home, section, after) {
    const list = sectionsOf(home);
    for (const type of after){
        const i = list.findIndex((s)=>s['type'] === type);
        if (i >= 0) {
            list.splice(i + 1, 0, section);
            return;
        }
    }
    const tail = list.findIndex((s)=>s['type'] === 'leadForm' || s['type'] === 'contacts' || s['type'] === 'cta');
    if (tail >= 0) list.splice(tail, 0, section);
    else list.push(section);
}
/** Убрать ссылки меню и подвала на удалённые секции */ function dropNav(doc, ids) {
    const nav = isRec(doc['navigation']) ? doc['navigation'] : null;
    if (!nav) return;
    for (const key of [
        'header',
        'footer'
    ])if (Array.isArray(nav[key])) nav[key] = nav[key].filter((item)=>{
        const target = isRec(item['target']) ? item['target'] : null;
        return !(target && target['kind'] === 'SECTION' && ids.has(String(target['sectionId'])));
    });
}
function simpleSiteState(spec) {
    const locale = localeOf(spec);
    const list = sectionsOf(homeOf(spec));
    const hero = list.find((s)=>s['type'] === 'hero');
    const about = list.find((s)=>s['type'] === 'about');
    const gallery = list.find((s)=>s['type'] === 'gallery');
    const blocks = {};
    for (const b of SIMPLE_BLOCKS)blocks[b.type] = list.some((s)=>s['type'] === b.type);
    return {
        heroHeading: textIn(hero?.['heading'], locale),
        heroSubheading: textIn(hero?.['subheading'], locale),
        heroPhoto: asImage(hero?.['image']),
        about: (about?.['paragraphs'] ?? []).map((p)=>textIn(p, locale)).filter(Boolean).join('\n\n'),
        gallery: (gallery?.['images'] ?? []).map(asImage).filter((x)=>x !== null),
        blocks
    };
}
function setHeroText(spec, field, locale, value) {
    const text = value.replace(/\s+/g, ' ').trim();
    return edit(spec, (home)=>{
        const hero = sectionsOf(home).find((s)=>s['type'] === 'hero');
        if (!hero) return;
        if (!text) {
            if (field === 'subheading') delete hero['subheading'];
            return;
        }
        hero[field] = {
            ...isRec(hero[field]) ? hero[field] : {},
            [locale]: text
        };
    });
}
function setHeroPhoto(spec, image) {
    return edit(spec, (home)=>{
        const hero = sectionsOf(home).find((s)=>s['type'] === 'hero');
        if (!hero) return;
        if (image) {
            hero['image'] = {
                assetId: image.assetId,
                alt: image.alt
            };
            if (hero['variant'] === 'TEXT_ONLY') hero['variant'] = 'IMAGE_FULL';
        } else {
            delete hero['image'];
            hero['variant'] = 'TEXT_ONLY';
        }
    });
}
function setAboutText(spec, locale, value) {
    const paragraphs = value.split(/\n\s*\n/).map((p)=>p.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 6).map((p)=>({
            [locale]: p.slice(0, 600)
        }));
    return edit(spec, (home, doc)=>{
        const list = sectionsOf(home);
        const i = list.findIndex((s)=>s['type'] === 'about');
        if (!paragraphs.length) {
            if (i >= 0) {
                const [gone] = list.splice(i, 1);
                dropNav(doc, new Set([
                    String(gone['id'])
                ]));
            }
            return;
        }
        if (i >= 0) {
            list[i]['paragraphs'] = paragraphs;
            return;
        }
        const heading = locale === 'kk' ? 'Біз туралы' : locale === 'en' ? 'About us' : 'О нас';
        insertAfter(home, {
            id: freeId(doc, 'sec-about'),
            type: 'about',
            variant: 'TEXT_ONLY',
            heading: {
                [locale]: heading
            },
            paragraphs
        }, [
            'services',
            'menu',
            'accommodations'
        ]);
    });
}
function setGalleryPhotos(spec, images) {
    const picked = images.slice(0, 24).map((x)=>({
            assetId: x.assetId,
            alt: x.alt
        }));
    return edit(spec, (home, doc)=>{
        const list = sectionsOf(home);
        const i = list.findIndex((s)=>s['type'] === 'gallery');
        if (picked.length < 3) {
            if (i >= 0) {
                const [gone] = list.splice(i, 1);
                dropNav(doc, new Set([
                    String(gone['id'])
                ]));
            }
            return;
        }
        if (i >= 0) {
            list[i]['images'] = picked;
            return;
        }
        const locale = localeOf(doc);
        const heading = locale === 'kk' ? 'Біздің жұмыстар' : locale === 'en' ? 'Our work' : 'Наши работы';
        insertAfter(home, {
            id: freeId(doc, 'sec-gallery'),
            type: 'gallery',
            variant: 'GRID',
            heading: {
                [locale]: heading
            },
            images: picked
        }, [
            'about',
            'staff',
            'services',
            'menu',
            'accommodations'
        ]);
    });
}
function toggleSiteBlock(spec, type, on, template) {
    if (!SIMPLE_BLOCKS.some((b)=>b.type === type)) return spec;
    const has = sectionsOf(homeOf(spec)).some((s)=>s['type'] === type);
    if (has === on) return spec;
    if (!on) return edit(spec, (home, doc)=>{
        const gone = sectionsOf(home).filter((s)=>s['type'] === type);
        home['sections'] = sectionsOf(home).filter((s)=>s['type'] !== type);
        dropNav(doc, new Set(gone.map((s)=>String(s['id']))));
    });
    const tplList = sectionsOf(homeOf(template));
    const fromTpl = tplList.find((s)=>s['type'] === type);
    if (!fromTpl) return spec;
    return edit(spec, (home, doc)=>{
        const list = sectionsOf(home);
        const section = clone(fromTpl);
        section['id'] = freeId(doc, String(section['id']));
        // место по порядку шаблона: после ближайшего предыдущего блока шаблона, который есть в сайте
        const order = tplList.map((s)=>s['type']);
        const before = order.slice(0, order.indexOf(type)).reverse();
        let at = -1;
        for (const t of before){
            at = list.findIndex((s)=>s['type'] === t);
            if (at >= 0) break;
        }
        list.splice(at + 1, 0, section);
        // пункт меню шаблона на этот блок возвращается, если он был
        const nav = isRec(doc['navigation']) ? doc['navigation'] : null;
        const tplNav = isRec(template['navigation']) ? template['navigation'] : null;
        const link = (tplNav?.['header'] ?? []).find((h)=>isRec(h['target']) && h['target']['sectionId'] === fromTpl['id']);
        if (nav && link && Array.isArray(nav['header']) && nav['header'].length < 7) {
            const copy = clone(link);
            copy['target']['sectionId'] = section['id'];
            nav['header'].push(copy);
        }
    });
}
}),
"[project]/wt-personnel/packages/domain/src/marketing/site-copy.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SITE_COPY_COUNT",
    ()=>SITE_COPY_COUNT,
    "siteCopySuggestion",
    ()=>siteCopySuggestion
]);
const COPY = Object.freeze({
    BEAUTY: [
        {
            heading: 'Красота, к которой хочется возвращаться',
            subheading: 'Мастера с опытом от 5 лет, стерильные инструменты и запись онлайн за минуту. Свободные окна видно сразу.',
            about: '{name} это мастера, к которым возвращаются годами. Мы работаем на профессиональной косметике и стерилизуем инструменты после каждого гостя.\n\nЗапишитесь онлайн: выберите услугу, мастера и удобное время, а мы напомним о визите в WhatsApp.'
        },
        {
            heading: 'Результат, который держится неделями',
            subheading: 'Аккуратная работа без спешки и честные цены без доплат на месте. Запись онлайн 24/7.',
            about: 'В {name} цена известна заранее: вы видите её на сайте до записи, и на месте она не меняется.\n\nКаждый мастер ведёт гостя от консультации до результата, поэтому вы уходите именно с тем, за чем пришли.'
        },
        {
            heading: 'Ваше время для себя',
            subheading: 'Уютный зал, чай или кофе, мастера, которые слышат. Выберите удобное время онлайн, без звонков.',
            about: '{name} создан для того, чтобы вы отдыхали, пока мы работаем.\n\nМы бережём ваше время: запись онлайн, напоминание накануне и приём минута в минуту.'
        }
    ],
    HOSPITALITY: [
        {
            heading: 'Выспитесь как дома, в центре города',
            subheading: 'Бронируйте напрямую: лучшая цена без комиссий агрегаторов и мгновенное подтверждение.',
            about: '{name} это чистые номера, удобные кровати и тишина ночью.\n\nБронирование напрямую на сайте выгоднее, чем через агрегаторы: без наценок, с подтверждением сразу.'
        },
        {
            heading: 'Номер готов к вашему приезду',
            subheading: 'Ранний заезд по возможности, круглосуточная стойка и помощь с трансфером. Цены на сайте без наценок.',
            about: 'В {name} встречают в любое время суток и помогают с дорогой из аэропорта.\n\nВыберите даты и номер онлайн: цена на сайте окончательная, без скрытых сборов.'
        },
        {
            heading: 'Отдых без лишних хлопот',
            subheading: 'Свободные даты и цены видно сразу. Бронь за минуту, оплата при заселении или онлайн.',
            about: '{name} бережёт ваше время: всё, что нужно для спокойного отдыха, уже на месте.\n\nЗабронируйте прямо здесь: это быстрее и выгоднее, чем через посредников.'
        }
    ],
    FOOD_SERVICE: [
        {
            heading: 'Вкусно, как дома, только готовить не нужно',
            subheading: 'Свежие блюда каждый день и честные порции. Забронируйте стол онлайн за минуту.',
            about: '{name} готовит из свежих продуктов каждый день, без заготовок на неделю.\n\nБронируйте стол на сайте: подтверждение придёт сразу, а мы подготовим место к вашему приходу.'
        },
        {
            heading: 'Место, куда хочется прийти ещё раз',
            subheading: 'Меню с ценами прямо на сайте, без сюрпризов в счёте. Стол на вечер бронируется онлайн.',
            about: 'В {name} цены в меню окончательные: в счёте будет ровно то, что вы заказали.\n\nПриходите компанией: забронируйте стол заранее, и он будет ждать вас.'
        },
        {
            heading: 'Обед и ужин без ожидания',
            subheading: 'Быстрая подача, понятное меню и бронь стола онлайн. Ждём вас каждый день.',
            about: '{name} ценит ваше время: заказ приносим быстро, а стол можно забронировать заранее.\n\nМеню с ценами всегда актуально: оно обновляется само из нашей системы.'
        }
    ]
});
function siteCopySuggestion(vertical, index, name) {
    const list = COPY[vertical];
    const v = list[(index % list.length + list.length) % list.length];
    const fill = (s)=>s.replaceAll('{name}', name.trim() || 'Мы');
    return {
        heading: fill(v.heading),
        subheading: fill(v.subheading),
        about: fill(v.about)
    };
}
const SITE_COPY_COUNT = (vertical)=>COPY[vertical].length;
}),
"[project]/wt-personnel/packages/domain/src/marketing/site-facts.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * «Что WETOP знает о филиале» для конструктора сайта (SITE-2, план `plans/site-seo-flow-2026-10-15.md` §1 шаг 1).
 * Контракт ответа `GET /marketing/site/facts?locationId=…` для всех трёх направлений: только данные системы, без ИИ,
 * без текстов модели, без данных гостей и денег за период. Из него стойка рисует карточку филиала и подсказки «Дополнить»,
 * а `starterSpecFromFacts` (`starter.ts`) строит мгновенное превью трёх дизайнов.
 *
 * Деньги целыми minor units строкой (ADR-008): `{ minor: '250000', currency: 'KZT' }` это 2 500,00 ₸. Время `ЧЧ:ММ`
 * по часам филиала, день недели 0 воскресенье (как `Date.getDay()` и `working_hours.weekday`).
 */ __turbopack_context__.s([
    "SITE_FACTS_HREF",
    ()=>SITE_FACTS_HREF,
    "SITE_FACTS_MIN_PHOTOS",
    ()=>SITE_FACTS_MIN_PHOTOS,
    "buildSiteFacts",
    ()=>buildSiteFacts,
    "hoursFromServicePeriods",
    ()=>hoursFromServicePeriods,
    "hoursFromShifts",
    ()=>hoursFromShifts,
    "siteFactsGaps",
    ()=>siteFactsGaps,
    "siteStatusOf",
    ()=>siteStatusOf
]);
function siteStatusOf(state) {
    if (!state) return 'NONE';
    if (state === 'PUBLISHED' || state === 'ARCHIVED') return state;
    return 'DRAFT';
}
const SITE_FACTS_HREF = Object.freeze({
    HOSPITALITY: {
        address: '/branches',
        phone: '/branches',
        whatsapp: '/branches',
        catalog: '/rooms/categories',
        staff: '/branches',
        hours: '/hotel-settings/stay',
        photos: '/marketing/site/assets'
    },
    BEAUTY: {
        address: '/branches',
        phone: '/branches',
        whatsapp: '/branches',
        catalog: '/beauty/services',
        staff: '/beauty/masters',
        hours: '/beauty/schedule',
        photos: '/marketing/site/assets'
    },
    FOOD_SERVICE: {
        address: '/branches',
        phone: '/branches',
        whatsapp: '/branches',
        catalog: '/menu',
        staff: '/branches',
        hours: '/restaurant-settings',
        photos: '/marketing/site/assets'
    }
});
const GAP_LABEL = {
    HOSPITALITY: {
        catalog: 'Нет категорий номеров: добавьте их, чтобы показать номера на сайте',
        hours: 'Не указано время заезда и выезда'
    },
    BEAUTY: {
        catalog: 'Нет услуг в этом филиале: включите услуги и цены',
        staff: 'Нет мастеров в этом филиале: добавьте мастеров',
        hours: 'Нет графика мастеров: без него на сайте не будет часов работы'
    },
    FOOD_SERVICE: {
        catalog: 'Меню пустое: добавьте блюда с ценами',
        hours: 'Нет сервис-периодов: без них на сайте не будет часов работы'
    }
};
const SITE_FACTS_MIN_PHOTOS = 3;
function siteFactsGaps(s) {
    const out = [];
    const href = SITE_FACTS_HREF[s.vertical];
    const gap = (cond, key, label)=>{
        if (cond) out.push({
            key,
            label,
            href: href[key]
        });
    };
    const own = GAP_LABEL[s.vertical];
    gap(!s.location.address, 'address', 'Не указан адрес филиала');
    gap(!s.location.phone, 'phone', 'Не указан телефон филиала');
    gap(!s.location.whatsapp, 'whatsapp', 'Не указан WhatsApp: на телефоне не будет кнопки WhatsApp');
    gap(s.catalog.items.length === 0, 'catalog', own.catalog ?? 'Каталог пуст');
    if (s.vertical === 'BEAUTY') gap(s.staff.length === 0, 'staff', own.staff ?? 'Нет сотрудников');
    const noHours = s.vertical === 'HOSPITALITY' ? !s.hours.checkInTime && !s.hours.checkOutTime : s.hours.days.length === 0;
    gap(noHours, 'hours', own.hours ?? 'Нет часов работы');
    gap(s.photosCount < SITE_FACTS_MIN_PHOTOS, 'photos', `Загрузите фото: для галереи нужно не меньше ${SITE_FACTS_MIN_PHOTOS}`);
    return out;
}
const byCode = (a, b)=>a < b ? -1 : a > b ? 1 : 0;
function buildSiteFacts(s) {
    const staff = [
        ...s.staff
    ].sort((a, b)=>byCode(a.name, b.name) || byCode(a.id, b.id));
    const days = [
        ...s.hours.days
    ].sort((a, b)=>a.weekday - b.weekday || byCode(a.open, b.open));
    const reviews = s.reviews && s.reviews.count > 0 ? {
        avg: Math.round(s.reviews.avg * 10) / 10,
        count: s.reviews.count
    } : null;
    const facts = {
        vertical: s.vertical,
        location: {
            ...s.location
        },
        // порядок каталога задаёт сборщик (меню в порядке ресторана), здесь он не меняется
        catalog: {
            kind: s.catalog.kind,
            items: s.catalog.items.map((i)=>({
                    ...i
                }))
        },
        staff,
        hours: {
            ...s.hours,
            days
        },
        photosCount: s.photosCount,
        reviews,
        gaps: []
    };
    facts.gaps = siteFactsGaps({
        ...facts,
        reviews
    });
    return facts;
}
function hoursFromShifts(shifts) {
    const byDay = new Map();
    for (const s of shifts){
        const day = byDay.get(s.weekday);
        if (!day) byDay.set(s.weekday, {
            weekday: s.weekday,
            open: s.timeFrom,
            close: s.timeTo
        });
        else {
            if (s.timeFrom < day.open) day.open = s.timeFrom;
            if (s.timeTo > day.close) day.close = s.timeTo;
        }
    }
    return [
        ...byDay.values()
    ].sort((a, b)=>a.weekday - b.weekday);
}
function hoursFromServicePeriods(periods) {
    const byDay = new Map();
    for (const p of periods){
        const day = byDay.get(p.weekday);
        if (!day) byDay.set(p.weekday, {
            open: p.timeFrom,
            close: p.timeTo,
            late: p.endsNextDay
        });
        else {
            if (p.timeFrom < day.open) day.open = p.timeFrom;
            if (p.endsNextDay && (!day.late || p.timeTo > day.close)) Object.assign(day, {
                close: p.timeTo,
                late: true
            });
            else if (!p.endsNextDay && !day.late && p.timeTo > day.close) day.close = p.timeTo;
        }
    }
    return [
        ...byDay.entries()
    ].sort((a, b)=>a[0] - b[0]).map(([weekday, d])=>({
            weekday,
            open: d.open,
            close: d.close
        }));
}
}),
"[project]/wt-personnel/packages/domain/src/marketing/site-lead.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SITE_LEAD_ENDPOINTS",
    ()=>SITE_LEAD_ENDPOINTS,
    "SITE_LEAD_LIMITS",
    ()=>SITE_LEAD_LIMITS,
    "SITE_LEAD_MODES",
    ()=>SITE_LEAD_MODES,
    "SITE_LEAD_MODES_BY_VERTICAL",
    ()=>SITE_LEAD_MODES_BY_VERTICAL,
    "SITE_LEAD_SCHEMA_VERSION",
    ()=>SITE_LEAD_SCHEMA_VERSION,
    "parseSiteLead",
    ()=>parseSiteLead
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$web$2d$analytics$2f$hit$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/web-analytics/hit.ts [app-ssr] (ecmascript)");
;
const SITE_LEAD_SCHEMA_VERSION = 'site-lead/0';
const SITE_LEAD_MODES = [
    'HOTEL_BOOKING',
    'BEAUTY_APPOINTMENT',
    'TABLE_RESERVATION',
    'CALLBACK'
];
const SITE_LEAD_MODES_BY_VERTICAL = Object.freeze({
    HOSPITALITY: [
        'HOTEL_BOOKING',
        'CALLBACK'
    ],
    BEAUTY: [
        'BEAUTY_APPOINTMENT',
        'CALLBACK'
    ],
    FOOD_SERVICE: [
        'TABLE_RESERVATION',
        'CALLBACK'
    ]
});
const SITE_LEAD_ENDPOINTS = Object.freeze({
    HOTEL_BOOKING: '/w/book',
    BEAUTY_APPOINTMENT: '/w/beauty/book',
    TABLE_RESERVATION: '/w/food/reserve',
    CALLBACK: '/w/lead'
});
const SITE_LEAD_LIMITS = Object.freeze({
    name: 120,
    comment: 1000,
    partySizeMax: 50,
    turnstileToken: 2048
});
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INSTANT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/;
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u0008\u000b-\u001f\u007f]/;
function validDate(raw) {
    const m = DATE_RE.exec(raw);
    if (!m) return false;
    const [y, mo, d] = [
        Number(m[1]),
        Number(m[2]),
        Number(m[3])
    ];
    const date = new Date(Date.UTC(y, mo - 1, d));
    return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}
function parseSiteLead(mode, raw) {
    const errors = [];
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return {
        ok: false,
        errors: [
            'body'
        ]
    };
    const r = raw;
    const specific = {
        BEAUTY_APPOINTMENT: [
            'serviceId',
            'employeeId',
            'startsAt'
        ],
        TABLE_RESERVATION: [
            'date',
            'time',
            'partySize'
        ],
        CALLBACK: []
    };
    const allowed = [
        'k',
        'name',
        'phone',
        'comment',
        'requestKey',
        'turnstileToken',
        'website',
        'lang',
        ...specific[mode]
    ];
    for (const key of Object.keys(r))if (!allowed.includes(key)) errors.push(key);
    const text = (key, max, required)=>{
        const v = r[key];
        if (v === undefined || v === null || v === '') {
            if (required) errors.push(key);
            return undefined;
        }
        if (typeof v !== 'string') {
            errors.push(key);
            return undefined;
        }
        const t = v.replace(/\r\n?/g, '\n').trim();
        if (required && !t || [
            ...t
        ].length > max || CONTROL_RE.test(t)) errors.push(key);
        return t || undefined;
    };
    const k = typeof r['k'] === 'string' && __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$web$2d$analytics$2f$hit$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SITE_KEY_RE"].test(r['k']) ? r['k'] : (errors.push('k'), '');
    const name = text('name', mode === 'BEAUTY_APPOINTMENT' ? 100 : SITE_LEAD_LIMITS.name, true) ?? '';
    const phoneRaw = text('phone', 32, true) ?? '';
    if (phoneRaw && !/^\+?[0-9 ()-]{7,32}$/.test(phoneRaw)) errors.push('phone');
    const comment = text('comment', SITE_LEAD_LIMITS.comment, false);
    const requestKey = typeof r['requestKey'] === 'string' && UUID_V4_RE.test(r['requestKey']) ? r['requestKey'].toLowerCase() : (errors.push('requestKey'), '');
    const turnstileToken = text('turnstileToken', SITE_LEAD_LIMITS.turnstileToken, false);
    const website = typeof r['website'] === 'string' ? r['website'] : undefined;
    if (r['website'] !== undefined && typeof r['website'] !== 'string') errors.push('website');
    const lang = r['lang'];
    if (lang !== undefined && lang !== 'ru' && lang !== 'kk' && lang !== 'en') errors.push('lang');
    const common = {
        k,
        name,
        phone: phoneRaw,
        requestKey,
        ...comment ? {
            comment
        } : {},
        ...turnstileToken ? {
            turnstileToken
        } : {},
        ...website !== undefined ? {
            website
        } : {},
        ...lang ? {
            lang: lang
        } : {}
    };
    let body;
    if (mode === 'BEAUTY_APPOINTMENT') {
        const serviceId = typeof r['serviceId'] === 'string' && UUID_RE.test(r['serviceId']) ? r['serviceId'] : (errors.push('serviceId'), '');
        const employee = r['employeeId'];
        if (employee !== undefined && employee !== '' && (typeof employee !== 'string' || !UUID_RE.test(employee))) errors.push('employeeId');
        const startsAt = typeof r['startsAt'] === 'string' ? r['startsAt'] : '';
        if (!INSTANT_RE.test(startsAt) || Number.isNaN(Date.parse(startsAt))) errors.push('startsAt');
        body = {
            ...common,
            mode,
            serviceId,
            startsAt,
            ...typeof employee === 'string' && employee ? {
                employeeId: employee.toLowerCase()
            } : {}
        };
    } else if (mode === 'TABLE_RESERVATION') {
        const date = typeof r['date'] === 'string' && validDate(r['date']) ? r['date'] : (errors.push('date'), '');
        const time = typeof r['time'] === 'string' && TIME_RE.test(r['time']) ? r['time'] : (errors.push('time'), '');
        const party = r['partySize'];
        const partySize = typeof party === 'number' && Number.isInteger(party) && party >= 1 && party <= SITE_LEAD_LIMITS.partySizeMax ? party : (errors.push('partySize'), 0);
        body = {
            ...common,
            mode,
            date,
            time,
            partySize
        };
    } else body = {
        ...common,
        mode
    };
    return errors.length ? {
        ok: false,
        errors: [
            ...new Set(errors)
        ]
    } : {
        ok: true,
        body
    };
}
}),
"[project]/wt-personnel/packages/domain/src/marketing/site-slug.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Адрес управляемого сайта (`marketing_sites.slug`, `DATA_MODEL.md` §29.2): основа платформенного поддомена. Тот же
 * шаблон стоит CHECK в базе. Зарезервированные слова: `docs/marketing/README.md` §6; слова из 1–2 букв отсекает сам
 * шаблон (не короче трёх знаков). Конфликт адреса не исправляется молча: человек выбирает другой.
 */ __turbopack_context__.s([
    "MARKETING_SLUG_RE",
    ()=>MARKETING_SLUG_RE,
    "RESERVED_SITE_SLUGS",
    ()=>RESERVED_SITE_SLUGS,
    "parseMarketingSlug",
    ()=>parseMarketingSlug,
    "suggestMarketingSlug",
    ()=>suggestMarketingSlug
]);
const MARKETING_SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
const RESERVED_SITE_SLUGS = [
    'www',
    'app',
    'api',
    'assistant',
    'seller',
    'admin',
    'mail',
    'status',
    'preview',
    'static',
    'assets',
    'cdn',
    'help',
    'support',
    'wetop',
    'docs',
    'blog'
];
function parseMarketingSlug(raw) {
    if (typeof raw !== 'string') return {
        ok: false,
        code: 'invalid_slug',
        message: 'Адрес сайта: строка'
    };
    const slug = raw.trim().toLowerCase();
    if (!MARKETING_SLUG_RE.test(slug)) return {
        ok: false,
        code: 'invalid_slug',
        message: 'Адрес сайта: от 3 до 40 знаков, латинские буквы, цифры и дефис, без дефиса в начале и в конце'
    };
    if (RESERVED_SITE_SLUGS.includes(slug)) return {
        ok: false,
        code: 'reserved_slug',
        message: `Адрес «${slug}» занят системой WETOP`
    };
    return {
        ok: true,
        slug
    };
}
const TRANSLIT = {
    а: 'a',
    б: 'b',
    в: 'v',
    г: 'g',
    д: 'd',
    е: 'e',
    ё: 'e',
    ж: 'zh',
    з: 'z',
    и: 'i',
    й: 'y',
    к: 'k',
    л: 'l',
    м: 'm',
    н: 'n',
    о: 'o',
    п: 'p',
    р: 'r',
    с: 's',
    т: 't',
    у: 'u',
    ф: 'f',
    х: 'h',
    ц: 'ts',
    ч: 'ch',
    ш: 'sh',
    щ: 'sch',
    ъ: '',
    ы: 'y',
    ь: '',
    э: 'e',
    ю: 'yu',
    я: 'ya',
    ә: 'a',
    ғ: 'g',
    қ: 'k',
    ң: 'n',
    ө: 'o',
    ұ: 'u',
    ү: 'u',
    һ: 'h',
    і: 'i'
};
function suggestMarketingSlug(name) {
    const latin = [
        ...name.toLowerCase()
    ].map((ch)=>TRANSLIT[ch] ?? ch).join('');
    let slug = latin.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/g, '');
    if (slug.length < 3) slug = `site-${slug || 'hotel'}`.replace(/-+$/g, '');
    if (RESERVED_SITE_SLUGS.includes(slug)) slug = `${slug}-site`;
    return parseMarketingSlug(slug).ok ? slug : 'my-hotel';
}
}),
"[project]/wt-personnel/packages/domain/src/marketing/site-spec.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SITE_SPEC_ICONS",
    ()=>SITE_SPEC_ICONS,
    "SITE_SPEC_LIMITS",
    ()=>SITE_SPEC_LIMITS,
    "SITE_SPEC_LOCALES",
    ()=>SITE_SPEC_LOCALES,
    "SITE_SPEC_MAX_BYTES",
    ()=>SITE_SPEC_MAX_BYTES,
    "SITE_SPEC_SCHEMA_VERSION",
    ()=>SITE_SPEC_SCHEMA_VERSION,
    "SITE_SPEC_SECTIONS",
    ()=>SITE_SPEC_SECTIONS,
    "SITE_SPEC_SECTIONS_BY_VERTICAL",
    ()=>SITE_SPEC_SECTIONS_BY_VERTICAL,
    "SITE_SPEC_SOCIAL_HOSTS",
    ()=>SITE_SPEC_SOCIAL_HOSTS,
    "SITE_SPEC_STRUCTURED_TYPES",
    ()=>SITE_SPEC_STRUCTURED_TYPES,
    "SITE_SPEC_THEME",
    ()=>SITE_SPEC_THEME,
    "SITE_SPEC_VERTICALS",
    ()=>SITE_SPEC_VERTICALS,
    "plainTextProblem",
    ()=>plainTextProblem,
    "siteSpecSectionFields",
    ()=>siteSpecSectionFields,
    "validateSiteSpec",
    ()=>validateSiteSpec
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$canonical$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/canonical.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$lead$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/site-lead.ts [app-ssr] (ecmascript)");
;
;
const SITE_SPEC_SCHEMA_VERSION = 'site-spec/0';
const SITE_SPEC_MAX_BYTES = 262_144;
const LOCALES = [
    'ru',
    'kk',
    'en'
];
const ID_RE = /^[a-z0-9][a-z0-9-]{0,47}$/;
const PAGE_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RESERVED_PAGE_SLUGS = [
    'api',
    'w',
    'a',
    '_next',
    '_preview',
    'preview',
    'assets',
    'static',
    'robots.txt',
    'sitemap.xml',
    'favicon.ico',
    '.well-known',
    ...LOCALES
];
const ASSET_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PHONE_RE = /^\+[1-9][0-9]{9,14}$/;
const CATEGORY_CODE_RE = /^[A-Za-z0-9_-]{1,64}$/;
// управляющие символы, включая перевод строки: абзацы это отдельные элементы массива
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u001f\u007f]/;
const MARKUP_RE = /<[A-Za-z/!?]/;
const TEMPLATE_RE = /\{\{|\$\{/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Деньги в документе только целыми minor units строкой (ADR-008): JSON-число не держит BigInt без потерь */ const MINOR_RE = /^(?:0|[1-9][0-9]{0,14})$/;
const CURRENCY_RE = /^[A-Z]{3}$/;
const CLOCK_RE = /^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/;
const SITE_SPEC_VERTICALS = [
    'HOSPITALITY',
    'BEAUTY',
    'FOOD_SERVICE'
];
const SITE_SPEC_STRUCTURED_TYPES = Object.freeze({
    HOSPITALITY: [
        'HOTEL',
        'HOSTEL',
        'APARTMENT',
        'LODGING'
    ],
    BEAUTY: [
        'BEAUTY_SALON'
    ],
    FOOD_SERVICE: [
        'RESTAURANT',
        'CAFE'
    ]
});
function plainTextProblem(raw) {
    if (CONTROL_RE.test(raw)) return 'Управляющие символы недопустимы';
    if (MARKUP_RE.test(raw)) return 'Разметка HTML недопустима, только обычный текст';
    if (TEMPLATE_RE.test(raw)) return 'Шаблоны вида {{…}} и ${…} недопустимы';
    return null;
}
const SITE_SPEC_ICONS = Object.freeze([
    'CLOCK',
    'PARKING',
    'WIFI',
    'BREAKFAST',
    'LAUNDRY',
    'LUGGAGE',
    'KITCHEN',
    'AIRCON',
    'TRANSFER',
    'PETS',
    'ACCESSIBLE',
    'FAMILY',
    'QUIET',
    'CENTER',
    'STATION',
    'STAR'
]);
const ICONS = SITE_SPEC_ICONS;
const SITE_SPEC_THEME = Object.freeze({
    preset: [
        'CALM',
        'WARM',
        'NIGHT',
        'COAST'
    ],
    accent: [
        'TEAL',
        'INDIGO',
        'TERRACOTTA',
        'FOREST',
        'GRAPHITE',
        'GOLD'
    ],
    typography: [
        'MODERN',
        'CLASSIC',
        'ROUNDED'
    ],
    radius: [
        'SHARP',
        'SOFT',
        'ROUND'
    ],
    density: [
        'COMPACT',
        'COMFORTABLE'
    ],
    colorScheme: [
        'LIGHT'
    ]
});
const SITE_SPEC_LOCALES = LOCALES;
const SITE_SPEC_SOCIAL_HOSTS = {
    INSTAGRAM: [
        'instagram.com'
    ],
    FACEBOOK: [
        'facebook.com'
    ],
    TELEGRAM: [
        't.me',
        'telegram.me'
    ],
    TIKTOK: [
        'tiktok.com'
    ],
    YOUTUBE: [
        'youtube.com',
        'youtu.be'
    ],
    VK: [
        'vk.com'
    ]
};
const SOCIAL_HOSTS = SITE_SPEC_SOCIAL_HOSTS;
class Checker {
    errors = [];
    locales = [];
    defaultLocale = '';
    refs = [];
    contactNeeds = [];
    ids = new Set();
    /** Секции с картой: карте нужны координаты в контактах сайта */ mapNeeds = [];
    /** Коды категорий из карточек размещения всего документа: строка цены берёт название оттуда */ cardCodes = new Set();
    /** Коды категорий секций цен: каждый ищется среди карточек после разбора всех страниц */ pricingCodes = [];
    /** Направление сайта: от него зависят тип schema.org и режимы формы заявки */ vertical = '';
    /** Коды услуг секций `services` документа: форма записи предлагает только их */ serviceCodes = new Set();
    menuCodes = new Set();
    /** Формы записи к мастеру: каждой нужна хотя бы одна услуга в документе */ appointmentForms = [];
    /** Код позиции каталога WETOP (услуга, блюдо): тот же вид, что код категории, сверяется с брифом при генерации */ catalogCode = (value, path)=>{
        if (typeof value !== 'string' || !CATEGORY_CODE_RE.test(value)) this.fail(path, 'invalid_catalog_code', 'Код позиции каталога: латиница, цифры, дефис и подчёркивание');
    };
    /** Цена снимком из данных WETOP: `{ minor, currency }`; ИИ её не пишет, платформа ставит из брифа */ money = (value, path)=>{
        this.obj(value, path, {
            minor: this.minor,
            currency: this.currency
        }, [
            'minor',
            'currency'
        ]);
    };
    int(min, max) {
        return (value, path)=>{
            if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) this.fail(path, 'invalid_number', `Целое число от ${min} до ${max}`);
        };
    }
    minor = (value, path)=>{
        if (typeof value !== 'string' || !MINOR_RE.test(value)) this.fail(path, 'invalid_money', 'Цена: целое число минимальных единиц строкой («250000» это 2 500,00)');
    };
    currency = (value, path)=>{
        if (typeof value !== 'string' || !CURRENCY_RE.test(value)) this.fail(path, 'invalid_currency', 'Валюта: код ISO 4217');
    };
    clock = (value, path)=>{
        if (typeof value !== 'string' || !CLOCK_RE.test(value)) this.fail(path, 'invalid_time', 'Время ЧЧ:ММ');
    };
    uuid = (value, path)=>{
        if (typeof value !== 'string' || !UUID_RE.test(value)) this.fail(path, 'invalid_reference', 'Ссылка на запись WETOP (UUID)');
    };
    fail(path, code, message) {
        this.errors.push({
            path,
            code,
            message
        });
    }
    /** Объект строго с известными полями; обязательные проверяются на наличие */ obj(value, path, fields, required = []) {
        if (value === null || typeof value !== 'object' || Array.isArray(value)) {
            this.fail(path, 'type', 'Ожидается объект');
            return null;
        }
        const record = value;
        for (const key of Object.keys(record))if (!(key in fields)) this.fail(join(path, key), 'unknown_field', `Поле «${key}» не входит в SiteSpec v0`);
        for (const key of Object.keys(fields)){
            const fieldPath = join(path, key);
            if (record[key] === undefined) {
                if (required.includes(key)) this.fail(fieldPath, 'required', 'Обязательное поле');
                continue;
            }
            fields[key](record[key], fieldPath);
        }
        return record;
    }
    arr(value, path, min, max, item) {
        if (!Array.isArray(value)) {
            this.fail(path, 'type', 'Ожидается список');
            return null;
        }
        if (value.length < min || value.length > max) this.fail(path, 'count', `Ожидается от ${min} до ${max} элементов`);
        value.forEach((v, i)=>item(v, `${path}[${i}]`));
        return value;
    }
    oneOf(values) {
        return (value, path)=>{
            if (typeof value !== 'string' || !values.includes(value)) this.fail(path, 'enum', `Допустимо: ${values.join(', ')}`);
        };
    }
    bool = (value, path)=>{
        if (typeof value !== 'boolean') this.fail(path, 'type', 'Ожидается да или нет');
    };
    text(max) {
        return (value, path)=>{
            if (value === null || typeof value !== 'object' || Array.isArray(value)) {
                this.fail(path, 'type', 'Ожидается текст на языках сайта');
                return;
            }
            const record = value;
            if (record[this.defaultLocale] === undefined) this.fail(path, 'missing_default_locale', `Нужен текст на языке по умолчанию (${this.defaultLocale})`);
            for (const [locale, raw] of Object.entries(record)){
                const at = join(path, locale);
                if (!this.locales.includes(locale)) {
                    this.fail(at, 'locale_not_enabled', `Язык «${locale}» не включён у сайта`);
                    continue;
                }
                if (typeof raw !== 'string') {
                    this.fail(at, 'type', 'Ожидается строка');
                    continue;
                }
                const trimmed = raw.trim();
                if (!trimmed) this.fail(at, 'empty', 'Пустой текст');
                else if ([
                    ...trimmed
                ].length > max) this.fail(at, 'too_long', `Не длиннее ${max} знаков`);
                if (CONTROL_RE.test(raw)) this.fail(at, 'control_char', 'Управляющие символы недопустимы');
                if (MARKUP_RE.test(raw)) this.fail(at, 'markup', 'Разметка HTML недопустима, только обычный текст');
                if (TEMPLATE_RE.test(raw)) this.fail(at, 'template', 'Шаблоны вида {{…}} и ${…} недопустимы');
            }
        };
    }
    textList(max, min, maxItems) {
        return (value, path)=>this.arr(value, path, min, maxItems, this.text(max));
    }
    id = (value, path)=>{
        if (typeof value !== 'string' || !ID_RE.test(value)) {
            this.fail(path, 'invalid_id', 'Идентификатор: латиница, цифры, дефис, до 48 знаков');
            return;
        }
        if (this.ids.has(value)) this.fail(path, 'duplicate_id', `Идентификатор «${value}» уже есть в документе`);
        this.ids.add(value);
    };
    assetId = (value, path)=>{
        if (typeof value !== 'string' || !ASSET_ID_RE.test(value)) this.fail(path, 'invalid_asset_id', 'Ссылка на картинку: идентификатор ассета (UUID)');
    };
    image = (value, path)=>{
        this.obj(value, path, {
            assetId: this.assetId,
            alt: this.text(150)
        }, [
            'assetId',
            'alt'
        ]);
    };
    images(min, max) {
        return (value, path)=>this.arr(value, path, min, max, this.image);
    }
    phone = (value, path)=>{
        if (typeof value !== 'string' || !PHONE_RE.test(value)) this.fail(path, 'invalid_phone', 'Телефон в формате +77010000000');
    };
    email = (value, path)=>{
        if (typeof value !== 'string' || value.length > 254 || value.split('@').length !== 2 || /[\s<>]/.test(value) || !value.split('@').every(Boolean)) this.fail(path, 'invalid_email', 'Неверный адрес почты');
    };
    url = (value, path)=>{
        if (!httpsUrl(value)) this.fail(path, 'invalid_url', 'Только адрес https:// без логина, порта, IP-адреса и localhost');
    };
    icon = (value, path)=>this.oneOf(ICONS)(value, path);
    categoryCode = (value, path)=>{
        if (typeof value !== 'string' || !CATEGORY_CODE_RE.test(value)) this.fail(path, 'invalid_category', 'Код категории: латиница, цифры, дефис и подчёркивание');
    };
    target = (value, path)=>this.link(value, path, [
            'PAGE',
            'SECTION',
            'EXTERNAL'
        ]);
    /** `Target` и `Action` одной формы: вид и свои поля; ссылки проверяются после разбора страниц */ link(value, path, kinds) {
        if (value === null || typeof value !== 'object' || Array.isArray(value)) {
            this.fail(path, 'type', 'Ожидается объект');
            return null;
        }
        const kind = value['kind'];
        if (typeof kind !== 'string' || !kinds.includes(kind)) {
            this.fail(join(path, 'kind'), 'enum', `Допустимо: ${kinds.join(', ')}`);
            return null;
        }
        const fields = {
            kind: ()=>undefined
        };
        const required = [];
        if (kind === 'PAGE' || kind === 'SECTION') {
            fields['pageId'] = (v, p)=>this.ref(v, p);
            required.push('pageId');
        }
        if (kind === 'SECTION') {
            fields['sectionId'] = (v, p)=>this.ref(v, p);
            required.push('sectionId');
        }
        if (kind === 'EXTERNAL') {
            fields['url'] = this.url;
            required.push('url');
        }
        const record = this.obj(value, path, fields, required);
        if (record && (kind === 'PAGE' || kind === 'SECTION') && typeof record['pageId'] === 'string') this.refs.push({
            path,
            pageId: record['pageId'],
            ...kind === 'SECTION' && typeof record['sectionId'] === 'string' ? {
                sectionId: record['sectionId']
            } : {}
        });
        if (kind === 'PHONE') this.contactNeeds.push({
            path,
            contact: 'phone'
        });
        if (kind === 'WHATSAPP') this.contactNeeds.push({
            path,
            contact: 'whatsapp'
        });
        if (kind === 'EMAIL') this.contactNeeds.push({
            path,
            contact: 'email'
        });
        return record;
    }
    ref = (value, path)=>{
        if (typeof value !== 'string' || !ID_RE.test(value)) this.fail(path, 'invalid_id', 'Неверный идентификатор');
    };
    cta = (value, path)=>{
        this.obj(value, path, {
            label: this.text(30),
            action: (v, p)=>this.link(v, p, [
                    'BOOK',
                    'PAGE',
                    'SECTION',
                    'PHONE',
                    'WHATSAPP',
                    'EMAIL',
                    'EXTERNAL'
                ])
        }, [
            'label',
            'action'
        ]);
    };
}
function join(path, key) {
    return path ? `${path}.${key}` : key;
}
function httpsUrl(value) {
    if (typeof value !== 'string' || value.length > 2048) return false;
    let url;
    try {
        url = new URL(value);
    } catch  {
        return false;
    }
    const host = url.hostname.toLowerCase();
    return url.protocol === 'https:' && !url.username && !url.password && url.port === '' && host !== 'localhost' && !host.endsWith('.localhost') && !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) && !host.startsWith('[') && host.includes('.');
}
function hostOf(value) {
    try {
        return new URL(String(value)).hostname.toLowerCase();
    } catch  {
        return null;
    }
}
function decimals(value) {
    return Math.round(value * 1e6) / 1e6 === value;
}
function validateSiteSpec(input) {
    const c = new Checker();
    if (input === null || typeof input !== 'object' || Array.isArray(input)) return {
        ok: false,
        errors: [
            {
                path: '',
                code: 'type',
                message: 'SiteSpec: ожидается объект'
            }
        ]
    };
    let bytes;
    try {
        bytes = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$canonical$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["canonicalByteLength"])(input);
    } catch  {
        return {
            ok: false,
            errors: [
                {
                    path: '',
                    code: 'type',
                    message: 'SiteSpec: только значения JSON'
                }
            ]
        };
    }
    if (bytes > SITE_SPEC_MAX_BYTES) return {
        ok: false,
        errors: [
            {
                path: '',
                code: 'too_large',
                message: `SiteSpec больше ${SITE_SPEC_MAX_BYTES / 1024} КБ`
            }
        ]
    };
    const root = input;
    if (root['schemaVersion'] !== SITE_SPEC_SCHEMA_VERSION) {
        c.fail('schemaVersion', root['schemaVersion'] === undefined ? 'required' : 'unknown_schema_version', `Известна только версия схемы ${SITE_SPEC_SCHEMA_VERSION}`);
        return {
            ok: false,
            errors: c.errors
        };
    }
    // языки нужны всем текстам: разбираются раньше остального
    const site = root['site'];
    if (site && typeof site === 'object') {
        if (typeof site['defaultLocale'] === 'string') c.defaultLocale = site['defaultLocale'];
        if (Array.isArray(site['locales'])) c.locales = site['locales'].filter((l)=>typeof l === 'string');
        if (typeof site['vertical'] === 'string') c.vertical = site['vertical'];
    }
    const booking = root['integrations']?.['booking']?.['mode'];
    const pages = [];
    const pageSlugs = new Set();
    c.obj(root, '', {
        schemaVersion: ()=>undefined,
        site: (v, p)=>checkSite(c, v, p),
        theme: (v, p)=>c.obj(v, p, {
                preset: c.oneOf(SITE_SPEC_THEME.preset),
                accent: c.oneOf(SITE_SPEC_THEME.accent),
                typography: c.oneOf(SITE_SPEC_THEME.typography),
                radius: c.oneOf(SITE_SPEC_THEME.radius),
                density: c.oneOf(SITE_SPEC_THEME.density),
                colorScheme: c.oneOf(SITE_SPEC_THEME.colorScheme)
            }, [
                'preset',
                'accent',
                'typography',
                'radius',
                'density',
                'colorScheme'
            ]),
        navigation: (v, p)=>checkNavigation(c, v, p),
        pages: (v, p)=>c.arr(v, p, 1, 20, (page, pp)=>{
                const parsed = checkPage(c, page, pp, booking, pageSlugs);
                if (parsed) pages.push(parsed);
            }),
        integrations: (v, p)=>c.obj(v, p, {
                booking: (b, bp)=>c.obj(b, bp, {
                        mode: c.oneOf([
                            'WETOP_WIDGET',
                            'NONE'
                        ])
                    }, [
                        'mode'
                    ]),
                analytics: (a, ap)=>c.obj(a, ap, {
                        mode: c.oneOf([
                            'WETOP_TRACKER',
                            'NONE'
                        ]),
                        consent: c.oneOf([
                            'NOT_REQUIRED',
                            'WAIT_FOR_CONSENT'
                        ])
                    }, [
                        'mode',
                        'consent'
                    ])
            }, [
                'booking',
                'analytics'
            ])
    }, [
        'schemaVersion',
        'site',
        'theme',
        'navigation',
        'pages',
        'integrations'
    ]);
    if (Array.isArray(root['pages'])) {
        const homes = root['pages'].filter((p)=>p?.['isHome'] === true).length;
        if (homes !== 1) c.fail('pages', 'home_page', 'Нужна ровно одна главная страница');
    }
    for (const ref of c.refs){
        const page = pages.find((p)=>p.id === ref.pageId);
        if (!page) c.fail(join(ref.path, 'pageId'), 'unknown_reference', `Страницы «${ref.pageId}» нет в документе`);
        else if (ref.sectionId !== undefined && !page.sections.includes(ref.sectionId)) c.fail(join(ref.path, 'sectionId'), 'unknown_reference', `Секции «${ref.sectionId}» нет на странице «${ref.pageId}»`);
    }
    const contacts = site?.['contacts'] ?? {};
    for (const need of c.contactNeeds)if (contacts[need.contact] === undefined) c.fail(need.path, 'missing_contact', 'Действию нужен контакт сайта: укажите его в контактах');
    for (const mapPath of c.mapNeeds)if (contacts['geo'] === undefined) c.fail(mapPath, 'missing_contact', 'Карте нужны координаты в контактах сайта');
    // название строки цены берётся из снимка карточки размещения, служебное имя категории наружу не идёт
    for (const ref of c.pricingCodes)if (!c.cardCodes.has(ref.code)) c.fail(ref.path, 'pricing_category_without_card', 'Для категории секции цен нужна карточка размещения с тем же categoryCode');
    // форма записи к мастеру предлагает услуги документа: без единой услуги ей нечего предложить
    if (c.serviceCodes.size === 0) for (const at of c.appointmentForms)c.fail(at, 'appointment_without_services', 'Форме записи нужна секция услуг');
    const privacy = site?.['legal']?.['privacyPageId'];
    if (typeof privacy === 'string' && !pages.some((p)=>p.id === privacy)) c.fail('site.legal.privacyPageId', 'unknown_reference', `Страницы «${privacy}» нет в документе`);
    return c.errors.length ? {
        ok: false,
        errors: c.errors
    } : {
        ok: true,
        spec: root,
        schemaVersion: SITE_SPEC_SCHEMA_VERSION
    };
}
function checkSite(c, value, path) {
    c.obj(value, path, {
        vertical: c.oneOf(SITE_SPEC_VERTICALS),
        displayName: c.text(80),
        defaultLocale: c.oneOf(LOCALES),
        locales: (v, p)=>{
            c.arr(v, p, 1, LOCALES.length, c.oneOf(LOCALES));
            if (Array.isArray(v)) {
                if (new Set(v).size !== v.length) c.fail(p, 'duplicate', 'Языки не повторяются');
                if (!v.includes(c.defaultLocale)) c.fail(p, 'missing_default_locale', 'Список языков содержит язык по умолчанию');
            }
        },
        brand: (v, p)=>c.obj(v, p, {
                tagline: c.text(120),
                logo: c.image,
                faviconAssetId: c.assetId
            }),
        contacts: (v, p)=>c.obj(v, p, {
                phone: c.phone,
                whatsapp: c.phone,
                email: c.email,
                address: c.text(200),
                geo: (g, gp)=>c.obj(g, gp, {
                        lat: (n, np)=>{
                            if (typeof n !== 'number' || n < -90 || n > 90 || !decimals(n)) c.fail(np, 'invalid_geo', 'Широта от -90 до 90, до 6 знаков после точки');
                        },
                        lng: (n, np)=>{
                            if (typeof n !== 'number' || n < -180 || n > 180 || !decimals(n)) c.fail(np, 'invalid_geo', 'Долгота от -180 до 180, до 6 знаков после точки');
                        }
                    }, [
                        'lat',
                        'lng'
                    ]),
                social: (s, sp)=>c.arr(s, sp, 0, 6, (item, ip)=>{
                        const record = c.obj(item, ip, {
                            network: c.oneOf(Object.keys(SOCIAL_HOSTS)),
                            url: c.url
                        }, [
                            'network',
                            'url'
                        ]);
                        const hosts = SOCIAL_HOSTS[String(record?.['network'])];
                        const host = hostOf(record?.['url']);
                        if (hosts && host && !hosts.some((h)=>host === h || host === `www.${h}`)) c.fail(join(ip, 'url'), 'social_host', `Адрес не похож на ${hosts.join(' или ')}`);
                    })
            }),
        legal: (v, p)=>c.obj(v, p, {
                operatorName: c.text(200),
                privacyPageId: c.ref
            }),
        seo: (v, p)=>c.obj(v, p, {
                robots: c.oneOf([
                    'INDEX',
                    'NOINDEX'
                ]),
                titleTemplate: (t, tp)=>{
                    c.text(80)(t, tp);
                    if (t && typeof t === 'object') {
                        for (const [locale, raw] of Object.entries(t))if (typeof raw === 'string' && raw.split('%s').length !== 2) c.fail(join(tp, locale), 'title_template', 'Шаблон заголовка содержит ровно одно %s');
                    }
                },
                structuredData: (sd, sdp)=>c.obj(sd, sdp, {
                        type: (t, tp)=>{
                            const allowed = SITE_SPEC_STRUCTURED_TYPES[c.vertical] ?? SITE_SPEC_STRUCTURED_TYPES.HOSPITALITY;
                            c.oneOf(allowed)(t, tp);
                        },
                        includeAddress: c.bool,
                        includeGeo: c.bool
                    }, [
                        'type',
                        'includeAddress',
                        'includeGeo'
                    ])
            }, [
                'robots',
                'structuredData'
            ])
    }, [
        'vertical',
        'displayName',
        'defaultLocale',
        'locales',
        'seo'
    ]);
}
function checkNavigation(c, value, path) {
    const record = c.obj(value, path, {
        header: (v, p)=>c.arr(v, p, 0, 7, (item, ip)=>c.obj(item, ip, {
                    label: c.text(30),
                    target: c.target
                }, [
                    'label',
                    'target'
                ])),
        headerCta: c.cta,
        mobileBar: (v, p)=>{
            const bar = c.obj(v, p, {
                book: c.bool,
                whatsapp: c.bool
            }, [
                'book',
                'whatsapp'
            ]);
            if (bar?.['whatsapp'] === true) c.contactNeeds.push({
                path: join(p, 'whatsapp'),
                contact: 'whatsapp'
            });
        },
        footer: (v, p)=>c.arr(v, p, 0, 12, (item, ip)=>c.obj(item, ip, {
                    label: c.text(40),
                    target: c.target
                }, [
                    'label',
                    'target'
                ]))
    }, [
        'header',
        'footer'
    ]);
    const header = record?.['header'];
    if (Array.isArray(header) && header.filter((h)=>h?.['target'] && h['target']?.['kind'] === 'EXTERNAL').length > 1) c.fail(join(path, 'header'), 'external_links', 'В шапке не больше одной внешней ссылки');
}
function checkPage(c, value, path, booking, slugs) {
    const sections = [];
    const record = c.obj(value, path, {
        id: c.id,
        slug: ()=>undefined,
        isHome: c.bool,
        title: c.text(70),
        seo: (v, p)=>checkPageSeo(c, v, p),
        sections: (v, p)=>{
            const list = c.arr(v, p, 1, 30, (s, sp)=>{
                const id = checkSection(c, s, sp, booking);
                if (id) sections.push(id);
            });
            if (!list) return;
            const types = list.map((s)=>s?.['type']);
            types.forEach((type, i)=>{
                if (type === 'hero' && (i !== 0 || types.indexOf('hero') !== i)) c.fail(`${p}[${i}]`, 'hero_position', 'Секция героя одна на странице и стоит первой');
                if (type === 'booking' && types.indexOf('booking') !== i) c.fail(`${p}[${i}]`, 'duplicate_booking', 'Секция брони одна на странице');
                // одна форма на странице: кнопка «Записаться» ведёт к ней, второй цели у неё быть не может
                if (type === 'leadForm' && (types.indexOf('leadForm') !== i || types.includes('booking'))) c.fail(`${p}[${i}]`, 'duplicate_booking', 'Форма заявки одна на странице и не рядом с секцией брони');
            });
        }
    }, [
        'id',
        'slug',
        'isHome',
        'title',
        'seo',
        'sections'
    ]);
    if (!record) return null;
    const slug = record['slug'];
    const slugPath = join(path, 'slug');
    if (typeof slug !== 'string') c.fail(slugPath, 'required', 'Адрес страницы: строка');
    else if (record['isHome'] === true) {
        if (slug !== '') c.fail(slugPath, 'home_slug', 'У главной страницы адрес пустой');
    } else if (slug.length > 60 || !PAGE_SLUG_RE.test(slug)) c.fail(slugPath, 'invalid_slug', 'Адрес страницы: латиница, цифры, дефис, до 60 знаков');
    else if (RESERVED_PAGE_SLUGS.includes(slug)) c.fail(slugPath, 'reserved_slug', `Адрес «${slug}» занят`);
    else if (slugs.has(slug)) c.fail(slugPath, 'duplicate_slug', `Адрес «${slug}» уже есть у другой страницы`);
    else slugs.add(slug);
    return typeof record['id'] === 'string' ? {
        id: record['id'],
        sections
    } : null;
}
function checkPageSeo(c, value, path) {
    const record = c.obj(value, path, {
        title: c.text(60),
        description: c.text(160),
        index: c.bool,
        includeInSitemap: c.bool,
        canonical: c.oneOf([
            'SELF'
        ]),
        og: (v, p)=>c.obj(v, p, {
                title: c.text(70),
                description: c.text(200),
                imageAssetId: c.assetId
            })
    }, [
        'index',
        'includeInSitemap',
        'canonical'
    ]);
    if (record?.['index'] === false && record['includeInSitemap'] === true) c.fail(join(path, 'includeInSitemap'), 'sitemap_noindex', 'Страница без индекса не попадает в карту сайта');
}
const SECTIONS = {
    hero: {
        variants: [
            'IMAGE_FULL',
            'IMAGE_SIDE',
            'TEXT_ONLY'
        ],
        fields: (c)=>({
                subheading: c.text(200),
                image: c.image,
                primaryAction: c.cta,
                secondaryAction: c.cta
            }),
        required: [
            'primaryAction'
        ]
    },
    about: {
        variants: [
            'TEXT_ONLY',
            'TEXT_IMAGE'
        ],
        fields: (c)=>({
                paragraphs: c.textList(600, 1, 6),
                image: c.image
            }),
        required: [
            'paragraphs'
        ]
    },
    features: {
        variants: [
            'GRID',
            'LIST'
        ],
        fields: (c)=>({
                items: (v, p)=>c.arr(v, p, 2, 8, (i, ip)=>c.obj(i, ip, {
                            icon: c.icon,
                            title: c.text(60),
                            text: c.text(200)
                        }, [
                            'icon',
                            'title',
                            'text'
                        ]))
            }),
        required: [
            'items'
        ]
    },
    accommodations: {
        variants: [
            'CARDS',
            'ROWS'
        ],
        fields: (c)=>({
                items: (v, p)=>{
                    const items = c.arr(v, p, 1, 20, (i, ip)=>c.obj(i, ip, {
                            categoryCode: c.categoryCode,
                            title: c.text(60),
                            description: c.text(400),
                            images: c.images(0, 6),
                            highlights: c.textList(40, 0, 6)
                        }, [
                            'categoryCode',
                            'title',
                            'description'
                        ]));
                    const codes = (items ?? []).map((i)=>i?.['categoryCode']);
                    codes.forEach((code, i)=>{
                        if (typeof code === 'string') c.cardCodes.add(code);
                        if (typeof code === 'string' && codes.indexOf(code) !== i) c.fail(`${p}[${i}].categoryCode`, 'duplicate_category', 'Категория уже есть в секции');
                    });
                },
                showLiveCapacity: c.bool,
                showFromPrice: c.bool,
                itemAction: c.cta
            }),
        required: [
            'items'
        ]
    },
    amenities: {
        variants: [
            'LIST',
            'ICONS'
        ],
        fields: (c)=>({
                items: (v, p)=>c.arr(v, p, 1, 24, (i, ip)=>c.obj(i, ip, {
                            icon: c.icon,
                            label: c.text(60),
                            note: c.text(120)
                        }, [
                            'icon',
                            'label'
                        ]))
            }),
        required: [
            'items'
        ]
    },
    pricing: {
        variants: [
            'FROM_PRICES'
        ],
        fields: (c)=>({
                categoryCodes: (v, p)=>{
                    c.arr(v, p, 1, 20, c.categoryCode);
                    if (Array.isArray(v) && new Set(v).size !== v.length) c.fail(p, 'duplicate_category', 'Категории не повторяются');
                    if (Array.isArray(v)) v.forEach((code, i)=>{
                        if (typeof code === 'string') c.pricingCodes.push({
                            path: `${p}[${i}]`,
                            code
                        });
                    });
                },
                note: c.text(300)
            }),
        required: [
            'categoryCodes'
        ]
    },
    gallery: {
        variants: [
            'GRID',
            'CAROUSEL'
        ],
        fields: (c)=>({
                images: c.images(3, 24)
            }),
        required: [
            'images'
        ]
    },
    booking: {
        variants: [
            'INLINE'
        ],
        fields: (c)=>({
                note: c.text(300),
                showCheckInOut: c.bool
            }),
        required: []
    },
    contacts: {
        variants: [
            'PLAIN',
            'WITH_MAP'
        ],
        fields: (c)=>({
                showPhone: c.bool,
                showWhatsapp: c.bool,
                showEmail: c.bool,
                showAddress: c.bool,
                map: (v, p)=>c.obj(v, p, {
                        provider: c.oneOf([
                            'OPENSTREETMAP_LINK'
                        ])
                    }, [
                        'provider'
                    ]),
                directions: c.text(400)
            }),
        required: []
    },
    faq: {
        variants: [
            'ACCORDION',
            'LIST'
        ],
        fields: (c)=>({
                items: (v, p)=>c.arr(v, p, 1, 30, (i, ip)=>c.obj(i, ip, {
                            question: c.text(200),
                            answer: c.text(1000)
                        }, [
                            'question',
                            'answer'
                        ])),
                emitStructuredData: c.bool
            }),
        required: [
            'items'
        ]
    },
    cta: {
        variants: [
            'BANNER',
            'SPLIT'
        ],
        fields: (c)=>({
                action: c.cta,
                text: c.text(300),
                image: c.image
            }),
        required: [
            'action'
        ]
    },
    // ---------- SITE-2: салон, ресторан и общие секции сайта для заявок ----------
    services: {
        variants: [
            'LIST',
            'CARDS'
        ],
        fields: (c)=>({
                items: (v, p)=>{
                    const items = c.arr(v, p, 1, SITE_SPEC_LIMITS.servicesItems, (i, ip)=>c.obj(i, ip, {
                            serviceCode: c.catalogCode,
                            title: c.text(80),
                            description: c.text(300),
                            category: c.text(60),
                            durationMin: c.int(1, 1440),
                            price: c.money,
                            priceFrom: c.bool
                        }, [
                            'serviceCode',
                            'title'
                        ]));
                    uniqueCodes(c, items, p, 'serviceCode', 'duplicate_service', 'Услуга уже есть в секции');
                    (items ?? []).forEach((item)=>{
                        const code = item?.['serviceCode'];
                        if (typeof code === 'string') c.serviceCodes.add(code);
                    });
                },
                showPrices: c.bool,
                showDuration: c.bool,
                groupByCategory: c.bool,
                itemAction: c.cta
            }),
        required: [
            'items'
        ]
    },
    staff: {
        variants: [
            'CARDS',
            'LIST'
        ],
        fields: (c)=>({
                items: (v, p)=>{
                    const items = c.arr(v, p, 1, SITE_SPEC_LIMITS.staffItems, (i, ip)=>c.obj(i, ip, {
                            employeeId: c.uuid,
                            name: c.text(80),
                            specialization: c.text(120),
                            image: c.image
                        }, [
                            'employeeId',
                            'name'
                        ]));
                    uniqueCodes(c, items, p, 'employeeId', 'duplicate_employee', 'Мастер уже есть в секции');
                }
            }),
        required: [
            'items'
        ]
    },
    menu: {
        variants: [
            'LIST',
            'CARDS'
        ],
        fields: (c)=>({
                categories: (v, p)=>{
                    const cats = c.arr(v, p, 1, SITE_SPEC_LIMITS.menuCategories, (cat, cp)=>c.obj(cat, cp, {
                            title: c.text(80),
                            items: (iv, ipath)=>{
                                const items = c.arr(iv, ipath, 1, SITE_SPEC_LIMITS.menuItemsPerCategory, (i, ip)=>c.obj(i, ip, {
                                        itemCode: c.catalogCode,
                                        title: c.text(120),
                                        description: c.text(300),
                                        weightGrams: c.int(1, 100_000),
                                        price: c.money,
                                        image: c.image
                                    }, [
                                        'itemCode',
                                        'title'
                                    ]));
                                uniqueCodes(c, items, ipath, 'itemCode', 'duplicate_menu_item', 'Блюдо уже есть в меню', c.menuCodes);
                            }
                        }, [
                            'title',
                            'items'
                        ]));
                    // блюдо одно на всё меню, а не только в своём разделе
                    const seen = new Set();
                    (cats ?? []).forEach((cat, ci)=>{
                        const items = cat?.['items'];
                        if (!Array.isArray(items)) return;
                        const own = new Set();
                        items.forEach((item, ii)=>{
                            const code = item?.['itemCode'];
                            if (typeof code !== 'string') return;
                            if (seen.has(code) && !own.has(code)) c.fail(`${p}[${ci}].items[${ii}].itemCode`, 'duplicate_menu_item', 'Блюдо уже есть в меню');
                            own.add(code);
                        });
                        own.forEach((code)=>seen.add(code));
                    });
                    const total = (cats ?? []).reduce((n, cat)=>n + (Array.isArray(cat?.['items']) ? cat['items'].length : 0), 0);
                    if (total > SITE_SPEC_LIMITS.menuItems) c.fail(p, 'count', `В меню не больше ${SITE_SPEC_LIMITS.menuItems} блюд`);
                },
                showPhotos: c.bool
            }),
        required: [
            'categories'
        ]
    },
    hours: {
        variants: [
            'TABLE',
            'COMPACT'
        ],
        fields: (c)=>({
                days: (v, p)=>{
                    const days = c.arr(v, p, 1, 7, (d, dp)=>{
                        const day = c.obj(d, dp, {
                            weekday: c.int(0, 6),
                            open: c.clock,
                            close: c.clock
                        }, [
                            'weekday',
                            'open',
                            'close'
                        ]);
                        if (day && typeof day['open'] === 'string' && day['open'] === day['close']) c.fail(join(dp, 'close'), 'invalid_time', 'Время закрытия не равно времени открытия');
                    });
                    const weekdays = (days ?? []).map((d)=>d?.['weekday']);
                    weekdays.forEach((w, i)=>{
                        if (typeof w === 'number' && weekdays.indexOf(w) !== i) c.fail(`${p}[${i}].weekday`, 'duplicate_weekday', 'День недели уже есть');
                    });
                },
                note: c.text(300)
            }),
        required: [
            'days'
        ]
    },
    leadForm: {
        variants: [
            'INLINE',
            'CARD'
        ],
        fields: (c)=>({
                mode: (v, p)=>{
                    const allowed = __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$lead$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SITE_LEAD_MODES_BY_VERTICAL"][c.vertical] ?? __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$lead$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SITE_LEAD_MODES"];
                    c.oneOf(allowed)(v, p);
                },
                note: c.text(300),
                showComment: c.bool,
                submitLabel: c.text(30)
            }),
        required: [
            'mode'
        ]
    }
};
const SITE_SPEC_LIMITS = Object.freeze({
    servicesItems: 60,
    staffItems: 30,
    menuCategories: 30,
    menuItemsPerCategory: 80,
    menuItems: 300
});
/**
 * Какие секции у какого направления (SITE-2). Общие секции (`hero`, `about`, `features`, `gallery`, `contacts`, `faq`,
 * `cta`, `hours`, `leadForm`, `amenities`) есть у всех; номера, цены «от» и виджет брони только у гостиницы; услуги и
 * мастера у салона; меню у ресторана.
 */ const COMMON_SECTIONS = [
    'hero',
    'about',
    'features',
    'amenities',
    'gallery',
    'contacts',
    'faq',
    'cta',
    'hours',
    'leadForm'
];
const SITE_SPEC_SECTIONS_BY_VERTICAL = Object.freeze({
    HOSPITALITY: [
        ...COMMON_SECTIONS,
        'accommodations',
        'pricing',
        'booking'
    ],
    BEAUTY: [
        ...COMMON_SECTIONS,
        'services',
        'staff'
    ],
    FOOD_SERVICE: [
        ...COMMON_SECTIONS,
        'menu'
    ]
});
/** Коды в списке секции не повторяются; найденные коды можно собрать в общий набор документа */ function uniqueCodes(c, items, path, key, code, message, into) {
    const codes = (items ?? []).map((i)=>i?.[key]);
    codes.forEach((value, i)=>{
        if (typeof value !== 'string') return;
        into?.add(value);
        if (codes.indexOf(value) !== i) c.fail(`${path}[${i}].${key}`, code, message);
    });
}
const SITE_SPEC_SECTIONS = Object.freeze(Object.fromEntries(Object.entries(SECTIONS).map(([type, shape])=>[
        type,
        Object.freeze([
            ...shape.variants
        ])
    ])));
function siteSpecSectionFields(type) {
    const shape = SECTIONS[type];
    if (!shape) return null;
    return {
        fields: [
            'heading',
            ...Object.keys(shape.fields(new Checker()))
        ],
        required: [
            'heading',
            ...shape.required
        ]
    };
}
/** Секция по реестру §8; возвращает её идентификатор для проверки ссылок */ function checkSection(c, value, path, booking) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        c.fail(path, 'type', 'Ожидается секция');
        return null;
    }
    const record = value;
    const type = record['type'];
    const shape = typeof type === 'string' ? SECTIONS[type] : undefined;
    if (!shape) {
        c.fail(join(path, 'type'), 'unknown_section', `Секции «${String(type)}» нет в реестре SiteSpec v0`);
        return null;
    }
    c.obj(record, path, {
        id: c.id,
        type: ()=>undefined,
        variant: c.oneOf(shape.variants),
        heading: c.text(80),
        ...shape.fields(c)
    }, [
        'id',
        'type',
        'variant',
        'heading',
        ...shape.required
    ]);
    const variant = record['variant'];
    if (type === 'hero' && variant !== 'TEXT_ONLY' || type === 'about' && variant === 'TEXT_IMAGE') {
        if (record['image'] === undefined) c.fail(join(path, 'image'), 'required', 'Этому варианту нужна картинка');
    }
    if (type === 'cta' && variant !== 'SPLIT' || type === 'hero' && variant === 'TEXT_ONLY') {
        if (record['image'] !== undefined) c.fail(join(path, 'image'), 'not_allowed', 'Этому варианту картинка не нужна');
    }
    if (type === 'contacts' && record['map'] !== undefined) {
        if (variant !== 'WITH_MAP') c.fail(join(path, 'map'), 'not_allowed', 'Карта только у варианта с картой');
        c.mapNeeds.push(join(path, 'map'));
    }
    if (type === 'booking' && booking !== 'WETOP_WIDGET') c.fail(path, 'booking_disabled', 'Секции брони нужна бронь WETOP в интеграциях сайта');
    if (type === 'leadForm' && record['mode'] === 'HOTEL_BOOKING' && booking !== 'WETOP_WIDGET') c.fail(join(path, 'mode'), 'booking_disabled', 'Форме брони номера нужна бронь WETOP в интеграциях сайта');
    if (type === 'leadForm' && record['mode'] === 'BEAUTY_APPOINTMENT') c.appointmentForms.push(join(path, 'mode'));
    const allowed = SITE_SPEC_SECTIONS_BY_VERTICAL[c.vertical];
    if (allowed && !allowed.includes(type)) c.fail(join(path, 'type'), 'section_not_for_vertical', `Секция «${String(type)}» не для этого направления`);
    return typeof record['id'] === 'string' ? record['id'] : null;
}
}),
"[project]/wt-personnel/packages/domain/src/marketing/site-templates.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SITE_TEMPLATES",
    ()=>SITE_TEMPLATES,
    "applySiteTemplate",
    ()=>applySiteTemplate,
    "currentSiteTemplate",
    ()=>currentSiteTemplate,
    "siteTemplateById",
    ()=>siteTemplateById,
    "siteTemplatesFor",
    ()=>siteTemplatesFor,
    "templateSiteSpec",
    ()=>templateSiteSpec
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$builder$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/builder.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$starter$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/starter.ts [app-ssr] (ecmascript)");
;
;
const t = (id, vertical, name, description, theme, sectionOrder, variants)=>({
        id,
        vertical,
        name,
        description,
        direction: {
            id,
            name,
            shortDescription: description,
            theme,
            heroVariant: 'TEXT_ONLY',
            sectionOrder
        },
        variants
    });
const SITE_TEMPLATES = Object.freeze([
    // ---------- гостиница ----------
    t('hotel-classic', 'HOSPITALITY', 'Классический отель', 'Светлый и спокойный: номера карточками, цены «от» и бронь сразу под ними', {
        preset: 'CALM',
        accent: 'TEAL',
        typography: 'MODERN',
        radius: 'SOFT',
        density: 'COMFORTABLE',
        colorScheme: 'LIGHT'
    }, [
        'hero',
        'features',
        'accommodations',
        'pricing',
        'booking',
        'hours',
        'contacts',
        'cta'
    ], {
        features: 'GRID',
        accommodations: 'CARDS',
        hours: 'TABLE',
        cta: 'BANNER'
    }),
    t('hotel-boutique', 'HOSPITALITY', 'Бутик-отель', 'Глубокий премиальный фон, антиква и золото, номера крупными строками', {
        preset: 'NIGHT',
        accent: 'GOLD',
        typography: 'CLASSIC',
        radius: 'SHARP',
        density: 'COMFORTABLE',
        colorScheme: 'LIGHT'
    }, [
        'hero',
        'accommodations',
        'features',
        'pricing',
        'booking',
        'contacts',
        'hours',
        'cta'
    ], {
        features: 'LIST',
        accommodations: 'ROWS',
        hours: 'COMPACT',
        cta: 'BANNER'
    }),
    t('hotel-hostel', 'HOSPITALITY', 'Хостел и апарт', 'Тёплый и плотный: бронь первой, сразу за ней номера и цены', {
        preset: 'WARM',
        accent: 'TERRACOTTA',
        typography: 'ROUNDED',
        radius: 'ROUND',
        density: 'COMPACT',
        colorScheme: 'LIGHT'
    }, [
        'hero',
        'booking',
        'accommodations',
        'pricing',
        'features',
        'contacts',
        'hours',
        'cta'
    ], {
        features: 'GRID',
        accommodations: 'CARDS',
        hours: 'COMPACT',
        cta: 'BANNER'
    }),
    // ---------- салон красоты ----------
    t('beauty-studio', 'BEAUTY', 'Светлая студия', 'Чистый белый сайт: услуги списком с ценой и временем, мастера карточками, запись в блоке', {
        preset: 'CALM',
        accent: 'INDIGO',
        typography: 'MODERN',
        radius: 'SOFT',
        density: 'COMFORTABLE',
        colorScheme: 'LIGHT'
    }, [
        'hero',
        'features',
        'services',
        'staff',
        'leadForm',
        'hours',
        'contacts',
        'cta'
    ], {
        features: 'GRID',
        services: 'LIST',
        staff: 'CARDS',
        leadForm: 'INLINE',
        hours: 'TABLE',
        cta: 'BANNER'
    }),
    t('beauty-boutique', 'BEAUTY', 'Бьюти-бутик', 'Премиальный: тёмный первый экран, антиква, мастера первыми, услуги карточками', {
        preset: 'NIGHT',
        accent: 'GOLD',
        typography: 'CLASSIC',
        radius: 'SHARP',
        density: 'COMFORTABLE',
        colorScheme: 'LIGHT'
    }, [
        'hero',
        'staff',
        'services',
        'features',
        'leadForm',
        'hours',
        'contacts',
        'cta'
    ], {
        features: 'LIST',
        services: 'CARDS',
        staff: 'CARDS',
        leadForm: 'CARD',
        hours: 'COMPACT',
        cta: 'BANNER'
    }),
    t('beauty-express', 'BEAUTY', 'Запись за минуту', 'Тёплый и яркий: форма записи сразу под первым экраном, услуги и мастера компактно', {
        preset: 'WARM',
        accent: 'TERRACOTTA',
        typography: 'ROUNDED',
        radius: 'ROUND',
        density: 'COMPACT',
        colorScheme: 'LIGHT'
    }, [
        'hero',
        'leadForm',
        'services',
        'staff',
        'hours',
        'features',
        'contacts',
        'cta'
    ], {
        features: 'GRID',
        services: 'CARDS',
        staff: 'LIST',
        leadForm: 'CARD',
        hours: 'COMPACT',
        cta: 'BANNER'
    }),
    // ---------- ресторан ----------
    t('food-cafe', 'FOOD_SERVICE', 'Уютное кафе', 'Тёплые тона, меню списком с ценами, бронь стола и часы работы', {
        preset: 'WARM',
        accent: 'FOREST',
        typography: 'ROUNDED',
        radius: 'ROUND',
        density: 'COMFORTABLE',
        colorScheme: 'LIGHT'
    }, [
        'hero',
        'features',
        'menu',
        'leadForm',
        'hours',
        'contacts',
        'cta'
    ], {
        features: 'GRID',
        menu: 'LIST',
        leadForm: 'INLINE',
        hours: 'TABLE',
        cta: 'BANNER'
    }),
    t('food-restaurant', 'FOOD_SERVICE', 'Ресторан', 'Вечерний премиальный стиль: антиква, золото, меню карточками и бронь стола карточкой', {
        preset: 'NIGHT',
        accent: 'GOLD',
        typography: 'CLASSIC',
        radius: 'SHARP',
        density: 'COMFORTABLE',
        colorScheme: 'LIGHT'
    }, [
        'hero',
        'menu',
        'features',
        'leadForm',
        'hours',
        'contacts',
        'cta'
    ], {
        features: 'LIST',
        menu: 'CARDS',
        leadForm: 'CARD',
        hours: 'COMPACT',
        cta: 'BANNER'
    }),
    t('food-delivery', 'FOOD_SERVICE', 'Быстрый заказ', 'Свежий светлый сайт: бронь стола первой, меню компактно, часы рядом', {
        preset: 'COAST',
        accent: 'TEAL',
        typography: 'MODERN',
        radius: 'SOFT',
        density: 'COMPACT',
        colorScheme: 'LIGHT'
    }, [
        'hero',
        'leadForm',
        'menu',
        'hours',
        'features',
        'contacts',
        'cta'
    ], {
        features: 'GRID',
        menu: 'LIST',
        leadForm: 'CARD',
        hours: 'COMPACT',
        cta: 'BANNER'
    })
]);
function siteTemplatesFor(vertical) {
    return SITE_TEMPLATES.filter((s)=>s.vertical === vertical);
}
function siteTemplateById(id) {
    return typeof id === 'string' ? SITE_TEMPLATES.find((s)=>s.id === id) ?? null : null;
}
/**
 * Варианты секций, которые шаблон меняет безопасно: у них нет обязательной картинки, поэтому смена варианта не делает
 * документ неверным. Первый экран и призыв с картинкой остаются как были (фото человека не теряется)
 */ const SAFE_VARIANTS = new Set([
    'features',
    'accommodations',
    'services',
    'staff',
    'menu',
    'leadForm',
    'hours'
]);
function applySiteTemplate(spec, templateId) {
    const tpl = siteTemplateById(templateId);
    if (!tpl) return null;
    const pages = spec?.['pages'] ?? [];
    const home = pages.find((p)=>p['isHome'] === true) ?? pages[0];
    const hero = (home?.['sections'] ?? []).find((s)=>s['type'] === 'hero');
    const keepHero = hero && hero['image'] !== undefined && typeof hero['variant'] === 'string';
    const direction = keepHero ? {
        ...tpl.direction,
        heroVariant: hero['variant']
    } : tpl.direction;
    const next = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$builder$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["applyDesignDirection"])(spec, direction);
    for (const page of next['pages'] ?? [])page['sections'] = (page['sections'] ?? []).map((s)=>{
        const type = String(s['type']);
        const variant = tpl.variants[type];
        return variant && SAFE_VARIANTS.has(type) ? {
            ...s,
            variant
        } : s;
    });
    return next;
}
function currentSiteTemplate(spec, vertical) {
    const theme = JSON.stringify(spec?.['theme'] ?? null);
    return siteTemplatesFor(vertical).find((t)=>JSON.stringify({
            ...spec['theme'],
            ...t.direction.theme
        }) === theme) ?? null;
}
function templateSiteSpec(facts, templateId) {
    const tpl = siteTemplateById(templateId);
    if (!tpl || tpl.vertical !== facts.vertical) return null;
    return applySiteTemplate((0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$starter$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["starterSpecFromFacts"])(facts), tpl.id);
}
}),
"[project]/wt-personnel/packages/domain/src/marketing/starter.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "STARTER_DESIGNS",
    ()=>STARTER_DESIGNS,
    "siteFactsFromBrief",
    ()=>siteFactsFromBrief,
    "starterPhone",
    ()=>starterPhone,
    "starterSpecFromFacts",
    ()=>starterSpecFromFacts,
    "starterText",
    ()=>starterText
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$builder$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/builder.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$spec$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/site-spec.ts [app-ssr] (ecmascript)");
;
;
const PHONE_RE = /^\+[1-9][0-9]{9,14}$/;
function starterText(raw, max) {
    if (typeof raw !== 'string') return null;
    let t = raw// eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/<(?=[A-Za-z/!?])/g, '‹').replace(/\{\{/g, '{ {').replace(/\$\{/g, '$ {').replace(/\s+/g, ' ').trim();
    if (!t) return null;
    const chars = [
        ...t
    ];
    if (chars.length > max) t = `${chars.slice(0, max - 1).join('').trimEnd()}…`;
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$spec$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["plainTextProblem"])(t) ? null : t;
}
function starterPhone(raw) {
    if (typeof raw !== 'string') return null;
    const t = raw.replace(/[\s()-]/g, '');
    return PHONE_RE.test(t) ? t : null;
}
const CODE_RE = /^[A-Za-z0-9_-]{1,64}$/;
const MINOR_RE = /^(?:0|[1-9][0-9]{0,14})$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WORDS = {
    ru: {
        phoneCall: 'Позвонить',
        rooms: 'Номера',
        services: 'Услуги',
        staff: 'Мастера',
        menu: 'Меню',
        hours: 'Часы работы',
        contacts: 'Контакты',
        book: 'Забронировать',
        appoint: 'Записаться',
        table: 'Забронировать стол',
        call: 'Перезвоните мне',
        formHotel: 'Бронирование',
        formBeauty: 'Запись онлайн',
        formTable: 'Бронь стола',
        formCall: 'Оставьте заявку',
        why: 'Почему выбирают нас',
        prices: 'Цены',
        home: 'Главная',
        again: 'Ждём вас',
        capacity: (n)=>`Вместимость: до ${n} ${n === 1 ? 'гостя' : 'гостей'}.`,
        rating: (avg)=>`Оценка ${String(avg).replace('.', ',')} из 5`,
        ratingText: (n)=>`По оценкам гостей: ${n}.`,
        masters: (n)=>`Мастеров: ${n}`,
        mastersText: 'Выберите мастера при записи.',
        servicesN: (n)=>`Услуг: ${n}`,
        servicesText: 'Цены и длительность указаны на сайте.',
        dishes: (n)=>`Блюд в меню: ${n}`,
        dishesText: 'Цены указаны в меню.',
        days: (n)=>`Работаем ${n} ${n === 1 ? 'день' : n < 5 ? 'дня' : 'дней'} в неделю`,
        daysText: 'Часы работы указаны ниже.',
        priceNote: 'Цена зависит от дат. Выберите даты в форме бронирования.',
        hotelSub: 'Онлайн-бронирование без посредников.',
        beautySub: 'Запись онлайн в удобное время.',
        foodSub: 'Меню с ценами и бронь стола онлайн.',
        desc: (name, city)=>city ? `${name}, ${city}.` : `${name}.`
    },
    kk: {
        phoneCall: 'Қоңырау шалу',
        rooms: 'Нөмірлер',
        services: 'Қызметтер',
        staff: 'Шеберлер',
        menu: 'Мәзір',
        hours: 'Жұмыс уақыты',
        contacts: 'Байланыс',
        book: 'Брондау',
        appoint: 'Жазылу',
        table: 'Үстел брондау',
        call: 'Маған қоңырау шалыңыз',
        formHotel: 'Брондау',
        formBeauty: 'Онлайн жазылу',
        formTable: 'Үстел брондау',
        formCall: 'Өтінім қалдырыңыз',
        why: 'Неге бізді таңдайды',
        prices: 'Бағалар',
        home: 'Басты бет',
        again: 'Сізді күтеміз',
        capacity: (n)=>`Сыйымдылығы: ${n} қонаққа дейін.`,
        rating: (avg)=>`Бағасы 5-тен ${String(avg).replace('.', ',')}`,
        ratingText: (n)=>`Қонақтар бағасы бойынша: ${n}.`,
        masters: (n)=>`Шеберлер: ${n}`,
        mastersText: 'Жазылғанда шеберді таңдаңыз.',
        servicesN: (n)=>`Қызметтер: ${n}`,
        servicesText: 'Бағасы мен ұзақтығы сайтта көрсетілген.',
        dishes: (n)=>`Мәзірдегі тағамдар: ${n}`,
        dishesText: 'Бағалар мәзірде көрсетілген.',
        days: (n)=>`Аптасына ${n} күн жұмыс істейміз`,
        daysText: 'Жұмыс уақыты төменде.',
        priceNote: 'Баға күндерге байланысты. Брондау формасында күндерді таңдаңыз.',
        hotelSub: 'Делдалсыз онлайн брондау.',
        beautySub: 'Ыңғайлы уақытқа онлайн жазылу.',
        foodSub: 'Бағасы бар мәзір және онлайн үстел брондау.',
        desc: (name, city)=>city ? `${name}, ${city}.` : `${name}.`
    },
    en: {
        phoneCall: 'Call us',
        rooms: 'Rooms',
        services: 'Services',
        staff: 'Our team',
        menu: 'Menu',
        hours: 'Opening hours',
        contacts: 'Contacts',
        book: 'Book now',
        appoint: 'Book a visit',
        table: 'Book a table',
        call: 'Call me back',
        formHotel: 'Booking',
        formBeauty: 'Book online',
        formTable: 'Table booking',
        formCall: 'Leave a request',
        why: 'Why guests choose us',
        prices: 'Prices',
        home: 'Home',
        again: 'We look forward to seeing you',
        capacity: (n)=>`Sleeps up to ${n} ${n === 1 ? 'guest' : 'guests'}.`,
        rating: (avg)=>`Rated ${avg} out of 5`,
        ratingText: (n)=>`Based on ${n} guest ratings.`,
        masters: (n)=>`Specialists: ${n}`,
        mastersText: 'Choose a specialist when booking.',
        servicesN: (n)=>`Services: ${n}`,
        servicesText: 'Prices and duration are listed on the site.',
        dishes: (n)=>`Dishes on the menu: ${n}`,
        dishesText: 'Prices are listed in the menu.',
        days: (n)=>`Open ${n} ${n === 1 ? 'day' : 'days'} a week`,
        daysText: 'Opening hours are listed below.',
        priceNote: 'The price depends on dates. Choose dates in the booking form.',
        hotelSub: 'Book online directly.',
        beautySub: 'Book online at a convenient time.',
        foodSub: 'Menu with prices and online table booking.',
        desc: (name, city)=>city ? `${name}, ${city}.` : `${name}.`
    }
};
const STARTER_DESIGNS = Object.freeze([
    {
        id: 'light-minimal',
        name: 'Светлый минимал',
        shortDescription: 'Белый фон, строгий шрифт, много воздуха',
        theme: {
            preset: 'CALM',
            accent: 'GRAPHITE',
            typography: 'MODERN',
            radius: 'SHARP',
            density: 'COMFORTABLE',
            colorScheme: 'LIGHT'
        },
        heroVariant: 'TEXT_ONLY',
        sectionOrder: []
    },
    {
        id: 'deep-premium',
        name: 'Глубокий премиум',
        shortDescription: 'Холодный фон, классический шрифт, золотой акцент',
        theme: {
            preset: 'NIGHT',
            accent: 'GOLD',
            typography: 'CLASSIC',
            radius: 'SOFT',
            density: 'COMFORTABLE',
            colorScheme: 'LIGHT'
        },
        heroVariant: 'TEXT_ONLY',
        sectionOrder: []
    },
    {
        id: 'bright-warm',
        name: 'Яркий тёплый',
        shortDescription: 'Тёплый фон, терракотовый акцент, мягкие углы',
        theme: {
            preset: 'WARM',
            accent: 'TERRACOTTA',
            typography: 'ROUNDED',
            radius: 'ROUND',
            density: 'COMPACT',
            colorScheme: 'LIGHT'
        },
        heroVariant: 'TEXT_ONLY',
        sectionOrder: []
    }
]);
const STRUCTURED = {
    HOSPITALITY: 'HOTEL',
    BEAUTY: 'BEAUTY_SALON',
    FOOD_SERVICE: 'RESTAURANT'
};
const LEAD_MODE = {
    HOSPITALITY: 'HOTEL_BOOKING',
    BEAUTY: 'BEAUTY_APPOINTMENT',
    FOOD_SERVICE: 'TABLE_RESERVATION'
};
const money = (item)=>item.price && MINOR_RE.test(item.price.minor) && /^[A-Z]{3}$/.test(item.price.currency) ? {
        minor: item.price.minor,
        currency: item.price.currency
    } : undefined;
function starterSpecFromFacts(facts, design, options = {}) {
    const l = options.locale ?? 'ru';
    const w = WORDS[l];
    const t = (value)=>({
            [l]: value
        });
    const v = facts.vertical;
    const name = starterText(facts.location.name, 80) ?? w.home;
    const address = starterText(facts.location.address, 200);
    const city = starterText(facts.location.city, 60);
    const phone = starterPhone(facts.location.phone);
    const whatsapp = starterPhone(facts.location.whatsapp);
    const items = facts.catalog.items.filter((i)=>CODE_RE.test(i.code) && starterText(i.name, 80));
    const sections = [];
    const nav = [];
    const section = (s, navLabel)=>{
        sections.push(s);
        if (navLabel && nav.length < 5) nav.push({
            label: t(navLabel),
            target: {
                kind: 'SECTION',
                pageId: 'page-home',
                sectionId: s['id']
            }
        });
    };
    const bookLabel = v === 'HOSPITALITY' ? w.book : v === 'BEAUTY' ? items.length ? w.appoint : w.call : w.table;
    const book = {
        label: t(bookLabel),
        action: {
            kind: 'BOOK'
        }
    };
    section({
        id: 'sec-hero',
        type: 'hero',
        variant: 'TEXT_ONLY',
        heading: t(name),
        subheading: t(v === 'HOSPITALITY' ? w.hotelSub : v === 'BEAUTY' ? w.beautySub : w.foodSub),
        primaryAction: book,
        ...phone ? {
            secondaryAction: {
                label: t(w.phoneCall),
                action: {
                    kind: 'PHONE'
                }
            }
        } : {}
    });
    // «почему мы» только из чисел данных; меньше двух фактов: секции нет (features требует от двух пунктов)
    const why = [];
    if (facts.reviews && facts.reviews.count > 0) why.push({
        icon: 'STAR',
        title: t(w.rating(facts.reviews.avg)),
        text: t(w.ratingText(facts.reviews.count))
    });
    if (v === 'BEAUTY' && facts.staff.length) why.push({
        icon: 'FAMILY',
        title: t(w.masters(facts.staff.length)),
        text: t(w.mastersText)
    });
    if (v === 'BEAUTY' && items.length) why.push({
        icon: 'CLOCK',
        title: t(w.servicesN(items.length)),
        text: t(w.servicesText)
    });
    if (v === 'FOOD_SERVICE' && items.length) why.push({
        icon: 'KITCHEN',
        title: t(w.dishes(items.length)),
        text: t(w.dishesText)
    });
    const openDays = new Set(facts.hours.days.map((d)=>d.weekday)).size;
    if (v !== 'HOSPITALITY' && openDays) why.push({
        icon: 'CLOCK',
        title: t(w.days(openDays)),
        text: t(w.daysText)
    });
    if (why.length >= 2) section({
        id: 'sec-why',
        type: 'features',
        variant: 'GRID',
        heading: t(w.why),
        items: why.slice(0, 4)
    });
    if (v === 'HOSPITALITY' && items.length) {
        const cards = items.slice(0, 20).map((i)=>({
                categoryCode: i.code,
                title: t(starterText(i.name, 60)),
                description: t(typeof i.capacityAdults === 'number' && i.capacityAdults > 0 ? w.capacity(i.capacityAdults) : starterText(i.name, 400))
            }));
        section({
            id: 'sec-rooms',
            type: 'accommodations',
            variant: 'CARDS',
            heading: t(w.rooms),
            items: cards,
            showLiveCapacity: true,
            showFromPrice: true
        }, w.rooms);
        section({
            id: 'sec-prices',
            type: 'pricing',
            variant: 'FROM_PRICES',
            heading: t(w.prices),
            categoryCodes: cards.map((c)=>c.categoryCode),
            note: t(w.priceNote)
        });
    }
    if (v === 'BEAUTY' && items.length) {
        const list = items.slice(0, 60).map((i)=>{
            const price = money(i);
            const category = starterText(i.category, 60);
            return {
                serviceCode: i.code,
                title: t(starterText(i.name, 80)),
                ...category ? {
                    category: t(category)
                } : {},
                ...typeof i.durationMin === 'number' && Number.isInteger(i.durationMin) && i.durationMin > 0 && i.durationMin <= 1440 ? {
                    durationMin: i.durationMin
                } : {},
                ...price ? {
                    price
                } : {}
            };
        });
        const grouped = list.some((i)=>'category' in i);
        section({
            id: 'sec-services',
            type: 'services',
            variant: 'LIST',
            heading: t(w.services),
            items: list,
            showPrices: true,
            showDuration: true,
            groupByCategory: grouped
        }, w.services);
    }
    if (v === 'BEAUTY') {
        const staff = facts.staff.filter((s)=>UUID_RE.test(s.id) && starterText(s.name, 80)).slice(0, 30).map((s)=>{
            const spec = starterText(s.specialization, 120);
            return {
                employeeId: s.id.toLowerCase(),
                name: t(starterText(s.name, 80)),
                ...spec ? {
                    specialization: t(spec)
                } : {}
            };
        });
        if (staff.length) section({
            id: 'sec-staff',
            type: 'staff',
            variant: 'CARDS',
            heading: t(w.staff),
            items: staff
        }, w.staff);
    }
    if (v === 'FOOD_SERVICE' && items.length) {
        const categories = [];
        const byTitle = new Map();
        let total = 0;
        for (const i of items){
            if (total >= 300) break;
            const title = starterText(i.category, 80) ?? w.menu;
            let cat = byTitle.get(title);
            if (!cat) {
                if (categories.length >= 30) continue;
                cat = {
                    title: t(title),
                    items: []
                };
                byTitle.set(title, cat);
                categories.push(cat);
            }
            if (cat.items.length >= 80) continue;
            const price = money(i);
            cat.items.push({
                itemCode: i.code,
                title: t(starterText(i.name, 120)),
                ...typeof i.weightGrams === 'number' && Number.isInteger(i.weightGrams) && i.weightGrams > 0 && i.weightGrams <= 100_000 ? {
                    weightGrams: i.weightGrams
                } : {},
                ...price ? {
                    price
                } : {}
            });
            total += 1;
        }
        section({
            id: 'sec-menu',
            type: 'menu',
            variant: 'LIST',
            heading: t(w.menu),
            categories,
            showPhotos: true
        }, w.menu);
    }
    if (v === 'HOSPITALITY') section({
        id: 'sec-booking',
        type: 'booking',
        variant: 'INLINE',
        heading: t(w.formHotel),
        showCheckInOut: true
    });
    else {
        const appointment = v === 'BEAUTY' && items.length > 0;
        const mode = v === 'BEAUTY' ? appointment ? LEAD_MODE.BEAUTY : 'CALLBACK' : LEAD_MODE.FOOD_SERVICE;
        const heading = v === 'BEAUTY' ? appointment ? w.formBeauty : w.formCall : w.formTable;
        section({
            id: 'sec-form',
            type: 'leadForm',
            variant: 'INLINE',
            heading: t(heading),
            mode,
            showComment: true
        });
    }
    const days = facts.hours.days.filter((d)=>Number.isInteger(d.weekday) && d.weekday >= 0 && d.weekday <= 6 && d.open !== d.close);
    const seen = new Set();
    const hours = days.filter((d)=>seen.has(d.weekday) ? false : (seen.add(d.weekday), true));
    if (v !== 'HOSPITALITY' && hours.length) section({
        id: 'sec-hours',
        type: 'hours',
        variant: 'TABLE',
        heading: t(w.hours),
        days: hours.map((d)=>({
                weekday: d.weekday,
                open: d.open,
                close: d.close
            }))
    });
    const hasContacts = !!(phone || whatsapp || address);
    if (hasContacts) section({
        id: 'sec-contacts',
        type: 'contacts',
        variant: 'PLAIN',
        heading: t(w.contacts),
        showPhone: !!phone,
        showWhatsapp: !!whatsapp,
        showEmail: false,
        showAddress: !!address
    }, w.contacts);
    section({
        id: 'sec-cta',
        type: 'cta',
        variant: 'BANNER',
        heading: t(w.again),
        action: book
    });
    const description = starterText(w.desc(name, city), 160);
    const spec = {
        schemaVersion: 'site-spec/0',
        site: {
            vertical: v,
            displayName: t(name),
            defaultLocale: l,
            locales: [
                l
            ],
            contacts: {
                ...phone ? {
                    phone
                } : {},
                ...whatsapp ? {
                    whatsapp
                } : {},
                ...address ? {
                    address: t(address)
                } : {}
            },
            seo: {
                robots: 'INDEX',
                structuredData: {
                    type: STRUCTURED[v],
                    includeAddress: !!address,
                    includeGeo: false
                }
            }
        },
        theme: {
            ...STARTER_DESIGNS[0].theme
        },
        navigation: {
            header: nav,
            headerCta: book,
            mobileBar: {
                book: true,
                whatsapp: !!whatsapp
            },
            footer: []
        },
        pages: [
            {
                id: 'page-home',
                slug: '',
                isHome: true,
                title: t(name),
                seo: {
                    title: t(starterText(name, 60)),
                    description: t(description),
                    index: true,
                    includeInSitemap: true,
                    canonical: 'SELF'
                },
                sections
            }
        ],
        integrations: {
            booking: {
                mode: v === 'HOSPITALITY' ? 'WETOP_WIDGET' : 'NONE'
            },
            analytics: {
                mode: 'WETOP_TRACKER',
                consent: 'NOT_REQUIRED'
            }
        }
    };
    return design ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$builder$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["applyDesignDirection"])(spec, design) : spec;
}
function siteFactsFromBrief(input) {
    const vertical = input.vertical ?? 'HOSPITALITY';
    const items = vertical === 'HOSPITALITY' ? input.accommodations.map((a)=>({
            code: a.categoryCode,
            name: a.name,
            capacityAdults: a.capacityAdults
        })) : vertical === 'BEAUTY' ? (input.services ?? []).map((sv)=>({
            code: sv.code,
            name: sv.name,
            price: {
                minor: sv.priceMinor,
                currency: sv.currency
            },
            durationMin: sv.durationMin,
            ...sv.category ? {
                category: sv.category
            } : {}
        })) : (input.menu ?? []).flatMap((cat)=>cat.items.map((it)=>({
                code: it.code,
                name: it.name,
                price: {
                    minor: it.priceMinor,
                    currency: it.currency
                },
                category: cat.title,
                ...it.weightGrams ? {
                    weightGrams: it.weightGrams
                } : {},
                hasPhoto: it.hasPhoto
            })));
    return {
        vertical,
        location: {
            id: '',
            name: input.identity.displayNameCandidate || input.identity.locationName,
            address: input.identity.address,
            phone: input.identity.phone,
            whatsapp: null,
            city: input.identity.city
        },
        catalog: {
            kind: vertical === 'HOSPITALITY' ? 'rooms' : vertical === 'BEAUTY' ? 'services' : 'menu',
            items
        },
        staff: (input.staff ?? []).map((s)=>({
                id: s.id,
                name: s.name,
                specialization: s.specialization
            })),
        hours: {
            days: input.hours ?? [],
            checkInTime: input.stay.checkInTime,
            checkOutTime: input.stay.checkOutTime
        },
        photosCount: 0,
        reviews: null,
        gaps: []
    };
}
}),
"[project]/wt-personnel/packages/domain/src/onboarding/beauty-readiness.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "beautyReadiness",
    ()=>beautyReadiness
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$beauty$2f$beauty$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/beauty/beauty.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$beauty$2f$schedule$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/beauty/schedule.ts [app-ssr] (ecmascript)");
;
;
function beautyReadiness(input) {
    const services = input.services.flatMap((service)=>{
        const effective = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$beauty$2f$beauty$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["effectiveService"])({
            service,
            locationCurrency: input.currency,
            locationService: service.location
        });
        return effective.sellable && effective.priceMinor >= 0n && Number.isInteger(effective.durationMinutes) && effective.durationMinutes > 0 ? [
            {
                id: service.id,
                duration: effective.durationMinutes
            }
        ] : [];
    });
    const employees = input.employees.filter((e)=>e.active && e.worksHere);
    const links = employees.flatMap((employee)=>services.filter((s)=>employee.serviceIds.includes(s.id)).map((service)=>({
                employee,
                service
            })));
    const chains = links.filter(({ employee, service })=>{
        const parsed = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$beauty$2f$schedule$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["parseWorkingHoursWeek"])({
            intervals: employee.hours
        });
        return parsed.ok && parsed.value.some((h)=>clock(h.timeTo) - clock(h.timeFrom) >= service.duration);
    });
    const steps = [
        {
            id: 'services',
            done: services.length > 0,
            count: services.length,
            reason: 'Добавьте активную услугу и включите её в этом филиале.'
        },
        {
            id: 'masters',
            done: employees.length > 0,
            count: employees.length,
            reason: 'Добавьте действующего мастера этого филиала.'
        },
        {
            id: 'skills',
            done: links.length > 0,
            count: links.length,
            reason: 'Назначьте мастеру пригодную услугу этого филиала.'
        },
        {
            id: 'schedule',
            done: chains.length > 0,
            count: chains.length,
            reason: 'Настройте интервал мастера, в который целиком помещается его услуга.'
        }
    ];
    return {
        ready: input.profileApplied && chains.length > 0,
        steps,
        chain: chains[0] ? {
            employeeId: chains[0].employee.id,
            serviceId: chains[0].service.id
        } : null
    };
}
function clock(value) {
    const [h, m] = value.split(':').map(Number);
    return h * 60 + m;
}
}),
"[project]/wt-personnel/packages/domain/src/onboarding/index.ts [app-ssr] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$onboarding$2f$registry$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/onboarding/registry.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$onboarding$2f$beauty$2d$readiness$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/onboarding/beauty-readiness.ts [app-ssr] (ecmascript)");
;
;
;
}),
"[project]/wt-personnel/packages/domain/src/onboarding/registry.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "moveOnboarding",
    ()=>moveOnboarding,
    "onboardingFlow",
    ()=>onboardingFlow
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$verticals$2f$registry$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/verticals/registry.ts [app-ssr] (ecmascript)");
;
const SHARED_STEPS = [
    {
        id: 'business',
        label: 'Бизнес',
        skippable: false
    },
    {
        id: 'location',
        label: 'Филиал',
        skippable: false
    },
    {
        id: 'review',
        label: 'Проверка',
        skippable: false
    }
];
const FLOWS = {
    HOSPITALITY: {
        vertical: 'HOSPITALITY',
        version: 1,
        steps: [
            {
                id: 'hotel',
                label: 'Номера и цены',
                skippable: true
            }
        ],
        completion: 'Отель настроен'
    },
    BEAUTY: {
        vertical: 'BEAUTY',
        version: 2,
        steps: [
            {
                id: 'welcome',
                label: 'Приветствие',
                skippable: false
            },
            {
                id: 'profile',
                label: 'Основные сведения',
                skippable: false
            },
            {
                id: 'services',
                label: 'Услуги',
                skippable: false
            },
            {
                id: 'masters',
                label: 'Мастера',
                skippable: false
            },
            {
                id: 'skills',
                label: 'Услуги мастеров',
                skippable: false
            },
            {
                id: 'schedule',
                label: 'Рабочее время',
                skippable: false
            },
            {
                id: 'review',
                label: 'Готовность',
                skippable: false
            }
        ],
        completion: 'Салон готов к работе'
    },
    FOOD_SERVICE: {
        vertical: 'FOOD_SERVICE',
        version: 1,
        steps: SHARED_STEPS,
        completion: 'Пилот Food Service подключён. Настройку залов и столов продолжим после активации модуля.'
    }
};
function onboardingFlow(value) {
    const vertical = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$verticals$2f$registry$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["parseBusinessVertical"])(value);
    if (!vertical) throw new Error('Неизвестное направление бизнеса');
    return FLOWS[vertical];
}
function moveOnboarding(flow, currentStep, action) {
    const index = flow.steps.findIndex((step)=>step.id === currentStep);
    if (index < 0) throw new Error('Неизвестный шаг настройки');
    if (action === 'skip' && !flow.steps[index].skippable) throw new Error('Этот шаг нельзя пропустить');
    const next = action === 'back' ? Math.max(0, index - 1) : Math.min(flow.steps.length - 1, index + 1);
    return flow.steps[next].id;
}
}),
"[project]/wt-personnel/packages/domain/src/personnel-revenue.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "REVENUE_PERIODS",
    ()=>REVENUE_PERIODS,
    "parseRevenuePeriod",
    ()=>parseRevenuePeriod,
    "revenueSummary",
    ()=>revenueSummary,
    "revenueWindow",
    ()=>revenueWindow,
    "splitByWeights",
    ()=>splitByWeights
]);
/**
 * «Сколько принёс сотрудник» (решение владельца 20.10.2026, docs/decisions/2026-10-20-personnel-revenue.md):
 * оплачено минус возвраты за день, неделю (с понедельника) или месяц по часам филиала. Деньги только BigInt в тиынах.
 */ var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$web$2d$analytics$2f$metrics$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/web-analytics/metrics.ts [app-ssr] (ecmascript)");
;
const REVENUE_PERIODS = [
    'day',
    'week',
    'month'
];
function parseRevenuePeriod(value) {
    if (value === undefined || value === '') return 'day';
    if (typeof value === 'string' && REVENUE_PERIODS.includes(value)) return value;
    throw new RangeError('Период: day, week или month');
}
const DAY = 86_400_000;
const iso = (t)=>new Date(t).toISOString().slice(0, 10);
const at = (date)=>Date.parse(`${date}T00:00:00Z`);
function revenueWindow(period, now, timezone) {
    const today = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$web$2d$analytics$2f$metrics$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["localDate"])(now, timezone);
    let fromDate = today;
    let toDate = today;
    if (period === 'week') {
        const weekday = (new Date(at(today)).getUTCDay() + 6) % 7; // 0 = понедельник
        fromDate = iso(at(today) - weekday * DAY);
        toDate = iso(at(fromDate) + 6 * DAY);
    } else if (period === 'month') {
        const [y, m] = today.split('-').map(Number);
        fromDate = `${today.slice(0, 7)}-01`;
        toDate = iso(Date.UTC(y, m, 1) - DAY);
    }
    return {
        fromDate,
        toDate,
        from: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$web$2d$analytics$2f$metrics$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["zonedStartOfDay"])(fromDate, timezone),
        toExclusive: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$web$2d$analytics$2f$metrics$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["zonedStartOfDay"])(iso(at(toDate) + DAY), timezone)
    };
}
function splitByWeights(amount, weights) {
    if (weights.length === 0) throw new RangeError('Не на кого делить');
    if (weights.some((w)=>w < 0n)) throw new RangeError('Вес не может быть отрицательным');
    const total = weights.reduce((a, b)=>a + b, 0n);
    const w = total === 0n ? weights.map(()=>1n) : weights;
    const sum = total === 0n ? BigInt(weights.length) : total;
    const sign = amount < 0n ? -1n : 1n;
    const abs = amount * sign;
    const base = w.map((x)=>abs * x / sum);
    const rest = w.map((x, i)=>({
            i,
            r: abs * x % sum
        }));
    let left = abs - base.reduce((a, b)=>a + b, 0n);
    rest.sort((a, b)=>b.r > a.r ? 1 : b.r < a.r ? -1 : a.i - b.i);
    for (const { i } of rest){
        if (left === 0n) break;
        base[i] += 1n;
        left -= 1n;
    }
    return base.map((x)=>x * sign);
}
function revenueSummary(entries) {
    const map = new Map();
    const currencies = [];
    for (const e of entries){
        if (!currencies.includes(e.currency)) currencies.push(e.currency);
        const key = `${e.currency}\u0000${e.employeeId ?? ''}`;
        const row = map.get(key) ?? {
            employeeId: e.employeeId,
            currency: e.currency,
            paid: 0n,
            refunded: 0n
        };
        row.paid += e.paidMinor;
        row.refunded += e.refundedMinor;
        map.set(key, row);
    }
    return currencies.flatMap((currency)=>[
            ...map.values()
        ].filter((r)=>r.currency === currency).sort((a, b)=>{
            if (a.employeeId === null !== (b.employeeId === null)) return a.employeeId === null ? 1 : -1;
            const d = b.paid - b.refunded - (a.paid - a.refunded);
            return d > 0n ? 1 : d < 0n ? -1 : (a.employeeId ?? '').localeCompare(b.employeeId ?? '');
        }).map((r)=>({
                employeeId: r.employeeId,
                currency: r.currency,
                paidMinor: r.paid.toString(),
                refundedMinor: r.refunded.toString(),
                netMinor: (r.paid - r.refunded).toString()
            })));
}
}),
"[project]/wt-personnel/packages/domain/src/property/index.ts [app-ssr] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

/**
 * Реквизиты объекта — OBJECT.md §1 (аудит 07.09.2026). Single-property MVP (ADR-001).
 *
 * Жило в `scripts/imports/src/legacy/property.ts` с первого импорта и осталось там по недосмотру: имя
 * объекта — не часть импорта из Legacy, а то, чем вся система опознаёт свою гостиницу. Тринадцать
 * репозиториев API начинают запрос с `property.findFirst({ where: { name: LUXX_APARTS_PROPERTY.name } })`,
 * то есть зависели от папки импорта чужой системы. После ADR-052 (Legacy больше не источник) это стало
 * прямым препятствием: удалить код импорта нельзя, не уронив API. Перенесено сюда 20.09.2026;
 * прежний путь оставлен реэкспортом, чтобы импортёры и их тесты не переписывать разом.
 */ __turbopack_context__.s([
    "LUXX_APARTS_PROPERTY",
    ()=>LUXX_APARTS_PROPERTY
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$property$2f$settings$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/property/settings.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$property$2f$services$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/property/services.ts [app-ssr] (ecmascript)");
const LUXX_APARTS_PROPERTY = {
    name: 'Luxx Aparts',
    legalName: 'ИП «L.A»',
    // ИИН/БИН здесь не держим: это ИИН физлица-ИП, персональные данные (проверка SECURITY.md 24.09.2026, Н12).
    // Он в записи объекта (`properties.bin`), печатные формы берут его из `/hotel/settings`.
    address: 'Казахстан, Алматы, ул. Толе би, 286/8, 050005',
    timezone: 'Asia/Almaty',
    currency: 'KZT',
    checkInTime: '14:00',
    checkOutTime: '12:00'
};
;
;
}),
"[project]/wt-personnel/packages/domain/src/property/services.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SERVICE_PRICE_MESSAGE",
    ()=>SERVICE_PRICE_MESSAGE,
    "parseServiceInput",
    ()=>parseServiceInput,
    "parseServicePrice",
    ()=>parseServicePrice
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$finance$2f$finance$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/finance/finance.ts [app-ssr] (ecmascript)");
;
const NAME_MAX = 200;
const GROUP_MAX = 100;
const SERVICE_PRICE_MESSAGE = 'Цена — больше нуля, например 700 или 700,50';
const text = (v)=>typeof v === 'string' && v.replace(/\s+/g, ' ').trim() !== '' ? v.replace(/\s+/g, ' ').trim() : null;
function parseServicePrice(v) {
    if (typeof v !== 'string' && typeof v !== 'number') return null;
    const raw = String(v).replace(/[\s\u00a0]/g, '');
    if (!/^\d+(?:[.,]\d{1,2})?$/.test(raw)) return null;
    const minor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$finance$2f$finance$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["parseMoney"])(raw);
    return minor > 0n ? minor : null;
}
function parseServiceInput(raw, opts = {}) {
    if (!raw || typeof raw !== 'object') return {
        ok: false,
        reason: 'Нечего сохранять'
    };
    const body = raw;
    const out = {};
    for (const key of Object.keys(body)){
        const value = body[key];
        switch(key){
            case 'name':
                {
                    const s = text(value);
                    if (s === null) return {
                        ok: false,
                        reason: 'Укажите название услуги',
                        field: 'name'
                    };
                    if (s.length > NAME_MAX) return {
                        ok: false,
                        reason: `Название — не длиннее ${NAME_MAX} знаков`,
                        field: 'name'
                    };
                    out.name = s;
                    break;
                }
            case 'group':
                {
                    if (value !== null && value !== undefined && typeof value !== 'string') return {
                        ok: false,
                        reason: 'Группа — текстом',
                        field: 'group'
                    };
                    const s = text(value);
                    if (s !== null && s.length > GROUP_MAX) return {
                        ok: false,
                        reason: `Группа — не длиннее ${GROUP_MAX} знаков`,
                        field: 'group'
                    };
                    out.group = s;
                    break;
                }
            case 'price':
                {
                    const minor = parseServicePrice(value);
                    if (minor === null) return {
                        ok: false,
                        reason: SERVICE_PRICE_MESSAGE,
                        field: 'price'
                    };
                    out.priceMinor = minor;
                    break;
                }
            case 'active':
                {
                    if (typeof value !== 'boolean') return {
                        ok: false,
                        reason: 'Статус — «активна» или «в архиве»',
                        field: 'active'
                    };
                    out.active = value;
                    break;
                }
            default:
                return {
                    ok: false,
                    reason: `Неизвестное поле: ${key}`
                };
        }
    }
    if (opts.partial) {
        if (Object.keys(out).length === 0) return {
            ok: false,
            reason: 'Нечего сохранять'
        };
        return {
            ok: true,
            value: out
        };
    }
    if (out.name === undefined) return {
        ok: false,
        reason: 'Укажите название услуги',
        field: 'name'
    };
    if (out.priceMinor === undefined) return {
        ok: false,
        reason: 'Укажите цену услуги',
        field: 'price'
    };
    return {
        ok: true,
        value: {
            name: out.name,
            group: out.group ?? null,
            priceMinor: out.priceMinor,
            active: out.active ?? true
        }
    };
}
}),
"[project]/wt-personnel/packages/domain/src/property/settings.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CANCELLATION_RULES",
    ()=>CANCELLATION_RULES,
    "CANCELLATION_RULE_LABELS",
    ()=>CANCELLATION_RULE_LABELS,
    "CHANNEX_PROPERTY_TYPES",
    ()=>CHANNEX_PROPERTY_TYPES,
    "DEPOSIT_RULES",
    ()=>DEPOSIT_RULES,
    "DEPOSIT_RULE_LABELS",
    ()=>DEPOSIT_RULE_LABELS,
    "ONSITE_PAYMENTS",
    ()=>ONSITE_PAYMENTS,
    "ONSITE_PAYMENT_LABELS",
    ()=>ONSITE_PAYMENT_LABELS,
    "PROPERTY_AMENITIES",
    ()=>PROPERTY_AMENITIES,
    "normalizeClockTime",
    ()=>normalizeClockTime,
    "normalizeWebsite",
    ()=>normalizeWebsite,
    "parseHotelSettingsPatch",
    ()=>parseHotelSettingsPatch
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$accounts$2f$registration$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/accounts/registration.ts [app-ssr] (ecmascript)");
;
const ONSITE_PAYMENTS = [
    'CASH_CARD',
    'CASH',
    'CARD',
    'TRANSFER'
];
const CANCELLATION_RULES = [
    'FREE_1D',
    'FREE_3D',
    'FREE_7D',
    'NON_REFUNDABLE'
];
const DEPOSIT_RULES = [
    'NONE',
    'FIRST_NIGHT',
    'HALF',
    'FULL'
];
const ONSITE_PAYMENT_LABELS = {
    CASH_CARD: 'Наличные и карта',
    CASH: 'Только наличные',
    CARD: 'Только карта',
    TRANSFER: 'Банковский перевод'
};
const CANCELLATION_RULE_LABELS = {
    FREE_1D: 'Бесплатная отмена за 1 день',
    FREE_3D: 'Бесплатная отмена за 3 дня',
    FREE_7D: 'Бесплатная отмена за 7 дней',
    NON_REFUNDABLE: 'Без возврата'
};
const DEPOSIT_RULE_LABELS = {
    NONE: 'Без залога',
    FIRST_NIGHT: 'Стоимость первой ночи',
    HALF: '50% от стоимости проживания',
    FULL: '100% от стоимости проживания'
};
const PROPERTY_AMENITIES = [
    {
        code: 'wifi',
        label: 'Wi-Fi'
    },
    {
        code: 'parking',
        label: 'Парковка'
    },
    {
        code: 'air_conditioning',
        label: 'Кондиционер'
    },
    {
        code: 'kitchen',
        label: 'Кухня'
    },
    {
        code: 'transfer',
        label: 'Трансфер'
    },
    {
        code: 'breakfast',
        label: 'Завтрак'
    },
    {
        code: 'laundry',
        label: 'Прачечная'
    },
    {
        code: 'tv',
        label: 'Телевизор'
    },
    {
        code: 'elevator',
        label: 'Лифт'
    },
    {
        code: 'reception_24h',
        label: 'Круглосуточная стойка'
    },
    {
        code: 'luggage_storage',
        label: 'Хранение багажа'
    },
    {
        code: 'workspace',
        label: 'Рабочее место'
    },
    {
        code: 'safe',
        label: 'Сейф'
    },
    {
        code: 'hair_dryer',
        label: 'Фен'
    },
    {
        code: 'iron',
        label: 'Утюг'
    },
    {
        code: 'kettle',
        label: 'Чайник'
    },
    {
        code: 'terrace',
        label: 'Терраса'
    },
    {
        code: 'pool',
        label: 'Бассейн'
    },
    {
        code: 'gym',
        label: 'Тренажёрный зал'
    },
    {
        code: 'sauna',
        label: 'Сауна'
    }
];
const AMENITY_CODES = PROPERTY_AMENITIES.map((a)=>a.code);
const URL_MAX = 300;
const NOTE_MAX = 500;
function normalizeWebsite(v) {
    if (typeof v !== 'string') return null;
    const raw = v.trim();
    if (raw === '' || /\s/.test(raw)) return null;
    const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
    try {
        const url = new URL(withScheme);
        if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
        if (url.username || url.password || !url.hostname.includes('.')) return null;
        return withScheme;
    } catch  {
        return null;
    }
}
const LOCKED = new Set([
    'currency',
    'timezone'
]);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TEXT_MAX = 300;
const CHANNEX_PROPERTY_TYPES = [
    'apart_hotel',
    'apartment',
    'boat',
    'camping',
    'capsule_hotel',
    'chalet',
    'country_house',
    'farm_stay',
    'guest_house',
    'holiday_home',
    'holiday_park',
    'homestay',
    'hostel',
    'hotel',
    'inn',
    'lodge',
    'motel',
    'resort',
    'riad',
    'ryokan'
];
function normalizeClockTime(v) {
    if (typeof v !== 'string') return null;
    const m = /^(\d{1,2})[:.](\d{2})$/.exec(v.trim()) ?? /^(\d{2})(\d{2})$/.exec(v.trim());
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h > 23 || min > 59) return null;
    return `${String(h).padStart(2, '0')}:${m[2]}`;
}
const text = (v)=>{
    if (v === null) return null;
    if (typeof v !== 'string') return null;
    const s = v.replace(/\s+/g, ' ').trim();
    return s === '' ? null : s;
};
/** Текст с абзацами: пробелы в строках схлопываются, переводы строк остаются */ const paragraph = (v)=>{
    if (typeof v !== 'string') return null;
    const s = v.replace(/\r\n?/g, '\n').split('\n').map((line)=>line.replace(/[ \t]+/g, ' ').trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
    return s === '' ? null : s;
};
function parseHotelSettingsPatch(raw) {
    if (!raw || typeof raw !== 'object') return {
        ok: false,
        reason: 'Нечего сохранять'
    };
    const body = raw;
    const out = {};
    for (const key of Object.keys(body)){
        if (LOCKED.has(key)) return {
            ok: false,
            reason: 'Валюту и часовой пояс меняет поддержка WETOP: от них зависят деньги и границы ночей.'
        };
        const value = body[key];
        switch(key){
            case 'name':
                {
                    if (typeof value !== 'string' || !(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$accounts$2f$registration$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["isOrganizationNameShaped"])(value)) return {
                        ok: false,
                        reason: 'Укажите название гостиницы'
                    };
                    out.name = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$accounts$2f$registration$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["normalizeOrganizationName"])(value);
                    break;
                }
            case 'legalName':
            case 'address':
                {
                    const s = text(value);
                    if (s !== null && s.length > TEXT_MAX) return {
                        ok: false,
                        reason: `Не длиннее ${TEXT_MAX} знаков`
                    };
                    out[key] = s;
                    break;
                }
            case 'bin':
                {
                    const s = text(value);
                    if (s !== null && !/^\d{12}$/.test(s)) return {
                        ok: false,
                        reason: 'ИИН/БИН — 12 цифр'
                    };
                    out.bin = s;
                    break;
                }
            case 'phone':
                {
                    const s = text(value);
                    const digits = s?.replace(/\D/g, '').length ?? 0;
                    if (s !== null && (digits < 5 || digits > 15)) return {
                        ok: false,
                        reason: 'Телефон — от 5 до 15 цифр'
                    };
                    out.phone = s;
                    break;
                }
            case 'email':
                {
                    const s = text(value)?.toLowerCase() ?? null;
                    if (s !== null && !EMAIL.test(s)) return {
                        ok: false,
                        reason: 'Почта в виде name@example.kz'
                    };
                    out.email = s;
                    break;
                }
            case 'countryCode':
                {
                    const s = text(value)?.toUpperCase() ?? null;
                    if (s !== null && !/^[A-Z]{2}$/.test(s)) return {
                        ok: false,
                        reason: 'Страна: двухбуквенный код, например KZ'
                    };
                    out.countryCode = s;
                    break;
                }
            case 'city':
                {
                    const s = text(value);
                    if (s !== null && s.length > 100) return {
                        ok: false,
                        reason: 'Город: не длиннее 100 знаков'
                    };
                    out.city = s;
                    break;
                }
            case 'channexPropertyType':
                {
                    const s = text(value);
                    if (s !== null && !CHANNEX_PROPERTY_TYPES.includes(s)) return {
                        ok: false,
                        reason: 'Выберите тип размещения из списка'
                    };
                    out.channexPropertyType = s;
                    break;
                }
            case 'checkInTime':
            case 'checkOutTime':
                {
                    const s = normalizeClockTime(value);
                    if (s === null) return {
                        ok: false,
                        reason: `Время ${key === 'checkInTime' ? 'заезда' : 'выезда'} — в виде 14:00`
                    };
                    out[key] = s;
                    break;
                }
            case 'description':
            case 'houseRulesNote':
                {
                    const s = paragraph(value);
                    if (s !== null && s.length > NOTE_MAX) return {
                        ok: false,
                        reason: `Не длиннее ${NOTE_MAX} знаков`
                    };
                    out[key] = s;
                    break;
                }
            case 'publicName':
                {
                    const s = text(value);
                    if (s !== null && s.length > 200) return {
                        ok: false,
                        reason: 'Публичное имя: не длиннее 200 знаков'
                    };
                    out.publicName = s;
                    break;
                }
            case 'website':
                {
                    if (value === null || typeof value === 'string' && value.trim() === '') {
                        out.website = null;
                        break;
                    }
                    const s = normalizeWebsite(value);
                    if (s === null) return {
                        ok: false,
                        reason: 'Адрес сайта в виде https://example.kz'
                    };
                    if (s.length > URL_MAX) return {
                        ok: false,
                        reason: `Адрес сайта не длиннее ${URL_MAX} знаков`
                    };
                    out.website = s;
                    break;
                }
            case 'earlyCheckIn':
            case 'lateCheckOut':
            case 'childrenAllowed':
            case 'petsAllowed':
            case 'smokingAllowed':
                {
                    if (typeof value !== 'boolean') return {
                        ok: false,
                        reason: `${key}: только да или нет`
                    };
                    out[key] = value;
                    break;
                }
            case 'onsitePayment':
                {
                    if (!ONSITE_PAYMENTS.includes(value)) return {
                        ok: false,
                        reason: 'Выберите способ оплаты на месте из списка'
                    };
                    out.onsitePayment = value;
                    break;
                }
            case 'cancellationRule':
                {
                    if (!CANCELLATION_RULES.includes(value)) return {
                        ok: false,
                        reason: 'Выберите правило отмены из списка'
                    };
                    out.cancellationRule = value;
                    break;
                }
            case 'depositRule':
                {
                    if (!DEPOSIT_RULES.includes(value)) return {
                        ok: false,
                        reason: 'Выберите залог из списка'
                    };
                    out.depositRule = value;
                    break;
                }
            case 'minGuestAge':
                {
                    const n = typeof value === 'number' ? value : typeof value === 'string' && /^\d{1,3}$/.test(value.trim()) ? Number(value) : NaN;
                    if (!Number.isInteger(n) || n < 0 || n > 99) return {
                        ok: false,
                        reason: 'Минимальный возраст гостя: целое от 0 до 99'
                    };
                    out.minGuestAge = n;
                    break;
                }
            case 'quietHoursFrom':
            case 'quietHoursTo':
                {
                    if (value === null || typeof value === 'string' && value.trim() === '') {
                        out[key] = null;
                        break;
                    }
                    const s = normalizeClockTime(value);
                    if (s === null) return {
                        ok: false,
                        reason: 'Тихие часы в виде 22:00'
                    };
                    out[key] = s;
                    break;
                }
            case 'amenities':
                {
                    if (!Array.isArray(value) || value.some((c)=>typeof c !== 'string' || !AMENITY_CODES.includes(c))) return {
                        ok: false,
                        reason: 'Выберите удобства из списка'
                    };
                    const chosen = new Set(value);
                    out.amenities = AMENITY_CODES.filter((c)=>chosen.has(c));
                    break;
                }
            default:
                return {
                    ok: false,
                    reason: `Неизвестное поле: ${key}`
                };
        }
    }
    const quiet = [
        out.quietHoursFrom,
        out.quietHoursTo
    ];
    if ((out.quietHoursFrom !== undefined || out.quietHoursTo !== undefined) && quiet[0] == null !== (quiet[1] == null)) return {
        ok: false,
        reason: 'Тихие часы задаются парой: с какого и до какого времени'
    };
    if (Object.keys(out).length === 0) return {
        ok: false,
        reason: 'Нечего сохранять'
    };
    return {
        ok: true,
        value: out
    };
}
}),
"[project]/wt-personnel/packages/domain/src/rates/discounts.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "MAX_DISCOUNT_PERCENT",
    ()=>MAX_DISCOUNT_PERCENT,
    "assertDerivedRuleAllows",
    ()=>assertDerivedRuleAllows,
    "assertPromoAllows",
    ()=>assertPromoAllows,
    "discountedMinor",
    ()=>discountedMinor,
    "normalizePromoCode",
    ()=>normalizePromoCode,
    "pickDiscount",
    ()=>pickDiscount,
    "validateDerivedRule",
    ()=>validateDerivedRule
]);
/**
 * Производный тариф и промокод — чистые правила (DATA_MODEL §20, ADR-128, срез D4; решения владельца 29.09.2026:
 * Q-233 минимальный набор, Q-231 одна большая скидка без суммирования). Деньги — integer minor units (ADR-008),
 * процент — целый; float не участвует. Ни HTTP, ни Prisma: только числа, даты и слова отказа.
 */ var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$reservations$2f$reservations$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/reservations/reservations.ts [app-ssr] (ecmascript)");
;
const MAX_DISCOUNT_PERCENT = 90;
const isPercent = (value)=>Number.isInteger(value) && value >= 1 && value <= MAX_DISCOUNT_PERCENT;
function discountedMinor(priceMinor, percent) {
    if (!isPercent(percent)) throw new __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$reservations$2f$reservations$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ReservationRuleError"](`Скидка — целое число от 1 до ${MAX_DISCOUNT_PERCENT} процентов`);
    return (priceMinor * BigInt(100 - percent) + 50n) / 100n;
}
function validateDerivedRule(rule) {
    if (!isPercent(rule.discountPercent)) return `Скидка — целое число от 1 до ${MAX_DISCOUNT_PERCENT} процентов`;
    const days = [
        [
            'Раннее бронирование',
            rule.minDaysBeforeArrival
        ],
        [
            'Last minute',
            rule.maxDaysBeforeArrival
        ]
    ];
    for (const [name, value] of days)if (value !== null && (!Number.isInteger(value) || value < 0)) return `${name}: число дней — целое, не меньше нуля`;
    if (rule.minDaysBeforeArrival !== null && rule.maxDaysBeforeArrival !== null && rule.minDaysBeforeArrival > rule.maxDaysBeforeArrival) return 'Окно продаж пустое: «не раньше чем за» больше, чем «не позже чем за»';
    if (rule.minNights !== null && (!Number.isInteger(rule.minNights) || rule.minNights < 1)) return 'Минимум ночей — целое число, не меньше 1';
    return null;
}
const daysBetween = (fromIso, toIso)=>Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);
function assertDerivedRuleAllows(rule, input) {
    const daysBefore = daysBetween(input.today, input.arrivalDate);
    if (daysBefore < 0) throw new __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$reservations$2f$reservations$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ReservationRuleError"](`${input.planName}: заезд ${input.arrivalDate} уже в прошлом`);
    if (rule.minDaysBeforeArrival !== null && daysBefore < rule.minDaysBeforeArrival) throw new __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$reservations$2f$reservations$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ReservationRuleError"](`${input.planName}: заезд не раньше чем через ${rule.minDaysBeforeArrival} дн., до заезда ${daysBefore} дн.`);
    if (rule.maxDaysBeforeArrival !== null && daysBefore > rule.maxDaysBeforeArrival) throw new __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$reservations$2f$reservations$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ReservationRuleError"](`${input.planName}: заезд не позже чем через ${rule.maxDaysBeforeArrival} дн., до заезда ${daysBefore} дн.`);
    if (rule.minNights !== null && input.nights < rule.minNights) throw new __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$reservations$2f$reservations$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ReservationRuleError"](`${input.planName}: минимум ${rule.minNights} ноч., запрошено ${input.nights}`);
}
function normalizePromoCode(raw) {
    const code = raw.trim().toUpperCase();
    return /^[A-Z0-9_-]{3,32}$/.test(code) ? code : null;
}
const previousDay = (iso)=>{
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
};
function assertPromoAllows(promo, stay) {
    if (!promo.active) throw new __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$reservations$2f$reservations$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ReservationRuleError"](`Промокод ${promo.code} не действует`);
    if (promo.maxUses !== null && promo.uses >= promo.maxUses) throw new __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$reservations$2f$reservations$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ReservationRuleError"](`Промокод ${promo.code} исчерпан`);
    const lastNight = previousDay(stay.departureDate);
    if (promo.stayFrom !== null && stay.arrivalDate < promo.stayFrom || promo.stayTo !== null && lastNight > promo.stayTo) throw new __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$reservations$2f$reservations$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ReservationRuleError"](`Промокод ${promo.code} не действует на этот период проживания`);
}
function pickDiscount(planPercent, promoPercent) {
    if (planPercent === null && promoPercent === null) return {
        percent: 0,
        source: null
    };
    if (promoPercent !== null && (planPercent === null || promoPercent > planPercent)) return {
        percent: promoPercent,
        source: 'PROMO'
    };
    return {
        percent: planPercent ?? 0,
        source: 'PLAN'
    };
}
}),
"[project]/wt-personnel/packages/domain/src/rates/index.ts [app-ssr] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$rates$2f$discounts$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/rates/discounts.ts [app-ssr] (ecmascript)");
;
}),
"[project]/wt-personnel/packages/domain/src/reservations/index.ts [app-ssr] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$reservations$2f$reservations$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/reservations/reservations.ts [app-ssr] (ecmascript)");
;
}),
"[project]/wt-personnel/packages/domain/src/reservations/reservations.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "RESERVATION_SOURCES",
    ()=>RESERVATION_SOURCES,
    "ReservationRuleError",
    ()=>ReservationRuleError,
    "RestrictionViolationError",
    ()=>RestrictionViolationError,
    "assertCanAssign",
    ()=>assertCanAssign,
    "assertCanCancel",
    ()=>assertCanCancel,
    "assertCanChangeDates",
    ()=>assertCanChangeDates,
    "assertCanCheckIn",
    ()=>assertCanCheckIn,
    "assertCanCheckOut",
    ()=>assertCanCheckOut,
    "assertCanExtend",
    ()=>assertCanExtend,
    "assertCanNoShow",
    ()=>assertCanNoShow,
    "assertRestrictionsAllow",
    ()=>assertRestrictionsAllow,
    "confirmationNumber",
    ()=>confirmationNumber,
    "deriveReservationStatus",
    ()=>deriveReservationStatus,
    "priceStay",
    ()=>priceStay
]);
/**
 * Ручная бронь — чистые правила (plans/slice-3-step-3-4-manual-reservation.md).
 * Источники правил: DATA_MODEL §2 (статус на проживании, шапка производная), ADR-006, ADR-008.
 * Здесь нет ни HTTP, ни Prisma: только даты, статусы и деньги в minor units.
 */ var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$chessboard$2f$build$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/chessboard/build.ts [app-ssr] (ecmascript)");
;
const RESERVATION_SOURCES = [
    'DESK',
    'PHONE',
    'WHATSAPP',
    'WALK_IN',
    'INSTAGRAM',
    'OTA',
    'WEBSITE'
];
class ReservationRuleError extends Error {
    // тип string, а не литерал: подклассам нужно своё имя в логах
    name = 'ReservationRuleError';
}
class RestrictionViolationError extends ReservationRuleError {
    name = 'RestrictionViolationError';
}
const addDays = (iso, n)=>{
    const x = new Date(`${iso}T00:00:00Z`);
    x.setUTCDate(x.getUTCDate() + n);
    return x.toISOString().slice(0, 10);
};
function priceStay(input) {
    if (input.departureDate <= input.arrivalDate) throw new ReservationRuleError(`Проживание должно содержать хотя бы одну ночь: заезд ${input.arrivalDate}, выезд ${input.departureDate}`);
    const byDate = new Map(input.rates.filter((r)=>r.occupancy === input.occupancy).map((r)=>[
            r.date,
            r.priceMinor
        ]));
    const nights = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$chessboard$2f$build$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["dateRange"])(input.arrivalDate, addDays(input.departureDate, -1)).map((date)=>{
        const priceMinor = byDate.get(date);
        if (priceMinor === undefined) throw new ReservationRuleError(`Нет цены на ночь ${date} (occupancy ${input.occupancy})`);
        return {
            date,
            priceMinor
        };
    });
    return {
        nights,
        totalMinor: nights.reduce((s, n)=>s + n.priceMinor, 0n)
    };
}
const HEADER_PRIORITY = [
    'CHECKED_IN',
    'CONFIRMED',
    'TENTATIVE',
    'CHECKED_OUT',
    'NO_SHOW'
];
function deriveReservationStatus(items) {
    if (items.length === 0) throw new ReservationRuleError('Бронь без проживаний');
    if (items.every((s)=>s === 'CANCELLED')) return 'CANCELLED';
    for (const s of HEADER_PRIORITY)if (items.includes(s)) return s;
    return 'CANCELLED';
}
function assertCanCancel(status) {
    if (status === 'CANCELLED') throw new ReservationRuleError('Проживание уже отменено');
    if (status === 'CHECKED_IN') throw new ReservationRuleError('Гость заселён — отмена невозможна, нужен выезд');
    if (status !== 'TENTATIVE' && status !== 'CONFIRMED') throw new ReservationRuleError(`Отмена невозможна из статуса ${status}`);
}
function assertCanChangeDates(status) {
    if (status !== 'TENTATIVE' && status !== 'CONFIRMED') throw new ReservationRuleError(`Изменение дат невозможно из статуса ${status}`);
}
function assertCanAssign(status) {
    if (status !== 'TENTATIVE' && status !== 'CONFIRMED' && status !== 'CHECKED_IN') throw new ReservationRuleError(`Назначение ячейки невозможно из статуса ${status}`);
}
function assertCanCheckIn(status, hasUnit) {
    if (status === 'CHECKED_IN') throw new ReservationRuleError('Гость уже заселён');
    if (status !== 'TENTATIVE' && status !== 'CONFIRMED') throw new ReservationRuleError(`Заселение невозможно из статуса ${status}`);
    if (!hasUnit) throw new ReservationRuleError('Сначала назначьте ячейку — заселить некуда');
}
function assertCanCheckOut(status) {
    if (status !== 'CHECKED_IN') throw new ReservationRuleError(`Выезд невозможен из статуса ${status}: гость не заселён`);
}
function assertCanNoShow(status) {
    if (status !== 'TENTATIVE' && status !== 'CONFIRMED') throw new ReservationRuleError(`Незаезд невозможен из статуса ${status}`);
}
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function confirmationNumber(now, random = Math.random) {
    const almaty = new Date(now.getTime() + 5 * 3600 * 1000).toISOString().slice(0, 10).replace(/-/g, '');
    let suffix = '';
    for(let i = 0; i < 6; i += 1)suffix += ALPHABET[Math.floor(random() * ALPHABET.length) % ALPHABET.length];
    return `${almaty}-${suffix}`;
}
function assertCanExtend(status) {
    if (status !== 'TENTATIVE' && status !== 'CONFIRMED' && status !== 'CHECKED_IN') throw new ReservationRuleError(`Продление невозможно из статуса ${status}`);
}
function assertRestrictionsAllow(input) {
    if (input.departureDate <= input.arrivalDate) throw new ReservationRuleError(`Проживание должно содержать хотя бы одну ночь: заезд ${input.arrivalDate}, выезд ${input.departureDate}`);
    const byDate = new Map(input.restrictions.map((r)=>[
            r.date,
            r
        ]));
    const where = (date)=>`на ${date}, ${input.categoryName}`;
    const nights = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$chessboard$2f$build$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["dateRange"])(input.arrivalDate, addDays(input.departureDate, -1)).length;
    const newStay = input.soldUntil === undefined;
    const firstUnsold = input.soldUntil && input.soldUntil > input.arrivalDate ? input.soldUntil : input.arrivalDate;
    const arrival = byDate.get(input.arrivalDate);
    if (newStay && arrival?.closedToArrival) throw new RestrictionViolationError(`Закрыт заезд ${where(input.arrivalDate)}`);
    if (newStay && arrival?.minStay != null && nights < arrival.minStay) throw new RestrictionViolationError(`Минимальный срок ${arrival.minStay} ноч. ${where(input.arrivalDate)}: запрошено ${nights} ноч.`);
    if (arrival?.maxStay != null && nights > arrival.maxStay) throw new RestrictionViolationError(`Максимальный срок ${arrival.maxStay} ноч. ${where(input.arrivalDate)}: запрошено ${nights} ноч.`);
    if (firstUnsold < input.departureDate) {
        for (const date of (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$chessboard$2f$build$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["dateRange"])(firstUnsold, addDays(input.departureDate, -1)))if (byDate.get(date)?.stopSell) throw new RestrictionViolationError(`Стоп-продажа ${where(date)}`);
    }
    if (byDate.get(input.departureDate)?.closedToDeparture) throw new RestrictionViolationError(`Закрыт выезд ${where(input.departureDate)}`);
}
}),
"[project]/wt-personnel/packages/domain/src/tasks/index.ts [app-ssr] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$tasks$2f$tasks$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/tasks/tasks.ts [app-ssr] (ecmascript)");
;
}),
"[project]/wt-personnel/packages/domain/src/tasks/tasks.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "TASK_PRIORITIES",
    ()=>TASK_PRIORITIES,
    "parseTaskInput",
    ()=>parseTaskInput,
    "taskBucket",
    ()=>taskBucket
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$property$2f$settings$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/property/settings.ts [app-ssr] (ecmascript)");
;
const TASK_PRIORITIES = [
    'LOW',
    'NORMAL',
    'HIGH'
];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LINKS = [
    'assigneeUserId',
    'guestId'
];
const KNOWN = new Set([
    'title',
    'note',
    'dueDate',
    'dueTime',
    'priority',
    'done',
    'reservationNumber',
    ...LINKS
]);
const isDate = (v)=>typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
const clean = (v)=>typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : null;
function parseTaskInput(body, mode) {
    if (!body || typeof body !== 'object') return {
        ok: false,
        reason: 'Нужен объект с полями задачи'
    };
    const b = body;
    const unknown = Object.keys(b).find((k)=>!KNOWN.has(k));
    if (unknown) return {
        ok: false,
        reason: `Неизвестное поле: ${unknown}`
    };
    if (mode === 'create' && 'done' in b) return {
        ok: false,
        reason: 'Новая задача не бывает сделанной'
    };
    const v = {};
    if ('title' in b || mode === 'create') {
        const t = clean(b['title']);
        if (!t) return {
            ok: false,
            reason: 'Напишите, что сделать'
        };
        if (t.length > 200) return {
            ok: false,
            reason: 'Название — не длиннее 200 знаков'
        };
        v.title = t;
    }
    if ('note' in b) {
        const n = b['note'] === null ? null : typeof b['note'] === 'string' ? b['note'].trim() : undefined;
        if (n === undefined) return {
            ok: false,
            reason: 'Описание — текст'
        };
        if (n !== null && n.length > 2000) return {
            ok: false,
            reason: 'Описание — не длиннее 2000 знаков'
        };
        v.note = n || null;
    }
    if ('dueDate' in b || mode === 'create') {
        if (!isDate(b['dueDate'])) return {
            ok: false,
            reason: 'Срок — дата в виде ГГГГ-ММ-ДД'
        };
        v.dueDate = b['dueDate'];
    }
    if ('dueTime' in b) {
        if (b['dueTime'] === null || b['dueTime'] === '') v.dueTime = null;
        else {
            const t = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$property$2f$settings$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["normalizeClockTime"])(b['dueTime']);
            if (!t) return {
                ok: false,
                reason: 'Время — в виде 14:00 или пусто («весь день»)'
            };
            v.dueTime = t;
        }
    }
    if ('priority' in b || mode === 'create') {
        const p = b['priority'] ?? 'NORMAL';
        if (!TASK_PRIORITIES.includes(p)) return {
            ok: false,
            reason: 'Приоритет — низкий, обычный или высокий'
        };
        v.priority = p;
    }
    for (const k of LINKS)if (k in b) {
        const id = b[k];
        if (id !== null && !(typeof id === 'string' && UUID.test(id))) return {
            ok: false,
            reason: `${k} — идентификатор или null`
        };
        v[k] = id;
    }
    if ('reservationNumber' in b) {
        const n = b['reservationNumber'];
        if (n !== null && !(typeof n === 'string' && n.trim() !== '' && n.length <= 60)) return {
            ok: false,
            reason: 'Номер брони — текст или null'
        };
        v.reservationNumber = n === null ? null : n.trim();
    }
    if ('done' in b) {
        if (typeof b['done'] !== 'boolean') return {
            ok: false,
            reason: 'done — да или нет'
        };
        v.done = b['done'];
    }
    return {
        ok: true,
        value: v
    };
}
function taskBucket(t, today) {
    if (t.done) return 'done';
    return t.dueDate < today ? 'overdue' : t.dueDate === today ? 'today' : 'upcoming';
}
}),
"[project]/wt-personnel/packages/domain/src/verticals/registry.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/** Canonical product contract, independent of database and browser state. */ __turbopack_context__.s([
    "BUSINESS_VERTICALS",
    ()=>BUSINESS_VERTICALS,
    "hasVerticalCapability",
    ()=>hasVerticalCapability,
    "parseBusinessVertical",
    ()=>parseBusinessVertical,
    "verticalDefinition",
    ()=>verticalDefinition
]);
const BUSINESS_VERTICALS = [
    'HOSPITALITY',
    'BEAUTY',
    'FOOD_SERVICE'
];
const DEFINITIONS = Object.freeze({
    HOSPITALITY: Object.freeze({
        id: 'HOSPITALITY',
        label: 'Гостиничный бизнес',
        availability: 'AVAILABLE',
        capabilities: Object.freeze([
            'hospitality.reservations',
            'hospitality.inventory',
            'hospitality.rates',
            'hospitality.channels'
        ])
    }),
    BEAUTY: Object.freeze({
        id: 'BEAUTY',
        label: 'Салон красоты / студия',
        availability: 'PILOT',
        capabilities: Object.freeze([
            'beauty.appointments',
            'beauty.customers',
            'beauty.employees',
            'beauty.services',
            'branch.stock',
            'branch.cash',
            'branch.payroll'
        ])
    }),
    FOOD_SERVICE: Object.freeze({
        id: 'FOOD_SERVICE',
        label: 'Кафе / ресторан',
        availability: 'PILOT',
        capabilities: Object.freeze([
            'food.tableReservations',
            'food.floorPlan',
            'food.tables',
            'food.menu',
            'food.orders',
            'food.staff',
            'food.stock',
            'branch.stock',
            'branch.cash',
            'branch.payroll'
        ])
    })
});
function parseBusinessVertical(value) {
    return typeof value === 'string' && BUSINESS_VERTICALS.some((id)=>id === value) ? value : null;
}
function verticalDefinition(id) {
    return DEFINITIONS[id];
}
function hasVerticalCapability(id, capability) {
    return DEFINITIONS[id].capabilities.includes(capability);
}
}),
"[project]/wt-personnel/packages/domain/src/web-analytics/hit.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Разбор одного события счётчика (план среза 8 §4–5). Приёмник публичный, поэтому всё, что не по форме,
 * отбрасывается молча; что по форме, но длиннее лимита — обрезается. Персональных данных здесь нет по
 * построению: параметры события проходят только через allow-list ключей.
 */ __turbopack_context__.s([
    "EVENT_NAMES",
    ()=>EVENT_NAMES,
    "HIT_LIMITS",
    ()=>HIT_LIMITS,
    "HIT_TYPES",
    ()=>HIT_TYPES,
    "PROP_KEYS",
    ()=>PROP_KEYS,
    "SITE_KEY_RE",
    ()=>SITE_KEY_RE,
    "parseHit",
    ()=>parseHit
]);
const HIT_TYPES = [
    'pageview',
    'ping',
    'leave',
    'event'
];
const EVENT_NAMES = [
    'search',
    'booking_step',
    'phone_click',
    'whatsapp_click',
    'custom'
];
const PROP_KEYS = [
    'arrival',
    'departure',
    'adults',
    'children',
    'category',
    'rate',
    'step'
];
const HIT_LIMITS = {
    body: 4096,
    url: 2048,
    referrer: 2048,
    title: 200,
    language: 16,
    timezone: 64,
    propValue: 64,
    props: 2048
};
const SITE_KEY_RE = /^pms_[0-9a-f]{12}$/;
const CLIENT_KEY_RE = /^[A-Za-z0-9_-]{8,64}$/;
const reject = (reason)=>({
        ok: false,
        reason
    });
function str(v, max) {
    if (typeof v !== 'string') return null;
    const t = v.trim();
    return t.length ? t.slice(0, max) : null;
}
/** Строка не длиннее лимита; длиннее — null (это не поле для обрезки, а мусор). */ function strOrNull(v, max) {
    return typeof v === 'string' && v.length <= max ? str(v, max) : null;
}
function httpUrl(v, max) {
    if (typeof v !== 'string' || v.length > max) return null;
    try {
        const u = new URL(v);
        return u.protocol === 'http:' || u.protocol === 'https:' ? u : null;
    } catch  {
        return null;
    }
}
function props(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const out = {};
    for (const key of PROP_KEYS){
        const v = raw[key];
        if (typeof v === 'string') {
            const t = v.trim().slice(0, HIT_LIMITS.propValue);
            if (t) out[key] = t;
        } else if (typeof v === 'number' && Number.isFinite(v)) out[key] = v;
        else if (typeof v === 'boolean') out[key] = v;
    }
    if (!Object.keys(out).length) return null;
    return JSON.stringify(out).length <= HIT_LIMITS.props ? out : null;
}
function parseHit(raw) {
    let body = raw;
    if (typeof raw === 'string') {
        if (raw.length > HIT_LIMITS.body) return reject('body too large');
        try {
            body = JSON.parse(raw);
        } catch  {
            return reject('body is not JSON');
        }
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return reject('body is not an object');
    }
    const b = body;
    const siteKey = typeof b.k === 'string' && SITE_KEY_RE.test(b.k) ? b.k : null;
    if (!siteKey) return reject('bad site key');
    const visitorKey = typeof b.v === 'string' && CLIENT_KEY_RE.test(b.v) ? b.v : null;
    if (!visitorKey) return reject('bad visitor key');
    const sessionKey = typeof b.s === 'string' && CLIENT_KEY_RE.test(b.s) ? b.s : null;
    if (!sessionKey) return reject('bad session key');
    const type = HIT_TYPES.find((t)=>t === b.t) ?? null;
    if (!type) return reject('bad type');
    const url = httpUrl(b.u, HIT_LIMITS.url);
    if (!url) return reject('bad url');
    let eventName = null;
    if (type === 'event') {
        eventName = EVENT_NAMES.find((n)=>n === b.n) ?? null;
        if (!eventName) return reject('bad event name');
    }
    const width = typeof b.w === 'number' && Number.isFinite(b.w) && b.w >= 0 && b.w <= 10000 ? Math.round(b.w) : null;
    const referrer = httpUrl(b.r, HIT_LIMITS.referrer);
    return {
        ok: true,
        hit: {
            siteKey,
            visitorKey,
            sessionKey,
            type,
            url,
            referrer: referrer ? referrer.toString() : null,
            width,
            language: strOrNull(b.l, HIT_LIMITS.language),
            timezone: strOrNull(b.z, HIT_LIMITS.timezone),
            title: str(b.ti, HIT_LIMITS.title),
            eventName,
            props: type === 'event' ? props(b.p) : null
        }
    };
}
}),
"[project]/wt-personnel/packages/domain/src/web-analytics/index.ts [app-ssr] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

/** Аналитика сайта (DATA_MODEL §11, план среза 8): разбор событий счётчика, источник, устройство, метрики. */ __turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$web$2d$analytics$2f$metrics$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/web-analytics/metrics.ts [app-ssr] (ecmascript)");
;
;
;
;
;
}),
"[project]/wt-personnel/packages/domain/src/web-analytics/metrics.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "BOUNCE_SECONDS",
    ()=>BOUNCE_SECONDS,
    "DATE_RE",
    ()=>DATE_RE,
    "bookingFunnel",
    ()=>bookingFunnel,
    "dailyBreakdown",
    ()=>dailyBreakdown,
    "datesBetween",
    ()=>datesBetween,
    "demandCalendar",
    ()=>demandCalendar,
    "devicesBreakdown",
    ()=>devicesBreakdown,
    "eventsBreakdown",
    ()=>eventsBreakdown,
    "isBounce",
    ()=>isBounce,
    "isIsoDate",
    ()=>isIsoDate,
    "localDate",
    ()=>localDate,
    "monthPeriod",
    ()=>monthPeriod,
    "periodBoundsUtc",
    ()=>periodBoundsUtc,
    "siteReservations",
    ()=>siteReservations,
    "sourcesBreakdown",
    ()=>sourcesBreakdown,
    "summarize",
    ()=>summarize,
    "todayAt",
    ()=>todayAt,
    "topPages",
    ()=>topPages,
    "zonedStartOfDay",
    ()=>zonedStartOfDay
]);
/**
 * Метрики сайта по определениям GA4.
 * (`docs/legacy/analytics-2026-09-12.md`). Считаются по сессиям периода; даты — в часовом поясе объекта.
 */ var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$finance$2f$finance$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/finance/finance.ts [app-ssr] (ecmascript)");
;
const BOUNCE_SECONDS = 10;
const isBounce = (s)=>s.pageviews <= 1 && s.durationSeconds < BOUNCE_SECONDS;
const round2 = (x)=>Math.round(x * 100) / 100;
const ratio = (a, b)=>b === 0 ? 0 : round2(a / b);
function summarize(rows) {
    const sessions = rows.length;
    const pageviews = rows.reduce((n, r)=>n + r.pageviews, 0);
    const duration = rows.reduce((n, r)=>n + r.durationSeconds, 0);
    const mobileSessions = rows.filter((r)=>r.device === 'MOBILE').length;
    const bounces = rows.filter(isBounce).length;
    const bookings = rows.filter((r)=>!!r.reservationId).length;
    return {
        sessions,
        visitors: new Set(rows.map((r)=>r.visitorKey)).size,
        pageviews,
        pagesPerSession: ratio(pageviews, sessions),
        avgDurationSeconds: sessions === 0 ? 0 : Math.round(duration / sessions),
        mobileSessions,
        mobileShare: ratio(mobileSessions, sessions),
        bounces,
        bounceRate: ratio(bounces, sessions),
        bookings
    };
}
// ───────────── даты в часовом поясе объекта ─────────────
const fmtCache = new Map();
function fmt(tz) {
    let f = fmtCache.get(tz);
    if (!f) {
        f = new Intl.DateTimeFormat('en-CA', {
            timeZone: tz,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hourCycle: 'h23'
        });
        fmtCache.set(tz, f);
    }
    return f;
}
function parts(at, tz) {
    const p = Object.fromEntries(fmt(tz).formatToParts(at).map((x)=>[
            x.type,
            x.value
        ]));
    return {
        y: Number(p.year),
        m: Number(p.month),
        d: Number(p.day),
        hh: Number(p.hour),
        mm: Number(p.minute),
        ss: Number(p.second)
    };
}
function localDate(at, tz) {
    const { y, m, d } = parts(at, tz);
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function todayAt(tz, now = new Date()) {
    return localDate(now, tz);
}
/** Смещение пояса в минутах для момента `at` (положительное к востоку от UTC). */ function offsetMinutes(at, tz) {
    const { y, m, d, hh, mm, ss } = parts(at, tz);
    return Math.round((Date.UTC(y, m - 1, d, hh, mm, ss) - at.getTime()) / 60000);
}
function zonedStartOfDay(date, tz) {
    const [y = 0, m = 1, d = 1] = date.split('-').map(Number);
    const guess = Date.UTC(y, m - 1, d);
    const first = new Date(guess - offsetMinutes(new Date(guess), tz) * 60000);
    // второй проход на случай перевода часов ровно в полночь; для Азии/Алматы совпадает с первым
    return new Date(guess - offsetMinutes(first, tz) * 60000);
}
const DAY_MS = 86_400_000;
const isoDay = (t)=>new Date(t).toISOString().slice(0, 10);
const nextDay = (date)=>isoDay(Date.parse(`${date}T00:00:00Z`) + DAY_MS);
function periodBoundsUtc(from, to, tz) {
    return {
        startUtc: zonedStartOfDay(from, tz),
        endUtcExclusive: zonedStartOfDay(nextDay(to), tz)
    };
}
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isIsoDate = (s)=>{
    if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
    const t = Date.parse(`${s}T00:00:00Z`);
    return !Number.isNaN(t) && isoDay(t) === s;
};
function monthPeriod(ym) {
    const [y = 0, m = 1] = ym.split('-').map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return {
        from: `${ym}-01`,
        to: `${ym}-${String(last).padStart(2, '0')}`
    };
}
function datesBetween(from, to) {
    const out = [];
    const end = Date.parse(`${to}T00:00:00Z`);
    for(let t = Date.parse(`${from}T00:00:00Z`); t <= end; t += DAY_MS)out.push(isoDay(t));
    return out;
}
function dailyBreakdown(rows, from, to, tz) {
    const byDate = new Map();
    for (const date of datesBetween(from, to)){
        byDate.set(date, {
            sessions: 0,
            visitors: new Set(),
            pageviews: 0,
            mobile: 0
        });
    }
    for (const r of rows){
        const day = byDate.get(localDate(r.startedAt, tz));
        if (!day) continue;
        day.sessions += 1;
        day.visitors.add(r.visitorKey);
        day.pageviews += r.pageviews;
        if (r.device === 'MOBILE') day.mobile += 1;
    }
    return [
        ...byDate.entries()
    ].map(([date, d])=>({
            date,
            sessions: d.sessions,
            visitors: d.visitors.size,
            pageviews: d.pageviews,
            mobile: d.mobile
        }));
}
function sourcesBreakdown(rows) {
    const groups = new Map();
    for (const r of rows){
        const key = `${r.sourceKind} ${r.source ?? ''}`;
        const g = groups.get(key) ?? {
            kind: r.sourceKind,
            source: r.source,
            rows: []
        };
        g.rows.push(r);
        groups.set(key, g);
    }
    const total = rows.length;
    return [
        ...groups.values()
    ].map((g)=>({
            kind: g.kind,
            source: g.source,
            sessions: g.rows.length,
            visitors: new Set(g.rows.map((r)=>r.visitorKey)).size,
            pageviews: g.rows.reduce((n, r)=>n + r.pageviews, 0),
            avgDurationSeconds: Math.round(g.rows.reduce((n, r)=>n + r.durationSeconds, 0) / g.rows.length),
            share: ratio(g.rows.length, total),
            bookings: g.rows.filter((r)=>!!r.reservationId).length
        })).sort((a, b)=>b.sessions - a.sessions || a.kind.localeCompare(b.kind) || (a.source ?? '').localeCompare(b.source ?? ''));
}
function topPages(pageviews, limit = 20) {
    const counts = new Map();
    for (const p of pageviews)counts.set(p.path, (counts.get(p.path) ?? 0) + 1);
    const total = pageviews.length;
    return [
        ...counts.entries()
    ].map(([path, views])=>({
            path,
            views,
            share: ratio(views, total)
        })).sort((a, b)=>b.views - a.views || a.path.localeCompare(b.path)).slice(0, limit);
}
function demandCalendar(events) {
    const counts = new Map();
    for (const e of events){
        const arrival = e.props && typeof e.props === 'object' ? e.props.arrival : null;
        if (!isIsoDate(arrival)) continue;
        counts.set(arrival, (counts.get(arrival) ?? 0) + 1);
    }
    return [
        ...counts.entries()
    ].map(([arrival, searches])=>({
            arrival,
            searches
        })).sort((a, b)=>a.arrival.localeCompare(b.arrival));
}
function eventsBreakdown(events) {
    const byName = new Map();
    for (const e of events){
        const g = byName.get(e.name) ?? {
            count: 0,
            sessions: new Set()
        };
        g.count += 1;
        g.sessions.add(e.sessionKey);
        byName.set(e.name, g);
    }
    return [
        ...byName.entries()
    ].map(([name, g])=>({
            name,
            count: g.count,
            sessions: g.sessions.size
        })).sort((a, b)=>b.count - a.count || a.name.localeCompare(b.name));
}
function shareRows(rows, pick, limit) {
    const counts = new Map();
    for (const r of rows){
        const k = pick(r);
        counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return [
        ...counts.entries()
    ].map(([key, sessions])=>({
            key,
            sessions,
            share: ratio(sessions, rows.length)
        })).sort((a, b)=>b.sessions - a.sessions || (a.key ?? '\uffff').localeCompare(b.key ?? '\uffff')).slice(0, limit);
}
function devicesBreakdown(rows) {
    return {
        devices: shareRows(rows, (r)=>r.device, 3),
        browsers: shareRows(rows, (r)=>r.browser ?? null, 8),
        os: shareRows(rows, (r)=>r.os ?? null, 8)
    };
}
function bookingFunnel(rows, events) {
    const reached = new Map();
    for (const r of rows)if (r.sessionKey) reached.set(r.sessionKey, r.reservationId ? 3 : 0);
    for (const e of events){
        const at = reached.get(e.sessionKey);
        if (at === undefined) continue;
        const step = e.name === 'search' ? 1 : e.name === 'booking_step' && e.props?.step === 'guest' ? 2 : 0;
        if (step > at) reached.set(e.sessionKey, step);
    }
    const atLeast = (step)=>[
            ...reached.values()
        ].filter((v)=>v >= step).length;
    // сессия без ключа (старые строки) — посещение без шагов
    const visits = rows.length;
    const booked = rows.filter((r)=>!!r.reservationId).length;
    return {
        visits,
        searches: atLeast(1),
        started: atLeast(2),
        booked,
        conversion: visits === 0 ? 0 : Math.round(booked / visits * 10_000) / 10_000
    };
}
function siteReservations(rows) {
    const byCurrency = new Map();
    for (const r of rows){
        const { chargedMinor } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$finance$2f$finance$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["folioBalance"])({
            charges: r.charges,
            allocations: [],
            refunds: []
        });
        byCurrency.set(r.currency, (byCurrency.get(r.currency) ?? 0n) + chargedMinor);
    }
    return {
        count: rows.length,
        cancelled: rows.filter((r)=>r.status === 'CANCELLED').length,
        noShow: rows.filter((r)=>r.status === 'NO_SHOW').length,
        charged: [
            ...byCurrency.entries()
        ].sort(([a], [b])=>a.localeCompare(b)).map(([currency, minor])=>({
                currency,
                chargedMinor: minor.toString()
            }))
    };
}
}),
"[project]/wt-personnel/packages/domain/src/web-booking/from-price.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "FROM_PRICE_WINDOW_NIGHTS",
    ()=>FROM_PRICE_WINDOW_NIGHTS,
    "fromPriceMinor",
    ()=>fromPriceMinor,
    "fromPriceWindow",
    ()=>fromPriceWindow
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$rates$2f$discounts$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/rates/discounts.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$reservations$2f$reservations$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/reservations/reservations.ts [app-ssr] (ecmascript)");
;
;
const FROM_PRICE_WINDOW_NIGHTS = 30;
const plusDays = (date, n)=>{
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
};
function fromPriceWindow(today) {
    return {
        from: today,
        to: plusDays(today, FROM_PRICE_WINDOW_NIGHTS - 1),
        toExclusive: plusDays(today, FROM_PRICE_WINDOW_NIGHTS)
    };
}
function fromPriceMinor(input) {
    const stopped = new Set(input.restrictions.filter((r)=>r.stopSell).map((r)=>r.date));
    const windowRule = input.derived ? {
        ...input.derived.rule,
        minNights: null
    } : null;
    let min = null;
    for(let i = 0; i < FROM_PRICE_WINDOW_NIGHTS; i++){
        const date = plusDays(input.today, i);
        if (stopped.has(date)) continue;
        try {
            if (windowRule) (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$rates$2f$discounts$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["assertDerivedRuleAllows"])(windowRule, {
                planName: input.derived.planName,
                today: input.today,
                arrivalDate: date,
                nights: 1
            });
            const night = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$reservations$2f$reservations$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["priceStay"])({
                arrivalDate: date,
                departureDate: plusDays(date, 1),
                occupancy: input.capacityAdults,
                rates: [
                    ...input.rates
                ]
            });
            if (min === null || night.totalMinor < min) min = night.totalMinor;
        } catch (e) {
            if (!(e instanceof __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$reservations$2f$reservations$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ReservationRuleError"])) throw e;
        }
    }
    return min;
}
}),
"[project]/wt-personnel/packages/domain/src/web-booking/index.ts [app-ssr] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
/** Бронирование с сайта (срез 9): разбор запросов виджета. Правила брони — в reservations и у сервиса. */ var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$web$2d$booking$2f$request$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/web-booking/request.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$web$2d$booking$2f$from$2d$price$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/web-booking/from-price.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$web$2d$booking$2f$site$2d$forms$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/web-booking/site-forms.ts [app-ssr] (ecmascript)");
;
;
;
}),
"[project]/wt-personnel/packages/domain/src/web-booking/request.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "BOOKING_LIMITS",
    ()=>BOOKING_LIMITS,
    "BOOKING_WINDOW",
    ()=>BOOKING_WINDOW,
    "GUEST_LANGS",
    ()=>GUEST_LANGS,
    "normalizePhone",
    ()=>normalizePhone,
    "parseBookingRequest",
    ()=>parseBookingRequest,
    "parseGuestLang",
    ()=>parseGuestLang,
    "parseQuoteRequest",
    ()=>parseQuoteRequest
]);
/**
 * Запросы виджета бронирования с сайта (срез 9, план §4): разбор и проверка формы до того, как она попадёт
 * в правила брони. Бизнес-правила (доступность, цена, ограничения, ячейка) здесь не решаются — это делает
 * `ReservationsService.create`, тот же путь, что у стойки. Здесь только форма: даты в окне, гости, телефон,
 * honeypot против ботов, обрезка длин.
 */ var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$rates$2f$discounts$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/rates/discounts.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$web$2d$analytics$2f$hit$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/web-analytics/hit.ts [app-ssr] (ecmascript)");
;
;
const BOOKING_WINDOW = {
    /** Заезд не позже чем через столько дней от сегодня */ maxLeadDays: 365,
    maxNights: 30,
    maxAdults: 8
};
const BOOKING_LIMITS = {
    name: 80,
    comment: 500,
    email: 120
};
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const CLIENT_KEY_RE = /^[A-Za-z0-9_-]{8,64}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CATEGORY_RE = /^[A-Za-z0-9_-]{1,64}$/;
/** Ключ создания брони (MKT1B BOOK-2): тот же формат, что принимает `ReservationsService.create` */ const CREATION_KEY_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const GUEST_LANGS = [
    'ru',
    'kk',
    'en',
    'zh'
];
function parseGuestLang(v) {
    const head = typeof v === 'string' ? v.trim().toLowerCase().split(/[-_]/)[0] : '';
    if (head === 'kz') return 'kk';
    return GUEST_LANGS.includes(head ?? '') ? head : 'ru';
}
const fail = (reason)=>({
        ok: false,
        reason
    });
const isIso = (s)=>typeof s === 'string' && ISO.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(Date.parse(`${s}T00:00:00Z`)).toISOString().slice(0, 10) === s;
const daysBetween = (a, b)=>Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
function text(v, max) {
    return typeof v === 'string' ? v.trim().slice(0, max) : '';
}
function normalizePhone(raw) {
    if (typeof raw !== 'string') return null;
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 15) return null;
    if (digits.length === 11 && (digits.startsWith('8') || digits.startsWith('7'))) {
        return `+7${digits.slice(1)}`;
    }
    return `+${digits}`;
}
function parseQuoteRequest(raw, today) {
    if (!raw || typeof raw !== 'object') return fail('body is not an object');
    const b = raw;
    const siteKey = typeof b.k === 'string' && __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$web$2d$analytics$2f$hit$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SITE_KEY_RE"].test(b.k) ? b.k : null;
    if (!siteKey) return fail('bad site key');
    if (!isIso(b.arrival) || !isIso(b.departure)) return fail('даты: YYYY-MM-DD');
    const arrivalDate = b.arrival;
    const departureDate = b.departure;
    if (arrivalDate < today) return fail('заезд не раньше сегодняшнего дня');
    if (departureDate <= arrivalDate) return fail('выезд позже заезда');
    if (daysBetween(today, arrivalDate) > BOOKING_WINDOW.maxLeadDays) {
        return fail(`заезд не позже чем через ${BOOKING_WINDOW.maxLeadDays} дней`);
    }
    if (daysBetween(arrivalDate, departureDate) > BOOKING_WINDOW.maxNights) {
        return fail(`не больше ${BOOKING_WINDOW.maxNights} ночей`);
    }
    const adults = Number(b.adults);
    if (!Number.isInteger(adults) || adults < 1 || adults > BOOKING_WINDOW.maxAdults) {
        return fail(`гостей: от 1 до ${BOOKING_WINDOW.maxAdults}`);
    }
    // промокод — необязательное поле; введён, но записан неверно — отказ словами, а не молчаливое «без скидки»
    const promoRaw = typeof b.promo === 'string' ? b.promo.trim() : '';
    const promoCode = promoRaw === '' ? null : (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$rates$2f$discounts$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["normalizePromoCode"])(promoRaw);
    if (promoRaw !== '' && !promoCode) return fail('промокод записан неверно');
    return {
        ok: true,
        value: {
            siteKey,
            arrivalDate,
            departureDate,
            adults,
            promoCode
        }
    };
}
function parseBookingRequest(raw, today) {
    const quote = parseQuoteRequest(raw, today);
    if (!quote.ok) return quote;
    const b = raw;
    // honeypot: поле «website» скрыто от людей, боты его заполняют
    if (typeof b.website === 'string' && b.website.trim() !== '') return fail('honeypot');
    const categoryCode = typeof b.category === 'string' && CATEGORY_RE.test(b.category) ? b.category : null;
    if (!categoryCode) return fail('категория обязательна');
    const g = b.guest && typeof b.guest === 'object' ? b.guest : {};
    const firstName = text(g.firstName, BOOKING_LIMITS.name + 1);
    const lastName = text(g.lastName, BOOKING_LIMITS.name + 1);
    if (!firstName || firstName.length > BOOKING_LIMITS.name) return fail('имя: от 1 до 80 символов');
    if (!lastName || lastName.length > BOOKING_LIMITS.name) return fail('фамилия: от 1 до 80 символов');
    const phone = normalizePhone(g.phone);
    if (!phone) return fail('телефон: не меньше 10 цифр');
    const emailRaw = text(g.email, BOOKING_LIMITS.email + 1).toLowerCase();
    if (emailRaw && (!EMAIL_RE.test(emailRaw) || emailRaw.length > BOOKING_LIMITS.email)) {
        return fail('почта не похожа на адрес');
    }
    // Нет поля: старый виджет (переходный путь). Поле есть, но не UUID v4 (пустое, число, мусор): отказ
    let creationKey = null;
    if (b.creationKey !== undefined && b.creationKey !== null) {
        if (typeof b.creationKey !== 'string' || !CREATION_KEY_RE.test(b.creationKey)) {
            return fail('creationKey: UUID v4');
        }
        creationKey = b.creationKey.toLowerCase();
    }
    const comment = text(b.comment, BOOKING_LIMITS.comment);
    const key = (v)=>typeof v === 'string' && CLIENT_KEY_RE.test(v) ? v : null;
    return {
        ok: true,
        value: {
            ...quote.value,
            categoryCode,
            guest: {
                firstName,
                lastName,
                phone,
                email: emailRaw || null
            },
            comment: comment || null,
            lang: parseGuestLang(b.lang),
            visitorKey: key(b.v),
            sessionKey: key(b.s),
            creationKey
        }
    };
}
}),
"[project]/wt-personnel/packages/domain/src/web-booking/site-forms.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SITE_FORM_LIMITS",
    ()=>SITE_FORM_LIMITS,
    "SITE_LEAD_STATUSES",
    ()=>SITE_LEAD_STATUSES,
    "beautyBookFingerprint",
    ()=>beautyBookFingerprint,
    "foodReserveFingerprint",
    ()=>foodReserveFingerprint,
    "isCalendarDate",
    ()=>isCalendarDate,
    "isSiteLeadStatus",
    ()=>isSiteLeadStatus,
    "parseBeautyBookRequest",
    ()=>parseBeautyBookRequest,
    "parseBeautySlotsQuery",
    ()=>parseBeautySlotsQuery,
    "parseFoodReserveRequest",
    ()=>parseFoodReserveRequest,
    "parseSiteLeadRequest",
    ()=>parseSiteLeadRequest,
    "siteFormFingerprint",
    ()=>siteFormFingerprint,
    "siteLeadFingerprint",
    ()=>siteLeadFingerprint
]);
/**
 * Формы управляемого сайта салона, ресторана и «Перезвоните мне» (SITE-4, SITE-5; ADR-185, план
 * `plans/site-seo-flow-2026-10-15.md` §2). Здесь только разбор формы: ключ сайта, поля, ключ запроса, ловушка для ботов,
 * длины. Свободно ли время, работает ли мастер, принимает ли ресторан брони в этот день, решают правила стойки.
 */ var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:crypto [external] (node:crypto, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$web$2d$analytics$2f$hit$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/web-analytics/hit.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$web$2d$booking$2f$request$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/web-booking/request.ts [app-ssr] (ecmascript)");
;
;
;
const SITE_FORM_LIMITS = {
    name: 100,
    comment: 1000,
    /** Меток перехода не больше и каждая не длиннее */ sourceKeys: 10,
    sourceValue: 300,
    /** Гостей в брони стола с сайта не больше, правило филиала (`max_party_size`) может сузить */ maxPartySize: 50
};
/** Ключ запроса формы: UUID v4, как `creationKey` брони с сайта (MKT1B BOOK-2) */ const REQUEST_KEY_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const INSTANT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;
/** Ключи меток перехода: `utm_source`, `referrer`, `page` и подобные */ const SOURCE_KEY_RE = /^[a-z][a-z0-9_]{0,39}$/;
const fail = (reason)=>({
        ok: false,
        reason
    });
const obj = (raw)=>raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : null;
const text = (v, max)=>typeof v === 'string' ? v.trim().slice(0, max + 1) : '';
function isCalendarDate(v) {
    return typeof v === 'string' && DATE_RE.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
}
function contact(b) {
    const siteKey = typeof b.k === 'string' && __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$web$2d$analytics$2f$hit$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SITE_KEY_RE"].test(b.k) ? b.k : null;
    if (!siteKey) return fail('bad site key');
    // ловушка: поле «website» скрыто от людей, боты его заполняют
    if (typeof b.website === 'string' && b.website.trim() !== '') return fail('honeypot');
    const name = text(b.name, SITE_FORM_LIMITS.name);
    if (!name || name.length > SITE_FORM_LIMITS.name) return fail(`имя: от 1 до ${SITE_FORM_LIMITS.name} символов`);
    const phone = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$web$2d$booking$2f$request$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["normalizePhone"])(b.phone);
    if (!phone) return fail('телефон: не меньше 10 цифр');
    const comment = text(b.comment, SITE_FORM_LIMITS.comment);
    if (comment.length > SITE_FORM_LIMITS.comment) return fail(`комментарий: не больше ${SITE_FORM_LIMITS.comment} символов`);
    if (typeof b.requestKey !== 'string' || !REQUEST_KEY_RE.test(b.requestKey)) return fail('requestKey: UUID v4');
    return {
        ok: true,
        value: {
            siteKey,
            name,
            phone,
            comment: comment || null,
            requestKey: b.requestKey.toLowerCase()
        }
    };
}
function siteFormFingerprint(value) {
    return (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["createHash"])('sha256').update(JSON.stringify(value)).digest('hex');
}
function parseBeautySlotsQuery(raw) {
    const b = obj(raw);
    if (!b) return fail('body is not an object');
    const siteKey = typeof b.k === 'string' && __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$web$2d$analytics$2f$hit$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SITE_KEY_RE"].test(b.k) ? b.k : null;
    if (!siteKey) return fail('bad site key');
    if (typeof b.service !== 'string' || !UUID_RE.test(b.service)) return fail('service: UUID услуги');
    const employee = b.employee === undefined || b.employee === '' ? null : b.employee;
    if (employee !== null && (typeof employee !== 'string' || !UUID_RE.test(employee))) return fail('employee: UUID мастера');
    if (!isCalendarDate(b.date)) return fail('date: YYYY-MM-DD');
    return {
        ok: true,
        value: {
            siteKey,
            serviceId: b.service.toLowerCase(),
            employeeId: employee?.toLowerCase() ?? null,
            date: b.date
        }
    };
}
function parseBeautyBookRequest(raw) {
    const b = obj(raw);
    if (!b) return fail('body is not an object');
    const c = contact(b);
    if (!c.ok) return c;
    if (typeof b.serviceId !== 'string' || !UUID_RE.test(b.serviceId)) return fail('serviceId: UUID услуги');
    const employee = b.employeeId === undefined || b.employeeId === null || b.employeeId === '' ? null : b.employeeId;
    if (employee !== null && (typeof employee !== 'string' || !UUID_RE.test(employee))) return fail('employeeId: UUID мастера');
    if (typeof b.startsAt !== 'string' || !INSTANT_RE.test(b.startsAt) || Number.isNaN(Date.parse(b.startsAt))) return fail('startsAt: время ISO 8601 с поясом');
    return {
        ok: true,
        value: {
            ...c.value,
            serviceId: b.serviceId.toLowerCase(),
            employeeId: employee?.toLowerCase() ?? null,
            startsAt: new Date(b.startsAt)
        }
    };
}
const beautyBookFingerprint = (r)=>siteFormFingerprint([
        'beauty',
        r.serviceId,
        r.employeeId,
        r.startsAt.toISOString(),
        r.name,
        r.phone,
        r.comment
    ]);
function parseFoodReserveRequest(raw) {
    const b = obj(raw);
    if (!b) return fail('body is not an object');
    const c = contact(b);
    if (!c.ok) return c;
    if (!isCalendarDate(b.date)) return fail('date: YYYY-MM-DD');
    if (typeof b.time !== 'string' || !TIME_RE.test(b.time)) return fail('time: ЧЧ:ММ');
    const partySize = Number(b.partySize);
    if (!Number.isInteger(partySize) || partySize < 1 || partySize > SITE_FORM_LIMITS.maxPartySize) return fail(`гостей: от 1 до ${SITE_FORM_LIMITS.maxPartySize}`);
    return {
        ok: true,
        value: {
            ...c.value,
            date: b.date,
            time: b.time,
            partySize
        }
    };
}
const foodReserveFingerprint = (r)=>siteFormFingerprint([
        'food',
        r.date,
        r.time,
        r.partySize,
        r.name,
        r.phone,
        r.comment
    ]);
function parseSiteLeadRequest(raw) {
    const b = obj(raw);
    if (!b) return fail('body is not an object');
    const c = contact(b);
    if (!c.ok) return c;
    const kind = b.kind === undefined ? 'CALLBACK' : b.kind;
    if (kind !== 'CALLBACK' && kind !== 'OTHER') return fail('kind: CALLBACK или OTHER');
    let source = null;
    if (b.source !== undefined && b.source !== null) {
        const s = obj(b.source);
        if (!s) return fail('source: объект меток');
        const entries = Object.entries(s);
        if (entries.length > SITE_FORM_LIMITS.sourceKeys) return fail(`source: не больше ${SITE_FORM_LIMITS.sourceKeys} меток`);
        source = {};
        for (const [k, v] of entries){
            if (!SOURCE_KEY_RE.test(k)) return fail(`source: метка ${k.slice(0, 40)} не подходит`);
            if (typeof v !== 'string') return fail(`source.${k}: строка`);
            source[k] = v.trim().slice(0, SITE_FORM_LIMITS.sourceValue);
        }
        if (!Object.keys(source).length) source = null;
    }
    return {
        ok: true,
        value: {
            ...c.value,
            kind,
            source
        }
    };
}
const siteLeadFingerprint = (r)=>siteFormFingerprint([
        'lead',
        r.kind,
        r.name,
        r.phone,
        r.comment,
        r.source
    ]);
const SITE_LEAD_STATUSES = [
    'NEW',
    'IN_PROGRESS',
    'DONE',
    'SPAM'
];
function isSiteLeadStatus(v) {
    return typeof v === 'string' && SITE_LEAD_STATUSES.includes(v);
}
}),
"[project]/wt-personnel/packages/shared/src/auth-hash.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SessionSecretMissingError",
    ()=>SessionSecretMissingError,
    "hashEquals",
    ()=>hashEquals,
    "hashSecret",
    ()=>hashSecret,
    "newSessionToken",
    ()=>newSessionToken
]);
/**
 * Хэши для входа (срез 13, ADR-046, DATA_MODEL §13): одноразовые коды и ключи сессий хранятся
 * только отпечатком. Утечка базы не должна давать возможности войти.
 *
 * Не простой SHA-256, а HMAC с секретом `SESSION_SECRET`. Причина в длине кода: шестизначных
 * кодов всего миллион, и по голому SHA-256 таблица подбирается за секунды на любом ноутбуке.
 * С HMAC подбор невозможен, пока секрет не утёк вместе с базой, а он живёт в окружении,
 * а не в ней.
 *
 * Это не замена bcrypt для паролей: у нас паролей нет вовсе, а код живёт десять минут и
 * допускает три попытки (`packages/domain/src/accounts/login-code.ts`).
 */ var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:crypto [external] (node:crypto, cjs)");
;
class SessionSecretMissingError extends Error {
    name = 'SessionSecretMissingError';
    constructor(){
        super('SESSION_SECRET не задан в .env — вписывает владелец (openssl rand -hex 32)');
    }
}
function secretFrom(raw) {
    const v = raw?.trim();
    if (!v) throw new SessionSecretMissingError();
    return v;
}
function hashSecret(value, rawSecret = process.env.SESSION_SECRET) {
    return (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["createHmac"])('sha256', secretFrom(rawSecret)).update(value, 'utf8').digest('hex');
}
function hashEquals(a, b) {
    const left = Buffer.from(a, 'utf8');
    const right = Buffer.from(b, 'utf8');
    if (left.length !== right.length) return false;
    return (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["timingSafeEqual"])(left, right);
}
function newSessionToken() {
    return (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["randomBytes"])(32).toString('base64url');
}
}),
"[project]/wt-personnel/packages/shared/src/index.ts [app-ssr] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

/**
 * @pms/shared — общие типы и утилиты без бизнес-логики.
 * Деньги — только integer minor units (ADR-008); float запрещён.
 */ /** Исчерпывающая проверка switch/if по union-типам: компилятор и runtime ловят пропущенный вариант. */ __turbopack_context__.s([
    "assertNever",
    ()=>assertNever
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$shared$2f$src$2f$pii$2d$crypto$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/shared/src/pii-crypto.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$shared$2f$src$2f$pii$2d$residency$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/shared/src/pii-residency.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$shared$2f$src$2f$auth$2d$hash$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/shared/src/auth-hash.ts [app-ssr] (ecmascript)");
function assertNever(value, context = 'assertNever') {
    throw new Error(`${context}: unexpected value ${JSON.stringify(value)}`);
}
;
;
;
;
}),
"[project]/wt-personnel/packages/shared/src/pii-crypto.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "PiiKeyMissingError",
    ()=>PiiKeyMissingError,
    "decryptPii",
    ()=>decryptPii,
    "encryptPii",
    ()=>encryptPii,
    "maskNumber",
    ()=>maskNumber
]);
/**
 * Шифрование персональных данных на покое (SECURITY.md, DATA_MODEL §3: номер документа — не открытой строкой).
 * AES-256-GCM, ключ — `PII_ENCRYPTION_KEY` из окружения (hex 64 символа или любая строка → SHA-256).
 * Формат: `v1:<iv b64>:<tag b64>:<data b64>`. Без ключа — ошибка, а не тихое хранение открытым текстом.
 */ var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:crypto [external] (node:crypto, cjs)");
;
class PiiKeyMissingError extends Error {
    name = 'PiiKeyMissingError';
    constructor(){
        super('PII_ENCRYPTION_KEY не задан в .env — вписывает владелец (openssl rand -hex 32)');
    }
}
function keyFrom(raw) {
    const v = raw?.trim();
    if (!v) throw new PiiKeyMissingError();
    return /^[0-9a-fA-F]{64}$/.test(v) ? Buffer.from(v, 'hex') : (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["createHash"])('sha256').update(v).digest();
}
function encryptPii(plain, rawKey = process.env.PII_ENCRYPTION_KEY) {
    const key = keyFrom(rawKey);
    const iv = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["randomBytes"])(12);
    const cipher = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["createCipheriv"])('aes-256-gcm', key, iv);
    const data = Buffer.concat([
        cipher.update(plain, 'utf8'),
        cipher.final()
    ]);
    return `v1:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${data.toString('base64')}`;
}
function decryptPii(token, rawKey = process.env.PII_ENCRYPTION_KEY) {
    const key = keyFrom(rawKey);
    const [v, iv, tag, data] = token.split(':');
    if (v !== 'v1' || !iv || !tag || !data) throw new Error('Неизвестный формат зашифрованного значения');
    const decipher = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["createDecipheriv"])('aes-256-gcm', key, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([
        decipher.update(Buffer.from(data, 'base64')),
        decipher.final()
    ]).toString('utf8');
}
function maskNumber(plain, visible = 4) {
    const s = plain.replace(/\s+/g, '');
    if (s.length <= visible) return '*'.repeat(s.length);
    return '*'.repeat(s.length - visible) + s.slice(-visible);
}
}),
"[project]/wt-personnel/packages/shared/src/pii-residency.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AnonymizeSaltMissingError",
    ()=>AnonymizeSaltMissingError,
    "deskGuestForStorage",
    ()=>deskGuestForStorage,
    "freeTextForStorage",
    ()=>freeTextForStorage,
    "guestForStorage",
    ()=>guestForStorage,
    "maskAuditFreeText",
    ()=>maskAuditFreeText,
    "maskContacts",
    ()=>maskContacts,
    "piiStorageMode",
    ()=>piiStorageMode,
    "pseudonymSalt",
    ()=>pseudonymSalt,
    "pseudonymizeGuest",
    ()=>pseudonymizeGuest,
    "realPiiAllowed",
    ()=>realPiiAllowed,
    "withoutGuestIdentity",
    ()=>withoutGuestIdentity
]);
/**
 * Где допустимо хранить настоящие персональные данные (ADR-009, ADR-018).
 *
 * Правило объекта: реальные ФИО, телефоны и почта гостей лежат только в production-БД в Казахстане.
 * Пока Q-070 (провайдер и регион БД) не закрыт, рабочая база — Supabase в Сингапуре, и всё, что
 * туда попадает, должно быть псевдонимизировано. Импорт из внешней системы это уже делал; брони, приходящие
 * из каналов живьём, — нет, и клали в сингапурскую базу настоящих гостей.
 *
 * Переключатель один: PII_STORAGE=real разрешает хранить настоящие данные и ставится только на
 * production-БД в РК. Любое другое значение (включая отсутствие) означает псевдонимизацию.
 *
 * Псевдоним детерминирован: одна и та же бронь всегда даёт одного и того же вымышленного гостя,
 * поэтому повторная ревизия не плодит дублей. Обратного преобразования нет: HMAC односторонний,
 * а исходные ФИО и телефон никуда не записываются.
 */ var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:crypto [external] (node:crypto, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$shared$2f$src$2f$text$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/shared/src/text.ts [app-ssr] (ecmascript)");
;
;
class AnonymizeSaltMissingError extends Error {
    name = 'AnonymizeSaltMissingError';
    constructor(){
        super('Нет соли для псевдонимов: задайте ANONYMIZE_SALT в .env (openssl rand -hex 32). ' + 'Захардкоженной соли больше нет — с известной солью псевдоним перебирается по словарю. ' + 'Настоящие ПД разрешает только PII_STORAGE=real (production-БД в РК, Q-070).');
    }
}
function pseudonymSalt(env = process.env) {
    const s = env['ANONYMIZE_SALT'] || env['PII_ENCRYPTION_KEY'] || '';
    if (!s) throw new AnonymizeSaltMissingError();
    return s;
}
function realPiiAllowed(env = process.env) {
    return env['PII_STORAGE'] === 'real';
}
function pseudonymizeGuest(guest, key, salt) {
    if (!salt) throw new AnonymizeSaltMissingError();
    // разделение назначений: та же соль может использоваться и для других производных значений
    const h = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["createHmac"])('sha256', salt).update(`guest-pseudonym\u0000${key}`).digest('hex');
    const digits = String(parseInt(h.slice(0, 8), 16) % 10_000_000).padStart(7, '0');
    return {
        firstName: 'Гость',
        lastName: `Канал-${h.slice(0, 6)}`,
        phone: guest.phone ? `+7000${digits}` : null,
        email: guest.email ? `guest-${h.slice(6, 12)}@example.invalid` : null
    };
}
function guestForStorage(guest, key, env = process.env) {
    // До выбора режима: пустой контакт от канала не должен ни лечь пустой строкой (real),
    // ни превратиться в выдуманный номер у псевдонима — '   ' истинна в JS
    const contacts = {
        ...guest,
        phone: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$shared$2f$src$2f$text$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["blankToNull"])(guest.phone),
        email: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$shared$2f$src$2f$text$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["blankToNull"])(guest.email)
    };
    if (realPiiAllowed(env)) return contacts;
    return pseudonymizeGuest(contacts, key, pseudonymSalt(env));
}
/**
 * Почта в свободном тексте. Совпадение начинается только на границе слова: без этого якоря выражение перебирало каждую
 * позицию длинного слова до конца — квадратичная работа, заметка в 100 КБ маскировалась секунды (аудит 26.09, С-38).
 */ const EMAIL_IN_TEXT = /(?<![\p{L}\p{N}._%+-])[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.\p{L}{2,}/gu;
/** Международный номер: «+», код страны и ещё не меньше шести цифр, с пробелами, скобками, точками и дефисами */ const PHONE_INTL = /(?<![\w+])\+\d[\d\s().-]{6,}\d(?!\w)/g;
/** Казахстанский или российский номер без «+»: 11 цифр на 7 или 8. Номер брони канала после «BDC-» не задевается */ const PHONE_LOCAL = /(?<![\w-])[78][\s(-]*\d{3}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}(?![\w-])/g;
/**
 * Казахстанский мобильный без кода страны: 10 цифр на 700–708, 747, 750–751, 760–764, 771–778 — с пробелами, скобками,
 * дефисами или слитно (аудит 26.09, С-40). Коды — узкие, чтобы не задеть десятизначные номера броней каналов.
 */ const PHONE_KZ_MOBILE = /(?<![\w-])\(?7(?:0[0-8]|47|5[01]|6[0-4]|7[1-8])\)?[\s-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}(?![\w-])/g;
/** 12 цифр подряд — кандидат в ИИН; маскируется, только если сходятся дата рождения и контрольная цифра */ const IIN_CANDIDATE = /(?<![\w-])\d{12}(?![\w-])/g;
/** Контрольная цифра ИИН (алгоритм РК): веса 1…11, при остатке 10 — веса 3…11,1,2; снова 10 — номер негодный */ function isIin(value) {
    const d = [
        ...value
    ].map(Number);
    const month = d[2] * 10 + d[3];
    const day = d[4] * 10 + d[5];
    if (month < 1 || month > 12 || day < 1 || day > 31 || d[6] < 1 || d[6] > 6) return false;
    const sum = (weights)=>d.slice(0, 11).reduce((a, x, i)=>a + x * weights[i], 0) % 11;
    let control = sum([
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11
    ]);
    if (control === 10) control = sum([
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        1,
        2
    ]);
    return control !== 10 && control === d[11];
}
function maskContacts(text) {
    return text.replace(EMAIL_IN_TEXT, '<почта>').replace(PHONE_INTL, '<телефон>').replace(PHONE_LOCAL, '<телефон>').replace(PHONE_KZ_MOBILE, '<телефон>').replace(IIN_CANDIDATE, (m)=>isIin(m) ? '<ИИН>' : m);
}
function freeTextForStorage(text, env = process.env) {
    if (text === null || text === undefined) return null;
    return realPiiAllowed(env) ? text : maskContacts(text);
}
function piiStorageMode(env = process.env) {
    return realPiiAllowed(env) ? 'real' : 'pseudonymized';
}
function deskGuestForStorage(typed, env = process.env) {
    if (realPiiAllowed(env)) return {
        firstName: (typed.firstName ?? '').trim(),
        lastName: (typed.lastName ?? '').trim(),
        middleName: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$shared$2f$src$2f$text$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["blankToNull"])(typed.middleName),
        phone: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$shared$2f$src$2f$text$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["blankToNull"])(typed.phone),
        email: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$shared$2f$src$2f$text$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["blankToNull"])(typed.email)
    };
    return {
        firstName: 'Гость',
        lastName: `Стойка-${(0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["randomBytes"])(3).toString('hex')}`,
        middleName: null,
        phone: null,
        email: null
    };
}
/** Ключи, под которыми в записях журнала лежит гость (карточка брони, ревизия канала) */ const GUEST_KEYS = new Set([
    'primaryGuest',
    'guest',
    'guests',
    'customer'
]);
/**
 * Свободный текст, куда гость и канал пишут что угодно — телефон, почту, имя. В журнале — всегда с маской контактов, и при
 * `PII_STORAGE=real` тоже: в самой записи текст хранится как введён, а журнал только дописывается (проверка исправлений 26.09)
 */ const FREE_TEXT_KEYS = new Set([
    'notes',
    'note',
    'comment',
    'reason'
]);
/** Что о госте журналу можно знать: кто это (id) и для отчётов eQonaq — гражданство. Имени и контактов нет */ const GUEST_AUDIT_FIELDS = new Set([
    'id',
    'citizenship',
    'isPrimary'
]);
const keepGuestIdentityOut = (guest)=>{
    if (guest === null || typeof guest !== 'object') return null;
    return Object.fromEntries(Object.entries(guest).filter(([k])=>GUEST_AUDIT_FIELDS.has(k)));
};
function maskAuditFreeText(value) {
    if (Array.isArray(value)) return value.map(maskAuditFreeText);
    if (value === null || typeof value !== 'object' || value instanceof Date) return value;
    return Object.fromEntries(Object.entries(value).map(([k, v])=>[
            k,
            FREE_TEXT_KEYS.has(k) && typeof v === 'string' ? maskContacts(v) : maskAuditFreeText(v)
        ]));
}
function withoutGuestIdentity(value) {
    if (Array.isArray(value)) return value.map(withoutGuestIdentity);
    if (value === null || typeof value !== 'object' || value instanceof Date) return value;
    return Object.fromEntries(Object.entries(value).map(([k, v])=>[
            k,
            GUEST_KEYS.has(k) ? Array.isArray(v) ? v.map(keepGuestIdentityOut) : keepGuestIdentityOut(v) : FREE_TEXT_KEYS.has(k) && typeof v === 'string' ? maskContacts(v) : withoutGuestIdentity(v)
        ]));
}
}),
"[project]/wt-personnel/packages/shared/src/text.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Необязательное текстовое поле из внешнего источника: обрезать края, пустое и пробелы — NULL.
 *
 * внешние системы присылают отсутствующие значения пустой строкой. Строка из пробелов истинна в JS,
 * и проверка «есть / нет» её пропускает — так 12.09.2026 гражданство '   ' прошло заселение. «Нет значения»
 * в базе хранится только как NULL; нормализуем на входе, а не в каждом месте чтения.
 */ __turbopack_context__.s([
    "blankToNull",
    ()=>blankToNull
]);
function blankToNull(value) {
    const trimmed = (value ?? '').trim();
    return trimmed === '' ? null : trimmed;
}
}),
];

//# sourceMappingURL=wt-personnel_packages_0gdjj8-._.js.map