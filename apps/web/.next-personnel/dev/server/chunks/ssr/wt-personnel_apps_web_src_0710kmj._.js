module.exports = [
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
"[project]/wt-personnel/apps/web/src/app/cashbox/page.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>CashboxPage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-jsx-dev-runtime.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$api$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/api/navigation.react-server.js [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/client/components/navigation.react-server.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$page$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/page.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$load$2d$error$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/load-error.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$load$2d$error$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/load-error.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$food$2d$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/food-api.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$food$2f$cash$2d$board$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/food/cash-board.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$food$2f$restaurant$2d$load$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/food/restaurant-load.ts [app-rsc] (ecmascript)");
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
async function CashboxPage() {
    try {
        const shell = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$food$2f$restaurant$2d$load$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["restaurantShell"])(undefined, [
            'FOOD_SERVICE',
            'BEAUTY'
        ]);
        const cash = await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$food$2d$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["restaurantApi"].cash();
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$page$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Page"], {
            title: "Касса",
            subtitle: shell.vertical === 'BEAUTY' ? 'Деньги салона по способам оплаты: бар, приходы, расходы и выплаты' : 'Деньги филиала по способам оплаты: заказы, приходы, расходы и выплаты',
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$food$2f$cash$2d$board$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["CashBoard"], {
                    scopeKey: shell.scopeKey,
                    timezone: shell.timezone,
                    write: shell.canDesk && !shell.readOnly,
                    refunds: shell.canRefunds && !shell.readOnly,
                    cash: cash,
                    orders: shell.vertical === 'FOOD_SERVICE'
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/cashbox/page.tsx",
                    lineNumber: 26,
                    columnNumber: 11
                }, this)
            }, shell.scopeKey, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/cashbox/page.tsx",
                lineNumber: 25,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/wt-personnel/apps/web/src/app/cashbox/page.tsx",
            lineNumber: 17,
            columnNumber: 7
        }, this);
    } catch (error) {
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["unstable_rethrow"])(error);
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$page$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Page"], {
            title: "Касса",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$load$2d$error$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["LoadError"], {
                testId: "cashbox-load-error",
                ...(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$load$2d$error$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["loadErrorProps"])(error)
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/cashbox/page.tsx",
                lineNumber: 41,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/wt-personnel/apps/web/src/app/cashbox/page.tsx",
            lineNumber: 40,
            columnNumber: 7
        }, this);
    }
}
}),
"[project]/wt-personnel/apps/web/src/app/cashbox/page.tsx [app-rsc] (ecmascript, Next.js Server Component)", (function(__turbopack_context__){

__turbopack_context__.n(__turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/cashbox/page.tsx [app-rsc] (ecmascript)"));
}),
"[project]/wt-personnel/apps/web/src/app/food/cash-board.tsx [app-rsc] (client reference proxy)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CashBoard",
    ()=>CashBoard
]);
// This file is generated by next-core EcmascriptClientReferenceModule.
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const CashBoard = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call CashBoard() from the server but CashBoard is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/wt-personnel/apps/web/src/app/food/cash-board.tsx", "CashBoard");
}),
"[project]/wt-personnel/apps/web/src/app/food/cash-board.tsx [app-rsc] (client reference proxy) <module evaluation>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CashBoard",
    ()=>CashBoard
]);
// This file is generated by next-core EcmascriptClientReferenceModule.
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const CashBoard = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call CashBoard() from the server but CashBoard is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/wt-personnel/apps/web/src/app/food/cash-board.tsx <module evaluation>", "CashBoard");
}),
"[project]/wt-personnel/apps/web/src/app/food/cash-board.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$food$2f$cash$2d$board$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__$3c$module__evaluation$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/food/cash-board.tsx [app-rsc] (client reference proxy) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$food$2f$cash$2d$board$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/food/cash-board.tsx [app-rsc] (client reference proxy)");
;
__turbopack_context__.n(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$food$2f$cash$2d$board$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__);
}),
"[project]/wt-personnel/apps/web/src/app/food/restaurant-load.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "restaurantShell",
    ()=>restaurantShell
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$vertical$2d$guard$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/vertical-guard.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$desk$2d$shell$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/desk-shell.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$workspace$2d$context$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/workspace-context.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$navigation$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/navigation.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$beauty$2f$time$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/beauty/time.ts [app-rsc] (ecmascript)");
;
;
;
;
;
async function restaurantShell(dateParam, verticals = [
    'FOOD_SERVICE'
]) {
    const me = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$vertical$2d$guard$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["requireVertical"])([
        ...verticals
    ]);
    const vertical = me.context?.vertical;
    if (vertical !== 'FOOD_SERVICE' && vertical !== 'BEAUTY' || !verticals.includes(vertical) || !me.context?.businessId || !me.context.locationId) throw new Error('Выберите ресторан и филиал');
    const [shell, branch] = await Promise.all([
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$desk$2d$shell$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["deskShell"])(),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$workspace$2d$context$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["selectedWorkspaceBranch"])()
    ]);
    if (!branch) throw new Error('Выбранный филиал недоступен');
    const local = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$beauty$2f$time$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["localInput"])(new Date().toISOString(), branch.timezone);
    const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) && !Number.isNaN(Date.parse(dateParam)) ? dateParam : local.slice(0, 10);
    return {
        date,
        timezone: branch.timezone,
        branchName: branch.name,
        scopeKey: `${me.context.businessId}:${me.context.locationId}`,
        readOnly: shell.readOnly,
        canDesk: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$navigation$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["mayAccess"])(shell.access, 'desk'),
        canProperty: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$navigation$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["mayAccess"])(shell.access, 'property'),
        canStaff: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$navigation$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["mayAccess"])(shell.access, 'staff'),
        canRefunds: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$navigation$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["mayAccess"])(shell.access, 'refunds'),
        vertical
    };
}
}),
"[project]/wt-personnel/apps/web/src/components/load-error.tsx [app-rsc] (client reference proxy)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "LoadError",
    ()=>LoadError
]);
// This file is generated by next-core EcmascriptClientReferenceModule.
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const LoadError = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call LoadError() from the server but LoadError is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/wt-personnel/apps/web/src/components/load-error.tsx", "LoadError");
}),
"[project]/wt-personnel/apps/web/src/components/load-error.tsx [app-rsc] (client reference proxy) <module evaluation>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "LoadError",
    ()=>LoadError
]);
// This file is generated by next-core EcmascriptClientReferenceModule.
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const LoadError = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call LoadError() from the server but LoadError is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/wt-personnel/apps/web/src/components/load-error.tsx <module evaluation>", "LoadError");
}),
"[project]/wt-personnel/apps/web/src/components/load-error.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$load$2d$error$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__$3c$module__evaluation$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/load-error.tsx [app-rsc] (client reference proxy) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$load$2d$error$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/load-error.tsx [app-rsc] (client reference proxy)");
;
__turbopack_context__.n(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$load$2d$error$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__);
}),
"[project]/wt-personnel/apps/web/src/lib/food-api.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "foodApi",
    ()=>foodApi,
    "restaurantApi",
    ()=>restaurantApi,
    "stockApi",
    ()=>stockApi
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/api.ts [app-rsc] (ecmascript) <locals>");
;
const base = '/food-service';
const idPath = (collection, id)=>`${base}/${collection}/${encodeURIComponent(id)}`;
const query = (cursor, date)=>{
    const q = new URLSearchParams({
        limit: '100'
    });
    if (cursor) q.set('cursor', cursor);
    if (date) q.set('date', date);
    return `?${q}`;
};
const foodApi = {
    areas: (cursor)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getJsonPublic"])(`${base}/areas${query(cursor)}`),
    createArea: (body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('POST', `${base}/areas`, body),
    updateArea: (id, body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('PATCH', idPath('areas', id), body),
    /** Правила брони столов (§43): настройки и будущие закрытые дни */ bookingRules: ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getJsonPublic"])(`${base}/booking-rules`),
    setBookingRules: (rules)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('PUT', `${base}/booking-rules`, rules),
    addClosedDay: (body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('POST', `${base}/closed-days`, body),
    removeClosedDay: (id)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('DELETE', idPath('closed-days', id), {}),
    /** Схема зала (§42): расстановка зоны целиком */ setLayout: (areaId, tables)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('PUT', `${idPath('areas', areaId)}/layout`, {
            tables
        }),
    tables: (cursor)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getJsonPublic"])(`${base}/tables${query(cursor)}`),
    createTable: (body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('POST', `${base}/tables`, body),
    updateTable: (id, body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('PATCH', idPath('tables', id), body),
    periods: (cursor)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getJsonPublic"])(`${base}/service-periods${query(cursor)}`),
    createPeriod: (body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('POST', `${base}/service-periods`, body),
    updatePeriod: (id, body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('PATCH', idPath('service-periods', id), body),
    customers: (cursor)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getJsonPublic"])(`${base}/customers${query(cursor)}`),
    updateCustomer: (id, body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('PATCH', idPath('customers', id), body),
    reservations: (date, cursor)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getJsonPublic"])(`${base}/reservations${query(cursor, date)}`),
    create: (body, key)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('POST', `${base}/reservations`, body, {
            'Idempotency-Key': key
        }),
    update: (id, body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('PATCH', idPath('reservations', id), body),
    status: (id, body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('POST', `${idPath('reservations', id)}/status`, body),
    assign: (id, body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('PUT', `${idPath('reservations', id)}/table`, body),
    unassign: (id, body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('DELETE', `${idPath('reservations', id)}/table`, body)
};
const restaurantApi = {
    categories: (cursor)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getJsonPublic"])(`${base}/menu/categories${query(cursor)}`),
    createCategory: (body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('POST', `${base}/menu/categories`, body),
    updateCategory: (id, body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('PATCH', idPath('menu/categories', id), body),
    menuItems: (cursor)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getJsonPublic"])(`${base}/menu/items${query(cursor)}`),
    menuItem: (id)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getJsonPublic"])(idPath('menu/items', id)),
    createMenuItem: (body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('POST', `${base}/menu/items`, body),
    updateMenuItem: (id, body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('PATCH', idPath('menu/items', id), body),
    replaceIngredients: (id, ingredients)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('PUT', `${idPath('menu/items', id)}/ingredients`, {
            ingredients
        }),
    orders: (date, cursor)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getJsonPublic"])(`${base}/orders${query(cursor, date)}`),
    openOrders: (cursor)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getJsonPublic"])(`${base}/orders${query(cursor)}&open=1`),
    createOrder: (body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('POST', `${base}/orders`, body),
    updateOrder: (id, body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('PATCH', idPath('orders', id), body),
    orderStatus: (id, body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('POST', `${idPath('orders', id)}/status`, body),
    payOrder: (id, body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('POST', `${idPath('orders', id)}/payments`, body),
    rateOrder: (id, body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('POST', `${idPath('orders', id)}/rating`, body),
    /** Ссылка на оценку с телефона гостя (§40): ключ только в ответе, 72 часа */ ratingLink: (id)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('POST', `${idPath('orders', id)}/rating-link`, {}),
    voidPayment: (id, reason)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('POST', `${idPath('payments', id)}/void`, {
            reason
        }),
    /** Возврат по закрытому заказу (§56) */ refundOrder: (id, body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('POST', `${idPath('orders', id)}/refunds`, body),
    // период считает сервер (ADR-181); без дат прежние последние 100 строк для экрана «Касса»
    cash: (period)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getJsonPublic"])(`${base}/cash${period ? `?from=${period.from}&to=${period.to}` : ''}`),
    cashOperation: (body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('POST', `${base}/cash/operations`, body),
    voidCashOperation: (id)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('POST', `${idPath('cash/operations', id)}/void`, {}),
    cashReconciliation: (body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('POST', `${base}/cash/reconciliations`, body),
    payout: (id, body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('POST', `${idPath('employees', id)}/payouts`, body),
    tableCleaning: (id, needsCleaning)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('POST', `${idPath('tables', id)}/cleaning`, {
            needsCleaning
        }),
    report: (date)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getJsonPublic"])(`${base}/report?date=${date}`),
    employees: (cursor)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getJsonPublic"])(`${base}/employees${query(cursor)}`),
    assignEmployeePersonnelKind: (id, body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('PATCH', `${idPath('employees', id)}/personnel-kind`, body),
    createEmployee: (body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('POST', `${base}/employees`, body),
    updateEmployee: (id, body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('PATCH', idPath('employees', id), body),
    shifts: ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getJsonPublic"])(`${base}/shifts`),
    setShifts: (id, intervals, expectedRevision)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('PUT', `${idPath('employees', id)}/working-hours`, {
            intervals,
            expectedRevision
        }),
    payroll: (month)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getJsonPublic"])(`${base}/payroll?month=${month}`),
    setPaySettings: (id, body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('PUT', `${idPath('employees', id)}/pay-settings`, body),
    addPayAdjustment: (id, body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('POST', `${idPath('employees', id)}/pay-adjustments`, body)
};
const stockApi = {
    products: ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getJsonPublic"])(`${base}/stock/products`),
    createProduct: (body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('POST', `${base}/stock/products`, body),
    updateProduct: (id, body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('PATCH', idPath('stock/products', id), body),
    lots: (productId)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getJsonPublic"])(`${base}/stock/lots?productId=${encodeURIComponent(productId)}`),
    movements: ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getJsonPublic"])(`${base}/stock/movements`),
    receipt: (body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('POST', `${base}/stock/receipts`, body),
    reverseLot: (id)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('POST', `${idPath('stock/lots', id)}/reverse`, {}),
    writeOff: (body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('POST', `${base}/stock/write-offs`, body),
    inventory: (body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('POST', `${base}/stock/inventory`, body)
};
}),
"[project]/wt-personnel/apps/web/src/lib/load-error.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Отказ запроса → пропсы `LoadError`: только код статуса от `ApiError`. Текст ошибки не передаётся: пропсы
 * клиентского компонента попадают в RSC-данные страницы, а в тексте бывают внутренние адреса и подробности сбоя
 * (аудит платформы 17.10.2026, Д11); экран ошибки и так советует по коду. Лежит отдельно от клиентского
 * компонента: функцию зовёт серверная страница, а из модуля `'use client'` сервер её звать не может.
 */ __turbopack_context__.s([
    "loadErrorProps",
    ()=>loadErrorProps
]);
function loadErrorProps(e) {
    const status = typeof e === 'object' && e !== null && 'status' in e && typeof e.status === 'number' ? e.status : undefined;
    return {
        status
    };
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

//# sourceMappingURL=wt-personnel_apps_web_src_0710kmj._.js.map