(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push(["chunks/[root-of-the-server]__0esx-ma._.js",
"[externals]/node:async_hooks [external] (node:async_hooks, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("node:async_hooks", () => require("node:async_hooks"));

module.exports = mod;
}),
"[externals]/node:buffer [external] (node:buffer, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("node:buffer", () => require("node:buffer"));

module.exports = mod;
}),
"[project]/wt-personnel/apps/web/src/lib/security-headers.ts [middleware-edge] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Заголовки безопасности стойки (аудит 29.09.2026, SEC-4). Ставит их `middleware.ts` на каждый ответ страницы.
 *
 * Принудительно — только то, что не может сломать страницу: запрет встраивания во фрейм (кликджекинг формы входа и
 * действий), `nosniff`, referrer без пути. Полная политика CSP идёт в режиме report-only: нарушения видны в консоли
 * браузера, страницы не ломаются. Inline-скрипты (тема, гидратация Next) пока разрешены — без nonce политика их
 * не отличит; строгая политика — отдельным шагом после недели без нарушений и приёмника отчётов.
 *
 * HSTS здесь не ставится: он липкий и включается в Cloudflare на зоне, по решению владельца.
 */ __turbopack_context__.s([
    "securityHeaders",
    ()=>securityHeaders
]);
/** Происхождение адреса, только http(s): `javascript:` и `data:` в политику не попадают */ function httpOrigin(url) {
    if (!url) return null;
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.origin : null;
    } catch  {
        return null;
    }
}
function securityHeaders(env) {
    const assistant = httpOrigin(env.assistantUrl);
    const withAssistant = (base)=>assistant ? `${base} ${assistant}` : base;
    const reportOnly = [
        "default-src 'self'",
        withAssistant("script-src 'self' 'unsafe-inline'"),
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        withAssistant("connect-src 'self'"),
        // окно Channex раздела «Каналы» (ADR-140, channel-iframe.md): подключение канала внутри стойки
        "frame-src 'self' https://staging.channex.io https://app.channex.io",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'"
    ].join('; ');
    return {
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Content-Security-Policy': "frame-ancestors 'none'",
        'Content-Security-Policy-Report-Only': reportOnly
    };
}
}),
"[project]/wt-personnel/apps/web/src/lib/session-cookie.ts [middleware-edge] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Кука сессии стойки без обращения к `next/headers`: эти же значения нужны посреднику (middleware),
 * который работает не в серверном запросе Node и `next/headers` там нет.
 */ __turbopack_context__.s([
    "SESSION_COOKIE",
    ()=>SESSION_COOKIE,
    "SESSION_MAX_AGE_SECONDS",
    ()=>SESSION_MAX_AGE_SECONDS,
    "cookieSecure",
    ()=>cookieSecure
]);
const SESSION_COOKIE = 'wetop_session';
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
function cookieSecure(env) {
    return env.APP_URL?.trim().startsWith('https://') ?? false;
}
}),
"[project]/wt-personnel/apps/web/src/lib/settings-request-diagnostics.ts [middleware-edge] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/** Pure, Edge-compatible diagnostic projections: never serialize request or error objects. */ __turbopack_context__.s([
    "SETTINGS_DIAGNOSTIC_HEADER",
    ()=>SETTINGS_DIAGNOSTIC_HEADER,
    "callerFrames",
    ()=>callerFrames,
    "diagnosticId",
    ()=>diagnosticId,
    "diagnosticsEnabled",
    ()=>diagnosticsEnabled,
    "incomingEvent",
    ()=>incomingEvent,
    "routeClass",
    ()=>routeClass,
    "settingsRequest",
    ()=>settingsRequest,
    "transportEvent",
    ()=>transportEvent
]);
const SETTINGS_DIAGNOSTIC_HEADER = 'x-wetop-settings-diag';
function diagnosticsEnabled(env) {
    if (env.NODE_ENV === 'production') return false;
    return env.CI === 'true' && env.APP_UI_TEST === '1' && env.WETOP_DIAG_HOTEL_SETTINGS === '1';
}
function diagnosticId(raw) {
    return raw && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw) ? raw : 'unbound';
}
function settingsRequest(path, method = 'GET') {
    return path === '/hotel/settings' && method === 'GET';
}
function routeClass(path) {
    const pathname = path.split('?')[0] ?? '';
    if (pathname === '/today') return 'today';
    if (pathname === '/chessboard') return 'chessboard';
    if (pathname.startsWith('/_next/static/') || pathname.startsWith('/_next/image') || [
        '/favicon.ico',
        '/icon.svg'
    ].includes(pathname)) return 'static';
    return 'other';
}
const SOURCES = [
    'lib/api.ts',
    'lib/hotel-api.ts',
    'lib/workspace-context.ts',
    'app/layout.tsx',
    'app/onboarding-gate.tsx',
    'app/today/page.tsx',
    'app/today/hospitality-today.tsx'
];
function callerFrames(stack) {
    // Return constants only, not arbitrary function names, paths, line text or error messages.
    return SOURCES.filter((source)=>stack?.split('\n').slice(1).some((line)=>line.includes(`/apps/web/src/${source}:`) || line.includes(`/src/${source}:`)));
}
function incomingEvent(id, path, rsc, prefetch, ms = Date.now()) {
    return {
        event: 'settings-diag-incoming',
        id: diagnosticId(id),
        utc: new Date(ms).toISOString(),
        ms,
        route: routeClass(path),
        rsc,
        prefetch
    };
}
function transportEvent(id, phase, callers, status, ms = Date.now()) {
    return {
        event: 'settings-diag-transport',
        id: diagnosticId(id),
        utc: new Date(ms).toISOString(),
        ms,
        phase,
        callers: callers.filter((source)=>SOURCES.includes(source)),
        ...phase === 'end' && Number.isInteger(status) && status >= 100 && status <= 599 ? {
            status
        } : {}
    };
}
}),
"[project]/wt-personnel/apps/web/src/middleware.ts [middleware-edge] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "config",
    ()=>config,
    "middleware",
    ()=>middleware
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$esm$2f$api$2f$server$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/esm/api/server.js [middleware-edge] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$spec$2d$extension$2f$response$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/esm/server/web/spec-extension/response.js [middleware-edge] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$security$2d$headers$2e$ts__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/security-headers.ts [middleware-edge] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$session$2d$cookie$2e$ts__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/session-cookie.ts [middleware-edge] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$settings$2d$request$2d$diagnostics$2e$ts__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/settings-request-diagnostics.ts [middleware-edge] (ecmascript)");
;
;
;
;
function middleware(request) {
    const token = request.cookies.get(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$session$2d$cookie$2e$ts__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["SESSION_COOKIE"])?.value;
    // Путь запроса — в заголовке, чтобы серверный layout знал, где он, и решал про гейт онбординга
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-wetop-path', request.nextUrl.pathname);
    requestHeaders.set('x-wetop-return', request.nextUrl.pathname + request.nextUrl.search);
    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$settings$2d$request$2d$diagnostics$2e$ts__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["diagnosticsEnabled"])(process.env)) {
        // Fresh per incoming request; never trust a client-provided diagnostic identifier.
        const id = crypto.randomUUID();
        requestHeaders.set(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$settings$2d$request$2d$diagnostics$2e$ts__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["SETTINGS_DIAGNOSTIC_HEADER"], id);
        try {
            console.info(JSON.stringify((0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$settings$2d$request$2d$diagnostics$2e$ts__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["incomingEvent"])(id, request.nextUrl.pathname, request.headers.get('rsc') === '1', request.headers.get('next-router-prefetch') === '1' || request.headers.get('purpose') === 'prefetch')));
        } catch  {}
    }
    const response = __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$spec$2d$extension$2f$response$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"].next({
        request: {
            headers: requestHeaders
        }
    });
    // Заголовки безопасности (аудит 29.09.2026, SEC-4): запрет фрейма, nosniff, referrer; полная CSP — report-only
    for (const [name, value] of Object.entries((0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$security$2d$headers$2e$ts__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["securityHeaders"])({
        assistantUrl: process.env.ASSISTANT_URL
    })))response.headers.set(name, value);
    if (token) response.cookies.set(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$session$2d$cookie$2e$ts__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["SESSION_COOKIE"], token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: request.nextUrl.protocol === 'https:',
        path: '/',
        maxAge: __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$session$2d$cookie$2e$ts__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["SESSION_MAX_AGE_SECONDS"]
    });
    return response;
}
const config = {
    // статика и картинки посредника не касаются: там куки не нужны, а работы он добавляет
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico).*)'
    ]
};
}),
]);

//# sourceMappingURL=%5Broot-of-the-server%5D__0esx-ma._.js.map