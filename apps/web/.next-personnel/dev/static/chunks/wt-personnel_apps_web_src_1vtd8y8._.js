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
"[project]/wt-personnel/apps/web/src/app/food/bar-board.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "BarBoard",
    ()=>BarBoard
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$icon$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/icon.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/ui.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$dashboard$2d$format$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/dashboard-format.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$status$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/status/types.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$status$2f$food$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/status/food.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$beauty$2f$time$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/beauty/time.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$food$2f$order$2d$drawer$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$food$2f$timeline$2d$board$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/food/timeline-board.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
;
;
;
;
;
;
// ponytail: напитки узнаются по названию категории меню, флага «бар» в модели нет (Q-REST-9);
// если таких категорий нет, витрина показывает всё меню
const DRINK = /напит|бар|кокт|пив|вин|алког|виск|сок|кофе|чай|лимонад/i;
function BarBoard({ ctx, orders }) {
    _s();
    const drinkCats = ctx.categories.filter((c)=>c.active && DRINK.test(c.name));
    const cats = drinkCats.length ? drinkCats : ctx.categories.filter((c)=>c.active);
    const [category, setCategory] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(cats[0]?.id ?? '');
    const [draft, setDraft] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const catIds = new Set(cats.map((c)=>c.id));
    const drinkIds = new Set(ctx.menuItems.filter((m)=>catIds.has(m.categoryId)).map((m)=>m.id));
    const current = orders.filter((o)=>o.status !== 'SERVED' && o.items.some((i)=>i.menuItemId && drinkIds.has(i.menuItemId))).sort((a, b)=>a.openedAt.localeCompare(b.openedAt));
    const items = ctx.menuItems.filter((m)=>m.active && m.categoryId === category);
    const clock = (iso)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$beauty$2f$time$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["localInput"])(iso, ctx.timezone).slice(11, 16);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "rest-bar-screen",
        "data-testid": "bar-board",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                className: "rest-bar-orders",
                "aria-labelledby": "bar-orders-title",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                        id: "bar-orders-title",
                        children: [
                            "Текущие заказы ",
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("small", {
                                children: [
                                    "(",
                                    current.length,
                                    ")"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/food/bar-board.tsx",
                                lineNumber: 37,
                                columnNumber: 26
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/food/bar-board.tsx",
                        lineNumber: 36,
                        columnNumber: 9
                    }, this),
                    current.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "muted",
                        children: "Открытых заказов с напитками нет"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/food/bar-board.tsx",
                        lineNumber: 40,
                        columnNumber: 11
                    }, this) : current.map((o)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            type: "button",
                            className: "rest-kds-card rest-bar-order",
                            "data-status": o.status,
                            onClick: ()=>setDraft({
                                    kind: 'view',
                                    order: o
                                }),
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "rest-kds-head",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                            children: [
                                                "№",
                                                o.number
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/food/bar-board.tsx",
                                            lineNumber: 51,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("time", {
                                            dateTime: o.openedAt,
                                            children: clock(o.openedAt)
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/food/bar-board.tsx",
                                            lineNumber: 52,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/food/bar-board.tsx",
                                    lineNumber: 50,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "rest-kds-table",
                                    children: o.table ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$food$2f$timeline$2d$board$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["tableTitle"])(o.table.name) : 'Без стола'
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/food/bar-board.tsx",
                                    lineNumber: 54,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                                    className: "rest-kds-items",
                                    children: o.items.filter((i)=>i.menuItemId && drinkIds.has(i.menuItemId)).map((i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    children: i.name
                                                }, void 0, false, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/app/food/bar-board.tsx",
                                                    lineNumber: 60,
                                                    columnNumber: 23
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("b", {
                                                    children: [
                                                        "×",
                                                        i.qty
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/app/food/bar-board.tsx",
                                                    lineNumber: 61,
                                                    columnNumber: 23
                                                }, this)
                                            ]
                                        }, i.id, true, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/food/bar-board.tsx",
                                            lineNumber: 59,
                                            columnNumber: 21
                                        }, this))
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/food/bar-board.tsx",
                                    lineNumber: 55,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Badge"], {
                                    tone: __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BADGE_TONE"][(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$status$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["statusTone"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$status$2f$food$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["foodOrderStatus"], o.status)],
                                    children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$status$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["statusLabel"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$status$2f$food$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["foodOrderStatus"], o.status)
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/food/bar-board.tsx",
                                    lineNumber: 65,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, o.id, true, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/food/bar-board.tsx",
                            lineNumber: 43,
                            columnNumber: 13
                        }, this))
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/food/bar-board.tsx",
                lineNumber: 35,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                className: "rest-bar-menu",
                "aria-label": "Напитки",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("nav", {
                        className: "rest-utabs",
                        "aria-label": "Категории напитков",
                        children: cats.map((c)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                type: "button",
                                "aria-current": category === c.id ? 'page' : undefined,
                                onClick: ()=>setCategory(c.id),
                                children: c.name
                            }, c.id, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/food/bar-board.tsx",
                                lineNumber: 75,
                                columnNumber: 13
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/food/bar-board.tsx",
                        lineNumber: 73,
                        columnNumber: 9
                    }, this),
                    items.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "muted",
                        children: "В этой категории пока нет позиций"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/food/bar-board.tsx",
                        lineNumber: 86,
                        columnNumber: 11
                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "rest-pos-grid",
                        children: items.map((m)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                type: "button",
                                className: "rest-pos-dish",
                                disabled: !ctx.write,
                                "aria-label": `Новый заказ: ${m.name}, ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$dashboard$2d$format$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["wholeTenge"])(m.priceMinor, m.currency)}`,
                                onClick: ()=>setDraft({
                                        kind: 'create',
                                        items: [
                                            {
                                                menuItemId: m.id,
                                                qty: 1
                                            }
                                        ]
                                    }),
                                children: [
                                    m.photoUrl ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                                        src: m.photoUrl,
                                        alt: "",
                                        width: 160,
                                        height: 120
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/food/bar-board.tsx",
                                        lineNumber: 99,
                                        columnNumber: 19
                                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "rest-pos-dish__ph",
                                        "aria-hidden": "true",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$icon$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Icon"], {
                                            name: "breakfast"
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/food/bar-board.tsx",
                                            lineNumber: 102,
                                            columnNumber: 21
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/food/bar-board.tsx",
                                        lineNumber: 101,
                                        columnNumber: 19
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "rest-pos-dish__name",
                                        children: m.name
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/food/bar-board.tsx",
                                        lineNumber: 105,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                        children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$dashboard$2d$format$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["wholeTenge"])(m.priceMinor, m.currency)
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/food/bar-board.tsx",
                                        lineNumber: 106,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, m.id, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/food/bar-board.tsx",
                                lineNumber: 90,
                                columnNumber: 15
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/food/bar-board.tsx",
                        lineNumber: 88,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/food/bar-board.tsx",
                lineNumber: 72,
                columnNumber: 7
            }, this),
            draft && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$food$2f$order$2d$drawer$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["OrderDrawer"], {
                ctx: ctx,
                draft: draft,
                close: ()=>setDraft(null)
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/food/bar-board.tsx",
                lineNumber: 112,
                columnNumber: 17
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/food/bar-board.tsx",
        lineNumber: 34,
        columnNumber: 5
    }, this);
}
_s(BarBoard, "p4rSh2k6ON1iMYsTNrQyw9tG710=");
_c = BarBoard;
var _c;
__turbopack_context__.k.register(_c, "BarBoard");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/app/food/data:964c74 [app-client] (ecmascript) <text/javascript>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "orderRatingLink",
    ()=>$$RSC_SERVER_ACTION_2
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-client-wrapper.js [app-client] (ecmascript)");
/* __next_internal_action_entry_do_not_use__ [{"60575be475df5ebb8f39f0515f82cb9a368131300b":{"name":"orderRatingLink"}},"wt-personnel/apps/web/src/app/food/restaurant-actions.ts",""] */ "use turbopack no side effects";
;
const $$RSC_SERVER_ACTION_2 = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createServerReference"])("60575be475df5ebb8f39f0515f82cb9a368131300b", __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["callServer"], void 0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["findSourceMapURL"], "orderRatingLink");
;
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
"[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "OrderDrawer",
    ()=>OrderDrawer
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$overlay$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/overlay.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$icon$2d$field$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/icon-field.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$icon$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/icon.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/ui.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$dashboard$2d$format$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/dashboard-format.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$money$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/money.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$food$2d$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/food-types.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$beauty$2f$time$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/beauty/time.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$food$2f$data$3a$f65bfd__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/food/data:f65bfd [app-client] (ecmascript) <text/javascript>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$food$2f$data$3a$964c74__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/food/data:964c74 [app-client] (ecmascript) <text/javascript>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$use$2d$confirm$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/use-confirm.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$food$2f$rating$2d$parts$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/food/rating-parts.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature(), _s2 = __turbopack_context__.k.signature(), _s3 = __turbopack_context__.k.signature();
'use client';
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
const STATUS_ACTION = {
    NEW: 'Вернуть в новые',
    COOKING: 'Принять в работу',
    READY: 'Готово',
    SERVED: 'Подать',
    CLOSED: 'Закрыть заказ',
    CANCELLED: 'Отменить заказ'
};
/** Оценка гостя после оплаты (§39): гость сам ставит 1–5 звёзд на устройстве смены, оценка не правится */ function RatingPanel({ ctx, order, onSaved }) {
    _s();
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"])();
    const [pending, start] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTransition"])();
    const [stars, setStars] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(0);
    const [comment, setComment] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    const [link, setLink] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    if (order.status !== 'CLOSED') return null;
    if (order.rating) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        className: "rest-rating",
        "aria-label": "Оценка гостя",
        "data-testid": "order-rating",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "rest-stars",
                "aria-label": `Оценка ${order.rating.stars} из 5`,
                children: [
                    '★'.repeat(order.rating.stars),
                    '☆'.repeat(5 - order.rating.stars)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                lineNumber: 71,
                columnNumber: 9
            }, this),
            order.rating.comment && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                children: order.rating.comment
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                lineNumber: 75,
                columnNumber: 34
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
        lineNumber: 70,
        columnNumber: 7
    }, this);
    if (!ctx.write) return null;
    function send() {
        if (!stars) return setError('Выберите от 1 до 5 звёзд');
        start(async ()=>{
            const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$food$2f$data$3a$f65bfd__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__["mutateOrder"])(ctx.scopeKey, {
                kind: 'rate',
                id: order.id,
                body: {
                    stars,
                    comment: comment.trim() || null
                }
            });
            if (result.error) setError(result.error);
            else if (result.order) {
                setError('');
                onSaved(result.order);
                router.refresh();
            }
        });
    }
    function qr() {
        start(async ()=>{
            const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$food$2f$data$3a$964c74__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__["orderRatingLink"])(ctx.scopeKey, order.id);
            if (result.error || !result.token) return setError(result.error ?? 'Ссылка не выдана');
            setError('');
            setLink({
                url: `${window.location.origin}/rate/${result.token}`,
                expiresAt: result.expiresAt ?? ''
            });
        });
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        className: "rest-rating",
        "aria-label": "Оцените обслуживание",
        "data-testid": "order-rating",
        children: [
            error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Alert"], {
                children: error
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                lineNumber: 105,
                columnNumber: 17
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                children: [
                    "Оцените обслуживание",
                    order.waiter ? `: ${order.waiter.name}` : ''
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                lineNumber: 106,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$food$2f$rating$2d$parts$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StarsInput"], {
                value: stars,
                onChange: setStars
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                lineNumber: 107,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                label: "Комментарий гостя",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                    value: comment,
                    maxLength: 500,
                    onChange: (e)=>setComment(e.target.value)
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                    lineNumber: 109,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                lineNumber: 108,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                disabled: pending,
                onClick: send,
                children: "Отправить оценку"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                lineNumber: 111,
                columnNumber: 7
            }, this),
            link ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "rest-qr-box",
                "data-testid": "order-rating-qr",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$food$2f$rating$2d$parts$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["QrCode"], {
                        text: link.url,
                        label: "QR-код: оценка с телефона гостя"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                        lineNumber: 116,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "muted",
                        children: "Гость наводит камеру и ставит оценку сам. Ссылка одна на заказ и действует 72 часа."
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                        lineNumber: 117,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                        href: link.url,
                        target: "_blank",
                        rel: "noreferrer",
                        className: "rest-qr-link",
                        children: link.url
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                        lineNumber: 120,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                lineNumber: 115,
                columnNumber: 9
            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                tone: "secondary",
                disabled: pending,
                onClick: qr,
                children: "QR-код для гостя"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                lineNumber: 125,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
        lineNumber: 104,
        columnNumber: 5
    }, this);
}
_s(RatingPanel, "Rbtw90xc+oRT386pycyrZtsbvS4=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"],
        __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTransition"]
    ];
});
_c = RatingPanel;
/** Оплата заказа частями и разными способами (§35.1): остаток, платежи, аннулирование */ function PaymentPanel({ ctx, order, onSaved }) {
    _s1();
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"])();
    const [pending, start] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTransition"])();
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    const remaining = BigInt(order.totalMinor) - BigInt(order.paidMinor);
    const [method, setMethod] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('CASH');
    const [amount, setAmount] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(String(remaining / 100n));
    const [voiding, setVoiding] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [reason, setReason] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    const open = order.status !== 'CLOSED' && order.status !== 'CANCELLED';
    // возврат по закрытому заказу (§56): не больше чистой оплаты, право `refunds`
    const net = BigInt(order.paidMinor) - BigInt(order.refundedMinor);
    const refundable = ctx.refunds && order.status === 'CLOSED' && net > 0n;
    const [refundMethod, setRefundMethod] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('CASH');
    const [refundAmount, setRefundAmount] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(String(net / 100n));
    const [refundReason, setRefundReason] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    function refund() {
        const tenge = Number(refundAmount);
        if (!Number.isInteger(tenge) || tenge <= 0) return setError('Сумма: целое число больше нуля');
        if (!refundReason.trim()) return setError('Укажите причину возврата');
        start(async ()=>done(await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$food$2f$data$3a$f65bfd__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__["mutateOrder"])(ctx.scopeKey, {
                kind: 'refund',
                id: order.id,
                body: {
                    method: refundMethod,
                    amount: tenge * 100,
                    reason: refundReason.trim(),
                    idempotencyKey: crypto.randomUUID()
                }
            })));
    }
    const done = (result)=>{
        if (result.error) {
            setError(result.error);
            if (result.stale) router.refresh();
        } else if (result.order) {
            setError('');
            setVoiding(null);
            setReason('');
            setAmount(String((BigInt(result.order.totalMinor) - BigInt(result.order.paidMinor)) / 100n));
            setRefundAmount(String((BigInt(result.order.paidMinor) - BigInt(result.order.refundedMinor)) / 100n));
            setRefundReason('');
            onSaved(result.order);
            router.refresh();
        }
    };
    function pay() {
        const tenge = Number(amount);
        if (!Number.isInteger(tenge) || tenge <= 0) return setError('Сумма: целое число больше нуля');
        start(async ()=>done(await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$food$2f$data$3a$f65bfd__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__["mutateOrder"])(ctx.scopeKey, {
                kind: 'pay',
                id: order.id,
                body: {
                    method,
                    amount: tenge * 100,
                    idempotencyKey: crypto.randomUUID()
                }
            })));
    }
    function voidPayment(id) {
        if (!reason.trim()) return setError('Укажите причину аннулирования');
        start(async ()=>done(await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$food$2f$data$3a$f65bfd__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__["mutateOrder"])(ctx.scopeKey, {
                kind: 'void-payment',
                id,
                reason: reason.trim()
            })));
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        className: "rest-pay",
        "aria-label": "Оплата заказа",
        "data-testid": "order-payment",
        children: [
            error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Alert"], {
                children: error
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                lineNumber: 208,
                columnNumber: 17
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dl", {
                className: "rest-pay-sum",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                        children: "Оплачено"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                        lineNumber: 210,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                        "data-testid": "order-paid",
                        children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$dashboard$2d$format$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["wholeTenge"])(order.paidMinor, order.currency)
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                        lineNumber: 211,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                        children: "Осталось"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                        lineNumber: 212,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                        "data-testid": "order-remaining",
                        children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$dashboard$2d$format$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["wholeTenge"])(String(remaining), order.currency)
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                        lineNumber: 213,
                        columnNumber: 9
                    }, this),
                    BigInt(order.refundedMinor) > 0n && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                children: "Возвращено"
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                lineNumber: 216,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                "data-testid": "order-refunded",
                                children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$dashboard$2d$format$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["wholeTenge"])(order.refundedMinor, order.currency)
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                lineNumber: 217,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                        lineNumber: 215,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                lineNumber: 209,
                columnNumber: 7
            }, this),
            order.payments.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                className: "rest-pay-list",
                children: order.payments.map((p)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                        "data-status": p.status,
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$dashboard$2d$format$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["METHOD_RU"][p.method] ?? p.method
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                lineNumber: 225,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$dashboard$2d$format$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["wholeTenge"])(p.amountMinor, order.currency)
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                lineNumber: 226,
                                columnNumber: 15
                            }, this),
                            p.status === 'VOIDED' ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("small", {
                                children: [
                                    "Аннулирован",
                                    p.voidReason ? `: ${p.voidReason}` : ''
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                lineNumber: 228,
                                columnNumber: 17
                            }, this) : ctx.refunds && open && (voiding === p.id ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "rest-pay-void",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                        "aria-label": "Причина аннулирования",
                                        placeholder: "Причина",
                                        value: reason,
                                        onChange: (e)=>setReason(e.target.value)
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                        lineNumber: 234,
                                        columnNumber: 21
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                        tone: "danger",
                                        disabled: pending,
                                        onClick: ()=>voidPayment(p.id),
                                        children: "Аннулировать"
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                        lineNumber: 240,
                                        columnNumber: 21
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                lineNumber: 233,
                                columnNumber: 19
                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                tone: "secondary",
                                disabled: pending,
                                onClick: ()=>setVoiding(p.id),
                                children: "Аннулировать"
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                lineNumber: 245,
                                columnNumber: 19
                            }, this))
                        ]
                    }, p.id, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                        lineNumber: 224,
                        columnNumber: 13
                    }, this))
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                lineNumber: 222,
                columnNumber: 9
            }, this),
            ctx.write && open && remaining > 0n && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "food-form-row",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                        label: "Способ",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Select"], {
                            value: method,
                            onChange: (e)=>setMethod(e.target.value),
                            children: __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$food$2d$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FOOD_PAYMENT_METHODS"].map((m)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                    value: m,
                                    children: __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$dashboard$2d$format$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["METHOD_RU"][m] ?? m
                                }, m, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                    lineNumber: 259,
                                    columnNumber: 17
                                }, this))
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                            lineNumber: 257,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                        lineNumber: 256,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                        label: `Сумма, ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$money$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["currencySign"])(order.currency)}`,
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                            inputMode: "numeric",
                            value: amount,
                            onChange: (e)=>setAmount(e.target.value.replace(/\D/g, ''))
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                            lineNumber: 266,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                        lineNumber: 265,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                        disabled: pending,
                        onClick: pay,
                        children: "Принять оплату"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                        lineNumber: 272,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                lineNumber: 255,
                columnNumber: 9
            }, this),
            open && remaining === 0n && order.status !== 'SERVED' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "muted",
                children: "Оплачено полностью: заказ закроется сам, когда его подадут."
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                lineNumber: 278,
                columnNumber: 9
            }, this),
            refundable && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                className: "food-form",
                "aria-label": "Возврат по заказу",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "food-form-row",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                                label: "Способ возврата",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Select"], {
                                    value: refundMethod,
                                    onChange: (e)=>setRefundMethod(e.target.value),
                                    children: __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$food$2d$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FOOD_PAYMENT_METHODS"].map((m)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                            value: m,
                                            children: __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$dashboard$2d$format$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["METHOD_RU"][m] ?? m
                                        }, m, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                            lineNumber: 286,
                                            columnNumber: 19
                                        }, this))
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                    lineNumber: 284,
                                    columnNumber: 15
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                lineNumber: 283,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                                label: `Сумма возврата, ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$money$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["currencySign"])(order.currency)}`,
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                    inputMode: "numeric",
                                    value: refundAmount,
                                    onChange: (e)=>setRefundAmount(e.target.value.replace(/\D/g, ''))
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                    lineNumber: 293,
                                    columnNumber: 15
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                lineNumber: 292,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                        lineNumber: 282,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                        label: "Причина возврата",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                            value: refundReason,
                            maxLength: 300,
                            onChange: (e)=>setRefundReason(e.target.value)
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                            lineNumber: 297,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                        lineNumber: 296,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                        tone: "danger",
                        disabled: pending,
                        onClick: refund,
                        children: "Оформить возврат"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                        lineNumber: 299,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                lineNumber: 281,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
        lineNumber: 207,
        columnNumber: 5
    }, this);
}
_s1(PaymentPanel, "dQddvbVofJxtUpmgN6WCc7bo9Us=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"],
        __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTransition"]
    ];
});
_c1 = PaymentPanel;
/** Выбор блюд по макету POS (экран 5): вкладки категорий, поиск, плитки с фото и ценой; щелчок добавляет порцию */ function DishPicker({ ctx, items, setItems }) {
    _s2();
    const [category, setCategory] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    const [query, setQuery] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    const q = query.trim().toLocaleLowerCase('ru');
    const dishes = ctx.menuItems.filter((m)=>m.active && (!category || m.categoryId === category) && (!q || m.name.toLocaleLowerCase('ru').includes(q)));
    const add = (id)=>{
        const index = items.findIndex((i)=>i.menuItemId === id);
        if (index >= 0) setItems(items.map((item, i)=>i === index ? {
                ...item,
                qty: item.qty + 1
            } : item));
        else setItems([
            ...items,
            {
                menuItemId: id,
                qty: 1
            }
        ]);
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "rest-pos-menu",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("nav", {
                className: "rest-utabs",
                "aria-label": "Категории меню",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        "aria-current": !category ? 'page' : undefined,
                        onClick: ()=>setCategory(''),
                        children: "Все блюда"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                        lineNumber: 336,
                        columnNumber: 9
                    }, this),
                    ctx.categories.filter((c)=>c.active).map((c)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            type: "button",
                            "aria-current": category === c.id ? 'page' : undefined,
                            onClick: ()=>setCategory(c.id),
                            children: c.name
                        }, c.id, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                            lineNumber: 342,
                            columnNumber: 13
                        }, this))
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                lineNumber: 335,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                label: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "sr-only",
                    children: "Поиск блюда"
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                    lineNumber: 352,
                    columnNumber: 21
                }, this),
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$icon$2d$field$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["IconField"], {
                    icon: "search",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                        type: "search",
                        placeholder: "Поиск блюда",
                        value: query,
                        onChange: (e)=>setQuery(e.target.value)
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                        lineNumber: 354,
                        columnNumber: 11
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                    lineNumber: 353,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                lineNumber: 352,
                columnNumber: 7
            }, this),
            dishes.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "muted",
                children: "Блюд не найдено"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                lineNumber: 363,
                columnNumber: 9
            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "rest-pos-grid",
                children: dishes.map((m)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        className: "rest-pos-dish",
                        "aria-label": `Добавить: ${m.name}, ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$dashboard$2d$format$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["wholeTenge"])(m.priceMinor, m.currency)}`,
                        onClick: ()=>add(m.id),
                        children: [
                            m.photoUrl ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                                src: m.photoUrl,
                                alt: "",
                                width: 160,
                                height: 120
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                lineNumber: 375,
                                columnNumber: 17
                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "rest-pos-dish__ph",
                                "aria-hidden": "true",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$icon$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Icon"], {
                                    name: "kettle"
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                    lineNumber: 378,
                                    columnNumber: 19
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                lineNumber: 377,
                                columnNumber: 17
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "rest-pos-dish__name",
                                children: m.name
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                lineNumber: 381,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$dashboard$2d$format$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["wholeTenge"])(m.priceMinor, m.currency)
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                lineNumber: 382,
                                columnNumber: 15
                            }, this)
                        ]
                    }, m.id, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                        lineNumber: 367,
                        columnNumber: 13
                    }, this))
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                lineNumber: 365,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
        lineNumber: 334,
        columnNumber: 5
    }, this);
}
_s2(DishPicker, "2yozUVWaUI4e/ynCbiTNTb8pRvM=");
_c2 = DishPicker;
/** Текущий заказ справа: строки с количеством, итог по ценам меню */ function CurrentOrder({ ctx, items, setItems }) {
    const byId = new Map(ctx.menuItems.map((m)=>[
            m.id,
            m
        ]));
    const total = items.reduce((acc, i)=>acc + BigInt(byId.get(i.menuItemId)?.priceMinor ?? '0') * BigInt(i.qty), 0n);
    const change = (index, qty)=>{
        if (qty <= 0) setItems(items.filter((_, i)=>i !== index));
        else setItems(items.map((item, i)=>i === index ? {
                ...item,
                qty
            } : item));
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "rest-order-items",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                children: [
                    "Текущий заказ ",
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("small", {
                        children: [
                            "(",
                            items.reduce((acc, i)=>acc + i.qty, 0),
                            ")"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                        lineNumber: 413,
                        columnNumber: 23
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                lineNumber: 412,
                columnNumber: 7
            }, this),
            items.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "muted",
                children: "Выберите блюда слева"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                lineNumber: 415,
                columnNumber: 30
            }, this),
            items.map((item, index)=>{
                const m = byId.get(item.menuItemId);
                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "rest-order-item rest-order-item--pos",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "rest-order-qty",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                    tone: "ghost",
                                    "aria-label": "Меньше",
                                    onClick: ()=>change(index, item.qty - 1),
                                    children: "−"
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                    lineNumber: 421,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    "aria-label": "Количество",
                                    children: item.qty
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                    lineNumber: 424,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                    tone: "ghost",
                                    "aria-label": "Больше",
                                    onClick: ()=>change(index, item.qty + 1),
                                    children: "+"
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                    lineNumber: 425,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                            lineNumber: 420,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                            children: m?.name ?? 'Блюдо'
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                            lineNumber: 429,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "rest-tech-cost",
                            children: m ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$dashboard$2d$format$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["wholeTenge"])(String(BigInt(m.priceMinor) * BigInt(item.qty)), m.currency) : '—'
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                            lineNumber: 430,
                            columnNumber: 13
                        }, this)
                    ]
                }, item.menuItemId, true, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                    lineNumber: 419,
                    columnNumber: 11
                }, this);
            }),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "rest-order-total",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        children: "Итого"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                        lineNumber: 437,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                        "data-testid": "order-draft-total",
                        children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$dashboard$2d$format$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["wholeTenge"])(String(total))
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                        lineNumber: 438,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                lineNumber: 436,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
        lineNumber: 411,
        columnNumber: 5
    }, this);
}
_c3 = CurrentOrder;
function OrderDrawer({ ctx, draft, close }) {
    _s3();
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"])();
    const { ask, dialog } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$use$2d$confirm$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useConfirm"])();
    const [saved, setSaved] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    const [pending, start] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTransition"])();
    const initial = draft.kind === 'view' ? draft.order : null;
    const order = saved && (!initial || Date.parse(saved.updatedAt) >= Date.parse(initial.updatedAt)) ? saved : initial;
    const [editing, setEditing] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(draft.kind === 'create');
    const [tableId, setTableId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(draft.kind === 'create' ? draft.tableId ?? '' : order?.tableId ?? '');
    const [waiterId, setWaiterId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(order?.waiter?.id ?? '');
    const [guestCount, setGuestCount] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(order?.guestCount ?? 2);
    const [notes, setNotes] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(order?.notes ?? '');
    const [items, setItems] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(order?.items.filter({
        "OrderDrawer.useState": (i)=>i.menuItemId
    }["OrderDrawer.useState"]).map({
        "OrderDrawer.useState": (i)=>({
                menuItemId: i.menuItemId,
                qty: i.qty,
                notes: i.notes
            })
    }["OrderDrawer.useState"]) ?? (draft.kind === 'create' ? draft.items ?? [] : []));
    const areaName = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "OrderDrawer.useMemo[areaName]": ()=>new Map(ctx.areas.map({
                "OrderDrawer.useMemo[areaName]": (a)=>[
                        a.id,
                        a.name
                    ]
            }["OrderDrawer.useMemo[areaName]"]))
    }["OrderDrawer.useMemo[areaName]"], [
        ctx.areas
    ]);
    const tableLabel = (t)=>`${areaName.get(t.areaId) ?? ''}, ${t.name}`.replace(/^, /, '');
    const clock = (iso)=>iso ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$beauty$2f$time$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["localInput"])(iso, ctx.timezone).slice(11, 16) : '—';
    function submit() {
        setError('');
        start(async ()=>{
            const body = {
                tableId: tableId || null,
                waiterId: waiterId || null,
                guestCount,
                notes: notes.trim() ? notes.trim() : null,
                items
            };
            const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$food$2f$data$3a$f65bfd__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__["mutateOrder"])(ctx.scopeKey, order ? {
                kind: 'edit',
                id: order.id,
                body: {
                    expectedStatus: order.status,
                    expectedUpdatedAt: order.updatedAt,
                    ...body
                }
            } : {
                kind: 'create',
                body
            });
            if (result.error) {
                setError(result.error);
                if (result.stale) router.refresh();
            } else if (result.order) {
                setSaved(result.order);
                setEditing(false);
                router.refresh();
            }
        });
    }
    async function transition(status) {
        if (!order) return;
        // отмена необратима: заказ уходит в терминальный статус, состав замораживается (ADR-182, DESIGN.md §14)
        if (status === 'CANCELLED' && !await ask({
            title: `Отменить заказ №${order.number}?`,
            body: 'Заказ станет отменённым, вернуть его в работу нельзя. Кухня готовить не будет.',
            confirmLabel: 'Отменить заказ',
            tone: 'danger'
        })) return;
        setError('');
        start(async ()=>{
            const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$food$2f$data$3a$f65bfd__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__["mutateOrder"])(ctx.scopeKey, {
                kind: 'status',
                id: order.id,
                body: {
                    expectedStatus: order.status,
                    expectedUpdatedAt: order.updatedAt,
                    status
                }
            });
            if (result.error) {
                setError(result.error);
                if (result.stale) router.refresh();
            } else if (result.order) {
                setSaved(result.order);
                router.refresh();
            }
        });
    }
    const title = order ? `Заказ №${order.number}` : 'Новый заказ';
    const itemsEditable = !order || order.status === 'NEW' || order.status === 'COOKING';
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$overlay$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Overlay"], {
        open: true,
        onClose: close,
        title: title,
        drawer: !(editing && itemsEditable),
        size: editing && itemsEditable ? 'lg' : 'md',
        className: editing && itemsEditable ? 'rest-pos' : 'food-drawer',
        trapFocus: true,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "food-detail",
            "data-testid": "order-drawer",
            children: [
                dialog,
                error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Alert"], {
                    children: error
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                    lineNumber: 563,
                    columnNumber: 19
                }, this),
                order && !editing ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "food-section-heading",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StatusBadge"], {
                                    kind: "foodOrder",
                                    value: order.status
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                    lineNumber: 567,
                                    columnNumber: 15
                                }, this),
                                order.delayed && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "warn-text",
                                    children: "Задерживается"
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                    lineNumber: 568,
                                    columnNumber: 33
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                            lineNumber: 566,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dl", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                    children: "Стол"
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                    lineNumber: 571,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                    children: order.table ? `${order.table.areaName}, ${order.table.name}` : 'Без стола'
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                    lineNumber: 572,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                    children: "Официант"
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                    lineNumber: 573,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                    children: order.waiter?.name ?? '—'
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                    lineNumber: 574,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                    children: "Гостей"
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                    lineNumber: 575,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                    children: order.guestCount
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                    lineNumber: 576,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                    children: "Открыт"
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                    lineNumber: 577,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                    children: clock(order.openedAt)
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                    lineNumber: 578,
                                    columnNumber: 15
                                }, this),
                                order.closedAt && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                            children: "Закрыт"
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                            lineNumber: 581,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                            children: clock(order.closedAt)
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                            lineNumber: 582,
                                            columnNumber: 19
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                    lineNumber: 580,
                                    columnNumber: 17
                                }, this),
                                order.notes && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                            children: "Комментарий"
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                            lineNumber: 587,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                            children: order.notes
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                            lineNumber: 588,
                                            columnNumber: 19
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                    lineNumber: 586,
                                    columnNumber: 17
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                            lineNumber: 570,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "rest-order-items",
                            children: [
                                order.items.map((i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "rest-order-item",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                                children: [
                                                    i.name,
                                                    i.notes ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("small", {
                                                        children: [
                                                            ", ",
                                                            i.notes
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                                        lineNumber: 597,
                                                        columnNumber: 32
                                                    }, this) : null
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                                lineNumber: 595,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                children: [
                                                    "× ",
                                                    i.qty
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                                lineNumber: 599,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "rest-tech-cost",
                                                children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$dashboard$2d$format$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["wholeTenge"])(String(BigInt(i.priceMinor) * BigInt(i.qty)), order.currency)
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                                lineNumber: 600,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, i.id, true, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                        lineNumber: 594,
                                        columnNumber: 17
                                    }, this)),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "rest-order-total",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: "Итого"
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                            lineNumber: 606,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                            "data-testid": "order-total",
                                            children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$dashboard$2d$format$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["wholeTenge"])(order.totalMinor, order.currency)
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                            lineNumber: 607,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                    lineNumber: 605,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                            lineNumber: 592,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(PaymentPanel, {
                            ctx: ctx,
                            order: order,
                            onSaved: setSaved
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                            lineNumber: 612,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(RatingPanel, {
                            ctx: ctx,
                            order: order,
                            onSaved: setSaved
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                            lineNumber: 613,
                            columnNumber: 13
                        }, this),
                        ctx.write && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "food-actions",
                            children: [
                                order.nextStatuses.filter((s)=>s !== 'CANCELLED').filter((s)=>s !== 'CLOSED' || order.paidMinor === order.totalMinor).map((s)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                        disabled: pending,
                                        onClick: ()=>transition(s),
                                        children: STATUS_ACTION[s]
                                    }, s, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                        lineNumber: 620,
                                        columnNumber: 21
                                    }, this)),
                                itemsEditable && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                    tone: "secondary",
                                    disabled: pending,
                                    onClick: ()=>setEditing(true),
                                    children: "Изменить"
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                    lineNumber: 625,
                                    columnNumber: 19
                                }, this),
                                order.nextStatuses.includes('CANCELLED') && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                    tone: "danger",
                                    disabled: pending,
                                    onClick: ()=>transition('CANCELLED'),
                                    children: STATUS_ACTION.CANCELLED
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                    lineNumber: 630,
                                    columnNumber: 19
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                            lineNumber: 615,
                            columnNumber: 15
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                    lineNumber: 565,
                    columnNumber: 11
                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "rest-pos-layout",
                    children: [
                        itemsEditable && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(DishPicker, {
                            ctx: ctx,
                            items: items,
                            setItems: setItems
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                            lineNumber: 639,
                            columnNumber: 31
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "rest-pos-side",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "food-form-row",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                                            label: "Стол",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Select"], {
                                                value: tableId,
                                                onChange: (e)=>setTableId(e.target.value),
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                        value: "",
                                                        children: "Без стола"
                                                    }, void 0, false, {
                                                        fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                                        lineNumber: 644,
                                                        columnNumber: 21
                                                    }, this),
                                                    ctx.tables.filter((t)=>t.active).map((t)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                            value: t.id,
                                                            children: tableLabel(t)
                                                        }, t.id, false, {
                                                            fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                                            lineNumber: 648,
                                                            columnNumber: 25
                                                        }, this))
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                                lineNumber: 643,
                                                columnNumber: 19
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                            lineNumber: 642,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                                            label: "Официант",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Select"], {
                                                value: waiterId,
                                                onChange: (e)=>setWaiterId(e.target.value),
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                        value: "",
                                                        children: "Не назначен"
                                                    }, void 0, false, {
                                                        fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                                        lineNumber: 656,
                                                        columnNumber: 21
                                                    }, this),
                                                    ctx.employees.filter((e)=>e.status === 'ACTIVE').map((e)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                            value: e.id,
                                                            children: e.name
                                                        }, e.id, false, {
                                                            fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                                            lineNumber: 660,
                                                            columnNumber: 25
                                                        }, this))
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                                lineNumber: 655,
                                                columnNumber: 19
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                            lineNumber: 654,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                                            label: "Гостей",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                                type: "number",
                                                min: 1,
                                                max: 1000,
                                                value: guestCount,
                                                onChange: (e)=>setGuestCount(Math.max(1, Number(e.target.value) || 1))
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                                lineNumber: 667,
                                                columnNumber: 19
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                            lineNumber: 666,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                    lineNumber: 641,
                                    columnNumber: 15
                                }, this),
                                itemsEditable ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(CurrentOrder, {
                                    ctx: ctx,
                                    items: items,
                                    setItems: setItems
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                    lineNumber: 677,
                                    columnNumber: 17
                                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "muted",
                                    children: "Состав заморожен после готовности."
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                    lineNumber: 679,
                                    columnNumber: 17
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                                    label: "Комментарий к заказу",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Textarea"], {
                                        rows: 2,
                                        value: notes,
                                        onChange: (e)=>setNotes(e.target.value)
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                        lineNumber: 682,
                                        columnNumber: 17
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                    lineNumber: 681,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "food-actions",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                            className: order ? undefined : 'rest-btn-go',
                                            disabled: pending || items.length === 0,
                                            onClick: submit,
                                            children: order ? 'Сохранить' : 'Отправить на кухню'
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                            lineNumber: 685,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                            tone: "secondary",
                                            disabled: pending,
                                            onClick: ()=>order ? setEditing(false) : close(),
                                            children: "Отмена"
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                            lineNumber: 692,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                                    lineNumber: 684,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                            lineNumber: 640,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
                    lineNumber: 638,
                    columnNumber: 11
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
            lineNumber: 561,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/wt-personnel/apps/web/src/app/food/order-drawer.tsx",
        lineNumber: 552,
        columnNumber: 5
    }, this);
}
_s3(OrderDrawer, "8e6NI20o4Uecdpg2DZ8+5fAmD0I=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"],
        __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$use$2d$confirm$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useConfirm"],
        __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTransition"]
    ];
});
_c4 = OrderDrawer;
var _c, _c1, _c2, _c3, _c4;
__turbopack_context__.k.register(_c, "RatingPanel");
__turbopack_context__.k.register(_c1, "PaymentPanel");
__turbopack_context__.k.register(_c2, "DishPicker");
__turbopack_context__.k.register(_c3, "CurrentOrder");
__turbopack_context__.k.register(_c4, "OrderDrawer");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/app/food/rating-parts.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "QrCode",
    ()=>QrCode,
    "StarsInput",
    ()=>StarsInput
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$qrcode$2d$generator$2f$dist$2f$qrcode$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/qrcode-generator/dist/qrcode.mjs [app-client] (ecmascript)");
'use client';
;
;
function StarsInput({ value, onChange }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "rest-stars",
        role: "radiogroup",
        "aria-label": "Звёзды",
        children: [
            1,
            2,
            3,
            4,
            5
        ].map((n)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                type: "button",
                role: "radio",
                "aria-checked": value === n,
                "aria-label": `${n} из 5`,
                className: "rest-star",
                "data-on": n <= value,
                onClick: ()=>onChange(n),
                children: n <= value ? '★' : '☆'
            }, n, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/food/rating-parts.tsx",
                lineNumber: 9,
                columnNumber: 9
            }, this))
    }, void 0, false, {
        fileName: "[project]/wt-personnel/apps/web/src/app/food/rating-parts.tsx",
        lineNumber: 7,
        columnNumber: 5
    }, this);
}
_c = StarsInput;
function QrCode({ text, label }) {
    const qr = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$qrcode$2d$generator$2f$dist$2f$qrcode$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])(0, 'M');
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount();
    let d = '';
    for(let y = 0; y < n; y++)for(let x = 0; x < n; x++)if (qr.isDark(y, x)) d += `M${x} ${y}h1v1h-1z`;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "rest-qr",
        "data-theme": "light",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
            viewBox: `-4 -4 ${n + 8} ${n + 8}`,
            role: "img",
            "aria-label": label,
            shapeRendering: "crispEdges",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                d: d,
                fill: "currentColor"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/food/rating-parts.tsx",
                lineNumber: 40,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/wt-personnel/apps/web/src/app/food/rating-parts.tsx",
            lineNumber: 39,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/wt-personnel/apps/web/src/app/food/rating-parts.tsx",
        lineNumber: 38,
        columnNumber: 5
    }, this);
}
_c1 = QrCode;
var _c, _c1;
__turbopack_context__.k.register(_c, "StarsInput");
__turbopack_context__.k.register(_c1, "QrCode");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/app/food/timeline-board.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "TimelineBoard",
    ()=>TimelineBoard,
    "minutesOfDay",
    ()=>minutesOfDay,
    "tableTitle",
    ()=>tableTitle,
    "timelineHours",
    ()=>timelineHours
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$status$2f$food$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/status/food.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$plural$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/plural.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$beauty$2f$time$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/beauty/time.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
;
/** Брони, которые держат стол на шкале: отменённые и неявки строку не занимают */ const ON_TIMELINE = new Set([
    'BOOKED',
    'CONFIRMED',
    'SEATED',
    'COMPLETED'
]);
const tableTitle = (name)=>/^\d/.test(name) ? `Стол ${name}` : name;
function minutesOfDay(iso, day, timezone) {
    const local = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$beauty$2f$time$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["localInput"])(iso, timezone);
    const days = (Date.UTC(+local.slice(0, 4), +local.slice(5, 7) - 1, +local.slice(8, 10)) - Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10))) / 86_400_000;
    return days * 1440 + Number(local.slice(11, 13)) * 60 + Number(local.slice(14, 16));
}
function timelineHours(periods, spans) {
    const hm = (t)=>Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
    const active = periods.filter((p)=>p.active);
    let from = active.length ? Math.min(...active.map((p)=>hm(p.timeFrom))) : 600;
    let to = active.length ? Math.max(...active.map((p)=>hm(p.timeTo) + (p.endsNextDay ? 1440 : 0))) : 1440;
    for (const [s, e] of spans){
        from = Math.min(from, s);
        to = Math.max(to, e);
    }
    from = Math.max(0, Math.floor(from / 60));
    to = Math.min(48, Math.max(from + 1, Math.ceil(to / 60)));
    return [
        from,
        to
    ];
}
function TimelineBoard({ data, reservations, areaId, onOpen, onCreate }) {
    _s();
    const areaOrder = new Map(data.areas.map((a)=>[
            a.id,
            a.sortOrder
        ]));
    const areaName = new Map(data.areas.map((a)=>[
            a.id,
            a.name
        ]));
    const tables = data.tables.filter((t)=>t.active && data.areas.some((a)=>a.id === t.areaId && a.active) && (!areaId || t.areaId === areaId)).sort((a, b)=>(areaOrder.get(a.areaId) ?? 0) - (areaOrder.get(b.areaId) ?? 0) || a.sortOrder - b.sortOrder);
    const placed = reservations.filter((r)=>r.table && ON_TIMELINE.has(r.status)).map((r)=>({
            r,
            start: minutesOfDay(r.startsAt, data.date, data.timezone),
            end: minutesOfDay(r.endsAt, data.date, data.timezone)
        }));
    const [fromHour, toHour] = timelineHours(data.periods, placed.map((p)=>[
            p.start,
            p.end
        ]));
    const span = (toHour - fromHour) * 60;
    const pct = (m)=>`${((m - fromHour * 60) / span * 100).toFixed(3)}%`;
    const today = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$beauty$2f$time$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["localInput"])(new Date().toISOString(), data.timezone);
    const nowMinutes = today.slice(0, 10) === data.date ? Number(today.slice(11, 13)) * 60 + Number(today.slice(14, 16)) : null;
    const hours = Array.from({
        length: toHour - fromHour
    }, (_, i)=>fromHour + i);
    const clock = (iso)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$beauty$2f$time$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["localInput"])(iso, data.timezone).slice(11, 16);
    const pick = (e, tableId)=>{
        if (!onCreate) return;
        const box = e.currentTarget.getBoundingClientRect();
        // щелчок мышью: время под курсором, шаг 15 минут; с клавиатуры (detail 0): время экрана
        const minute = e.detail === 0 ? null : fromHour * 60 + Math.floor((e.clientX - box.left) / box.width * span / 15) * 15;
        const time = minute === null ? data.time : `${String(Math.floor(minute / 60) % 24).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
        onCreate(tableId, time);
    };
    // узкий экран: шкала сразу показывает текущее время (или первую бронь дня) за час до него
    const scroller = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const focusMinute = nowMinutes ?? (placed.length ? Math.min(...placed.map((p)=>p.start)) : null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "TimelineBoard.useEffect": ()=>{
            const box = scroller.current;
            const track = box?.querySelector('.rest-tl__track');
            if (!box || !track || focusMinute === null || box.scrollWidth <= box.clientWidth) return;
            const offset = (focusMinute - 60 - fromHour * 60) / span * track.offsetWidth;
            box.scrollLeft = Math.max(0, offset);
        }
    }["TimelineBoard.useEffect"], [
        focusMinute,
        fromHour,
        span
    ]);
    if (!tables.length) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
        className: "muted",
        children: "В выбранном зале нет столов"
    }, void 0, false, {
        fileName: "[project]/wt-personnel/apps/web/src/app/food/timeline-board.tsx",
        lineNumber: 117,
        columnNumber: 30
    }, this);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "rest-tl",
        "data-testid": "reservations-timeline",
        ref: scroller,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "rest-tl__grid",
            style: {
                ['--tl-hours']: String(hours.length)
            },
            role: "group",
            "aria-label": "Шкала броней по столам",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "rest-tl__corner",
                    children: "Столы"
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/food/timeline-board.tsx",
                    lineNumber: 126,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "rest-tl__hours",
                    "aria-hidden": "true",
                    children: hours.map((h)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            children: `${String(h % 24).padStart(2, '0')}:00`
                        }, h, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/food/timeline-board.tsx",
                            lineNumber: 129,
                            columnNumber: 13
                        }, this))
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/food/timeline-board.tsx",
                    lineNumber: 127,
                    columnNumber: 9
                }, this),
                tables.map((t)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "rest-tl__row",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "rest-tl__table",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                        children: tableTitle(t.name)
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/food/timeline-board.tsx",
                                        lineNumber: 135,
                                        columnNumber: 15
                                    }, this),
                                    " ",
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("small", {
                                        children: [
                                            "(",
                                            t.capacity,
                                            ")"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/food/timeline-board.tsx",
                                        lineNumber: 135,
                                        columnNumber: 53
                                    }, this),
                                    !areaId && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "sr-only",
                                        children: [
                                            ", ",
                                            areaName.get(t.areaId)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/food/timeline-board.tsx",
                                        lineNumber: 136,
                                        columnNumber: 27
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/food/timeline-board.tsx",
                                lineNumber: 134,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "rest-tl__track",
                                children: [
                                    onCreate && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        type: "button",
                                        className: "rest-tl__slot",
                                        "aria-label": `Новая бронь: ${tableTitle(t.name)}`,
                                        onClick: (e)=>pick(e, t.id)
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/food/timeline-board.tsx",
                                        lineNumber: 140,
                                        columnNumber: 17
                                    }, this),
                                    placed.filter((p)=>p.r.table.id === t.id && p.end > fromHour * 60 && p.start < toHour * 60).map(({ r, start, end })=>{
                                        const name = [
                                            r.customer.firstName,
                                            r.customer.lastName
                                        ].filter(Boolean).join(' ');
                                        const left = pct(Math.max(start, fromHour * 60));
                                        const place = {
                                            left,
                                            width: `calc(${pct(Math.min(end, toHour * 60))} - ${left})`
                                        };
                                        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            type: "button",
                                            className: "rest-tl__bar",
                                            "data-status": r.status,
                                            style: place,
                                            "aria-label": `${name}, ${clock(r.startsAt)}–${clock(r.endsAt)}, ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$plural$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["pluralRu"])(r.partySize, [
                                                'гость',
                                                'гостя',
                                                'гостей'
                                            ])}, ${__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$status$2f$food$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["foodStatus"][r.status].label}`,
                                            onClick: ()=>onOpen(r),
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                children: name
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/food/timeline-board.tsx",
                                                lineNumber: 163,
                                                columnNumber: 23
                                            }, this)
                                        }, r.id, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/food/timeline-board.tsx",
                                            lineNumber: 154,
                                            columnNumber: 21
                                        }, this);
                                    }),
                                    nowMinutes !== null && nowMinutes >= fromHour * 60 && nowMinutes < toHour * 60 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("i", {
                                        className: "rest-tl__now",
                                        style: {
                                            left: pct(nowMinutes)
                                        },
                                        "aria-hidden": "true"
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/food/timeline-board.tsx",
                                        lineNumber: 168,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/food/timeline-board.tsx",
                                lineNumber: 138,
                                columnNumber: 13
                            }, this)
                        ]
                    }, t.id, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/food/timeline-board.tsx",
                        lineNumber: 133,
                        columnNumber: 11
                    }, this))
            ]
        }, void 0, true, {
            fileName: "[project]/wt-personnel/apps/web/src/app/food/timeline-board.tsx",
            lineNumber: 120,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/wt-personnel/apps/web/src/app/food/timeline-board.tsx",
        lineNumber: 119,
        columnNumber: 5
    }, this);
}
_s(TimelineBoard, "uz3zvFoo8WcsIOCUx3MIlKjihCo=");
_c = TimelineBoard;
var _c;
__turbopack_context__.k.register(_c, "TimelineBoard");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/components/confirm-dialog.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ConfirmDialog",
    ()=>ConfirmDialog
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$overlay$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/overlay.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/ui.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
function ConfirmDialog({ open, title, children, confirmLabel, cancelLabel = 'Оставить как есть', tone = 'danger', pending = false, confirmDisabled = false, onConfirm, onCancel }) {
    _s();
    const dialog = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const titleId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useId"])();
    const bodyId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useId"])();
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "ConfirmDialog.useEffect": ()=>{
            const el = dialog.current;
            if (!el || !open) return;
            const previous = document.activeElement;
            el.showModal();
            el.querySelector('[data-autofocus]')?.focus();
            return ({
                "ConfirmDialog.useEffect": ()=>{
                    el.close();
                    previous?.focus();
                }
            })["ConfirmDialog.useEffect"];
        }
    }["ConfirmDialog.useEffect"], [
        open
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dialog", {
        ref: dialog,
        className: "confirm-dialog",
        "aria-labelledby": titleId,
        "aria-describedby": children ? bodyId : undefined,
        "data-testid": "confirm-dialog",
        onKeyDown: __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$overlay$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["trapDialogFocus"],
        onCancel: (e)=>{
            e.preventDefault();
            if (!pending) onCancel();
        },
        children: open && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "confirm-dialog__body",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                    id: titleId,
                    className: "confirm-dialog__title",
                    children: title
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/components/confirm-dialog.tsx",
                    lineNumber: 65,
                    columnNumber: 11
                }, this),
                children && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    id: bodyId,
                    className: "confirm-dialog__text",
                    children: children
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/components/confirm-dialog.tsx",
                    lineNumber: 69,
                    columnNumber: 13
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "confirm-dialog__actions",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                            type: "button",
                            tone: "secondary",
                            onClick: onCancel,
                            disabled: pending,
                            "data-autofocus": true,
                            children: cancelLabel
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/components/confirm-dialog.tsx",
                            lineNumber: 74,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                            type: "button",
                            tone: tone,
                            onClick: onConfirm,
                            disabled: pending || confirmDisabled,
                            children: pending ? 'Выполняю…' : confirmLabel
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/components/confirm-dialog.tsx",
                            lineNumber: 83,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/wt-personnel/apps/web/src/components/confirm-dialog.tsx",
                    lineNumber: 73,
                    columnNumber: 11
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/wt-personnel/apps/web/src/components/confirm-dialog.tsx",
            lineNumber: 64,
            columnNumber: 9
        }, this)
    }, void 0, false, {
        fileName: "[project]/wt-personnel/apps/web/src/components/confirm-dialog.tsx",
        lineNumber: 51,
        columnNumber: 5
    }, this);
}
_s(ConfirmDialog, "yAqdKxgC7RGhKTubNmBHEKdlyh0=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useId"],
        __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useId"]
    ];
});
_c = ConfirmDialog;
var _c;
__turbopack_context__.k.register(_c, "ConfirmDialog");
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
"[project]/wt-personnel/apps/web/src/components/icon-field.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "IconField",
    ()=>IconField
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$icon$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/icon.tsx [app-client] (ecmascript)");
;
;
function IconField({ icon, children }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        className: "field-icon",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$icon$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Icon"], {
                name: icon,
                width: 18,
                height: 18
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/components/icon-field.tsx",
                lineNumber: 12,
                columnNumber: 7
            }, this),
            children
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/components/icon-field.tsx",
        lineNumber: 11,
        columnNumber: 5
    }, this);
}
_c = IconField;
var _c;
__turbopack_context__.k.register(_c, "IconField");
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
"[project]/wt-personnel/apps/web/src/components/use-confirm.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useConfirm",
    ()=>useConfirm
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$confirm$2d$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/confirm-dialog.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
function useConfirm() {
    _s();
    const [request, setRequest] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    // Ответ ждёт вызывающий код: держим resolve текущего вопроса, пока администратор не нажал кнопку
    const decide = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const ask = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useConfirm.useCallback[ask]": (next)=>new Promise({
                "useConfirm.useCallback[ask]": (resolve)=>{
                    // Второй вопрос поверх первого невозможен, но если он случится — прежний считается отказом
                    decide.current?.(false);
                    decide.current = resolve;
                    setRequest(next);
                }
            }["useConfirm.useCallback[ask]"])
    }["useConfirm.useCallback[ask]"], []);
    const answer = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useConfirm.useCallback[answer]": (ok)=>{
            const resolve = decide.current;
            decide.current = null;
            setRequest(null);
            resolve?.(ok);
        }
    }["useConfirm.useCallback[answer]"], []);
    const dialog = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$confirm$2d$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ConfirmDialog"], {
        open: request !== null,
        title: request?.title ?? '',
        confirmLabel: request?.confirmLabel ?? '',
        ...request?.cancelLabel ? {
            cancelLabel: request.cancelLabel
        } : {},
        tone: request?.tone ?? 'danger',
        onConfirm: ()=>answer(true),
        onCancel: ()=>answer(false),
        children: request?.body
    }, void 0, false, {
        fileName: "[project]/wt-personnel/apps/web/src/components/use-confirm.tsx",
        lineNumber: 52,
        columnNumber: 5
    }, this);
    return {
        ask,
        dialog
    };
}
_s(useConfirm, "a2WVE0WGzoVoEGx2yiFP1rGDPiI=");
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
"[project]/wt-personnel/apps/web/src/lib/dashboard-format.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "METHOD_RU",
    ()=>METHOD_RU,
    "deltaPercent",
    ()=>deltaPercent,
    "deltaPoints",
    ()=>deltaPoints,
    "formatInt",
    ()=>formatInt,
    "formatPercent",
    ()=>formatPercent,
    "sourceLabel",
    ()=>sourceLabel,
    "wholeTenge",
    ()=>wholeTenge
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$status$2f$source$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/status/source.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$status$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/status/types.ts [app-client] (ecmascript)");
;
;
/** Представление чисел дашборда. Деньги приходят строкой в тиынах (ADR-008) — float здесь нет. */ const percentFormat = new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1
});
const intFormat = new Intl.NumberFormat('ru-RU');
function wholeTenge(minor, currency = 'KZT') {
    const v = BigInt(minor);
    const neg = v < 0n;
    const abs = neg ? -v : v;
    const tenge = (abs + 50n) / 100n;
    const text = tenge.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return `${neg ? '−' : ''}${text} ${currency === 'KZT' ? '₸' : currency}`;
}
const formatPercent = (v)=>`${percentFormat.format(v)} %`;
const formatInt = (v)=>intFormat.format(v);
const sign = (v)=>v > 0 ? '+' : v < 0 ? '−' : '';
function deltaPoints(current, previous) {
    const diff = Math.round((current - previous) * 10) / 10;
    return {
        direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat',
        text: `${sign(diff)}${percentFormat.format(Math.abs(diff))} п.п.`
    };
}
function deltaPercent(current, previous) {
    const c = typeof current === 'bigint' ? current : BigInt(Math.round(current));
    const p = typeof previous === 'bigint' ? previous : BigInt(Math.round(previous));
    if (p === 0n) return {
        direction: null,
        text: 'нет базы для сравнения'
    };
    const abs = p < 0n ? -p : p;
    // десятые доли процента целочисленно
    const tenths = Number((c - p) * 1000n / abs);
    const value = tenths / 10;
    return {
        direction: value > 0 ? 'up' : value < 0 ? 'down' : 'flat',
        text: `${sign(value)}${percentFormat.format(Math.abs(value))} %`
    };
}
const sourceLabel = (source, channel)=>channel || (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$status$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["statusLabel"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$status$2f$source$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["sourceStatus"], source);
const METHOD_RU = {
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
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/lib/food-types.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "FOOD_PAYMENT_METHODS",
    ()=>FOOD_PAYMENT_METHODS
]);
const FOOD_PAYMENT_METHODS = [
    'CASH',
    'CARD_TERMINAL',
    'KASPI',
    'HALYK',
    'BANK_TRANSFER_PERSON',
    'BANK_TRANSFER_LEGAL'
];
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/lib/money.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "currencySign",
    ()=>currencySign,
    "formatMinor",
    ()=>formatMinor,
    "formatMoney",
    ()=>formatMoney,
    "inputToMinor",
    ()=>inputToMinor,
    "minorToInput",
    ()=>minorToInput
]);
/**
 * Деньги на экране по DESIGN.md §14: «12 500 ₸» без тиынов, если сумма целая; «12 500,50 ₸», если нет.
 * На входе строка в тиынах (ADR-008) — float здесь нет. Отрицательное — с минусом «−» (U+2212).
 * `formatMinor` из lib/api.ts печатает копейки всегда и остаётся для счёта; здесь — для плашек,
 * таблиц и показателей, где тиыны только шумят.
 */ var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$finance$2f$finance$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/finance/finance.ts [app-client] (ecmascript)");
;
function formatMoney(minor, currency = 'KZT') {
    const v = typeof minor === 'bigint' ? minor : BigInt(minor);
    const neg = v < 0n;
    const abs = neg ? -v : v;
    const whole = (abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const cents = Number(abs % 100n);
    const tail = cents ? `,${String(cents).padStart(2, '0')}` : '';
    return `${neg ? '−' : ''}${whole}${tail} ${currency === 'KZT' ? '₸' : currency}`;
}
function minorToInput(minor) {
    const negative = minor.startsWith('-');
    const digits = minor.replace('-', '').padStart(3, '0');
    const whole = digits.slice(0, -2);
    const fraction = digits.slice(-2);
    return `${negative ? '-' : ''}${whole}${fraction === '00' ? '' : `.${fraction}`}`;
}
function inputToMinor(text) {
    const clean = text.replace(/\s/g, '');
    if (!clean) return '';
    try {
        const minor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$finance$2f$finance$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["parseMoney"])(clean);
        return minor < 0n ? null : minor.toString();
    } catch  {
        return null;
    }
}
function formatMinor(minor, currency = 'KZT') {
    const neg = minor.startsWith('-');
    const digits = minor.replace('-', '').padStart(3, '0');
    const int = digits.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return `${neg ? '−' : ''}${int},${digits.slice(-2)} ${currency === 'KZT' ? '₸' : currency}`;
}
function currencySign(currency = 'KZT') {
    return currency === 'KZT' ? '₸' : currency;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/lib/plural.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/** Русское склонение по числу: pluralRu(5, ['ночь', 'ночи', 'ночей']) → «5 ночей». */ __turbopack_context__.s([
    "nightsBetween",
    ()=>nightsBetween,
    "pluralRu",
    ()=>pluralRu
]);
function pluralRu(n, forms, withNumber = true) {
    const abs = Math.abs(n);
    const d = abs % 10;
    const h = abs % 100;
    const word = h >= 11 && h <= 14 ? forms[2] : d === 1 ? forms[0] : d >= 2 && d <= 4 ? forms[1] : forms[2];
    return withNumber ? `${n} ${word}` : word;
}
function nightsBetween(arrival, departure) {
    const a = Date.parse(`${arrival}T00:00:00Z`);
    const d = Date.parse(`${departure}T00:00:00Z`);
    if (!Number.isFinite(a) || !Number.isFinite(d) || d <= a) return 0;
    return Math.round((d - a) / 86_400_000);
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/lib/status/source.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "sourceStatus",
    ()=>sourceStatus
]);
const sourceStatus = {
    OTA: {
        label: 'Канал продаж',
        short: 'OTA',
        tone: 'neutral'
    },
    DESK: {
        label: 'Стойка',
        short: 'Стойка',
        tone: 'neutral'
    },
    PHONE: {
        label: 'Телефон',
        short: 'Тел.',
        tone: 'neutral'
    },
    WHATSAPP: {
        label: 'WhatsApp',
        short: 'WA',
        tone: 'neutral',
        proper: true
    },
    WALK_IN: {
        label: 'Без предварительной брони',
        short: 'Без брони',
        tone: 'neutral'
    },
    INSTAGRAM: {
        label: 'Instagram',
        short: 'IG',
        tone: 'neutral',
        proper: true
    },
    WEBSITE: {
        label: 'Сайт',
        short: 'Сайт',
        tone: 'neutral'
    }
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=wt-personnel_apps_web_src_1vtd8y8._.js.map