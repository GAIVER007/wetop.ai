(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/wt-personnel/apps/web/src/app/beauty/time.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
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
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/app/food/data:f65bfd [app-client] (ecmascript) <text/javascript>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "mutateOrder",
    ()=>$$RSC_SERVER_ACTION_1
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-client-wrapper.js [app-client] (ecmascript)");
/* __next_internal_action_entry_do_not_use__ [{"608326ab1ec2b1f56a3c8927f0ddc9ed003d357f32":{"name":"mutateOrder"}},"wt-personnel/apps/web/src/app/food/restaurant-actions.ts",""] */ "use turbopack no side effects";
;
const $$RSC_SERVER_ACTION_1 = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createServerReference"])("608326ab1ec2b1f56a3c8927f0ddc9ed003d357f32", __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["callServer"], void 0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["findSourceMapURL"], "mutateOrder");
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/app/food/kitchen-board.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "KitchenBoard",
    ()=>KitchenBoard
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/ui.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$beauty$2f$time$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/beauty/time.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$food$2f$data$3a$f65bfd__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/food/data:f65bfd [app-client] (ecmascript) <text/javascript>");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
;
;
const COLUMNS = [
    {
        id: 'NEW',
        title: 'Новые',
        action: 'COOKING',
        button: 'Принять'
    },
    {
        id: 'COOKING',
        title: 'Готовятся',
        action: 'READY',
        button: 'Готово'
    },
    {
        id: 'READY',
        title: 'Готово',
        action: 'SERVED',
        button: 'Отметить как выдано'
    }
];
function minutesAgo(iso, now) {
    return Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
}
function KitchenBoard({ scopeKey, timezone, write, orders }) {
    _s();
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"])();
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    const [pending, start] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTransition"])();
    const [now, setNow] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        "KitchenBoard.useState": ()=>Date.now()
    }["KitchenBoard.useState"]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "KitchenBoard.useEffect": ()=>{
            const timer = setInterval({
                "KitchenBoard.useEffect.timer": ()=>{
                    setNow(Date.now());
                    router.refresh();
                }
            }["KitchenBoard.useEffect.timer"], 30000);
            return ({
                "KitchenBoard.useEffect": ()=>clearInterval(timer)
            })["KitchenBoard.useEffect"];
        }
    }["KitchenBoard.useEffect"], [
        router
    ]);
    const clock = (iso)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$beauty$2f$time$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["localInput"])(iso, timezone).slice(11, 16);
    const delayed = orders.filter((o)=>o.delayed);
    function transition(order, status) {
        setError('');
        start(async ()=>{
            const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$food$2f$data$3a$f65bfd__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__["mutateOrder"])(scopeKey, {
                kind: 'status',
                id: order.id,
                body: {
                    expectedStatus: order.status,
                    expectedUpdatedAt: order.updatedAt,
                    status
                }
            });
            if (result.error) setError(result.error);
            router.refresh();
        });
    }
    const card = (o, action)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("article", {
            className: "rest-kds-card",
            "data-status": o.status,
            "data-delayed": o.delayed || undefined,
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "rest-kds-head",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                            children: [
                                "№",
                                o.number
                            ]
                        }, void 0, true, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/food/kitchen-board.tsx",
                            lineNumber: 68,
                            columnNumber: 9
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("time", {
                            dateTime: o.openedAt,
                            "data-late": o.delayed || undefined,
                            children: clock(o.openedAt)
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/food/kitchen-board.tsx",
                            lineNumber: 69,
                            columnNumber: 9
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/food/kitchen-board.tsx",
                    lineNumber: 67,
                    columnNumber: 7
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "rest-kds-table",
                    children: o.table ? `Стол ${o.table.name}` : 'Без стола'
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/food/kitchen-board.tsx",
                    lineNumber: 73,
                    columnNumber: 7
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                    className: "rest-kds-items",
                    children: o.items.map((i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    children: [
                                        i.name,
                                        i.notes && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("small", {
                                            children: i.notes
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/food/kitchen-board.tsx",
                                            lineNumber: 79,
                                            columnNumber: 27
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/food/kitchen-board.tsx",
                                    lineNumber: 77,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("b", {
                                    children: [
                                        "×",
                                        i.qty
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/food/kitchen-board.tsx",
                                    lineNumber: 81,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, i.id, true, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/food/kitchen-board.tsx",
                            lineNumber: 76,
                            columnNumber: 11
                        }, this))
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/food/kitchen-board.tsx",
                    lineNumber: 74,
                    columnNumber: 7
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("small", {
                    className: "muted",
                    children: [
                        minutesAgo(o.openedAt, now),
                        " мин в работе"
                    ]
                }, void 0, true, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/food/kitchen-board.tsx",
                    lineNumber: 85,
                    columnNumber: 7
                }, this),
                o.delayed && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Badge"], {
                    tone: "danger",
                    children: "Задерживается"
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/food/kitchen-board.tsx",
                    lineNumber: 86,
                    columnNumber: 21
                }, this),
                write && action && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                    size: "sm",
                    tone: o.status === 'READY' ? 'primary' : 'secondary',
                    disabled: pending,
                    onClick: ()=>transition(o, action.status),
                    children: action.button
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/food/kitchen-board.tsx",
                    lineNumber: 88,
                    columnNumber: 9
                }, this)
            ]
        }, o.id, true, {
            fileName: "[project]/wt-personnel/apps/web/src/app/food/kitchen-board.tsx",
            lineNumber: 61,
            columnNumber: 5
        }, this);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "food-workspace",
        "data-testid": "kitchen-board",
        children: [
            error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Alert"], {
                children: error
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/food/kitchen-board.tsx",
                lineNumber: 101,
                columnNumber: 17
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "rest-kds",
                children: [
                    COLUMNS.map((col)=>{
                        const list = orders.filter((o)=>o.status === col.id && !delayed.includes(o));
                        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                            className: "rest-kds-col",
                            "data-col": col.id,
                            "aria-label": col.title,
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                    children: [
                                        col.title,
                                        " (",
                                        list.length,
                                        ")"
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/food/kitchen-board.tsx",
                                    lineNumber: 107,
                                    columnNumber: 15
                                }, this),
                                list.map((o)=>card(o, {
                                        status: col.action,
                                        button: col.button
                                    })),
                                list.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "muted",
                                    children: "Пусто"
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/food/kitchen-board.tsx",
                                    lineNumber: 111,
                                    columnNumber: 37
                                }, this)
                            ]
                        }, col.id, true, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/food/kitchen-board.tsx",
                            lineNumber: 106,
                            columnNumber: 13
                        }, this);
                    }),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                        className: "rest-kds-col",
                        "data-col": "DELAYED",
                        "aria-label": "Задерживаются",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                children: [
                                    "Задерживаются (",
                                    delayed.length,
                                    ")"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/food/kitchen-board.tsx",
                                lineNumber: 116,
                                columnNumber: 11
                            }, this),
                            delayed.map((o)=>card(o, o.status === 'NEW' ? {
                                    status: 'COOKING',
                                    button: 'Принять'
                                } : {
                                    status: 'READY',
                                    button: 'Готово'
                                })),
                            delayed.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "muted",
                                children: "Кухня успевает"
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/food/kitchen-board.tsx",
                                lineNumber: 125,
                                columnNumber: 36
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/food/kitchen-board.tsx",
                        lineNumber: 115,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/food/kitchen-board.tsx",
                lineNumber: 102,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/food/kitchen-board.tsx",
        lineNumber: 100,
        columnNumber: 5
    }, this);
}
_s(KitchenBoard, "uKBaeHX3i2mPLwNe7CIGY5IL0N4=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"],
        __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTransition"]
    ];
});
_c = KitchenBoard;
var _c;
__turbopack_context__.k.register(_c, "KitchenBoard");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/components/error-state.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ErrorState",
    ()=>ErrorState
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$icon$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/icon.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/ui.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2d$error$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/api-error.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$desk$2d$access$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/desk-access.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
;
;
function ErrorState({ error, retry, title }) {
    _s();
    const status = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2d$error$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiErrorStatus"])(error.digest);
    const rejected = status !== undefined && status >= 400 && status < 500;
    // «Подключения» есть только у гостиницы (Channex): салону и ресторану ссылка увела бы на «Главную»
    const hotel = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$desk$2d$access$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useDeskVertical"])() === 'HOSPITALITY';
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["EmptyState"], {
        role: "alert",
        icon: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$icon$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Icon"], {
            name: "channels",
            width: 32,
            height: 32
        }, void 0, false, {
            fileName: "[project]/wt-personnel/apps/web/src/components/error-state.tsx",
            lineNumber: 30,
            columnNumber: 13
        }, this),
        title: title,
        details: error.digest && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("details", {
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("summary", {
                    children: "Код ошибки"
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/components/error-state.tsx",
                    lineNumber: 35,
                    columnNumber: 13
                }, this),
                error.digest
            ]
        }, void 0, true, {
            fileName: "[project]/wt-personnel/apps/web/src/components/error-state.tsx",
            lineNumber: 34,
            columnNumber: 11
        }, this),
        actions: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                    className: "btn",
                    onClick: ()=>retry(),
                    children: "Повторить загрузку"
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/components/error-state.tsx",
                    lineNumber: 42,
                    columnNumber: 11
                }, this),
                !rejected && hotel && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                    href: "/connections",
                    className: "btn btn--secondary",
                    children: "Подключения API"
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/components/error-state.tsx",
                    lineNumber: 46,
                    columnNumber: 13
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/wt-personnel/apps/web/src/components/error-state.tsx",
            lineNumber: 41,
            columnNumber: 9
        }, this),
        children: rejected ? `Сервер отклонил запрос (код ${status}): проверьте адрес страницы и даты в нём. Повтор с теми же данными даст тот же ответ.` : 'Проверьте подключение и повторите запрос.'
    }, void 0, false, {
        fileName: "[project]/wt-personnel/apps/web/src/components/error-state.tsx",
        lineNumber: 28,
        columnNumber: 5
    }, this);
}
_s(ErrorState, "uOxwJ9WyD3smh/PkmSfXnTVMK1U=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$desk$2d$access$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useDeskVertical"]
    ];
});
_c = ErrorState;
var _c;
__turbopack_context__.k.register(_c, "ErrorState");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/components/load-error.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "LoadError",
    ()=>LoadError
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$error$2d$state$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/error-state.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
function LoadError({ status, testId, title }) {
    _s();
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"])();
    // текста сбоя здесь нет (Д11): `ErrorState` советует по коду статуса
    const error = new Error('load failed');
    if (status) error.digest = `API_${status}`;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        "data-testid": testId,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$error$2d$state$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ErrorState"], {
            error: error,
            retry: ()=>router.refresh(),
            title: title
        }, void 0, false, {
            fileName: "[project]/wt-personnel/apps/web/src/components/load-error.tsx",
            lineNumber: 27,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/wt-personnel/apps/web/src/components/load-error.tsx",
        lineNumber: 26,
        columnNumber: 5
    }, this);
}
_s(LoadError, "fN7XvhJ+p5oE6+Xlo0NJmXpxjC8=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"]
    ];
});
_c = LoadError;
var _c;
__turbopack_context__.k.register(_c, "LoadError");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/lib/api-error.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Ошибка API и её `digest` — без серверных зависимостей. Клиентские компоненты (экран ошибки, граница
 * ошибок выезжающей карточки) берут `apiErrorStatus` отсюда, а не из `api.ts`: тот тянет `session.ts`
 * с `next/headers`, и в клиентском бандле сборка падает (слияние PR #10 и PR #11, 16.09.2026).
 */ __turbopack_context__.s([
    "ApiError",
    ()=>ApiError,
    "apiErrorDigest",
    ()=>apiErrorDigest,
    "apiErrorStatus",
    ()=>apiErrorStatus
]);
class ApiError extends Error {
    status;
    /**
   * Код статуса в `digest`: Next отдаёт границе ошибок клиента только digest (текст в production
   * вырезается), а уже имеющийся digest не переписывает — так экран ошибки отличает 400/404 от 503.
   */ digest;
    constructor(status, message){
        super(message), this.status = status;
        this.digest = apiErrorDigest(status);
    }
}
const apiErrorDigest = (status)=>`API_${status}`;
function apiErrorStatus(digest) {
    const m = /^API_(\d{3})$/.exec(digest ?? '');
    return m ? Number(m[1]) : undefined;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=wt-personnel_apps_web_src_0i121yd._.js.map