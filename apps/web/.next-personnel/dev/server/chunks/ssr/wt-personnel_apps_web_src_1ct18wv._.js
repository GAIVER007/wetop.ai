module.exports = [
"[project]/wt-personnel/apps/web/src/app/market/calendar.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SIGNAL_WORD",
    ()=>SIGNAL_WORD,
    "SignalCalendar",
    ()=>SignalCalendar
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-jsx-dev-runtime.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/client/app-dir/link.react-server.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$index$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/index.ts [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$market$2f$occupancy$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/market/occupancy.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$display$2d$date$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/display-date.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/ui.tsx [app-rsc] (ecmascript)");
;
;
;
;
;
const SIGNAL_WORD = {
    high: 'высокий спрос',
    mid: 'обычный спрос',
    low: 'слабый спрос',
    shift: 'резкое изменение',
    none: 'нет данных'
};
const WEEKDAYS = [
    'пн',
    'вт',
    'ср',
    'чт',
    'пт',
    'сб',
    'вс'
];
/** колонка дня недели: понедельник первый */ const column = (date)=>(new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
const pct = (bp)=>bp === null ? '–' : (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$market$2f$occupancy$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["formatOccupancy"])(Math.round(bp / 100) * 100);
function SignalCalendar({ cells, nightHref }) {
    const first = cells[0];
    if (!first) return null;
    const offset = column(first.date);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "market-calendar",
        "data-testid": "market-calendar",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                className: "market-calendar__week",
                "aria-hidden": "true",
                children: WEEKDAYS.map((w)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                        children: w
                    }, w, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/calendar.tsx",
                        lineNumber: 39,
                        columnNumber: 11
                    }, this))
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/calendar.tsx",
                lineNumber: 37,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                className: "market-calendar__grid",
                children: cells.map((c, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["cx"])('market-day', `market-day--${c.signal}`),
                        style: i === 0 ? {
                            gridColumnStart: offset + 1
                        } : undefined /* slop-allow: inline-style колонка первого дня из даты */ ,
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                            href: nightHref(c.date),
                            scroll: false,
                            "data-testid": `market-day-${c.date}`,
                            "aria-label": `${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$display$2d$date$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["displayDate"])(c.date, 'numeric')}: рынок ${SIGNAL_WORD[c.signal]}, у вас ${pct(c.ownBp)}`,
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "market-day__num",
                                    children: Number(c.date.slice(8, 10))
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/market/calendar.tsx",
                                    lineNumber: 55,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "market-day__own",
                                    "aria-hidden": "true",
                                    children: pct(c.ownBp)
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/market/calendar.tsx",
                                    lineNumber: 56,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/market/calendar.tsx",
                            lineNumber: 49,
                            columnNumber: 13
                        }, this)
                    }, c.date, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/calendar.tsx",
                        lineNumber: 44,
                        columnNumber: 11
                    }, this))
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/calendar.tsx",
                lineNumber: 42,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                className: "market-legend",
                "aria-label": "Цвет даты",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "market-swatch market-day--high",
                                "aria-hidden": "true"
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/calendar.tsx",
                                lineNumber: 65,
                                columnNumber: 11
                            }, this),
                            "высокий спрос"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/calendar.tsx",
                        lineNumber: 64,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "market-swatch market-day--mid",
                                "aria-hidden": "true"
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/calendar.tsx",
                                lineNumber: 69,
                                columnNumber: 11
                            }, this),
                            "обычный"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/calendar.tsx",
                        lineNumber: 68,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "market-swatch market-day--low",
                                "aria-hidden": "true"
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/calendar.tsx",
                                lineNumber: 73,
                                columnNumber: 11
                            }, this),
                            "слабый"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/calendar.tsx",
                        lineNumber: 72,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "market-swatch market-day--shift",
                                "aria-hidden": "true"
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/calendar.tsx",
                                lineNumber: 77,
                                columnNumber: 11
                            }, this),
                            "резкое изменение"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/calendar.tsx",
                        lineNumber: 76,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "market-swatch market-day--none",
                                "aria-hidden": "true"
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/calendar.tsx",
                                lineNumber: 81,
                                columnNumber: 11
                            }, this),
                            "нет данных"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/calendar.tsx",
                        lineNumber: 80,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/calendar.tsx",
                lineNumber: 63,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/market/calendar.tsx",
        lineNumber: 36,
        columnNumber: 5
    }, this);
}
}),
"[project]/wt-personnel/apps/web/src/app/market/chart-data.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "buildChartRows",
    ()=>buildChartRows,
    "buildPriceRows",
    ()=>buildPriceRows,
    "changeSummary",
    ()=>changeSummary,
    "coverageRuns",
    ()=>coverageRuns,
    "linePath",
    ()=>linePath,
    "shortMoney",
    ()=>shortMoney
]);
function buildChartRows(board) {
    return board.dates.map((date, i)=>{
        const cells = board.competitors.map((c)=>c.cells[i]);
        const values = cells.flatMap((c)=>c && c.bp !== null ? [
                c.bp
            ] : []);
        const deltas = cells.flatMap((c)=>c && c.deltaBp !== null ? [
                c.deltaBp
            ] : []);
        return {
            date,
            own: board.own[i]?.bp ?? null,
            market: board.market[i]?.bp ?? null,
            min: values.length ? Math.min(...values) : null,
            max: values.length ? Math.max(...values) : null,
            withData: values.length,
            total: board.competitors.length,
            changeBp: deltas.length ? Math.round(deltas.reduce((a, b)=>a + b, 0) / deltas.length) : null
        };
    });
}
function coverageRuns(rows) {
    const runs = [];
    for (const r of rows){
        const last = runs.at(-1);
        if (last && last.withData === r.withData && last.total === r.total) last.to = r.date;
        else runs.push({
            from: r.date,
            to: r.date,
            withData: r.withData,
            total: r.total
        });
    }
    return runs;
}
function changeSummary(rows) {
    const values = rows.flatMap((r)=>r.changeBp === null ? [] : [
            r.changeBp
        ]);
    if (!values.length) return null;
    return {
        avgBp: Math.round(values.reduce((a, b)=>a + b, 0) / values.length),
        up: values.filter((v)=>v > 0).length,
        down: values.filter((v)=>v < 0).length,
        nights: values.length
    };
}
function linePath(values, y, x) {
    let d = '';
    let open = false;
    values.forEach((v, i)=>{
        if (v === null) {
            open = false;
            return;
        }
        d += `${open ? 'L' : 'M'}${x(i)},${y(v)}`;
        open = true;
    });
    // одиночная точка между пропусками: M без L не рисуется, добавляем нулевой отрезок
    return d.replace(/M([\d.-]+,[\d.-]+)(?=M|$)/g, 'M$1L$1');
}
function buildPriceRows(rates) {
    const n = (v)=>v === null ? null : Number(v);
    return rates.board.market.map((m)=>({
            date: m.date,
            avg: n(m.avgMinor),
            min: n(m.minMinor),
            max: n(m.maxMinor),
            count: m.count
        }));
}
function shortMoney(minor) {
    const major = minor / 100;
    if (major < 1000) return String(Math.round(major));
    const k = major / 1000;
    return `${(Number.isInteger(k) ? String(k) : k.toFixed(1)).replace('.', ',')} тыс.`;
}
}),
"[project]/wt-personnel/apps/web/src/app/market/chart.tsx [app-rsc] (client reference proxy)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "OccupancyChart",
    ()=>OccupancyChart
]);
// This file is generated by next-core EcmascriptClientReferenceModule.
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const OccupancyChart = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call OccupancyChart() from the server but OccupancyChart is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/wt-personnel/apps/web/src/app/market/chart.tsx", "OccupancyChart");
}),
"[project]/wt-personnel/apps/web/src/app/market/chart.tsx [app-rsc] (client reference proxy) <module evaluation>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "OccupancyChart",
    ()=>OccupancyChart
]);
// This file is generated by next-core EcmascriptClientReferenceModule.
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const OccupancyChart = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call OccupancyChart() from the server but OccupancyChart is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/wt-personnel/apps/web/src/app/market/chart.tsx <module evaluation>", "OccupancyChart");
}),
"[project]/wt-personnel/apps/web/src/app/market/chart.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$market$2f$chart$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__$3c$module__evaluation$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/market/chart.tsx [app-rsc] (client reference proxy) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$market$2f$chart$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/market/chart.tsx [app-rsc] (client reference proxy)");
;
__turbopack_context__.n(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$market$2f$chart$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__);
}),
"[project]/wt-personnel/apps/web/src/app/market/competitor-status.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "competitorStatus",
    ()=>competitorStatus,
    "permilleText",
    ()=>permilleText
]);
const dayOf = (iso)=>Date.parse(`${iso}T00:00:00Z`) / 86_400_000;
function competitorStatus(today, occupancyOn, ratesOn) {
    const last = [
        occupancyOn,
        ratesOn
    ].filter((d)=>d !== null).sort().at(-1) ?? null;
    if (!last) return {
        tone: 'neutral',
        label: 'Нет данных'
    };
    if (dayOf(today) - dayOf(last) <= 1) return {
        tone: 'success',
        label: 'Актуально'
    };
    return {
        tone: 'warning',
        label: `Устарели, с ${last.slice(8, 10)}.${last.slice(5, 7)}`
    };
}
function permilleText(permille) {
    if (permille === null) return '–';
    if (permille === 0) return '0 %';
    const body = (Math.abs(permille) / 10).toFixed(1).replace('.0', '').replace('.', ',');
    return `${permille > 0 ? '+' : '−'}${body} %`;
}
}),
"[project]/wt-personnel/apps/web/src/app/market/competitors-table.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CompetitorsTable",
    ()=>CompetitorsTable
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-jsx-dev-runtime.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/client/app-dir/link.react-server.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$index$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/index.ts [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$market$2f$occupancy$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/market/occupancy.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$display$2d$date$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/display-date.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$money$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/money.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/ui.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$market$2f$drawers$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/market/drawers.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$market$2f$competitor$2d$status$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/market/competitor-status.ts [app-rsc] (ecmascript)");
;
;
;
;
;
;
;
;
function CompetitorsTable({ view, rates, today, editable, district, category, keep }) {
    const byId = new Map(view.competitors.map((c)=>[
            c.id,
            c
        ]));
    const priceById = new Map(rates?.board.competitors.map((c)=>[
            c.id,
            c
        ]));
    const districts = [
        ...new Set(view.competitors.flatMap((c)=>c.district ? [
                c.district
            ] : []))
    ].sort();
    const categories = [
        ...new Set(view.competitors.flatMap((c)=>c.category ? [
                c.category
            ] : []))
    ].sort();
    const rows = view.board.competitors.filter((c)=>{
        const full = byId.get(c.id);
        return (!district || full?.district === district) && (!category || full?.category === category);
    });
    const currency = rates?.currency ?? 'KZT';
    const filtered = district !== '' || category !== '';
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        className: "market-list",
        "aria-labelledby": "market-list-title",
        "data-testid": "market-competitors",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "market-list__head",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SectionTitle"], {
                        id: "market-list-title",
                        first: true,
                        children: "Конкуренты"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/competitors-table.tsx",
                        lineNumber: 45,
                        columnNumber: 9
                    }, this),
                    (districts.length > 0 || categories.length > 0) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
                        method: "get",
                        className: "market-list__filters",
                        "data-testid": "market-list-filters",
                        children: [
                            keep.map(([k, v])=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                    type: "hidden",
                                    name: k,
                                    value: v
                                }, k, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/market/competitors-table.tsx",
                                    lineNumber: 51,
                                    columnNumber: 15
                                }, this)),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Field"], {
                                inline: true,
                                label: "Район",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Select"], {
                                    name: "district",
                                    defaultValue: district,
                                    "data-testid": "market-filter-district",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                            value: "",
                                            children: "Все"
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/market/competitors-table.tsx",
                                            lineNumber: 55,
                                            columnNumber: 17
                                        }, this),
                                        districts.map((d)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                value: d,
                                                children: d
                                            }, d, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/market/competitors-table.tsx",
                                                lineNumber: 57,
                                                columnNumber: 19
                                            }, this))
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/market/competitors-table.tsx",
                                    lineNumber: 54,
                                    columnNumber: 15
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/competitors-table.tsx",
                                lineNumber: 53,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Field"], {
                                inline: true,
                                label: "Тип",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Select"], {
                                    name: "category",
                                    defaultValue: category,
                                    "data-testid": "market-filter-category",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                            value: "",
                                            children: "Все"
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/market/competitors-table.tsx",
                                            lineNumber: 65,
                                            columnNumber: 17
                                        }, this),
                                        categories.map((d)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                value: d,
                                                children: d
                                            }, d, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/market/competitors-table.tsx",
                                                lineNumber: 67,
                                                columnNumber: 19
                                            }, this))
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/market/competitors-table.tsx",
                                    lineNumber: 64,
                                    columnNumber: 15
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/competitors-table.tsx",
                                lineNumber: 63,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Button"], {
                                type: "submit",
                                tone: "secondary",
                                size: "sm",
                                children: "Показать"
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/competitors-table.tsx",
                                lineNumber: 73,
                                columnNumber: 13
                            }, this),
                            filtered && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                                href: `/market?${new URLSearchParams(keep)}`,
                                className: "market-reset",
                                children: "Сбросить"
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/competitors-table.tsx",
                                lineNumber: 77,
                                columnNumber: 15
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/competitors-table.tsx",
                        lineNumber: 49,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/competitors-table.tsx",
                lineNumber: 44,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Table"], {
                size: "sm",
                density: "normal",
                className: "market-list__table",
                "aria-label": "Загрузка и цены по каждому конкуренту",
                "data-testid": "market-list-table",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("thead", {
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                    scope: "col",
                                    children: "Отель"
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/market/competitors-table.tsx",
                                    lineNumber: 87,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                    scope: "col",
                                    children: "Район"
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/market/competitors-table.tsx",
                                    lineNumber: 88,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                    scope: "col",
                                    children: "Тип"
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/market/competitors-table.tsx",
                                    lineNumber: 89,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                    scope: "col",
                                    children: "Загрузка сегодня"
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/market/competitors-table.tsx",
                                    lineNumber: 90,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                    scope: "col",
                                    children: "Средняя цена"
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/market/competitors-table.tsx",
                                    lineNumber: 91,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                    scope: "col",
                                    children: "Изменение цены"
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/market/competitors-table.tsx",
                                    lineNumber: 92,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                    scope: "col",
                                    children: "Статус"
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/market/competitors-table.tsx",
                                    lineNumber: 93,
                                    columnNumber: 13
                                }, this),
                                editable && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                    scope: "col",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "sr-only",
                                        children: "Действия"
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/market/competitors-table.tsx",
                                        lineNumber: 96,
                                        columnNumber: 17
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/market/competitors-table.tsx",
                                    lineNumber: 95,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/market/competitors-table.tsx",
                            lineNumber: 86,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/competitors-table.tsx",
                        lineNumber: 85,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("tbody", {
                        children: rows.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                colSpan: editable ? 8 : 7,
                                "data-testid": "market-list-none",
                                children: "По такому отбору конкурентов нет."
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/competitors-table.tsx",
                                lineNumber: 104,
                                columnNumber: 15
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/market/competitors-table.tsx",
                            lineNumber: 103,
                            columnNumber: 13
                        }, this) : rows.map((c)=>{
                            const full = byId.get(c.id);
                            const price = priceById.get(c.id);
                            const cell = c.cells.find((x)=>x.date === today);
                            const now = cell?.bp ?? null;
                            // снимок сборщика только уровнем: словом вместо прочерка (DATA_MODEL §23.1)
                            const word = now === null && cell?.level ? ({
                                SOLD_OUT: 'Нет мест',
                                FEW_LEFT: 'Мало мест',
                                AVAILABLE: 'Есть места'
                            })[cell.level] : null;
                            const level = word ? ({
                                SOLD_OUT: 'high',
                                FEW_LEFT: 'mid',
                                AVAILABLE: 'low'
                            })[cell.level] : (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$market$2f$occupancy$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["demandLevel"])(now);
                            const status = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$market$2f$competitor$2d$status$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["competitorStatus"])(today, c.lastObservedOn, price?.lastObservedOn ?? null);
                            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                "data-testid": `market-list-row-${c.id}`,
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                        scope: "row",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "market-name",
                                                children: c.name
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/market/competitors-table.tsx",
                                                lineNumber: 126,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "market-sub",
                                                children: [
                                                    full.address,
                                                    c.distanceM !== null ? `${c.distanceM} м` : null
                                                ].filter(Boolean).join(', ') || ' '
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/market/competitors-table.tsx",
                                                lineNumber: 127,
                                                columnNumber: 21
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/market/competitors-table.tsx",
                                        lineNumber: 125,
                                        columnNumber: 19
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                        children: full.district ?? '–'
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/market/competitors-table.tsx",
                                        lineNumber: 131,
                                        columnNumber: 19
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                        children: full.category ?? '–'
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/market/competitors-table.tsx",
                                        lineNumber: 132,
                                        columnNumber: 19
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["cx"])(level && `market-cell market-cell--${level}`),
                                        "data-testid": "market-list-now",
                                        children: word ?? (now === null ? '–' : (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$market$2f$occupancy$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["formatOccupancy"])(Math.round(now / 100) * 100))
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/market/competitors-table.tsx",
                                        lineNumber: 133,
                                        columnNumber: 19
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                        "data-testid": "market-list-price",
                                        children: price?.avgMinor ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$money$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["formatMoney"])(price.avgMinor, currency) : '–'
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/market/competitors-table.tsx",
                                        lineNumber: 136,
                                        columnNumber: 19
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                        "data-testid": "market-list-change",
                                        children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$market$2f$competitor$2d$status$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["permilleText"])(price?.changePermille ?? null)
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/market/competitors-table.tsx",
                                        lineNumber: 139,
                                        columnNumber: 19
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Badge"], {
                                                tone: status.tone === 'success' ? 'ok' : status.tone === 'warning' ? 'warn' : 'neutral',
                                                children: status.label
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/market/competitors-table.tsx",
                                                lineNumber: 141,
                                                columnNumber: 21
                                            }, this),
                                            c.lastObservedOn && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "market-sub",
                                                children: [
                                                    "загрузка от ",
                                                    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$display$2d$date$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["displayDay"])(c.lastObservedOn)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/market/competitors-table.tsx",
                                                lineNumber: 144,
                                                columnNumber: 42
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/market/competitors-table.tsx",
                                        lineNumber: 140,
                                        columnNumber: 19
                                    }, this),
                                    editable && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                        className: "market-row-actions",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$market$2f$drawers$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["OccupancyButton"], {
                                                competitor: {
                                                    id: c.id,
                                                    name: c.name
                                                },
                                                cells: c.cells
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/market/competitors-table.tsx",
                                                lineNumber: 148,
                                                columnNumber: 23
                                            }, this),
                                            price && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$market$2f$drawers$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["RatesButton"], {
                                                competitor: {
                                                    id: c.id,
                                                    name: c.name
                                                },
                                                cells: price.cells,
                                                currency: currency
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/market/competitors-table.tsx",
                                                lineNumber: 150,
                                                columnNumber: 25
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$market$2f$drawers$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["CompetitorButton"], {
                                                competitor: full
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/market/competitors-table.tsx",
                                                lineNumber: 152,
                                                columnNumber: 23
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/market/competitors-table.tsx",
                                        lineNumber: 147,
                                        columnNumber: 21
                                    }, this)
                                ]
                            }, c.id, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/competitors-table.tsx",
                                lineNumber: 124,
                                columnNumber: 17
                            }, this);
                        })
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/competitors-table.tsx",
                        lineNumber: 101,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/competitors-table.tsx",
                lineNumber: 84,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/market/competitors-table.tsx",
        lineNumber: 43,
        columnNumber: 5
    }, this);
}
}),
"[project]/wt-personnel/apps/web/src/app/market/derive.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SHIFT_BP",
    ()=>SHIFT_BP,
    "competitorStats",
    ()=>competitorStats,
    "signalCells",
    ()=>signalCells,
    "signalNights",
    ()=>signalNights
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$index$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/index.ts [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$market$2f$occupancy$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/market/occupancy.ts [app-rsc] (ecmascript)");
;
const SHIFT_BP = 1000;
const mean = (values)=>values.length === 0 ? null : Math.round(values.reduce((a, b)=>a + b, 0) / values.length);
function competitorStats(cells) {
    const bps = cells.map((c)=>c.bp).filter((v)=>v !== null);
    const deltas = cells.map((c)=>c.deltaBp).filter((v)=>v !== null);
    return {
        avgBp: mean(bps),
        avgDeltaBp: mean(deltas),
        nights: bps.length
    };
}
function signalCells(board) {
    const own = new Map(board.own.map((o)=>[
            o.date,
            o.bp
        ]));
    const market = new Map(board.market.map((m)=>[
            m.date,
            m
        ]));
    return board.dates.map((date)=>{
        const m = market.get(date);
        const marketBp = m?.bp ?? null;
        const deltas = board.competitors.map((c)=>c.cells.find((cell)=>cell.date === date)?.deltaBp ?? null).filter((v)=>v !== null);
        const deltaBp = mean(deltas);
        const level = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$market$2f$occupancy$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["demandLevel"])(marketBp);
        const signal = level === null ? 'none' : deltaBp !== null && Math.abs(deltaBp) >= SHIFT_BP ? 'shift' : level;
        return {
            date,
            ownBp: own.get(date) ?? null,
            marketBp,
            deltaBp,
            count: m?.count ?? 0,
            signal
        };
    });
}
const signalNights = (cells)=>cells.filter((c)=>c.signal === 'high' || c.signal === 'low' || c.signal === 'shift').length;
}),
"[project]/wt-personnel/apps/web/src/app/market/drawers.tsx [app-rsc] (client reference proxy)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CompetitorButton",
    ()=>CompetitorButton,
    "NightDrawer",
    ()=>NightDrawer,
    "OccupancyButton",
    ()=>OccupancyButton,
    "RatesButton",
    ()=>RatesButton
]);
// This file is generated by next-core EcmascriptClientReferenceModule.
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const CompetitorButton = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call CompetitorButton() from the server but CompetitorButton is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx", "CompetitorButton");
const NightDrawer = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call NightDrawer() from the server but NightDrawer is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx", "NightDrawer");
const OccupancyButton = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call OccupancyButton() from the server but OccupancyButton is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx", "OccupancyButton");
const RatesButton = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call RatesButton() from the server but RatesButton is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx", "RatesButton");
}),
"[project]/wt-personnel/apps/web/src/app/market/drawers.tsx [app-rsc] (client reference proxy) <module evaluation>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CompetitorButton",
    ()=>CompetitorButton,
    "NightDrawer",
    ()=>NightDrawer,
    "OccupancyButton",
    ()=>OccupancyButton,
    "RatesButton",
    ()=>RatesButton
]);
// This file is generated by next-core EcmascriptClientReferenceModule.
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const CompetitorButton = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call CompetitorButton() from the server but CompetitorButton is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx <module evaluation>", "CompetitorButton");
const NightDrawer = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call NightDrawer() from the server but NightDrawer is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx <module evaluation>", "NightDrawer");
const OccupancyButton = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call OccupancyButton() from the server but OccupancyButton is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx <module evaluation>", "OccupancyButton");
const RatesButton = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call RatesButton() from the server but RatesButton is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx <module evaluation>", "RatesButton");
}),
"[project]/wt-personnel/apps/web/src/app/market/drawers.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$market$2f$drawers$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__$3c$module__evaluation$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/market/drawers.tsx [app-rsc] (client reference proxy) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$market$2f$drawers$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/market/drawers.tsx [app-rsc] (client reference proxy)");
;
__turbopack_context__.n(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$market$2f$drawers$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__);
}),
"[project]/wt-personnel/apps/web/src/app/market/insight-text.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "insightText",
    ()=>insightText
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$index$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/index.ts [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$market$2f$occupancy$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/market/occupancy.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$display$2d$date$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/display-date.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$plural$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/plural.ts [app-rsc] (ecmascript)");
;
;
;
/** Проценты подсказок: целые, как в таблице рынка. Хранится точнее (базисные пункты) */ const pct = (bp)=>bp === null ? '–' : (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$market$2f$occupancy$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["formatOccupancy"])(Math.round(bp / 100) * 100);
const range = (i)=>i.from === i.to ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$display$2d$date$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["displayDate"])(i.from) : `${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$display$2d$date$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["displayDate"])(i.from)} → ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$display$2d$date$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["displayDate"])(i.to)}`;
function insightText(i) {
    const nights = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$plural$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["pluralRu"])(i.nights, [
        'ночь',
        'ночи',
        'ночей'
    ]);
    const market = i.marketBp === null ? '' : `рынок ${pct(i.marketBp)}`;
    const own = i.ownBp === null ? '' : `, у вас ${pct(i.ownBp)}`;
    switch(i.kind){
        case 'high-behind':
            return {
                title: `Рынок почти полон, у вас есть места: ${range(i)}`,
                text: `${market}${own} (${nights}). Соседи распроданы: цену на эти даты можно поднять.`,
                tone: 'warn'
            };
        case 'high':
            return {
                title: `Высокий спрос: ${range(i)}`,
                text: `${market}${own} (${nights}). Проверьте, что ваша цена не ниже рынка.`,
                tone: 'info'
            };
        case 'low-ahead':
            return {
                title: `Вы продаёте лучше рынка: ${range(i)}`,
                text: `${market}${own} (${nights}). Цену держите, скидка не нужна.`,
                tone: 'ok'
            };
        case 'low':
            return {
                title: `Спрос слабый: ${range(i)}`,
                text: `${market}${own} (${nights}). Подумайте об акции или промокоде на эти даты.`,
                tone: 'info'
            };
        case 'missing':
            return {
                title: `Нет данных: ${i.competitors?.join(', ')}`,
                text: 'Внесите их загрузку, и средняя по рынку станет точнее.',
                tone: 'info'
            };
    }
}
}),
"[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "MarketCharts",
    ()=>MarketCharts
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-jsx-dev-runtime.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$index$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/index.ts [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$market$2f$occupancy$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/market/occupancy.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$display$2d$date$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/display-date.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/ui.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$money$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/money.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$market$2f$chart$2d$data$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/market/chart-data.ts [app-rsc] (ecmascript)");
;
;
;
;
;
;
/**
 * Три графика экрана «Загрузка конкурентов» (SALES2.3), чистый SVG без клиентского кода: токены `--chart-*`, подсказка
 * на каждой точке (`<title>`), таблица значений в `<details>` для читалок и клавиатуры. Цен у конкурентов нет
 * (ADR-142), поэтому графики про загрузку, наличие внесённых данных и изменение к прошлому снимку; цены ночей
 * рисуются четвёртым графиком, когда они внесены (DATA_MODEL §23.1). Линии различаются
 * штрихом и подписью, а не только цветом: цветов у графиков два.
 */ const W = 720;
const H = 168;
const PAD = {
    l: 64,
    r: 8,
    t: 12,
    b: 24
};
const PLOT = {
    w: W - PAD.l - PAD.r,
    h: H - PAD.t - PAD.b
};
const pct = (bp)=>bp === null ? 'нет данных' : (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$market$2f$occupancy$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["formatOccupancy"])(Math.round(bp / 100) * 100);
function Frame({ title, lead, note, children, rows, testId, columns }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("figure", {
        className: "market-chart",
        "data-testid": testId,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("figcaption", {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SectionTitle"], {
                        first: true,
                        children: title
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
                        lineNumber: 52,
                        columnNumber: 9
                    }, this),
                    lead && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "market-chart__lead",
                        children: lead
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
                        lineNumber: 53,
                        columnNumber: 18
                    }, this),
                    note && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "market-chart__note",
                        children: note
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
                        lineNumber: 54,
                        columnNumber: 18
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
                lineNumber: 51,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "market-chart__scroll",
                tabIndex: 0,
                role: "group",
                "aria-label": `${title}: график, прокручивается на узком экране`,
                children: children
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
                lineNumber: 56,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("details", {
                className: "market-chart__table",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("summary", {
                        children: "Значения по ночам"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
                        lineNumber: 60,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("table", {
                        className: "tbl tbl--compact",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("thead", {
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                            scope: "col",
                                            children: "Ночь"
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
                                            lineNumber: 64,
                                            columnNumber: 15
                                        }, this),
                                        columns.map((c)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                scope: "col",
                                                children: c.head
                                            }, c.head, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
                                                lineNumber: 66,
                                                columnNumber: 17
                                            }, this))
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
                                    lineNumber: 63,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
                                lineNumber: 62,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("tbody", {
                                children: rows.map((r)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                scope: "row",
                                                children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$display$2d$date$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["displayDate"])(r.date)
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
                                                lineNumber: 75,
                                                columnNumber: 17
                                            }, this),
                                            columns.map((c)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                    children: c.cell(r)
                                                }, c.head, false, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
                                                    lineNumber: 77,
                                                    columnNumber: 19
                                                }, this))
                                        ]
                                    }, r.date, true, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
                                        lineNumber: 74,
                                        columnNumber: 15
                                    }, this))
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
                                lineNumber: 72,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
                        lineNumber: 61,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
                lineNumber: 59,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
        lineNumber: 50,
        columnNumber: 5
    }, this);
}
function Axes({ rows, ticks }) {
    const every = rows.length > 20 ? 5 : rows.length > 10 ? 2 : 1;
    const band = PLOT.w / Math.max(rows.length, 1);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            ticks.map((t)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("g", {
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("line", {
                            x1: PAD.l,
                            x2: W - PAD.r,
                            y1: t.y,
                            y2: t.y,
                            stroke: "var(--grid-line)",
                            strokeWidth: 1
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
                            lineNumber: 95,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("text", {
                            x: PAD.l - 6,
                            y: t.y + 4,
                            textAnchor: "end",
                            fontSize: 13,
                            fill: "var(--muted-2)",
                            children: t.label
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
                            lineNumber: 96,
                            columnNumber: 11
                        }, this)
                    ]
                }, t.label, true, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
                    lineNumber: 94,
                    columnNumber: 9
                }, this)),
            rows.map((r, i)=>i % every === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("text", {
                    x: PAD.l + i * band + band / 2,
                    y: H - 6,
                    textAnchor: "middle",
                    fontSize: 13,
                    fill: "var(--muted-2)",
                    children: Number(r.date.slice(8, 10))
                }, r.date, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
                    lineNumber: 103,
                    columnNumber: 11
                }, this) : null)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
        lineNumber: 92,
        columnNumber: 5
    }, this);
}
function MarketCharts({ board, rates }) {
    const rows = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$market$2f$chart$2d$data$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["buildChartRows"])(board);
    const n = Math.max(rows.length, 1);
    const band = PLOT.w / n;
    const x = (i)=>Math.round(PAD.l + i * band + band / 2);
    const yPct = (bp)=>Math.round(PAD.t + PLOT.h - Math.min(bp, 10000) / 10000 * PLOT.h);
    const ticksPct = [
        0,
        5000,
        10000
    ].map((bp)=>({
            y: yPct(bp),
            label: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$market$2f$occupancy$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["formatOccupancy"])(bp)
        }));
    const series = [
        {
            key: 'max',
            label: 'Самый загруженный сосед',
            stroke: 'var(--muted-2)',
            dash: '2 4',
            width: 1.5
        },
        {
            key: 'min',
            label: 'Самый свободный сосед',
            stroke: 'var(--muted-2)',
            dash: '8 4',
            width: 1.5
        },
        {
            key: 'market',
            label: 'Рынок (среднее)',
            stroke: 'var(--chart-2)',
            dash: undefined,
            width: 2.5
        },
        {
            key: 'own',
            label: 'Вы',
            stroke: 'var(--chart-1)',
            dash: undefined,
            width: 3
        }
    ];
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        className: "market-charts",
        "aria-label": "Графики",
        "data-testid": "market-charts",
        children: [
            rates && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(PriceChart, {
                rates: rates
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
                lineNumber: 129,
                columnNumber: 17
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(Frame, {
                testId: "market-chart-load",
                title: "Загрузка по ночам",
                note: "Ваша загрузка по календарю, рынок и два соседа-крайних по внесённым данным. Это внесённые значения, а не измеренная загрузка.",
                rows: rows,
                columns: [
                    {
                        head: 'Вы',
                        cell: (r)=>pct(r.own)
                    },
                    {
                        head: 'Рынок',
                        cell: (r)=>pct(r.market)
                    },
                    {
                        head: 'Самый свободный',
                        cell: (r)=>pct(r.min)
                    },
                    {
                        head: 'Самый загруженный',
                        cell: (r)=>pct(r.max)
                    }
                ],
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                        viewBox: `0 0 ${W} ${H}`,
                        width: "100%",
                        role: "img",
                        "aria-label": "Загрузка по ночам: вы, рынок и крайние соседи",
                        className: "market-chart__svg",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(Axes, {
                                rows: rows,
                                ticks: ticksPct
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
                                lineNumber: 143,
                                columnNumber: 11
                            }, this),
                            series.map((s)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                                    "data-series": s.key,
                                    d: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$market$2f$chart$2d$data$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["linePath"])(rows.map((r)=>r[s.key]), yPct, x),
                                    fill: "none",
                                    stroke: s.stroke,
                                    strokeWidth: s.width,
                                    strokeDasharray: s.dash,
                                    strokeLinecap: "round",
                                    strokeLinejoin: "round"
                                }, s.key, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
                                    lineNumber: 145,
                                    columnNumber: 13
                                }, this)),
                            rows.map((r, i)=>r.own === null ? null : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("circle", {
                                    cx: x(i),
                                    cy: yPct(r.own),
                                    r: 3,
                                    fill: "var(--chart-1)",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("title", {
                                        children: `${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$display$2d$date$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["displayDate"])(r.date)}: вы ${pct(r.own)}, рынок ${pct(r.market)}`
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
                                        lineNumber: 160,
                                        columnNumber: 17
                                    }, this)
                                }, r.date, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
                                    lineNumber: 159,
                                    columnNumber: 15
                                }, this))
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
                        lineNumber: 142,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                        className: "market-chart__legend",
                        "aria-label": "Обозначения",
                        children: series.slice().reverse().map((s)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                                        width: "28",
                                        height: "8",
                                        "aria-hidden": "true",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("line", {
                                            x1: "0",
                                            x2: "28",
                                            y1: "4",
                                            y2: "4",
                                            stroke: s.stroke,
                                            strokeWidth: s.width,
                                            strokeDasharray: s.dash
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
                                            lineNumber: 172,
                                            columnNumber: 19
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
                                        lineNumber: 171,
                                        columnNumber: 17
                                    }, this),
                                    s.label
                                ]
                            }, s.key, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
                                lineNumber: 170,
                                columnNumber: 15
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
                        lineNumber: 165,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
                lineNumber: 130,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(CoverageChart, {
                rows: rows
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
                lineNumber: 180,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(ChangeChart, {
                rows: rows,
                compareDays: board.compareDays
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
                lineNumber: 181,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
        lineNumber: 128,
        columnNumber: 5
    }, this);
}
/** «11–15 окт.» в одном месяце, «28 окт. – 3 нояб.» через границу месяца */ const span = (from, to)=>from === to ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$display$2d$date$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["displayDate"])(from) : from.slice(0, 7) === to.slice(0, 7) ? `${Number(from.slice(8, 10))}–${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$display$2d$date$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["displayDate"])(to)}` : `${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$display$2d$date$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["displayDate"])(from)} – ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$display$2d$date$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["displayDate"])(to)}`;
/** Полнота словами: короткий период пересказывается отрезками, длинный пёстрый счётом ночей */ function coverageLead(rows) {
    const runs = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$market$2f$chart$2d$data$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["coverageRuns"])(rows);
    const total = runs[0]?.total ?? 0;
    if (!runs.length) return '';
    if (runs.every((r)=>r.withData === r.total)) return `На все ночи внесены данные всех соседей (${total} из ${total}).`;
    if (runs.length <= 4) return `${runs.map((r)=>`${span(r.from, r.to)}: ${r.withData === 0 ? 'нет данных' : `${r.withData} из ${r.total} соседей`}`).join('; ')}.`;
    const count = (f)=>rows.filter(f).length;
    return `Данные всех соседей на ${count((r)=>r.withData === r.total)} ночах из ${rows.length}, части соседей на ${count((r)=>r.withData > 0 && r.withData < r.total)}, нет данных на ${count((r)=>r.withData === 0)}.`;
}
const COVERAGE = [
    {
        key: 'full',
        label: 'все соседи'
    },
    {
        key: 'part',
        label: 'часть соседей'
    },
    {
        key: 'none',
        label: 'нет данных'
    }
];
const coverageOf = (r)=>r.withData === 0 ? 'none' : r.withData >= r.total ? 'full' : 'part';
/** Ячейка полосы: заполнена целиком, наполовину или пустая пунктирная, чтобы состояние читалось и без цвета */ function CoverageCell({ x, y, w, h, state }) {
    if (state === 'none') return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("rect", {
        x: x,
        y: y,
        width: w,
        height: h,
        rx: 4,
        fill: "none",
        stroke: "var(--muted-2)",
        strokeDasharray: "3 3"
    }, void 0, false, {
        fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
        lineNumber: 217,
        columnNumber: 12
    }, this);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("rect", {
                x: x,
                y: y,
                width: w,
                height: h,
                rx: 4,
                fill: "var(--chart-1-soft)"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
                lineNumber: 220,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("rect", {
                x: x,
                y: state === 'full' ? y : y + h / 2,
                width: w,
                height: state === 'full' ? h : h / 2,
                rx: 4,
                fill: "var(--chart-1)"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
                lineNumber: 221,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
        lineNumber: 219,
        columnNumber: 5
    }, this);
}
const STRIP = {
    h: 64,
    top: 6,
    cell: 28
};
function CoverageChart({ rows }) {
    const band = PLOT.w / Math.max(rows.length, 1);
    const cellW = Math.max(2, Math.min(40, band - 4));
    const every = rows.length > 20 ? 5 : rows.length > 10 ? 2 : 1;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(Frame, {
        testId: "market-chart-data",
        title: "Полнота данных по соседям",
        lead: coverageLead(rows),
        note: "Чем меньше соседей внесено на ночь, тем меньше стоит доверять средней по рынку на эту ночь. Ночь без данных не значит, что отель пуст: просто нет замера.",
        rows: rows,
        columns: [
            {
                head: 'С данными',
                cell: (r)=>`${r.withData} из ${r.total}`
            }
        ],
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                viewBox: `0 0 ${W} ${STRIP.h}`,
                width: "100%",
                role: "img",
                "aria-label": "Полнота данных по соседям на каждую ночь",
                className: "market-chart__svg",
                children: rows.map((r, i)=>{
                    const x0 = PAD.l + i * band + (band - cellW) / 2;
                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("g", {
                        "data-coverage": coverageOf(r),
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(CoverageCell, {
                                x: x0,
                                y: STRIP.top,
                                w: cellW,
                                h: STRIP.cell,
                                state: coverageOf(r)
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
                                lineNumber: 246,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("title", {
                                children: `${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$display$2d$date$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["displayDate"])(r.date)}: ${r.withData} из ${r.total} соседей`
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
                                lineNumber: 247,
                                columnNumber: 15
                            }, this),
                            i % every === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("text", {
                                x: x0 + cellW / 2,
                                y: STRIP.top + STRIP.cell + 20,
                                textAnchor: "middle",
                                fontSize: 13,
                                fill: "var(--muted-2)",
                                children: Number(r.date.slice(8, 10))
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
                                lineNumber: 249,
                                columnNumber: 17
                            }, this)
                        ]
                    }, r.date, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
                        lineNumber: 245,
                        columnNumber: 13
                    }, this);
                })
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
                lineNumber: 241,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                className: "market-chart__legend",
                "aria-label": "Обозначения",
                children: COVERAGE.map((c)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                                width: "20",
                                height: "14",
                                "aria-hidden": "true",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(CoverageCell, {
                                    x: 1,
                                    y: 1,
                                    w: 18,
                                    h: 12,
                                    state: c.key
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
                                    lineNumber: 261,
                                    columnNumber: 15
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
                                lineNumber: 260,
                                columnNumber: 13
                            }, this),
                            c.label
                        ]
                    }, c.key, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
                        lineNumber: 259,
                        columnNumber: 11
                    }, this))
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
                lineNumber: 257,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
        lineNumber: 233,
        columnNumber: 5
    }, this);
}
const compareWord = (days)=>days === 1 ? 'со вчерашним замером' : days === 7 ? 'с замером неделю назад' : `с замером ${days} дн. назад`;
const points = (bp)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$market$2f$occupancy$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["formatPoints"])(Math.round(bp / 100) * 100);
function changeLead(rows) {
    const s = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$market$2f$chart$2d$data$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["changeSummary"])(rows);
    if (!s) return undefined;
    const avg = Math.round(s.avgBp / 100) * 100;
    const word = avg > 0 ? 'соседи заполняются' : avg < 0 ? 'соседи освобождаются' : 'загрузка соседей не изменилась';
    return `В среднем ${points(avg)}: ${word}. Ночей с ростом: ${s.up}, с падением: ${s.down}, всего со сравнением: ${s.nights}.`;
}
/**
 * Изменение загрузки соседей к прошлому замеру. Шкала от фактических значений (ноль внизу, если всё в плюс), а не
 * симметричная: иначе половина графика пустая. Значение подписано над столбиком, пока столбики не слишком узкие.
 */ function ChangeChart({ rows, compareDays }) {
    const comparing = compareDays > 0;
    const band = PLOT.w / Math.max(rows.length, 1);
    const x = (i)=>Math.round(PAD.l + i * band + band / 2);
    const barW = Math.min(24, Math.max(2, band - 2));
    const values = rows.flatMap((r)=>r.changeBp === null ? [] : [
            r.changeBp
        ]);
    const hi = Math.max(0, ...values);
    const lo = Math.min(0, ...values);
    const room = Math.max(hi - lo, 500) * 0.22; // место под подпись значения
    const top = hi + (hi > 0 || lo === 0 ? room : 0);
    const bottom = lo - (lo < 0 ? room : 0);
    const y = (bp)=>Math.round(PAD.t + (top - bp) / (top - bottom) * PLOT.h);
    const labelled = band >= 30;
    // подписи на столбиках уже называют значения; крайние отметки шкалы нужны, только когда подписей нет
    const ticks = [
        {
            y: y(0),
            label: '0'
        }
    ];
    if (!labelled && hi > 0) ticks.unshift({
        y: y(hi),
        label: points(hi)
    });
    if (!labelled && lo < 0) ticks.push({
        y: y(lo),
        label: points(lo)
    });
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(Frame, {
        testId: "market-chart-change",
        title: "Как меняется загрузка соседей",
        lead: comparing ? changeLead(rows) : undefined,
        note: comparing ? `Сравнение ${compareWord(compareDays)}: на сколько в среднем выросла или упала загрузка соседей на каждую ночь. «+12 п.п.» значит, например, было 80 %, стало 92 %.` : 'Включите «Изменение» в строке выше: сейчас сравнения нет.',
        rows: rows,
        columns: [
            {
                head: 'Изменение',
                cell: (r)=>r.changeBp === null ? 'нет данных' : points(r.changeBp)
            }
        ],
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
            viewBox: `0 0 ${W} ${H}`,
            width: "100%",
            role: "img",
            "aria-label": "Изменение загрузки соседей по ночам",
            className: "market-chart__svg",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(Axes, {
                    rows: rows,
                    ticks: ticks
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
                    lineNumber: 318,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("line", {
                    x1: PAD.l,
                    x2: W - PAD.r,
                    y1: y(0),
                    y2: y(0),
                    stroke: "var(--muted-2)",
                    strokeWidth: 1.5
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
                    lineNumber: 319,
                    columnNumber: 9
                }, this),
                rows.map((r, i)=>{
                    if (!comparing || r.changeBp === null) return null;
                    const y0 = y(0);
                    const y1 = y(r.changeBp);
                    const up = r.changeBp >= 0;
                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("g", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("rect", {
                                x: x(i) - barW / 2,
                                y: Math.min(y0, y1),
                                width: barW,
                                height: Math.max(1, Math.abs(y1 - y0)),
                                fill: up ? 'var(--chart-2)' : 'var(--danger)',
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("title", {
                                    children: `${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$display$2d$date$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["displayDate"])(r.date)}: ${points(r.changeBp)}`
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
                                    lineNumber: 334,
                                    columnNumber: 17
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
                                lineNumber: 327,
                                columnNumber: 15
                            }, this),
                            labelled && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("text", {
                                x: x(i),
                                y: up ? y1 - 6 : y1 + 16,
                                textAnchor: "middle",
                                fontSize: 13,
                                fill: "var(--text-2)",
                                children: points(r.changeBp).replace(' п.п.', '')
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
                                lineNumber: 337,
                                columnNumber: 17
                            }, this)
                        ]
                    }, r.date, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
                        lineNumber: 326,
                        columnNumber: 13
                    }, this);
                })
            ]
        }, void 0, true, {
            fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
            lineNumber: 317,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
        lineNumber: 305,
        columnNumber: 5
    }, this);
}
/**
 * Цены рынка по ночам: средняя и крайние цены соседей из внесённых данных. Ось начинается с нуля не всегда: цены
 * соседей лежат в узком коридоре, и от нуля линия была бы плоской; подписи оси это показывают прямо.
 */ function PriceChart({ rates }) {
    const rows = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$market$2f$chart$2d$data$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["buildPriceRows"])(rates);
    const known = rows.flatMap((r)=>r.min === null || r.max === null ? [] : [
            r.min,
            r.max
        ]);
    const n = Math.max(rows.length, 1);
    const band = PLOT.w / n;
    const x = (i)=>Math.round(PAD.l + i * band + band / 2);
    const lo = known.length ? Math.min(...known) : 0;
    const hi = known.length ? Math.max(...known) : 1;
    const pad = Math.max(Math.round((hi - lo) * 0.1), 100);
    const bottom = Math.max(0, lo - pad);
    const top = hi + pad;
    const y = (v)=>Math.round(PAD.t + PLOT.h - (v - bottom) / Math.max(top - bottom, 1) * PLOT.h);
    const cur = rates.currency ?? 'KZT';
    const money = (v)=>v === null ? 'нет данных' : (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$money$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["formatMoney"])(String(v), cur);
    const series = [
        {
            key: 'max',
            label: 'Самая высокая цена соседа',
            stroke: 'var(--muted-2)',
            dash: '2 4',
            width: 1.5
        },
        {
            key: 'min',
            label: 'Самая низкая цена соседа',
            stroke: 'var(--muted-2)',
            dash: '8 4',
            width: 1.5
        },
        {
            key: 'avg',
            label: 'Средняя цена рынка',
            stroke: 'var(--chart-2)',
            dash: undefined,
            width: 3
        }
    ];
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(Frame, {
        testId: "market-chart-price",
        title: "Цены рынка по ночам",
        note: "Цены соседей, которые вы внесли. Это внесённые значения, а не измеренные цены площадок.",
        rows: rows,
        columns: [
            {
                head: 'Средняя',
                cell: (r)=>money(r.avg)
            },
            {
                head: 'Самая низкая',
                cell: (r)=>money(r.min)
            },
            {
                head: 'Самая высокая',
                cell: (r)=>money(r.max)
            },
            {
                head: 'Отелей с ценой',
                cell: (r)=>String(r.count)
            }
        ],
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                viewBox: `0 0 ${W} ${H}`,
                width: "100%",
                role: "img",
                "aria-label": "Цены рынка по ночам: средняя и крайние",
                className: "market-chart__svg",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(Axes, {
                        rows: rows,
                        ticks: [
                            bottom,
                            Math.round((bottom + top) / 2),
                            top
                        ].map((v)=>({
                                y: y(v),
                                label: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$market$2f$chart$2d$data$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["shortMoney"])(v)
                            }))
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
                        lineNumber: 386,
                        columnNumber: 9
                    }, this),
                    series.map((s)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                            "data-series": s.key,
                            d: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$market$2f$chart$2d$data$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["linePath"])(rows.map((r)=>r[s.key]), y, x),
                            fill: "none",
                            stroke: s.stroke,
                            strokeWidth: s.width,
                            strokeDasharray: s.dash,
                            strokeLinecap: "round",
                            strokeLinejoin: "round"
                        }, s.key, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
                            lineNumber: 391,
                            columnNumber: 11
                        }, this)),
                    rows.map((r, i)=>r.avg === null ? null : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("circle", {
                            cx: x(i),
                            cy: y(r.avg),
                            r: 3,
                            fill: "var(--chart-2)",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("title", {
                                children: `${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$display$2d$date$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["displayDate"])(r.date)}: средняя ${money(r.avg)}`
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
                                lineNumber: 406,
                                columnNumber: 15
                            }, this)
                        }, r.date, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
                            lineNumber: 405,
                            columnNumber: 13
                        }, this))
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
                lineNumber: 385,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                className: "market-chart__legend",
                "aria-label": "Обозначения",
                children: series.slice().reverse().map((s)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                                width: "28",
                                height: "8",
                                "aria-hidden": "true",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("line", {
                                    x1: "0",
                                    x2: "28",
                                    y1: "4",
                                    y2: "4",
                                    stroke: s.stroke,
                                    strokeWidth: s.width,
                                    strokeDasharray: s.dash
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
                                    lineNumber: 418,
                                    columnNumber: 17
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
                                lineNumber: 417,
                                columnNumber: 15
                            }, this),
                            s.label
                        ]
                    }, s.key, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
                        lineNumber: 416,
                        columnNumber: 13
                    }, this))
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
                lineNumber: 411,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx",
        lineNumber: 373,
        columnNumber: 5
    }, this);
}
}),
"[project]/wt-personnel/apps/web/src/app/market/page.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>MarketPage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-jsx-dev-runtime.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/client/app-dir/link.react-server.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$api$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/api/navigation.react-server.js [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/client/components/navigation.react-server.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$index$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/index.ts [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$accounts$2f$permissions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/accounts/permissions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$market$2f$occupancy$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/market/occupancy.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$search$2d$params$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/search-params.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/api.ts [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$hotel$2d$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/hotel-api.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$vertical$2d$guard$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/vertical-guard.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$display$2d$date$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/display-date.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$plural$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/plural.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$desk$2d$shell$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/desk-shell.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$load$2d$error$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/load-error.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$page$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/page.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$load$2d$error$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/load-error.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$date$2d$field$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/date-field.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$icon$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/icon.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/ui.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$market$2f$drawers$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/market/drawers.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$market$2f$market$2d$charts$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/market/market-charts.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$market$2f$competitors$2d$table$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/market/competitors-table.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$market$2f$derive$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/market/derive.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$market$2f$calendar$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/market/calendar.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$market$2f$chart$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/market/chart.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$market$2f$insight$2d$text$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/market/insight-text.ts [app-rsc] (ecmascript)");
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
const WINDOWS = [
    7,
    14,
    30
];
const COMPARES = [
    [
        1,
        'со вчера'
    ],
    [
        7,
        'с неделей назад'
    ],
    [
        0,
        'без сравнения'
    ]
];
/** Таблица и подсказки: целые проценты; плитки: до десятых. Хранится точнее (базисные пункты) */ const round = (bp, step)=>Math.round(bp / step) * step;
const pct = (bp)=>bp === null ? '–' : (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$market$2f$occupancy$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["formatOccupancy"])(round(bp, 100));
const pctTile = (bp)=>bp === null ? '–' : (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$market$2f$occupancy$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["formatOccupancy"])(round(bp, 10));
const points = (bp)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$market$2f$occupancy$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["formatPoints"])(round(bp, 100));
const weekday = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'UTC',
    weekday: 'short'
});
const dayHead = (d)=>({
        wd: weekday.format(new Date(`${d}T00:00:00Z`)),
        day: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$display$2d$date$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["displayDate"])(d)
    });
/** Уровень наличия без точного процента (сборщик видит «мест нет» или «осталось 2»): словом, тон как у спроса */ const AVAILABILITY = {
    SOLD_OUT: {
        word: 'Нет мест',
        tone: 'high'
    },
    FEW_LEFT: {
        word: 'Мало мест',
        tone: 'mid'
    },
    AVAILABLE: {
        word: 'Есть места',
        tone: 'low'
    }
};
const LEVEL_WORD = {
    high: 'высокий спрос',
    mid: 'средний спрос',
    low: 'слабый спрос'
};
async function MarketPage({ searchParams }) {
    // мониторинг конкурентов считает загрузку гостиниц: салону и ресторану его нет, они уходят на свой «Сегодня»
    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$vertical$2d$guard$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["requireFeature"])('/market');
    const sp = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$search$2d$params$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["normalizeSearchParams"])(await searchParams);
    const today = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$hotel$2d$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["hotelToday"])();
    const from = sp.from && (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$hotel$2d$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["validDate"])(sp.from) ? sp.from : today;
    const days = WINDOWS.includes(Number(sp.days)) ? Number(sp.days) : 14;
    const asOf = sp.asOf && (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$hotel$2d$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["validDate"])(sp.asOf) && sp.asOf <= today ? sp.asOf : today;
    const compare = sp.compare && [
        '0',
        '1',
        '7'
    ].includes(sp.compare) ? Number(sp.compare) : 1;
    // «История ночи» (M1.2): панель по адресу `?night=`, свой запрос только когда она открыта
    const night = sp.night && (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$hotel$2d$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["validDate"])(sp.night) ? sp.night : null;
    const base = new URLSearchParams({
        from,
        days: String(days),
        asOf,
        compare: String(compare)
    });
    const nightHref = (d)=>`/market?${base}&night=${d}`;
    const district = sp.district ?? '';
    const category = sp.category ?? '';
    const [loaded, shell, nightLoaded, rates] = await Promise.all([
        __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["marketApi"].occupancy({
            from,
            days,
            asOf,
            compare
        }).then((r)=>({
                ok: true,
                r
            }), (e)=>{
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["unstable_rethrow"])(e);
            return {
                ok: false,
                e
            };
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$desk$2d$shell$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["deskShell"])(),
        night ? __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["marketApi"].night(night).then((r)=>r, (e)=>{
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["unstable_rethrow"])(e);
            return null;
        }) : null,
        // цены вторым, необязательным запросом: сбой не роняет страницу загрузки, график и столбцы цен просто не рисуются
        __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["marketApi"].rates({
            from,
            days,
            asOf,
            compare
        }).then((r)=>r, (e)=>{
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["unstable_rethrow"])(e);
            return null;
        })
    ]);
    const role = shell.access.role;
    const editable = !shell.readOnly && (role === null || (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$accounts$2f$permissions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["can"])(role, 'rates'));
    const subtitle = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        "data-testid": "market-subtitle",
        children: "Сравните свою загрузку с ближайшими объектами: где рынок полон, цену можно поднять; где пусто, пора акция."
    }, void 0, false, {
        fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
        lineNumber: 131,
        columnNumber: 5
    }, this);
    if (!loaded.ok) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$page$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Page"], {
        width: "wide",
        title: "Анализ конкурентов",
        subtitle: subtitle,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$load$2d$error$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["LoadError"], {
            testId: "market-error",
            ...(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$load$2d$error$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["loadErrorProps"])(loaded.e)
        }, void 0, false, {
            fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
            lineNumber: 139,
            columnNumber: 9
        }, this)
    }, void 0, false, {
        fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
        lineNumber: 138,
        columnNumber: 7
    }, this);
    const view = loaded.r;
    const empty = view.competitors.length === 0;
    const cells = empty ? [] : (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$market$2f$derive$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["signalCells"])(view.board);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$page$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Page"], {
        width: "wide",
        title: "Анализ конкурентов",
        subtitle: subtitle,
        // одна кнопка «Добавить» на экране: пусто, она в пустом состоянии; есть конкуренты, в шапке
        actions: editable && !empty ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$market$2f$drawers$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["CompetitorButton"], {
            defaultOpen: sp.add === '1'
        }, void 0, false, {
            fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
            lineNumber: 151,
            columnNumber: 37
        }, this) : undefined,
        children: [
            !empty && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(Toolbar, {
                from: from,
                days: days,
                asOf: asOf,
                compare: compare,
                today: today
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                lineNumber: 153,
                columnNumber: 18
            }, this),
            empty ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["EmptyState"], {
                icon: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$icon$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Icon"], {
                    name: "analytics"
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                    lineNumber: 156,
                    columnNumber: 17
                }, this),
                title: "Добавьте ближайших конкурентов",
                "data-testid": "market-empty",
                details: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(HowItWorks, {}, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                    lineNumber: 159,
                    columnNumber: 20
                }, this),
                actions: editable ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$market$2f$drawers$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["CompetitorButton"], {
                    primary: true,
                    defaultOpen: sp.add === '1'
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                    lineNumber: 160,
                    columnNumber: 31
                }, this) : undefined,
                children: [
                    "Три-пять отелей рядом с вами, с которыми гость сравнивает вас при выборе.",
                    ' ',
                    !editable && 'Добавлять конкурентов могут владелец и управляющий.'
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                lineNumber: 155,
                columnNumber: 9
            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Fragment"], {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(Summary, {
                        view: view,
                        signals: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$market$2f$derive$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["signalNights"])(cells)
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                        lineNumber: 167,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "market-overview",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                                className: "market-block",
                                "aria-labelledby": "market-calendar-title",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SectionTitle"], {
                                        id: "market-calendar-title",
                                        children: [
                                            "Календарь рыночных сигналов (",
                                            (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$plural$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["pluralRu"])(days, [
                                                'ночь',
                                                'ночи',
                                                'ночей'
                                            ]),
                                            ")"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                                        lineNumber: 170,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$market$2f$calendar$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SignalCalendar"], {
                                        cells: cells,
                                        nightHref: nightHref
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                                        lineNumber: 173,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                                lineNumber: 169,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                                className: "market-block",
                                "aria-labelledby": "market-chart-title",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SectionTitle"], {
                                        id: "market-chart-title",
                                        children: "Сравнение загрузки"
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                                        lineNumber: 176,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$market$2f$chart$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["OccupancyChart"], {
                                        points: cells.map((c)=>({
                                                date: c.date,
                                                label: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$display$2d$date$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["displayDate"])(c.date),
                                                ownBp: c.ownBp,
                                                marketBp: c.marketBp,
                                                count: c.count
                                            }))
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                                        lineNumber: 177,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                                lineNumber: 175,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(Recommendation, {
                                view: view,
                                asOf: asOf
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                                lineNumber: 187,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                        lineNumber: 168,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["cx"])('market-main', view.board.insights.length <= 1 && 'market-main--single'),
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$market$2f$competitors$2d$table$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["CompetitorsTable"], {
                                view: view,
                                rates: rates,
                                today: today,
                                editable: editable,
                                district: district,
                                category: category,
                                keep: [
                                    ...base.entries()
                                ]
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                                lineNumber: 190,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(Insights, {
                                view: view
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                                lineNumber: 199,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                        lineNumber: 189,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$market$2f$market$2d$charts$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["MarketCharts"], {
                        board: view.board,
                        rates: rates && rates.board.summary.competitorsWithData > 0 ? rates : null
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                        lineNumber: 201,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(Grid, {
                        view: view,
                        nightHref: nightHref
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                        lineNumber: 202,
                        columnNumber: 11
                    }, this),
                    night && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$market$2f$drawers$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["NightDrawer"], {
                        date: night,
                        history: nightLoaded,
                        closeHref: `/market?${base}`
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                        lineNumber: 204,
                        columnNumber: 13
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                lineNumber: 166,
                columnNumber: 9
            }, this),
            !empty && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "market-note",
                "data-testid": "market-source-note",
                children: "Ваша загрузка берётся из календаря: занятые места от всех, включая заблокированные. Загрузку и цены соседей вносите вы или загружаете из файла; снимки сборщика подписаны «ИИ». Сайты бронирования мы автоматически не читаем, их условия это запрещают; автоматический сбор из разрешённого источника пока не подключён."
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                lineNumber: 209,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
        lineNumber: 146,
        columnNumber: 5
    }, this);
}
/**
 * Как работает раздел: три шага. Источник загрузки не обещаем: сбор с площадок не решён (Q-257 открыт, ADR-142
 * запрещает автоматически читать площадки), поэтому шаг 2 говорит «вручную или сборщиком».
 */ function HowItWorks() {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Grid"], {
        min: 180,
        role: "list",
        className: "market-steps",
        "data-testid": "market-steps",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                role: "listitem",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                        children: "Добавьте соседа"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                        lineNumber: 228,
                        columnNumber: 9
                    }, this),
                    "название, расстояние и число номеров"
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                lineNumber: 227,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                role: "listitem",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                        children: "Загрузка соседей обновляется"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                        lineNumber: 232,
                        columnNumber: 9
                    }, this),
                    "вручную или сборщиком: процент занятых номеров на каждую ближайшую ночь"
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                lineNumber: 231,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                role: "listitem",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                        children: "WETOP подсказывает цену"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                        lineNumber: 236,
                        columnNumber: 9
                    }, this),
                    "где рынок почти полон, цену можно поднять; где пусто, пора акция"
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                lineNumber: 235,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
        lineNumber: 226,
        columnNumber: 5
    }, this);
}
/**
 * Кто даёт данные по соседу: «ИИ», только если в окне есть снимки сборщика (`AI_AGENT`). Ссылка на площадку есть, а
 * сборщика нет: «Сбор не подключён» (не обещаем сбор до решения Q-257). Ссылки нет: «вручную».
 */ function tracking(c) {
    if (c.sources.includes('AI_AGENT')) return {
        word: 'ИИ',
        tone: 'info'
    };
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$market$2f$occupancy$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["competitorPlatform"])(c.url) ? {
        word: 'Сбор не подключён',
        tone: 'neutral'
    } : {
        word: 'вручную',
        tone: 'neutral'
    };
}
function Toolbar({ from, days, asOf, compare, today }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        className: "market-controls",
        "aria-label": "Период и сравнение",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
            method: "get",
            className: "market-toolbar",
            "data-testid": "market-form",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Field"], {
                    inline: true,
                    label: "С",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$date$2d$field$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["DateInput"], {
                        name: "from",
                        defaultValue: from,
                        "aria-label": "Первая ночь"
                    }, `from-${from}`, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                        lineNumber: 274,
                        columnNumber: 11
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                    lineNumber: 273,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Field"], {
                    inline: true,
                    label: "Ночей",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Select"], {
                        name: "days",
                        defaultValue: String(days),
                        "data-testid": "market-days",
                        children: WINDOWS.map((w)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                value: w,
                                children: w
                            }, w, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                                lineNumber: 279,
                                columnNumber: 15
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                        lineNumber: 277,
                        columnNumber: 11
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                    lineNumber: 276,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Field"], {
                    inline: true,
                    label: "Данные на",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$date$2d$field$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["DateInput"], {
                        name: "asOf",
                        defaultValue: asOf,
                        "aria-label": "Дата снимка"
                    }, `asof-${asOf}`, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                        lineNumber: 286,
                        columnNumber: 11
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                    lineNumber: 285,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Field"], {
                    inline: true,
                    label: "Изменение",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Select"], {
                        name: "compare",
                        defaultValue: String(compare),
                        "data-testid": "market-compare",
                        children: COMPARES.map(([v, label])=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                value: v,
                                children: label
                            }, v, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                                lineNumber: 291,
                                columnNumber: 15
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                        lineNumber: 289,
                        columnNumber: 11
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                    lineNumber: 288,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Button"], {
                    type: "submit",
                    tone: "secondary",
                    children: "Показать"
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                    lineNumber: 297,
                    columnNumber: 9
                }, this),
                (from !== today || asOf !== today) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                    href: "/market",
                    className: "market-reset",
                    children: "С сегодня"
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                    lineNumber: 301,
                    columnNumber: 11
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
            lineNumber: 272,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
        lineNumber: 271,
        columnNumber: 5
    }, this);
}
function Summary({ view, signals }) {
    const s = view.board.summary;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "market-tiles",
        "data-testid": "market-tiles",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Stat"], {
                label: "Ваша загрузка",
                value: pctTile(s.ownBp),
                hint: "по календарю",
                testId: "market-tile-own"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                lineNumber: 314,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Stat"], {
                label: "Загрузка рынка",
                value: pctTile(s.marketBp),
                hint: `по ${s.competitorsWithData} из ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$plural$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["pluralRu"])(s.competitors, [
                    'конкурента',
                    'конкурентов',
                    'конкурентов'
                ])}`,
                testId: "market-tile-market"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                lineNumber: 315,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Stat"], {
                label: "Разница с рынком",
                value: s.gapBp === null ? '–' : (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$market$2f$occupancy$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["formatPoints"])(round(s.gapBp, 10)),
                hint: s.gapBp === null ? 'нет данных' : s.gapBp < 0 ? 'вы ниже рынка' : s.gapBp > 0 ? 'вы выше рынка' : 'вровень',
                tone: s.gapBp !== null && s.gapBp <= -1000 ? 'warning' : 'neutral',
                testId: "market-tile-gap"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                lineNumber: 321,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Stat"], {
                label: "Ночей высокого спроса",
                value: String(s.highDemandNights),
                hint: "рынок от 85 %",
                testId: "market-tile-high"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                lineNumber: 328,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Stat"], {
                label: "Рыночные сигналы",
                value: String(signals),
                hint: "дат, стоящих внимания",
                testId: "market-tile-signals"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                lineNumber: 334,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
        lineNumber: 313,
        columnNumber: 5
    }, this);
}
/**
 * Рекомендация (ТЗ §7): первая подсказка домена акцентной карточкой, с основанием и честной строкой
 * «по каким данным». Уровня уверенности нет: подсказки считаются правилами по снимкам, не моделью.
 */ function Recommendation({ view, asOf }) {
    const first = view.board.insights[0];
    const s = view.board.summary;
    if (!first) return null;
    const t = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$market$2f$insight$2d$text$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["insightText"])(first);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["cx"])('market-reco', `market-reco--${t.tone}`),
        "aria-labelledby": "market-reco-title",
        "data-testid": "market-reco",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Badge"], {
                tone: "info",
                children: "Рекомендация по данным"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                lineNumber: 359,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                id: "market-reco-title",
                children: t.title
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                lineNumber: 360,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                children: t.text
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                lineNumber: 361,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "market-reco__basis",
                children: [
                    "По данным ",
                    s.competitorsWithData,
                    " из",
                    ' ',
                    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$plural$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["pluralRu"])(s.competitors, [
                        'конкурента',
                        'конкурентов',
                        'конкурентов'
                    ]),
                    ", снимок на",
                    ' ',
                    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$display$2d$date$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["displayDay"])(asOf),
                    ". Цены меняете только вы: автоматических изменений нет."
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                lineNumber: 362,
                columnNumber: 7
            }, this),
            first.kind !== 'missing' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                href: "/rooms/categories",
                className: "btn",
                "data-testid": "market-reco-rates",
                children: "Открыть тарифы"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                lineNumber: 368,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
        lineNumber: 354,
        columnNumber: 5
    }, this);
}
function Insights({ view }) {
    // первая подсказка показана карточкой рекомендации, здесь остальные
    const insights = view.board.insights.slice(1);
    if (!insights.length) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        className: "market-insights",
        "aria-labelledby": "market-insights-title",
        "data-testid": "market-insights",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SectionTitle"], {
                id: "market-insights-title",
                children: "Что это значит"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                lineNumber: 382,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                children: insights.map((i)=>{
                    const t = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$market$2f$insight$2d$text$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["insightText"])(i);
                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["cx"])('market-insight', `market-insight--${t.tone}`),
                        "data-kind": i.kind,
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                        children: t.title
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                                        lineNumber: 389,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        children: t.text
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                                        lineNumber: 390,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                                lineNumber: 388,
                                columnNumber: 15
                            }, this),
                            i.kind !== 'missing' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                                href: "/rooms/categories",
                                className: "market-insight__link",
                                children: [
                                    "Открыть цены",
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$icon$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Icon"], {
                                        name: "chevron"
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                                        lineNumber: 395,
                                        columnNumber: 19
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                                lineNumber: 393,
                                columnNumber: 17
                            }, this)
                        ]
                    }, `${i.kind}-${i.from}`, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                        lineNumber: 387,
                        columnNumber: 13
                    }, this);
                })
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                lineNumber: 383,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
        lineNumber: 381,
        columnNumber: 5
    }, this);
}
function Cell({ bp, delta, availability, hint }) {
    // снимок сборщика бывает только уровнем: показываем его словом, а не прочерком «нет данных»
    const byLevel = bp === null && availability ? AVAILABILITY[availability] : null;
    const level = byLevel ? byLevel.tone : (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$market$2f$occupancy$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["demandLevel"])(bp);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["cx"])('market-cell', level && `market-cell--${level}`),
        title: byLevel ? byLevel.word : level ? LEVEL_WORD[level] : 'нет данных',
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "market-cell__value",
                children: byLevel ? byLevel.word : pct(bp)
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                lineNumber: 425,
                columnNumber: 7
            }, this),
            hint && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "market-cell__delta",
                children: hint
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                lineNumber: 426,
                columnNumber: 16
            }, this),
            delta !== null && delta !== undefined && round(delta, 100) !== 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["cx"])('market-cell__delta', delta > 0 ? 'is-up' : 'is-down'),
                children: points(delta)
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                lineNumber: 428,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
        lineNumber: 421,
        columnNumber: 5
    }, this);
}
function Grid({ view, nightHref }) {
    const { board } = view;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        className: "market-grid",
        "aria-labelledby": "market-grid-title",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SectionTitle"], {
                id: "market-grid-title",
                children: "По ночам"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                lineNumber: 446,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Table"], {
                size: "sm",
                density: "normal",
                sticky: "column",
                className: "market-table",
                "aria-label": "Загрузка по ночам: вы и конкуренты",
                "data-testid": "market-table",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("thead", {
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                    scope: "col",
                                    className: "market-table__name",
                                    children: "Отель"
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                                    lineNumber: 450,
                                    columnNumber: 13
                                }, this),
                                board.dates.map((d)=>{
                                    const h = dayHead(d);
                                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                        scope: "col",
                                        className: "market-table__day",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                                            href: nightHref(d),
                                            scroll: false,
                                            "aria-label": `История ночи ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$display$2d$date$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["displayDate"])(d, 'numeric')}`,
                                            "data-testid": `market-night-${d}`,
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    children: h.wd
                                                }, void 0, false, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                                                    lineNumber: 463,
                                                    columnNumber: 21
                                                }, this),
                                                h.day
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                                            lineNumber: 457,
                                            columnNumber: 19
                                        }, this)
                                    }, d, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                                        lineNumber: 456,
                                        columnNumber: 17
                                    }, this);
                                })
                            ]
                        }, void 0, true, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                            lineNumber: 449,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                        lineNumber: 448,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("tbody", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                className: "market-row--own",
                                "data-testid": "market-row-own",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                        scope: "row",
                                        className: "market-table__name",
                                        children: [
                                            "Вы",
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "market-sub",
                                                children: "по календарю"
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                                                lineNumber: 475,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                                        lineNumber: 473,
                                        columnNumber: 13
                                    }, this),
                                    board.own.map((o)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(Cell, {
                                            bp: o.bp
                                        }, o.date, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                                            lineNumber: 478,
                                            columnNumber: 15
                                        }, this))
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                                lineNumber: 472,
                                columnNumber: 11
                            }, this),
                            board.competitors.map((c)=>{
                                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                    "data-testid": `market-row-${c.id}`,
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                            scope: "row",
                                            className: "market-table__name",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "market-name",
                                                    children: [
                                                        c.url ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                                            href: c.url,
                                                            target: "_blank",
                                                            rel: "noreferrer noopener",
                                                            children: c.name
                                                        }, void 0, false, {
                                                            fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                                                            lineNumber: 487,
                                                            columnNumber: 23
                                                        }, this) : c.name,
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Badge"], {
                                                            tone: tracking(c).tone,
                                                            "data-testid": `market-tracking-${c.id}`,
                                                            children: tracking(c).word
                                                        }, void 0, false, {
                                                            fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                                                            lineNumber: 493,
                                                            columnNumber: 21
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                                                    lineNumber: 485,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "market-sub",
                                                    children: [
                                                        c.distanceM !== null ? `${c.distanceM} м` : null,
                                                        c.lastObservedOn ? `данные от ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$display$2d$date$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["displayDay"])(c.lastObservedOn)}` : 'данных нет'
                                                    ].filter(Boolean).join(', ')
                                                }, void 0, false, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                                                    lineNumber: 497,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                                            lineNumber: 484,
                                            columnNumber: 17
                                        }, this),
                                        c.cells.map((cell)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(Cell, {
                                                bp: cell.bp,
                                                delta: cell.deltaBp,
                                                availability: cell.level
                                            }, cell.date, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                                                lineNumber: 507,
                                                columnNumber: 19
                                            }, this))
                                    ]
                                }, c.id, true, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                                    lineNumber: 483,
                                    columnNumber: 15
                                }, this);
                            })
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                        lineNumber: 471,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("tfoot", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                className: "market-row--market",
                                "data-testid": "market-row-market",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                        scope: "row",
                                        className: "market-table__name",
                                        children: "Средняя по рынку"
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                                        lineNumber: 515,
                                        columnNumber: 13
                                    }, this),
                                    board.market.map((m)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(Cell, {
                                            bp: m.bp,
                                            hint: m.withLevel ? `почти полны ${m.tight ?? 0} из ${m.withLevel}` : undefined
                                        }, m.date, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                                            lineNumber: 519,
                                            columnNumber: 15
                                        }, this))
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                                lineNumber: 514,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                className: "market-row--gap",
                                "data-testid": "market-row-gap",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                        scope: "row",
                                        className: "market-table__name",
                                        children: "Вы против рынка"
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                                        lineNumber: 527,
                                        columnNumber: 13
                                    }, this),
                                    board.gap.map((g)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                            className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["cx"])('market-gap', g.bp !== null && g.bp <= -1000 && 'is-behind', g.bp !== null && g.bp >= 1000 && 'is-ahead'),
                                            children: g.bp === null ? '–' : points(g.bp)
                                        }, g.date, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                                            lineNumber: 531,
                                            columnNumber: 15
                                        }, this))
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                                lineNumber: 526,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                        lineNumber: 513,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                lineNumber: 447,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                className: "market-legend",
                "aria-label": "Цвет клетки",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "market-swatch market-cell--high",
                                "aria-hidden": "true"
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                                lineNumber: 547,
                                columnNumber: 11
                            }, this),
                            "высокий спрос, от 85 %"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                        lineNumber: 546,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "market-swatch market-cell--mid",
                                "aria-hidden": "true"
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                                lineNumber: 551,
                                columnNumber: 11
                            }, this),
                            "средний"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                        lineNumber: 550,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "market-swatch market-cell--low",
                                "aria-hidden": "true"
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                                lineNumber: 555,
                                columnNumber: 11
                            }, this),
                            "слабый, до 50 %"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                        lineNumber: 554,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
                lineNumber: 545,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/market/page.tsx",
        lineNumber: 445,
        columnNumber: 5
    }, this);
}
}),
"[project]/wt-personnel/apps/web/src/app/market/page.tsx [app-rsc] (ecmascript, Next.js Server Component)", (function(__turbopack_context__){

__turbopack_context__.n(__turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/market/page.tsx [app-rsc] (ecmascript)"));
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
"[project]/wt-personnel/apps/web/src/lib/display-date.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "displayDate",
    ()=>displayDate,
    "displayDay",
    ()=>displayDay,
    "displayPeriod",
    ()=>displayPeriod
]);
const shortDate = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short'
});
/** §14: основной формат даты — 20.09.2026; «20 сент.» — только в таблицах и на плашках */ const numericDate = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'UTC',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
});
const fullDate = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'long',
    weekday: 'long',
    year: 'numeric'
});
function displayDate(value, style = 'short') {
    const date = new Date(`${value}T00:00:00Z`);
    if (!Number.isFinite(date.getTime())) return value;
    return (style === 'full' ? fullDate : style === 'numeric' ? numericDate : shortDate).format(date);
}
const dd = (value)=>value.slice(8, 10);
const mm = (value)=>value.slice(5, 7);
const yyyy = (value)=>value.slice(0, 4);
const ISO = /^\d{4}-\d{2}-\d{2}$/;
function displayDay(value) {
    return ISO.test(value) ? `${dd(value)}.${mm(value)}.${yyyy(value)}` : value;
}
function displayPeriod(from, to) {
    if (!ISO.test(from) || !ISO.test(to)) return `${from} → ${to}`;
    const sameYear = yyyy(from) === yyyy(to);
    return `${dd(from)}.${mm(from)}${sameYear ? '' : `.${yyyy(from)}`} → ${displayDay(to)}`;
}
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
"[project]/wt-personnel/apps/web/src/lib/plural.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
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

//# sourceMappingURL=wt-personnel_apps_web_src_1ct18wv._.js.map