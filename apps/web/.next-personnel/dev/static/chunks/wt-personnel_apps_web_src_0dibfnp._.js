(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/wt-personnel/apps/web/src/app/market/chart.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "OccupancyChart",
    ()=>OccupancyChart
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/index.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$market$2f$occupancy$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/market/occupancy.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$plural$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/plural.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
const pct = (bp)=>bp === null ? 'нет данных' : (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$market$2f$occupancy$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatOccupancy"])(Math.round(bp / 100) * 100);
function OccupancyChart({ points }) {
    _s();
    const [hover, setHover] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const W = 720;
    const H = 220;
    const padL = 40;
    const padR = 12;
    const padT = 12;
    const padB = 24;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const n = Math.max(points.length, 1);
    const band = plotW / n;
    const x = (i)=>padL + i * band + band / 2;
    const y = (bp)=>padT + plotH - bp / 10000 * plotH;
    const ticks = [
        0,
        2500,
        5000,
        7500,
        10000
    ];
    const labelEvery = n > 20 ? 5 : n > 10 ? 2 : 1;
    const h = hover !== null ? points[hover] : null;
    const path = (key)=>{
        const parts = [];
        let open = false;
        points.forEach((p, i)=>{
            const v = p[key];
            if (v === null) {
                open = false;
                return;
            }
            parts.push(`${open ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`);
            open = true;
        });
        return parts.join(' ');
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "chart market-trend",
        "data-testid": "market-chart",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                viewBox: `0 0 ${W} ${H}`,
                width: "100%",
                role: "img",
                "aria-label": "Сравнение загрузки: вы и средняя по рынку, по ночам",
                className: "chart__svg",
                onPointerLeave: ()=>setHover(null),
                children: [
                    ticks.map((t)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("g", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("line", {
                                    x1: padL,
                                    x2: W - padR,
                                    y1: y(t),
                                    y2: y(t),
                                    stroke: "var(--grid-line)",
                                    strokeWidth: 1
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/market/chart.tsx",
                                    lineNumber: 67,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("text", {
                                    x: padL - 6,
                                    y: y(t) + 4,
                                    textAnchor: "end",
                                    fontSize: 13,
                                    fill: "var(--muted-2)",
                                    children: [
                                        t / 100,
                                        "%"
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/market/chart.tsx",
                                    lineNumber: 68,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, t, true, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/market/chart.tsx",
                            lineNumber: 66,
                            columnNumber: 11
                        }, this)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                        d: path('marketBp'),
                        fill: "none",
                        stroke: "var(--chart-2)",
                        strokeWidth: 2,
                        strokeLinejoin: "round"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/chart.tsx",
                        lineNumber: 73,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                        d: path('ownBp'),
                        fill: "none",
                        stroke: "var(--chart-1)",
                        strokeWidth: 2.5,
                        strokeLinejoin: "round"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/chart.tsx",
                        lineNumber: 74,
                        columnNumber: 9
                    }, this),
                    points.map((p, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("g", {
                            children: [
                                i % labelEvery === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("text", {
                                    x: x(i),
                                    y: H - 6,
                                    textAnchor: "middle",
                                    fontSize: 13,
                                    fill: "var(--muted-2)",
                                    children: Number(p.date.slice(8, 10))
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/market/chart.tsx",
                                    lineNumber: 78,
                                    columnNumber: 15
                                }, this),
                                hover === i && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("line", {
                                    x1: x(i),
                                    x2: x(i),
                                    y1: padT,
                                    y2: padT + plotH,
                                    stroke: "var(--axis-line)",
                                    strokeWidth: 1
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/market/chart.tsx",
                                    lineNumber: 83,
                                    columnNumber: 15
                                }, this),
                                p.ownBp !== null && hover === i && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("circle", {
                                    cx: x(i),
                                    cy: y(p.ownBp),
                                    r: 4,
                                    fill: "var(--chart-1)"
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/market/chart.tsx",
                                    lineNumber: 85,
                                    columnNumber: 49
                                }, this),
                                p.marketBp !== null && hover === i && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("circle", {
                                    cx: x(i),
                                    cy: y(p.marketBp),
                                    r: 4,
                                    fill: "var(--chart-2)"
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/market/chart.tsx",
                                    lineNumber: 87,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("rect", {
                                    x: padL + i * band,
                                    y: padT,
                                    width: band,
                                    height: plotH,
                                    fill: "transparent",
                                    onPointerMove: ()=>setHover(i),
                                    onFocus: ()=>setHover(i),
                                    tabIndex: -1
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/market/chart.tsx",
                                    lineNumber: 89,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, p.date, true, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/market/chart.tsx",
                            lineNumber: 76,
                            columnNumber: 11
                        }, this))
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/chart.tsx",
                lineNumber: 57,
                columnNumber: 7
            }, this),
            h && hover !== null && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                role: "status",
                className: "chart__tip",
                style: {
                    left: `${(padL + hover * band + band / 2) / W * 100}%`,
                    transform: hover > n / 2 ? 'translateX(-100%)' : 'none'
                },
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "chart__tip-date",
                        children: h.label
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/chart.tsx",
                        lineNumber: 111,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "chart__tip-row",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("b", {
                                children: pct(h.ownBp)
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/chart.tsx",
                                lineNumber: 113,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: "вы"
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/chart.tsx",
                                lineNumber: 114,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/chart.tsx",
                        lineNumber: 112,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "chart__tip-row",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("b", {
                                children: pct(h.marketBp)
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/chart.tsx",
                                lineNumber: 117,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: [
                                    "рынок",
                                    h.count > 0 ? `, по ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$plural$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["pluralRu"])(h.count, [
                                        'конкуренту',
                                        'конкурентам',
                                        'конкурентам'
                                    ])}` : ''
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/chart.tsx",
                                lineNumber: 118,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/chart.tsx",
                        lineNumber: 116,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/chart.tsx",
                lineNumber: 103,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                className: "market-trend__legend",
                "aria-hidden": "true",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "market-trend__swatch market-trend__swatch--own"
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/chart.tsx",
                                lineNumber: 126,
                                columnNumber: 11
                            }, this),
                            "Вы"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/chart.tsx",
                        lineNumber: 125,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "market-trend__swatch market-trend__swatch--market"
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/chart.tsx",
                                lineNumber: 130,
                                columnNumber: 11
                            }, this),
                            "Средняя по рынку"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/chart.tsx",
                        lineNumber: 129,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/chart.tsx",
                lineNumber: 124,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("details", {
                className: "market-trend__data",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("summary", {
                        children: "Значения по ночам"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/chart.tsx",
                        lineNumber: 135,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("table", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("thead", {
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                            scope: "col",
                                            children: "Ночь"
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/market/chart.tsx",
                                            lineNumber: 139,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                            scope: "col",
                                            children: "Вы"
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/market/chart.tsx",
                                            lineNumber: 140,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                            scope: "col",
                                            children: "Рынок"
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/market/chart.tsx",
                                            lineNumber: 141,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                            scope: "col",
                                            children: "Конкурентов с данными"
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/market/chart.tsx",
                                            lineNumber: 142,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/market/chart.tsx",
                                    lineNumber: 138,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/chart.tsx",
                                lineNumber: 137,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tbody", {
                                children: points.map((p)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                scope: "row",
                                                children: p.label
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/market/chart.tsx",
                                                lineNumber: 148,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                children: pct(p.ownBp)
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/market/chart.tsx",
                                                lineNumber: 149,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                children: pct(p.marketBp)
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/market/chart.tsx",
                                                lineNumber: 150,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                children: p.count
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/market/chart.tsx",
                                                lineNumber: 151,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, p.date, true, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/market/chart.tsx",
                                        lineNumber: 147,
                                        columnNumber: 15
                                    }, this))
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/chart.tsx",
                                lineNumber: 145,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/chart.tsx",
                        lineNumber: 136,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/chart.tsx",
                lineNumber: 134,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/market/chart.tsx",
        lineNumber: 56,
        columnNumber: 5
    }, this);
}
_s(OccupancyChart, "FYwme2kD2kORRPD1Jfhz4luF6Fk=");
_c = OccupancyChart;
var _c;
__turbopack_context__.k.register(_c, "OccupancyChart");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/app/market/data:0efb58 [app-client] (ecmascript) <text/javascript>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "archiveCompetitorAction",
    ()=>$$RSC_SERVER_ACTION_1
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-client-wrapper.js [app-client] (ecmascript)");
/* __next_internal_action_entry_do_not_use__ [{"602b0c068f1caf82524ed5c61cc453983199896c18":{"name":"archiveCompetitorAction"}},"wt-personnel/apps/web/src/app/market/actions.ts",""] */ "use turbopack no side effects";
;
const $$RSC_SERVER_ACTION_1 = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createServerReference"])("602b0c068f1caf82524ed5c61cc453983199896c18", __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["callServer"], void 0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["findSourceMapURL"], "archiveCompetitorAction");
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/app/market/data:64dc3b [app-client] (ecmascript) <text/javascript>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "saveCompetitorAction",
    ()=>$$RSC_SERVER_ACTION_0
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-client-wrapper.js [app-client] (ecmascript)");
/* __next_internal_action_entry_do_not_use__ [{"60f465ba97e106e185b83c63ea2014ca634c0399d3":{"name":"saveCompetitorAction"}},"wt-personnel/apps/web/src/app/market/actions.ts",""] */ "use turbopack no side effects";
;
const $$RSC_SERVER_ACTION_0 = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createServerReference"])("60f465ba97e106e185b83c63ea2014ca634c0399d3", __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["callServer"], void 0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["findSourceMapURL"], "saveCompetitorAction");
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/app/market/data:8ea8c4 [app-client] (ecmascript) <text/javascript>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "writeOccupancyAction",
    ()=>$$RSC_SERVER_ACTION_2
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-client-wrapper.js [app-client] (ecmascript)");
/* __next_internal_action_entry_do_not_use__ [{"600e8568a97eb83881f6bb65f015d0b6d9df862e4b":{"name":"writeOccupancyAction"}},"wt-personnel/apps/web/src/app/market/actions.ts",""] */ "use turbopack no side effects";
;
const $$RSC_SERVER_ACTION_2 = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createServerReference"])("600e8568a97eb83881f6bb65f015d0b6d9df862e4b", __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["callServer"], void 0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["findSourceMapURL"], "writeOccupancyAction");
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/app/market/data:987839 [app-client] (ecmascript) <text/javascript>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "writeRatesAction",
    ()=>$$RSC_SERVER_ACTION_3
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-client-wrapper.js [app-client] (ecmascript)");
/* __next_internal_action_entry_do_not_use__ [{"605dfc3a94dbe6c2fccfc5c7b7f35d2325a4d3153d":{"name":"writeRatesAction"}},"wt-personnel/apps/web/src/app/market/actions.ts",""] */ "use turbopack no side effects";
;
const $$RSC_SERVER_ACTION_3 = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createServerReference"])("605dfc3a94dbe6c2fccfc5c7b7f35d2325a4d3153d", __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["callServer"], void 0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["findSourceMapURL"], "writeRatesAction");
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/app/market/drawers.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
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
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/index.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$market$2f$occupancy$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/market/occupancy.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$money$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/money.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$display$2d$date$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/display-date.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$plural$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/plural.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$icon$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/icon.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$overlay$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/overlay.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$tabs$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/tabs.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$toast$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/toast.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$use$2d$confirm$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/use-confirm.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/ui.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$market$2f$data$3a$0efb58__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/market/data:0efb58 [app-client] (ecmascript) <text/javascript>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$market$2f$data$3a$64dc3b__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/market/data:64dc3b [app-client] (ecmascript) <text/javascript>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$market$2f$data$3a$8ea8c4__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/market/data:8ea8c4 [app-client] (ecmascript) <text/javascript>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$market$2f$data$3a$987839__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/market/data:987839 [app-client] (ecmascript) <text/javascript>");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature(), _s2 = __turbopack_context__.k.signature(), _s3 = __turbopack_context__.k.signature(), _s4 = __turbopack_context__.k.signature(), _s5 = __turbopack_context__.k.signature(), _s6 = __turbopack_context__.k.signature(), _s7 = __turbopack_context__.k.signature();
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
const NONE = {
    error: null,
    ok: 0
};
/**
 * Действие формы раздела: уведомление об успехе ставится сразу по ответу, до перерисовки (DESIGN.md §8). Иначе оно
 * терялось: после добавления первого конкурента или «убрать из списка» кнопка с панелью исчезает со страницы вместе
 * со своим эффектом. Панель закрывается эффектом, если кнопка осталась.
 */ function useMarketAction(serverAction, close) {
    _s();
    const { toast } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$toast$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useToast"])();
    const [state, action, pending] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useActionState"])({
        "useMarketAction.useActionState": async (prev, fd)=>{
            const next = await serverAction(prev, fd);
            if (next.ok) toast({
                text: next.message ?? 'Сохранено',
                tone: 'success'
            });
            return next;
        }
    }["useMarketAction.useActionState"], NONE);
    const seen = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(0);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useMarketAction.useEffect": ()=>{
            if (!state.ok || state.ok === seen.current) return;
            seen.current = state.ok;
            close();
        }
    }["useMarketAction.useEffect"], [
        state,
        close
    ]);
    return [
        state,
        action,
        pending
    ];
}
_s(useMarketAction, "ecQWM7EzVSa6mI5LkM0QMN2cGIY=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$toast$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useToast"],
        __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useActionState"]
    ];
});
function CompetitorButton({ competitor, primary, defaultOpen }) {
    _s1();
    const [open, setOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(defaultOpen === true);
    const label = competitor ? 'Изменить' : 'Добавить конкурента';
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                type: "button",
                tone: competitor ? 'ghost' : primary ? undefined : 'secondary',
                size: competitor ? 'xs' : undefined,
                onClick: ()=>setOpen(true),
                "data-testid": competitor ? `market-edit-${competitor.id}` : 'market-add',
                "aria-label": competitor ? `Изменить: ${competitor.name}` : undefined,
                children: [
                    !competitor && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$icon$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Icon"], {
                        name: "plus"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                        lineNumber: 75,
                        columnNumber: 25
                    }, this),
                    label
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                lineNumber: 67,
                columnNumber: 7
            }, this),
            open && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$overlay$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Overlay"], {
                open: true,
                drawer: true,
                className: "settings-service-drawer market-competitor-drawer",
                title: competitor ? competitor.name : 'Новый конкурент',
                onClose: ()=>setOpen(false),
                children: competitor ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(CompetitorForm, {
                    competitor: competitor,
                    onClose: ()=>setOpen(false)
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                    lineNumber: 87,
                    columnNumber: 13
                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$tabs$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Tabs"], {
                    label: "Как добавить конкурента",
                    panels: [
                        {
                            id: 'manual',
                            label: 'Ручной выбор',
                            content: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(CompetitorForm, {
                                onClose: ()=>setOpen(false)
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                                lineNumber: 92,
                                columnNumber: 65
                            }, this)
                        },
                        {
                            id: 'ai',
                            label: 'AI-поиск',
                            content: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(AiSearchPanel, {}, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                                lineNumber: 93,
                                columnNumber: 57
                            }, this)
                        }
                    ]
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                    lineNumber: 89,
                    columnNumber: 13
                }, this)
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                lineNumber: 79,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
        lineNumber: 66,
        columnNumber: 5
    }, this);
}
_s1(CompetitorButton, "VazEQyZR+OvGdU2TR329FRxTOdE=");
_c = CompetitorButton;
/** Поиск новых соседей ещё не подключён; мониторинг добавленных конкурентов выполняет отдельный сборщик. */ function AiSearchPanel() {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "market-ai-search",
        "data-testid": "market-ai-search",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                label: "Поиск соседних отелей",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                    disabled: true,
                    placeholder: "Название, район или адрес",
                    "aria-describedby": "market-ai-note"
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                    lineNumber: 108,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                lineNumber: 107,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "settings-note",
                id: "market-ai-note",
                children: "Автоматический поиск новых соседей пока не подключён. Добавьте конкурента вручную и укажите ссылку на Ostrovok. Сборщик отслеживает наличие мест у добавленных конкурентов после настройки запуска."
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                lineNumber: 110,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
        lineNumber: 106,
        columnNumber: 5
    }, this);
}
_c1 = AiSearchPanel;
function CompetitorForm({ competitor, onClose }) {
    _s2();
    const [state, action, pending] = useMarketAction(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$market$2f$data$3a$64dc3b__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__["saveCompetitorAction"], onClose);
    const [archived, archive, archiving] = useMarketAction(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$market$2f$data$3a$0efb58__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__["archiveCompetitorAction"], onClose);
    const { ask, dialog } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$use$2d$confirm$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useConfirm"])();
    const archiveForm = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const error = state.error ?? archived.error;
    /** После отказа поля берут введённое, иначе сохранённое */ const v = (name, fallback)=>state.values?.[name] ?? (fallback === null || fallback === undefined ? '' : String(fallback));
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
                action: action,
                className: "settings-service-form market-competitor-form",
                "data-testid": "market-competitor-form",
                children: [
                    error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Alert"], {
                        boxed: true,
                        children: error
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                        lineNumber: 136,
                        columnNumber: 19
                    }, this),
                    competitor && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                        type: "hidden",
                        name: "id",
                        value: competitor.id
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                        lineNumber: 137,
                        columnNumber: 24
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "settings-note",
                        children: "Добавьте название и ссылку. Остальные поля можно заполнить позже."
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                        lineNumber: 138,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                        label: "Название отеля",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                            name: "name",
                            required: true,
                            maxLength: 120,
                            autoFocus: true,
                            defaultValue: v('name', competitor?.name),
                            "data-testid": "market-name"
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                            lineNumber: 140,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                        lineNumber: 139,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "market-form-grid",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                                label: "Тип объекта",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                        name: "category",
                                        maxLength: 60,
                                        list: "market-categories",
                                        placeholder: "Отель, хостел, апартаменты",
                                        defaultValue: v('category', competitor?.category),
                                        "data-testid": "market-category"
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                                        lineNumber: 151,
                                        columnNumber: 11
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("datalist", {
                                        id: "market-categories",
                                        children: [
                                            'Отель 5★',
                                            'Отель 4★',
                                            'Отель 3★',
                                            'Мини-отель',
                                            'Хостел',
                                            'Апартаменты'
                                        ].map((o)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                value: o
                                            }, o, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                                                lineNumber: 161,
                                                columnNumber: 15
                                            }, this))
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                                        lineNumber: 159,
                                        columnNumber: 11
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                                lineNumber: 150,
                                columnNumber: 9
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                                className: "market-form-wide",
                                label: "Адрес",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                    name: "address",
                                    maxLength: 200,
                                    defaultValue: v('address', competitor?.address)
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                                    lineNumber: 166,
                                    columnNumber: 11
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                                lineNumber: 165,
                                columnNumber: 9
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                                className: "market-form-wide",
                                label: "Ссылка на площадку",
                                controlId: "market-url",
                                hint: "Страница конкурента на Ostrovok или другой площадке",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                    name: "url",
                                    type: "url",
                                    defaultValue: v('url', competitor?.url),
                                    placeholder: "https://ostrovok.ru/hotel/…",
                                    "data-testid": "market-url"
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                                    lineNumber: 169,
                                    columnNumber: 11
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                                lineNumber: 168,
                                columnNumber: 9
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                                label: "Номеров у соседа",
                                controlId: "market-units",
                                hint: "Сколько номеров он продаёт всего",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                    name: "unitsTotal",
                                    inputMode: "numeric",
                                    defaultValue: v('unitsTotal', competitor?.unitsTotal)
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                                    lineNumber: 172,
                                    columnNumber: 11
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                                lineNumber: 171,
                                columnNumber: 9
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                                label: "Расстояние, метров",
                                controlId: "market-distance",
                                hint: "Список идёт от ближайших",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                    name: "distanceM",
                                    inputMode: "numeric",
                                    defaultValue: v('distanceM', competitor?.distanceM),
                                    "data-testid": "market-distance"
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                                    lineNumber: 175,
                                    columnNumber: 11
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                                lineNumber: 174,
                                columnNumber: 9
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                        lineNumber: 149,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("details", {
                        className: "market-form-details",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("summary", {
                                children: "Дополнительные сведения"
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                                lineNumber: 179,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "market-form-grid",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                                        label: "Район",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                            name: "district",
                                            maxLength: 80,
                                            defaultValue: v('district', competitor?.district),
                                            "data-testid": "market-district"
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                                            lineNumber: 182,
                                            columnNumber: 11
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                                        lineNumber: 181,
                                        columnNumber: 9
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                                        label: "Заметка",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Textarea"], {
                                            name: "note",
                                            rows: 2,
                                            maxLength: 500,
                                            defaultValue: v('note', competitor?.note)
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                                            lineNumber: 185,
                                            columnNumber: 11
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                                        lineNumber: 184,
                                        columnNumber: 9
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                                lineNumber: 180,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                        lineNumber: 178,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("fieldset", {
                        className: "market-monitoring",
                        "data-testid": "market-monitoring",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("legend", {
                                children: "Мониторинг"
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                                lineNumber: 190,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                                label: "Что отслеживать",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Select"], {
                                    name: "monitoring",
                                    defaultValue: v('monitoring', competitor?.monitoring ?? 'BOTH'),
                                    "data-testid": "market-monitoring-kind",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                            value: "BOTH",
                                            children: "Загрузку и цены"
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                                            lineNumber: 193,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                            value: "OCCUPANCY",
                                            children: "Только загрузку"
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                                            lineNumber: 194,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                            value: "PRICE",
                                            children: "Только цены"
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                                            lineNumber: 195,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                                    lineNumber: 192,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                                lineNumber: 191,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                                label: "Источник данных",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                        name: "dataSource",
                                        maxLength: 40,
                                        list: "market-sources",
                                        placeholder: "Откуда берёте цифры",
                                        defaultValue: v('dataSource', competitor?.dataSource)
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                                        lineNumber: 199,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("datalist", {
                                        id: "market-sources",
                                        children: [
                                            'Вручную',
                                            'Файл CSV',
                                            'Поставщик данных'
                                        ].map((o)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                value: o
                                            }, o, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                                                lineNumber: 208,
                                                columnNumber: 17
                                            }, this))
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                                        lineNumber: 206,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                                lineNumber: 198,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                                label: "Как часто обновлять",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Select"], {
                                    name: "refreshHours",
                                    defaultValue: v('refreshHours', competitor?.refreshHours),
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                            value: "",
                                            children: "Не задано"
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                                            lineNumber: 214,
                                            columnNumber: 15
                                        }, this),
                                        [
                                            1,
                                            2,
                                            6,
                                            12,
                                            24
                                        ].map((h)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                value: h,
                                                children: [
                                                    "Раз в ",
                                                    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$plural$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["pluralRu"])(h, [
                                                        'час',
                                                        'часа',
                                                        'часов'
                                                    ])
                                                ]
                                            }, h, true, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                                                lineNumber: 216,
                                                columnNumber: 17
                                            }, this))
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                                    lineNumber: 213,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                                lineNumber: 212,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                className: "market-check",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                        type: "checkbox",
                                        name: "autoRefresh",
                                        defaultChecked: state.values ? state.values['autoRefresh'] === 'on' : competitor?.autoRefresh ?? false
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                                        lineNumber: 223,
                                        columnNumber: 13
                                    }, this),
                                    "Обновлять автоматически"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                                lineNumber: 222,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "settings-note",
                                "data-testid": "market-auto-note",
                                children: "Включите обновление и укажите ссылку на Ostrovok для сбора наличия мест. Сборщик запускается отдельно по расписанию; эта настройка сама его не запускает. Автоматический сбор цен пока не подключён."
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                                lineNumber: 230,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                        lineNumber: 189,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "settings-service-actions",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                type: "button",
                                tone: "secondary",
                                onClick: onClose,
                                children: "Отмена"
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                                lineNumber: 236,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                type: "submit",
                                disabled: pending,
                                "aria-busy": pending,
                                "data-testid": "market-save",
                                children: pending ? 'Сохраняю…' : competitor ? 'Сохранить' : 'Добавить'
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                                lineNumber: 239,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                        lineNumber: 235,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                lineNumber: 135,
                columnNumber: 7
            }, this),
            competitor && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
                ref: archiveForm,
                action: archive,
                className: "market-archive",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                        type: "hidden",
                        name: "id",
                        value: competitor.id
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                        lineNumber: 246,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "settings-note",
                        children: "Убранный конкурент пропадёт из таблицы; внесённая загрузка сохранится в истории."
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                        lineNumber: 247,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                        type: "button",
                        tone: "danger",
                        disabled: archiving,
                        "data-testid": "market-archive",
                        onClick: async ()=>{
                            const yes = await ask({
                                title: `Убрать «${competitor.name}» из списка?`,
                                body: 'Внесённая загрузка останется в истории.',
                                confirmLabel: 'Убрать',
                                tone: 'danger'
                            });
                            if (yes) archiveForm.current?.requestSubmit();
                        },
                        children: archiving ? 'Убираю…' : 'Убрать из списка'
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                        lineNumber: 250,
                        columnNumber: 11
                    }, this),
                    dialog
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                lineNumber: 245,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
        lineNumber: 134,
        columnNumber: 5
    }, this);
}
_s2(CompetitorForm, "kssGko5UWvNkNp4Sz4pQ8Beeb3M=", false, function() {
    return [
        useMarketAction,
        useMarketAction,
        __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$use$2d$confirm$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useConfirm"]
    ];
});
_c2 = CompetitorForm;
function OccupancyButton({ competitor, cells }) {
    _s3();
    const [open, setOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                type: "button",
                size: "xs",
                tone: "secondary",
                onClick: ()=>setOpen(true),
                "data-testid": `market-enter-${competitor.id}`,
                "aria-label": `Внести загрузку: ${competitor.name}`,
                children: "Внести загрузку"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                lineNumber: 285,
                columnNumber: 7
            }, this),
            open && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$overlay$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Overlay"], {
                open: true,
                drawer: true,
                className: "settings-service-drawer",
                title: `Загрузка: ${competitor.name}`,
                onClose: ()=>setOpen(false),
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(OccupancyForm, {
                    competitor: competitor,
                    cells: cells,
                    onClose: ()=>setOpen(false)
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                    lineNumber: 303,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                lineNumber: 296,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
        lineNumber: 284,
        columnNumber: 5
    }, this);
}
_s3(OccupancyButton, "xG1TONbKtDWtdOTrXaTAsNhPg/Q=");
_c3 = OccupancyButton;
function RatesButton({ competitor, cells, currency }) {
    _s4();
    const [open, setOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                type: "button",
                size: "xs",
                tone: "secondary",
                onClick: ()=>setOpen(true),
                "data-testid": `market-rates-${competitor.id}`,
                "aria-label": `Внести цены: ${competitor.name}`,
                children: "Внести цены"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                lineNumber: 323,
                columnNumber: 7
            }, this),
            open && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$overlay$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Overlay"], {
                open: true,
                drawer: true,
                className: "settings-service-drawer",
                title: `Цены: ${competitor.name}`,
                onClose: ()=>setOpen(false),
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(RatesForm, {
                    competitor: competitor,
                    cells: cells,
                    currency: currency,
                    onClose: ()=>setOpen(false)
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                    lineNumber: 341,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                lineNumber: 334,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
        lineNumber: 322,
        columnNumber: 5
    }, this);
}
_s4(RatesButton, "xG1TONbKtDWtdOTrXaTAsNhPg/Q=");
_c4 = RatesButton;
function RatesForm({ competitor, cells, currency, onClose }) {
    _s5();
    const [state, action, pending] = useMarketAction(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$market$2f$data$3a$987839__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__["writeRatesAction"], onClose);
    const sign = currency === 'KZT' ? '₸' : currency;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
        action: action,
        className: "settings-service-form",
        "data-testid": "market-rates-form",
        children: [
            state.error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Alert"], {
                boxed: true,
                children: state.error
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                lineNumber: 363,
                columnNumber: 23
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                type: "hidden",
                name: "id",
                value: competitor.id
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                lineNumber: 364,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "settings-note",
                children: [
                    "Цена за ночь в ",
                    sign,
                    ", например 42 000. Запишется снимком сегодняшнего дня: завтра увидите, как изменилась цена. Очистите поле, чтобы снять сегодняшнее значение."
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                lineNumber: 365,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "market-entry-grid",
                children: cells.map((c)=>{
                    const was = c.priceMinor === null ? '' : (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$money$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["minorToInput"])(c.priceMinor);
                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                        className: "market-entry",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "market-entry__date",
                                children: dayLabel(c.date)
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                                lineNumber: 374,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                type: "hidden",
                                name: `was:${c.date}`,
                                value: was
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                                lineNumber: 375,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "market-entry__field",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                        name: `r:${c.date}`,
                                        inputMode: "decimal",
                                        defaultValue: state.values?.[`r:${c.date}`] ?? was,
                                        "aria-label": `Цена на ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$display$2d$date$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["displayDate"])(c.date, 'numeric')}, ${sign}`,
                                        "data-testid": `market-r-${c.date}`
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                                        lineNumber: 377,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        "aria-hidden": "true",
                                        children: sign
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                                        lineNumber: 384,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                                lineNumber: 376,
                                columnNumber: 15
                            }, this)
                        ]
                    }, c.date, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                        lineNumber: 373,
                        columnNumber: 13
                    }, this);
                })
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                lineNumber: 369,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "settings-service-actions",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                        type: "button",
                        tone: "secondary",
                        onClick: onClose,
                        children: "Отмена"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                        lineNumber: 391,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                        type: "submit",
                        disabled: pending,
                        "aria-busy": pending,
                        "data-testid": "market-rates-save",
                        children: pending ? 'Сохраняю…' : 'Сохранить'
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                        lineNumber: 394,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                lineNumber: 390,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
        lineNumber: 362,
        columnNumber: 5
    }, this);
}
_s5(RatesForm, "PhZzNluPNWPPeq74UKT4U8dRpcU=", false, function() {
    return [
        useMarketAction
    ];
});
_c5 = RatesForm;
/** «Суббота, 3 октября»: день недели с большой буквы, без года */ const dayLabel = (date)=>{
    const text = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$display$2d$date$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["displayDate"])(date, 'full').replace(/ \d{4} г\.$/, '');
    return text.charAt(0).toUpperCase() + text.slice(1);
};
/** Значение поля из базисных пунктов: «85», «85,5» (без знака процента: он подписан у поля) */ const percentText = (bp)=>bp === null ? '' : (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$market$2f$occupancy$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatOccupancy"])(bp).replace(' %', '');
function OccupancyForm({ competitor, cells, onClose }) {
    _s6();
    const [state, action, pending] = useMarketAction(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$market$2f$data$3a$8ea8c4__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__["writeOccupancyAction"], onClose);
    const form = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const [all, setAll] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    /** Одно число во все ночи окна: соседи часто заполнены ровно, вводить 14 раз одно и то же незачем */ const fillAll = ()=>{
        if (!all.trim()) return;
        form.current?.querySelectorAll('input[name^="p:"]').forEach((input)=>input.value = all.trim());
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
        ref: form,
        action: action,
        className: "settings-service-form",
        "data-testid": "market-occupancy-form",
        children: [
            state.error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Alert"], {
                boxed: true,
                children: state.error
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                lineNumber: 433,
                columnNumber: 23
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                type: "hidden",
                name: "id",
                value: competitor.id
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                lineNumber: 434,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "settings-note",
                children: "Процент занятых номеров на ночь, от 0 до 100. Запишется снимком сегодняшнего дня: завтра увидите, как изменилась загрузка. Заполненные поля сохраняются все: так вы подтверждаете, что сегодня проверили и значение то же. Очистите поле, чтобы снять сегодняшнее значение."
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                lineNumber: 435,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "market-fill",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                        inline: true,
                        label: "Все ночи",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "market-entry__field",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                    inputMode: "decimal",
                                    value: all,
                                    onChange: (e)=>setAll(e.target.value),
                                    "aria-label": "Одно значение для всех ночей, процентов",
                                    "data-testid": "market-fill-value"
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                                    lineNumber: 443,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    "aria-hidden": "true",
                                    children: "%"
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                                    lineNumber: 450,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                            lineNumber: 442,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                        lineNumber: 441,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                        type: "button",
                        size: "sm",
                        tone: "secondary",
                        onClick: fillAll,
                        "data-testid": "market-fill",
                        children: "Заполнить все ночи"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                        lineNumber: 453,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                lineNumber: 440,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "market-entry-grid",
                children: cells.map((c)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                        className: "market-entry",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "market-entry__date",
                                children: dayLabel(c.date)
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                                lineNumber: 460,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                type: "hidden",
                                name: `was:${c.date}`,
                                value: percentText(c.bp)
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                                lineNumber: 461,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "market-entry__field",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                        name: `p:${c.date}`,
                                        inputMode: "decimal",
                                        defaultValue: state.values?.[`p:${c.date}`] ?? percentText(c.bp),
                                        "aria-label": `Загрузка на ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$display$2d$date$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["displayDate"])(c.date, 'numeric')}, процентов`,
                                        "data-testid": `market-p-${c.date}`
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                                        lineNumber: 463,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        "aria-hidden": "true",
                                        children: "%"
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                                        lineNumber: 470,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                                lineNumber: 462,
                                columnNumber: 13
                            }, this)
                        ]
                    }, c.date, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                        lineNumber: 459,
                        columnNumber: 11
                    }, this))
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                lineNumber: 457,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "settings-service-actions",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                        type: "button",
                        tone: "secondary",
                        onClick: onClose,
                        children: "Отмена"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                        lineNumber: 476,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                        type: "submit",
                        disabled: pending,
                        "aria-busy": pending,
                        "data-testid": "market-occupancy-save",
                        children: pending ? 'Сохраняю…' : 'Сохранить'
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                        lineNumber: 479,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                lineNumber: 475,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
        lineNumber: 432,
        columnNumber: 5
    }, this);
}
_s6(OccupancyForm, "faN6MRBJUnzGd/gkEq4iOXg9KV4=", false, function() {
    return [
        useMarketAction
    ];
});
_c6 = OccupancyForm;
const pct = (bp)=>bp === null ? '–' : (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$market$2f$occupancy$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatOccupancy"])(Math.round(bp / 100) * 100);
function NightDrawer({ date, history, closeHref }) {
    _s7();
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"])();
    const close = ()=>router.replace(closeHref, {
            scroll: false
        });
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$overlay$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Overlay"], {
        open: true,
        drawer: true,
        className: "settings-service-drawer market-night",
        title: `История ночи: ${dayLabel(date)}`,
        onClose: close,
        children: !history ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Alert"], {
            boxed: true,
            children: "История ночи не загрузилась. Закройте панель и откройте снова."
        }, void 0, false, {
            fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
            lineNumber: 513,
            columnNumber: 9
        }, this) : history.days.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
            className: "settings-note",
            "data-testid": "market-night-empty",
            children: "На эту ночь снимков ещё нет. Внесите загрузку соседей, и здесь появится, как они заполняются день за днём."
        }, void 0, false, {
            fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
            lineNumber: 515,
            columnNumber: 9
        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "settings-note",
                    "data-testid": "market-night-pickup",
                    children: [
                        history.pickupBp === null ? 'Пока один день снимков: темп рынка появится со вторым.' : `Рынок за ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$plural$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["pluralRu"])(history.days.length, [
                            'день',
                            'дня',
                            'дней'
                        ])} снимков: ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$market$2f$occupancy$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatPoints"])(Math.round(history.pickupBp / 100) * 100)}`,
                        ' ',
                        "Бледным: значение перенесено с прошлого снимка, в этот день соседа не проверяли."
                    ]
                }, void 0, true, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                    lineNumber: 521,
                    columnNumber: 11
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Table"], {
                    size: "sm",
                    className: "market-night-table",
                    "aria-label": "Загрузка ночи по дням снимков",
                    "data-testid": "market-night-table",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("thead", {
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                        scope: "col",
                                        children: "Снимок"
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                                        lineNumber: 531,
                                        columnNumber: 17
                                    }, this),
                                    history.competitors.map((c)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                            scope: "col",
                                            children: c.name
                                        }, c.id, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                                            lineNumber: 533,
                                            columnNumber: 19
                                        }, this)),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                        scope: "col",
                                        children: "Рынок"
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                                        lineNumber: 537,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                                lineNumber: 530,
                                columnNumber: 15
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                            lineNumber: 529,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tbody", {
                            children: [
                                ...history.days
                            ].reverse().map((d)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                            scope: "row",
                                            children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$display$2d$date$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["displayDate"])(d.observedOn, 'numeric')
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                                            lineNumber: 543,
                                            columnNumber: 19
                                        }, this),
                                        d.values.map((v)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cx"])(!v.observed && 'market-night__carried'),
                                                children: pct(v.bp)
                                            }, v.competitorId, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                                                lineNumber: 545,
                                                columnNumber: 21
                                            }, this)),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                            className: "market-night__market",
                                            children: pct(d.marketBp)
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                                            lineNumber: 549,
                                            columnNumber: 19
                                        }, this)
                                    ]
                                }, d.observedOn, true, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                                    lineNumber: 542,
                                    columnNumber: 17
                                }, this))
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                            lineNumber: 540,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
                    lineNumber: 528,
                    columnNumber: 11
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
            lineNumber: 520,
            columnNumber: 9
        }, this)
    }, void 0, false, {
        fileName: "[project]/wt-personnel/apps/web/src/app/market/drawers.tsx",
        lineNumber: 505,
        columnNumber: 5
    }, this);
}
_s7(NightDrawer, "fN7XvhJ+p5oE6+Xlo0NJmXpxjC8=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"]
    ];
});
_c7 = NightDrawer;
var _c, _c1, _c2, _c3, _c4, _c5, _c6, _c7;
__turbopack_context__.k.register(_c, "CompetitorButton");
__turbopack_context__.k.register(_c1, "AiSearchPanel");
__turbopack_context__.k.register(_c2, "CompetitorForm");
__turbopack_context__.k.register(_c3, "OccupancyButton");
__turbopack_context__.k.register(_c4, "RatesButton");
__turbopack_context__.k.register(_c5, "RatesForm");
__turbopack_context__.k.register(_c6, "OccupancyForm");
__turbopack_context__.k.register(_c7, "NightDrawer");
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
"[project]/wt-personnel/apps/web/src/components/date-field.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DateInput",
    ()=>DateInput
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$icon$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/icon.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$property$2d$time$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/property-time.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/ui.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
;
const MONTHS = [
    'январь',
    'февраль',
    'март',
    'апрель',
    'май',
    'июнь',
    'июль',
    'август',
    'сентябрь',
    'октябрь',
    'ноябрь',
    'декабрь'
];
const MONTHS_OF = [
    'января',
    'февраля',
    'марта',
    'апреля',
    'мая',
    'июня',
    'июля',
    'августа',
    'сентября',
    'октября',
    'ноября',
    'декабря'
];
const WEEKDAYS = [
    'пн',
    'вт',
    'ср',
    'чт',
    'пт',
    'сб',
    'вс'
];
/** размеры всплывающего календаря (см. .date-field__pop): нужны, чтобы не выйти за окно */ const POP_W = 296;
const POP_H = 372;
const DAY = 86_400_000;
const iso = (d)=>d.toISOString().slice(0, 10);
const parse = (s)=>s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00Z`) : null;
const addDays = (d, n)=>new Date(d.getTime() + n * DAY);
const monthStart = (d)=>new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
const addMonths = (d, n)=>{
    const first = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
    const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
    return new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(d.getUTCDate(), last)));
};
/** Шесть недель с понедельника, покрывающие месяц: календарь не прыгает по высоте */ function weeksOf(month) {
    const first = monthStart(month);
    const shift = (first.getUTCDay() + 6) % 7; // понедельник — 0
    const start = addDays(first, -shift);
    return Array.from({
        length: 6
    }, (_, w)=>Array.from({
            length: 7
        }, (_, d)=>addDays(start, w * 7 + d)));
}
const dayLabel = (d)=>`${d.getUTCDate()} ${MONTHS_OF[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
function DateInput({ className, rangeFromName, defaultOpen, id: givenId, ...rest }) {
    _s();
    const autoId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useId"])();
    const popId = `${autoId}-calendar`;
    // Сегодня по часам объекта, как считает остальная стойка (С-13): пояс — из настроек объекта
    const clock = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$property$2d$time$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["usePropertyClock"])();
    const hotelToday = ()=>clock.today();
    const initial = parse(typeof rest.defaultValue === 'string' ? rest.defaultValue : null) ?? parse(hotelToday());
    const [open, setOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(!!defaultOpen);
    const [pos, setPos] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [view, setView] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        "DateInput.useState": ()=>monthStart(initial)
    }["DateInput.useState"]);
    const [cursor, setCursor] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        "DateInput.useState": ()=>initial
    }["DateInput.useState"]);
    const [hover, setHover] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const input = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const button = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const pop = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    /** где стояло поле, когда календарь открыли: сдвинулось — координаты календаря устарели */ const anchor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const rangeFrom = ()=>{
        if (!rangeFromName || !input.current?.form) return null;
        const el = input.current.form.elements.namedItem(rangeFromName);
        return el instanceof HTMLInputElement ? parse(el.value) : null;
    };
    const show = ()=>{
        const current = parse(input.current?.value) ?? rangeFrom() ?? parse(hotelToday());
        setCursor(current);
        setView(monthStart(current));
        setHover(null);
        // Календарь стоит в координатах окна (position: fixed): так он не обрезается прокруткой
        // панели брони и не упирается в края окна — у правого края открывается влево от поля,
        // у нижнего — над полем
        const box = input.current?.getBoundingClientRect();
        anchor.current = box ? {
            top: box.top,
            left: box.left
        } : null;
        if (box) {
            const left = box.left + POP_W > window.innerWidth ? Math.max(8, box.right - POP_W) : box.left;
            const below = box.bottom + 4;
            const top = below + POP_H > window.innerHeight && box.top - 4 - POP_H > 0 ? box.top - 4 - POP_H : below;
            setPos({
                top,
                left
            });
        }
        setOpen(true);
    };
    const close = (focusButton = true)=>{
        setOpen(false);
        if (focusButton) button.current?.focus();
    };
    // Поле обычно лежит внутри <label> (Field): имя поля для программы чтения собирается из всего
    // текста подписи — вместе с «Открыть календарь» у кнопки, и «Заезд» превращается в «Заезд Открыть
    // календарь». Даём полю подпись без кнопки — тем же словом, что стоит в <label>.
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "DateInput.useEffect": ()=>{
            const el = input.current;
            const label = el?.closest('label');
            if (!el || !label || el.getAttribute('aria-label')) return;
            const text = Array.from(label.childNodes).filter({
                "DateInput.useEffect.text": (n)=>!(n instanceof Element && n.contains(el))
            }["DateInput.useEffect.text"]).map({
                "DateInput.useEffect.text": (n)=>n.textContent ?? ''
            }["DateInput.useEffect.text"]).join('').trim();
            if (text) el.setAttribute('aria-label', text);
        }
    }["DateInput.useEffect"], []);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "DateInput.useEffect": ()=>{
            if (!open || defaultOpen) return;
            const onDown = {
                "DateInput.useEffect.onDown": (e)=>{
                    if (!pop.current?.contains(e.target) && !button.current?.contains(e.target)) setOpen(false);
                }
            }["DateInput.useEffect.onDown"];
            // прокрутка страницы или панели и смена размера окна закрывают календарь, если поле и вправду
            // сдвинулось: его координаты в окне устарели. Сам факт события — нет: панель брони отдаёт
            // `scroll` уже от вставки календаря в разметку, не сдвигая ничего
            const onMove = {
                "DateInput.useEffect.onMove": ()=>{
                    const box = input.current?.getBoundingClientRect();
                    const was = anchor.current;
                    if (!box || !was || Math.abs(box.top - was.top) > 1 || Math.abs(box.left - was.left) > 1) close();
                }
            }["DateInput.useEffect.onMove"];
            document.addEventListener('mousedown', onDown);
            window.addEventListener('scroll', onMove, true);
            window.addEventListener('resize', onMove);
            return ({
                "DateInput.useEffect": ()=>{
                    document.removeEventListener('mousedown', onDown);
                    window.removeEventListener('scroll', onMove, true);
                    window.removeEventListener('resize', onMove);
                }
            })["DateInput.useEffect"];
        }
    }["DateInput.useEffect"], [
        open,
        defaultOpen
    ]);
    // показать в верхнем слое; без поддержки Popover API остаётся обычный fixed у своего места
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "DateInput.useEffect": ()=>{
            const el = pop.current;
            if (open && !defaultOpen && el && typeof el.showPopover === 'function') {
                try {
                    el.showPopover();
                } catch  {
                /* уже показан */ }
            }
        }
    }["DateInput.useEffect"], [
        open,
        defaultOpen
    ]);
    // фокус — на дне под курсором (после смены месяца с клавиатуры кнопка новая, поэтому по ключу)
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "DateInput.useEffect": ()=>{
            // без прокрутки: календарь стоит в координатах окна, а прокрутка панели закрыла бы его
            if (open && !defaultOpen) pop.current?.querySelector(`[data-date="${iso(cursor)}"]`)?.focus({
                preventScroll: true
            });
        }
    }["DateInput.useEffect"], [
        open,
        cursor,
        defaultOpen
    ]);
    const select = (d)=>{
        const el = input.current;
        if (!el) return;
        // родное поле — как если бы дату ввёл человек: React слушает `input`, GET-форма читает value
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        setter?.call(el, iso(d));
        el.dispatchEvent(new Event('input', {
            bubbles: true
        }));
        el.dispatchEvent(new Event('change', {
            bubbles: true
        }));
        close();
    };
    const moveCursor = (d)=>{
        setCursor(d);
        if (d.getUTCMonth() !== view.getUTCMonth() || d.getUTCFullYear() !== view.getUTCFullYear()) setView(monthStart(d));
    };
    const onKey = (e)=>{
        const step = {
            ArrowLeft: ()=>addDays(cursor, -1),
            ArrowRight: ()=>addDays(cursor, 1),
            ArrowUp: ()=>addDays(cursor, -7),
            ArrowDown: ()=>addDays(cursor, 7),
            PageUp: ()=>addMonths(cursor, -1),
            PageDown: ()=>addMonths(cursor, 1),
            Home: ()=>addDays(cursor, -((cursor.getUTCDay() + 6) % 7)),
            End: ()=>addDays(cursor, 6 - (cursor.getUTCDay() + 6) % 7)
        };
        if (e.key === 'Escape') {
            e.preventDefault();
            close();
            return;
        }
        const next = step[e.key];
        if (!next) return;
        e.preventDefault();
        moveCursor(next());
    };
    const min = parse(typeof rest.min === 'string' ? rest.min : null);
    const max = parse(typeof rest.max === 'string' ? rest.max : null);
    const selected = open ? parse(input.current?.value) : null;
    const today = hotelToday();
    const from = open ? rangeFrom() : null;
    const rangeEnd = hover ? parse(hover) : selected ?? cursor;
    const inRange = (d)=>!!from && !!rangeEnd && from.getTime() <= d.getTime() && d.getTime() <= rangeEnd.getTime();
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cx"])('date-field', className),
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                ref: input,
                type: "date",
                className: "inp date-field__input",
                id: givenId,
                ...rest
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/components/date-field.tsx",
                lineNumber: 244,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                ref: button,
                type: "button",
                className: "date-field__button",
                "aria-label": "Открыть календарь",
                "aria-haspopup": "dialog",
                "aria-expanded": open,
                "aria-controls": open ? popId : undefined,
                onClick: (e)=>{
                    e.preventDefault();
                    if (open) close();
                    else show();
                },
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$icon$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Icon"], {
                    name: "board",
                    width: 16,
                    height: 16
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/components/date-field.tsx",
                    lineNumber: 259,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/components/date-field.tsx",
                lineNumber: 245,
                columnNumber: 7
            }, this),
            open && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                ref: pop,
                id: popId,
                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cx"])('date-field__pop', defaultOpen && 'date-field__pop--inline'),
                // верхний слой браузера (Popover API): панель брони стоит с backdrop-filter, и обычный
                // position: fixed внутри неё считался бы от панели, а не от окна. В каталоге — в потоке
                popover: defaultOpen ? undefined : 'manual',
                style: pos && !defaultOpen ? {
                    top: pos.top,
                    left: pos.left
                } : undefined,
                role: "dialog",
                "aria-label": "Календарь",
                onKeyDown: onKey,
                onMouseLeave: ()=>setHover(null),
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "date-field__head",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                type: "button",
                                className: "date-field__nav date-field__nav--prev",
                                "aria-label": "Предыдущий месяц",
                                onClick: (e)=>{
                                    e.preventDefault();
                                    setView(addMonths(view, -1));
                                },
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$icon$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Icon"], {
                                    name: "chevron",
                                    width: 16,
                                    height: 16
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/components/date-field.tsx",
                                    lineNumber: 285,
                                    columnNumber: 15
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/components/date-field.tsx",
                                lineNumber: 276,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                "aria-live": "polite",
                                children: [
                                    MONTHS[view.getUTCMonth()],
                                    " ",
                                    view.getUTCFullYear()
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/components/date-field.tsx",
                                lineNumber: 287,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                type: "button",
                                className: "date-field__nav",
                                "aria-label": "Следующий месяц",
                                onClick: (e)=>{
                                    e.preventDefault();
                                    setView(addMonths(view, 1));
                                },
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$icon$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Icon"], {
                                    name: "chevron",
                                    width: 16,
                                    height: 16
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/components/date-field.tsx",
                                    lineNumber: 299,
                                    columnNumber: 15
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/components/date-field.tsx",
                                lineNumber: 290,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/date-field.tsx",
                        lineNumber: 275,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("table", {
                        className: "date-field__grid",
                        role: "grid",
                        "aria-label": "Дни месяца",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("thead", {
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                    children: WEEKDAYS.map((w)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                            scope: "col",
                                            children: w
                                        }, w, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/components/date-field.tsx",
                                            lineNumber: 306,
                                            columnNumber: 19
                                        }, this))
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/components/date-field.tsx",
                                    lineNumber: 304,
                                    columnNumber: 15
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/components/date-field.tsx",
                                lineNumber: 303,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tbody", {
                                children: weeksOf(view).map((week)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                        children: week.map((d)=>{
                                            const key = iso(d);
                                            const isSelected = !!selected && key === iso(selected);
                                            const disabled = !!min && d.getTime() < min.getTime() || !!max && d.getTime() > max.getTime();
                                            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                role: "gridcell",
                                                "aria-selected": isSelected,
                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                    type: "button",
                                                    "data-date": key,
                                                    className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cx"])('date-field__day', d.getUTCMonth() !== view.getUTCMonth() && 'is-other', key === today && 'is-today', isSelected && 'is-selected', inRange(d) && 'is-range'),
                                                    tabIndex: key === iso(cursor) ? 0 : -1,
                                                    "aria-label": dayLabel(d),
                                                    "aria-current": key === today ? 'date' : undefined,
                                                    disabled: disabled,
                                                    onClick: (e)=>{
                                                        // внутри <label> щелчок по уже снятой кнопке активирует подпись
                                                        // и уводит фокус в поле — не даём ему дойти до подписи
                                                        e.preventDefault();
                                                        select(d);
                                                    },
                                                    onMouseEnter: ()=>setHover(key),
                                                    onFocus: ()=>{
                                                        if (key !== iso(cursor)) setCursor(d);
                                                    },
                                                    children: d.getUTCDate()
                                                }, void 0, false, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/components/date-field.tsx",
                                                    lineNumber: 323,
                                                    columnNumber: 25
                                                }, this)
                                            }, key, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/components/date-field.tsx",
                                                lineNumber: 322,
                                                columnNumber: 23
                                            }, this);
                                        })
                                    }, iso(week[0]), false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/components/date-field.tsx",
                                        lineNumber: 314,
                                        columnNumber: 17
                                    }, this))
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/components/date-field.tsx",
                                lineNumber: 312,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/date-field.tsx",
                        lineNumber: 302,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "date-field__foot",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            type: "button",
                            className: "btn btn--ghost btn--xs",
                            onClick: (e)=>{
                                e.preventDefault();
                                select(parse(today));
                            },
                            children: "Сегодня"
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/components/date-field.tsx",
                            lineNumber: 358,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/date-field.tsx",
                        lineNumber: 357,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/components/date-field.tsx",
                lineNumber: 262,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/components/date-field.tsx",
        lineNumber: 243,
        columnNumber: 5
    }, this);
}
_s(DateInput, "RUoLq682L1EOXwng2b4v339XIaY=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useId"],
        __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$property$2d$time$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["usePropertyClock"]
    ];
});
_c = DateInput;
var _c;
__turbopack_context__.k.register(_c, "DateInput");
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
"[project]/wt-personnel/apps/web/src/components/tabs.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Tabs",
    ()=>Tabs,
    "rovingIndex",
    ()=>rovingIndex
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
function rovingIndex(key, index, length) {
    if (key === 'ArrowRight') return (index + 1) % length;
    if (key === 'ArrowLeft') return (index + length - 1) % length;
    if (key === 'Home') return 0;
    if (key === 'End') return length - 1;
    return -1;
}
const Count = ({ value })=>value === undefined ? null : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        className: "tabs__count",
        children: value
    }, void 0, false, {
        fileName: "[project]/wt-personnel/apps/web/src/components/tabs.tsx",
        lineNumber: 38,
        columnNumber: 32
    }, ("TURBOPACK compile-time value", void 0));
_c = Count;
function Tabs(props) {
    return props.items ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(RouteTabs, {
        label: props.label,
        items: props.items,
        className: props.className
    }, void 0, false, {
        fileName: "[project]/wt-personnel/apps/web/src/components/tabs.tsx",
        lineNumber: 42,
        columnNumber: 5
    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(LocalTabs, {
        label: props.label,
        panels: props.panels,
        className: props.className
    }, void 0, false, {
        fileName: "[project]/wt-personnel/apps/web/src/components/tabs.tsx",
        lineNumber: 44,
        columnNumber: 5
    }, this);
}
_c1 = Tabs;
function RouteTabs({ label, items, className }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("nav", {
        className: className ? `tabs ${className}` : 'tabs',
        "aria-label": label,
        children: items.map((item)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                href: item.href,
                prefetch: false,
                className: "tabs__item",
                "aria-current": item.current ? 'page' : undefined,
                children: [
                    item.label,
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Count, {
                        value: item.count
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/tabs.tsx",
                        lineNumber: 68,
                        columnNumber: 11
                    }, this)
                ]
            }, item.href, true, {
                fileName: "[project]/wt-personnel/apps/web/src/components/tabs.tsx",
                lineNumber: 60,
                columnNumber: 9
            }, this))
    }, void 0, false, {
        fileName: "[project]/wt-personnel/apps/web/src/components/tabs.tsx",
        lineNumber: 58,
        columnNumber: 5
    }, this);
}
_c2 = RouteTabs;
function LocalTabs({ label, panels, className }) {
    _s();
    const [active, setActive] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(panels[0].id);
    const prefix = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useId"])();
    // Вкладку из адреса берём при появлении карточки, по `hashchange` и при смене набора вкладок — но не на каждой
    // перерисовке с сервера: массив `panels` после server action всегда новый, а адрес в этот миг может быть старым.
    // Ответ действия, пришедший во время клика по другой вкладке, роутер Next применяет с адресом, с которым действие
    // стартовало, и карточка возвращалась на «Действия» (полный UI-набор 28.09.2026, tests/ui/record-tabs.spec.ts).
    // Переход на другую бронь даёт новый экземпляр: сегмент `[number]` роутер монтирует заново.
    const ids = panels.map((t)=>t.id).join(' ');
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "LocalTabs.useEffect": ()=>{
            const known = ids.split(' ');
            const sync = {
                "LocalTabs.useEffect.sync": ()=>{
                    const id = location.hash.slice(1);
                    if (known.includes(id)) setActive(id);
                }
            }["LocalTabs.useEffect.sync"];
            sync();
            window.addEventListener('hashchange', sync);
            return ({
                "LocalTabs.useEffect": ()=>window.removeEventListener('hashchange', sync)
            })["LocalTabs.useEffect"];
        }
    }["LocalTabs.useEffect"], [
        ids
    ]);
    const select = (id)=>{
        setActive(id);
        // Next copies its internal state and synchronizes the router when data is null.
        history.replaceState(null, '', `${location.pathname}${location.search}#${id}`);
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: className ? `tabs-local ${className}` : 'tabs-local',
        onClick: (event)=>{
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            const anchor = event.target.closest('a[href^="#"]');
            const id = anchor?.getAttribute('href')?.slice(1);
            if (!id || !panels.some((tab)=>tab.id === id)) return;
            // A shortcut selects a tab, so closing a routed drawer still takes one Back step.
            event.preventDefault();
            select(id);
            document.getElementById(`${prefix}-${id}`)?.focus();
        },
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "tabs",
                role: "tablist",
                "aria-label": label,
                children: panels.map((tab, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        role: "tab",
                        className: "tabs__item",
                        id: `${prefix}-${tab.id}`,
                        "aria-controls": `${prefix}-panel-${tab.id}`,
                        "aria-selected": active === tab.id,
                        tabIndex: active === tab.id ? 0 : -1,
                        onClick: ()=>select(tab.id),
                        onKeyDown: (e)=>{
                            const next = rovingIndex(e.key, index, panels.length);
                            if (next < 0) return;
                            e.preventDefault();
                            select(panels[next].id);
                            document.getElementById(`${prefix}-${panels[next].id}`)?.focus();
                        },
                        children: [
                            tab.label,
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Count, {
                                value: tab.count
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/components/tabs.tsx",
                                lineNumber: 142,
                                columnNumber: 13
                            }, this)
                        ]
                    }, tab.id, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/tabs.tsx",
                        lineNumber: 123,
                        columnNumber: 11
                    }, this))
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/components/tabs.tsx",
                lineNumber: 121,
                columnNumber: 7
            }, this),
            panels.map((tab)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                    id: `${prefix}-panel-${tab.id}`,
                    role: "tabpanel",
                    className: "tabs__panel",
                    "aria-labelledby": `${prefix}-${tab.id}`,
                    hidden: active !== tab.id,
                    tabIndex: 0,
                    children: tab.content
                }, tab.id, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/components/tabs.tsx",
                    lineNumber: 147,
                    columnNumber: 9
                }, this))
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/components/tabs.tsx",
        lineNumber: 108,
        columnNumber: 5
    }, this);
}
_s(LocalTabs, "hY1AKeyQ90BPQGNPEoltSULo5Ec=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useId"]
    ];
});
_c3 = LocalTabs;
var _c, _c1, _c2, _c3;
__turbopack_context__.k.register(_c, "Count");
__turbopack_context__.k.register(_c1, "Tabs");
__turbopack_context__.k.register(_c2, "RouteTabs");
__turbopack_context__.k.register(_c3, "LocalTabs");
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
"[project]/wt-personnel/apps/web/src/lib/display-date.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
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
]);

//# sourceMappingURL=wt-personnel_apps_web_src_0dibfnp._.js.map