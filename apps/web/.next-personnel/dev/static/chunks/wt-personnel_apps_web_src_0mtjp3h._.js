(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/wt-personnel/apps/web/src/app/finance/owner-controls.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DashboardDetails",
    ()=>DashboardDetails,
    "DashboardRefresh",
    ()=>DashboardRefresh,
    "ForecastDetails",
    ()=>ForecastDetails
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$icon$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/icon.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$overlay$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/overlay.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature(), _s2 = __turbopack_context__.k.signature();
'use client';
;
;
;
;
function DashboardRefresh({ label }) {
    _s();
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"])();
    const [pending, startTransition] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTransition"])();
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
        className: label ? 'btn btn--secondary' : 'owner-refresh icon-button',
        "aria-label": pending ? 'Обновляем данные' : label ?? 'Обновить данные',
        "aria-busy": pending,
        title: "Обновить данные",
        disabled: pending,
        onClick: ()=>startTransition(()=>router.refresh()),
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$icon$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Icon"], {
                name: "refresh"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/finance/owner-controls.tsx",
                lineNumber: 18,
                columnNumber: 7
            }, this),
            label && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                children: pending ? 'Обновляем…' : label
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/finance/owner-controls.tsx",
                lineNumber: 19,
                columnNumber: 17
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/finance/owner-controls.tsx",
        lineNumber: 10,
        columnNumber: 5
    }, this);
}
_s(DashboardRefresh, "bS6iYTA6A+xoIWTYyEHZ+6tNDOQ=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"],
        __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTransition"]
    ];
});
_c = DashboardRefresh;
function DashboardDetails({ title, label, children, count }) {
    _s1();
    const [open, setOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                className: "owner-attention-button",
                "aria-label": label ?? title,
                onClick: ()=>setOpen(true),
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        children: label ?? title
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/finance/owner-controls.tsx",
                        lineNumber: 43,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("b", {
                        "data-testid": "owner-attention-count",
                        "data-empty": count === 0,
                        children: count
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/finance/owner-controls.tsx",
                        lineNumber: 44,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$icon$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Icon"], {
                        name: "chevron",
                        width: 18,
                        height: 18
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/finance/owner-controls.tsx",
                        lineNumber: 47,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/finance/owner-controls.tsx",
                lineNumber: 38,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$overlay$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Overlay"], {
                open: open,
                onClose: ()=>setOpen(false),
                title: title,
                drawer: true,
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "owner-details",
                    children: children
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/finance/owner-controls.tsx",
                    lineNumber: 50,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/finance/owner-controls.tsx",
                lineNumber: 49,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/finance/owner-controls.tsx",
        lineNumber: 37,
        columnNumber: 5
    }, this);
}
_s1(DashboardDetails, "xG1TONbKtDWtdOTrXaTAsNhPg/Q=");
_c1 = DashboardDetails;
function ForecastDetails({ children }) {
    _s2();
    const [open, setOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                type: "button",
                className: "owner-outlook-open",
                "aria-label": "Загрузка по дням",
                "aria-haspopup": "dialog",
                "aria-expanded": open,
                onClick: ()=>setOpen(true),
                children: [
                    "По дням ",
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$icon$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Icon"], {
                        name: "chevron",
                        width: 14,
                        height: 14
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/finance/owner-controls.tsx",
                        lineNumber: 68,
                        columnNumber: 17
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/finance/owner-controls.tsx",
                lineNumber: 60,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$overlay$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Overlay"], {
                open: open,
                onClose: ()=>setOpen(false),
                title: "Ближайшие 7 дней",
                drawer: true,
                className: "owner-forecast-dialog",
                children: children
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/finance/owner-controls.tsx",
                lineNumber: 70,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/finance/owner-controls.tsx",
        lineNumber: 59,
        columnNumber: 5
    }, this);
}
_s2(ForecastDetails, "xG1TONbKtDWtdOTrXaTAsNhPg/Q=");
_c2 = ForecastDetails;
var _c, _c1, _c2;
__turbopack_context__.k.register(_c, "DashboardRefresh");
__turbopack_context__.k.register(_c1, "DashboardDetails");
__turbopack_context__.k.register(_c2, "ForecastDetails");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/app/today/owner-daily-chart.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "OwnerDailyChart",
    ()=>OwnerDailyChart
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$line$2d$geometry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/line-geometry.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$owner$2d$summary$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/owner-summary.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
function OwnerDailyChart({ metrics }) {
    _s();
    const id = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useId"])();
    const [selected, setSelected] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(0);
    const [chosenCurrency, setCurrency] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    const plot = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const [plotWidth, setPlotWidth] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(800);
    const metric = metrics[selected];
    const daily = metric?.daily;
    const previous = metric?.previous;
    const currencies = [
        ...new Set([
            daily,
            previous
        ].flatMap((d)=>d?.state !== 'UNAVAILABLE' ? d?.currencies?.map((c)=>c.currency) ?? [] : []))
    ].sort();
    const currency = currencies.includes(chosenCurrency) ? chosenCurrency : currencies[0];
    const currentDays = daily?.state !== 'UNAVAILABLE' ? daily?.days ?? [] : [];
    const previousDays = previous?.state !== 'UNAVAILABLE' ? previous?.days ?? [] : [];
    const count = Math.max(currentDays.length, previousDays.length);
    const rows = Array.from({
        length: count
    }, (_, i)=>[
            currentDays[i],
            previousDays[i]
        ]);
    const values = [
        currentDays,
        previousDays
    ].map((days)=>Array.from({
            length: count
        }, (_, i)=>{
            const day = days[i];
            const amount = day?.currencies.find((c)=>c.currency === currency)?.amountMinor;
            return !day || day.unresolvedSources !== 0 || amount === undefined ? null : BigInt(amount);
        }));
    const known = values.flat().filter((n)=>n !== null);
    const minimum = known.reduce((a, b)=>a < b ? a : b, 0n);
    const maximum = known.reduce((a, b)=>a > b ? a : b, 0n);
    const range = maximum - minimum || 1n;
    // Only bounded drawing coordinates become Number. Exact monetary amounts remain BigInt/string.
    const geometry = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$line$2d$geometry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["lineGeometry"])(values.map((series)=>series.map((n)=>n === null ? null : Number((n - minimum) * 10000n / range) / 100)), {
        width: plotWidth,
        height: 230,
        pad: {
            left: 100,
            right: 18,
            top: 14,
            bottom: 32
        }
    });
    const hasPrevious = values[1].some((n)=>n !== null);
    const hasPoints = known.length > 0 && currency !== undefined;
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "OwnerDailyChart.useEffect": ()=>{
            const element = plot.current;
            if (!element) return;
            const observer = new ResizeObserver({
                "OwnerDailyChart.useEffect": ([entry])=>{
                    if (entry && entry.contentRect.width > 0) setPlotWidth(Math.max(240, Math.round(entry.contentRect.width)));
                }
            }["OwnerDailyChart.useEffect"]);
            observer.observe(element);
            return ({
                "OwnerDailyChart.useEffect": ()=>observer.disconnect()
            })["OwnerDailyChart.useEffect"];
        }
    }["OwnerDailyChart.useEffect"], [
        hasPoints
    ]);
    const axisLabel = (value)=>{
        const digits = new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: currency
        }).resolvedOptions().maximumFractionDigits ?? 2;
        const scale = 10n ** BigInt(digits), absolute = value < 0n ? -value : value;
        if (absolute < 1000n * scale) return (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$owner$2d$summary$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatOwnerMoney"])(value.toString(), currency).replace(` ${currency}`, '');
        const major = value / scale;
        const compact = new Intl.NumberFormat('ru-RU', {
            notation: 'compact',
            maximumFractionDigits: 1
        }).format(major);
        return compact.length <= 12 ? compact : new Intl.NumberFormat('ru-RU', {
            notation: 'scientific',
            maximumFractionDigits: 1
        }).format(major);
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "owner-chart",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "owner-chart-toolbar",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "owner-chart-tabs",
                        role: "tablist",
                        "aria-label": "Данные графика",
                        children: metrics.map((m, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                type: "button",
                                role: "tab",
                                id: `${id}-tab-${index}`,
                                "aria-controls": `${id}-panel`,
                                "aria-selected": selected === index,
                                tabIndex: selected === index ? 0 : -1,
                                onClick: ()=>setSelected(index),
                                onKeyDown: (event)=>{
                                    const next = event.key === 'ArrowRight' ? (index + 1) % metrics.length : event.key === 'ArrowLeft' ? (index + metrics.length - 1) % metrics.length : event.key === 'Home' ? 0 : event.key === 'End' ? metrics.length - 1 : null;
                                    if (next !== null) {
                                        event.preventDefault();
                                        setSelected(next);
                                        document.getElementById(`${id}-tab-${next}`)?.focus();
                                    }
                                },
                                children: m.label
                            }, m.label, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/today/owner-daily-chart.tsx",
                                lineNumber: 60,
                                columnNumber: 36
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/today/owner-daily-chart.tsx",
                        lineNumber: 59,
                        columnNumber: 7
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "owner-chart-legend",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: "Текущий период"
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/today/owner-daily-chart.tsx",
                                lineNumber: 66,
                                columnNumber: 43
                            }, this),
                            hasPrevious && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "owner-chart-previous",
                                children: "Предыдущий"
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/today/owner-daily-chart.tsx",
                                lineNumber: 66,
                                columnNumber: 86
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/today/owner-daily-chart.tsx",
                        lineNumber: 66,
                        columnNumber: 7
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/today/owner-daily-chart.tsx",
                lineNumber: 58,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                role: "tabpanel",
                id: `${id}-panel`,
                "aria-labelledby": `${id}-tab-${selected}`,
                tabIndex: 0,
                children: [
                    currencies.length > 1 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                        className: "owner-chart-currency",
                        children: [
                            "Валюта: ",
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                value: currency,
                                onChange: (event)=>setCurrency(event.target.value),
                                children: currencies.map((c)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                        children: c
                                    }, c, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/today/owner-daily-chart.tsx",
                                        lineNumber: 69,
                                        columnNumber: 179
                                    }, this))
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/today/owner-daily-chart.tsx",
                                lineNumber: 69,
                                columnNumber: 81
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/today/owner-daily-chart.tsx",
                        lineNumber: 69,
                        columnNumber: 33
                    }, this),
                    daily?.state !== 'READY' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        role: "status",
                        children: [
                            metric?.label,
                            ": ",
                            daily ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$owner$2d$summary$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ownerReason"])(daily.reason) || 'Данные периода неполные' : 'Временной ряд не подключён',
                            daily?.unresolvedSources ? ` Не определена валюта операций: ${daily.unresolvedSources}.` : ''
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/today/owner-daily-chart.tsx",
                        lineNumber: 70,
                        columnNumber: 36
                    }, this),
                    previous?.state === 'PARTIAL' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        role: "status",
                        children: "Предыдущий период: данные неполные"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/today/owner-daily-chart.tsx",
                        lineNumber: 71,
                        columnNumber: 41
                    }, this),
                    hasPoints ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                                ref: plot,
                                className: "owner-chart-plot",
                                viewBox: `0 0 ${plotWidth} 230`,
                                width: "100%",
                                role: "img",
                                "aria-label": `${metric?.label} по дням, ${currency}`,
                                children: [
                                    [
                                        0,
                                        1,
                                        2,
                                        3,
                                        4
                                    ].map((tick)=>{
                                        const y = 198 - tick * 46;
                                        const amount = minimum + range * BigInt(tick) / 4n;
                                        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("g", {
                                            className: "owner-chart-grid",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("line", {
                                                    x1: "100",
                                                    x2: plotWidth - 18,
                                                    y1: y,
                                                    y2: y
                                                }, void 0, false, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/app/today/owner-daily-chart.tsx",
                                                    lineNumber: 77,
                                                    columnNumber: 63
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("text", {
                                                    x: "90",
                                                    y: y + 4,
                                                    textAnchor: "end",
                                                    children: [
                                                        axisLabel(amount),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("title", {
                                                            children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$owner$2d$summary$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatOwnerMoney"])(amount.toString(), currency)
                                                        }, void 0, false, {
                                                            fileName: "[project]/wt-personnel/apps/web/src/app/today/owner-daily-chart.tsx",
                                                            lineNumber: 77,
                                                            columnNumber: 173
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/app/today/owner-daily-chart.tsx",
                                                    lineNumber: 77,
                                                    columnNumber: 114
                                                }, this)
                                            ]
                                        }, tick, true, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/today/owner-daily-chart.tsx",
                                            lineNumber: 77,
                                            columnNumber: 20
                                        }, this);
                                    }),
                                    geometry.series.map((series, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("g", {
                                            "data-series": index ? 'previous' : 'current',
                                            fill: "none",
                                            stroke: index ? 'var(--muted)' : 'var(--primary)',
                                            strokeWidth: "2",
                                            strokeDasharray: index ? '5 5' : undefined,
                                            children: [
                                                series.segments.map((d)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                                                        d: d
                                                    }, d, false, {
                                                        fileName: "[project]/wt-personnel/apps/web/src/app/today/owner-daily-chart.tsx",
                                                        lineNumber: 80,
                                                        columnNumber: 39
                                                    }, this)),
                                                series.dots.map((point)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("circle", {
                                                        cx: point.x,
                                                        cy: point.y,
                                                        r: "3",
                                                        fill: "var(--surface)",
                                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("title", {
                                                            children: `${rows[point.index]?.[index]?.date}: ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$owner$2d$summary$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatOwnerMoney"])(values[index][point.index].toString(), currency)}`
                                                        }, void 0, false, {
                                                            fileName: "[project]/wt-personnel/apps/web/src/app/today/owner-daily-chart.tsx",
                                                            lineNumber: 81,
                                                            columnNumber: 119
                                                        }, this)
                                                    }, point.index, false, {
                                                        fileName: "[project]/wt-personnel/apps/web/src/app/today/owner-daily-chart.tsx",
                                                        lineNumber: 81,
                                                        columnNumber: 39
                                                    }, this))
                                            ]
                                        }, index, true, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/today/owner-daily-chart.tsx",
                                            lineNumber: 79,
                                            columnNumber: 51
                                        }, this)),
                                    rows.map((row, i)=>(i === 0 || i === count - 1 || i === Math.floor((count - 1) / 2)) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("text", {
                                            className: "owner-chart-date",
                                            x: geometry.xs[i],
                                            y: "224",
                                            textAnchor: i === 0 ? 'start' : i === count - 1 ? 'end' : 'middle',
                                            children: [
                                                (row[0] ?? row[1])?.date.slice(5).split('-').reverse().join('.'),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("title", {
                                                    children: (row[0] ?? row[1])?.date
                                                }, void 0, false, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/app/today/owner-daily-chart.tsx",
                                                    lineNumber: 83,
                                                    columnNumber: 306
                                                }, this)
                                            ]
                                        }, i, true, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/today/owner-daily-chart.tsx",
                                            lineNumber: 83,
                                            columnNumber: 102
                                        }, this))
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/today/owner-daily-chart.tsx",
                                lineNumber: 73,
                                columnNumber: 9
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("details", {
                                className: "owner-chart-table",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("summary", {
                                        children: [
                                            "Точные дневные суммы, ",
                                            currency
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/today/owner-daily-chart.tsx",
                                        lineNumber: 85,
                                        columnNumber: 48
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("table", {
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("caption", {
                                                children: [
                                                    metric?.label,
                                                    ", ",
                                                    currency,
                                                    ". Дни периодов сопоставлены по порядку."
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/today/owner-daily-chart.tsx",
                                                lineNumber: 86,
                                                columnNumber: 18
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("thead", {
                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                            scope: "col",
                                                            children: "Дата"
                                                        }, void 0, false, {
                                                            fileName: "[project]/wt-personnel/apps/web/src/app/today/owner-daily-chart.tsx",
                                                            lineNumber: 86,
                                                            columnNumber: 114
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                            scope: "col",
                                                            children: "Текущий период"
                                                        }, void 0, false, {
                                                            fileName: "[project]/wt-personnel/apps/web/src/app/today/owner-daily-chart.tsx",
                                                            lineNumber: 86,
                                                            columnNumber: 139
                                                        }, this),
                                                        hasPrevious && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                                    scope: "col",
                                                                    children: "Дата сравнения"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/wt-personnel/apps/web/src/app/today/owner-daily-chart.tsx",
                                                                    lineNumber: 86,
                                                                    columnNumber: 192
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                                    scope: "col",
                                                                    children: "Предыдущий период"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/wt-personnel/apps/web/src/app/today/owner-daily-chart.tsx",
                                                                    lineNumber: 86,
                                                                    columnNumber: 227
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/wt-personnel/apps/web/src/app/today/owner-daily-chart.tsx",
                                                            lineNumber: 86,
                                                            columnNumber: 190
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/app/today/owner-daily-chart.tsx",
                                                    lineNumber: 86,
                                                    columnNumber: 110
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/today/owner-daily-chart.tsx",
                                                lineNumber: 86,
                                                columnNumber: 103
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tbody", {
                                                children: rows.map((row, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                                scope: "row",
                                                                children: row[0]?.date ?? 'Нет данных'
                                                            }, void 0, false, {
                                                                fileName: "[project]/wt-personnel/apps/web/src/app/today/owner-daily-chart.tsx",
                                                                lineNumber: 87,
                                                                columnNumber: 47
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                children: row[0] && row[0].unresolvedSources !== 0 ? 'Данные неполные' : values[0][i] === null ? 'Нет данных' : (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$owner$2d$summary$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatOwnerMoney"])(values[0][i].toString(), currency)
                                                            }, void 0, false, {
                                                                fileName: "[project]/wt-personnel/apps/web/src/app/today/owner-daily-chart.tsx",
                                                                lineNumber: 87,
                                                                columnNumber: 98
                                                            }, this),
                                                            hasPrevious && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                                                                children: [
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                        children: row[1]?.date ?? 'Нет данных'
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/wt-personnel/apps/web/src/app/today/owner-daily-chart.tsx",
                                                                        lineNumber: 87,
                                                                        columnNumber: 283
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                        children: row[1] && row[1].unresolvedSources !== 0 ? 'Данные неполные' : values[1][i] === null ? 'Нет данных' : (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$owner$2d$summary$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatOwnerMoney"])(values[1][i].toString(), currency)
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/wt-personnel/apps/web/src/app/today/owner-daily-chart.tsx",
                                                                        lineNumber: 87,
                                                                        columnNumber: 322
                                                                    }, this)
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/wt-personnel/apps/web/src/app/today/owner-daily-chart.tsx",
                                                                lineNumber: 87,
                                                                columnNumber: 281
                                                            }, this)
                                                        ]
                                                    }, i, true, {
                                                        fileName: "[project]/wt-personnel/apps/web/src/app/today/owner-daily-chart.tsx",
                                                        lineNumber: 87,
                                                        columnNumber: 35
                                                    }, this))
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/today/owner-daily-chart.tsx",
                                                lineNumber: 86,
                                                columnNumber: 282
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/today/owner-daily-chart.tsx",
                                        lineNumber: 86,
                                        columnNumber: 11
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/today/owner-daily-chart.tsx",
                                lineNumber: 85,
                                columnNumber: 9
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/today/owner-daily-chart.tsx",
                        lineNumber: 72,
                        columnNumber: 20
                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "owner-chart-empty",
                        role: "status",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                children: "Нет данных для графика"
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/today/owner-daily-chart.tsx",
                                lineNumber: 90,
                                columnNumber: 62
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                children: "Нет операций с подтверждённой валютой за период. Недоступные источники не означают ноль."
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/today/owner-daily-chart.tsx",
                                lineNumber: 90,
                                columnNumber: 101
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/today/owner-daily-chart.tsx",
                        lineNumber: 90,
                        columnNumber: 13
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "owner-chart-foot",
                        children: [
                            "По дням в часовом поясе филиала, текущий день неполный",
                            !hasPrevious && ', сравнение недоступно'
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/today/owner-daily-chart.tsx",
                        lineNumber: 91,
                        columnNumber: 7
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/today/owner-daily-chart.tsx",
                lineNumber: 68,
                columnNumber: 5
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/today/owner-daily-chart.tsx",
        lineNumber: 57,
        columnNumber: 10
    }, this);
}
_s(OwnerDailyChart, "qEtW4C/Y8+6qf6N4GCjoNz+kky4=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useId"]
    ];
});
_c = OwnerDailyChart;
var _c;
__turbopack_context__.k.register(_c, "OwnerDailyChart");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/app/today/scope-content.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "TodayScopeContent",
    ()=>TodayScopeContent
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
function TodayScopeContent({ children }) {
    _s();
    const [switching, setSwitching] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "TodayScopeContent.useEffect": ()=>{
            const begin = {
                "TodayScopeContent.useEffect.begin": ()=>setSwitching(true)
            }["TodayScopeContent.useEffect.begin"];
            const failed = {
                "TodayScopeContent.useEffect.failed": ()=>setSwitching(false)
            }["TodayScopeContent.useEffect.failed"];
            window.addEventListener('wetop-scope-switch', begin);
            window.addEventListener('wetop-scope-switch-failed', failed);
            return ({
                "TodayScopeContent.useEffect": ()=>{
                    window.removeEventListener('wetop-scope-switch', begin);
                    window.removeEventListener('wetop-scope-switch-failed', failed);
                }
            })["TodayScopeContent.useEffect"];
        }
    }["TodayScopeContent.useEffect"], []);
    return switching ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
        id: "main-content",
        tabIndex: -1,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                children: "Сегодня"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/today/scope-content.tsx",
                lineNumber: 19,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                role: "status",
                children: "Переключаем филиал…"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/today/scope-content.tsx",
                lineNumber: 20,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/today/scope-content.tsx",
        lineNumber: 18,
        columnNumber: 5
    }, this) : children;
}
_s(TodayScopeContent, "kHHoYuAHA26wzsxqhWmuJHbLl3E=");
_c = TodayScopeContent;
var _c;
__turbopack_context__.k.register(_c, "TodayScopeContent");
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
"[project]/wt-personnel/apps/web/src/lib/line-geometry.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Геометрия линейного графика (RPT2.2c-3, DESIGN.md §8.2 `LineChart`). Только координаты на экране: деньги сюда
 * приходят уже в целых единицах для рисования, расчёты ADR и RevPAR делает домен. Пропуск (`null`) рвёт линию.
 */ __turbopack_context__.s([
    "lineGeometry",
    ()=>lineGeometry
]);
const DEFAULT_PAD = {
    top: 8,
    right: 8,
    bottom: 8,
    left: 8
};
/** Верх шкалы: 1, 2, 2.5, 5 или 10 от степени десяти, не меньше максимума; нулевой максимум даёт 1 */ function niceMax(v) {
    if (v <= 0) return 1;
    const pow = 10 ** Math.floor(Math.log10(v));
    for (const m of [
        1,
        2,
        2.5,
        5,
        10
    ])if (m * pow >= v) return m * pow;
    return 10 * pow;
}
function lineGeometry(data, box) {
    const pad = box.pad ?? DEFAULT_PAD;
    const count = data.reduce((n, d)=>Math.max(n, d.length), 0);
    const all = data.flat().filter((v)=>v !== null);
    const max = all.length === 0 ? 0 : niceMax(Math.max(...all));
    const scale = max || 1;
    const w = box.width - pad.left - pad.right;
    const h = box.height - pad.top - pad.bottom;
    const x = (i)=>count <= 1 ? pad.left + w / 2 : pad.left + w * i / (count - 1);
    const y = (v)=>pad.top + h - h * v / scale;
    const f = (n)=>String(Math.round(n * 100) / 100);
    const series = data.map((values)=>{
        const segments = [];
        const dots = [];
        let cur = [];
        const flush = ()=>{
            if (cur.length > 1) segments.push(cur.join(' '));
            cur = [];
        };
        values.forEach((v, i)=>{
            if (v === null) {
                flush();
                return;
            }
            dots.push({
                x: x(i),
                y: y(v),
                index: i
            });
            cur.push(`${cur.length === 0 ? 'M' : 'L'}${f(x(i))},${f(y(v))}`);
        });
        flush();
        return {
            segments,
            dots
        };
    });
    const ticks = max === 0 ? [] : [
        0,
        1,
        2,
        3,
        4
    ].map((k)=>max * k / 4);
    return {
        max,
        ticks,
        series,
        xs: Array.from({
            length: count
        }, (_, i)=>x(i))
    };
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/lib/owner-summary.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "formatOwnerMoney",
    ()=>formatOwnerMoney,
    "ownerPeriod",
    ()=>ownerPeriod,
    "ownerReason",
    ()=>ownerReason,
    "ownerSummaryEnabled",
    ()=>ownerSummaryEnabled
]);
function ownerPeriod(value) {
    return value === 'week' || value === 'month' ? value : 'today';
}
function formatOwnerMoney(minor, currency) {
    const digits = new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency
    }).resolvedOptions().maximumFractionDigits ?? 2;
    const amount = BigInt(minor), absolute = amount < 0n ? -amount : amount, scale = 10n ** BigInt(digits);
    return `${amount < 0n ? '-' : ''}${new Intl.NumberFormat('ru-RU').format(absolute / scale)}${digits ? ',' + (absolute % scale).toString().padStart(digits, '0') : ''} ${currency}`;
}
const ownerSummaryEnabled = (value)=>value === 'true';
function ownerReason(reason) {
    const words = {
        UNKNOWN_SOURCE_CURRENCY: 'Валюта части операций неизвестна. Показана только известная часть.',
        PAYMENT_LEDGER_NOT_AVAILABLE: 'Реестр оплат не подключён',
        NO_MONEY_DATA: 'Нет денежных операций за выбранный период',
        COMPARABLE_PROJECTION_NOT_CONNECTED: 'Нет сопоставимых данных',
        PREVIOUS_PERIOD_UNAVAILABLE: 'Нет данных за предыдущий период',
        PREVIOUS_AMOUNT_ZERO: 'Предыдущая сумма равна нулю',
        EXPENSE_DOCUMENT_LINKS_NOT_CONNECTED: 'Статьи расходов не подключены',
        UNCLASSIFIED_EXPENSE_SOURCES: 'Часть расходов без статьи',
        INCOMPLETE_PERIOD_COVERAGE: 'Неполное покрытие периода',
        CAPTURE_DISABLED: 'Сбор истории загрузки отключён',
        CAPTURE_DISABLED_OR_NO_PROPERTY: 'Сбор истории отключён или объект не связан',
        HISTORY_NOT_CAPTURED: 'История не накоплена',
        OBSERVED_SOURCE_NOT_COMPLETE_HISTORY: 'Наблюдения не подтверждают полную историю периода',
        NO_SCHEDULE: 'Нет сохранённого расписания',
        NO_AVAILABLE_CAPACITY_OR_SCHEDULE: 'Нет доступной мощности или расписания',
        UNSUPPORTED_SOURCE: 'Источник не поддерживается',
        UNSUPPORTED_VERTICAL: 'Направление не поддерживается'
    };
    return reason ? words[reason] ?? `Данные недоступны: ${reason}` : '';
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=wt-personnel_apps_web_src_0mtjp3h._.js.map