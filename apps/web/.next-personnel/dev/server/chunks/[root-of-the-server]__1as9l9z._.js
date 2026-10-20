module.exports = [
"[externals]/next/dist/server/app-render/action-async-storage.external.js [external] (next/dist/server/app-render/action-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/app-render/action-async-storage.external.js", () => require("next/dist/server/app-render/action-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[project]/wt-personnel/apps/web/src/lib/auth-entry.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/** Return addresses never leave this application or re-enter an authentication endpoint. */ __turbopack_context__.s([
    "publicAuthUrl",
    ()=>publicAuthUrl,
    "safeReturnPath",
    ()=>safeReturnPath
]);
function safeReturnPath(value) {
    if (typeof value !== 'string' || value.length > 2048 || !value.startsWith('/') || value.startsWith('//') || /[\\\s]|%5c|%2f/i.test(value) || Array.from(value).some((character)=>character.charCodeAt(0) < 32)) return '/today';
    try {
        const url = new URL(value, 'https://app.invalid');
        if (url.origin !== 'https://app.invalid' || /^\/(?:login|register|invite|auth|api)(?:\/|$)/i.test(decodeURIComponent(url.pathname)) || url.pathname === '/') return '/today';
        return `${url.pathname}${url.search}`;
    } catch  {
        return '/today';
    }
}
function publicAuthUrl(mode = 'login', next = '/today', env = process.env) {
    const url = new URL(env.WETOP_SITE_URL || 'https://wetop.ai');
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/' || url.protocol !== 'https:' && !(url.protocol === 'http:' && [
        '127.0.0.1',
        'localhost'
    ].includes(url.hostname))) {
        throw new Error('WETOP_SITE_URL: требуется HTTPS origin или локальный адрес главной');
    }
    url.searchParams.set('next', safeReturnPath(next));
    url.hash = mode;
    return url.toString();
}
}),
"[project]/wt-personnel/apps/web/src/lib/auth-lock.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Замок стойки: включён ли вход. Правило зеркально API (`apps/api/src/auth/auth.guard.ts`, ТЗ аудита
 * 25.09.2026, В-2 — fail-closed): в production замок включён всегда и выключается только явным '0';
 * вне production включается любым значением, кроме «0» и «false» (ADR-095) — без значения сквозные наборы, dev-стенд и демо работают
 * без входа. Чистая функция, чтобы правило было доказано модульным тестом без next/headers.
 */ __turbopack_context__.s([
    "lockRequired",
    ()=>lockRequired
]);
function lockRequired(value, nodeEnv) {
    const v = value?.trim().toLowerCase();
    // в production снимает только явный «0»: «false», пустая строка или опечатка замок не открывают
    if (nodeEnv === 'production') return v !== '0';
    // вне production: без значения, «0» и «false» — без входа; любое другое значение включает, а не снимает (ADR-095)
    return !!v && v !== '0' && v !== 'false';
}
}),
"[project]/wt-personnel/apps/web/src/lib/session.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SESSION_COOKIE",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$session$2d$cookie$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["SESSION_COOKIE"],
    "SESSION_MAX_AGE_SECONDS",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$session$2d$cookie$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["SESSION_MAX_AGE_SECONDS"],
    "authRequired",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$session$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["authRequired"],
    "clearScopeCookie",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$session$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["clearScopeCookie"],
    "clearSessionCookie",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$session$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["clearSessionCookie"],
    "clientInfo",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$session$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["clientInfo"],
    "cookieSecure",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$session$2d$cookie$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["cookieSecure"],
    "redirectToLoginIfRequired",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$session$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["redirectToLoginIfRequired"],
    "sessionToken",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$session$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sessionToken"],
    "setScopeCookie",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$session$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["setScopeCookie"],
    "setSessionCookie",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$session$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["setSessionCookie"]
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$session$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/session.ts [app-route] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$session$2d$cookie$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/session-cookie.ts [app-route] (ecmascript)");
}),
"[project]/wt-personnel/apps/web/src/lib/session.ts [app-route] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "authRequired",
    ()=>authRequired,
    "clearScopeCookie",
    ()=>clearScopeCookie,
    "clearSessionCookie",
    ()=>clearSessionCookie,
    "clientInfo",
    ()=>clientInfo,
    "redirectToLoginIfRequired",
    ()=>redirectToLoginIfRequired,
    "sessionToken",
    ()=>sessionToken,
    "setScopeCookie",
    ()=>setScopeCookie,
    "setSessionCookie",
    ()=>setSessionCookie
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/headers.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$session$2d$cookie$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/session-cookie.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$auth$2d$lock$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/auth-lock.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$scope$2d$pointer$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/scope-pointer.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$auth$2d$entry$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/auth-entry.ts [app-route] (ecmascript)");
;
;
;
;
;
;
const authRequired = ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$auth$2d$lock$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["lockRequired"])(process.env.APP_AUTH_REQUIRED, ("TURBOPACK compile-time value", "development"));
async function clientInfo() {
    try {
        const h = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["headers"])();
        return {
            ip: h.get('cf-connecting-ip')?.trim() || null,
            userAgent: h.get('user-agent')?.trim() || null
        };
    } catch  {
        return {
            ip: null,
            userAgent: null
        };
    }
}
async function sessionToken() {
    try {
        const jar = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["cookies"])();
        return jar.get(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$session$2d$cookie$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["SESSION_COOKIE"])?.value || null;
    } catch  {
        return null;
    }
}
async function setSessionCookie(token, expiresAt) {
    const jar = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["cookies"])();
    const expires = new Date(expiresAt);
    jar.set(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$session$2d$cookie$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["SESSION_COOKIE"], token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$session$2d$cookie$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["cookieSecure"])(process.env),
        path: '/',
        expires: Number.isNaN(expires.getTime()) ? undefined : expires
    });
}
async function clearSessionCookie() {
    const jar = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["cookies"])();
    jar.delete(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$session$2d$cookie$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["SESSION_COOKIE"]);
    jar.delete(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$scope$2d$pointer$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["SCOPE_COOKIE"]);
}
async function setScopeCookie(pointer) {
    const jar = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["cookies"])();
    jar.set(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$scope$2d$pointer$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["SCOPE_COOKIE"], pointer, (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$scope$2d$pointer$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["scopeCookieOptions"])(process.env));
    // Запомнить выбор на устройстве: следующий вход откроет этот филиал сам (`/scope/resolve`)
    const location = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$scope$2d$pointer$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["pointerLocation"])(pointer);
    if (location) jar.set(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$scope$2d$pointer$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["LAST_BRANCH_COOKIE"], location, (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$scope$2d$pointer$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["lastBranchCookieOptions"])(process.env));
}
async function clearScopeCookie() {
    (await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["cookies"])()).delete(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$scope$2d$pointer$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["SCOPE_COOKIE"]);
}
async function redirectToLoginIfRequired() {
    if (!authRequired()) return;
    const { redirect } = await __turbopack_context__.A("[project]/wt-personnel/node_modules/next/dist/api/navigation.react-server.js [app-route] (ecmascript, async loader)");
    let next = null;
    try {
        const h = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["headers"])();
        next = h.get('x-wetop-return') ?? h.get('x-wetop-path');
    } catch  {
    // Служебный вызов вне запроса: замок остаётся включён, адрес возврата — /today.
    }
    redirect((0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$auth$2d$entry$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["publicAuthUrl"])('login', next));
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__1as9l9z._.js.map