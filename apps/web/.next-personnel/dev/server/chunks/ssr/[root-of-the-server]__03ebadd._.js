module.exports = [
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[project]/wt-personnel/apps/web/src/app/beauty/time.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/** «2026-10-12T13:00» в поясе филиала это какой момент */ __turbopack_context__.s([
    "clock",
    ()=>clock,
    "clockMinutes",
    ()=>clockMinutes,
    "instantOf",
    ()=>instantOf,
    "localInput",
    ()=>localInput,
    "zoneOffsetMs",
    ()=>zoneOffsetMs
]);
function instantOf(local, timezone) {
    const naive = Date.parse(`${local}:00Z`);
    if (Number.isNaN(naive)) return '';
    let guess = naive - zoneOffsetMs(new Date(naive), timezone);
    guess = naive - zoneOffsetMs(new Date(guess), timezone);
    return new Date(guess).toISOString();
}
function clock(minutes) {
    const m = (minutes % 1440 + 1440) % 1440;
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
function clockMinutes(value) {
    const [hh, mm] = value.split(':');
    return Number(hh) * 60 + Number(mm);
}
function zoneOffsetMs(at, timezone) {
    const parts = new Map(new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23'
    }).formatToParts(at).map((p)=>[
            p.type,
            p.value
        ]));
    return Date.UTC(Number(parts.get('year')), Number(parts.get('month')) - 1, Number(parts.get('day')), Number(parts.get('hour')), Number(parts.get('minute')), Number(parts.get('second'))) - at.getTime();
}
function localInput(iso, timezone) {
    const at = new Date(iso);
    const parts = new Map(new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
    }).formatToParts(at).map((p)=>[
            p.type,
            p.value
        ]));
    return `${parts.get('year')}-${parts.get('month')}-${parts.get('day')}T${parts.get('hour')}:${parts.get('minute')}`;
}
}),
"[project]/wt-personnel/apps/web/src/app/icon.svg (static in ecmascript, tag client)", ((__turbopack_context__) => {

__turbopack_context__.v("/_next/static/media/icon.0jn8egm0oiy1q.svg" + (globalThis["NEXT_CLIENT_ASSET_SUFFIX"] || ''));}),
"[project]/wt-personnel/apps/web/src/app/icon.svg.mjs { IMAGE => \"[project]/wt-personnel/apps/web/src/app/icon.svg (static in ecmascript, tag client)\" } [app-rsc] (structured image object, ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$icon$2e$svg__$28$static__in__ecmascript$2c$__tag__client$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/icon.svg (static in ecmascript, tag client)");
;
const __TURBOPACK__default__export__ = {
    src: __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$icon$2e$svg__$28$static__in__ecmascript$2c$__tag__client$29$__["default"],
    width: 48,
    height: 48
};
}),
"[project]/wt-personnel/apps/web/src/app/management/analytics/hospitality-page.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "HospitalityAnalytics",
    ()=>HospitalityAnalytics
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-jsx-dev-runtime.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/client/app-dir/link.react-server.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$search$2d$params$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/search-params.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$hotel$2d$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/hotel-api.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$page$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/page.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/ui.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$management$2f$analytics$2f$tabs$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/management/analytics/tabs.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$management$2f$analytics$2f$toolbar$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/management/analytics/toolbar.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$management$2f$analytics$2f$overview$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/management/analytics/overview.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$management$2f$analytics$2f$params$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/management/analytics/params.ts [app-rsc] (ecmascript)");
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
async function HospitalityAnalytics({ searchParams }) {
    const sp = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$search$2d$params$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["normalizeSearchParams"])(await searchParams);
    const today = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$hotel$2d$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["hotelToday"])();
    const query = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$management$2f$analytics$2f$params$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["parseAnalyticsQuery"])(sp, today);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$page$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Page"], {
        actions: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Fragment"], {
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                    className: "btn btn--secondary",
                    href: "/management/analytics?scope=organization",
                    children: "Сводка направлений"
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/hospitality-page.tsx",
                    lineNumber: 30,
                    columnNumber: 11
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                    className: "btn btn--secondary",
                    href: "/branches",
                    children: "Все филиалы"
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/hospitality-page.tsx",
                    lineNumber: 33,
                    columnNumber: 11
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/hospitality-page.tsx",
            lineNumber: 29,
            columnNumber: 9
        }, this),
        className: "analytics-page",
        title: "Аналитика",
        subtitle: "Как работал объект за период и что изменилось.",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$management$2f$analytics$2f$tabs$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AnalyticsTabs"], {
                current: "overview",
                fund: query.fund
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/hospitality-page.tsx",
                lineNumber: 42,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$management$2f$analytics$2f$toolbar$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AnalyticsToolbar"], {
                query: query,
                today: today
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/hospitality-page.tsx",
                lineNumber: 43,
                columnNumber: 7
            }, this),
            query.period.error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Alert"], {
                boxed: true,
                children: [
                    query.period.error,
                    ". Показан сегодняшний день."
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/hospitality-page.tsx",
                lineNumber: 44,
                columnNumber: 30
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Suspense"], {
                fallback: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$management$2f$analytics$2f$overview$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["OverviewSkeleton"], {}, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/hospitality-page.tsx",
                    lineNumber: 47,
                    columnNumber: 19
                }, this),
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$management$2f$analytics$2f$overview$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Overview"], {
                    query: query,
                    today: today
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/hospitality-page.tsx",
                    lineNumber: 49,
                    columnNumber: 9
                }, this)
            }, `${query.period.from}|${query.period.to}|${query.fund}|${query.compare}`, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/hospitality-page.tsx",
                lineNumber: 45,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/hospitality-page.tsx",
        lineNumber: 27,
        columnNumber: 5
    }, this);
}
}),
"[project]/wt-personnel/apps/web/src/app/management/analytics/page.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>AnalyticsPage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-jsx-dev-runtime.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/headers.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$api$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/api/navigation.react-server.js [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/client/components/navigation.react-server.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$vertical$2d$guard$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/vertical-guard.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$scope$2d$pointer$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/scope-pointer.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$session$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/session.ts [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$search$2d$params$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/search-params.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$today$2f$dispatch$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/today/dispatch.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$management$2f$analytics$2f$hospitality$2d$page$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/management/analytics/hospitality-page.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$management$2f$analytics$2f$vertical$2f$scope$2d$frame$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/scope-frame.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$management$2f$analytics$2f$vertical$2f$screen$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/screen.tsx [app-rsc] (ecmascript)");
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
async function AnalyticsPage({ searchParams }) {
    const me = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$vertical$2d$guard$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["requireFeature"])('/management/analytics');
    const { screen, key } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$today$2f$dispatch$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["todayScreen"])(me, {
        allowAnonymousHospitality: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$today$2f$dispatch$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["anonymousHospitalityAllowed"])({
            authRequired: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$session$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["authRequired"])(),
            nodeEnv: ("TURBOPACK compile-time value", "development")
        })
    });
    if (screen === 'UNRESOLVED') (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["redirect"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$today$2f$dispatch$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["unresolvedTarget"])(Boolean((0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$scope$2d$pointer$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["scopeHeader"])((await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["cookies"])()).get(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$scope$2d$pointer$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SCOPE_COOKIE"])?.value)['x-wetop-scope'])));
    const sp = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$search$2d$params$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["normalizeSearchParams"])(await searchParams);
    if (screen === 'HOSPITALITY' && sp.scope !== 'organization') return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$management$2f$analytics$2f$vertical$2f$scope$2d$frame$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ReportScopeFrame"], {
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$management$2f$analytics$2f$hospitality$2d$page$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["HospitalityAnalytics"], {
            searchParams: searchParams
        }, void 0, false, {
            fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/page.tsx",
            lineNumber: 37,
            columnNumber: 9
        }, this)
    }, key, false, {
        fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/page.tsx",
        lineNumber: 36,
        columnNumber: 7
    }, this);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$management$2f$analytics$2f$vertical$2f$scope$2d$frame$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ReportScopeFrame"], {
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$management$2f$analytics$2f$vertical$2f$screen$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["VerticalAnalytics"], {
            sp: sp
        }, void 0, false, {
            fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/page.tsx",
            lineNumber: 42,
            columnNumber: 7
        }, this)
    }, key, false, {
        fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/page.tsx",
        lineNumber: 41,
        columnNumber: 5
    }, this);
}
}),
"[project]/wt-personnel/apps/web/src/app/management/analytics/page.tsx [app-rsc] (ecmascript, Next.js Server Component)", (function(__turbopack_context__){

__turbopack_context__.n(__turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/management/analytics/page.tsx [app-rsc] (ecmascript)"));
}),
"[project]/wt-personnel/apps/web/src/app/management/analytics/tabs.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AnalyticsTabs",
    ()=>AnalyticsTabs
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-jsx-dev-runtime.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$management$2f$analytics$2f$params$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/management/analytics/params.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$tabs$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/tabs.tsx [app-rsc] (ecmascript)");
;
;
;
function AnalyticsTabs({ current, fund = 'all' }) {
    const q = fund === 'all' ? '' : `?fund=${fund}`;
    const tabs = [
        {
            id: 'overview',
            label: 'Обзор',
            href: `${__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$management$2f$analytics$2f$params$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ANALYTICS_PATH"]}${q}`
        },
        {
            id: 'occupancy',
            label: 'Загрузка',
            href: `${__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$management$2f$analytics$2f$params$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ANALYTICS_PATH"]}/occupancy${q}`
        },
        {
            id: 'units',
            label: 'По номерам',
            href: `${__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$management$2f$analytics$2f$params$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ANALYTICS_PATH"]}/units${q}`
        },
        // «Эффективность каналов» (ADR-141): у неё свой период заезда и сравнение, тип фонда не переходит
        {
            id: 'channels',
            label: 'Каналы',
            href: `${__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$management$2f$analytics$2f$params$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ANALYTICS_PATH"]}/channels`
        }
    ];
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        "data-testid": "pa-tabs",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$tabs$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Tabs"], {
            label: "Аналитика",
            items: tabs.map((t)=>({
                    href: t.href,
                    label: t.label,
                    current: t.id === current
                }))
        }, void 0, false, {
            fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/tabs.tsx",
            lineNumber: 27,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/tabs.tsx",
        lineNumber: 26,
        columnNumber: 5
    }, this);
}
}),
"[project]/wt-personnel/apps/web/src/app/management/analytics/toolbar.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AnalyticsToolbar",
    ()=>AnalyticsToolbar,
    "rangeCaption",
    ()=>rangeCaption
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-jsx-dev-runtime.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/client/app-dir/link.react-server.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$index$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/index.ts [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$dashboard$2f$period$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/dashboard/period.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/ui.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$date$2d$field$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/date-field.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$icon$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/icon.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$display$2d$date$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/display-date.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$plural$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/plural.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$management$2f$analytics$2f$params$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/management/analytics/params.ts [app-rsc] (ecmascript)");
;
;
;
;
;
;
;
;
;
const days = (from, to)=>Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
function rangeCaption(from, to) {
    const text = from === to ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$display$2d$date$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["displayDate"])(from, 'full') : `${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$display$2d$date$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["displayDate"])(from)} — ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$display$2d$date$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["displayDate"])(to)}, ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$plural$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["pluralRu"])(days(from, to), [
        'день',
        'дня',
        'дней'
    ])}`;
    return text.charAt(0).toUpperCase() + text.slice(1);
}
function AnalyticsToolbar({ query, today, noCompare = false, noFund = false }) {
    const { period, fund, compare } = query;
    const prev = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$dashboard$2f$period$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["previousPeriod"])(period.from, period.to);
    const custom = period.preset === 'custom';
    const single = period.from === period.to;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        className: "pa-toolbar",
        "aria-label": "Период и отбор",
        "data-testid": "pa-toolbar",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "pa-toolbar__head",
                children: [
                    single && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                        href: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$management$2f$analytics$2f$params$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["analyticsHref"])(query, {
                            period: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$management$2f$analytics$2f$params$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["dayPeriod"])(period.from, -1, today)
                        }),
                        className: "btn btn--secondary btn--sm pa-day-step pa-day-step--prev",
                        "aria-label": "Предыдущий день",
                        "data-testid": "pa-day-prev",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$icon$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Icon"], {
                            name: "chevron",
                            width: 16,
                            height: 16
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/toolbar.tsx",
                            lineNumber: 61,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/toolbar.tsx",
                        lineNumber: 55,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "pa-toolbar__caption",
                        "data-testid": "pa-period",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                children: rangeCaption(period.from, period.to)
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/toolbar.tsx",
                                lineNumber: 65,
                                columnNumber: 11
                            }, this),
                            period.to > today && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: single ? ', по броням' : ', будущие дни — по броням'
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/toolbar.tsx",
                                lineNumber: 66,
                                columnNumber: 33
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/toolbar.tsx",
                        lineNumber: 64,
                        columnNumber: 9
                    }, this),
                    single && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                        href: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$management$2f$analytics$2f$params$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["analyticsHref"])(query, {
                            period: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$management$2f$analytics$2f$params$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["dayPeriod"])(period.from, 1, today)
                        }),
                        className: "btn btn--secondary btn--sm pa-day-step",
                        "aria-label": "Следующий день",
                        "data-testid": "pa-day-next",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$icon$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Icon"], {
                            name: "chevron",
                            width: 16,
                            height: 16
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/toolbar.tsx",
                            lineNumber: 75,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/toolbar.tsx",
                        lineNumber: 69,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/toolbar.tsx",
                lineNumber: 53,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "pa-toolbar__row",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("nav", {
                        className: "seg period-presets",
                        "aria-label": "Период",
                        children: __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$management$2f$analytics$2f$params$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ANALYTICS_PRESETS"].map((p)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                                href: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$management$2f$analytics$2f$params$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["analyticsHref"])(query, {
                                    period: {
                                        preset: p.id,
                                        from: period.from,
                                        to: period.to
                                    }
                                }),
                                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["cx"])(period.preset === p.id && 'is-on'),
                                "aria-current": period.preset === p.id ? 'page' : undefined,
                                children: p.label
                            }, p.id, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/toolbar.tsx",
                                lineNumber: 82,
                                columnNumber: 13
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/toolbar.tsx",
                        lineNumber: 80,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("details", {
                        className: "pa-range",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("summary", {
                                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["cx"])('btn btn--secondary', custom && 'is-on'),
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$icon$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Icon"], {
                                        name: "today",
                                        width: 16,
                                        height: 16
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/toolbar.tsx",
                                        lineNumber: 96,
                                        columnNumber: 13
                                    }, this),
                                    "Период"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/toolbar.tsx",
                                lineNumber: 95,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
                                method: "get",
                                className: "pa-range__form",
                                "data-testid": "pa-range-form",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                        type: "hidden",
                                        name: "period",
                                        value: "custom"
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/toolbar.tsx",
                                        lineNumber: 100,
                                        columnNumber: 13
                                    }, this),
                                    fund !== 'all' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                        type: "hidden",
                                        name: "fund",
                                        value: fund
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/toolbar.tsx",
                                        lineNumber: 101,
                                        columnNumber: 32
                                    }, this),
                                    !compare && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                        type: "hidden",
                                        name: "compare",
                                        value: "0"
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/toolbar.tsx",
                                        lineNumber: 102,
                                        columnNumber: 26
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                        children: [
                                            "С",
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$date$2d$field$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["DateInput"], {
                                                name: "from",
                                                defaultValue: period.from,
                                                "aria-label": "Период: с"
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/toolbar.tsx",
                                                lineNumber: 104,
                                                columnNumber: 16
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/toolbar.tsx",
                                        lineNumber: 103,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                        children: [
                                            "По",
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$date$2d$field$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["DateInput"], {
                                                name: "to",
                                                rangeFromName: "from",
                                                defaultValue: period.to,
                                                "aria-label": "Период: по"
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/toolbar.tsx",
                                                lineNumber: 108,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/toolbar.tsx",
                                        lineNumber: 106,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Button"], {
                                        type: "submit",
                                        tone: "secondary",
                                        children: "Применить"
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/toolbar.tsx",
                                        lineNumber: 115,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/toolbar.tsx",
                                lineNumber: 99,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/toolbar.tsx",
                        lineNumber: 94,
                        columnNumber: 9
                    }, this),
                    !noFund && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("nav", {
                        className: "seg pa-fund",
                        "aria-label": "Тип фонда",
                        "data-testid": "pa-fund",
                        children: [
                            'all',
                            'rooms',
                            'beds'
                        ].map((f)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                                href: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$management$2f$analytics$2f$params$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["analyticsHref"])(query, {
                                    fund: f
                                }),
                                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["cx"])(fund === f && 'is-on'),
                                "aria-current": fund === f ? 'page' : undefined,
                                children: __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$management$2f$analytics$2f$params$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["FUND_LABELS"][f]
                            }, f, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/toolbar.tsx",
                                lineNumber: 123,
                                columnNumber: 15
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/toolbar.tsx",
                        lineNumber: 121,
                        columnNumber: 11
                    }, this),
                    !noCompare && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                        href: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$management$2f$analytics$2f$params$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["analyticsHref"])(query, {
                            compare: !compare
                        }),
                        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["cx"])('pa-compare', compare && 'is-on'),
                        "data-testid": "pa-compare-toggle",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "pa-compare__box",
                                "aria-hidden": "true",
                                children: compare && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$icon$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Icon"], {
                                    name: "check",
                                    width: 14,
                                    height: 14
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/toolbar.tsx",
                                    lineNumber: 141,
                                    columnNumber: 27
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/toolbar.tsx",
                                lineNumber: 140,
                                columnNumber: 13
                            }, this),
                            "Сравнить с ",
                            (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$display$2d$date$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["displayDate"])(prev.from),
                            prev.from !== prev.to && ` — ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$display$2d$date$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["displayDate"])(prev.to)}`,
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "sr-only",
                                children: compare ? ' — включено, выключить' : ' — выключено, включить'
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/toolbar.tsx",
                                lineNumber: 145,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/toolbar.tsx",
                        lineNumber: 135,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/toolbar.tsx",
                lineNumber: 79,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/toolbar.tsx",
        lineNumber: 52,
        columnNumber: 5
    }, this);
}
}),
"[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/food-period.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "FoodPeriodPanel",
    ()=>FoodPeriodPanel
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-jsx-dev-runtime.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/ui.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$day$2d$bars$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/day-bars.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$donut$2d$share$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/donut-share.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$dashboard$2d$format$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/dashboard-format.ts [app-rsc] (ecmascript)");
;
;
;
;
;
function FoodPeriodPanel({ report }) {
    const money = (minor)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$dashboard$2d$format$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["wholeTenge"])(minor, report.currency);
    const table = (heads, rows, empty)=>rows.length === 0 ? // не EmptyState: его заголовок h3 под панелью ломает порядок заголовков (axe heading-order)
        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
            className: "muted",
            children: empty
        }, void 0, false, {
            fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/food-period.tsx",
            lineNumber: 13,
            columnNumber: 7
        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Table"], {
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("thead", {
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                        children: heads.map((h)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                children: h
                            }, h, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/food-period.tsx",
                                lineNumber: 19,
                                columnNumber: 15
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/food-period.tsx",
                        lineNumber: 17,
                        columnNumber: 11
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/food-period.tsx",
                    lineNumber: 16,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("tbody", {
                    children: rows.map((r, n)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                            children: r.map((c, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                    children: c
                                }, i, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/food-period.tsx",
                                    lineNumber: 27,
                                    columnNumber: 17
                                }, this))
                        }, n, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/food-period.tsx",
                            lineNumber: 25,
                            columnNumber: 13
                        }, this))
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/food-period.tsx",
                    lineNumber: 23,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/food-period.tsx",
            lineNumber: 15,
            columnNumber: 7
        }, this);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "vertical-food",
        "data-testid": "food-period",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Stats"], {
                min: 180,
                className: "vertical-food__kpis",
                "aria-label": "Продажи за период",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Stat"], {
                        label: "Выручка",
                        value: money(report.revenueMinor),
                        hint: "закрытые заказы",
                        testId: "food-period-revenue"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/food-period.tsx",
                        lineNumber: 37,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Stat"], {
                        label: "Гостей",
                        value: report.guestsCount ?? '—',
                        testId: "food-period-guests"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/food-period.tsx",
                        lineNumber: 38,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Stat"], {
                        label: "Выручка бара",
                        value: money(report.barRevenueMinor ?? '0'),
                        hint: "продажи бара",
                        testId: "food-period-bar-revenue"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/food-period.tsx",
                        lineNumber: 39,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Stat"], {
                        label: "Средний чек",
                        value: report.averageCheckMinor === null ? '—' : money(report.averageCheckMinor),
                        testId: "food-period-check"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/food-period.tsx",
                        lineNumber: 45,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Stat"], {
                        label: "Заказов",
                        value: report.ordersCount,
                        testId: "food-period-orders"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/food-period.tsx",
                        lineNumber: 50,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/food-period.tsx",
                lineNumber: 36,
                columnNumber: 7
            }, this),
            (report.revenueByDay || report.categories) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "vertical-food__charts",
                children: [
                    report.revenueByDay && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Panel"], {
                        title: "Выручка по дням",
                        children: report.revenueByDay.some((d)=>d.revenueMinor !== '0') ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$day$2d$bars$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["DayBars"], {
                            testId: "food-period-days",
                            today: report.to,
                            days: (()=>{
                                const max = Math.max(...report.revenueByDay.map((d)=>Number(d.revenueMinor)));
                                return report.revenueByDay.map((d)=>({
                                        date: d.date,
                                        height: max > 0 ? Math.round(Number(d.revenueMinor) / max * 100) : 0,
                                        facts: `${money(d.revenueMinor)}, заказов ${d.orders}`
                                    }));
                            })()
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/food-period.tsx",
                            lineNumber: 57,
                            columnNumber: 17
                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "muted",
                            children: "Закрытых заказов за период нет"
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/food-period.tsx",
                            lineNumber: 70,
                            columnNumber: 17
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/food-period.tsx",
                        lineNumber: 55,
                        columnNumber: 13
                    }, this),
                    report.categories && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Panel"], {
                        title: "Продажи по категориям",
                        children: report.categories.length ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$donut$2d$share$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["DonutShare"], {
                            testId: "food-period-categories",
                            items: report.categories.map((c)=>({
                                    label: c.name,
                                    valueMinor: c.revenueMinor
                                })),
                            centerLabel: "выручка",
                            centerValue: money(report.revenueMinor),
                            amount: money
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/food-period.tsx",
                            lineNumber: 77,
                            columnNumber: 17
                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "muted",
                            children: "Закрытых заказов за период нет"
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/food-period.tsx",
                            lineNumber: 85,
                            columnNumber: 17
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/food-period.tsx",
                        lineNumber: 75,
                        columnNumber: 13
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/food-period.tsx",
                lineNumber: 53,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Panel"], {
                title: "Себестоимость и прибыль",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("dl", {
                        className: "vertical-food__facts",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                        children: "Себестоимость"
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/food-period.tsx",
                                        lineNumber: 94,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                        "data-testid": "food-period-cost",
                                        children: money(report.costMinor)
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/food-period.tsx",
                                        lineNumber: 95,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/food-period.tsx",
                                lineNumber: 93,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                        children: "Валовая прибыль"
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/food-period.tsx",
                                        lineNumber: 98,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                        "data-testid": "food-period-profit",
                                        children: money(report.grossProfitMinor)
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/food-period.tsx",
                                        lineNumber: 99,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/food-period.tsx",
                                lineNumber: 97,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                        children: "Фудкост"
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/food-period.tsx",
                                        lineNumber: 102,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                        "data-testid": "food-period-foodcost",
                                        children: report.foodCostPct === null ? '—' : `${report.foodCostPct} %`
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/food-period.tsx",
                                        lineNumber: 103,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/food-period.tsx",
                                lineNumber: 101,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/food-period.tsx",
                        lineNumber: 92,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "muted",
                        children: "Себестоимость списана со склада по заказам периода."
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/food-period.tsx",
                        lineNumber: 108,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/food-period.tsx",
                lineNumber: 91,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Panel"], {
                title: "Оплаты по способам",
                children: table([
                    'Способ',
                    'Платежей',
                    'Сумма'
                ], report.payments.map((p)=>[
                        __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$dashboard$2d$format$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["METHOD_RU"][p.method] ?? p.method,
                        p.count,
                        money(p.amountMinor)
                    ]), 'Оплат за период нет')
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/food-period.tsx",
                lineNumber: 110,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Panel"], {
                title: "Популярные блюда",
                children: table([
                    'Блюдо',
                    'Порций',
                    'Выручка'
                ], report.topDishes.map((d)=>[
                        d.name,
                        d.qty,
                        money(d.revenueMinor)
                    ]), 'Закрытых заказов за период нет')
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/food-period.tsx",
                lineNumber: 117,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Panel"], {
                title: "Недостачи по заказам",
                children: table([
                    'Ингредиент',
                    'Не хватило'
                ], report.shortages.map((x)=>[
                        x.name,
                        `${x.qty} ${x.unit}`
                    ]), 'Недостач за период нет')
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/food-period.tsx",
                lineNumber: 124,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Panel"], {
                title: "Официанты",
                children: table([
                    'Официант',
                    'Заказов',
                    'Выручка'
                ], report.waiters.map((w)=>[
                        w.name,
                        w.orders,
                        money(w.revenueMinor)
                    ]), 'Заказов с официантом за период нет')
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/food-period.tsx",
                lineNumber: 131,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/food-period.tsx",
        lineNumber: 35,
        columnNumber: 5
    }, this);
}
}),
"[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/load.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "loadBranchPeriod",
    ()=>loadBranchPeriod
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/api.ts [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$food$2d$data$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/food-data.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$beauty$2f$time$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/beauty/time.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$management$2f$analytics$2f$vertical$2f$metrics$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/metrics.ts [app-rsc] (ecmascript)");
;
;
;
;
async function loadBranchPeriod(branch, dates) {
    // Sequential days bound API/DB concurrency. No module/global report cache.
    const beautyRows = [];
    const foodRows = [];
    for (const date of dates){
        if (branch.vertical === 'BEAUTY') {
            const day = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["branchReportDay"])(branch, date);
            if (day.date !== date || day.location.id !== branch.locationId || day.location.timezone !== branch.timezone || !Array.isArray(day.appointments)) throw new Error('Контекст отчёта изменился. Обновите страницу.');
            for (const row of day.appointments){
                if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$beauty$2f$time$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["localInput"])(row.startsAt, branch.timezone).slice(0, 10) !== date) throw new Error('Некорректная дата записи');
                beautyRows.push(row);
            }
        } else if (branch.vertical === 'FOOD_SERVICE') {
            const rows = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$food$2d$data$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["completeFoodList"])((cursor)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["branchReportDay"])(branch, date, cursor), __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$food$2d$data$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["validFoodReservation"]);
            if (rows.some((row)=>row.locationId !== branch.locationId)) throw new Error('Контекст отчёта изменился. Обновите страницу.');
            // Food day reads include overlaps. Period counts belong to the reservation's local start date.
            foodRows.push(...rows.filter((row)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$beauty$2f$time$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["localInput"])(row.startsAt, branch.timezone).slice(0, 10) === date));
        } else throw new Error('Нет адаптера отчёта');
    }
    if (branch.vertical === 'BEAUTY') return {
        ...(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$management$2f$analytics$2f$vertical$2f$metrics$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["beautyPeriod"])(beautyRows),
        food: null
    };
    return {
        counts: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$management$2f$analytics$2f$vertical$2f$metrics$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["foodPeriod"])(foodRows),
        revenue: null,
        food: await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["branchFoodPeriod"])(branch, dates[0], dates[dates.length - 1])
    };
}
}),
"[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/metrics.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "BEAUTY_LABELS",
    ()=>BEAUTY_LABELS,
    "FOOD_LABELS",
    ()=>FOOD_LABELS,
    "MAX_PERIOD_DAYS",
    ()=>MAX_PERIOD_DAYS,
    "beautyPeriod",
    ()=>beautyPeriod,
    "foodPeriod",
    ()=>foodPeriod,
    "moneyText",
    ()=>moneyText,
    "periodDates",
    ()=>periodDates
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$status$2f$beauty$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/status/beauty.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$status$2f$food$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/status/food.ts [app-rsc] (ecmascript)");
;
;
const MAX_PERIOD_DAYS = 31;
const DAY = 86400000;
function periodDates(from, to) {
    const valid = (s)=>/^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s + 'T00:00:00Z')) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
    if (!valid(from) || !valid(to) || to < from) throw new Error('Укажите корректный период');
    const count = (Date.parse(to) - Date.parse(from)) / DAY + 1;
    if (count > MAX_PERIOD_DAYS) throw new Error('Выберите период не длиннее 31 дня');
    return Array.from({
        length: count
    }, (_, i)=>new Date(Date.parse(from) + i * DAY).toISOString().slice(0, 10));
}
const groups = (registry, order)=>Object.fromEntries(order.map((k)=>[
            k,
            registry[k].groupLabel ?? registry[k].label
        ]));
const BEAUTY_LABELS = groups(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$status$2f$beauty$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["beautyStatus"], Object.keys(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$status$2f$beauty$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["beautyStatus"]));
const FOOD_LABELS = groups(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$status$2f$food$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["foodStatus"], [
    'BOOKED',
    'CONFIRMED',
    'SEATED',
    'COMPLETED',
    'CANCELLED',
    'NO_SHOW'
]);
function counters(labels, rows) {
    const counts = Object.fromEntries(Object.keys(labels).map((s)=>[
            s,
            0
        ]));
    const seen = new Set();
    for (const row of rows){
        if (!row.id || seen.has(row.id) || !Object.hasOwn(labels, row.status)) throw new Error('Некорректный ответ отчёта');
        seen.add(row.id);
        counts[row.status]++;
    }
    return counts;
}
function beautyPeriod(rows) {
    const counts = counters(BEAUTY_LABELS, rows);
    const totals = new Map();
    for (const r of rows.filter((r)=>r.status === 'DONE')){
        if (!/^\d+$/.test(r.priceMinor) || !/^[A-Z]{3}$/.test(r.currency)) throw new Error('Некорректная цена записи');
        totals.set(r.currency, (totals.get(r.currency) ?? 0n) + BigInt(r.priceMinor));
    }
    const revenue = Object.fromEntries([
        ...totals
    ].sort(([a], [b])=>a.localeCompare(b)).map(([c, n])=>[
            c,
            n.toString()
        ]));
    return {
        counts,
        revenue
    };
}
function foodPeriod(rows) {
    return counters(FOOD_LABELS, rows);
}
function moneyText(minor, currency) {
    const digits = new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency
    }).resolvedOptions().maximumFractionDigits ?? 2;
    const divisor = 10n ** BigInt(digits);
    const value = BigInt(minor);
    const absolute = value < 0n ? -value : value;
    const whole = new Intl.NumberFormat('ru-RU', {
        maximumFractionDigits: 0
    }).format(absolute / divisor);
    const fraction = digits ? ',' + (absolute % divisor).toString().padStart(digits, '0') : '';
    return `${value < 0n ? '-' : ''}${whole}${fraction} ${currency}`;
}
}),
"[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/scope-frame.tsx [app-rsc] (client reference proxy)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ReportScopeFrame",
    ()=>ReportScopeFrame
]);
// This file is generated by next-core EcmascriptClientReferenceModule.
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const ReportScopeFrame = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call ReportScopeFrame() from the server but ReportScopeFrame is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/scope-frame.tsx", "ReportScopeFrame");
}),
"[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/scope-frame.tsx [app-rsc] (client reference proxy) <module evaluation>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ReportScopeFrame",
    ()=>ReportScopeFrame
]);
// This file is generated by next-core EcmascriptClientReferenceModule.
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const ReportScopeFrame = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call ReportScopeFrame() from the server but ReportScopeFrame is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/scope-frame.tsx <module evaluation>", "ReportScopeFrame");
}),
"[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/scope-frame.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$management$2f$analytics$2f$vertical$2f$scope$2d$frame$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__$3c$module__evaluation$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/scope-frame.tsx [app-rsc] (client reference proxy) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$management$2f$analytics$2f$vertical$2f$scope$2d$frame$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/scope-frame.tsx [app-rsc] (client reference proxy)");
;
__turbopack_context__.n(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$management$2f$analytics$2f$vertical$2f$scope$2d$frame$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__);
}),
"[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/screen.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "VerticalAnalytics",
    ()=>VerticalAnalytics
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-jsx-dev-runtime.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/client/app-dir/link.react-server.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$api$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/api/navigation.react-server.js [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/client/components/navigation.react-server.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$index$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/index.ts [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$accounts$2f$permissions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/accounts/permissions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$page$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/page.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/ui.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/api.ts [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$desk$2d$shell$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/desk-shell.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$beauty$2f$time$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/beauty/time.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$display$2d$date$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/display-date.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$management$2f$analytics$2f$vertical$2f$metrics$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/metrics.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$management$2f$analytics$2f$vertical$2f$load$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/load.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$management$2f$analytics$2f$vertical$2f$food$2d$period$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/food-period.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$tabs$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/tabs.tsx [app-rsc] (ecmascript)");
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
const path = '/management/analytics';
async function VerticalAnalytics({ sp }) {
    const shell = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$desk$2d$shell$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["deskShell"])();
    // Reports are stricter than the operational day APIs. Do not serialize report data for denied roles.
    if (!shell.access.role || !(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$accounts$2f$permissions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["can"])(shell.access.role, 'reports')) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$page$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Page"], {
        title: "Аналитика",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Alert"], {
            boxed: true,
            children: "Нет доступа к отчётам."
        }, void 0, false, {
            fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/screen.tsx",
            lineNumber: 22,
            columnNumber: 9
        }, this)
    }, void 0, false, {
        fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/screen.tsx",
        lineNumber: 21,
        columnNumber: 7
    }, this);
    try {
        const me = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$desk$2d$shell$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["currentMe"])();
        const { items } = await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["branchesApi"].list();
        const selected = items.find((b)=>b.locationId === me.context?.locationId && b.location.businessId === me.context?.businessId);
        if (!selected) throw new Error('Выбранный филиал недоступен');
        const today = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$beauty$2f$time$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["localInput"])(new Date().toISOString(), selected.timezone).slice(0, 10);
        const from = sp.from ?? today;
        const to = sp.to ?? from;
        const dates = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$management$2f$analytics$2f$vertical$2f$metrics$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["periodDates"])(from, to);
        const organization = sp.scope === 'organization';
        const targets = organization ? items.filter((b)=>b.vertical !== 'HOSPITALITY') : [
            selected
        ];
        const results = [];
        for (const branch of targets){
            try {
                results.push({
                    branch,
                    report: await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$management$2f$analytics$2f$vertical$2f$load$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["loadBranchPeriod"])(branch, dates),
                    error: null
                });
            } catch (error) {
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["unstable_rethrow"])(error);
                results.push({
                    branch,
                    report: null,
                    error: 'Данные филиала недоступны. Обновите страницу.'
                });
            }
        }
        // Existing guarded hotel report, kept separate from Beauty/Food.
        const hotels = organization && items.some((b)=>b.vertical === 'HOSPITALITY') ? await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["branchesApi"].overview(from, to).catch((error)=>{
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["unstable_rethrow"])(error);
            return null;
        }) : undefined;
        const q = new URLSearchParams({
            from,
            to
        });
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$page$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Page"], {
            title: "Аналитика",
            subtitle: organization ? 'Отчёты по филиалам, отдельно по направлениям.' : selected.name,
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "vertical-report",
                "data-testid": "vertical-analytics",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$tabs$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Tabs"], {
                        label: "Область отчёта",
                        items: [
                            {
                                href: `${path}?${q}`,
                                label: 'Выбранный филиал',
                                current: !organization
                            },
                            {
                                href: `${path}?${q}&scope=organization`,
                                label: 'Все филиалы',
                                current: organization
                            }
                        ]
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/screen.tsx",
                        lineNumber: 75,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
                        className: "vertical-report-period",
                        action: path,
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                children: [
                                    "С даты",
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                        type: "date",
                                        name: "from",
                                        defaultValue: from,
                                        required: true
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/screen.tsx",
                                        lineNumber: 85,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/screen.tsx",
                                lineNumber: 83,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                children: [
                                    "По дату",
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                        type: "date",
                                        name: "to",
                                        defaultValue: to,
                                        required: true
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/screen.tsx",
                                        lineNumber: 89,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/screen.tsx",
                                lineNumber: 87,
                                columnNumber: 13
                            }, this),
                            organization && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                type: "hidden",
                                name: "scope",
                                value: "organization"
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/screen.tsx",
                                lineNumber: 91,
                                columnNumber: 30
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                className: "btn btn--primary",
                                type: "submit",
                                children: "Показать"
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/screen.tsx",
                                lineNumber: 92,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/screen.tsx",
                        lineNumber: 82,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "muted",
                        children: [
                            "С ",
                            (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$display$2d$date$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["displayDate"])(from),
                            " по ",
                            (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$display$2d$date$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["displayDate"])(to),
                            " включительно, по местному времени каждого филиала. Период до 31 дня."
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/screen.tsx",
                        lineNumber: 96,
                        columnNumber: 11
                    }, this),
                    [
                        'BEAUTY',
                        'FOOD_SERVICE'
                    ].map((vertical)=>{
                        const group = results.filter((r)=>r.branch.vertical === vertical);
                        if (!group.length) return null;
                        const labels = vertical === 'BEAUTY' ? __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$management$2f$analytics$2f$vertical$2f$metrics$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["BEAUTY_LABELS"] : __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$management$2f$analytics$2f$vertical$2f$metrics$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["FOOD_LABELS"];
                        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                            "aria-label": vertical === 'BEAUTY' ? 'Салоны' : 'Рестораны',
                            children: [
                                organization && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                    children: vertical === 'BEAUTY' ? 'Салоны' : 'Рестораны'
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/screen.tsx",
                                    lineNumber: 106,
                                    columnNumber: 34
                                }, this),
                                group.map(({ branch, report, error })=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Panel"], {
                                        title: branch.name,
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            "data-testid": `report-${branch.locationId}`,
                                            children: error ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Alert"], {
                                                boxed: true,
                                                children: error
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/screen.tsx",
                                                lineNumber: 111,
                                                columnNumber: 25
                                            }, this) : report && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Fragment"], {
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Stats"], {
                                                        min: 150,
                                                        "aria-label": "Статусы за период",
                                                        children: Object.entries(labels).map(([status, label])=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Stat"], {
                                                                label: label,
                                                                value: report.counts[status] ?? 0,
                                                                testId: `period-${status}`
                                                            }, status, false, {
                                                                fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/screen.tsx",
                                                                lineNumber: 117,
                                                                columnNumber: 33
                                                            }, this))
                                                    }, void 0, false, {
                                                        fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/screen.tsx",
                                                        lineNumber: 115,
                                                        columnNumber: 29
                                                    }, this),
                                                    report.revenue !== null ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Panel"], {
                                                        title: "Выручка по завершённым записям",
                                                        children: [
                                                            Object.entries(report.revenue).length ? Object.entries(report.revenue).map(([currency, minor])=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                    "data-testid": `revenue-${currency}`,
                                                                    children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$management$2f$analytics$2f$vertical$2f$metrics$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["moneyText"])(minor, currency)
                                                                }, currency, false, {
                                                                    fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/screen.tsx",
                                                                    lineNumber: 129,
                                                                    columnNumber: 37
                                                                }, this)) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                children: "Завершённых записей за период нет."
                                                            }, void 0, false, {
                                                                fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/screen.tsx",
                                                                lineNumber: 134,
                                                                columnNumber: 35
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                className: "muted",
                                                                children: "Снимки цены записей со статусом «Завершено». Это не полученные оплаты. Валюты отдельно."
                                                            }, void 0, false, {
                                                                fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/screen.tsx",
                                                                lineNumber: 136,
                                                                columnNumber: 33
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/screen.tsx",
                                                        lineNumber: 126,
                                                        columnNumber: 31
                                                    }, this) : report.food && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$management$2f$analytics$2f$vertical$2f$food$2d$period$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["FoodPeriodPanel"], {
                                                        report: report.food
                                                    }, void 0, false, {
                                                        fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/screen.tsx",
                                                        lineNumber: 142,
                                                        columnNumber: 46
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/screen.tsx",
                                                lineNumber: 114,
                                                columnNumber: 27
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/screen.tsx",
                                            lineNumber: 109,
                                            columnNumber: 21
                                        }, this)
                                    }, branch.locationId, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/screen.tsx",
                                        lineNumber: 108,
                                        columnNumber: 19
                                    }, this))
                            ]
                        }, vertical, true, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/screen.tsx",
                            lineNumber: 105,
                            columnNumber: 15
                        }, this);
                    }),
                    organization && items.some((b)=>b.vertical === 'HOSPITALITY') && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                        "aria-label": "Гостиницы",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                children: "Гостиницы"
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/screen.tsx",
                                lineNumber: 155,
                                columnNumber: 15
                            }, this),
                            hotels === null ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Alert"], {
                                boxed: true,
                                children: "Гостиничная сводка недоступна."
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/screen.tsx",
                                lineNumber: 157,
                                columnNumber: 17
                            }, this) : hotels?.rows.map(({ branch, stats })=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Panel"], {
                                    title: branch.name,
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Stats"], {
                                        min: 150,
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Stat"], {
                                                label: "Загрузка",
                                                value: `${stats.occupancy.percent}%`
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/screen.tsx",
                                                lineNumber: 162,
                                                columnNumber: 23
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Stat"], {
                                                label: "Выручка",
                                                value: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$management$2f$analytics$2f$vertical$2f$metrics$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["moneyText"])(stats.revenue.totalMinor, branch.currency)
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/screen.tsx",
                                                lineNumber: 163,
                                                columnNumber: 23
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/screen.tsx",
                                        lineNumber: 161,
                                        columnNumber: 21
                                    }, this)
                                }, branch.locationId, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/screen.tsx",
                                    lineNumber: 160,
                                    columnNumber: 19
                                }, this))
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/screen.tsx",
                        lineNumber: 154,
                        columnNumber: 13
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "muted",
                        children: "Показаны текущие статусы записей, начавшихся за период. Проценты неявок и повторных посещений пока не рассчитываются."
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/screen.tsx",
                        lineNumber: 173,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/screen.tsx",
                lineNumber: 74,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/screen.tsx",
            lineNumber: 66,
            columnNumber: 7
        }, this);
    } catch (error) {
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["unstable_rethrow"])(error);
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$page$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Page"], {
            title: "Аналитика",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Alert"], {
                    boxed: true,
                    children: error instanceof Error ? error.message : 'Не удалось загрузить отчёт'
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/screen.tsx",
                    lineNumber: 184,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                    href: path,
                    children: "Обновить отчёт"
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/screen.tsx",
                    lineNumber: 185,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/screen.tsx",
            lineNumber: 183,
            columnNumber: 7
        }, this);
    }
}
}),
"[project]/wt-personnel/apps/web/src/app/today/dispatch.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "TODAY_VERTICALS",
    ()=>TODAY_VERTICALS,
    "anonymousHospitalityAllowed",
    ()=>anonymousHospitalityAllowed,
    "ownerSummaryClosed",
    ()=>ownerSummaryClosed,
    "todayScreen",
    ()=>todayScreen,
    "unresolvedTarget",
    ()=>unresolvedTarget
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2d$error$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/api-error.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$scope$2d$pointer$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/scope-pointer.ts [app-rsc] (ecmascript)");
;
;
const TODAY_VERTICALS = [
    'HOSPITALITY',
    'BEAUTY',
    'FOOD_SERVICE'
];
function anonymousHospitalityAllowed(input) {
    return !input.authRequired && input.nodeEnv !== 'production';
}
function todayScreen(me, opts = {
    allowAnonymousHospitality: false
}) {
    const c = me.context;
    const key = `${c?.businessId ?? ''}:${c?.locationId ?? ''}`;
    if (c?.vertical === 'HOSPITALITY') return {
        screen: 'HOSPITALITY',
        key
    };
    if (!me.user && opts.allowAnonymousHospitality) return {
        screen: 'HOSPITALITY',
        key
    };
    if ((c?.vertical === 'BEAUTY' || c?.vertical === 'FOOD_SERVICE') && c.businessId && c.locationId) return {
        screen: c.vertical,
        key
    };
    return {
        screen: 'UNRESOLVED',
        key
    };
}
function unresolvedTarget(hasPointer) {
    return hasPointer ? '/branches' : (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$scope$2d$pointer$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["scopeResolvePath"])('/today');
}
function ownerSummaryClosed(error) {
    return error instanceof __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2d$error$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ApiError"] && error.status === 403;
}
}),
"[project]/wt-personnel/apps/web/src/components/date-field.tsx [app-rsc] (client reference proxy)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DateInput",
    ()=>DateInput
]);
// This file is generated by next-core EcmascriptClientReferenceModule.
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const DateInput = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call DateInput() from the server but DateInput is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/wt-personnel/apps/web/src/components/date-field.tsx", "DateInput");
}),
"[project]/wt-personnel/apps/web/src/components/date-field.tsx [app-rsc] (client reference proxy) <module evaluation>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DateInput",
    ()=>DateInput
]);
// This file is generated by next-core EcmascriptClientReferenceModule.
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const DateInput = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call DateInput() from the server but DateInput is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/wt-personnel/apps/web/src/components/date-field.tsx <module evaluation>", "DateInput");
}),
"[project]/wt-personnel/apps/web/src/components/date-field.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$date$2d$field$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__$3c$module__evaluation$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/date-field.tsx [app-rsc] (client reference proxy) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$date$2d$field$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/date-field.tsx [app-rsc] (client reference proxy)");
;
__turbopack_context__.n(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$date$2d$field$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__);
}),
"[project]/wt-personnel/apps/web/src/components/tabs.tsx [app-rsc] (client reference proxy)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Tabs",
    ()=>Tabs,
    "rovingIndex",
    ()=>rovingIndex
]);
// This file is generated by next-core EcmascriptClientReferenceModule.
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const Tabs = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call Tabs() from the server but Tabs is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/wt-personnel/apps/web/src/components/tabs.tsx", "Tabs");
const rovingIndex = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call rovingIndex() from the server but rovingIndex is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/wt-personnel/apps/web/src/components/tabs.tsx", "rovingIndex");
}),
"[project]/wt-personnel/apps/web/src/components/tabs.tsx [app-rsc] (client reference proxy) <module evaluation>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Tabs",
    ()=>Tabs,
    "rovingIndex",
    ()=>rovingIndex
]);
// This file is generated by next-core EcmascriptClientReferenceModule.
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const Tabs = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call Tabs() from the server but Tabs is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/wt-personnel/apps/web/src/components/tabs.tsx <module evaluation>", "Tabs");
const rovingIndex = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call rovingIndex() from the server but rovingIndex is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/wt-personnel/apps/web/src/components/tabs.tsx <module evaluation>", "rovingIndex");
}),
"[project]/wt-personnel/apps/web/src/components/tabs.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$tabs$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__$3c$module__evaluation$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/tabs.tsx [app-rsc] (client reference proxy) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$tabs$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/tabs.tsx [app-rsc] (client reference proxy)");
;
__turbopack_context__.n(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$tabs$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__);
}),
"[project]/wt-personnel/apps/web/src/lib/food-data.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "completeFoodList",
    ()=>completeFoodList,
    "foodStatusActions",
    ()=>foodStatusActions,
    "occupiedAt",
    ()=>occupiedAt,
    "previousDate",
    ()=>previousDate,
    "shiftDate",
    ()=>shiftDate,
    "validFoodReservation",
    ()=>validFoodReservation,
    "weekdays",
    ()=>weekdays
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$status$2f$food$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/status/food.ts [app-rsc] (ecmascript)");
;
async function completeFoodList(load, valid = ()=>true) {
    let cursor;
    const cursors = new Set();
    const items = new Map();
    for(let page = 0; page < 1000; page++){
        const raw = await load(cursor);
        if (!raw || typeof raw !== 'object' || !('items' in raw) || !Array.isArray(raw.items) || !('nextCursor' in raw) || raw.nextCursor !== null && typeof raw.nextCursor !== 'string') throw new Error('Не удалось загрузить полный список. Обновите страницу.');
        for (const item of raw.items){
            if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !valid(item)) throw new Error('Некорректный ответ списка');
            items.set(item.id, item);
        }
        if (raw.nextCursor === null) return [
            ...items.values()
        ];
        if (!raw.items.length || !raw.nextCursor || cursors.has(raw.nextCursor)) throw new Error('Повтор страницы списка. Обновите страницу.');
        cursors.add(raw.nextCursor);
        cursor = raw.nextCursor;
    }
    throw new Error('Не удалось загрузить полный список. Обновите страницу.');
}
function occupiedAt(r, selected) {
    const at = Date.parse(selected);
    return [
        'BOOKED',
        'CONFIRMED',
        'SEATED'
    ].includes(r.status) && Date.parse(r.startsAt) <= at && at < Date.parse(r.endsAt);
}
function previousDate(date) {
    return shiftDate(date, -1);
}
function shiftDate(date, days) {
    const at = new Date(`${date}T12:00:00Z`);
    at.setUTCDate(at.getUTCDate() + days);
    return at.toISOString().slice(0, 10);
}
const foodStatusActions = {
    BOOKED: 'Бронь',
    CONFIRMED: 'Подтвердить',
    SEATED: 'Посадить',
    COMPLETED: 'Завершить',
    NO_SHOW: 'Не пришли',
    CANCELLED: 'Отменить'
};
const weekdays = [
    'Вс',
    'Пн',
    'Вт',
    'Ср',
    'Чт',
    'Пт',
    'Сб'
];
function validFoodReservation(value) {
    if (!value || typeof value !== 'object') return false;
    const r = value;
    return typeof r.id === 'string' && typeof r.status === 'string' && Object.hasOwn(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$status$2f$food$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["foodStatus"], r.status) && typeof r.startsAt === 'string' && typeof r.endsAt === 'string' && Number.isFinite(Date.parse(r.startsAt)) && Date.parse(r.endsAt) > Date.parse(r.startsAt) && (r.table === null || !!r.table && typeof r.table === 'object' && 'id' in r.table && typeof r.table.id === 'string' && 'areaId' in r.table && typeof r.table.areaId === 'string') && !!r.customer && typeof r.customer === 'object' && 'firstName' in r.customer && typeof r.customer.firstName === 'string' && Number.isInteger(r.partySize) && !!r.servicePeriod && typeof r.servicePeriod === 'object' && 'id' in r.servicePeriod && typeof r.servicePeriod.id === 'string' && 'name' in r.servicePeriod && typeof r.servicePeriod.name === 'string' && typeof r.updatedAt === 'string' && Number.isFinite(Date.parse(r.updatedAt)) && Array.isArray(r.nextStatuses) && r.nextStatuses.every((status)=>typeof status === 'string' && Object.hasOwn(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$status$2f$food$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["foodStatus"], status));
}
}),
"[project]/wt-personnel/apps/web/src/lib/search-params.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/** Next search parameters can repeat. Match URLSearchParams.get: the first value wins. */ __turbopack_context__.s([
    "normalizeSearchParams",
    ()=>normalizeSearchParams
]);
function normalizeSearchParams(params) {
    return Object.fromEntries(Object.entries(params).map(([key, value])=>[
            key,
            Array.isArray(value) ? value[0] : value
        ]));
}
}),
"[project]/wt-personnel/apps/web/src/lib/vertical-guard.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "requireFeature",
    ()=>requireFeature,
    "requireVertical",
    ()=>requireVertical
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$api$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/api/navigation.react-server.js [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/client/components/navigation.react-server.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2d$error$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/api-error.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$session$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/session.ts [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$desk$2d$shell$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/desk-shell.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$vertical$2d$landing$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/vertical-landing.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$scope$2d$gate$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/scope-gate.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$features$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/features.ts [app-rsc] (ecmascript)");
;
;
;
;
;
;
;
async function requireVertical(allowed) {
    const me = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$desk$2d$shell$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["currentMe"])().catch(async (error)=>{
        // /auth/me is quiet in the shared API client because login pages also use it.
        // A protected vertical must route expired sessions through the existing login gate.
        if (error instanceof __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2d$error$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ApiError"] && error.status === 401) await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$session$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["redirectToLoginIfRequired"])();
        throw error;
    });
    // Устаревший указатель: сначала выбор филиала, иначе страница отрисовалась бы на ответах 403 (SCOPE-HARDENING)
    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$scope$2d$gate$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["redirectIfScopeStale"])(me);
    const v = me.context?.vertical;
    if (v && [
        'HOSPITALITY',
        'BEAUTY',
        'FOOD_SERVICE'
    ].includes(v) && !allowed.includes(v)) (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["redirect"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$vertical$2d$landing$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["landingForVertical"])(v));
    return me;
}
async function requireFeature(route) {
    return requireVertical([
        ...(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$features$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["featureVerticals"])(route)
    ]);
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__03ebadd._.js.map