(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/wt-personnel/apps/web/src/app/beauty-settings/data:98ec1a [app-client] (ecmascript) <text/javascript>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "saveSalonHours",
    ()=>$$RSC_SERVER_ACTION_0
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-client-wrapper.js [app-client] (ecmascript)");
/* __next_internal_action_entry_do_not_use__ [{"600064c6b1b4b358c1ff6d2627e5773706ad62c1ac":{"name":"saveSalonHours"}},"wt-personnel/apps/web/src/app/beauty-settings/actions.ts",""] */ "use turbopack no side effects";
;
const $$RSC_SERVER_ACTION_0 = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createServerReference"])("600064c6b1b4b358c1ff6d2627e5773706ad62c1ac", __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["callServer"], void 0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["findSourceMapURL"], "saveSalonHours");
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/app/beauty-settings/hours-form.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SalonHoursForm",
    ()=>SalonHoursForm
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/ui.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$beauty$2f$time$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/beauty/time.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$beauty$2d$settings$2f$data$3a$98ec1a__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/beauty-settings/data:98ec1a [app-client] (ecmascript) <text/javascript>");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
;
;
const DAYS = [
    [
        1,
        'Понедельник'
    ],
    [
        2,
        'Вторник'
    ],
    [
        3,
        'Среда'
    ],
    [
        4,
        'Четверг'
    ],
    [
        5,
        'Пятница'
    ],
    [
        6,
        'Суббота'
    ],
    [
        0,
        'Воскресенье'
    ]
];
function SalonHoursForm({ initial, scopeKey, canEdit }) {
    _s();
    const [state, action, pending] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useActionState"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$beauty$2d$settings$2f$data$3a$98ec1a__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__["saveSalonHours"], null);
    const data = state?.data ?? initial;
    const [rows, setRows] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        "SalonHoursForm.useState": ()=>initial.intervals.map({
                "SalonHoursForm.useState": (interval, key)=>({
                        ...interval,
                        key
                    })
            }["SalonHoursForm.useState"])
    }["SalonHoursForm.useState"]);
    const nextKey = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(rows.length);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "SalonHoursForm.useEffect": ()=>{
            if (!state?.data) return;
            setRows(state.data.intervals.map({
                "SalonHoursForm.useEffect": (interval, key)=>({
                        ...interval,
                        key
                    })
            }["SalonHoursForm.useEffect"]));
            nextKey.current = state.data.intervals.length;
        }
    }["SalonHoursForm.useEffect"], [
        state
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
        action: action,
        className: "salon-hours-form",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                children: "Режим работы салона"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/beauty-settings/hours-form.tsx",
                lineNumber: 41,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                children: [
                    "Часовой пояс: ",
                    initial.location.timezone,
                    ". Запись должна попадать в часы салона и график мастера."
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/beauty-settings/hours-form.tsx",
                lineNumber: 42,
                columnNumber: 7
            }, this),
            !data.configured && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                children: "Режим пока не настроен. До сохранения доступность определяется графиками мастеров."
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/beauty-settings/hours-form.tsx",
                lineNumber: 47,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                type: "hidden",
                name: "scopeKey",
                value: scopeKey
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/beauty-settings/hours-form.tsx",
                lineNumber: 49,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                type: "hidden",
                name: "revision",
                value: data.revision
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/beauty-settings/hours-form.tsx",
                lineNumber: 50,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                type: "hidden",
                name: "intervals",
                value: JSON.stringify(rows.map(({ weekday, timeFrom, timeTo })=>({
                        weekday,
                        timeFrom,
                        timeTo
                    })))
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/beauty-settings/hours-form.tsx",
                lineNumber: 51,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("fieldset", {
                disabled: !canEdit || pending,
                className: "salon-hours-week",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("legend", {
                        className: "sr-only",
                        children: "Недельный режим работы"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/beauty-settings/hours-form.tsx",
                        lineNumber: 59,
                        columnNumber: 9
                    }, this),
                    DAYS.map(([weekday, name])=>{
                        const own = rows.filter((row)=>row.weekday === weekday);
                        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                            className: "salon-hours-day",
                            "aria-label": name,
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                    children: name
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/beauty-settings/hours-form.tsx",
                                    lineNumber: 64,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "salon-hours-day-content",
                                    children: [
                                        !own.length && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            children: data.configured ? 'Выходной' : 'Интервалы не заданы'
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/beauty-settings/hours-form.tsx",
                                            lineNumber: 66,
                                            columnNumber: 33
                                        }, this),
                                        own.map((row, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "salon-hours-interval",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                                                        label: "С",
                                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                                            type: "time",
                                                            required: true,
                                                            "aria-label": `Начало: ${name}, интервал ${index + 1}`,
                                                            value: row.timeFrom,
                                                            onChange: (event)=>setRows((all)=>all.map((item)=>item.key === row.key ? {
                                                                            ...item,
                                                                            timeFrom: event.target.value
                                                                        } : item))
                                                        }, void 0, false, {
                                                            fileName: "[project]/wt-personnel/apps/web/src/app/beauty-settings/hours-form.tsx",
                                                            lineNumber: 70,
                                                            columnNumber: 23
                                                        }, this)
                                                    }, void 0, false, {
                                                        fileName: "[project]/wt-personnel/apps/web/src/app/beauty-settings/hours-form.tsx",
                                                        lineNumber: 69,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                                                        label: "До",
                                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                                            type: "time",
                                                            required: true,
                                                            "aria-label": `Конец: ${name}, интервал ${index + 1}`,
                                                            value: row.timeTo,
                                                            onChange: (event)=>setRows((all)=>all.map((item)=>item.key === row.key ? {
                                                                            ...item,
                                                                            timeTo: event.target.value
                                                                        } : item))
                                                        }, void 0, false, {
                                                            fileName: "[project]/wt-personnel/apps/web/src/app/beauty-settings/hours-form.tsx",
                                                            lineNumber: 87,
                                                            columnNumber: 23
                                                        }, this)
                                                    }, void 0, false, {
                                                        fileName: "[project]/wt-personnel/apps/web/src/app/beauty-settings/hours-form.tsx",
                                                        lineNumber: 86,
                                                        columnNumber: 21
                                                    }, this),
                                                    canEdit && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                                        type: "button",
                                                        tone: "ghost",
                                                        onClick: ()=>setRows((all)=>all.filter((item)=>item.key !== row.key)),
                                                        "aria-label": `Удалить интервал ${index + 1}: ${name}`,
                                                        children: "Удалить"
                                                    }, void 0, false, {
                                                        fileName: "[project]/wt-personnel/apps/web/src/app/beauty-settings/hours-form.tsx",
                                                        lineNumber: 102,
                                                        columnNumber: 23
                                                    }, this)
                                                ]
                                            }, row.key, true, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/beauty-settings/hours-form.tsx",
                                                lineNumber: 68,
                                                columnNumber: 19
                                            }, this))
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/beauty-settings/hours-form.tsx",
                                    lineNumber: 65,
                                    columnNumber: 15
                                }, this),
                                canEdit && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                    type: "button",
                                    tone: "secondary",
                                    disabled: own.length >= 4,
                                    onClick: ()=>setRows((all)=>[
                                                ...all,
                                                {
                                                    key: nextKey.current++,
                                                    weekday,
                                                    timeFrom: '',
                                                    timeTo: ''
                                                }
                                            ]),
                                    "aria-label": `Добавить интервал: ${name}`,
                                    children: "Добавить интервал"
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/beauty-settings/hours-form.tsx",
                                    lineNumber: 115,
                                    columnNumber: 17
                                }, this)
                            ]
                        }, weekday, true, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/beauty-settings/hours-form.tsx",
                            lineNumber: 63,
                            columnNumber: 13
                        }, this);
                    })
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/beauty-settings/hours-form.tsx",
                lineNumber: 58,
                columnNumber: 7
            }, this),
            canEdit && !rows.length && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                children: "Если сохранить пустой график, все дни станут выходными для новых записей."
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/beauty-settings/hours-form.tsx",
                lineNumber: 135,
                columnNumber: 9
            }, this),
            state?.error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Alert"], {
                children: state.error
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/beauty-settings/hours-form.tsx",
                lineNumber: 137,
                columnNumber: 24
            }, this),
            state?.data && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Alert"], {
                tone: "success",
                children: "Режим работы сохранён. Существующие записи не перенесены."
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/beauty-settings/hours-form.tsx",
                lineNumber: 139,
                columnNumber: 9
            }, this),
            canEdit && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                type: "submit",
                disabled: pending,
                children: pending ? 'Сохраняем…' : 'Сохранить режим'
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/beauty-settings/hours-form.tsx",
                lineNumber: 142,
                columnNumber: 9
            }, this),
            data.conflicts.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                "aria-label": "Записи вне нового режима",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                        children: "Записи вне режима работы"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/beauty-settings/hours-form.tsx",
                        lineNumber: 148,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        children: "Проверьте эти визиты. Их время сохранено."
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/beauty-settings/hours-form.tsx",
                        lineNumber: 149,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                        children: data.conflicts.map((visit)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                    href: `/calendar?date=${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$beauty$2f$time$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["localInput"])(visit.startsAt, data.location.timezone).slice(0, 10)}&appointment=${visit.id}`,
                                    children: [
                                        visit.customerName,
                                        ",",
                                        ' ',
                                        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$beauty$2f$time$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["localInput"])(visit.startsAt, data.location.timezone).replace('T', ' ')
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/beauty-settings/hours-form.tsx",
                                    lineNumber: 153,
                                    columnNumber: 17
                                }, this)
                            }, visit.id, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/beauty-settings/hours-form.tsx",
                                lineNumber: 152,
                                columnNumber: 15
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/beauty-settings/hours-form.tsx",
                        lineNumber: 150,
                        columnNumber: 11
                    }, this),
                    data.conflictsTruncated && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        children: "Показаны первые 100 конфликтов. Проверьте остальные записи в журнале."
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/beauty-settings/hours-form.tsx",
                        lineNumber: 163,
                        columnNumber: 13
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/beauty-settings/hours-form.tsx",
                lineNumber: 147,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/beauty-settings/hours-form.tsx",
        lineNumber: 40,
        columnNumber: 5
    }, this);
}
_s(SalonHoursForm, "E9FAuBQFvOW1Uy0zky41egSSYtk=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useActionState"]
    ];
});
_c = SalonHoursForm;
var _c;
__turbopack_context__.k.register(_c, "SalonHoursForm");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
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

//# sourceMappingURL=wt-personnel_apps_web_src_16zm7zj._.js.map