(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AiChat",
    ()=>AiChat,
    "BuildProgress",
    ()=>BuildProgress,
    "DesignCards",
    ()=>DesignCards,
    "errorText",
    ()=>errorText
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/index.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$generation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/generation.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$edit$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/edit.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$builder$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/builder.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/ui.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$run$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/site/editor/run.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature(), _s2 = __turbopack_context__.k.signature(), _s3 = __turbopack_context__.k.signature(), _s4 = __turbopack_context__.k.signature();
'use client';
;
;
;
;
;
const MODES = [
    [
        'CHAT',
        'Чат'
    ],
    [
        'PLAN',
        'План'
    ],
    [
        'BUILD',
        'Сборка'
    ]
];
const LABEL = {
    CHAT: 'Спросите ИИ о сайте',
    PLAN: 'Что вы хотите получить?',
    BUILD: 'Что изменить на сайте?'
};
function errorText(code) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$generation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isGenerationErrorCode"])(code) ? __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$generation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["GENERATION_ERROR_TEXT"][code] : 'ИИ не смог выполнить задачу';
}
const active = (item)=>item.status === 'QUEUED' || item.status === 'RUNNING';
function BuildProgress({ startedAt }) {
    _s();
    const [now, setNow] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        "BuildProgress.useState": ()=>Date.now()
    }["BuildProgress.useState"]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "BuildProgress.useEffect": ()=>{
            const timer = setInterval({
                "BuildProgress.useEffect.timer": ()=>setNow(Date.now())
            }["BuildProgress.useEffect.timer"], 1500);
            return ({
                "BuildProgress.useEffect": ()=>clearInterval(timer)
            })["BuildProgress.useEffect"];
        }
    }["BuildProgress.useEffect"], []);
    const step = Math.min(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$run$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BUILD_STEPS"].length - 1, Math.floor((now - startedAt) / 4000));
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ol", {
        className: "ed-steps",
        "aria-label": "Ход сборки",
        "data-testid": "ed-build-steps",
        children: __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$run$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BUILD_STEPS"].map((label, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cx"])('ed-steps__item', i < step && 'is-done', i === step && 'is-active'),
                "aria-current": i === step ? 'step' : undefined,
                children: label
            }, label, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                lineNumber: 43,
                columnNumber: 9
            }, this))
    }, void 0, false, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
        lineNumber: 41,
        columnNumber: 5
    }, this);
}
_s(BuildProgress, "2IU6yg86GfAIPaiHfn+vZjj7R4s=");
_c = BuildProgress;
function DesignCards({ directions, actionLabel, disabled, onChoose }) {
    _s1();
    const name = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useId"])();
    const [chosen, setChosen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(directions[0]?.id ?? '');
    const picked = directions.find((d)=>d.id === chosen);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("fieldset", {
        className: "ed-design",
        "data-testid": "ed-design",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("legend", {
                className: "ed-design__legend",
                children: "Выберите оформление"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                lineNumber: 68,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "ed-design__cards",
                children: directions.map((d)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cx"])('ed-design__card', chosen === d.id && 'is-on'),
                        "data-testid": "ed-design-card",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                type: "radio",
                                name: name,
                                value: d.id,
                                checked: chosen === d.id,
                                onChange: ()=>setChosen(d.id),
                                className: "ed-design__radio"
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                                lineNumber: 72,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cx"])('ed-design__swatch', `is-${d.theme.preset.toLowerCase()}`),
                                "aria-hidden": "true"
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                                lineNumber: 73,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("b", {
                                children: d.name
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                                lineNumber: 74,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "muted",
                                children: d.shortDescription
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                                lineNumber: 75,
                                columnNumber: 13
                            }, this)
                        ]
                    }, d.id, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                        lineNumber: 71,
                        columnNumber: 11
                    }, this))
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                lineNumber: 69,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                type: "button",
                disabled: disabled || !picked,
                onClick: ()=>picked && onChoose(picked),
                "data-testid": "ed-design-apply",
                children: actionLabel
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                lineNumber: 79,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
        lineNumber: 67,
        columnNumber: 5
    }, this);
}
_s1(DesignCards, "P5fmw3KUmUP7uNTah2z9SbeMfjY=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useId"]
    ];
});
_c1 = DesignCards;
function Questions({ payload, disabled, onAnswer }) {
    _s2();
    const [answers, setAnswers] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({});
    const [custom, setCustom] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({});
    const value = (id)=>answers[id] === '__custom' ? (custom[id] ?? '').trim() : answers[id] ?? '';
    const ready = payload.questions.every((q)=>value(q.id));
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
        className: "ed-questions",
        "data-testid": "ed-questions",
        onSubmit: (e)=>{
            e.preventDefault();
            if (ready) onAnswer(payload.questions.map((q)=>({
                    questionId: q.id,
                    answer: value(q.id)
                })));
        },
        children: [
            payload.questions.map((q)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("fieldset", {
                    className: "ed-questions__q",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("legend", {
                            children: q.question
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                            lineNumber: 110,
                            columnNumber: 11
                        }, this),
                        q.options.map((option)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                className: "ed-questions__option",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                        type: "radio",
                                        name: `q-${q.id}`,
                                        value: option,
                                        checked: answers[q.id] === option,
                                        onChange: ()=>setAnswers((a)=>({
                                                    ...a,
                                                    [q.id]: option
                                                }))
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                                        lineNumber: 113,
                                        columnNumber: 15
                                    }, this),
                                    option
                                ]
                            }, option, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                                lineNumber: 112,
                                columnNumber: 13
                            }, this)),
                        q.allowCustom && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                            className: "ed-questions__option",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                    type: "radio",
                                    name: `q-${q.id}`,
                                    value: "__custom",
                                    checked: answers[q.id] === '__custom',
                                    onChange: ()=>setAnswers((a)=>({
                                                ...a,
                                                [q.id]: '__custom'
                                            }))
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                                    lineNumber: 119,
                                    columnNumber: 15
                                }, this),
                                "Свой ответ"
                            ]
                        }, void 0, true, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                            lineNumber: 118,
                            columnNumber: 13
                        }, this),
                        answers[q.id] === '__custom' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                            label: "Ваш ответ",
                            controlId: `q-${q.id}-custom`,
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                id: `q-${q.id}-custom`,
                                className: "inp",
                                maxLength: 400,
                                value: custom[q.id] ?? '',
                                onChange: (e)=>setCustom((c)=>({
                                            ...c,
                                            [q.id]: e.currentTarget.value
                                        }))
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                                lineNumber: 125,
                                columnNumber: 15
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                            lineNumber: 124,
                            columnNumber: 13
                        }, this)
                    ]
                }, q.id, true, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                    lineNumber: 109,
                    columnNumber: 9
                }, this)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                type: "submit",
                size: "sm",
                disabled: disabled || !ready,
                "data-testid": "ed-questions-send",
                children: "Ответить"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                lineNumber: 130,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
        lineNumber: 100,
        columnNumber: 5
    }, this);
}
_s2(Questions, "LWmBoXSD5try5fgxAsNPb3z1iOQ=");
_c2 = Questions;
function Plan({ payload, disabled, onApprove }) {
    _s3();
    const [instruction, setInstruction] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(payload.buildInstruction);
    const [closed, setClosed] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "ed-plan",
        "data-testid": "ed-plan",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("b", {
                    children: payload.summary
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                    lineNumber: 151,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                lineNumber: 150,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ol", {
                className: "ed-plan__steps",
                children: payload.steps.map((s)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                        children: s
                    }, s, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                        lineNumber: 155,
                        columnNumber: 11
                    }, this))
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                lineNumber: 153,
                columnNumber: 7
            }, this),
            payload.tradeoffs.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "muted",
                children: [
                    "Чем придётся пожертвовать: ",
                    payload.tradeoffs.join('; ')
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                lineNumber: 159,
                columnNumber: 9
            }, this),
            closed ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "muted",
                "data-testid": "ed-plan-closed",
                children: "План отменён: сайт не менялся."
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                lineNumber: 164,
                columnNumber: 9
            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                        label: "Что ИИ сделает при сборке",
                        controlId: `plan-${payload.summary.length}`,
                        hint: "Можно поправить перед сборкой.",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Textarea"], {
                            rows: 3,
                            maxLength: __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$edit$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PATCH_INSTRUCTION_MAX"],
                            value: instruction,
                            disabled: disabled,
                            onChange: (e)=>setInstruction(e.currentTarget.value)
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                            lineNumber: 170,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                        lineNumber: 169,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "ed-row",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                type: "button",
                                size: "sm",
                                disabled: disabled || !instruction.trim(),
                                onClick: ()=>onApprove(instruction),
                                "data-testid": "ed-plan-approve",
                                children: "Собрать по плану"
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                                lineNumber: 173,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                type: "button",
                                tone: "ghost",
                                size: "sm",
                                onClick: ()=>setClosed(true),
                                "data-testid": "ed-plan-cancel",
                                children: "Отменить"
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                                lineNumber: 176,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                        lineNumber: 172,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                lineNumber: 168,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
        lineNumber: 149,
        columnNumber: 5
    }, this);
}
_s3(Plan, "6/W0e4IKBFKsU+k/0TL6u/7Xd/0=");
_c3 = Plan;
function AiChat({ canPublish = true, items, revisionOf, mode, setMode, target, onClearTarget, dirty, readOnly, busy, onSend, onAnswer, onApprove, onApplyDesign, onShowChanges, onUndo, text, setText, error }) {
    _s4();
    const list = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const [startedAt] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        "AiChat.useState": ()=>new Map()
    }["AiChat.useState"]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "AiChat.useEffect": ()=>{
            list.current?.lastElementChild?.scrollIntoView?.({
                block: 'nearest'
            });
        }
    }["AiChat.useEffect"], [
        items.length
    ]);
    const building = mode === 'BUILD';
    const max = building ? target ? __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$edit$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SECTION_INSTRUCTION_MAX"] : __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$edit$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PATCH_INSTRUCTION_MAX"] : __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$builder$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SITE_AI_USER_TEXT_MAX"];
    const empty = !(building && target) && !text.trim();
    const blocked = readOnly ? 'Только чтение' : busy ? 'ИИ ещё работает над прошлым запросом' : null;
    const send = ()=>{
        if (blocked || empty) return;
        onSend(text);
    };
    const lastDone = [
        ...items
    ].reverse().find((i)=>i.kind === 'BUILD' && i.status === 'SUCCEEDED' && i.outputVersionId);
    const lastId = items.at(-1)?.id;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "ed-chat",
        "data-testid": "ed-ai",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "ed-modes",
                role: "radiogroup",
                "aria-label": "Режим ИИ",
                "data-testid": "ed-modes",
                children: MODES.map(([key, label])=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        role: "radio",
                        "aria-checked": mode === key,
                        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cx"])('ed-modes__btn', mode === key && 'is-on'),
                        onClick: ()=>setMode(key),
                        children: label
                    }, key, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                        lineNumber: 248,
                        columnNumber: 11
                    }, this))
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                lineNumber: 246,
                columnNumber: 7
            }, this),
            items.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "ed-chat__empty",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("b", {
                            children: "Напишите, что поменять на сайте."
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                            lineNumber: 256,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                        lineNumber: 255,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "muted",
                        children: "«Сборка» меняет сайт, «План» сначала договаривается, что делать, «Чат» просто отвечает. Чтобы изменить один блок, щёлкните его на сайте справа."
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                        lineNumber: 258,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "muted",
                        children: "ИИ не меняет название, контакты, языки, бронирование и SEO, не придумывает цены и не публикует сайт."
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                        lineNumber: 261,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                lineNumber: 254,
                columnNumber: 9
            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ol", {
                className: "ed-chat__feed",
                ref: list,
                "aria-label": "Разговор с ИИ",
                "data-testid": "ed-feed",
                children: items.map((item)=>{
                    const payload = item.payload;
                    const revision = revisionOf(item.outputVersionId);
                    if (active(item) && !startedAt.has(item.id)) startedAt.set(item.id, Date.now());
                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                        className: "ed-chat__item",
                        "data-testid": "ed-feed-item",
                        "data-kind": item.kind,
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "ed-chat__ask",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "ed-chat__mode",
                                        children: item.kind === 'BUILD' ? item.fromPlanId ? 'Сборка по плану' : 'Сборка' : item.mode === 'CHAT' ? 'Чат' : item.mode === 'PLAN' ? 'План' : 'Оформление'
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                                        lineNumber: 272,
                                        columnNumber: 19
                                    }, this),
                                    item.userText ?? (item.target ? 'Обновить блок' : '')
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                                lineNumber: 271,
                                columnNumber: 17
                            }, this),
                            active(item) && (item.kind === 'BUILD' ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "ed-chat__reply",
                                role: "status",
                                "data-testid": "ed-ai-state",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(BuildProgress, {
                                        startedAt: startedAt.get(item.id) ?? Date.now()
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                                        lineNumber: 278,
                                        columnNumber: 23
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "muted",
                                        children: "Если сохранить изменения сейчас, результат ИИ не применится."
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                                        lineNumber: 279,
                                        columnNumber: 23
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                                lineNumber: 277,
                                columnNumber: 21
                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "ed-chat__reply",
                                role: "status",
                                "data-testid": "ed-ai-state",
                                children: "ИИ думает над ответом"
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                                lineNumber: 282,
                                columnNumber: 21
                            }, this)),
                            item.status === 'FAILED' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "ed-chat__reply ed-chat__reply--error",
                                role: "alert",
                                "data-testid": "ed-ai-error",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        children: errorText(item.errorCode)
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                                        lineNumber: 288,
                                        columnNumber: 21
                                    }, this),
                                    item.userText && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                        type: "button",
                                        tone: "ghost",
                                        size: "sm",
                                        onClick: ()=>setText(item.userText ?? ''),
                                        children: "Повторить запрос"
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                                        lineNumber: 290,
                                        columnNumber: 23
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                                lineNumber: 287,
                                columnNumber: 19
                            }, this),
                            item.status === 'SUCCEEDED' && item.kind === 'BUILD' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "ed-chat__reply",
                                "data-testid": "ed-ai-done",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        children: [
                                            "Готово: ИИ создал версию ",
                                            revision ?? '',
                                            ". Сайт справа уже с правками."
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                                        lineNumber: 298,
                                        columnNumber: 21
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "ed-row",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                                type: "button",
                                                tone: "secondary",
                                                size: "sm",
                                                onClick: ()=>onShowChanges(item),
                                                children: "Что изменилось"
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                                                lineNumber: 300,
                                                columnNumber: 23
                                            }, this),
                                            item.id === lastDone?.id && item.baseVersionId && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                                type: "button",
                                                tone: "ghost",
                                                size: "sm",
                                                disabled: readOnly || busy,
                                                onClick: ()=>onUndo(item),
                                                children: "Вернуть как было"
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                                                lineNumber: 304,
                                                columnNumber: 25
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                                        lineNumber: 299,
                                        columnNumber: 21
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                                lineNumber: 297,
                                columnNumber: 19
                            }, this),
                            item.status === 'SUCCEEDED' && payload?.kind === 'CHAT' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "ed-chat__reply",
                                "data-testid": "ed-ai-answer",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        children: item.assistantText
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                                        lineNumber: 313,
                                        columnNumber: 21
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "ed-row",
                                        children: [
                                            payload.suggestBuild && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                                type: "button",
                                                tone: "secondary",
                                                size: "sm",
                                                disabled: readOnly,
                                                onClick: ()=>{
                                                    setMode('BUILD');
                                                    setText(item.userText ?? '');
                                                },
                                                "data-testid": "ed-go-build",
                                                children: "Перейти в сборку"
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                                                lineNumber: 316,
                                                columnNumber: 25
                                            }, this),
                                            payload.suggestPublish && canPublish && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                                className: "btn btn--secondary btn--sm",
                                                href: "/marketing/site",
                                                "data-testid": "ed-go-publish",
                                                children: "Перейти к публикации"
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                                                lineNumber: 331,
                                                columnNumber: 25
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                                        lineNumber: 314,
                                        columnNumber: 21
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                                lineNumber: 312,
                                columnNumber: 19
                            }, this),
                            item.status === 'SUCCEEDED' && payload?.kind === 'QUESTIONS' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "ed-chat__reply",
                                children: [
                                    item.assistantText && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        children: item.assistantText
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                                        lineNumber: 340,
                                        columnNumber: 44
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Questions, {
                                        payload: payload,
                                        disabled: readOnly || busy || item.id !== lastId,
                                        onAnswer: (answers)=>onAnswer(item.id, answers)
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                                        lineNumber: 341,
                                        columnNumber: 21
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                                lineNumber: 339,
                                columnNumber: 19
                            }, this),
                            item.status === 'SUCCEEDED' && payload?.kind === 'PLAN' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "ed-chat__reply",
                                children: items.some((b)=>b.fromPlanId === item.id) ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    "data-testid": "ed-plan-done",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("b", {
                                            children: payload.summary
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                                            lineNumber: 348,
                                            columnNumber: 25
                                        }, this),
                                        ": собрано по этому плану."
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                                    lineNumber: 347,
                                    columnNumber: 23
                                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Plan, {
                                    payload: payload,
                                    disabled: readOnly || busy,
                                    onApprove: (instruction)=>onApprove(item.id, instruction)
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                                    lineNumber: 351,
                                    columnNumber: 23
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                                lineNumber: 345,
                                columnNumber: 19
                            }, this),
                            item.status === 'SUCCEEDED' && payload?.kind === 'DESIGN' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "ed-chat__reply",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(DesignCards, {
                                    directions: payload.directions,
                                    actionLabel: "Применить оформление",
                                    disabled: readOnly,
                                    onChoose: onApplyDesign
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                                    lineNumber: 357,
                                    columnNumber: 21
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                                lineNumber: 356,
                                columnNumber: 19
                            }, this)
                        ]
                    }, item.id, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                        lineNumber: 270,
                        columnNumber: 15
                    }, this);
                })
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                lineNumber: 264,
                columnNumber: 9
            }, this),
            error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "ed-error",
                role: "alert",
                "data-testid": "ed-ai-send-error",
                children: error
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                lineNumber: 366,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
                className: "ed-chat__composer",
                onSubmit: (ev)=>{
                    ev.preventDefault();
                    send();
                },
                children: [
                    building && target && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "ed-chat__chip",
                        "data-testid": "ed-ai-target",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: [
                                    "Блок «",
                                    target,
                                    "»"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                                lineNumber: 379,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                type: "button",
                                tone: "ghost",
                                size: "sm",
                                "aria-label": "Убрать блок: изменить весь сайт",
                                onClick: onClearTarget,
                                children: "Весь сайт"
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                                lineNumber: 380,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                        lineNumber: 378,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                        label: building && target ? 'Что изменить в этом блоке?' : LABEL[mode],
                        controlId: "ed-ai-text",
                        hint: blocked ?? (building && target ? 'Можно оставить пустым: ИИ перепишет блок, сохранив его назначение.' : 'Ctrl+Enter отправляет.'),
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Textarea"], {
                            rows: 3,
                            maxLength: max,
                            value: text,
                            disabled: readOnly,
                            onChange: (e)=>setText(e.currentTarget.value),
                            onKeyDown: (e)=>{
                                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                    e.preventDefault();
                                    send();
                                }
                            }
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                            lineNumber: 390,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                        lineNumber: 385,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                        type: "submit",
                        disabled: !!blocked || empty,
                        "data-testid": "ed-ai-send",
                        children: building ? dirty ? 'Сохранить и отправить' : 'Отправить' : mode === 'PLAN' ? 'Составить план' : 'Спросить'
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                        lineNumber: 404,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
                lineNumber: 370,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx",
        lineNumber: 245,
        columnNumber: 5
    }, this);
}
_s4(AiChat, "jeBKfOAt9JINt9TKFgf+6bvIGos=");
_c4 = AiChat;
var _c, _c1, _c2, _c3, _c4;
__turbopack_context__.k.register(_c, "BuildProgress");
__turbopack_context__.k.register(_c1, "DesignCards");
__turbopack_context__.k.register(_c2, "Questions");
__turbopack_context__.k.register(_c3, "Plan");
__turbopack_context__.k.register(_c4, "AiChat");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/app/marketing/site/editor/create-site.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CreateSite",
    ()=>CreateSite
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/index.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$edit$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/edit.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$templates$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/site-templates.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$chip$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/chip.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/ui.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$use$2d$dictation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/use-dictation.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$vertical$2d$copy$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/vertical-copy.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$data$3a$57e99b__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/site/editor/data:57e99b [app-client] (ecmascript) <text/javascript>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$data$3a$7413b5__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/site/editor/data:7413b5 [app-client] (ecmascript) <text/javascript>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$ai$2d$chat$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$template$2d$gallery$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/site/editor/template-gallery.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$location$2d$picker$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/site/editor/location-picker.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$run$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/site/editor/run.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$site$2d$facts$2d$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/site/editor/site-facts-card.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$vertical$2d$status$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/site/editor/vertical-status.ts [app-client] (ecmascript)");
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
;
;
;
;
;
function CreateSite({ vertical, locationName, locationId, briefHash, facts, locations, readOnly }) {
    _s();
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"])();
    const copy = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$vertical$2d$copy$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["verticalCopy"])(vertical);
    const [text, setText] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    const [phase, setPhase] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('idle');
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [pending, setPending] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [startedAt, setStartedAt] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(0);
    const templates = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "CreateSite.useMemo[templates]": ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$templates$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["siteTemplatesFor"])(vertical)
    }["CreateSite.useMemo[templates]"], [
        vertical
    ]);
    const [chosen, setChosen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        "CreateSite.useState": ()=>templates[0]?.id ?? ''
    }["CreateSite.useState"]);
    const [lang, setLang] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('ru-RU');
    const dictation = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$use$2d$dictation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useDictation"])({
        lang,
        onText: {
            "CreateSite.useDictation[dictation]": (phrase)=>setText({
                    "CreateSite.useDictation[dictation]": (previous)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$use$2d$dictation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["appendDictated"])(previous, phrase, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$edit$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PATCH_INSTRUCTION_MAX"])
                }["CreateSite.useDictation[dictation]"])
        }["CreateSite.useDictation[dictation]"],
        onError: setError
    });
    const template = templates.find((x)=>x.id === chosen) ?? templates[0];
    // превью рисуется из фактов; без них из имени филиала, без каталога
    const previewFacts = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "CreateSite.useMemo[previewFacts]": ()=>facts.ok ? facts.data : {
                vertical,
                location: {
                    id: locationId ?? '',
                    name: locationName,
                    address: null,
                    phone: null,
                    whatsapp: null,
                    city: null
                },
                catalog: {
                    kind: vertical === 'BEAUTY' ? 'services' : vertical === 'FOOD_SERVICE' ? 'menu' : 'rooms',
                    items: []
                },
                staff: [],
                hours: {
                    days: [],
                    checkInTime: null,
                    checkOutTime: null
                },
                photosCount: 0,
                reviews: null,
                gaps: []
            }
    }["CreateSite.useMemo[previewFacts]"], [
        facts,
        vertical,
        locationId,
        locationName
    ]);
    const job = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$run$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGenerationRun"])({
        "CreateSite.useGenerationRun[job]": (run)=>{
            if (run.status === 'SUCCEEDED') {
                setPhase('done');
                router.refresh();
            } else {
                setPhase('idle');
                setError((0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$run$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["runErrorText"])(run));
            }
        }
    }["CreateSite.useGenerationRun[job]"]);
    const busy = pending || phase === 'starting' || phase === 'building' || phase === 'done';
    // Главный путь: шаблон без ИИ. Сайт и первая версия появляются сразу, страница перечитывается и открывает редактор
    const create = async ()=>{
        if (readOnly || busy) return;
        dictation.stop();
        setError(null);
        setPhase('starting');
        setPending(true);
        try {
            const reply = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$data$3a$57e99b__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__["createFromTemplateAction"])(template.id);
            if (!reply.ok) {
                setPhase('idle');
                setError((0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$vertical$2d$status$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createErrorText"])(vertical, reply));
                return;
            }
            setPhase('done');
            router.refresh();
        } finally{
            setPending(false);
        }
    };
    // Необязательный путь: первая сборка ИИ по описанию человека, с выбранным шаблоном как оформлением
    const selected = ()=>({
            presetId: template.id
        });
    const build = async ()=>{
        if (readOnly || busy) return;
        dictation.stop();
        setError(null);
        setPhase('starting');
        setPending(true);
        try {
            const reply = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$data$3a$7413b5__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__["createSiteAction"])({
                briefHash,
                instruction: text,
                design: selected()
            });
            if (!reply.ok) {
                setPhase('idle');
                setError((0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$vertical$2d$status$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createErrorText"])(vertical, reply));
                return;
            }
            setStartedAt(Date.now());
            setPhase('building');
            job.start(reply.run);
        } finally{
            setPending(false);
        }
    };
    const toggleChip = (chip)=>{
        setText((previous)=>{
            if (previous.includes(chip)) return previous.replace(chip, '').replace(/\s*\.\s*\./g, '.').replace(/^[\s.]+|[\s.]+$/g, '').trim();
            const base = previous.trim();
            return `${base}${base && !/[.!?]$/.test(base) ? '. ' : base ? ' ' : ''}${chip}`.slice(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$edit$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PATCH_INSTRUCTION_MAX"]);
        });
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        className: "site-start",
        "aria-labelledby": "create-site-title",
        "data-testid": "create-site",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("header", {
                className: "site-start__head",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                        id: "create-site-title",
                        className: "site-start__title",
                        children: [
                            "Сайт для ",
                            locationName
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/create-site.tsx",
                        lineNumber: 149,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "muted",
                        children: "Выберите филиал и один из трёх готовых шаблонов: сайт соберётся сразу из данных филиала, без ИИ. Дальше всё правится в редакторе."
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/create-site.tsx",
                        lineNumber: 152,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/create-site.tsx",
                lineNumber: 148,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "site-start__grid",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$location$2d$picker$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["LocationPicker"], {
                        locations: locations,
                        currentId: locationId
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/create-site.tsx",
                        lineNumber: 156,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
                        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cx"])('site-chat', busy && 'is-busy'),
                        "aria-labelledby": "site-chat-title",
                        onSubmit: (e)=>{
                            e.preventDefault();
                            void (text.trim() ? build() : create());
                        },
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                id: "site-chat-title",
                                className: "site-start__step",
                                children: "Пожелания для ИИ (необязательно)"
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/create-site.tsx",
                                lineNumber: 166,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                htmlFor: "create-site-text",
                                className: "sr-only",
                                children: "Опишите, каким должен быть сайт"
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/create-site.tsx",
                                lineNumber: 169,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("textarea", {
                                id: "create-site-text",
                                rows: 5,
                                maxLength: __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$edit$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PATCH_INSTRUCTION_MAX"],
                                className: "site-chat__text",
                                placeholder: "Например: спокойный сайт, акцент на тишину и чистоту, дружелюбный тон",
                                value: text,
                                disabled: busy || readOnly,
                                "aria-describedby": "site-chat-hint",
                                onChange: (e)=>setText(e.currentTarget.value),
                                onKeyDown: (e)=>{
                                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                        e.preventDefault();
                                        if (text.trim()) void build();
                                    }
                                }
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/create-site.tsx",
                                lineNumber: 172,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$chip$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ChipGroup"], {
                                label: "Подсказки",
                                className: "site-chat__chips",
                                children: copy.siteChips.map((chip)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$chip$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Chip"], {
                                        selected: text.includes(chip),
                                        disabled: busy || readOnly,
                                        onClick: ()=>toggleChip(chip),
                                        "data-testid": "site-chip",
                                        children: chip
                                    }, chip, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/create-site.tsx",
                                        lineNumber: 191,
                                        columnNumber: 15
                                    }, this))
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/create-site.tsx",
                                lineNumber: 189,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "site-chat__bar",
                                children: [
                                    dictation.supported && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "site-chat__voice",
                                        "data-testid": "site-voice",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                                type: "button",
                                                tone: "secondary",
                                                "aria-pressed": dictation.listening,
                                                disabled: busy || readOnly,
                                                onClick: ()=>{
                                                    if (!dictation.listening) setError(null);
                                                    dictation.toggle();
                                                },
                                                "data-testid": "site-mic",
                                                children: dictation.listening ? 'Остановить диктовку' : 'Надиктовать'
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/create-site.tsx",
                                                lineNumber: 199,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                className: "sr-only",
                                                htmlFor: "site-dictation-lang",
                                                children: "Язык диктовки"
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/create-site.tsx",
                                                lineNumber: 212,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Select"], {
                                                id: "site-dictation-lang",
                                                value: lang,
                                                disabled: dictation.listening || busy,
                                                onChange: (e)=>setLang(e.currentTarget.value),
                                                className: "site-chat__lang",
                                                children: __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$use$2d$dictation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DICTATION_LANGS"].map((l)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                        value: l.value,
                                                        children: l.label
                                                    }, l.value, false, {
                                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/create-site.tsx",
                                                        lineNumber: 217,
                                                        columnNumber: 21
                                                    }, this))
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/create-site.tsx",
                                                lineNumber: 215,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "muted",
                                                "aria-live": "polite",
                                                children: dictation.listening ? 'Слушаю…' : ''
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/create-site.tsx",
                                                lineNumber: 222,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/create-site.tsx",
                                        lineNumber: 198,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        id: "site-chat-hint",
                                        className: "muted",
                                        children: "Без текста сайт создаётся по шаблону сразу. С текстом ИИ доработает выбранный шаблон под ваши пожелания (Ctrl+Enter)."
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/create-site.tsx",
                                        lineNumber: 227,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/create-site.tsx",
                                lineNumber: 196,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/create-site.tsx",
                        lineNumber: 158,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$site$2d$facts$2d$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SiteFactsCard"], {
                        vertical: vertical,
                        facts: facts
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/create-site.tsx",
                        lineNumber: 233,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("fieldset", {
                        className: "site-start__designs",
                        "aria-describedby": "site-designs-hint",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("legend", {
                                className: "site-start__step",
                                children: "Шаблон сайта"
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/create-site.tsx",
                                lineNumber: 236,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                id: "site-designs-hint",
                                className: "muted",
                                children: [
                                    "Три готовых сайта для ",
                                    copy.businessesOf,
                                    ". Превью собрано из данных филиала: что видно, то и получится."
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/create-site.tsx",
                                lineNumber: 237,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$template$2d$gallery$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TemplateGallery"], {
                                facts: previewFacts,
                                templates: templates,
                                chosen: template.id,
                                onChoose: setChosen,
                                disabled: busy
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/create-site.tsx",
                                lineNumber: 240,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "site-start__actions",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                        type: "button",
                                        tone: "secondary",
                                        disabled: busy || readOnly || !text.trim(),
                                        onClick: ()=>void build(),
                                        "data-testid": "create-site-ai",
                                        children: phase === 'building' ? 'ИИ собирает…' : 'Собрать с ИИ по описанию'
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/create-site.tsx",
                                        lineNumber: 242,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                        type: "button",
                                        disabled: busy || readOnly,
                                        "aria-busy": phase === 'starting' || undefined,
                                        onClick: ()=>void create(),
                                        "data-testid": "create-site-start",
                                        children: phase === 'starting' || phase === 'done' ? 'Создаём…' : 'Создать сайт'
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/create-site.tsx",
                                        lineNumber: 245,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/create-site.tsx",
                                lineNumber: 241,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "muted",
                                "data-testid": "site-design-chosen",
                                "aria-live": "polite",
                                children: [
                                    "Выбран шаблон «",
                                    template.name,
                                    "»."
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/create-site.tsx",
                                lineNumber: 249,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/create-site.tsx",
                        lineNumber: 235,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/create-site.tsx",
                lineNumber: 155,
                columnNumber: 7
            }, this),
            readOnly && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "muted",
                children: "Только чтение: создать сайт нельзя."
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/create-site.tsx",
                lineNumber: 255,
                columnNumber: 20
            }, this),
            error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Alert"], {
                boxed: true,
                "data-testid": "create-site-error",
                children: error
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/create-site.tsx",
                lineNumber: 257,
                columnNumber: 9
            }, this),
            phase === 'building' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                role: "status",
                "aria-live": "polite",
                "data-testid": "create-site-steps",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$ai$2d$chat$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BuildProgress"], {
                    startedAt: startedAt
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/create-site.tsx",
                    lineNumber: 263,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/create-site.tsx",
                lineNumber: 262,
                columnNumber: 9
            }, this),
            phase === 'done' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                role: "status",
                className: "muted",
                "data-testid": "create-site-done",
                children: "Сайт создан. Открываем редактор"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/create-site.tsx",
                lineNumber: 267,
                columnNumber: 9
            }, this),
            job.lost && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Alert"], {
                boxed: true,
                children: job.lost
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/create-site.tsx",
                lineNumber: 271,
                columnNumber: 20
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/create-site.tsx",
        lineNumber: 147,
        columnNumber: 5
    }, this);
}
_s(CreateSite, "DoOXTwevYRwk9jPXa0SmXtmQtGE=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"],
        __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$use$2d$dictation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useDictation"],
        __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$run$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGenerationRun"]
    ];
});
_c = CreateSite;
var _c;
__turbopack_context__.k.register(_c, "CreateSite");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/app/marketing/site/editor/data:03a38f [app-client] (ecmascript) <text/javascript>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "assistantAction",
    ()=>$$RSC_SERVER_ACTION_12
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-client-wrapper.js [app-client] (ecmascript)");
/* __next_internal_action_entry_do_not_use__ [{"407ea4da56bf7d1cfe21bafadc859abdb8a9506c7b":{"name":"assistantAction"}},"wt-personnel/apps/web/src/app/marketing/site/editor/actions.ts",""] */ "use turbopack no side effects";
;
const $$RSC_SERVER_ACTION_12 = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createServerReference"])("407ea4da56bf7d1cfe21bafadc859abdb8a9506c7b", __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["callServer"], void 0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["findSourceMapURL"], "assistantAction");
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/app/marketing/site/editor/data:063c1b [app-client] (ecmascript) <text/javascript>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "approvePlanAction",
    ()=>$$RSC_SERVER_ACTION_14
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-client-wrapper.js [app-client] (ecmascript)");
/* __next_internal_action_entry_do_not_use__ [{"60774c2cdea79a8d90779bf45de58aa9be74c292c6":{"name":"approvePlanAction"}},"wt-personnel/apps/web/src/app/marketing/site/editor/actions.ts",""] */ "use turbopack no side effects";
;
const $$RSC_SERVER_ACTION_14 = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createServerReference"])("60774c2cdea79a8d90779bf45de58aa9be74c292c6", __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["callServer"], void 0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["findSourceMapURL"], "approvePlanAction");
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/app/marketing/site/editor/data:2415f5 [app-client] (ecmascript) <text/javascript>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "conversationAction",
    ()=>$$RSC_SERVER_ACTION_15
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-client-wrapper.js [app-client] (ecmascript)");
/* __next_internal_action_entry_do_not_use__ [{"00ebb5c478b8bac0e65f6b0c39b1721b3be480d800":{"name":"conversationAction"}},"wt-personnel/apps/web/src/app/marketing/site/editor/actions.ts",""] */ "use turbopack no side effects";
;
const $$RSC_SERVER_ACTION_15 = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createServerReference"])("00ebb5c478b8bac0e65f6b0c39b1721b3be480d800", __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["callServer"], void 0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["findSourceMapURL"], "conversationAction");
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/app/marketing/site/editor/data:57e99b [app-client] (ecmascript) <text/javascript>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createFromTemplateAction",
    ()=>$$RSC_SERVER_ACTION_9
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-client-wrapper.js [app-client] (ecmascript)");
/* __next_internal_action_entry_do_not_use__ [{"4081becb0042da473a7563fe0126416592c2ca9ebe":{"name":"createFromTemplateAction"}},"wt-personnel/apps/web/src/app/marketing/site/editor/actions.ts",""] */ "use turbopack no side effects";
;
const $$RSC_SERVER_ACTION_9 = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createServerReference"])("4081becb0042da473a7563fe0126416592c2ca9ebe", __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["callServer"], void 0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["findSourceMapURL"], "createFromTemplateAction");
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/app/marketing/site/editor/data:652587 [app-client] (ecmascript) <text/javascript>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "versionsAction",
    ()=>$$RSC_SERVER_ACTION_2
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-client-wrapper.js [app-client] (ecmascript)");
/* __next_internal_action_entry_do_not_use__ [{"001a7d4c3ae8959e7e3022e9cb649e7634eb880b7f":{"name":"versionsAction"}},"wt-personnel/apps/web/src/app/marketing/site/editor/actions.ts",""] */ "use turbopack no side effects";
;
const $$RSC_SERVER_ACTION_2 = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createServerReference"])("001a7d4c3ae8959e7e3022e9cb649e7634eb880b7f", __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["callServer"], void 0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["findSourceMapURL"], "versionsAction");
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/app/marketing/site/editor/data:6e22ca [app-client] (ecmascript) <text/javascript>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "bookmarkAction",
    ()=>$$RSC_SERVER_ACTION_17
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-client-wrapper.js [app-client] (ecmascript)");
/* __next_internal_action_entry_do_not_use__ [{"60effe4ab97dc082d9056f84db1afa18043edb3727":{"name":"bookmarkAction"}},"wt-personnel/apps/web/src/app/marketing/site/editor/actions.ts",""] */ "use turbopack no side effects";
;
const $$RSC_SERVER_ACTION_17 = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createServerReference"])("60effe4ab97dc082d9056f84db1afa18043edb3727", __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["callServer"], void 0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["findSourceMapURL"], "bookmarkAction");
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/app/marketing/site/editor/data:7413b5 [app-client] (ecmascript) <text/javascript>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createSiteAction",
    ()=>$$RSC_SERVER_ACTION_8
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-client-wrapper.js [app-client] (ecmascript)");
/* __next_internal_action_entry_do_not_use__ [{"401353221f6c5c80268fc824069017281f10a9a27b":{"name":"createSiteAction"}},"wt-personnel/apps/web/src/app/marketing/site/editor/actions.ts",""] */ "use turbopack no side effects";
;
const $$RSC_SERVER_ACTION_8 = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createServerReference"])("401353221f6c5c80268fc824069017281f10a9a27b", __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["callServer"], void 0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["findSourceMapURL"], "createSiteAction");
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/app/marketing/site/editor/data:76f5cc [app-client] (ecmascript) <text/javascript>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "assistantRunAction",
    ()=>$$RSC_SERVER_ACTION_13
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-client-wrapper.js [app-client] (ecmascript)");
/* __next_internal_action_entry_do_not_use__ [{"40e55c19574da2edee9ed5e034c5823c638950b042":{"name":"assistantRunAction"}},"wt-personnel/apps/web/src/app/marketing/site/editor/actions.ts",""] */ "use turbopack no side effects";
;
const $$RSC_SERVER_ACTION_13 = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createServerReference"])("40e55c19574da2edee9ed5e034c5823c638950b042", __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["callServer"], void 0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["findSourceMapURL"], "assistantRunAction");
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/app/marketing/site/editor/data:826c4a [app-client] (ecmascript) <text/javascript>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "saveDraftAction",
    ()=>$$RSC_SERVER_ACTION_0
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-client-wrapper.js [app-client] (ecmascript)");
/* __next_internal_action_entry_do_not_use__ [{"60a2f6725a3291dd8e64d5f068c4382e8dcef705b4":{"name":"saveDraftAction"}},"wt-personnel/apps/web/src/app/marketing/site/editor/actions.ts",""] */ "use turbopack no side effects";
;
const $$RSC_SERVER_ACTION_0 = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createServerReference"])("60a2f6725a3291dd8e64d5f068c4382e8dcef705b4", __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["callServer"], void 0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["findSourceMapURL"], "saveDraftAction");
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/app/marketing/site/editor/data:9dfeb2 [app-client] (ecmascript) <text/javascript>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "uploadSitePhotoAction",
    ()=>$$RSC_SERVER_ACTION_19
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-client-wrapper.js [app-client] (ecmascript)");
/* __next_internal_action_entry_do_not_use__ [{"4080b9b451ea5cc93374902d731696823f79a17c8c":{"name":"uploadSitePhotoAction"}},"wt-personnel/apps/web/src/app/marketing/site/editor/actions.ts",""] */ "use turbopack no side effects";
;
const $$RSC_SERVER_ACTION_19 = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createServerReference"])("4080b9b451ea5cc93374902d731696823f79a17c8c", __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["callServer"], void 0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["findSourceMapURL"], "uploadSitePhotoAction");
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/app/marketing/site/editor/data:a91882 [app-client] (ecmascript) <text/javascript>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "restoreAction",
    ()=>$$RSC_SERVER_ACTION_4
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-client-wrapper.js [app-client] (ecmascript)");
/* __next_internal_action_entry_do_not_use__ [{"6086a98797250064ff51f29fbf579c9b5fb5ee1344":{"name":"restoreAction"}},"wt-personnel/apps/web/src/app/marketing/site/editor/actions.ts",""] */ "use turbopack no side effects";
;
const $$RSC_SERVER_ACTION_4 = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createServerReference"])("6086a98797250064ff51f29fbf579c9b5fb5ee1344", __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["callServer"], void 0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["findSourceMapURL"], "restoreAction");
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/app/marketing/site/editor/data:adddb1 [app-client] (ecmascript) <text/javascript>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "saveContextAction",
    ()=>$$RSC_SERVER_ACTION_16
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-client-wrapper.js [app-client] (ecmascript)");
/* __next_internal_action_entry_do_not_use__ [{"401b64881c2c904aef39072d4079583fa7bb90d6ad":{"name":"saveContextAction"}},"wt-personnel/apps/web/src/app/marketing/site/editor/actions.ts",""] */ "use turbopack no side effects";
;
const $$RSC_SERVER_ACTION_16 = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createServerReference"])("401b64881c2c904aef39072d4079583fa7bb90d6ad", __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["callServer"], void 0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["findSourceMapURL"], "saveContextAction");
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/app/marketing/site/editor/data:b7a5ca [app-client] (ecmascript) <text/javascript>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "sectionAction",
    ()=>$$RSC_SERVER_ACTION_7
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-client-wrapper.js [app-client] (ecmascript)");
/* __next_internal_action_entry_do_not_use__ [{"785715a80488f83e49eaaca78c6b167e1e0af0305b":{"name":"sectionAction"}},"wt-personnel/apps/web/src/app/marketing/site/editor/actions.ts",""] */ "use turbopack no side effects";
;
const $$RSC_SERVER_ACTION_7 = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createServerReference"])("785715a80488f83e49eaaca78c6b167e1e0af0305b", __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["callServer"], void 0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["findSourceMapURL"], "sectionAction");
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/app/marketing/site/editor/data:c131bd [app-client] (ecmascript) <text/javascript>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "publishSimpleAction",
    ()=>$$RSC_SERVER_ACTION_21
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-client-wrapper.js [app-client] (ecmascript)");
/* __next_internal_action_entry_do_not_use__ [{"401b09559e5bc95449e9ecec69d5744d09c555f7b4":{"name":"publishSimpleAction"}},"wt-personnel/apps/web/src/app/marketing/site/editor/actions.ts",""] */ "use turbopack no side effects";
;
const $$RSC_SERVER_ACTION_21 = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createServerReference"])("401b09559e5bc95449e9ecec69d5744d09c555f7b4", __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["callServer"], void 0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["findSourceMapURL"], "publishSimpleAction");
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/app/marketing/site/editor/data:d4a03c [app-client] (ecmascript) <text/javascript>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "runAction",
    ()=>$$RSC_SERVER_ACTION_18
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-client-wrapper.js [app-client] (ecmascript)");
/* __next_internal_action_entry_do_not_use__ [{"40a2466925104d38ea8605d0fed401ad7fa6d252bf":{"name":"runAction"}},"wt-personnel/apps/web/src/app/marketing/site/editor/actions.ts",""] */ "use turbopack no side effects";
;
const $$RSC_SERVER_ACTION_18 = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createServerReference"])("40a2466925104d38ea8605d0fed401ad7fa6d252bf", __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["callServer"], void 0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["findSourceMapURL"], "runAction");
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/app/marketing/site/editor/data:db6b31 [app-client] (ecmascript) <text/javascript>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "chooseSiteLocationAction",
    ()=>$$RSC_SERVER_ACTION_10
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-client-wrapper.js [app-client] (ecmascript)");
/* __next_internal_action_entry_do_not_use__ [{"40e8889380cd88c383646ab56d2e50580a96c0cd1d":{"name":"chooseSiteLocationAction"}},"wt-personnel/apps/web/src/app/marketing/site/editor/actions.ts",""] */ "use turbopack no side effects";
;
const $$RSC_SERVER_ACTION_10 = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createServerReference"])("40e8889380cd88c383646ab56d2e50580a96c0cd1d", __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["callServer"], void 0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["findSourceMapURL"], "chooseSiteLocationAction");
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/app/marketing/site/editor/data:f6c95e [app-client] (ecmascript) <text/javascript>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "diffAction",
    ()=>$$RSC_SERVER_ACTION_3
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-client-wrapper.js [app-client] (ecmascript)");
/* __next_internal_action_entry_do_not_use__ [{"60c7c4bd9311c812af3079f67f02316c4b907cfad6":{"name":"diffAction"}},"wt-personnel/apps/web/src/app/marketing/site/editor/actions.ts",""] */ "use turbopack no side effects";
;
const $$RSC_SERVER_ACTION_3 = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createServerReference"])("60c7c4bd9311c812af3079f67f02316c4b907cfad6", __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["callServer"], void 0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["findSourceMapURL"], "diffAction");
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/app/marketing/site/editor/data:f79428 [app-client] (ecmascript) <text/javascript>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "patchAction",
    ()=>$$RSC_SERVER_ACTION_6
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-client-wrapper.js [app-client] (ecmascript)");
/* __next_internal_action_entry_do_not_use__ [{"6090aab0c1b2e014085cb912772a722ec130e2b556":{"name":"patchAction"}},"wt-personnel/apps/web/src/app/marketing/site/editor/actions.ts",""] */ "use turbopack no side effects";
;
const $$RSC_SERVER_ACTION_6 = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createServerReference"])("6090aab0c1b2e014085cb912772a722ec130e2b556", __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["callServer"], void 0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["findSourceMapURL"], "patchAction");
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/app/marketing/site/editor/data:fbade0 [app-client] (ecmascript) <text/javascript>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "editorPreviewAction",
    ()=>$$RSC_SERVER_ACTION_5
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-client-wrapper.js [app-client] (ecmascript)");
/* __next_internal_action_entry_do_not_use__ [{"40bfc184339208cc33625bfbf7439164bfe195827a":{"name":"editorPreviewAction"}},"wt-personnel/apps/web/src/app/marketing/site/editor/actions.ts",""] */ "use turbopack no side effects";
;
const $$RSC_SERVER_ACTION_5 = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createServerReference"])("40bfc184339208cc33625bfbf7439164bfe195827a", __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["callServer"], void 0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["findSourceMapURL"], "editorPreviewAction");
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/app/marketing/site/editor/data:fcb604 [app-client] (ecmascript) <text/javascript>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "versionAction",
    ()=>$$RSC_SERVER_ACTION_1
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-client-wrapper.js [app-client] (ecmascript)");
/* __next_internal_action_entry_do_not_use__ [{"40757e30ef9189f7b144e989121d759deb17d26e2f":{"name":"versionAction"}},"wt-personnel/apps/web/src/app/marketing/site/editor/actions.ts",""] */ "use turbopack no side effects";
;
const $$RSC_SERVER_ACTION_1 = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createServerReference"])("40757e30ef9189f7b144e989121d759deb17d26e2f", __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["callServer"], void 0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["findSourceMapURL"], "versionAction");
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SiteEditor",
    ()=>SiteEditor
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/index.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$builder$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/builder.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/editor.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$spec$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/site-spec.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$canonical$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/canonical.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$diff$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/diff.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/ui.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$use$2d$confirm$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/use-confirm.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$data$3a$063c1b__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/site/editor/data:063c1b [app-client] (ecmascript) <text/javascript>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$data$3a$03a38f__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/site/editor/data:03a38f [app-client] (ecmascript) <text/javascript>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$data$3a$6e22ca__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/site/editor/data:6e22ca [app-client] (ecmascript) <text/javascript>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$data$3a$2415f5__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/site/editor/data:2415f5 [app-client] (ecmascript) <text/javascript>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$data$3a$f6c95e__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/site/editor/data:f6c95e [app-client] (ecmascript) <text/javascript>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$data$3a$fbade0__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/site/editor/data:fbade0 [app-client] (ecmascript) <text/javascript>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$data$3a$f79428__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/site/editor/data:f79428 [app-client] (ecmascript) <text/javascript>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$data$3a$a91882__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/site/editor/data:a91882 [app-client] (ecmascript) <text/javascript>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$data$3a$826c4a__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/site/editor/data:826c4a [app-client] (ecmascript) <text/javascript>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$data$3a$b7a5ca__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/site/editor/data:b7a5ca [app-client] (ecmascript) <text/javascript>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$data$3a$fcb604__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/site/editor/data:fcb604 [app-client] (ecmascript) <text/javascript>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$data$3a$652587__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/site/editor/data:652587 [app-client] (ecmascript) <text/javascript>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$ai$2d$chat$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$knowledge$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/site/editor/knowledge.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$forms$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$overlays$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/site/editor/overlays.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$paths$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/site/editor/paths.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$preview$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/site/editor/preview.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$run$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/site/editor/run.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$structure$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/site/editor/structure.tsx [app-client] (ecmascript)");
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
;
;
;
;
;
;
const ASSET_PROBLEM = 'Изображения нет в библиотеке филиала или оно другого назначения: выберите другое';
const DESKTOP = '(min-width: 961px)';
/** Сколько шагов отмены держит браузер: черновик целиком в каждом шаге, поэтому предел небольшой */ const HISTORY_LIMIT = 50;
const pagesOf = (spec)=>spec['pages'] ?? [];
const sectionsOf = (page)=>page?.['sections'] ?? [];
const homeId = (spec)=>{
    const pages = pagesOf(spec);
    const home = pages.find((p)=>p['isHome'] === true) ?? pages[0];
    return home ? String(home['id']) : null;
};
function valid(spec, s) {
    if (s.kind === 'site') return s;
    const page = pagesOf(spec)[s.page];
    if (!page) return {
        kind: 'site'
    };
    if (s.kind === 'page') return s;
    return sectionsOf(page)[s.section] ? s : {
        kind: 'page',
        page: s.page
    };
}
/** Подпись блока словами: вид и заголовок («О гостинице: О нас») */ function sectionLabel(section, locale) {
    if (!section) return 'Блок';
    const type = __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SITE_EDITOR_SECTIONS"][String(section['type'])]?.label ?? 'Блок';
    const heading = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["localizedText"])(section['heading'], locale);
    return heading ? `${type}: ${heading}` : type;
}
function findSection(spec, target) {
    if (!target) return null;
    const pages = pagesOf(spec);
    const page = pages.findIndex((p)=>String(p['id']) === target.pageId);
    if (page < 0) return null;
    const section = sectionsOf(pages[page]).findIndex((x)=>String(x['id']) === target.sectionId);
    return section < 0 ? null : {
        page,
        section
    };
}
/** Где ошибка, словами: страница и секция по документу, иначе «Настройки сайта» */ function whereOf(spec, path, locale) {
    const at = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["errorLocation"])(path);
    if (at.area === 'site') return path.startsWith('navigation') ? 'Навигация' : 'Настройки сайта';
    const page = pagesOf(spec)[at.pageIndex];
    const title = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["localizedText"])(page?.['title'], locale) || `Страница ${at.pageIndex + 1}`;
    if (at.sectionIndex === null) return `Страница «${title}»`;
    const label = __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SITE_EDITOR_SECTIONS"][String(sectionsOf(page)[at.sectionIndex]?.['type'])]?.label ?? 'Секция';
    return `Страница «${title}», ${label.toLowerCase()}`;
}
/** MKT9.2: полоса проекта: лицензия словами */ const LICENSE_TEXT = {
    active: 'Лицензия активна',
    expired: 'Срок лицензии вышел',
    off: 'Конструктор не подключён'
};
function SiteEditor({ siteId, base: initialBase, published, versions: initialVersions, bookmarks: initialBookmarks, conversation, project, categories, assets, readOnly, publish = {
    href: '/marketing/site'
} }) {
    _s();
    const [base, setBase] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(initialBase);
    const [spec, setSpec] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(initialBase.spec);
    /*
   * Отмена и повтор несохранённых правок (MKT10.3): история живёт только в браузере, серверная версия
   * появляется по-прежнему лишь по «Сохранить черновик» (решение 6 аудита MKT10). Ввод в одно поле подряд
   * это один шаг; загрузка новой версии с сервера историю обнуляет.
   */ const specRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(spec);
    specRef.current = spec;
    const lastEditKey = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const [past, setPast] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [future, setFuture] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const edit = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "SiteEditor.useCallback[edit]": (update, key)=>{
            const prev = specRef.current;
            const next = update(prev);
            // поле, которое после отмены записало то же значение, не шаг: иначе оно стёрло бы повтор
            if (next === prev || (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$canonical$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["canonicalJson"])(next) === (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$canonical$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["canonicalJson"])(prev)) return;
            if (key === null || key !== lastEditKey.current) setPast({
                "SiteEditor.useCallback[edit]": (p)=>[
                        ...p.slice(-(HISTORY_LIMIT - 1)),
                        prev
                    ]
            }["SiteEditor.useCallback[edit]"]);
            lastEditKey.current = key;
            setFuture([]);
            specRef.current = next;
            setSpec(next);
        }
    }["SiteEditor.useCallback[edit]"], []);
    const undoEdit = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "SiteEditor.useCallback[undoEdit]": ()=>{
            const prev = past[past.length - 1];
            if (!prev) return;
            const current = specRef.current;
            setPast({
                "SiteEditor.useCallback[undoEdit]": (p)=>p.slice(0, -1)
            }["SiteEditor.useCallback[undoEdit]"]);
            setFuture({
                "SiteEditor.useCallback[undoEdit]": (f)=>[
                        current,
                        ...f
                    ]
            }["SiteEditor.useCallback[undoEdit]"]);
            lastEditKey.current = null;
            specRef.current = prev;
            setSpec(prev);
        }
    }["SiteEditor.useCallback[undoEdit]"], [
        past
    ]);
    const redoEdit = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "SiteEditor.useCallback[redoEdit]": ()=>{
            const next = future[0];
            if (!next) return;
            const current = specRef.current;
            setFuture({
                "SiteEditor.useCallback[redoEdit]": (f)=>f.slice(1)
            }["SiteEditor.useCallback[redoEdit]"]);
            setPast({
                "SiteEditor.useCallback[redoEdit]": (p)=>[
                        ...p,
                        current
                    ]
            }["SiteEditor.useCallback[redoEdit]"]);
            lastEditKey.current = null;
            specRef.current = next;
            setSpec(next);
        }
    }["SiteEditor.useCallback[redoEdit]"], [
        future
    ]);
    // Ctrl+Z и Ctrl+Shift+Z (Cmd на Mac) вне полей ввода: в поле у браузера своя отмена набранного текста
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "SiteEditor.useEffect": ()=>{
            if (readOnly) return;
            const onKey = {
                "SiteEditor.useEffect.onKey": (e)=>{
                    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.key.toLowerCase() !== 'z') return;
                    const t = e.target;
                    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
                    e.preventDefault();
                    if (e.shiftKey) redoEdit();
                    else undoEdit();
                }
            }["SiteEditor.useEffect.onKey"];
            window.addEventListener('keydown', onKey);
            return ({
                "SiteEditor.useEffect": ()=>window.removeEventListener('keydown', onKey)
            })["SiteEditor.useEffect"];
        }
    }["SiteEditor.useEffect"], [
        readOnly,
        undoEdit,
        redoEdit
    ]);
    const baseCanon = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "SiteEditor.useMemo[baseCanon]": ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$canonical$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["canonicalJson"])(base.spec)
    }["SiteEditor.useMemo[baseCanon]"], [
        base
    ]);
    const dirty = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "SiteEditor.useMemo[dirty]": ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$canonical$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["canonicalJson"])(spec) !== baseCanon
    }["SiteEditor.useMemo[dirty]"], [
        spec,
        baseCanon
    ]);
    const dirtyRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(dirty);
    dirtyRef.current = dirty;
    const [selection, setSelection] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        kind: 'site'
    });
    const [tab, setTab] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('ai');
    const [previewPage, setPreviewPage] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        "SiteEditor.useState": ()=>homeId(initialBase.spec)
    }["SiteEditor.useState"]);
    const [aiTarget, setAiTarget] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [aiText, setAiTextState] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    const draftKey = `wetop.siteEditor.draft.${siteId}`;
    // недописанный текст живёт в браузере вкладки; сам разговор хранится на сервере
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "SiteEditor.useEffect": ()=>{
            try {
                const saved = sessionStorage.getItem(draftKey);
                if (saved) setAiTextState(saved);
            } catch  {
            // приватное окно: черновик запроса просто не переживёт обновление
            }
        }
    }["SiteEditor.useEffect"], [
        draftKey
    ]);
    const setAiText = (text)=>{
        setAiTextState(text);
        try {
            if (text) sessionStorage.setItem(draftKey, text);
            else sessionStorage.removeItem(draftKey);
        } catch  {
        // хранилище закрыто: текст остаётся на экране
        }
    };
    const [items, setItems] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(conversation);
    const [mode, setMode] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('BUILD');
    const [previewMode, setPreviewMode] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('select');
    const [aiError, setAiError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [bookmarks, setBookmarks] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(initialBookmarks);
    const [errors, setErrors] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [message, setMessage] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [conflict, setConflict] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [saving, setSaving] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [versions, setVersions] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(initialVersions);
    const [historyOpen, setHistoryOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [historyError, setHistoryError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [busy, setBusy] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [diff, setDiff] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [picker, setPicker] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const { ask, dialog } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$use$2d$confirm$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useConfirm"])();
    const leaving = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(false);
    const site = spec['site'] ?? {};
    const locales = (site['locales'] ?? [
        'ru'
    ]).filter((l)=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$spec$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SITE_SPEC_LOCALES"].includes(l));
    const defaultLocale = typeof site['defaultLocale'] === 'string' ? site['defaultLocale'] : 'ru';
    const current = valid(spec, selection);
    const pages = pagesOf(spec);
    const shownPageIndex = Math.max(0, pages.findIndex((p)=>String(p['id']) === previewPage));
    const target = findSection(spec, aiTarget);
    const targetLabel = target ? sectionLabel(sectionsOf(pages[target.page])[target.section], defaultLocale) : null;
    const selectedSectionId = current.kind === 'section' ? String(sectionsOf(pages[current.page])[current.section]?.['id'] ?? '') : null;
    const assetUrls = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "SiteEditor.useMemo[assetUrls]": ()=>Object.fromEntries(assets.filter({
                "SiteEditor.useMemo[assetUrls]": (a)=>a.previewUrl
            }["SiteEditor.useMemo[assetUrls]"]).map({
                "SiteEditor.useMemo[assetUrls]": (a)=>[
                        a.id,
                        a.previewUrl
                    ]
            }["SiteEditor.useMemo[assetUrls]"]))
    }["SiteEditor.useMemo[assetUrls]"], [
        assets
    ]);
    // «Просмотр» отдельной вкладкой только на узком экране: на компьютере сайт всегда справа
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "SiteEditor.useEffect": ()=>{
            const media = window.matchMedia(DESKTOP);
            const fix = {
                "SiteEditor.useEffect.fix": ()=>media.matches && setTab({
                        "SiteEditor.useEffect.fix": (t)=>t === 'preview' ? 'ai' : t
                    }["SiteEditor.useEffect.fix"])
            }["SiteEditor.useEffect.fix"];
            fix();
            media.addEventListener('change', fix);
            return ({
                "SiteEditor.useEffect": ()=>media.removeEventListener('change', fix)
            })["SiteEditor.useEffect"];
        }
    }["SiteEditor.useEffect"], []);
    const set = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "SiteEditor.useCallback[set]": (path, value)=>{
            // целый документ (порядок и состав блоков) это всегда отдельный шаг, поле копит ввод в один
            edit({
                "SiteEditor.useCallback[set]": (prev)=>path.length === 0 ? value : (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$paths$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["setAt"])(prev, path, value)
            }["SiteEditor.useCallback[set]"], path.length === 0 ? null : (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$paths$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["pathString"])(path));
        }
    }["SiteEditor.useCallback[set]"], [
        edit
    ]);
    const errorAt = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "SiteEditor.useCallback[errorAt]": (path)=>{
            const p = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$paths$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["pathString"])(path);
            const hit = errors.find({
                "SiteEditor.useCallback[errorAt].hit": (e)=>e.path === p || e.path.startsWith(`${p}.`) && __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$spec$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SITE_SPEC_LOCALES"].includes(e.path.slice(p.length + 1))
            }["SiteEditor.useCallback[errorAt].hit"]);
            return hit?.message ?? null;
        }
    }["SiteEditor.useCallback[errorAt]"], [
        errors
    ]);
    /** Выбор страницы или блока: его форма во вкладке «Блоки», страница в просмотре, блок становится целью ИИ */ const select = (next)=>{
        setSelection(next);
        setTab('blocks');
        if (next.kind === 'site') return;
        const page = pagesOf(spec)[next.page];
        if (page) setPreviewPage(String(page['id']));
        if (next.kind === 'section') {
            const section = sectionsOf(page)[next.section];
            if (page && section) setAiTarget({
                pageId: String(page['id']),
                sectionId: String(section['id'])
            });
        }
    };
    const pickFromPreview = (pageId, sectionId)=>{
        const at = findSection(spec, {
            pageId,
            sectionId
        });
        if (at) select({
            kind: 'section',
            ...at
        });
    };
    const confirm = (title, body)=>ask({
            title,
            body,
            confirmLabel: 'Удалить',
            tone: 'danger'
        });
    const refreshVersions = async ()=>{
        const r = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$data$3a$652587__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__["versionsAction"])();
        if (r.ok) {
            setVersions(r.versions);
            setBookmarks(r.bookmarks);
        }
        return r.ok ? r.versions : versions;
    };
    const refreshConversation = async ()=>{
        const r = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$data$3a$2415f5__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__["conversationAction"])();
        if (r.ok) setItems(r.data.items);
    };
    const openPreview = async (versionId)=>{
        const r = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$data$3a$fbade0__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__["editorPreviewAction"])(versionId);
        if (r.url) window.open(r.url, '_blank', 'noopener');
        else setMessage({
            tone: 'error',
            text: r.error ?? 'Предпросмотр недоступен'
        });
    };
    const loadAsBase = async (versionId, replaceSpec)=>{
        const r = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$data$3a$fcb604__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__["versionAction"])(versionId);
        if (!r.ok) {
            setMessage({
                tone: 'error',
                text: r.message
            });
            return null;
        }
        const next = {
            id: r.data.version.id,
            revision: r.data.version.revision,
            spec: r.data.version.spec
        };
        setBase(next);
        if (replaceSpec) {
            specRef.current = next.spec;
            setSpec(next.spec);
            setPast([]);
            setFuture([]);
            lastEditKey.current = null;
            setSelection((s)=>valid(next.spec, s));
        }
        return next;
    };
    /** Отказ API: ввод остаётся, ошибки встают у полей, конфликт версии отдельно */ const failed = (reply, what)=>{
        if (reply.status === 409 && reply.code === 'VERSION_CONFLICT') {
            setConflict(true);
            setMessage(null);
            return;
        }
        if (reply.code === 'ASSET_UNAVAILABLE') setErrors(reply.paths.map((p)=>({
                path: p.path,
                code: p.code,
                message: ASSET_PROBLEM
            })));
        else if (reply.errors.length) setErrors(reply.errors);
        setMessage({
            tone: 'error',
            text: `${what}: ${reply.message}`
        });
    };
    const save = async ()=>{
        setMessage(null);
        if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$canonical$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["canonicalByteLength"])(spec) > __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$spec$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SITE_SPEC_MAX_BYTES"]) {
            setMessage({
                tone: 'error',
                text: 'Черновик слишком большой: уберите часть страниц, секций или текста'
            });
            return null;
        }
        // подсказка до отправки тем же валидатором, что у сервера; судья всё равно сервер
        const local = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$spec$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["validateSiteSpec"])(spec);
        if (!local.ok) {
            setErrors(local.errors);
            setMessage({
                tone: 'error',
                text: 'Черновик не сохранён: исправьте отмеченные поля'
            });
            return null;
        }
        setSaving(true);
        const reply = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$data$3a$826c4a__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__["saveDraftAction"])(base.revision, spec);
        setSaving(false);
        if (!reply.ok) {
            failed(reply, 'Черновик не сохранён');
            return null;
        }
        const next = {
            id: reply.data.version.id,
            revision: reply.data.version.revision,
            spec
        };
        setBase(next);
        setErrors([]);
        setConflict(false);
        setMessage({
            tone: 'ok',
            text: `Черновик сохранён: версия ${next.revision}`
        });
        void refreshVersions();
        return next;
    };
    const job = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$run$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGenerationRun"])({
        "SiteEditor.useGenerationRun[job]": async (run)=>{
            void refreshVersions();
            if (run.status === 'SUCCEEDED' && run.outputVersionId) {
                const next = await loadAsBase(run.outputVersionId, !dirtyRef.current);
                if (next && dirtyRef.current) setConflict(true);
            }
            void refreshConversation();
        }
    }["SiteEditor.useGenerationRun[job]"]);
    const talk = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$run$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAssistantRun"])({
        "SiteEditor.useAssistantRun[talk]": ()=>void refreshConversation()
    }["SiteEditor.useAssistantRun[talk]"]);
    // задача, начатая до обновления страницы, продолжает опрашиваться
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "SiteEditor.useEffect": ()=>{
            const running = conversation.find({
                "SiteEditor.useEffect.running": (i)=>i.status === 'QUEUED' || i.status === 'RUNNING'
            }["SiteEditor.useEffect.running"]);
            if (!running) return;
            if (running.kind === 'BUILD') job.start({
                id: running.id,
                type: running.mode,
                status: running.status,
                baseVersionId: running.baseVersionId,
                outputVersionId: null,
                errorCode: null
            });
            else talk.start({
                id: running.id,
                mode: running.mode,
                status: running.status === 'CANCELLED' ? 'FAILED' : running.status,
                baseVersionId: running.baseVersionId,
                userText: running.userText ?? '',
                assistantText: null,
                payload: null,
                errorCode: null
            });
        // только при открытии страницы
        }
    }["SiteEditor.useEffect"], []);
    const aiBusy = job.active || talk.active;
    /**
   * Запрос к ИИ по режиму. «Сборка»: несохранённое сначала сохраняется, метка блока даёт правку одной секции. «Чат» и
   * «План»: разговорная задача, сайт не меняется
   */ const sendAi = async (text)=>{
        setAiError(null);
        if (mode !== 'BUILD') {
            const reply = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$data$3a$03a38f__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__["assistantAction"])({
                mode,
                text
            });
            if (!reply.ok) return setAiError(reply.message);
            setAiText('');
            talk.start(reply.data.run);
            return void refreshConversation();
        }
        let head = base;
        if (dirty) {
            const saved = await save();
            if (!saved) return;
            head = saved;
        }
        const where = findSection(head.spec, aiTarget);
        const page = where ? pagesOf(head.spec)[where.page] : undefined;
        const section = where ? sectionsOf(page)[where.section] : undefined;
        const request = ()=>page && section ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$data$3a$b7a5ca__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__["sectionAction"])(head.id, String(page['id']), String(section['id']), text) : (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$data$3a$f79428__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__["patchAction"])(head.id, text);
        const reply = await request();
        if (!reply.ok) return setAiError(reply.message);
        setAiText('');
        job.start(reply.data.run);
        void refreshConversation();
    };
    const answerPlan = async (runId, answers)=>{
        setAiError(null);
        const reply = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$data$3a$03a38f__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__["assistantAction"])({
            mode: 'PLAN',
            text: '',
            reply: {
                runId,
                answers
            }
        });
        if (!reply.ok) return setAiError(reply.message);
        talk.start(reply.data.run);
        void refreshConversation();
    };
    const approvePlan = async (planId, instruction)=>{
        setAiError(null);
        if (dirty) {
            setAiError('Сначала сохраните черновик: план составлен по сохранённой версии');
            return;
        }
        const reply = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$data$3a$063c1b__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__["approvePlanAction"])(planId, instruction);
        if (!reply.ok) return setAiError(reply.message);
        job.start(reply.data.run);
        void refreshConversation();
    };
    /** Оформление без ИИ: тема, первый экран и порядок блоков главной в документ на экране; сохраняет человек */ const applyDesign = (direction)=>{
        edit((prev)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$builder$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["applyDesignDirection"])(prev, direction), null);
        setMessage({
            tone: 'ok',
            text: `Оформление «${direction.name}» применено к черновику: сохраните, чтобы оставить его`
        });
    };
    /** Правка текста прямо на сайте: только разрешённые поля, предел поля; ИИ не зовётся */ const inlineEdit = (path, locale, text)=>{
        const r = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$builder$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["setInlineText"])(spec, path, locale, text);
        if (!r.ok) return setMessage({
            tone: 'error',
            text: r.message
        });
        edit(()=>r.spec, `inline:${path}:${locale}`);
    };
    const toggleBookmark = async (v, label)=>{
        setHistoryError(null);
        const r = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$data$3a$6e22ca__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__["bookmarkAction"])(v.id, label);
        if (!r.ok) {
            setHistoryError(r.message);
            return false;
        }
        await refreshVersions();
        return true;
    };
    const showChanges = async (item)=>{
        if (!item.outputVersionId || !item.baseVersionId) return;
        const r = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$data$3a$f6c95e__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__["diffAction"])(item.outputVersionId, item.baseVersionId);
        const revision = versions.find((v)=>v.id === item.outputVersionId)?.revision;
        if (r.ok) setDiff({
            title: `Что изменил ИИ в версии ${revision ?? ''}`,
            changes: r.data.changes
        });
        else setMessage({
            tone: 'error',
            text: r.message
        });
    };
    /** Восстановление версии новой головой; `conflict`: голова уже ушла вперёд, ввод на месте */ const restore = async (versionId, revision, onError)=>{
        setBusy(true);
        const r = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$data$3a$a91882__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__["restoreAction"])(versionId, base.revision);
        setBusy(false);
        if (!r.ok) {
            if (r.code === 'VERSION_CONFLICT') {
                setConflict(true);
                return 'conflict';
            }
            onError(r.code === 'ASSET_UNAVAILABLE' ? 'В этой версии есть изображения, которых больше нет в библиотеке: восстановить её нельзя. Загрузите изображения заново или замените их в текущем черновике.' : r.message);
            return 'error';
        }
        await loadAsBase(r.data.version.id, true);
        setErrors([]);
        setMessage({
            tone: 'ok',
            text: `Версия ${revision} восстановлена как черновик: версия ${r.data.version.revision}`
        });
        void refreshVersions();
        return 'ok';
    };
    const undo = async (item)=>{
        if (!item.baseVersionId) return;
        const before = versions.find((v)=>v.id === item.baseVersionId)?.revision ?? 1;
        const ok = await ask({
            title: 'Вернуть сайт как было до этого запроса?',
            body: dirty ? `Появится новая версия черновика с содержимым версии ${before}. Ваши несохранённые изменения пропадут. Опубликованный сайт не изменится.` : `Появится новая версия черновика с содержимым версии ${before}. Опубликованный сайт не изменится.`,
            confirmLabel: 'Вернуть'
        });
        if (ok) await restore(item.baseVersionId, before, (text)=>setMessage({
                tone: 'error',
                text
            }));
    };
    // уход со страницы с несохранёнными правками: вопрос браузера и свой вопрос для ссылок внутри стойки
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "SiteEditor.useEffect": ()=>{
            if (!dirty) return;
            const onUnload = {
                "SiteEditor.useEffect.onUnload": (e)=>{
                    if (leaving.current) return;
                    e.preventDefault();
                    e.returnValue = '';
                }
            }["SiteEditor.useEffect.onUnload"];
            const onClick = {
                "SiteEditor.useEffect.onClick": (e)=>{
                    const link = e.target?.closest?.('a[href]');
                    if (!link || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || link.getAttribute('target') === '_blank') return;
                    const href = link.getAttribute('href') ?? '';
                    if (!href || href.startsWith('#')) return;
                    e.preventDefault();
                    e.stopPropagation();
                    void ask({
                        title: 'Уйти без сохранения?',
                        body: 'Несохранённые изменения черновика пропадут.',
                        confirmLabel: 'Уйти',
                        cancelLabel: 'Остаться',
                        tone: 'danger'
                    }).then({
                        "SiteEditor.useEffect.onClick": (ok)=>{
                            if (!ok) return;
                            leaving.current = true;
                            window.location.assign(href);
                        }
                    }["SiteEditor.useEffect.onClick"]);
                }
            }["SiteEditor.useEffect.onClick"];
            window.addEventListener('beforeunload', onUnload);
            document.addEventListener('click', onClick, true);
            return ({
                "SiteEditor.useEffect": ()=>{
                    window.removeEventListener('beforeunload', onUnload);
                    document.removeEventListener('click', onClick, true);
                }
            })["SiteEditor.useEffect"];
        }
    }["SiteEditor.useEffect"], [
        dirty,
        ask
    ]);
    const goToError = (path)=>{
        const at = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["errorLocation"])(path);
        // оформление и логотип на вкладке «Дизайн», прочее уровня сайта в «Настройках»
        if (at.area === 'site') setTab(/^(theme|site\.brand\.(logo|faviconAssetId))(\.|$)/.test(path) ? 'design' : 'site');
        else select(at.sectionIndex === null ? {
            kind: 'page',
            page: at.pageIndex
        } : {
            kind: 'section',
            page: at.pageIndex,
            section: at.sectionIndex
        });
        setTimeout(()=>{
            const parts = path.split('.');
            for(let n = parts.length; n > 0; n -= 1){
                const el = document.querySelector(`[data-path="${parts.slice(0, n).join('.')}"]`);
                if (el) {
                    el.scrollIntoView({
                        block: 'center'
                    });
                    el.querySelector('input, select, textarea, button')?.focus();
                    return;
                }
            }
        }, 50);
    };
    const context = {
        spec,
        set,
        locales,
        defaultLocale,
        errorAt,
        readOnly,
        categories,
        assets,
        pickAsset: (kind, onPick)=>setPicker({
                kind,
                onPick
            })
    };
    const askAiAboutSection = current.kind === 'section' ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
        type: "button",
        tone: "secondary",
        size: "sm",
        "data-testid": "ed-ai-section",
        onClick: ()=>{
            const page = pages[current.page];
            const section = sectionsOf(page)[current.section];
            if (page && section) setAiTarget({
                pageId: String(page['id']),
                sectionId: String(section['id'])
            });
            setTab('ai');
        },
        children: "Изменить этот блок с ИИ"
    }, void 0, false, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
        lineNumber: 584,
        columnNumber: 7
    }, this) : null;
    // вкладки как в макете Marketing 2.0 (экран 1): «Редактор» это разговор с ИИ, «Просмотр» только на узком экране
    const tabs = [
        [
            'ai',
            'Редактор'
        ],
        [
            'blocks',
            'Страницы'
        ],
        [
            'design',
            'Дизайн'
        ],
        [
            'site',
            'Настройки'
        ],
        [
            'preview',
            'Просмотр'
        ]
    ];
    const tabList = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "ed-tabs",
        role: "tablist",
        "aria-label": "Части редактора",
        children: tabs.map(([key, label])=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                type: "button",
                role: "tab",
                id: `ed-tab-${key}`,
                "aria-selected": tab === key,
                "aria-controls": `ed-pane-${key}`,
                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cx"])('ed-tab', key === 'preview' && 'ed-tab--narrow', tab === key && 'is-on'),
                onClick: ()=>setTab(key),
                children: label
            }, key, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                lineNumber: 611,
                columnNumber: 9
            }, this))
    }, void 0, false, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
        lineNumber: 609,
        columnNumber: 5
    }, this);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["EditorProvider"], {
        value: context,
        children: [
            dialog,
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Stack"], {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "ed-top",
                        "data-testid": "ed-bar",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "ed-top__project",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "ed-top__name",
                                        "data-testid": "ed-project",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("b", {
                                                children: project.locationName
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                                                lineNumber: 634,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "muted",
                                                children: " / Сайт филиала"
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                                                lineNumber: 635,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                                        lineNumber: 633,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cx"])('ed-license', `is-${project.builder.access}`),
                                        "data-testid": "ed-license",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "ed-license__dot",
                                                "aria-hidden": "true"
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                                                lineNumber: 638,
                                                columnNumber: 15
                                            }, this),
                                            LICENSE_TEXT[project.builder.access]
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                                        lineNumber: 637,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                                lineNumber: 632,
                                columnNumber: 11
                            }, this),
                            tabList,
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dl", {
                                className: "ed-top__facts",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                                children: "Черновик"
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                                                lineNumber: 645,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                                "data-testid": "ed-revision",
                                                children: [
                                                    "версия ",
                                                    base.revision
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                                                lineNumber: 646,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                                        lineNumber: 644,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                                children: "На сайте"
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                                                lineNumber: 649,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                                children: published ? `версия ${published.revision}` : 'ещё не опубликован'
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                                                lineNumber: 650,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                                        lineNumber: 648,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                                lineNumber: 643,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cx"])('ed-dirty', dirty && 'is-dirty'),
                                role: "status",
                                "data-testid": "ed-dirty",
                                children: dirty ? 'Есть несохранённые изменения' : 'Все изменения сохранены'
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                                lineNumber: 653,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "ed-top__actions",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                        type: "button",
                                        tone: "secondary",
                                        "data-testid": "ed-history-open",
                                        onClick: ()=>{
                                            setHistoryError(null);
                                            setHistoryOpen(true);
                                            void refreshVersions();
                                        },
                                        children: "История"
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                                        lineNumber: 657,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                        className: "btn btn--secondary",
                                        href: "/marketing/site/assets",
                                        "data-testid": "editor-assets-link",
                                        children: "Изображения"
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                                        lineNumber: 669,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                        type: "button",
                                        tone: "secondary",
                                        disabled: readOnly || past.length === 0,
                                        onClick: undoEdit,
                                        "data-testid": "ed-undo",
                                        title: "Ctrl+Z",
                                        children: "Отменить"
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                                        lineNumber: 672,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                        type: "button",
                                        tone: "secondary",
                                        disabled: readOnly || future.length === 0,
                                        onClick: redoEdit,
                                        "data-testid": "ed-redo",
                                        title: "Ctrl+Shift+Z",
                                        children: "Повторить"
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                                        lineNumber: 675,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                        type: "button",
                                        tone: "secondary",
                                        disabled: readOnly || !dirty || saving,
                                        onClick: ()=>void save(),
                                        "data-testid": "ed-save",
                                        children: saving ? 'Сохраняем…' : 'Сохранить черновик'
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                                        lineNumber: 678,
                                        columnNumber: 13
                                    }, this),
                                    'href' in publish ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                        className: "btn",
                                        href: publish.href,
                                        "data-testid": "editor-publication-link",
                                        children: "Опубликовать"
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                                        lineNumber: 683,
                                        columnNumber: 15
                                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                        type: "button",
                                        disabled: true,
                                        title: publish.reason,
                                        "aria-describedby": "ed-publish-reason",
                                        "data-testid": "editor-publication-off",
                                        children: "Опубликовать"
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                                        lineNumber: 687,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                                lineNumber: 656,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                        lineNumber: 631,
                        columnNumber: 9
                    }, this),
                    'reason' in publish && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "muted",
                        id: "ed-publish-reason",
                        "data-testid": "ed-publish-reason",
                        children: publish.reason
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                        lineNumber: 694,
                        columnNumber: 11
                    }, this),
                    project.builder.access !== 'active' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Alert"], {
                        boxed: true,
                        "data-testid": "ed-license-off",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("b", {
                                children: "Конструктор сайта не активен для этого филиала."
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                                lineNumber: 700,
                                columnNumber: 13
                            }, this),
                            ' ',
                            project.builder.access === 'expired' ? 'Срок лицензии вышел. ' : '',
                            "Сайт и история видны, но менять сайт, просить ИИ и публиковать нельзя. Опубликованный сайт продолжает работать. Подключить конструктор может главный администратор WETOP."
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                        lineNumber: 699,
                        columnNumber: 11
                    }, this),
                    message && (message.tone === 'ok' ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Notice"], {
                        "data-testid": "ed-message",
                        children: message.text
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                        lineNumber: 708,
                        columnNumber: 13
                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Alert"], {
                        boxed: true,
                        "data-testid": "ed-message",
                        children: message.text
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                        lineNumber: 710,
                        columnNumber: 13
                    }, this)),
                    conflict && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Alert"], {
                        boxed: true,
                        "data-testid": "ed-conflict",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                children: "Сайт уже изменён в другой вкладке или ИИ. Ваши изменения остались на экране."
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                                lineNumber: 716,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "ed-row",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                        type: "button",
                                        tone: "secondary",
                                        size: "sm",
                                        onClick: async ()=>{
                                            await refreshVersions();
                                            setHistoryOpen(true);
                                        },
                                        children: "Посмотреть новую версию"
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                                        lineNumber: 718,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                        type: "button",
                                        tone: "secondary",
                                        size: "sm",
                                        "data-testid": "ed-conflict-compare",
                                        onClick: async ()=>{
                                            const latest = (await refreshVersions()).find((v)=>v.isLatest);
                                            if (!latest) return;
                                            const r = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$data$3a$fcb604__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__["versionAction"])(latest.id);
                                            if (r.ok) setDiff({
                                                title: `Чем ваши правки отличаются от версии ${latest.revision}`,
                                                changes: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$diff$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["diffSiteSpecs"])(r.data.version.spec, spec)
                                            });
                                        },
                                        children: "Сравнить"
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                                        lineNumber: 729,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                        type: "button",
                                        size: "sm",
                                        "data-testid": "ed-conflict-continue",
                                        onClick: async ()=>{
                                            const latest = (await refreshVersions()).find((v)=>v.isLatest);
                                            if (!latest) return;
                                            const next = await loadAsBase(latest.id, false);
                                            if (!next) return;
                                            setConflict(false);
                                            setMessage({
                                                tone: 'ok',
                                                text: `Ваши правки будут сохранены поверх версии ${next.revision}`
                                            });
                                        },
                                        children: "Продолжить с моими изменениями"
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                                        lineNumber: 743,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                                lineNumber: 717,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                        lineNumber: 715,
                        columnNumber: 11
                    }, this),
                    errors.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Alert"], {
                        boxed: true,
                        "data-testid": "ed-errors",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("b", {
                                children: "Что исправить"
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                                lineNumber: 763,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                                className: "ed-error-list",
                                children: errors.slice(0, 20).map((e, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            type: "button",
                                            className: "ed-link",
                                            onClick: ()=>goToError(e.path),
                                            children: [
                                                whereOf(spec, e.path, defaultLocale),
                                                ": ",
                                                e.message
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                                            lineNumber: 767,
                                            columnNumber: 19
                                        }, this)
                                    }, `${e.path}-${i}`, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                                        lineNumber: 766,
                                        columnNumber: 17
                                    }, this))
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                                lineNumber: 764,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                        lineNumber: 762,
                        columnNumber: 11
                    }, this),
                    (job.lost || talk.lost) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Alert"], {
                        boxed: true,
                        children: job.lost ?? talk.lost
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                        lineNumber: 775,
                        columnNumber: 37
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "site-editor",
                        "data-testid": "site-editor",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "ed-left",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        id: "ed-pane-ai",
                                        role: "tabpanel",
                                        "aria-labelledby": "ed-tab-ai",
                                        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cx"])('site-editor__pane', tab === 'ai' && 'is-active'),
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "panel ed-chat",
                                            "data-theme": "dark",
                                            "data-testid": "ed-chat",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "ed-chat__head",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            className: "ed-chat__mark",
                                                            "aria-hidden": "true",
                                                            children: "W"
                                                        }, void 0, false, {
                                                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                                                            lineNumber: 783,
                                                            columnNumber: 19
                                                        }, this),
                                                        "Создайте сайт с помощью ИИ"
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                                                    lineNumber: 782,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$ai$2d$chat$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AiChat"], {
                                                    canPublish: 'href' in publish,
                                                    items: items,
                                                    revisionOf: (id)=>versions.find((v)=>v.id === id)?.revision ?? null,
                                                    mode: mode,
                                                    setMode: setMode,
                                                    target: targetLabel,
                                                    onClearTarget: ()=>setAiTarget(null),
                                                    dirty: dirty,
                                                    readOnly: readOnly,
                                                    busy: aiBusy || saving,
                                                    onSend: (text)=>void sendAi(text),
                                                    onAnswer: (runId, answers)=>void answerPlan(runId, answers),
                                                    onApprove: (planId, instruction)=>void approvePlan(planId, instruction),
                                                    onApplyDesign: applyDesign,
                                                    onShowChanges: (item)=>void showChanges(item),
                                                    onUndo: (item)=>void undo(item),
                                                    text: aiText,
                                                    setText: setAiText,
                                                    error: aiError
                                                }, void 0, false, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                                                    lineNumber: 788,
                                                    columnNumber: 17
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                                            lineNumber: 781,
                                            columnNumber: 15
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                                        lineNumber: 779,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        id: "ed-pane-blocks",
                                        role: "tabpanel",
                                        "aria-labelledby": "ed-tab-blocks",
                                        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cx"])('site-editor__pane', tab === 'blocks' && 'is-active'),
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Panel"], {
                                            children: current.kind === 'site' ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$structure$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Structure"], {
                                                selection: current,
                                                select: select,
                                                ask: confirm,
                                                shownPage: shownPageIndex
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                                                lineNumber: 814,
                                                columnNumber: 19
                                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Stack"], {
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                                        type: "button",
                                                        tone: "ghost",
                                                        size: "sm",
                                                        className: "ed-back",
                                                        "data-testid": "ed-back",
                                                        onClick: ()=>setSelection({
                                                                kind: 'site'
                                                            }),
                                                        children: "Все страницы и блоки"
                                                    }, void 0, false, {
                                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                                                        lineNumber: 817,
                                                        columnNumber: 21
                                                    }, this),
                                                    current.kind === 'page' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$forms$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PageForm"], {
                                                        pageIndex: current.page
                                                    }, void 0, false, {
                                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                                                        lineNumber: 820,
                                                        columnNumber: 49
                                                    }, this),
                                                    current.kind === 'section' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$forms$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SectionForm"], {
                                                        pageIndex: current.page,
                                                        sectionIndex: current.section,
                                                        ai: askAiAboutSection
                                                    }, `${current.page}-${current.section}`, false, {
                                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                                                        lineNumber: 822,
                                                        columnNumber: 23
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                                                lineNumber: 816,
                                                columnNumber: 19
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                                            lineNumber: 812,
                                            columnNumber: 15
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                                        lineNumber: 811,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        id: "ed-pane-design",
                                        role: "tabpanel",
                                        "aria-labelledby": "ed-tab-design",
                                        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cx"])('site-editor__pane', tab === 'design' && 'is-active'),
                                        children: tab === 'design' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Panel"], {
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$forms$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SiteForm"], {
                                                part: "design"
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                                                lineNumber: 832,
                                                columnNumber: 19
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                                            lineNumber: 831,
                                            columnNumber: 17
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                                        lineNumber: 828,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        id: "ed-pane-site",
                                        role: "tabpanel",
                                        "aria-labelledby": "ed-tab-site",
                                        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cx"])('site-editor__pane', tab === 'site' && 'is-active'),
                                        children: tab === 'site' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Stack"], {
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Panel"], {
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$knowledge$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ProjectKnowledge"], {
                                                        initial: project.instructions,
                                                        readOnly: readOnly
                                                    }, void 0, false, {
                                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                                                        lineNumber: 840,
                                                        columnNumber: 21
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                                                    lineNumber: 839,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Panel"], {
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$forms$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SiteForm"], {
                                                        part: "settings"
                                                    }, void 0, false, {
                                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                                                        lineNumber: 843,
                                                        columnNumber: 21
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                                                    lineNumber: 842,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                                            lineNumber: 838,
                                            columnNumber: 17
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                                        lineNumber: 836,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                                lineNumber: 778,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                id: "ed-pane-preview",
                                role: "tabpanel",
                                "aria-labelledby": "ed-tab-preview",
                                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cx"])('ed-right', tab === 'preview' && 'is-active'),
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$preview$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SitePreview"], {
                                    spec: spec,
                                    pageId: previewPage,
                                    onPage: (id)=>{
                                        setPreviewPage(id);
                                        if (selection.kind !== 'site' && String(pages[selection.page]?.['id']) !== id) setSelection({
                                            kind: 'site'
                                        });
                                    },
                                    locales: locales,
                                    defaultLocale: defaultLocale,
                                    assets: assetUrls,
                                    selectedSectionId: selectedSectionId,
                                    onPickSection: pickFromPreview,
                                    onOpenSeparately: ()=>dirty ? setMessage({
                                            tone: 'error',
                                            text: 'Сначала сохраните черновик.'
                                        }) : void openPreview(base.id),
                                    mode: previewMode,
                                    setMode: setPreviewMode,
                                    onInlineEdit: inlineEdit,
                                    readOnly: readOnly
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                                    lineNumber: 850,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                                lineNumber: 849,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                        lineNumber: 777,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                lineNumber: 630,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$overlays$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AssetPicker"], {
                kind: picker?.kind ?? null,
                assets: assets,
                onClose: ()=>setPicker(null),
                onPick: (asset)=>{
                    picker?.onPick(asset);
                    setPicker(null);
                }
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                lineNumber: 872,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$overlays$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DiffOverlay"], {
                title: diff?.title ?? null,
                changes: diff?.changes ?? [],
                onClose: ()=>setDiff(null)
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                lineNumber: 881,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$overlays$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["HistoryOverlay"], {
                open: historyOpen,
                versions: versions,
                bookmarks: bookmarks,
                onBookmark: toggleBookmark,
                readOnly: readOnly,
                busy: busy,
                error: historyError,
                onClose: ()=>setHistoryOpen(false),
                onPreview: (v)=>void openPreview(v.id),
                onCompare: async (v)=>{
                    setBusy(true);
                    const r = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$data$3a$f6c95e__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__["diffAction"])(base.id, v.id);
                    setBusy(false);
                    if (r.ok) setDiff({
                        title: `Версия ${v.revision} и черновик ${base.revision}`,
                        changes: r.data.changes
                    });
                    else setHistoryError(r.message);
                },
                onRestore: async (v)=>{
                    const ok = await ask({
                        title: `Восстановить версию ${v.revision} как новый черновик?`,
                        body: dirty ? 'Появится новая версия черновика с содержимым этой версии. Ваши несохранённые изменения пропадут. Опубликованный сайт не изменится.' : 'Появится новая версия черновика с содержимым этой версии. Опубликованный сайт не изменится.',
                        confirmLabel: 'Восстановить'
                    });
                    if (!ok) return;
                    setHistoryError(null);
                    if (await restore(v.id, v.revision, setHistoryError) !== 'error') setHistoryOpen(false);
                }
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
                lineNumber: 882,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/editor.tsx",
        lineNumber: 628,
        columnNumber: 5
    }, this);
}
_s(SiteEditor, "Rby3L9sR+fvYepqchThSHQS2yw8=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$use$2d$confirm$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useConfirm"],
        __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$run$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGenerationRun"],
        __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$run$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAssistantRun"]
    ];
});
_c = SiteEditor;
var _c;
__turbopack_context__.k.register(_c, "SiteEditor");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ActionField",
    ()=>ActionField,
    "BoolField",
    ()=>BoolField,
    "CTA_KINDS",
    ()=>CTA_KINDS,
    "CtaField",
    ()=>CtaField,
    "EditorProvider",
    ()=>EditorProvider,
    "EnumField",
    ()=>EnumField,
    "FaviconField",
    ()=>FaviconField,
    "FieldFor",
    ()=>FieldFor,
    "ImageField",
    ()=>ImageField,
    "ImagesField",
    ()=>ImagesField,
    "ItemControls",
    ()=>ItemControls,
    "ListField",
    ()=>ListField,
    "PlainField",
    ()=>PlainField,
    "TARGET_KINDS",
    ()=>TARGET_KINDS,
    "TextField",
    ()=>TextField,
    "TextListField",
    ()=>TextListField,
    "useEditor",
    ()=>useEditor
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/index.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/editor.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/ui.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$paths$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/site/editor/paths.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature(), _s2 = __turbopack_context__.k.signature(), _s3 = __turbopack_context__.k.signature(), _s4 = __turbopack_context__.k.signature(), _s5 = __turbopack_context__.k.signature(), _s6 = __turbopack_context__.k.signature(), _s7 = __turbopack_context__.k.signature(), _s8 = __turbopack_context__.k.signature(), _s9 = __turbopack_context__.k.signature(), _s10 = __turbopack_context__.k.signature(), _s11 = __turbopack_context__.k.signature(), _s12 = __turbopack_context__.k.signature(), _s13 = __turbopack_context__.k.signature(), _s14 = __turbopack_context__.k.signature(), _s15 = __turbopack_context__.k.signature(), _s16 = __turbopack_context__.k.signature(), _s17 = __turbopack_context__.k.signature(), _s18 = __turbopack_context__.k.signature(), _s19 = __turbopack_context__.k.signature(), _s20 = __turbopack_context__.k.signature();
'use client';
;
;
;
;
const EditorContext = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createContext"])(null);
const EditorProvider = EditorContext.Provider;
function useEditor() {
    _s();
    const value = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useContext"])(EditorContext);
    if (!value) throw new Error('useEditor вне редактора');
    return value;
}
_s(useEditor, "ksutO2/Ix3UeCrGnhyM+QEP505Y=");
const asText = (v)=>v && typeof v === 'object' && !Array.isArray(v) ? v : {};
function TextField({ path, label, max, multiline, required }) {
    _s1();
    const c = useEditor();
    const value = asText((0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$paths$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAt"])(c.spec, path));
    const [chosen, setChosen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(c.defaultLocale);
    const locale = c.locales.includes(chosen) ? chosen : c.defaultLocale;
    const id = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$paths$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["pathId"])([
        ...path,
        locale
    ]);
    const many = c.locales.length > 1;
    const missing = required ? c.locales.filter((l)=>!value[l]?.trim()) : [];
    const update = (text)=>{
        const next = {
            ...value
        };
        if (text === '') delete next[locale];
        else next[locale] = text;
        c.set(path, Object.keys(next).length ? next : undefined);
    };
    const control = multiline ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Textarea"], {
        rows: 3,
        maxLength: max,
        value: value[locale] ?? '',
        disabled: c.readOnly,
        onChange: (e)=>update(e.currentTarget.value)
    }, void 0, false, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
        lineNumber: 67,
        columnNumber: 5
    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
        maxLength: max,
        value: value[locale] ?? '',
        disabled: c.readOnly,
        onChange: (e)=>update(e.currentTarget.value)
    }, void 0, false, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
        lineNumber: 69,
        columnNumber: 5
    }, this);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "ed-text",
        "data-path": (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$paths$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["pathString"])(path),
        children: [
            many && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "ed-locales",
                role: "group",
                "aria-label": `Язык поля «${label}»`,
                children: c.locales.map((l)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cx"])('ed-locale', l === locale && 'is-on'),
                        "aria-pressed": l === locale,
                        onClick: ()=>setChosen(l),
                        children: [
                            __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["LOCALE_LABEL"][l] ?? l,
                            missing.includes(l) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "sr-only",
                                children: " (нет текста)"
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                                lineNumber: 84,
                                columnNumber: 39
                            }, this),
                            missing.includes(l) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                "aria-hidden": "true",
                                className: "ed-locale__missing"
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                                lineNumber: 85,
                                columnNumber: 39
                            }, this)
                        ]
                    }, l, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                        lineNumber: 76,
                        columnNumber: 13
                    }, this))
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 74,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                label: many ? `${label} (${__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["LOCALE_LABEL"][locale] ?? locale})` : label,
                controlId: id,
                error: c.errorAt(path),
                hint: missing.length && many ? `Нет текста: ${missing.map((l)=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["LOCALE_LABEL"][l] ?? l).join(', ')}` : undefined,
                children: control
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 90,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
        lineNumber: 72,
        columnNumber: 5
    }, this);
}
_s1(TextField, "NHTQrlCJP+mOef5THlh4khwvXvc=", false, function() {
    return [
        useEditor
    ];
});
_c = TextField;
function PlainField({ path, label, hint, inputMode, normalize, disabled }) {
    _s2();
    const c = useEditor();
    const value = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$paths$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAt"])(c.spec, path);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
        label: label,
        controlId: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$paths$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["pathId"])(path),
        error: c.errorAt(path),
        hint: hint,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
            value: typeof value === 'string' || typeof value === 'number' ? String(value) : '',
            inputMode: inputMode,
            disabled: c.readOnly || disabled,
            onChange: (e)=>{
                const raw = normalize ? normalize(e.currentTarget.value) : e.currentTarget.value;
                c.set(path, raw === '' ? undefined : raw);
            }
        }, void 0, false, {
            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
            lineNumber: 122,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
        lineNumber: 121,
        columnNumber: 5
    }, this);
}
_s2(PlainField, "yH+qA7utG9Xz+CE9oSrz+9XlOdc=", false, function() {
    return [
        useEditor
    ];
});
_c1 = PlainField;
function BoolField({ path, label }) {
    _s3();
    const c = useEditor();
    const id = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$paths$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["pathId"])(path);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "ed-check",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                id: id,
                type: "checkbox",
                checked: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$paths$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAt"])(c.spec, path) === true,
                disabled: c.readOnly,
                onChange: (e)=>c.set(path, e.currentTarget.checked)
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 140,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                htmlFor: id,
                children: label
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 147,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
        lineNumber: 139,
        columnNumber: 5
    }, this);
}
_s3(BoolField, "yH+qA7utG9Xz+CE9oSrz+9XlOdc=", false, function() {
    return [
        useEditor
    ];
});
_c2 = BoolField;
function EnumField({ path, label, options, optional, onPick }) {
    _s4();
    const c = useEditor();
    const value = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$paths$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAt"])(c.spec, path);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
        label: label,
        controlId: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$paths$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["pathId"])(path),
        error: c.errorAt(path),
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Select"], {
            value: typeof value === 'string' ? value : '',
            disabled: c.readOnly,
            onChange: (e)=>{
                const next = e.currentTarget.value;
                if (onPick) onPick(next);
                else c.set(path, next === '' ? undefined : next);
            },
            children: [
                optional !== undefined && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                    value: "",
                    children: optional
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                    lineNumber: 178,
                    columnNumber: 36
                }, this),
                options.map((o)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                        value: o.value,
                        children: o.label
                    }, o.value, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                        lineNumber: 180,
                        columnNumber: 11
                    }, this))
            ]
        }, void 0, true, {
            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
            lineNumber: 169,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
        lineNumber: 168,
        columnNumber: 5
    }, this);
}
_s4(EnumField, "yH+qA7utG9Xz+CE9oSrz+9XlOdc=", false, function() {
    return [
        useEditor
    ];
});
_c3 = EnumField;
/** Подсказка ALT из библиотеки только на языках сайта; итоговый ALT живёт в документе и правится отдельно */ function suggestedAlt(asset, locales) {
    const alt = Object.fromEntries(Object.entries(asset.defaultAlt ?? {}).filter(([l, t])=>locales.includes(l) && t.trim()));
    return Object.keys(alt).length ? alt : undefined;
}
function Thumb({ assetId, alt }) {
    _s5();
    const c = useEditor();
    const asset = c.assets.find((a)=>a.id === assetId);
    if (!assetId) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        className: "ed-thumb ed-thumb--empty",
        children: "Не выбрано"
    }, void 0, false, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
        lineNumber: 198,
        columnNumber: 24
    }, this);
    if (!asset?.previewUrl) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        className: "ed-thumb ed-thumb--empty",
        children: "Нет в библиотеке"
    }, void 0, false, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
        lineNumber: 199,
        columnNumber: 34
    }, this);
    // подписанный адрес на срок: обычный <img>, оптимизатор Next его не кэширует
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
        className: "ed-thumb",
        src: asset.previewUrl,
        alt: alt || 'Изображение без подписи'
    }, void 0, false, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
        lineNumber: 201,
        columnNumber: 10
    }, this);
}
_s5(Thumb, "yH+qA7utG9Xz+CE9oSrz+9XlOdc=", false, function() {
    return [
        useEditor
    ];
});
_c4 = Thumb;
function ImageField({ path, label, kind, required }) {
    _s6();
    const c = useEditor();
    const value = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$paths$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAt"])(c.spec, path);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("fieldset", {
        className: "ed-group",
        "data-path": (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$paths$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["pathString"])(path),
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("legend", {
                children: label
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 210,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "ed-image",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Thumb, {
                        assetId: value?.assetId,
                        alt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["localizedText"])(value?.alt, c.defaultLocale)
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                        lineNumber: 212,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "ed-image__actions",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                type: "button",
                                tone: "secondary",
                                size: "sm",
                                disabled: c.readOnly,
                                onClick: ()=>c.pickAsset(kind, (asset)=>c.set(path, {
                                            assetId: asset.id,
                                            alt: value?.alt ?? suggestedAlt(asset, c.locales)
                                        })),
                                children: value ? 'Заменить изображение' : 'Выбрать изображение'
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                                lineNumber: 214,
                                columnNumber: 11
                            }, this),
                            value && !required && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                type: "button",
                                tone: "ghost",
                                size: "sm",
                                disabled: c.readOnly,
                                onClick: ()=>c.set(path, undefined),
                                children: "Убрать"
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                                lineNumber: 226,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                        lineNumber: 213,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 211,
                columnNumber: 7
            }, this),
            c.errorAt([
                ...path,
                'assetId'
            ]) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "ed-error",
                children: c.errorAt([
                    ...path,
                    'assetId'
                ])
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 232,
                columnNumber: 43
            }, this),
            !value && c.errorAt(path) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "ed-error",
                children: c.errorAt(path)
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 233,
                columnNumber: 37
            }, this),
            value && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(TextField, {
                path: [
                    ...path,
                    'alt'
                ],
                label: "Подпись для незрячих (ALT)",
                max: 150,
                required: true
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 234,
                columnNumber: 17
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
        lineNumber: 209,
        columnNumber: 5
    }, this);
}
_s6(ImageField, "yH+qA7utG9Xz+CE9oSrz+9XlOdc=", false, function() {
    return [
        useEditor
    ];
});
_c5 = ImageField;
function FaviconField({ path }) {
    _s7();
    const c = useEditor();
    const value = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$paths$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAt"])(c.spec, path);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("fieldset", {
        className: "ed-group",
        "data-path": (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$paths$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["pathString"])(path),
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("legend", {
                children: "Значок сайта"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 245,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "ed-image",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Thumb, {
                        assetId: value,
                        alt: "Значок сайта"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                        lineNumber: 247,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "ed-image__actions",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                type: "button",
                                tone: "secondary",
                                size: "sm",
                                disabled: c.readOnly,
                                onClick: ()=>c.pickAsset('FAVICON', (a)=>c.set(path, a.id)),
                                children: value ? 'Заменить изображение' : 'Выбрать изображение'
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                                lineNumber: 249,
                                columnNumber: 11
                            }, this),
                            value && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                type: "button",
                                tone: "ghost",
                                size: "sm",
                                disabled: c.readOnly,
                                onClick: ()=>c.set(path, undefined),
                                children: "Убрать"
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                                lineNumber: 253,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                        lineNumber: 248,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 246,
                columnNumber: 7
            }, this),
            c.errorAt(path) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "ed-error",
                children: c.errorAt(path)
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 259,
                columnNumber: 27
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
        lineNumber: 244,
        columnNumber: 5
    }, this);
}
_s7(FaviconField, "yH+qA7utG9Xz+CE9oSrz+9XlOdc=", false, function() {
    return [
        useEditor
    ];
});
_c6 = FaviconField;
function ItemControls({ label, index, count, canRemove, onMove, onRemove }) {
    _s8();
    const c = useEditor();
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        className: "ed-item-controls",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                type: "button",
                tone: "ghost",
                size: "sm",
                "aria-label": `${label}: выше`,
                disabled: c.readOnly || index === 0,
                onClick: ()=>onMove(index - 1),
                children: "↑"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 283,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                type: "button",
                tone: "ghost",
                size: "sm",
                "aria-label": `${label}: ниже`,
                disabled: c.readOnly || index === count - 1,
                onClick: ()=>onMove(index + 1),
                children: "↓"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 286,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                type: "button",
                tone: "ghost",
                size: "sm",
                "aria-label": `${label}: удалить`,
                disabled: c.readOnly || !canRemove,
                onClick: onRemove,
                children: "Удалить"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 289,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
        lineNumber: 282,
        columnNumber: 5
    }, this);
}
_s8(ItemControls, "yH+qA7utG9Xz+CE9oSrz+9XlOdc=", false, function() {
    return [
        useEditor
    ];
});
_c7 = ItemControls;
function moved(items, from, to) {
    const out = [
        ...items
    ];
    const [item] = out.splice(from, 1);
    out.splice(to, 0, item);
    return out;
}
function ImagesField({ path, label, min, max }) {
    _s9();
    const c = useEditor();
    const items = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$paths$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAt"])(c.spec, path) ?? [];
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("fieldset", {
        className: "ed-group",
        "data-path": (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$paths$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["pathString"])(path),
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("legend", {
                children: label
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 309,
                columnNumber: 7
            }, this),
            items.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "muted",
                children: "Изображений нет."
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 310,
                columnNumber: 30
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ol", {
                className: "ed-list",
                children: items.map((img, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                        className: "ed-list__item",
                        "data-testid": "ed-gallery-item",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "ed-image",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Thumb, {
                                        assetId: img.assetId,
                                        alt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["localizedText"])(img.alt, c.defaultLocale)
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                                        lineNumber: 315,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ItemControls, {
                                        label: `Изображение ${i + 1}`,
                                        index: i,
                                        count: items.length,
                                        canRemove: items.length > 0,
                                        onMove: (to)=>c.set(path, moved(items, i, to)),
                                        onRemove: ()=>c.set(path, items.filter((_, j)=>j !== i))
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                                        lineNumber: 316,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                                lineNumber: 314,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(TextField, {
                                path: [
                                    ...path,
                                    i,
                                    'alt'
                                ],
                                label: `Подпись изображения ${i + 1} (ALT)`,
                                max: 150,
                                required: true
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                                lineNumber: 325,
                                columnNumber: 13
                            }, this)
                        ]
                    }, `${img.assetId}-${i}`, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                        lineNumber: 313,
                        columnNumber: 11
                    }, this))
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 311,
                columnNumber: 7
            }, this),
            c.errorAt(path) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "ed-error",
                children: c.errorAt(path)
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 329,
                columnNumber: 27
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "ed-row",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                        type: "button",
                        tone: "secondary",
                        size: "sm",
                        disabled: c.readOnly || items.length >= max,
                        "data-testid": "ed-gallery-add",
                        onClick: ()=>c.pickAsset('IMAGE', (asset)=>c.set(path, [
                                    ...items,
                                    {
                                        assetId: asset.id,
                                        alt: suggestedAlt(asset, c.locales)
                                    }
                                ])),
                        children: "Выбрать изображение"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                        lineNumber: 331,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                        className: "ed-link",
                        href: "/marketing/site/assets",
                        children: "Открыть библиотеку изображений"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                        lineNumber: 343,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 330,
                columnNumber: 7
            }, this),
            min > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "muted",
                children: [
                    "Нужно от ",
                    min,
                    " до ",
                    max,
                    " изображений."
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 347,
                columnNumber: 19
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
        lineNumber: 308,
        columnNumber: 5
    }, this);
}
_s9(ImagesField, "yH+qA7utG9Xz+CE9oSrz+9XlOdc=", false, function() {
    return [
        useEditor
    ];
});
_c8 = ImagesField;
const ACTION_LABEL = {
    BOOK: 'Бронирование',
    PHONE: 'Позвонить',
    WHATSAPP: 'Написать в WhatsApp',
    EMAIL: 'Написать на почту',
    PAGE: 'Страница сайта',
    SECTION: 'Секция страницы',
    EXTERNAL: 'Внешняя ссылка'
};
const CTA_KINDS = [
    'BOOK',
    'PAGE',
    'SECTION',
    'PHONE',
    'WHATSAPP',
    'EMAIL',
    'EXTERNAL'
];
const TARGET_KINDS = [
    'PAGE',
    'SECTION',
    'EXTERNAL'
];
function ActionField({ path, label, kinds }) {
    _s10();
    const c = useEditor();
    const value = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$paths$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAt"])(c.spec, path) ?? {};
    const pages = (c.spec['pages'] ?? []).filter((p)=>typeof p['id'] === 'string');
    const page = pages.find((p)=>p['id'] === value['pageId']) ?? pages[0];
    const sections = (page?.['sections'] ?? []).filter((s)=>typeof s['id'] === 'string');
    const kindChange = (kind)=>{
        const home = String(pages[0]?.['id'] ?? '');
        if (kind === 'PAGE') c.set(path, {
            kind,
            pageId: home
        });
        else if (kind === 'SECTION') c.set(path, {
            kind,
            pageId: home,
            sectionId: String(pages[0]?.['sections']?.[0]?.['id'] ?? '')
        });
        else if (kind === 'EXTERNAL') c.set(path, {
            kind,
            url: 'https://'
        });
        else c.set(path, {
            kind
        });
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "ed-action",
        "data-path": (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$paths$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["pathString"])(path),
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(EnumField, {
                path: [
                    ...path,
                    'kind'
                ],
                label: label,
                options: kinds.map((k)=>({
                        value: k,
                        label: ACTION_LABEL[k] ?? k
                    })),
                onPick: kindChange
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 380,
                columnNumber: 7
            }, this),
            (value['kind'] === 'PAGE' || value['kind'] === 'SECTION') && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(EnumField, {
                path: [
                    ...path,
                    'pageId'
                ],
                label: "Страница",
                options: pages.map((p)=>({
                        value: String(p['id']),
                        label: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["localizedText"])(p['title'], c.defaultLocale) || String(p['id'])
                    })),
                onPick: (pageId)=>{
                    const first = pages.find((p)=>p['id'] === pageId)?.['sections']?.[0];
                    c.set(path, value['kind'] === 'SECTION' ? {
                        kind: 'SECTION',
                        pageId,
                        sectionId: String(first?.['id'] ?? '')
                    } : {
                        kind: 'PAGE',
                        pageId
                    });
                }
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 382,
                columnNumber: 9
            }, this),
            value['kind'] === 'SECTION' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(EnumField, {
                path: [
                    ...path,
                    'sectionId'
                ],
                label: "Секция",
                options: sections.map((s)=>({
                        value: String(s['id']),
                        label: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["localizedText"])(s['heading'], c.defaultLocale) || String(s['id'])
                    }))
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 393,
                columnNumber: 9
            }, this),
            value['kind'] === 'EXTERNAL' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(PlainField, {
                path: [
                    ...path,
                    'url'
                ],
                label: "Адрес https://",
                inputMode: "url"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 399,
                columnNumber: 40
            }, this),
            c.errorAt(path) && !c.errorAt([
                ...path,
                'kind'
            ]) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "ed-error",
                children: c.errorAt(path)
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 400,
                columnNumber: 60
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
        lineNumber: 379,
        columnNumber: 5
    }, this);
}
_s10(ActionField, "yH+qA7utG9Xz+CE9oSrz+9XlOdc=", false, function() {
    return [
        useEditor
    ];
});
_c9 = ActionField;
function CtaField({ path, label, required }) {
    _s11();
    const c = useEditor();
    const value = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$paths$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAt"])(c.spec, path);
    if (!value) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("fieldset", {
        className: "ed-group",
        "data-path": (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$paths$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["pathString"])(path),
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("legend", {
                children: label
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 412,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                type: "button",
                tone: "secondary",
                size: "sm",
                disabled: c.readOnly,
                onClick: ()=>c.set(path, {
                        label: {
                            [c.defaultLocale]: 'Забронировать'
                        },
                        action: {
                            kind: 'BOOK'
                        }
                    }),
                children: "Добавить кнопку"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 413,
                columnNumber: 9
            }, this),
            c.errorAt(path) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "ed-error",
                children: c.errorAt(path)
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 422,
                columnNumber: 29
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
        lineNumber: 411,
        columnNumber: 7
    }, this);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("fieldset", {
        className: "ed-group",
        "data-path": (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$paths$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["pathString"])(path),
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("legend", {
                children: label
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 427,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(TextField, {
                path: [
                    ...path,
                    'label'
                ],
                label: "Текст кнопки",
                max: 30,
                required: true
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 428,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ActionField, {
                path: [
                    ...path,
                    'action'
                ],
                label: "Что делает кнопка",
                kinds: CTA_KINDS
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 429,
                columnNumber: 7
            }, this),
            !required && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                type: "button",
                tone: "ghost",
                size: "sm",
                disabled: c.readOnly,
                onClick: ()=>c.set(path, undefined),
                children: "Убрать кнопку"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 431,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
        lineNumber: 426,
        columnNumber: 5
    }, this);
}
_s11(CtaField, "yH+qA7utG9Xz+CE9oSrz+9XlOdc=", false, function() {
    return [
        useEditor
    ];
});
_c10 = CtaField;
function TextListField({ path, label, max, min, maxItems }) {
    _s12();
    const c = useEditor();
    const items = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$paths$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAt"])(c.spec, path) ?? [];
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("fieldset", {
        className: "ed-group",
        "data-path": (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$paths$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["pathString"])(path),
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("legend", {
                children: label
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 445,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ol", {
                className: "ed-list",
                children: items.map((_, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                        className: "ed-list__item",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(TextField, {
                                path: [
                                    ...path,
                                    i
                                ],
                                label: `${label}: ${i + 1}`,
                                max: max,
                                multiline: max > 200,
                                required: true
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                                lineNumber: 449,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ItemControls, {
                                label: `${label} ${i + 1}`,
                                index: i,
                                count: items.length,
                                canRemove: items.length > min,
                                onMove: (to)=>c.set(path, moved(items, i, to)),
                                onRemove: ()=>c.set(path, items.filter((__, j)=>j !== i))
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                                lineNumber: 450,
                                columnNumber: 13
                            }, this)
                        ]
                    }, i, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                        lineNumber: 448,
                        columnNumber: 11
                    }, this))
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 446,
                columnNumber: 7
            }, this),
            c.errorAt(path) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "ed-error",
                children: c.errorAt(path)
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 461,
                columnNumber: 27
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                type: "button",
                tone: "secondary",
                size: "sm",
                disabled: c.readOnly || items.length >= maxItems,
                onClick: ()=>c.set(path, [
                        ...items,
                        {
                            [c.defaultLocale]: 'Новый пункт'
                        }
                    ]),
                children: "Добавить"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 462,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
        lineNumber: 444,
        columnNumber: 5
    }, this);
}
_s12(TextListField, "yH+qA7utG9Xz+CE9oSrz+9XlOdc=", false, function() {
    return [
        useEditor
    ];
});
_c11 = TextListField;
/** Новый элемент списка секции: обязательные поля заполнены на языке по умолчанию, остальные пустые */ function newListItem(fields, c, itemLabel) {
    const item = {};
    for (const f of fields){
        if (!f.required) continue;
        if (f.spec.kind === 'text') item[f.key] = {
            [c.defaultLocale]: f.key === 'title' || f.key === 'label' || f.key === 'question' ? itemLabel : 'Текст'
        };
        else if (f.spec.kind === 'enum') item[f.key] = f.spec.options[0]?.value;
        else if (f.spec.kind === 'category') item[f.key] = c.categories[0]?.code ?? '';
        else if (f.spec.kind === 'weekday') item[f.key] = 1;
        else if (f.spec.kind === 'clock') item[f.key] = f.key === 'close' ? '20:00' : '10:00';
    }
    return item;
}
function ListField({ path, field }) {
    _s13();
    const c = useEditor();
    const { min, max, itemLabel, item } = field.spec;
    const items = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$paths$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAt"])(c.spec, path) ?? [];
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("fieldset", {
        className: "ed-group",
        "data-path": (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$paths$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["pathString"])(path),
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("legend", {
                children: field.label
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 496,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ol", {
                className: "ed-list",
                children: items.map((_, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                        className: "ed-list__item",
                        "data-testid": "ed-list-item",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "ed-list__head",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("b", {
                                        children: [
                                            itemLabel,
                                            " ",
                                            i + 1
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                                        lineNumber: 501,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ItemControls, {
                                        label: `${itemLabel} ${i + 1}`,
                                        index: i,
                                        count: items.length,
                                        canRemove: items.length > min,
                                        onMove: (to)=>c.set(path, moved(items, i, to)),
                                        onRemove: ()=>c.set(path, items.filter((__, j)=>j !== i))
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                                        lineNumber: 504,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                                lineNumber: 500,
                                columnNumber: 13
                            }, this),
                            item.map((f)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(FieldFor, {
                                    field: f,
                                    path: [
                                        ...path,
                                        i,
                                        f.key
                                    ]
                                }, f.key, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                                    lineNumber: 514,
                                    columnNumber: 15
                                }, this))
                        ]
                    }, i, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                        lineNumber: 499,
                        columnNumber: 11
                    }, this))
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 497,
                columnNumber: 7
            }, this),
            c.errorAt(path) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "ed-error",
                children: c.errorAt(path)
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 519,
                columnNumber: 27
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                type: "button",
                tone: "secondary",
                size: "sm",
                disabled: c.readOnly || items.length >= max,
                onClick: ()=>c.set(path, [
                        ...items,
                        newListItem(item, c, itemLabel)
                    ]),
                children: [
                    "Добавить: ",
                    itemLabel.toLowerCase()
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 520,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
        lineNumber: 495,
        columnNumber: 5
    }, this);
}
_s13(ListField, "yH+qA7utG9Xz+CE9oSrz+9XlOdc=", false, function() {
    return [
        useEditor
    ];
});
_c12 = ListField;
/** Категория карточки: только категории брифа точного объекта, своего кода нет */ function CategoryField({ path, label }) {
    _s14();
    const c = useEditor();
    const value = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$paths$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAt"])(c.spec, path);
    const options = c.categories.map((cat)=>({
            value: cat.code,
            label: cat.name
        }));
    if (typeof value === 'string' && value && !options.some((o)=>o.value === value)) options.push({
        value,
        label: 'Нет в данных гостиницы'
    });
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(EnumField, {
        path: path,
        label: label,
        options: options,
        optional: "Выберите категорию"
    }, void 0, false, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
        lineNumber: 540,
        columnNumber: 10
    }, this);
}
_s14(CategoryField, "yH+qA7utG9Xz+CE9oSrz+9XlOdc=", false, function() {
    return [
        useEditor
    ];
});
_c13 = CategoryField;
/** Категории секции цен: только коды карточек размещения этого документа; цена руками не вводится */ function CategoryCodesField({ path, label, hint }) {
    _s15();
    const c = useEditor();
    const value = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$paths$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAt"])(c.spec, path) ?? [];
    const codes = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["accommodationCardCodes"])(c.spec);
    const name = (code)=>c.categories.find((cat)=>cat.code === code)?.name ?? code;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("fieldset", {
        className: "ed-group",
        "data-path": (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$paths$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["pathString"])(path),
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("legend", {
                children: label
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 551,
                columnNumber: 7
            }, this),
            codes.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "muted",
                children: "Сначала добавьте категории в секцию «Номера»."
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 552,
                columnNumber: 30
            }, this),
            codes.map((code)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "ed-check",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                            id: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$paths$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["pathId"])([
                                ...path,
                                code
                            ]),
                            type: "checkbox",
                            checked: value.includes(code),
                            disabled: c.readOnly,
                            onChange: (e)=>c.set(path, e.currentTarget.checked ? [
                                    ...value,
                                    code
                                ] : value.filter((v)=>v !== code))
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                            lineNumber: 555,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                            htmlFor: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$paths$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["pathId"])([
                                ...path,
                                code
                            ]),
                            children: name(code)
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                            lineNumber: 562,
                            columnNumber: 11
                        }, this)
                    ]
                }, code, true, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                    lineNumber: 554,
                    columnNumber: 9
                }, this)),
            hint && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "muted",
                children: hint
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 565,
                columnNumber: 16
            }, this),
            c.errorAt(path) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "ed-error",
                children: c.errorAt(path)
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 566,
                columnNumber: 27
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
        lineNumber: 550,
        columnNumber: 5
    }, this);
}
_s15(CategoryCodesField, "yH+qA7utG9Xz+CE9oSrz+9XlOdc=", false, function() {
    return [
        useEditor
    ];
});
_c14 = CategoryCodesField;
function MapField({ path, label }) {
    _s16();
    const c = useEditor();
    const id = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$paths$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["pathId"])(path);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "ed-check",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                id: id,
                type: "checkbox",
                checked: !!(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$paths$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAt"])(c.spec, path),
                disabled: c.readOnly,
                onChange: (e)=>c.set(path, e.currentTarget.checked ? {
                        provider: 'OPENSTREETMAP_LINK'
                    } : undefined)
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 576,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                htmlFor: id,
                children: [
                    label,
                    ": ссылка на OpenStreetMap по координатам из контактов"
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 583,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
        lineNumber: 575,
        columnNumber: 5
    }, this);
}
_s16(MapField, "yH+qA7utG9Xz+CE9oSrz+9XlOdc=", false, function() {
    return [
        useEditor
    ];
});
_c15 = MapField;
/** SITE-2: целое число (длительность, выход блюда); пусто снимает необязательное поле */ function IntField({ path, label, min, max, hint }) {
    _s17();
    const c = useEditor();
    const value = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$paths$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAt"])(c.spec, path);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
        label: label,
        controlId: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$paths$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["pathId"])(path),
        error: c.errorAt(path),
        hint: hint,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
            type: "number",
            inputMode: "numeric",
            min: min,
            max: max,
            step: 1,
            value: typeof value === 'number' ? String(value) : '',
            disabled: c.readOnly,
            onChange: (e)=>{
                const raw = e.currentTarget.value.trim();
                c.set(path, raw === '' ? undefined : Number(raw));
            }
        }, void 0, false, {
            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
            lineNumber: 594,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
        lineNumber: 593,
        columnNumber: 5
    }, this);
}
_s17(IntField, "yH+qA7utG9Xz+CE9oSrz+9XlOdc=", false, function() {
    return [
        useEditor
    ];
});
_c16 = IntField;
/** SITE-2: время ЧЧ:ММ */ function ClockField({ path, label }) {
    _s18();
    const c = useEditor();
    const value = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$paths$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAt"])(c.spec, path);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
        label: label,
        controlId: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$paths$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["pathId"])(path),
        error: c.errorAt(path),
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
            type: "time",
            step: 60,
            value: typeof value === 'string' ? value : '',
            disabled: c.readOnly,
            onChange: (e)=>c.set(path, e.currentTarget.value || undefined)
        }, void 0, false, {
            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
            lineNumber: 617,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
        lineNumber: 616,
        columnNumber: 5
    }, this);
}
_s18(ClockField, "yH+qA7utG9Xz+CE9oSrz+9XlOdc=", false, function() {
    return [
        useEditor
    ];
});
_c17 = ClockField;
/** SITE-2: день недели числом в документе (0 воскресенье), выбор с понедельника */ function WeekdayField({ path, label }) {
    _s19();
    const c = useEditor();
    const value = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$paths$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAt"])(c.spec, path);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
        label: label,
        controlId: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$paths$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["pathId"])(path),
        error: c.errorAt(path),
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Select"], {
            value: typeof value === 'number' ? String(value) : '',
            disabled: c.readOnly,
            onChange: (e)=>c.set(path, Number(e.currentTarget.value)),
            children: __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["WEEKDAY_OPTIONS"].map((o)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                    value: o.value,
                    children: o.label
                }, o.value, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                    lineNumber: 630,
                    columnNumber: 11
                }, this))
        }, void 0, false, {
            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
            lineNumber: 628,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
        lineNumber: 627,
        columnNumber: 5
    }, this);
}
_s19(WeekdayField, "yH+qA7utG9Xz+CE9oSrz+9XlOdc=", false, function() {
    return [
        useEditor
    ];
});
_c18 = WeekdayField;
/**
 * SITE-2: ссылка на запись WETOP и цена снимком: только для чтения. Их ставит заготовка из данных филиала, на сайте
 * они меняются только обновлением из данных WETOP (план SITE-2), а не рукой и не ИИ
 */ function DataRefField({ path, label, hint }) {
    _s20();
    const c = useEditor();
    const value = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$paths$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAt"])(c.spec, path);
    const text = value && typeof value === 'object' && 'minor' in value ? `${value.minor} (${value.currency}, в минимальных единицах)` : typeof value === 'string' ? value : 'нет';
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
        label: label,
        controlId: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$paths$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["pathId"])(path),
        error: c.errorAt(path),
        hint: hint ?? 'Из данных WETOP, на сайте не правится',
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
            value: text,
            readOnly: true,
            disabled: true
        }, void 0, false, {
            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
            lineNumber: 654,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
        lineNumber: 653,
        columnNumber: 5
    }, this);
}
_s20(DataRefField, "yH+qA7utG9Xz+CE9oSrz+9XlOdc=", false, function() {
    return [
        useEditor
    ];
});
_c19 = DataRefField;
function FieldFor({ field, path }) {
    const s = field.spec;
    switch(s.kind){
        case 'text':
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(TextField, {
                path: path,
                label: field.label,
                max: s.max,
                multiline: s.multiline,
                required: field.required
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 664,
                columnNumber: 14
            }, this);
        case 'textList':
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(TextListField, {
                path: path,
                label: field.label,
                max: s.max,
                min: s.min,
                maxItems: s.maxItems
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 666,
                columnNumber: 14
            }, this);
        case 'bool':
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(BoolField, {
                path: path,
                label: field.label
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 668,
                columnNumber: 14
            }, this);
        case 'enum':
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(EnumField, {
                path: path,
                label: field.label,
                options: s.options
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 670,
                columnNumber: 14
            }, this);
        case 'image':
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ImageField, {
                path: path,
                label: field.label,
                kind: "IMAGE",
                required: field.required
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 672,
                columnNumber: 14
            }, this);
        case 'images':
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ImagesField, {
                path: path,
                label: field.label,
                min: s.min,
                max: s.max
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 674,
                columnNumber: 14
            }, this);
        case 'cta':
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(CtaField, {
                path: path,
                label: field.label,
                required: field.required
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 676,
                columnNumber: 14
            }, this);
        case 'category':
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(CategoryField, {
                path: path,
                label: field.label
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 678,
                columnNumber: 14
            }, this);
        case 'categoryCodes':
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(CategoryCodesField, {
                path: path,
                label: field.label,
                hint: field.hint
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 680,
                columnNumber: 14
            }, this);
        case 'map':
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(MapField, {
                path: path,
                label: field.label
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 682,
                columnNumber: 14
            }, this);
        case 'list':
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ListField, {
                path: path,
                field: field
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 684,
                columnNumber: 14
            }, this);
        case 'int':
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(IntField, {
                path: path,
                label: field.label,
                min: s.min,
                max: s.max,
                hint: field.hint
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 686,
                columnNumber: 14
            }, this);
        case 'clock':
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ClockField, {
                path: path,
                label: field.label
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 688,
                columnNumber: 14
            }, this);
        case 'weekday':
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(WeekdayField, {
                path: path,
                label: field.label
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 690,
                columnNumber: 14
            }, this);
        case 'dataRef':
        case 'money':
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(DataRefField, {
                path: path,
                label: field.label,
                hint: field.hint
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx",
                lineNumber: 693,
                columnNumber: 14
            }, this);
    }
}
_c20 = FieldFor;
var _c, _c1, _c2, _c3, _c4, _c5, _c6, _c7, _c8, _c9, _c10, _c11, _c12, _c13, _c14, _c15, _c16, _c17, _c18, _c19, _c20;
__turbopack_context__.k.register(_c, "TextField");
__turbopack_context__.k.register(_c1, "PlainField");
__turbopack_context__.k.register(_c2, "BoolField");
__turbopack_context__.k.register(_c3, "EnumField");
__turbopack_context__.k.register(_c4, "Thumb");
__turbopack_context__.k.register(_c5, "ImageField");
__turbopack_context__.k.register(_c6, "FaviconField");
__turbopack_context__.k.register(_c7, "ItemControls");
__turbopack_context__.k.register(_c8, "ImagesField");
__turbopack_context__.k.register(_c9, "ActionField");
__turbopack_context__.k.register(_c10, "CtaField");
__turbopack_context__.k.register(_c11, "TextListField");
__turbopack_context__.k.register(_c12, "ListField");
__turbopack_context__.k.register(_c13, "CategoryField");
__turbopack_context__.k.register(_c14, "CategoryCodesField");
__turbopack_context__.k.register(_c15, "MapField");
__turbopack_context__.k.register(_c16, "IntField");
__turbopack_context__.k.register(_c17, "ClockField");
__turbopack_context__.k.register(_c18, "WeekdayField");
__turbopack_context__.k.register(_c19, "DataRefField");
__turbopack_context__.k.register(_c20, "FieldFor");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "PageForm",
    ()=>PageForm,
    "SectionForm",
    ()=>SectionForm,
    "SiteForm",
    ()=>SiteForm
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/index.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/editor.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$spec$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/site-spec.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/ui.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$paths$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/site/editor/paths.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature(), _s2 = __turbopack_context__.k.signature(), _s3 = __turbopack_context__.k.signature(), _s4 = __turbopack_context__.k.signature(), _s5 = __turbopack_context__.k.signature(), _s6 = __turbopack_context__.k.signature(), _s7 = __turbopack_context__.k.signature();
'use client';
;
;
;
;
;
function Group({ title, children, testId }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("fieldset", {
        className: "ed-group",
        "data-testid": testId,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("legend", {
                children: title
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                lineNumber: 41,
                columnNumber: 7
            }, this),
            children
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
        lineNumber: 40,
        columnNumber: 5
    }, this);
}
_c = Group;
const THEME_LABEL = {
    preset: 'Настроение',
    accent: 'Цвет акцента',
    typography: 'Шрифт',
    radius: 'Углы',
    density: 'Плотность',
    colorScheme: 'Схема'
};
/** Языки: включить или снять; язык по умолчанию снять нельзя, пока другой не выбран по умолчанию (§17) */ function LocalesField() {
    _s();
    const c = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEditor"])();
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Group, {
        title: "Языки сайта",
        testId: "ed-locales",
        children: [
            __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["EDITOR_LOCALES"].map((l)=>{
                const on = c.locales.includes(l);
                const isDefault = l === c.defaultLocale;
                const id = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$paths$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["pathId"])([
                    'site',
                    'locales',
                    l
                ]);
                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "ed-check",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                            id: id,
                            type: "checkbox",
                            checked: on,
                            disabled: c.readOnly || isDefault,
                            onChange: (e)=>{
                                if (e.currentTarget.checked) c.set([
                                    'site',
                                    'locales'
                                ], [
                                    ...c.locales,
                                    l
                                ]);
                                else c.set([], (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["removeLocale"])(c.spec, l));
                            }
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                            lineNumber: 67,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                            htmlFor: id,
                            children: [
                                __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["LOCALE_LABEL"][l],
                                isDefault ? ' (по умолчанию)' : ''
                            ]
                        }, void 0, true, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                            lineNumber: 77,
                            columnNumber: 13
                        }, this)
                    ]
                }, l, true, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                    lineNumber: 66,
                    columnNumber: 11
                }, this);
            }),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["EnumField"], {
                path: [
                    'site',
                    'defaultLocale'
                ],
                label: "Язык по умолчанию",
                options: c.locales.map((l)=>({
                        value: l,
                        label: __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["LOCALE_LABEL"][l] ?? l
                    }))
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                lineNumber: 84,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "muted",
                children: "Новый язык не заполняется копией русского: тексты на нём добавьте сами."
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                lineNumber: 89,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
        lineNumber: 60,
        columnNumber: 5
    }, this);
}
_s(LocalesField, "yH+qA7utG9Xz+CE9oSrz+9XlOdc=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEditor"]
    ];
});
_c1 = LocalesField;
function SocialField() {
    _s1();
    const c = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEditor"])();
    const path = [
        'site',
        'contacts',
        'social'
    ];
    const items = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$paths$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAt"])(c.spec, path) ?? [];
    const networks = Object.keys(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$spec$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SITE_SPEC_SOCIAL_HOSTS"]).map((n)=>({
            value: n,
            label: n.charAt(0) + n.slice(1).toLowerCase()
        }));
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Group, {
        title: "Соцсети",
        children: [
            items.map((_, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "ed-list__item",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["EnumField"], {
                            path: [
                                ...path,
                                i,
                                'network'
                            ],
                            label: `Сеть ${i + 1}`,
                            options: networks
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                            lineNumber: 103,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PlainField"], {
                            path: [
                                ...path,
                                i,
                                'url'
                            ],
                            label: `Адрес ${i + 1}`,
                            inputMode: "url"
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                            lineNumber: 104,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ItemControls"], {
                            label: `Соцсеть ${i + 1}`,
                            index: i,
                            count: items.length,
                            canRemove: true,
                            onMove: (to)=>{
                                const next = [
                                    ...items
                                ];
                                const [item] = next.splice(i, 1);
                                next.splice(to, 0, item);
                                c.set(path, next);
                            },
                            onRemove: ()=>c.set(path, items.filter((__, j)=>j !== i))
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                            lineNumber: 105,
                            columnNumber: 11
                        }, this)
                    ]
                }, i, true, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                    lineNumber: 102,
                    columnNumber: 9
                }, this)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                type: "button",
                tone: "secondary",
                size: "sm",
                disabled: c.readOnly || items.length >= 6,
                onClick: ()=>c.set(path, [
                        ...items,
                        {
                            network: 'INSTAGRAM',
                            url: 'https://www.instagram.com/'
                        }
                    ]),
                children: "Добавить соцсеть"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                lineNumber: 120,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
        lineNumber: 100,
        columnNumber: 5
    }, this);
}
_s1(SocialField, "yH+qA7utG9Xz+CE9oSrz+9XlOdc=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEditor"]
    ];
});
_c2 = SocialField;
function GeoField() {
    _s2();
    const c = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEditor"])();
    const path = [
        'site',
        'contacts',
        'geo'
    ];
    const geo = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$paths$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAt"])(c.spec, path);
    const [draft, setDraft] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        lat: geo?.lat?.toString() ?? '',
        lng: geo?.lng?.toString() ?? ''
    });
    const apply = (next)=>{
        setDraft(next);
        const lat = Number(next.lat.replace(',', '.'));
        const lng = Number(next.lng.replace(',', '.'));
        if (next.lat.trim() === '' && next.lng.trim() === '') c.set(path, undefined);
        else c.set(path, {
            lat: Number.isFinite(lat) ? lat : next.lat,
            lng: Number.isFinite(lng) ? lng : next.lng
        });
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "ed-row",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                label: "Широта",
                controlId: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$paths$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["pathId"])([
                    ...path,
                    'lat'
                ]),
                error: c.errorAt([
                    ...path,
                    'lat'
                ]),
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                    inputMode: "decimal",
                    value: draft.lat,
                    disabled: c.readOnly,
                    onChange: (e)=>apply({
                            ...draft,
                            lat: e.currentTarget.value
                        })
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                    lineNumber: 148,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                lineNumber: 147,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                label: "Долгота",
                controlId: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$paths$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["pathId"])([
                    ...path,
                    'lng'
                ]),
                error: c.errorAt([
                    ...path,
                    'lng'
                ]),
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                    inputMode: "decimal",
                    value: draft.lng,
                    disabled: c.readOnly,
                    onChange: (e)=>apply({
                            ...draft,
                            lng: e.currentTarget.value
                        })
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                    lineNumber: 151,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                lineNumber: 150,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
        lineNumber: 146,
        columnNumber: 5
    }, this);
}
_s2(GeoField, "iabqNqbnMDRevqFwQjeiegvkpQo=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEditor"]
    ];
});
_c3 = GeoField;
/** Пункты шапки или подвала: подпись и цель (страница, секция, внешняя ссылка) */ function NavList({ which, max, labelMax }) {
    _s3();
    const c = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEditor"])();
    const path = [
        'navigation',
        which
    ];
    const items = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$paths$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAt"])(c.spec, path) ?? [];
    const title = which === 'header' ? 'Меню в шапке' : 'Ссылки в подвале';
    const pages = c.spec['pages'] ?? [];
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Group, {
        title: title,
        testId: `ed-nav-${which}`,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ol", {
                className: "ed-list",
                children: items.map((_, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                        className: "ed-list__item",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TextField"], {
                                path: [
                                    ...path,
                                    i,
                                    'label'
                                ],
                                label: `Пункт ${i + 1}`,
                                max: labelMax,
                                required: true
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                                lineNumber: 169,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ActionField"], {
                                path: [
                                    ...path,
                                    i,
                                    'target'
                                ],
                                label: "Куда ведёт",
                                kinds: __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TARGET_KINDS"]
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                                lineNumber: 170,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ItemControls"], {
                                label: `Пункт ${i + 1}`,
                                index: i,
                                count: items.length,
                                canRemove: true,
                                onMove: (to)=>{
                                    const next = [
                                        ...items
                                    ];
                                    const [item] = next.splice(i, 1);
                                    next.splice(to, 0, item);
                                    c.set(path, next);
                                },
                                onRemove: ()=>c.set(path, items.filter((__, j)=>j !== i))
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                                lineNumber: 171,
                                columnNumber: 13
                            }, this)
                        ]
                    }, i, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                        lineNumber: 168,
                        columnNumber: 11
                    }, this))
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                lineNumber: 166,
                columnNumber: 7
            }, this),
            c.errorAt(path) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "ed-error",
                children: c.errorAt(path)
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                lineNumber: 187,
                columnNumber: 27
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                type: "button",
                tone: "secondary",
                size: "sm",
                disabled: c.readOnly || items.length >= max,
                onClick: ()=>c.set(path, [
                        ...items,
                        {
                            label: {
                                [c.defaultLocale]: 'Пункт'
                            },
                            target: {
                                kind: 'PAGE',
                                pageId: String(pages[0]?.['id'] ?? '')
                            }
                        }
                    ]),
                children: "Добавить пункт"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                lineNumber: 188,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
        lineNumber: 165,
        columnNumber: 5
    }, this);
}
_s3(NavList, "yH+qA7utG9Xz+CE9oSrz+9XlOdc=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEditor"]
    ];
});
_c4 = NavList;
function SiteForm({ part }) {
    _s4();
    const c = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEditor"])();
    const analytics = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$paths$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAt"])(c.spec, [
        'integrations',
        'analytics',
        'mode'
    ]);
    const pages = c.spec['pages'] ?? [];
    const legal = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$paths$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAt"])(c.spec, [
        'site',
        'legal'
    ]);
    if (part === 'design') return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "ed-form",
        "data-testid": "ed-design-form",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                className: "ed-form__title",
                children: "Дизайн сайта"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                lineNumber: 215,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Group, {
                title: "Оформление",
                testId: "ed-theme",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "ed-grid",
                    children: Object.keys(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["THEME_OPTIONS"]).map((key)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["EnumField"], {
                            path: [
                                'theme',
                                key
                            ],
                            label: THEME_LABEL[key],
                            options: __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["THEME_OPTIONS"][key]
                        }, key, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                            lineNumber: 219,
                            columnNumber: 13
                        }, this))
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                    lineNumber: 217,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                lineNumber: 216,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Group, {
                title: "Логотип и значок",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ImageField"], {
                        path: [
                            'site',
                            'brand',
                            'logo'
                        ],
                        label: "Логотип",
                        kind: "LOGO",
                        required: false
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                        lineNumber: 224,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FaviconField"], {
                        path: [
                            'site',
                            'brand',
                            'faviconAssetId'
                        ]
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                        lineNumber: 225,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                lineNumber: 223,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
        lineNumber: 214,
        columnNumber: 7
    }, this);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "ed-form",
        "data-testid": "ed-site-form",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                className: "ed-form__title",
                children: "Настройки сайта"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                lineNumber: 231,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Group, {
                title: "Название",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TextField"], {
                        path: [
                            'site',
                            'displayName'
                        ],
                        label: "Название сайта",
                        max: 80,
                        required: true
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                        lineNumber: 233,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TextField"], {
                        path: [
                            'site',
                            'brand',
                            'tagline'
                        ],
                        label: "Слоган",
                        max: 120
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                        lineNumber: 234,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                lineNumber: 232,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(LocalesField, {}, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                lineNumber: 236,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Group, {
                title: "Контакты",
                testId: "ed-contacts",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PlainField"], {
                        path: [
                            'site',
                            'contacts',
                            'phone'
                        ],
                        label: "Телефон",
                        hint: "В виде +77010000000",
                        inputMode: "tel"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                        lineNumber: 238,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PlainField"], {
                        path: [
                            'site',
                            'contacts',
                            'whatsapp'
                        ],
                        label: "WhatsApp",
                        hint: "В виде +77010000000",
                        inputMode: "tel"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                        lineNumber: 239,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PlainField"], {
                        path: [
                            'site',
                            'contacts',
                            'email'
                        ],
                        label: "Почта",
                        inputMode: "email"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                        lineNumber: 240,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TextField"], {
                        path: [
                            'site',
                            'contacts',
                            'address'
                        ],
                        label: "Адрес",
                        max: 200
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                        lineNumber: 241,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(GeoField, {}, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                        lineNumber: 242,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                lineNumber: 237,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SocialField, {}, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                lineNumber: 244,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Group, {
                title: "Бронирование и аналитика",
                testId: "ed-integrations",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["EnumField"], {
                        path: [
                            'integrations',
                            'booking',
                            'mode'
                        ],
                        label: "Бронирование на сайте",
                        options: [
                            {
                                value: 'WETOP_WIDGET',
                                label: 'Форма бронирования WETOP'
                            },
                            {
                                value: 'NONE',
                                label: 'Без бронирования'
                            }
                        ]
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                        lineNumber: 246,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "muted",
                        children: "Тариф бронирования выбирается при публикации."
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                        lineNumber: 254,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["EnumField"], {
                        path: [
                            'integrations',
                            'analytics',
                            'mode'
                        ],
                        label: "Аналитика посещений",
                        options: [
                            {
                                value: 'WETOP_TRACKER',
                                label: 'Счётчик WETOP'
                            },
                            {
                                value: 'NONE',
                                label: 'Без аналитики'
                            }
                        ]
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                        lineNumber: 255,
                        columnNumber: 9
                    }, this),
                    analytics === 'WETOP_TRACKER' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["EnumField"], {
                        path: [
                            'integrations',
                            'analytics',
                            'consent'
                        ],
                        label: "Согласие посетителя",
                        options: [
                            {
                                value: 'NOT_REQUIRED',
                                label: 'Не спрашивать'
                            },
                            {
                                value: 'WAIT_FOR_CONSENT',
                                label: 'Ждать согласия'
                            }
                        ]
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                        lineNumber: 264,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                lineNumber: 245,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Group, {
                title: "SEO сайта",
                testId: "ed-site-seo",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["EnumField"], {
                        path: [
                            'site',
                            'seo',
                            'robots'
                        ],
                        label: "Поисковики",
                        options: [
                            {
                                value: 'INDEX',
                                label: 'Показывать в поиске'
                            },
                            {
                                value: 'NOINDEX',
                                label: 'Не показывать в поиске'
                            }
                        ]
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                        lineNumber: 275,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TextField"], {
                        path: [
                            'site',
                            'seo',
                            'titleTemplate'
                        ],
                        label: "Шаблон заголовка (одно %s)",
                        max: 80
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                        lineNumber: 283,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["EnumField"], {
                        path: [
                            'site',
                            'seo',
                            'structuredData',
                            'type'
                        ],
                        label: "Тип объекта для поисковиков",
                        options: [
                            {
                                value: 'HOTEL',
                                label: 'Гостиница'
                            },
                            {
                                value: 'HOSTEL',
                                label: 'Хостел'
                            },
                            {
                                value: 'APARTMENT',
                                label: 'Апартаменты'
                            },
                            {
                                value: 'LODGING',
                                label: 'Жильё'
                            }
                        ]
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                        lineNumber: 284,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BoolField"], {
                        path: [
                            'site',
                            'seo',
                            'structuredData',
                            'includeAddress'
                        ],
                        label: "Передавать адрес поисковикам"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                        lineNumber: 294,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BoolField"], {
                        path: [
                            'site',
                            'seo',
                            'structuredData',
                            'includeGeo'
                        ],
                        label: "Передавать координаты поисковикам"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                        lineNumber: 295,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                lineNumber: 274,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Group, {
                title: "Юридические данные",
                children: legal ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TextField"], {
                            path: [
                                'site',
                                'legal',
                                'operatorName'
                            ],
                            label: "Оператор сайта",
                            max: 200
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                            lineNumber: 300,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["EnumField"], {
                            path: [
                                'site',
                                'legal',
                                'privacyPageId'
                            ],
                            label: "Страница политики конфиденциальности",
                            optional: "Не выбрана",
                            options: pages.map((p)=>({
                                    value: String(p['id']),
                                    label: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["localizedText"])(p['title'], c.defaultLocale)
                                }))
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                            lineNumber: 301,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                    lineNumber: 299,
                    columnNumber: 11
                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                    type: "button",
                    tone: "secondary",
                    size: "sm",
                    disabled: c.readOnly,
                    onClick: ()=>c.set([
                            'site',
                            'legal'
                        ], {}),
                    children: "Добавить юридические данные"
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                    lineNumber: 309,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                lineNumber: 297,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(NavList, {
                which: "header",
                max: 7,
                labelMax: 30
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                lineNumber: 314,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CtaField"], {
                path: [
                    'navigation',
                    'headerCta'
                ],
                label: "Кнопка в шапке",
                required: false
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                lineNumber: 315,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(NavList, {
                which: "footer",
                max: 12,
                labelMax: 40
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                lineNumber: 316,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
        lineNumber: 230,
        columnNumber: 5
    }, this);
}
_s4(SiteForm, "yH+qA7utG9Xz+CE9oSrz+9XlOdc=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEditor"]
    ];
});
_c5 = SiteForm;
function PageForm({ pageIndex }) {
    _s5();
    const c = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEditor"])();
    const path = [
        'pages',
        pageIndex
    ];
    const page = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$paths$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAt"])(c.spec, path);
    const home = page['isHome'] === true;
    const og = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$paths$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAt"])(c.spec, [
        ...path,
        'seo',
        'og'
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "ed-form",
        "data-testid": "ed-page-form",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                className: "ed-form__title",
                children: [
                    "Страница: ",
                    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["localizedText"])(page['title'], c.defaultLocale) || 'без названия'
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                lineNumber: 330,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Group, {
                title: "Страница",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TextField"], {
                        path: [
                            ...path,
                            'title'
                        ],
                        label: "Название страницы",
                        max: 70,
                        required: true
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                        lineNumber: 332,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PlainField"], {
                        path: [
                            ...path,
                            'slug'
                        ],
                        label: "Адрес страницы",
                        hint: home ? 'У главной страницы адрес пустой' : 'Латиница, цифры и дефис',
                        normalize: __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["normalizePageSlug"],
                        disabled: home
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                        lineNumber: 333,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                lineNumber: 331,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Group, {
                title: "SEO страницы",
                testId: "ed-page-seo",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TextField"], {
                        path: [
                            ...path,
                            'seo',
                            'title'
                        ],
                        label: "Заголовок для поисковиков",
                        max: 60
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                        lineNumber: 342,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TextField"], {
                        path: [
                            ...path,
                            'seo',
                            'description'
                        ],
                        label: "Описание для поисковиков",
                        max: 160,
                        multiline: true
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                        lineNumber: 343,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BoolField"], {
                        path: [
                            ...path,
                            'seo',
                            'index'
                        ],
                        label: "Показывать страницу в поиске"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                        lineNumber: 344,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BoolField"], {
                        path: [
                            ...path,
                            'seo',
                            'includeInSitemap'
                        ],
                        label: "Включить в карту сайта"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                        lineNumber: 345,
                        columnNumber: 9
                    }, this),
                    og ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TextField"], {
                                path: [
                                    ...path,
                                    'seo',
                                    'og',
                                    'title'
                                ],
                                label: "Заголовок для соцсетей",
                                max: 70
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                                lineNumber: 348,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TextField"], {
                                path: [
                                    ...path,
                                    'seo',
                                    'og',
                                    'description'
                                ],
                                label: "Описание для соцсетей",
                                max: 200,
                                multiline: true
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                                lineNumber: 349,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(PickOgImage, {
                                path: [
                                    ...path,
                                    'seo',
                                    'og'
                                ]
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                                lineNumber: 350,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                        lineNumber: 347,
                        columnNumber: 11
                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                        type: "button",
                        tone: "secondary",
                        size: "sm",
                        disabled: c.readOnly,
                        onClick: ()=>c.set([
                                ...path,
                                'seo',
                                'og'
                            ], {}),
                        children: "Настроить вид в соцсетях"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                        lineNumber: 353,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                lineNumber: 341,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
        lineNumber: 329,
        columnNumber: 5
    }, this);
}
_s5(PageForm, "yH+qA7utG9Xz+CE9oSrz+9XlOdc=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEditor"]
    ];
});
_c6 = PageForm;
function PickOgImage({ path }) {
    _s6();
    const c = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEditor"])();
    const assetId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$paths$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAt"])(c.spec, [
        ...path,
        'imageAssetId'
    ]);
    const asset = c.assets.find((a)=>a.id === assetId);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "ed-image",
        "data-path": `${path.join('.')}.imageAssetId`,
        children: [
            asset?.previewUrl ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                className: "ed-thumb",
                src: asset.previewUrl,
                alt: "Картинка для соцсетей"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                lineNumber: 368,
                columnNumber: 28
            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "ed-thumb ed-thumb--empty",
                children: assetId ? 'Нет в библиотеке' : 'Не выбрано'
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                lineNumber: 368,
                columnNumber: 110
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "ed-image__actions",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                        type: "button",
                        tone: "secondary",
                        size: "sm",
                        disabled: c.readOnly,
                        onClick: ()=>c.pickAsset('IMAGE', (a)=>c.set([
                                    ...path,
                                    'imageAssetId'
                                ], a.id)),
                        children: assetId ? 'Заменить картинку для соцсетей' : 'Выбрать картинку для соцсетей'
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                        lineNumber: 370,
                        columnNumber: 9
                    }, this),
                    assetId && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                        type: "button",
                        tone: "ghost",
                        size: "sm",
                        disabled: c.readOnly,
                        onClick: ()=>c.set([
                                ...path,
                                'imageAssetId'
                            ], undefined),
                        children: "Убрать"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                        lineNumber: 374,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                lineNumber: 369,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
        lineNumber: 367,
        columnNumber: 5
    }, this);
}
_s6(PickOgImage, "yH+qA7utG9Xz+CE9oSrz+9XlOdc=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEditor"]
    ];
});
_c7 = PickOgImage;
function SectionForm({ pageIndex, sectionIndex, ai }) {
    _s7();
    const c = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEditor"])();
    const path = [
        'pages',
        pageIndex,
        'sections',
        sectionIndex
    ];
    const section = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$paths$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAt"])(c.spec, path);
    const shape = __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SITE_EDITOR_SECTIONS"][String(section['type'])];
    if (!shape) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
        className: "ed-error",
        children: "Секции этого вида нет в редакторе."
    }, void 0, false, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
        lineNumber: 397,
        columnNumber: 22
    }, this);
    const variant = String(section['variant']);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "ed-form",
        "data-testid": "ed-section-form",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                className: "ed-form__title",
                children: [
                    shape.label,
                    ": ",
                    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["localizedText"])(section['heading'], c.defaultLocale) || 'без заголовка'
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                lineNumber: 401,
                columnNumber: 7
            }, this),
            ai,
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["EnumField"], {
                path: [
                    ...path,
                    'variant'
                ],
                label: "Вид секции",
                options: shape.variants,
                onPick: (next)=>c.set(path, (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["applySectionVariant"])(section, next))
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                lineNumber: 405,
                columnNumber: 7
            }, this),
            shape.fields.filter((f)=>!f.variants || f.variants.includes(variant)).map((f)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FieldFor"], {
                    field: f,
                    path: [
                        ...path,
                        f.key
                    ]
                }, f.key, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
                    lineNumber: 414,
                    columnNumber: 11
                }, this))
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/forms.tsx",
        lineNumber: 400,
        columnNumber: 5
    }, this);
}
_s7(SectionForm, "yH+qA7utG9Xz+CE9oSrz+9XlOdc=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEditor"]
    ];
});
_c8 = SectionForm;
var _c, _c1, _c2, _c3, _c4, _c5, _c6, _c7, _c8;
__turbopack_context__.k.register(_c, "Group");
__turbopack_context__.k.register(_c1, "LocalesField");
__turbopack_context__.k.register(_c2, "SocialField");
__turbopack_context__.k.register(_c3, "GeoField");
__turbopack_context__.k.register(_c4, "NavList");
__turbopack_context__.k.register(_c5, "SiteForm");
__turbopack_context__.k.register(_c6, "PageForm");
__turbopack_context__.k.register(_c7, "PickOgImage");
__turbopack_context__.k.register(_c8, "SectionForm");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/app/marketing/site/editor/knowledge.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ProjectKnowledge",
    ()=>ProjectKnowledge
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/index.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$builder$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/builder.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/ui.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$data$3a$adddb1__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/site/editor/data:adddb1 [app-client] (ecmascript) <text/javascript>");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
;
function ProjectKnowledge({ initial, readOnly }) {
    _s();
    const [saved, setSaved] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(initial ?? '');
    const [text, setText] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(initial ?? '');
    const [state, setState] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [busy, setBusy] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const changed = text.trim() !== saved.trim();
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        className: "ed-form",
        "aria-labelledby": "ed-knowledge-title",
        "data-testid": "ed-knowledge",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                id: "ed-knowledge-title",
                className: "ed-form__title",
                children: "Знания проекта"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/knowledge.tsx",
                lineNumber: 20,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
                onSubmit: async (e)=>{
                    e.preventDefault();
                    if (!changed || busy) return;
                    setBusy(true);
                    const r = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$data$3a$adddb1__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__["saveContextAction"])(text);
                    setBusy(false);
                    if (!r.ok) return setState({
                        tone: 'error',
                        text: r.message
                    });
                    setSaved(r.data.instructions ?? '');
                    setText(r.data.instructions ?? '');
                    setState({
                        tone: 'ok',
                        text: 'Знания проекта сохранены: ИИ учтёт их в следующих запросах'
                    });
                },
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                        label: "Что ИИ должен всегда учитывать на этом сайте",
                        controlId: "ed-knowledge-text",
                        hint: "Например: тон спокойный, без восклицаний; подчёркивать тишину и близость к вокзалу. Цены и контакты ИИ всё равно берёт только из данных филиала.",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Textarea"], {
                            rows: 5,
                            maxLength: __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$builder$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BUILDER_INSTRUCTIONS_MAX"],
                            value: text,
                            disabled: readOnly,
                            onChange: (e)=>setText(e.currentTarget.value)
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/knowledge.tsx",
                            lineNumber: 41,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/knowledge.tsx",
                        lineNumber: 36,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "ed-row",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                type: "submit",
                                size: "sm",
                                disabled: readOnly || !changed || busy,
                                "data-testid": "ed-knowledge-save",
                                children: busy ? 'Сохраняем…' : 'Сохранить знания'
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/knowledge.tsx",
                                lineNumber: 44,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "muted",
                                children: [
                                    [
                                        ...text
                                    ].length,
                                    " из ",
                                    __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$builder$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BUILDER_INSTRUCTIONS_MAX"]
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/knowledge.tsx",
                                lineNumber: 47,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/knowledge.tsx",
                        lineNumber: 43,
                        columnNumber: 9
                    }, this),
                    state && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: state.tone === 'error' ? 'ed-error' : 'muted',
                        role: state.tone === 'error' ? 'alert' : 'status',
                        "data-testid": "ed-knowledge-state",
                        children: state.text
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/knowledge.tsx",
                        lineNumber: 52,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/knowledge.tsx",
                lineNumber: 23,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/knowledge.tsx",
        lineNumber: 19,
        columnNumber: 5
    }, this);
}
_s(ProjectKnowledge, "7aHsHzYrQOUPh9T+Qi4BZDKYMCU=");
_c = ProjectKnowledge;
var _c;
__turbopack_context__.k.register(_c, "ProjectKnowledge");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/app/marketing/site/editor/location-picker.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "LocationPicker",
    ()=>LocationPicker
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/ui.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$data$3a$db6b31__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/site/editor/data:db6b31 [app-client] (ecmascript) <text/javascript>");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
/**
 * Выбор филиала на первом экране «Сайт и SEO» (SITE-1, план §1 шаг 1): список филиалов организации с направлением и
 * статусом сайта, текущий филиал стойки отмечен. Выбор другого переключает стойку тем же действием, что переключатель
 * в шапке (`selectBranch`), и возвращает на этот экран: все запросы конструктора идут уже от выбранного филиала.
 */ const VERTICAL = {
    HOSPITALITY: 'Гостиница',
    BEAUTY: 'Салон',
    FOOD_SERVICE: 'Ресторан'
};
const STATUS = {
    NONE: {
        label: 'Нет сайта',
        tone: 'neutral'
    },
    DRAFT: {
        label: 'Черновик',
        tone: 'info'
    },
    PUBLISHED: {
        label: 'Опубликован',
        tone: 'ok'
    },
    ARCHIVED: {
        label: 'В архиве',
        tone: 'warn'
    }
};
function LocationPicker({ locations, currentId }) {
    _s();
    const [pending, start] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTransition"])();
    const [target, setTarget] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const choose = (id)=>{
        if (id === currentId || pending) return;
        setError(null);
        setTarget(id);
        window.dispatchEvent(new Event('wetop-scope-switch'));
        start(async ()=>{
            try {
                const reply = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$data$3a$db6b31__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__["chooseSiteLocationAction"])(id);
                setError(reply.message);
            } catch (e) {
                // переход Next (redirect) приходит как исключение действия: страница сменится сама
                if (e instanceof Error && /NEXT_REDIRECT/.test(e.message)) return;
                setError('Не удалось переключить филиал. Обновите страницу и повторите.');
            }
            window.dispatchEvent(new Event('wetop-scope-switch-failed'));
            setTarget(null);
        });
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        className: "site-start__locations",
        "aria-labelledby": "site-locations-title",
        "data-testid": "site-locations",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                id: "site-locations-title",
                className: "site-start__step",
                children: "Филиал"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/location-picker.tsx",
                lineNumber: 44,
                columnNumber: 7
            }, this),
            !locations.ok ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "muted",
                role: "alert",
                children: [
                    "Список филиалов не загрузился: ",
                    locations.message
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/location-picker.tsx",
                lineNumber: 48,
                columnNumber: 9
            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                className: "site-locations",
                children: locations.data.map((l)=>{
                    const current = l.id === currentId;
                    const status = l.siteStatus ? STATUS[l.siteStatus] : null;
                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            type: "button",
                            className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cx"])('site-location', current && 'is-current'),
                            "aria-current": current ? 'true' : undefined,
                            "aria-busy": target === l.id || undefined,
                            disabled: pending && target !== l.id,
                            onClick: ()=>choose(l.id),
                            "data-testid": "site-location",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "site-location__name",
                                    children: l.name
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/location-picker.tsx",
                                    lineNumber: 67,
                                    columnNumber: 19
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "site-location__meta",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "muted",
                                            children: VERTICAL[l.vertical] ?? l.vertical
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/location-picker.tsx",
                                            lineNumber: 69,
                                            columnNumber: 21
                                        }, this),
                                        status && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Badge"], {
                                            tone: status.tone,
                                            children: status.label
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/location-picker.tsx",
                                            lineNumber: 70,
                                            columnNumber: 32
                                        }, this),
                                        current && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "site-location__current",
                                            children: "выбран"
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/location-picker.tsx",
                                            lineNumber: 71,
                                            columnNumber: 33
                                        }, this),
                                        target === l.id && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "muted",
                                            children: "Переключаем…"
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/location-picker.tsx",
                                            lineNumber: 72,
                                            columnNumber: 41
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/location-picker.tsx",
                                    lineNumber: 68,
                                    columnNumber: 19
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/location-picker.tsx",
                            lineNumber: 58,
                            columnNumber: 17
                        }, this)
                    }, l.id, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/location-picker.tsx",
                        lineNumber: 57,
                        columnNumber: 15
                    }, this);
                })
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/location-picker.tsx",
                lineNumber: 52,
                columnNumber: 9
            }, this),
            error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "muted",
                role: "alert",
                "data-testid": "site-locations-error",
                children: error
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/location-picker.tsx",
                lineNumber: 81,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/location-picker.tsx",
        lineNumber: 43,
        columnNumber: 5
    }, this);
}
_s(LocationPicker, "NGEBEnBMqaFBvEiWTLkHP5WSirM=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTransition"]
    ];
});
_c = LocationPicker;
var _c;
__turbopack_context__.k.register(_c, "LocationPicker");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/app/marketing/site/editor/overlays.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AssetPicker",
    ()=>AssetPicker,
    "ChangeList",
    ()=>ChangeList,
    "DiffOverlay",
    ()=>DiffOverlay,
    "HistoryOverlay",
    ()=>HistoryOverlay,
    "describeChange",
    ()=>describeChange
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/index.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/editor.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$overlay$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/overlay.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/ui.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
;
/**
 * Окна редактора (MKT9): выбор картинки из библиотеки MKT8 (только готовые этого филиала и нужного вида, адрес руками
 * не вводится), история версий (предпросмотр, сравнение, восстановление как нового черновика) и разница версий словами.
 */ const KIND_LABEL = {
    IMAGE: 'фото',
    LOGO: 'логотип',
    FAVICON: 'значок сайта'
};
function AssetPicker({ kind, assets, onPick, onClose }) {
    const fit = assets.filter((a)=>a.status === 'READY' && a.kind === kind);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$overlay$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Overlay"], {
        open: kind !== null,
        onClose: onClose,
        title: `Выбрать ${kind ? KIND_LABEL[kind] : 'изображение'}`,
        trapFocus: true,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "ed-picker",
            "data-testid": "ed-asset-picker",
            children: fit.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "muted",
                children: [
                    "В библиотеке нет изображений этого назначения. ",
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                        href: "/marketing/site/assets",
                        children: "Открыть библиотеку изображений"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/overlays.tsx",
                        lineNumber: 32,
                        columnNumber: 60
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/overlays.tsx",
                lineNumber: 31,
                columnNumber: 11
            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Grid"], {
                min: 160,
                children: fit.map((asset)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        className: "ed-picker__item",
                        "data-testid": "ed-asset-option",
                        onClick: ()=>onPick(asset),
                        children: [
                            asset.previewUrl ? // подписанный адрес на срок: обычный <img>
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                                src: asset.previewUrl,
                                alt: asset.defaultAlt?.ru ?? 'Изображение без подписи'
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/overlays.tsx",
                                lineNumber: 40,
                                columnNumber: 19
                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "muted",
                                children: "Нет предпросмотра"
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/overlays.tsx",
                                lineNumber: 42,
                                columnNumber: 19
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: [
                                    asset.width,
                                    "×",
                                    asset.height
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/overlays.tsx",
                                lineNumber: 44,
                                columnNumber: 17
                            }, this)
                        ]
                    }, asset.id, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/overlays.tsx",
                        lineNumber: 37,
                        columnNumber: 15
                    }, this))
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/overlays.tsx",
                lineNumber: 35,
                columnNumber: 11
            }, this)
        }, void 0, false, {
            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/overlays.tsx",
            lineNumber: 29,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/overlays.tsx",
        lineNumber: 28,
        columnNumber: 5
    }, this);
}
_c = AssetPicker;
const SITE_FIELD = {
    displayName: 'Название сайта',
    tagline: 'Слоган',
    locales: 'Языки сайта',
    contacts: 'Контакты',
    legal: 'Юридические данные',
    seo: 'SEO сайта',
    theme: 'Оформление',
    integrations: 'Бронирование и аналитика',
    navigation: 'Навигация'
};
const PAGE_FIELD = {
    title: 'название',
    slug: 'адрес',
    seo: 'SEO',
    settings: 'главная страница'
};
function slotLabel(slot) {
    if (slot === 'logo') return 'Логотип';
    if (slot === 'favicon') return 'Значок сайта';
    if (slot.endsWith(':og')) return 'Картинка для соцсетей';
    if (slot.endsWith(':images')) return 'Фото галереи';
    if (slot.endsWith(':items')) return 'Фото категорий';
    return 'Фото секции';
}
const variantLabel = (type, value)=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SITE_EDITOR_SECTIONS"][type ?? '']?.variants.find((v)=>v.value === value)?.label ?? value ?? '';
function describeChange(c) {
    const name = c.label ? `«${c.label}»` : '';
    switch(c.area){
        case 'site':
            return `${SITE_FIELD[c.field ?? ''] ?? 'Настройки сайта'}: изменено`;
        case 'page':
            if (c.kind === 'added') return `Добавлена страница ${name}`;
            if (c.kind === 'removed') return `Удалена страница ${name}`;
            if (c.kind === 'moved') return `Страница ${name} перемещена`;
            return `Страница ${name}: изменено ${PAGE_FIELD[c.field ?? ''] ?? 'содержимое'}`;
        case 'section':
            {
                const type = __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SITE_EDITOR_SECTIONS"][c.sectionType ?? '']?.label ?? 'Секция';
                if (c.kind === 'added') return `Добавлена секция ${name} (${type})`;
                if (c.kind === 'removed') return `Удалена секция ${name} (${type})`;
                if (c.kind === 'moved') return c.field === 'page' ? `Секция ${name} перенесена на другую страницу` : `Секция ${name} перемещена`;
                if (c.kind === 'variant') return `Секция ${name}: вид «${variantLabel(c.sectionType, c.from)}» стал «${variantLabel(c.sectionType, c.to)}»`;
                return `Секция ${name}: изменено содержимое`;
            }
        case 'asset':
            if (c.kind === 'added') return `${slotLabel(c.slot ?? '')}: добавлено изображение`;
            if (c.kind === 'removed') return `${slotLabel(c.slot ?? '')}: убрано изображение`;
            return `${slotLabel(c.slot ?? '')}: изображение заменено`;
    }
}
function ChangeList({ changes }) {
    if (changes.length === 0) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
        className: "muted",
        children: "Отличий нет."
    }, void 0, false, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/overlays.tsx",
        lineNumber: 108,
        columnNumber: 36
    }, this);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
        className: "ed-changes",
        "data-testid": "ed-changes",
        children: changes.map((c, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                children: describeChange(c)
            }, i, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/overlays.tsx",
                lineNumber: 112,
                columnNumber: 9
            }, this))
    }, void 0, false, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/overlays.tsx",
        lineNumber: 110,
        columnNumber: 5
    }, this);
}
_c1 = ChangeList;
function DiffOverlay({ title, changes, onClose }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$overlay$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Overlay"], {
        open: title !== null,
        onClose: onClose,
        title: title ?? 'Изменения',
        trapFocus: true,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "ed-diff",
            "data-testid": "ed-diff",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ChangeList, {
                changes: changes
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/overlays.tsx",
                lineNumber: 130,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/overlays.tsx",
            lineNumber: 129,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/overlays.tsx",
        lineNumber: 128,
        columnNumber: 5
    }, this);
}
_c2 = DiffOverlay;
const SOURCE = {
    MANUAL: 'Вручную',
    AI: 'ИИ',
    IMPORT: 'Импорт'
};
const when = (iso)=>new Date(iso).toLocaleString('ru-RU', {
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit'
    });
/** MKT9.2: закладка версии: звёздочка открывает подпись; поставленная закладка снимается тем же местом */ function BookmarkControl({ version, disabled, onBookmark }) {
    _s();
    const [editing, setEditing] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [label, setLabel] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(version.bookmark ?? '');
    if (version.bookmark && !editing) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
        type: "button",
        tone: "ghost",
        size: "sm",
        disabled: disabled,
        onClick: ()=>void onBookmark(version, null),
        "data-testid": "ed-bookmark-remove",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                "aria-hidden": "true",
                children: "★ "
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/overlays.tsx",
                lineNumber: 155,
                columnNumber: 9
            }, this),
            "Снять закладку"
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/overlays.tsx",
        lineNumber: 154,
        columnNumber: 7
    }, this);
    if (!editing) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
        type: "button",
        tone: "ghost",
        size: "sm",
        disabled: disabled,
        onClick: ()=>setEditing(true),
        "data-testid": "ed-bookmark-add",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                "aria-hidden": "true",
                children: "☆ "
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/overlays.tsx",
                lineNumber: 161,
                columnNumber: 9
            }, this),
            "В закладки"
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/overlays.tsx",
        lineNumber: 160,
        columnNumber: 7
    }, this);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
        className: "ed-row",
        onSubmit: async (e)=>{
            e.preventDefault();
            if (label.trim() && await onBookmark(version, label.trim())) setEditing(false);
        },
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                className: "sr-only",
                htmlFor: `bm-${version.id}`,
                children: [
                    "Подпись закладки версии ",
                    version.revision
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/overlays.tsx",
                lineNumber: 172,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                id: `bm-${version.id}`,
                className: "inp",
                maxLength: 120,
                value: label,
                placeholder: "Например: перед акцией",
                onChange: (e)=>setLabel(e.currentTarget.value)
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/overlays.tsx",
                lineNumber: 175,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                type: "submit",
                size: "sm",
                disabled: disabled || !label.trim(),
                "data-testid": "ed-bookmark-save",
                children: "Сохранить"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/overlays.tsx",
                lineNumber: 176,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                type: "button",
                tone: "ghost",
                size: "sm",
                onClick: ()=>setEditing(false),
                children: "Отмена"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/overlays.tsx",
                lineNumber: 179,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/overlays.tsx",
        lineNumber: 165,
        columnNumber: 5
    }, this);
}
_s(BookmarkControl, "fVYrtgfsDgqg/IuYnmtxAjw6n04=");
_c3 = BookmarkControl;
function HistoryOverlay({ open, versions, bookmarks, readOnly, busy, error, onClose, onPreview, onCompare, onRestore, onBookmark }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$overlay$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Overlay"], {
        open: open,
        onClose: onClose,
        title: "История версий",
        drawer: true,
        trapFocus: true,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "ed-history",
            "data-testid": "ed-history",
            children: [
                error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    role: "alert",
                    className: "ed-error",
                    children: error
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/overlays.tsx",
                    lineNumber: 215,
                    columnNumber: 11
                }, this),
                bookmarks.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                    className: "ed-history__pinned",
                    "aria-labelledby": "ed-bookmarks-title",
                    "data-testid": "ed-bookmarks",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                            id: "ed-bookmarks-title",
                            className: "ed-history__title",
                            children: "Закладки"
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/overlays.tsx",
                            lineNumber: 221,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                            className: "ed-history__list",
                            children: bookmarks.map((v)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                    className: "ed-history__row",
                                    "data-testid": "ed-bookmark-row",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "ed-history__facts",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("b", {
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            "aria-hidden": "true",
                                                            children: "★ "
                                                        }, void 0, false, {
                                                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/overlays.tsx",
                                                            lineNumber: 229,
                                                            columnNumber: 23
                                                        }, this),
                                                        v.bookmark
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/overlays.tsx",
                                                    lineNumber: 228,
                                                    columnNumber: 21
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "muted",
                                                    children: [
                                                        "Версия ",
                                                        v.revision,
                                                        ", ",
                                                        when(v.createdAt)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/overlays.tsx",
                                                    lineNumber: 232,
                                                    columnNumber: 21
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/overlays.tsx",
                                            lineNumber: 227,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "ed-history__actions",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                                    type: "button",
                                                    tone: "secondary",
                                                    size: "sm",
                                                    disabled: busy,
                                                    onClick: ()=>onPreview(v),
                                                    children: "Предпросмотр"
                                                }, void 0, false, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/overlays.tsx",
                                                    lineNumber: 237,
                                                    columnNumber: 21
                                                }, this),
                                                !v.isLatest && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                                    type: "button",
                                                    tone: "secondary",
                                                    size: "sm",
                                                    disabled: busy || readOnly,
                                                    onClick: ()=>onRestore(v),
                                                    children: "Восстановить как черновик"
                                                }, void 0, false, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/overlays.tsx",
                                                    lineNumber: 241,
                                                    columnNumber: 23
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/overlays.tsx",
                                            lineNumber: 236,
                                            columnNumber: 19
                                        }, this)
                                    ]
                                }, v.id, true, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/overlays.tsx",
                                    lineNumber: 226,
                                    columnNumber: 17
                                }, this))
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/overlays.tsx",
                            lineNumber: 224,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/overlays.tsx",
                    lineNumber: 220,
                    columnNumber: 11
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                    className: "ed-history__title",
                    children: "Все версии"
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/overlays.tsx",
                    lineNumber: 251,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ol", {
                    className: "ed-history__list",
                    children: versions.map((v)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                            className: "ed-history__row",
                            "data-testid": "ed-history-row",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "ed-history__facts",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("b", {
                                            children: [
                                                "Версия ",
                                                v.revision,
                                                v.bookmark ? `: ${v.bookmark}` : ''
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/overlays.tsx",
                                            lineNumber: 256,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "muted",
                                            children: [
                                                SOURCE[v.source],
                                                ", ",
                                                when(v.createdAt)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/overlays.tsx",
                                            lineNumber: 260,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "ed-history__badges",
                                            children: [
                                                v.isLatest && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Badge"], {
                                                    tone: "info",
                                                    children: "Черновик"
                                                }, void 0, false, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/overlays.tsx",
                                                    lineNumber: 264,
                                                    columnNumber: 34
                                                }, this),
                                                v.isPublished && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Badge"], {
                                                    tone: "ok",
                                                    children: "Опубликована"
                                                }, void 0, false, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/overlays.tsx",
                                                    lineNumber: 265,
                                                    columnNumber: 37
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/overlays.tsx",
                                            lineNumber: 263,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/overlays.tsx",
                                    lineNumber: 255,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "ed-history__actions",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                            type: "button",
                                            tone: "secondary",
                                            size: "sm",
                                            disabled: busy,
                                            onClick: ()=>onPreview(v),
                                            children: "Предпросмотр"
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/overlays.tsx",
                                            lineNumber: 269,
                                            columnNumber: 17
                                        }, this),
                                        !v.isLatest && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                            type: "button",
                                            tone: "secondary",
                                            size: "sm",
                                            disabled: busy,
                                            onClick: ()=>onCompare(v),
                                            children: "Сравнить с черновиком"
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/overlays.tsx",
                                            lineNumber: 273,
                                            columnNumber: 19
                                        }, this),
                                        !v.isLatest && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                            type: "button",
                                            tone: "secondary",
                                            size: "sm",
                                            disabled: busy || readOnly,
                                            onClick: ()=>onRestore(v),
                                            "data-testid": "ed-restore",
                                            children: "Восстановить как черновик"
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/overlays.tsx",
                                            lineNumber: 278,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(BookmarkControl, {
                                            version: v,
                                            disabled: busy || readOnly,
                                            onBookmark: onBookmark
                                        }, `${v.id}-${v.bookmark ?? ''}`, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/overlays.tsx",
                                            lineNumber: 282,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/overlays.tsx",
                                    lineNumber: 268,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, v.id, true, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/overlays.tsx",
                            lineNumber: 254,
                            columnNumber: 13
                        }, this))
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/overlays.tsx",
                    lineNumber: 252,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/overlays.tsx",
            lineNumber: 213,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/overlays.tsx",
        lineNumber: 212,
        columnNumber: 5
    }, this);
}
_c4 = HistoryOverlay;
var _c, _c1, _c2, _c3, _c4;
__turbopack_context__.k.register(_c, "AssetPicker");
__turbopack_context__.k.register(_c1, "ChangeList");
__turbopack_context__.k.register(_c2, "DiffOverlay");
__turbopack_context__.k.register(_c3, "BookmarkControl");
__turbopack_context__.k.register(_c4, "HistoryOverlay");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/app/marketing/site/editor/paths.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Путь в документе SiteSpec для редактора (MKT9): массив ключей и индексов. Строка пути та же, что у валидатора
 * (`pages[0].sections[2].heading.ru`), поэтому ошибка сервера находит своё поле.
 */ __turbopack_context__.s([
    "getAt",
    ()=>getAt,
    "pathId",
    ()=>pathId,
    "pathString",
    ()=>pathString,
    "setAt",
    ()=>setAt
]);
function pathString(path) {
    return path.reduce((out, key)=>typeof key === 'number' ? `${out}[${key}]` : out ? `${out}.${key}` : key, '');
}
function pathId(path) {
    return `ed-${pathString(path).replace(/[^a-zA-Z0-9]+/g, '-')}`;
}
function getAt(root, path) {
    let value = root;
    for (const key of path){
        if (value === null || typeof value !== 'object') return undefined;
        value = value[key];
    }
    return value;
}
function setAt(root, path, value) {
    const copy = structuredClone(root);
    let node = copy;
    path.slice(0, -1).forEach((key, i)=>{
        const next = node[key];
        if (next === null || typeof next !== 'object') node[key] = typeof path[i + 1] === 'number' ? [] : {};
        node = node[key];
    });
    const last = path[path.length - 1];
    if (value === undefined && !Array.isArray(node)) delete node[last];
    else node[last] = value;
    return copy;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/app/marketing/site/editor/preview.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SitePreview",
    ()=>SitePreview
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/index.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$builder$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/builder.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/editor.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/ui.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
let renderer = null;
const loadRenderer = ()=>renderer ??= __turbopack_context__.A("[project]/wt-personnel/apps/sites/src/draft-preview.ts [app-client] (ecmascript, async loader)");
const LOCALE_NAME = {
    ru: 'Русский',
    kk: 'Қазақша',
    en: 'English'
};
function SitePreview({ spec, pageId, onPage, locales, defaultLocale, assets, selectedSectionId, onPickSection, onOpenSeparately, mode, setMode, onInlineEdit, readOnly, simple = false }) {
    _s();
    const frame = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const [html, setHtml] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [shownPage, setShownPage] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [broken, setBroken] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [device, setDevice] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('desktop');
    const [locale, setLocale] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(defaultLocale);
    const scroll = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(0);
    const handlers = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])({
        onPage,
        onPickSection,
        onInlineEdit
    });
    handlers.current = {
        onPage,
        onPickSection,
        onInlineEdit
    };
    const textMode = (mode === 'text' || mode === 'simple') && !readOnly;
    const both = mode === 'simple';
    const bothRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(both);
    bothRef.current = both;
    const modeRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(textMode);
    modeRef.current = textMode;
    const selected = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(selectedSectionId);
    selected.current = selectedSectionId;
    const pages = spec['pages'] ?? [];
    const shownLocale = locales.includes(locale) ? locale : defaultLocale;
    const localeRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(shownLocale);
    localeRef.current = shownLocale;
    // метки правки текста только в режиме «Текст»: в режиме «Выбор» разметка просмотра та же, что у сайта
    const editorPaths = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "SitePreview.useMemo[editorPaths]": ()=>textMode ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$builder$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["inlineTextTargets"])(spec, shownLocale).map({
                "SitePreview.useMemo[editorPaths]": (t)=>t.path
            }["SitePreview.useMemo[editorPaths]"]) : undefined
    }["SitePreview.useMemo[editorPaths]"], [
        textMode,
        spec,
        shownLocale
    ]);
    // S и T переключают режим, если фокус не в поле ввода: и в стойке, и внутри рамки сайта (туда уходит фокус после щелчка)
    const hotkey = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])({
        "SitePreview.useRef[hotkey]": ()=>undefined
    }["SitePreview.useRef[hotkey]"]);
    hotkey.current = (e)=>{
        if (bothRef.current) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const el = e.target;
        if (el && (el.isContentEditable || [
            'INPUT',
            'TEXTAREA',
            'SELECT'
        ].includes(el.tagName))) return;
        const key = e.key.toLowerCase();
        if (key === 's' || key === 'ы') setMode('select');
        else if ((key === 't' || key === 'е') && !readOnly) setMode('text');
    };
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "SitePreview.useEffect": ()=>{
            const onKey = {
                "SitePreview.useEffect.onKey": (e)=>hotkey.current(e)
            }["SitePreview.useEffect.onKey"];
            window.addEventListener('keydown', onKey);
            return ({
                "SitePreview.useEffect": ()=>window.removeEventListener('keydown', onKey)
            })["SitePreview.useEffect"];
        }
    }["SitePreview.useEffect"], []);
    // правка формы рисуется через короткую паузу, чтобы не перерисовывать рамку на каждую букву
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "SitePreview.useEffect": ()=>{
            let off = false;
            const timer = setTimeout({
                "SitePreview.useEffect.timer": async ()=>{
                    const mod = await loadRenderer();
                    if (off) return;
                    const r = mod.renderDraftPreview({
                        spec,
                        pageId,
                        locale: shownLocale,
                        assets,
                        ...editorPaths ? {
                            editorPaths
                        } : {}
                    });
                    if (!r.ok) return setBroken(true);
                    setBroken(false);
                    const win = frame.current?.contentWindow;
                    scroll.current = r.pageId === shownPage && win ? win.scrollY : 0;
                    setShownPage(r.pageId);
                    setHtml(r.html);
                    if (r.pageId !== pageId) handlers.current.onPage(r.pageId);
                }
            }["SitePreview.useEffect.timer"], html === null ? 0 : 250);
            return ({
                "SitePreview.useEffect": ()=>{
                    off = true;
                    clearTimeout(timer);
                }
            })["SitePreview.useEffect"];
        // shownPage и html читаются как прошлый кадр, перерисовку запускает только документ, страница, язык и картинки
        }
    }["SitePreview.useEffect"], [
        spec,
        pageId,
        shownLocale,
        assets,
        editorPaths
    ]);
    const mark = (scrollTo)=>{
        const doc = frame.current?.contentDocument;
        if (!doc) return;
        doc.querySelectorAll('[data-ed-selected]').forEach((el)=>el.removeAttribute('data-ed-selected'));
        const id = selected.current;
        const el = id ? doc.getElementById(id) : null;
        if (!el || el.tagName !== 'SECTION') return;
        el.setAttribute('data-ed-selected', '');
        if (scrollTo) el.scrollIntoView({
            block: 'nearest'
        });
    };
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "SitePreview.useEffect": ()=>mark(true)
    }["SitePreview.useEffect"], [
        selectedSectionId
    ]);
    /** Правка одного текста в рамке: Enter и щелчок мимо применяют, Escape отменяет; без перевода строк и разметки */ const editText = (doc, el)=>{
        if (el.isContentEditable) return;
        const before = el.textContent ?? '';
        const path = el.getAttribute('data-editor-path') ?? '';
        el.setAttribute('contenteditable', 'plaintext-only');
        if (!el.isContentEditable) el.setAttribute('contenteditable', 'true');
        el.setAttribute('role', 'textbox');
        el.setAttribute('aria-label', 'Текст на сайте');
        el.focus();
        const range = doc.createRange();
        range.selectNodeContents(el);
        doc.getSelection()?.removeAllRanges();
        doc.getSelection()?.addRange(range);
        let done = false;
        const finish = (apply)=>{
            if (done) return;
            done = true;
            el.removeAttribute('contenteditable');
            el.removeAttribute('role');
            el.removeAttribute('aria-label');
            el.removeEventListener('keydown', onKey);
            el.removeEventListener('blur', onBlur);
            const after = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
            if (!apply || after === before.trim()) {
                el.textContent = before;
                return;
            }
            handlers.current.onInlineEdit(path, localeRef.current, after);
        };
        const onKey = (e)=>{
            if (e.key === 'Enter') {
                e.preventDefault();
                finish(true);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                finish(false);
            }
        };
        const onBlur = ()=>finish(true);
        el.addEventListener('keydown', onKey);
        el.addEventListener('blur', onBlur);
    };
    const onLoad = ()=>{
        const doc = frame.current?.contentDocument;
        const win = frame.current?.contentWindow;
        if (!doc || !win) return;
        win.scrollTo(0, scroll.current);
        mark(false);
        if (modeRef.current) doc.documentElement.setAttribute('data-ed-mode', 'text');
        doc.addEventListener('keydown', (e)=>hotkey.current(e));
        doc.addEventListener('click', (e)=>{
            const target = e.target;
            if (!target?.closest) return;
            e.preventDefault();
            // режим «Текст»: щелчок по разрешённому тексту делает его редактируемым; остальное ничего не делает
            if (modeRef.current) {
                const editable = target.closest('[data-editor-path]');
                if (editable) {
                    // простой редактор: текст правится, а его блок заодно выбирается целью ИИ
                    if (bothRef.current) {
                        const own = editable.closest('main section[id]');
                        if (own && shownPage) handlers.current.onPickSection(shownPage, own.id);
                    }
                    editText(doc, editable);
                    return;
                }
                if (!bothRef.current) return;
            }
            const section = target.closest('main section[id]');
            if (section && shownPage) return handlers.current.onPickSection(shownPage, section.id);
            const href = target.closest('a[href]')?.getAttribute('href') ?? '';
            if (href.startsWith('#')) return doc.getElementById(href.slice(1))?.scrollIntoView();
            if (!href.startsWith('/')) return;
            const path = href.split(/[?#]/)[0] ?? '/';
            const page = pages.find((p)=>(p['isHome'] === true ? '/' : `/${String(p['slug'])}`) === path);
            if (page) handlers.current.onPage(String(page['id']));
        });
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cx"])('ed-preview', simple && 'ed-preview--simple'),
        "aria-label": "Просмотр сайта",
        "data-testid": "ed-preview-pane",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "ed-preview__bar",
                children: [
                    !simple && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "ed-preview__tools",
                        role: "radiogroup",
                        "aria-label": "Режим работы с сайтом",
                        "data-testid": "ed-tools",
                        children: [
                            [
                                'select',
                                'Выбор',
                                'S'
                            ],
                            [
                                'text',
                                'Текст',
                                'T'
                            ]
                        ].map(([key, label, hotkey])=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                type: "button",
                                role: "radio",
                                "aria-checked": mode === key,
                                "aria-keyshortcuts": hotkey,
                                disabled: key === 'text' && readOnly,
                                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cx"])('ed-preview__device-btn', mode === key && 'is-on'),
                                onClick: ()=>setMode(key),
                                "data-testid": `ed-tool-${key}`,
                                children: [
                                    label,
                                    " ",
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("kbd", {
                                        children: hotkey
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/preview.tsx",
                                        lineNumber: 239,
                                        columnNumber: 23
                                    }, this)
                                ]
                            }, key, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/preview.tsx",
                                lineNumber: 228,
                                columnNumber: 13
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/preview.tsx",
                        lineNumber: 221,
                        columnNumber: 9
                    }, this),
                    (!simple || pages.length > 1) && (simple ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Select"], {
                        "aria-label": "Страница",
                        className: "ed-preview__page",
                        value: shownPage ?? pageId ?? '',
                        onChange: (e)=>handlers.current.onPage(e.currentTarget.value),
                        children: pages.map((p)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                value: String(p['id']),
                                children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["localizedText"])(p['title'], defaultLocale) || 'Без названия'
                            }, String(p['id']), false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/preview.tsx",
                                lineNumber: 253,
                                columnNumber: 17
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/preview.tsx",
                        lineNumber: 246,
                        columnNumber: 13
                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                        label: "Страница",
                        controlId: "ed-preview-page",
                        className: "ed-preview__field",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Select"], {
                            value: shownPage ?? pageId ?? '',
                            onChange: (e)=>handlers.current.onPage(e.currentTarget.value),
                            children: pages.map((p)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                    value: String(p['id']),
                                    children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["localizedText"])(p['title'], defaultLocale) || 'Без названия'
                                }, String(p['id']), false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/preview.tsx",
                                    lineNumber: 262,
                                    columnNumber: 19
                                }, this))
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/preview.tsx",
                            lineNumber: 260,
                            columnNumber: 15
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/preview.tsx",
                        lineNumber: 259,
                        columnNumber: 13
                    }, this)),
                    !simple && locales.length > 1 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                        label: "Язык",
                        controlId: "ed-preview-locale",
                        className: "ed-preview__field",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Select"], {
                            value: shownLocale,
                            onChange: (e)=>setLocale(e.currentTarget.value),
                            children: locales.map((l)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                    value: l,
                                    children: LOCALE_NAME[l] ?? l
                                }, l, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/preview.tsx",
                                    lineNumber: 273,
                                    columnNumber: 17
                                }, this))
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/preview.tsx",
                            lineNumber: 271,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/preview.tsx",
                        lineNumber: 270,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "ed-preview__device",
                        role: "group",
                        "aria-label": "Ширина просмотра",
                        children: [
                            [
                                'desktop',
                                'Компьютер'
                            ],
                            [
                                'tablet',
                                'Планшет'
                            ],
                            [
                                'phone',
                                'Телефон'
                            ]
                        ].map(([key, label])=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                type: "button",
                                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cx"])('ed-preview__device-btn', device === key && 'is-on'),
                                "aria-pressed": device === key,
                                onClick: ()=>setDevice(key),
                                children: label
                            }, key, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/preview.tsx",
                                lineNumber: 288,
                                columnNumber: 13
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/preview.tsx",
                        lineNumber: 280,
                        columnNumber: 9
                    }, this),
                    !simple && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                        type: "button",
                        tone: "secondary",
                        "data-testid": "ed-preview",
                        onClick: onOpenSeparately,
                        children: "Открыть в новой вкладке"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/preview.tsx",
                        lineNumber: 294,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/preview.tsx",
                lineNumber: 219,
                columnNumber: 7
            }, this),
            !simple && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "muted ed-preview__hint",
                "data-testid": "ed-preview-hint",
                children: both ? 'Щёлкните текст на сайте, чтобы исправить его, или блок, чтобы попросить ИИ изменить именно его. Изменения сохраняются сами.' : textMode ? 'Щёлкните текст на сайте и исправьте его. Enter сохраняет в черновике, Escape отменяет. Цены, контакты и ссылки так не меняются.' : 'Щёлкните блок на сайте, чтобы изменить его. Бронирование и цены работают только на опубликованном сайте.'
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/preview.tsx",
                lineNumber: 300,
                columnNumber: 7
            }, this),
            broken && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "ed-preview__broken",
                role: "status",
                "data-testid": "ed-preview-broken",
                children: "Сайт с этими правками пока не нарисовать: исправьте отмеченные поля. Показан последний удачный вид."
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/preview.tsx",
                lineNumber: 309,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cx"])('ed-preview__stage', device === 'phone' && 'is-phone', device === 'tablet' && 'is-tablet'),
                children: html !== null && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("iframe", {
                    ref: frame,
                    className: "ed-preview__frame",
                    title: "Сайт гостиницы, живой просмотр",
                    sandbox: "allow-same-origin",
                    srcDoc: html,
                    onLoad: onLoad,
                    "data-testid": "ed-frame"
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/preview.tsx",
                    lineNumber: 315,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/preview.tsx",
                lineNumber: 313,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/preview.tsx",
        lineNumber: 218,
        columnNumber: 5
    }, this);
}
_s(SitePreview, "ygWe/MArzwiAmuD1q/QxuXqsfBg=");
_c = SitePreview;
var _c;
__turbopack_context__.k.register(_c, "SitePreview");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/app/marketing/site/editor/run.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "BUILD_STEPS",
    ()=>BUILD_STEPS,
    "RUN_STATE",
    ()=>RUN_STATE,
    "runErrorText",
    ()=>runErrorText,
    "useAssistantRun",
    ()=>useAssistantRun,
    "useGenerationRun",
    ()=>useGenerationRun
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/index.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$generation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/generation.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$data$3a$76f5cc__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/site/editor/data:76f5cc [app-client] (ecmascript) <text/javascript>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$data$3a$d4a03c__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/site/editor/data:d4a03c [app-client] (ecmascript) <text/javascript>");
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
'use client';
;
;
;
const RUN_STATE = {
    QUEUED: 'В очереди',
    RUNNING: 'ИИ работает',
    SUCCEEDED: 'Готово',
    FAILED: 'Ошибка',
    CANCELLED: 'Отменено'
};
function runErrorText(run) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$generation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isGenerationErrorCode"])(run.errorCode) ? __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$generation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["GENERATION_ERROR_TEXT"][run.errorCode] : 'ИИ не смог выполнить задачу';
}
const POLL_MS = 1500;
const finished = (status)=>status === 'SUCCEEDED' || status === 'FAILED' || status === 'CANCELLED';
function useGenerationRun(onDone) {
    _s();
    const [run, setRun] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [lost, setLost] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const done = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(onDone);
    done.current = onDone;
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useGenerationRun.useEffect": ()=>{
            if (!run || finished(run.status)) return;
            const timer = setTimeout({
                "useGenerationRun.useEffect.timer": async ()=>{
                    const reply = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$data$3a$d4a03c__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__["runAction"])(run.id);
                    if (!reply.ok) return setLost(reply.message);
                    setLost(null);
                    setRun(reply.data.run);
                    if (finished(reply.data.run.status)) done.current(reply.data.run);
                }
            }["useGenerationRun.useEffect.timer"], POLL_MS);
            return ({
                "useGenerationRun.useEffect": ()=>clearTimeout(timer)
            })["useGenerationRun.useEffect"];
        }
    }["useGenerationRun.useEffect"], [
        run
    ]);
    const active = !!run && !finished(run.status);
    return {
        run,
        active,
        lost,
        start: setRun,
        clear: ()=>setRun(null)
    };
}
_s(useGenerationRun, "VUeIKxy+SrXdkM5ftJGfOSahrVo=");
function useAssistantRun(onDone) {
    _s1();
    const [run, setRun] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [lost, setLost] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const done = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(onDone);
    done.current = onDone;
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useAssistantRun.useEffect": ()=>{
            if (!run || finished(run.status)) return;
            const timer = setTimeout({
                "useAssistantRun.useEffect.timer": async ()=>{
                    const reply = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$data$3a$76f5cc__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__["assistantRunAction"])(run.id);
                    if (!reply.ok) return setLost(reply.message);
                    setLost(null);
                    setRun(reply.data.run);
                    if (finished(reply.data.run.status)) done.current(reply.data.run);
                }
            }["useAssistantRun.useEffect.timer"], POLL_MS);
            return ({
                "useAssistantRun.useEffect": ()=>clearTimeout(timer)
            })["useAssistantRun.useEffect"];
        }
    }["useAssistantRun.useEffect"], [
        run
    ]);
    const active = !!run && !finished(run.status);
    return {
        run,
        active,
        lost,
        start: setRun
    };
}
_s1(useAssistantRun, "VUeIKxy+SrXdkM5ftJGfOSahrVo=");
const BUILD_STEPS = [
    'Анализирую данные объекта',
    'Продумываю структуру',
    'Создаю страницы',
    'Настраиваю блоки',
    'Проверяю сайт'
];
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-editor.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SimpleSiteEditor",
    ()=>SimpleSiteEditor
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/index.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$edit$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/edit.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/editor.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$spec$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/site-spec.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$templates$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/site-templates.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$canonical$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/canonical.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$builder$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/builder.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$chip$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/chip.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/ui.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$use$2d$confirm$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/use-confirm.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$use$2d$dictation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/use-dictation.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$vertical$2d$copy$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/vertical-copy.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$data$3a$2415f5__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/site/editor/data:2415f5 [app-client] (ecmascript) <text/javascript>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$data$3a$f79428__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/site/editor/data:f79428 [app-client] (ecmascript) <text/javascript>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$data$3a$a91882__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/site/editor/data:a91882 [app-client] (ecmascript) <text/javascript>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$data$3a$826c4a__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/site/editor/data:826c4a [app-client] (ecmascript) <text/javascript>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$data$3a$b7a5ca__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/site/editor/data:b7a5ca [app-client] (ecmascript) <text/javascript>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$data$3a$fcb604__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/site/editor/data:fcb604 [app-client] (ecmascript) <text/javascript>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$ai$2d$chat$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/site/editor/ai-chat.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$preview$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/site/editor/preview.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$run$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/site/editor/run.tsx [app-client] (ecmascript)");
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
;
;
;
const AUTOSAVE_MS = 1000;
const HISTORY_LIMIT = 50;
const pagesOf = (spec)=>spec['pages'] ?? [];
const sectionsOf = (page)=>page?.['sections'] ?? [];
const homeId = (spec)=>{
    const pages = pagesOf(spec);
    return String((pages.find((p)=>p['isHome'] === true) ?? pages[0])?.['id'] ?? '') || null;
};
const running = (i)=>i.status === 'QUEUED' || i.status === 'RUNNING';
function SimpleSiteEditor({ vertical, base: initialBase, published, locationName, assets, conversation, readOnly }) {
    _s();
    const copy = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$vertical$2d$copy$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["verticalCopy"])(vertical);
    const templates = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "SimpleSiteEditor.useMemo[templates]": ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$templates$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["siteTemplatesFor"])(vertical)
    }["SimpleSiteEditor.useMemo[templates]"], [
        vertical
    ]);
    const [base, setBase] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(initialBase);
    const [spec, setSpec] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(initialBase.spec);
    const specRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(spec);
    specRef.current = spec;
    const baseRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(base);
    baseRef.current = base;
    const [past, setPast] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const lastKey = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const [state, setState] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        kind: 'saved'
    });
    const [previewPage, setPreviewPage] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        "SimpleSiteEditor.useState": ()=>homeId(initialBase.spec)
    }["SimpleSiteEditor.useState"]);
    const [target, setTarget] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [text, setText] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    const [aiError, setAiError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [items, setItems] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(conversation.filter({
        "SimpleSiteEditor.useState": (i)=>i.kind === 'BUILD'
    }["SimpleSiteEditor.useState"]));
    const [startedAt, setStartedAt] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(0);
    const [tplOpen, setTplOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [reverted, setReverted] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const feed = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const { ask, dialog } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$use$2d$confirm$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useConfirm"])();
    const dirty = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "SimpleSiteEditor.useMemo[dirty]": ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$canonical$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["canonicalJson"])(spec) !== (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$canonical$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["canonicalJson"])(base.spec)
    }["SimpleSiteEditor.useMemo[dirty]"], [
        spec,
        base
    ]);
    const assetUrls = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "SimpleSiteEditor.useMemo[assetUrls]": ()=>Object.fromEntries(assets.filter({
                "SimpleSiteEditor.useMemo[assetUrls]": (a)=>a.previewUrl
            }["SimpleSiteEditor.useMemo[assetUrls]"]).map({
                "SimpleSiteEditor.useMemo[assetUrls]": (a)=>[
                        a.id,
                        a.previewUrl
                    ]
            }["SimpleSiteEditor.useMemo[assetUrls]"]))
    }["SimpleSiteEditor.useMemo[assetUrls]"], [
        assets
    ]);
    const current = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$templates$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["currentSiteTemplate"])(spec, vertical);
    const site = spec['site'] ?? {};
    const locale = typeof site['defaultLocale'] === 'string' ? site['defaultLocale'] : 'ru';
    const locales = site['locales'] ?? [
        'ru'
    ];
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "SimpleSiteEditor.useEffect": ()=>{
            feed.current?.lastElementChild?.scrollIntoView?.({
                block: 'nearest'
            });
        }
    }["SimpleSiteEditor.useEffect"], [
        items.length
    ]);
    const edit = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "SimpleSiteEditor.useCallback[edit]": (next, key)=>{
            const prev = specRef.current;
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$canonical$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["canonicalJson"])(next) === (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$canonical$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["canonicalJson"])(prev)) return;
            if (key === null || key !== lastKey.current) setPast({
                "SimpleSiteEditor.useCallback[edit]": (p)=>[
                        ...p.slice(-(HISTORY_LIMIT - 1)),
                        prev
                    ]
            }["SimpleSiteEditor.useCallback[edit]"]);
            lastKey.current = key;
            specRef.current = next;
            setSpec(next);
        }
    }["SimpleSiteEditor.useCallback[edit]"], []);
    const undo = ()=>{
        const prev = past[past.length - 1];
        if (!prev) return;
        setPast((p)=>p.slice(0, -1));
        lastKey.current = null;
        specRef.current = prev;
        setSpec(prev);
    };
    /** Сохранение версией поверх головы; само после паузы в правках и перед просьбой к ИИ */ const save = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "SimpleSiteEditor.useCallback[save]": async ()=>{
            const doc = specRef.current;
            const head = baseRef.current;
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$canonical$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["canonicalJson"])(doc) === (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$canonical$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["canonicalJson"])(head.spec)) return head;
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$canonical$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["canonicalByteLength"])(doc) > __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$spec$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SITE_SPEC_MAX_BYTES"]) {
                setState({
                    kind: 'error',
                    text: 'Сайт слишком большой: уберите часть текста'
                });
                return null;
            }
            const local = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$spec$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["validateSiteSpec"])(doc);
            if (!local.ok) {
                setState({
                    kind: 'error',
                    text: `Не сохранено: ${local.errors[0]?.message ?? 'проверьте последнюю правку'}`
                });
                return null;
            }
            setState({
                kind: 'saving'
            });
            const reply = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$data$3a$826c4a__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__["saveDraftAction"])(head.revision, doc);
            if (!reply.ok) {
                setState(reply.status === 409 && reply.code === 'VERSION_CONFLICT' ? {
                    kind: 'conflict'
                } : {
                    kind: 'error',
                    text: `Не сохранено: ${reply.message}`
                });
                return null;
            }
            const next = {
                id: reply.data.version.id,
                revision: reply.data.version.revision,
                spec: doc
            };
            baseRef.current = next;
            setBase(next);
            setState((0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$canonical$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["canonicalJson"])(specRef.current) === (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$canonical$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["canonicalJson"])(doc) ? {
                kind: 'saved'
            } : {
                kind: 'pending'
            });
            return next;
        }
    }["SimpleSiteEditor.useCallback[save]"], []);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "SimpleSiteEditor.useEffect": ()=>{
            if (!dirty || readOnly || state.kind === 'conflict' || state.kind === 'saving') return;
            setState({
                "SimpleSiteEditor.useEffect": (s)=>s.kind === 'error' ? s : {
                        kind: 'pending'
                    }
            }["SimpleSiteEditor.useEffect"]);
            const timer = setTimeout({
                "SimpleSiteEditor.useEffect.timer": ()=>void save()
            }["SimpleSiteEditor.useEffect.timer"], AUTOSAVE_MS);
            return ({
                "SimpleSiteEditor.useEffect": ()=>clearTimeout(timer)
            })["SimpleSiteEditor.useEffect"];
        // таймер перезапускает только правка
        }
    }["SimpleSiteEditor.useEffect"], [
        spec,
        dirty,
        readOnly,
        save
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "SimpleSiteEditor.useEffect": ()=>{
            if (!dirty) return;
            const onUnload = {
                "SimpleSiteEditor.useEffect.onUnload": (e)=>{
                    e.preventDefault();
                    e.returnValue = '';
                }
            }["SimpleSiteEditor.useEffect.onUnload"];
            window.addEventListener('beforeunload', onUnload);
            return ({
                "SimpleSiteEditor.useEffect": ()=>window.removeEventListener('beforeunload', onUnload)
            })["SimpleSiteEditor.useEffect"];
        }
    }["SimpleSiteEditor.useEffect"], [
        dirty
    ]);
    const refreshFeed = async ()=>{
        const r = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$data$3a$2415f5__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__["conversationAction"])();
        if (r.ok) setItems(r.data.items.filter((i)=>i.kind === 'BUILD'));
    };
    const loadVersion = async (id)=>{
        const r = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$data$3a$fcb604__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__["versionAction"])(id);
        if (!r.ok) return setAiError(r.message);
        const next = {
            id: r.data.version.id,
            revision: r.data.version.revision,
            spec: r.data.version.spec
        };
        baseRef.current = next;
        setBase(next);
        specRef.current = next.spec;
        setSpec(next.spec);
        setPast([]);
        lastKey.current = null;
        setState({
            kind: 'saved'
        });
    };
    const job = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$run$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGenerationRun"])({
        "SimpleSiteEditor.useGenerationRun[job]": async (run)=>{
            if (run.status === 'SUCCEEDED' && run.outputVersionId) await loadVersion(run.outputVersionId);
            else setAiError((0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$ai$2d$chat$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["errorText"])(run.errorCode));
            void refreshFeed();
        }
    }["SimpleSiteEditor.useGenerationRun[job]"]);
    // задача, начатая до обновления страницы, продолжает опрашиваться
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "SimpleSiteEditor.useEffect": ()=>{
            const live = conversation.find({
                "SimpleSiteEditor.useEffect.live": (i)=>i.kind === 'BUILD' && running(i)
            }["SimpleSiteEditor.useEffect.live"]);
            if (live) job.start({
                id: live.id,
                type: live.mode,
                status: live.status,
                baseVersionId: live.baseVersionId,
                outputVersionId: null,
                errorCode: null
            });
        // только при открытии
        }
    }["SimpleSiteEditor.useEffect"], []);
    const dictation = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$use$2d$dictation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useDictation"])({
        onText: {
            "SimpleSiteEditor.useDictation[dictation]": (phrase)=>setText({
                    "SimpleSiteEditor.useDictation[dictation]": (prev)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$use$2d$dictation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["appendDictated"])(prev, phrase, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$edit$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PATCH_INSTRUCTION_MAX"])
                }["SimpleSiteEditor.useDictation[dictation]"])
        }["SimpleSiteEditor.useDictation[dictation]"],
        onError: setAiError
    });
    const labelOf = (t, doc = spec)=>{
        if (!t) return null;
        const page = pagesOf(doc).find((p)=>String(p['id']) === t.pageId);
        const section = sectionsOf(page).find((s)=>String(s['id']) === t.sectionId);
        if (!section) return null;
        const type = __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SITE_EDITOR_SECTIONS"][String(section['type'])]?.label ?? 'Блок';
        const heading = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["localizedText"])(section['heading'], locale);
        return heading ? `${type}: ${heading}` : type;
    };
    const where = labelOf(target);
    const busy = job.active;
    const sendAi = async ()=>{
        if (readOnly || busy) return;
        const say = text.trim();
        if (!say && !where) return;
        dictation.stop();
        setAiError(null);
        const head = await save();
        if (!head) return;
        const reply = target && where ? await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$data$3a$b7a5ca__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__["sectionAction"])(head.id, target.pageId, target.sectionId, say) : await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$data$3a$f79428__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__["patchAction"])(head.id, say);
        if (!reply.ok) return setAiError(reply.message);
        setStartedAt(Date.now());
        setText('');
        job.start(reply.data.run);
        void refreshFeed();
    };
    /** «Вернуть как было»: версия до этой правки ИИ становится новой головой; опубликованный сайт не меняется */ const revert = async (item)=>{
        if (!item.baseVersionId) return;
        const ok = await ask({
            title: 'Вернуть сайт как было до этой правки?',
            body: 'Изменения ИИ уйдут из черновика. Опубликованный сайт не изменится.',
            confirmLabel: 'Вернуть'
        });
        if (!ok) return;
        const r = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$data$3a$a91882__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__["restoreAction"])(item.baseVersionId, baseRef.current.revision);
        if (!r.ok) return setAiError(r.message);
        await loadVersion(r.data.version.id);
        setReverted((ids)=>[
                ...ids,
                item.id
            ]);
        void refreshFeed();
    };
    const pickTemplate = (id)=>{
        if (readOnly) return;
        const next = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$templates$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["applySiteTemplate"])(specRef.current, id);
        if (next) edit(next, null);
        setTplOpen(false);
    };
    const inlineEdit = (path, loc, value)=>{
        const r = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$builder$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["setInlineText"])(specRef.current, path, loc, value);
        if (!r.ok) return setState({
            kind: 'error',
            text: r.message
        });
        edit(r.spec, `inline:${path}:${loc}`);
    };
    const status = state.kind === 'saving' || state.kind === 'pending' ? 'Сохраняем…' : state.kind === 'error' ? state.text : state.kind === 'conflict' ? 'Сайт изменили в другой вкладке' : published && published.id === base.id ? 'Сохранено, опубликовано' : published ? 'Сохранено, есть неопубликованные изменения' : 'Сохранено, ещё не опубликован';
    const lastDone = [
        ...items
    ].reverse().find((i)=>i.status === 'SUCCEEDED' && i.outputVersionId);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "lov-ed",
        "data-testid": "site-editor",
        children: [
            dialog,
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                className: "lov-ed__chat",
                "aria-labelledby": "lov-chat-title",
                "data-testid": "ed-ai",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("header", {
                        className: "lov-ed__chat-head",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                id: "lov-chat-title",
                                className: "lov-ed__project",
                                "data-testid": "ed-project",
                                children: locationName
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-editor.tsx",
                                lineNumber: 274,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cx"])('lov-ed__status', (state.kind === 'error' || state.kind === 'conflict') && 'is-error'),
                                role: "status",
                                "data-testid": "ed-dirty",
                                children: status
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-editor.tsx",
                                lineNumber: 277,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-editor.tsx",
                        lineNumber: 273,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "lov-ed__feed-wrap",
                        children: [
                            items.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "lov-ed__empty",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("b", {
                                            children: "Напишите, что поменять на сайте."
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-editor.tsx",
                                            lineNumber: 286,
                                            columnNumber: 17
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-editor.tsx",
                                        lineNumber: 285,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "muted",
                                        children: "Например: «сделай тексты короче» или «добавь про парковку». Чтобы изменить один блок, щёлкните его на сайте справа. Текст на сайте можно исправить прямо там."
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-editor.tsx",
                                        lineNumber: 288,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-editor.tsx",
                                lineNumber: 284,
                                columnNumber: 13
                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ol", {
                                className: "lov-ed__feed",
                                ref: feed,
                                "aria-label": "Разговор с ИИ",
                                "data-testid": "ed-feed",
                                children: items.map((item)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                        className: "lov-ed__turn",
                                        "data-testid": "ed-feed-item",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "lov-ed__ask",
                                                children: item.userText || (item.target ? `Обновить блок «${labelOf(item.target) ?? 'блок'}»` : 'Обновить сайт')
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-editor.tsx",
                                                lineNumber: 294,
                                                columnNumber: 19
                                            }, this),
                                            running(item) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "lov-ed__reply",
                                                role: "status",
                                                "data-testid": "ed-ai-state",
                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$ai$2d$chat$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BuildProgress"], {
                                                    startedAt: startedAt || Date.parse(item.createdAt)
                                                }, void 0, false, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-editor.tsx",
                                                    lineNumber: 297,
                                                    columnNumber: 23
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-editor.tsx",
                                                lineNumber: 296,
                                                columnNumber: 21
                                            }, this),
                                            item.status === 'FAILED' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "lov-ed__reply is-error",
                                                role: "alert",
                                                "data-testid": "ed-ai-error",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$ai$2d$chat$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["errorText"])(item.errorCode)
                                                    }, void 0, false, {
                                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-editor.tsx",
                                                        lineNumber: 302,
                                                        columnNumber: 23
                                                    }, this),
                                                    item.userText && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                                        type: "button",
                                                        tone: "ghost",
                                                        size: "sm",
                                                        onClick: ()=>setText(item.userText ?? ''),
                                                        children: "Повторить"
                                                    }, void 0, false, {
                                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-editor.tsx",
                                                        lineNumber: 304,
                                                        columnNumber: 25
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-editor.tsx",
                                                lineNumber: 301,
                                                columnNumber: 21
                                            }, this),
                                            item.status === 'SUCCEEDED' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "lov-ed__result",
                                                "data-testid": "ed-ai-done",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("b", {
                                                                children: "Готово."
                                                            }, void 0, false, {
                                                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-editor.tsx",
                                                                lineNumber: 313,
                                                                columnNumber: 25
                                                            }, this),
                                                            " Сайт справа уже с правками."
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-editor.tsx",
                                                        lineNumber: 312,
                                                        columnNumber: 23
                                                    }, this),
                                                    reverted.includes(item.id) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: "muted",
                                                        "data-testid": "ed-ai-reverted",
                                                        children: "Возвращено как было."
                                                    }, void 0, false, {
                                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-editor.tsx",
                                                        lineNumber: 316,
                                                        columnNumber: 25
                                                    }, this),
                                                    item.id === lastDone?.id && item.baseVersionId && !reverted.includes(item.id) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                                        type: "button",
                                                        tone: "secondary",
                                                        size: "sm",
                                                        disabled: readOnly || busy,
                                                        onClick: ()=>void revert(item),
                                                        "data-testid": "ed-ai-revert",
                                                        children: "Вернуть как было"
                                                    }, void 0, false, {
                                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-editor.tsx",
                                                        lineNumber: 321,
                                                        columnNumber: 25
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-editor.tsx",
                                                lineNumber: 311,
                                                columnNumber: 21
                                            }, this)
                                        ]
                                    }, item.id, true, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-editor.tsx",
                                        lineNumber: 293,
                                        columnNumber: 17
                                    }, this))
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-editor.tsx",
                                lineNumber: 291,
                                columnNumber: 13
                            }, this),
                            aiError && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "ed-error",
                                role: "alert",
                                "data-testid": "ed-ai-send-error",
                                children: aiError
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-editor.tsx",
                                lineNumber: 332,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-editor.tsx",
                        lineNumber: 282,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "lov-ed__chips",
                        role: "group",
                        "aria-label": "Частые просьбы",
                        children: copy.siteEditChips.map((chip)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$chip$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Chip"], {
                                size: "sm",
                                selected: text === chip,
                                disabled: readOnly || busy,
                                onClick: ()=>setText(chip),
                                "data-testid": "ed-chip",
                                children: chip
                            }, chip, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-editor.tsx",
                                lineNumber: 340,
                                columnNumber: 13
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-editor.tsx",
                        lineNumber: 338,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
                        className: "lov-ed__composer",
                        onSubmit: (e)=>{
                            e.preventDefault();
                            void sendAi();
                        },
                        children: [
                            where && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "lov-ed__target",
                                "data-testid": "ed-ai-target",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        children: [
                                            "Блок «",
                                            where,
                                            "»"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-editor.tsx",
                                        lineNumber: 355,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                        type: "button",
                                        tone: "ghost",
                                        size: "sm",
                                        onClick: ()=>setTarget(null),
                                        "aria-label": "Убрать блок: изменить весь сайт",
                                        children: "Весь сайт"
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-editor.tsx",
                                        lineNumber: 356,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-editor.tsx",
                                lineNumber: 354,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                htmlFor: "lov-ai-text",
                                className: "sr-only",
                                children: "Что изменить на сайте?"
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-editor.tsx",
                                lineNumber: 361,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("textarea", {
                                id: "lov-ai-text",
                                className: "lov-ed__input",
                                rows: 3,
                                maxLength: __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$edit$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PATCH_INSTRUCTION_MAX"],
                                placeholder: where ? 'Что изменить в этом блоке?' : 'Что изменить на сайте?',
                                value: text,
                                disabled: readOnly || busy,
                                onChange: (e)=>setText(e.currentTarget.value),
                                onKeyDown: (e)=>{
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        void sendAi();
                                    }
                                }
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-editor.tsx",
                                lineNumber: 364,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "lov-ed__tools",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                        type: "button",
                                        tone: "ghost",
                                        size: "sm",
                                        disabled: readOnly || past.length === 0,
                                        onClick: undo,
                                        "data-testid": "ed-undo",
                                        children: "Отменить правку"
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-editor.tsx",
                                        lineNumber: 381,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "lov-ed__grow"
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-editor.tsx",
                                        lineNumber: 384,
                                        columnNumber: 13
                                    }, this),
                                    dictation.supported && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                        type: "button",
                                        tone: "secondary",
                                        size: "sm",
                                        "aria-pressed": dictation.listening,
                                        "aria-label": dictation.listening ? 'Остановить диктовку' : 'Надиктовать',
                                        disabled: readOnly || busy,
                                        onClick: ()=>dictation.toggle(),
                                        "data-testid": "ed-mic",
                                        children: dictation.listening ? 'Стоп' : 'Голос'
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-editor.tsx",
                                        lineNumber: 386,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                        type: "submit",
                                        size: "sm",
                                        disabled: readOnly || busy || !text.trim() && !where,
                                        "data-testid": "ed-ai-send",
                                        children: busy ? 'ИИ работает…' : 'Отправить'
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-editor.tsx",
                                        lineNumber: 399,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-editor.tsx",
                                lineNumber: 380,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-editor.tsx",
                        lineNumber: 346,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-editor.tsx",
                lineNumber: 272,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                className: "lov-ed__stage",
                "aria-label": "Сайт",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "lov-ed__bar",
                        "data-testid": "ed-bar",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "lov-ed__tpl",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                        type: "button",
                                        tone: "secondary",
                                        "aria-expanded": tplOpen,
                                        "aria-controls": "lov-tpl-list",
                                        onClick: ()=>setTplOpen((o)=>!o),
                                        "data-testid": "ed-template-open",
                                        children: [
                                            "Шаблон: ",
                                            current?.name ?? 'свой'
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-editor.tsx",
                                        lineNumber: 409,
                                        columnNumber: 13
                                    }, this),
                                    tplOpen && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        id: "lov-tpl-list",
                                        className: "lov-ed__tpl-list",
                                        role: "radiogroup",
                                        "aria-label": "Шаблон сайта",
                                        "data-testid": "ed-templates",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "muted",
                                                children: "Тексты, фото и цены останутся, поменяется оформление."
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-editor.tsx",
                                                lineNumber: 414,
                                                columnNumber: 17
                                            }, this),
                                            templates.map((tpl)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                    type: "button",
                                                    role: "radio",
                                                    "aria-checked": current?.id === tpl.id,
                                                    disabled: readOnly || busy,
                                                    className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cx"])('simple-ed__tpl', current?.id === tpl.id && 'is-on'),
                                                    onClick: ()=>pickTemplate(tpl.id),
                                                    "data-testid": "ed-template",
                                                    "data-template": tpl.id,
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cx"])('ed-design__swatch', `is-${tpl.direction.theme.preset.toLowerCase()}`),
                                                            "aria-hidden": "true"
                                                        }, void 0, false, {
                                                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-editor.tsx",
                                                            lineNumber: 427,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("b", {
                                                            children: tpl.name
                                                        }, void 0, false, {
                                                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-editor.tsx",
                                                            lineNumber: 428,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            className: "muted",
                                                            children: tpl.description
                                                        }, void 0, false, {
                                                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-editor.tsx",
                                                            lineNumber: 429,
                                                            columnNumber: 21
                                                        }, this)
                                                    ]
                                                }, tpl.id, true, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-editor.tsx",
                                                    lineNumber: 416,
                                                    columnNumber: 19
                                                }, this))
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-editor.tsx",
                                        lineNumber: 413,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-editor.tsx",
                                lineNumber: 408,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "lov-ed__grow"
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-editor.tsx",
                                lineNumber: 435,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                className: "btn btn--ghost",
                                href: "/marketing/site/assets",
                                "data-testid": "editor-assets-link",
                                children: "Фото"
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-editor.tsx",
                                lineNumber: 436,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                className: "btn btn--ghost",
                                href: "/marketing/site/editor?full=1",
                                "data-testid": "ed-advanced",
                                children: "Расширенный режим"
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-editor.tsx",
                                lineNumber: 439,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                className: "btn",
                                href: "/marketing/site",
                                "data-testid": "editor-publication-link",
                                children: "Опубликовать"
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-editor.tsx",
                                lineNumber: 442,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-editor.tsx",
                        lineNumber: 407,
                        columnNumber: 9
                    }, this),
                    state.kind === 'conflict' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Alert"], {
                        boxed: true,
                        "data-testid": "ed-conflict",
                        children: [
                            "Сайт уже изменили в другой вкладке или ИИ.",
                            ' ',
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                type: "button",
                                size: "sm",
                                tone: "secondary",
                                onClick: ()=>window.location.reload(),
                                children: "Обновить"
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-editor.tsx",
                                lineNumber: 449,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-editor.tsx",
                        lineNumber: 447,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$preview$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SitePreview"], {
                        spec: spec,
                        pageId: previewPage,
                        onPage: setPreviewPage,
                        locales: locales,
                        defaultLocale: locale,
                        assets: assetUrls,
                        selectedSectionId: target?.sectionId ?? null,
                        onPickSection: (pageId, sectionId)=>setTarget({
                                pageId,
                                sectionId
                            }),
                        onOpenSeparately: ()=>undefined,
                        mode: "simple",
                        setMode: ()=>undefined,
                        onInlineEdit: inlineEdit,
                        readOnly: readOnly,
                        simple: true
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-editor.tsx",
                        lineNumber: 454,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-editor.tsx",
                lineNumber: 406,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-editor.tsx",
        lineNumber: 270,
        columnNumber: 5
    }, this);
}
_s(SimpleSiteEditor, "HdDQNlVvfoIW7Yd7P8+rhK53E8s=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$use$2d$confirm$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useConfirm"],
        __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$run$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGenerationRun"],
        __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$use$2d$dictation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useDictation"]
    ];
});
_c = SimpleSiteEditor;
var _c;
__turbopack_context__.k.register(_c, "SimpleSiteEditor");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SimpleSiteSetup",
    ()=>SimpleSiteSetup
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/index.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$simple$2d$edit$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/simple-edit.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$copy$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/site-copy.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$templates$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/site-templates.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$canonical$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/canonical.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/ui.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$use$2d$confirm$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/use-confirm.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$data$3a$c131bd__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/site/editor/data:c131bd [app-client] (ecmascript) <text/javascript>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$data$3a$826c4a__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/site/editor/data:826c4a [app-client] (ecmascript) <text/javascript>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$data$3a$9dfeb2__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/site/editor/data:9dfeb2 [app-client] (ecmascript) <text/javascript>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$preview$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/site/editor/preview.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$template$2d$gallery$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/site/editor/template-gallery.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
'use client';
;
;
;
;
;
;
;
;
const AUTOSAVE_MS = 1000;
const asImage = (a)=>({
        assetId: a.id,
        alt: {
            ru: a.defaultAlt?.ru?.trim() || 'Фото'
        }
    });
function SimpleSiteSetup({ vertical, base: initialBase, published, siteUrl, locationName, facts, assets: initialAssets, readOnly, publish: publishTo = {
    href: '/marketing/site'
} }) {
    _s();
    const templates = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "SimpleSiteSetup.useMemo[templates]": ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$templates$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["siteTemplatesFor"])(vertical)
    }["SimpleSiteSetup.useMemo[templates]"], [
        vertical
    ]);
    const [base, setBase] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(initialBase);
    const [spec, setSpec] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(initialBase.spec);
    const [assets, setAssets] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(initialAssets);
    const [state, setState] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('saved');
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [notice, setNotice] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [copyIndex, setCopyIndex] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(0);
    const [busy, setBusy] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [url, setUrl] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(siteUrl);
    const [publishedId, setPublishedId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(published?.id ?? null);
    const specRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(spec);
    specRef.current = spec;
    const baseRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(base);
    baseRef.current = base;
    const { ask, dialog } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$use$2d$confirm$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useConfirm"])();
    const st = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$simple$2d$edit$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["simpleSiteState"])(spec);
    const current = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$templates$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["currentSiteTemplate"])(spec, vertical);
    const locale = String(spec['site']?.['defaultLocale'] ?? 'ru');
    const assetUrls = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "SimpleSiteSetup.useMemo[assetUrls]": ()=>Object.fromEntries(assets.filter({
                "SimpleSiteSetup.useMemo[assetUrls]": (a)=>a.previewUrl
            }["SimpleSiteSetup.useMemo[assetUrls]"]).map({
                "SimpleSiteSetup.useMemo[assetUrls]": (a)=>[
                        a.id,
                        a.previewUrl
                    ]
            }["SimpleSiteSetup.useMemo[assetUrls]"]))
    }["SimpleSiteSetup.useMemo[assetUrls]"], [
        assets
    ]);
    const dirty = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$canonical$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["canonicalJson"])(spec) !== (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$canonical$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["canonicalJson"])(base.spec);
    /** Шаблон по свежим данным: из него возвращаются выключенные блоки */ const template = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "SimpleSiteSetup.useMemo[template]": ()=>{
            if (!facts) return null;
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$templates$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["templateSiteSpec"])(facts, current?.id ?? templates[0]?.id);
        }
    }["SimpleSiteSetup.useMemo[template]"], [
        facts,
        current?.id,
        templates
    ]);
    const apply = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "SimpleSiteSetup.useCallback[apply]": (next)=>{
            if (next === specRef.current) return;
            specRef.current = next;
            setSpec(next);
            setError(null);
        }
    }["SimpleSiteSetup.useCallback[apply]"], []);
    const save = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "SimpleSiteSetup.useCallback[save]": async ()=>{
            const doc = specRef.current;
            const head = baseRef.current;
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$canonical$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["canonicalJson"])(doc) === (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$canonical$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["canonicalJson"])(head.spec)) return head;
            setState('saving');
            const reply = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$data$3a$826c4a__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__["saveDraftAction"])(head.revision, doc);
            if (!reply.ok) {
                setState(reply.status === 409 && reply.code === 'VERSION_CONFLICT' ? 'conflict' : 'error');
                setError(reply.message);
                return null;
            }
            const next = {
                id: reply.data.version.id,
                revision: reply.data.version.revision,
                spec: doc
            };
            baseRef.current = next;
            setBase(next);
            setState((0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$canonical$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["canonicalJson"])(specRef.current) === (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$canonical$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["canonicalJson"])(doc) ? 'saved' : 'pending');
            return next;
        }
    }["SimpleSiteSetup.useCallback[save]"], []);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "SimpleSiteSetup.useEffect": ()=>{
            if (!dirty || readOnly || state === 'conflict' || state === 'saving') return;
            setState('pending');
            const timer = setTimeout({
                "SimpleSiteSetup.useEffect.timer": ()=>void save()
            }["SimpleSiteSetup.useEffect.timer"], AUTOSAVE_MS);
            return ({
                "SimpleSiteSetup.useEffect": ()=>clearTimeout(timer)
            })["SimpleSiteSetup.useEffect"];
        // таймер перезапускает только правка
        }
    }["SimpleSiteSetup.useEffect"], [
        spec,
        dirty,
        readOnly,
        save
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "SimpleSiteSetup.useEffect": ()=>{
            if (!dirty) return;
            const onUnload = {
                "SimpleSiteSetup.useEffect.onUnload": (e)=>{
                    e.preventDefault();
                    e.returnValue = '';
                }
            }["SimpleSiteSetup.useEffect.onUnload"];
            window.addEventListener('beforeunload', onUnload);
            return ({
                "SimpleSiteSetup.useEffect": ()=>window.removeEventListener('beforeunload', onUnload)
            })["SimpleSiteSetup.useEffect"];
        }
    }["SimpleSiteSetup.useEffect"], [
        dirty
    ]);
    const upload = async (files)=>{
        if (!files?.length) return [];
        setBusy('upload');
        setError(null);
        const done = [];
        for (const file of Array.from(files).slice(0, 12)){
            const form = new FormData();
            form.append('file', file);
            const r = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$data$3a$9dfeb2__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__["uploadSitePhotoAction"])(form);
            if (r.ok) done.push(r.asset);
            else setError(r.message);
        }
        setAssets((list)=>[
                ...done.filter((a)=>!list.some((x)=>x.id === a.id)),
                ...list
            ]);
        setBusy(null);
        return done;
    };
    const suggest = ()=>{
        const c = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$copy$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["siteCopySuggestion"])(vertical, copyIndex, locationName);
        let next = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$simple$2d$edit$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["setHeroText"])(specRef.current, 'heading', locale, c.heading);
        next = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$simple$2d$edit$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["setHeroText"])(next, 'subheading', locale, c.subheading);
        next = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$simple$2d$edit$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["setAboutText"])(next, locale, c.about);
        apply(next);
        setCopyIndex((i)=>(i + 1) % (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$copy$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SITE_COPY_COUNT"])(vertical));
        setNotice('Текст подставлен. Поправьте под себя: цифры, гарантии и акции должны быть правдой.');
    };
    const publish = async ()=>{
        const ok = await ask({
            title: publishedId ? 'Обновить сайт?' : 'Опубликовать сайт?',
            body: 'Посетители увидят сайт таким, как справа. Цены, услуги и часы и дальше будут обновляться сами из WETOP.',
            confirmLabel: 'Опубликовать'
        });
        if (!ok) return;
        setBusy('publish');
        setError(null);
        const head = await save();
        if (!head) return setBusy(null);
        const r = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$data$3a$c131bd__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__["publishSimpleAction"])(head.id);
        setBusy(null);
        if (!r.ok) {
            setError(r.needsSetup ? `${r.message}. Откройте «Публикация», чтобы выбрать тариф.` : r.message);
            return;
        }
        setPublishedId(head.id);
        if (r.url) setUrl(r.url);
        setNotice('Сайт опубликован.');
    };
    const statusText = state === 'saving' || state === 'pending' ? 'Сохраняем…' : state === 'conflict' ? 'Сайт изменили в другой вкладке: обновите страницу' : state === 'error' ? 'Не сохранено' : publishedId && publishedId === base.id ? 'Сохранено и опубликовано' : publishedId ? 'Сохранено, есть неопубликованные изменения' : 'Сохранено, ещё не опубликован';
    const live = !!publishedId && publishedId === base.id;
    const photos = assets.filter((a)=>a.kind === 'IMAGE' && a.previewUrl);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "setup",
        "data-testid": "site-setup",
        children: [
            dialog,
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                className: "setup__steps",
                "aria-label": "Настройка сайта",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("header", {
                        className: "setup__head",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                    className: "setup__title",
                                    children: locationName
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                    lineNumber: 209,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cx"])('setup__status', (state === 'error' || state === 'conflict') && 'is-error'),
                                    role: "status",
                                    "data-testid": "setup-status",
                                    children: statusText
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                    lineNumber: 210,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                            lineNumber: 208,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                        lineNumber: 207,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "setup__mirror",
                        "data-testid": "setup-mirror",
                        children: "Услуги, цены, мастера, часы и контакты сайт берёт из WETOP сам. Поменяли в WETOP, сайт обновится без публикации."
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                        lineNumber: 215,
                        columnNumber: 9
                    }, this),
                    error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Alert"], {
                        boxed: true,
                        tone: "warning",
                        role: "alert",
                        "data-testid": "setup-error",
                        children: error
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                        lineNumber: 219,
                        columnNumber: 11
                    }, this),
                    notice && !error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "setup__notice",
                        role: "status",
                        "data-testid": "setup-notice",
                        children: notice
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                        lineNumber: 224,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("fieldset", {
                        className: "setup__step",
                        disabled: readOnly || !!busy,
                        "data-testid": "setup-template",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("legend", {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "setup__n",
                                        children: "1"
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                        lineNumber: 231,
                                        columnNumber: 13
                                    }, this),
                                    "Шаблон"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                lineNumber: 230,
                                columnNumber: 11
                            }, this),
                            facts ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$template$2d$gallery$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TemplateGallery"], {
                                facts: facts,
                                templates: templates,
                                chosen: current?.id ?? null,
                                onChoose: (id)=>{
                                    const next = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$templates$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["applySiteTemplate"])(specRef.current, id);
                                    if (next) apply(next);
                                },
                                disabled: readOnly || !!busy,
                                compact: true
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                lineNumber: 234,
                                columnNumber: 13
                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "setup__tpls",
                                role: "radiogroup",
                                "aria-label": "Шаблон сайта",
                                children: templates.map((tpl)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        type: "button",
                                        role: "radio",
                                        "aria-checked": current?.id === tpl.id,
                                        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cx"])('setup__tpl', current?.id === tpl.id && 'is-on'),
                                        onClick: ()=>{
                                            const next = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$templates$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["applySiteTemplate"])(specRef.current, tpl.id);
                                            if (next) apply(next);
                                        },
                                        "data-testid": "setup-template-option",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cx"])('ed-design__swatch', `is-${tpl.direction.theme.preset.toLowerCase()}`),
                                                "aria-hidden": "true"
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                                lineNumber: 260,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("b", {
                                                children: tpl.name
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                                lineNumber: 261,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "muted",
                                                children: tpl.description
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                                lineNumber: 262,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, tpl.id, true, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                        lineNumber: 248,
                                        columnNumber: 17
                                    }, this))
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                lineNumber: 246,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                        lineNumber: 229,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("fieldset", {
                        className: "setup__step",
                        disabled: readOnly || !!busy,
                        "data-testid": "setup-photos",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("legend", {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "setup__n",
                                        children: "2"
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                        lineNumber: 271,
                                        columnNumber: 13
                                    }, this),
                                    "Фото"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                lineNumber: 270,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "setup__photo-row",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "setup__cover",
                                        children: st.heroPhoto && assetUrls[st.heroPhoto.assetId] ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                                            src: assetUrls[st.heroPhoto.assetId],
                                            alt: st.heroPhoto.alt[locale] ?? 'Обложка'
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                            lineNumber: 276,
                                            columnNumber: 17
                                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "muted",
                                            children: "Нет обложки"
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                            lineNumber: 278,
                                            columnNumber: 17
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                        lineNumber: 274,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "setup__photo-actions",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("b", {
                                                children: "Обложка сайта"
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                                lineNumber: 282,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "muted",
                                                children: "Большое фото на первом экране"
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                                lineNumber: 283,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                className: "btn btn--secondary btn--sm setup__file",
                                                children: [
                                                    st.heroPhoto ? 'Заменить обложку' : 'Загрузить обложку',
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                        type: "file",
                                                        accept: "image/jpeg,image/png,image/webp",
                                                        className: "sr-only",
                                                        "data-testid": "setup-cover-file",
                                                        onChange: async (e)=>{
                                                            const [a] = await upload(e.currentTarget.files);
                                                            e.currentTarget.value = '';
                                                            if (a) apply((0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$simple$2d$edit$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["setHeroPhoto"])(specRef.current, asImage(a)));
                                                        }
                                                    }, void 0, false, {
                                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                                        lineNumber: 286,
                                                        columnNumber: 17
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                                lineNumber: 284,
                                                columnNumber: 15
                                            }, this),
                                            st.heroPhoto && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                                type: "button",
                                                tone: "ghost",
                                                size: "sm",
                                                onClick: ()=>apply((0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$simple$2d$edit$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["setHeroPhoto"])(specRef.current, null)),
                                                children: "Убрать обложку"
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                                lineNumber: 299,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                        lineNumber: 281,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                lineNumber: 273,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "setup__gallery-head",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("b", {
                                        children: "Галерея работ"
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                        lineNumber: 306,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "muted",
                                        children: st.gallery.length >= 3 ? `${st.gallery.length} фото на сайте` : 'Появится на сайте от 3 фото'
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                        lineNumber: 307,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                lineNumber: 305,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "setup__thumbs",
                                "data-testid": "setup-gallery",
                                children: [
                                    st.gallery.map((img, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "setup__thumb",
                                            children: [
                                                assetUrls[img.assetId] ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                                                    src: assetUrls[img.assetId],
                                                    alt: img.alt[locale] ?? 'Фото'
                                                }, void 0, false, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                                    lineNumber: 312,
                                                    columnNumber: 43
                                                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "muted",
                                                    children: "Фото"
                                                }, void 0, false, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                                    lineNumber: 312,
                                                    columnNumber: 114
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                    type: "button",
                                                    className: "setup__thumb-x",
                                                    "aria-label": "Убрать фото из галереи",
                                                    onClick: ()=>apply((0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$simple$2d$edit$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["setGalleryPhotos"])(specRef.current, st.gallery.filter((_, j)=>j !== i))),
                                                    children: "×"
                                                }, void 0, false, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                                    lineNumber: 313,
                                                    columnNumber: 17
                                                }, this)
                                            ]
                                        }, `${img.assetId}-${i}`, true, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                            lineNumber: 311,
                                            columnNumber: 15
                                        }, this)),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                        className: "setup__thumb setup__thumb--add",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                children: busy === 'upload' ? 'Загружаем…' : '+ Добавить фото'
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                                lineNumber: 324,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                type: "file",
                                                multiple: true,
                                                accept: "image/jpeg,image/png,image/webp",
                                                className: "sr-only",
                                                "data-testid": "setup-gallery-file",
                                                onChange: async (e)=>{
                                                    const added = await upload(e.currentTarget.files);
                                                    e.currentTarget.value = '';
                                                    if (added.length) apply((0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$simple$2d$edit$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["setGalleryPhotos"])(specRef.current, [
                                                        ...(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$simple$2d$edit$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["simpleSiteState"])(specRef.current).gallery,
                                                        ...added.map(asImage)
                                                    ]));
                                                }
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                                lineNumber: 325,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                        lineNumber: 323,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                lineNumber: 309,
                                columnNumber: 11
                            }, this),
                            photos.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("details", {
                                className: "setup__library",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("summary", {
                                        children: [
                                            "Выбрать из загруженных (",
                                            photos.length,
                                            ")"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                        lineNumber: 341,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "setup__thumbs",
                                        children: photos.map((a)=>{
                                            const inGallery = st.gallery.some((g)=>g.assetId === a.id);
                                            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                type: "button",
                                                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cx"])('setup__thumb', inGallery && 'is-on'),
                                                "aria-pressed": inGallery,
                                                "aria-label": inGallery ? 'Убрать из галереи' : 'Добавить в галерею',
                                                onClick: ()=>apply((0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$simple$2d$edit$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["setGalleryPhotos"])(specRef.current, inGallery ? st.gallery.filter((g)=>g.assetId !== a.id) : [
                                                        ...st.gallery,
                                                        asImage(a)
                                                    ])),
                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                                                    src: a.previewUrl,
                                                    alt: ""
                                                }, void 0, false, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                                    lineNumber: 361,
                                                    columnNumber: 23
                                                }, this)
                                            }, a.id, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                                lineNumber: 346,
                                                columnNumber: 21
                                            }, this);
                                        })
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                        lineNumber: 342,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                lineNumber: 340,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                        lineNumber: 269,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("fieldset", {
                        className: "setup__step",
                        disabled: readOnly || !!busy,
                        "data-testid": "setup-texts",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("legend", {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "setup__n",
                                        children: "3"
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                        lineNumber: 372,
                                        columnNumber: 13
                                    }, this),
                                    "Тексты"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                lineNumber: 371,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                type: "button",
                                tone: "secondary",
                                size: "sm",
                                onClick: suggest,
                                "data-testid": "setup-suggest",
                                children: "✦ Предложить текст"
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                lineNumber: 374,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(TextBox, {
                                id: "setup-heading",
                                label: "Заголовок",
                                value: st.heroHeading,
                                max: 80,
                                onCommit: (v)=>apply((0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$simple$2d$edit$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["setHeroText"])(specRef.current, 'heading', locale, v))
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                lineNumber: 377,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(TextBox, {
                                id: "setup-sub",
                                label: "Подзаголовок: главная выгода",
                                value: st.heroSubheading,
                                max: 200,
                                rows: 2,
                                onCommit: (v)=>apply((0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$simple$2d$edit$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["setHeroText"])(specRef.current, 'subheading', locale, v))
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                lineNumber: 384,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(TextBox, {
                                id: "setup-about",
                                label: "О нас",
                                hint: "Абзацы через пустую строку. Пусто, блока нет.",
                                value: st.about,
                                max: 1800,
                                rows: 5,
                                onCommit: (v)=>apply((0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$simple$2d$edit$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["setAboutText"])(specRef.current, locale, v))
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                lineNumber: 392,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                        lineNumber: 370,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("fieldset", {
                        className: "setup__step",
                        disabled: readOnly || !!busy,
                        "data-testid": "setup-blocks",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("legend", {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "setup__n",
                                        children: "4"
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                        lineNumber: 405,
                                        columnNumber: 13
                                    }, this),
                                    "Блоки на сайте"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                lineNumber: 404,
                                columnNumber: 11
                            }, this),
                            __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$simple$2d$edit$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SIMPLE_BLOCKS"].map((b)=>{
                                const on = st.blocks[b.type] === true;
                                const possible = on || !!template && (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$simple$2d$edit$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["simpleSiteState"])(template).blocks[b.type] === true;
                                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                    className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cx"])('setup__toggle', !possible && 'is-off'),
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                            type: "checkbox",
                                            role: "switch",
                                            checked: on,
                                            disabled: !possible,
                                            onChange: (e)=>template && apply((0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$simple$2d$edit$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toggleSiteBlock"])(specRef.current, b.type, e.currentTarget.checked, template)),
                                            "data-testid": `setup-block-${b.type}`
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                            lineNumber: 412,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("b", {
                                                    children: b.label
                                                }, void 0, false, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                                    lineNumber: 421,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "muted",
                                                    children: possible ? b.hint : 'Нет данных в WETOP'
                                                }, void 0, false, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                                    lineNumber: 422,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                            lineNumber: 420,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, b.type, true, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                    lineNumber: 411,
                                    columnNumber: 15
                                }, this);
                            })
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                        lineNumber: 403,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "setup__step setup__publish",
                        "data-testid": "setup-publish",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "setup__publish-head",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "setup__n",
                                        children: "5"
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                        lineNumber: 431,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("b", {
                                        children: "Публикация"
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                        lineNumber: 432,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                lineNumber: 430,
                                columnNumber: 11
                            }, this),
                            url && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "setup__url",
                                children: [
                                    "Адрес:",
                                    ' ',
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                        href: url,
                                        target: "_blank",
                                        rel: "noreferrer",
                                        "data-testid": "setup-url",
                                        children: url.replace(/^https?:\/\//, '')
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                        lineNumber: 437,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                lineNumber: 435,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                type: "button",
                                disabled: readOnly || !!busy || live || 'reason' in publishTo,
                                "aria-describedby": 'reason' in publishTo ? 'setup-publish-reason' : undefined,
                                onClick: ()=>void publish(),
                                "data-testid": "setup-publish-btn",
                                children: busy === 'publish' ? 'Публикуем…' : live ? 'Опубликовано' : publishedId ? 'Обновить сайт' : 'Опубликовать сайт'
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                lineNumber: 442,
                                columnNumber: 11
                            }, this),
                            'reason' in publishTo && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "muted",
                                id: "setup-publish-reason",
                                "data-testid": "setup-publish-reason",
                                children: publishTo.reason
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                lineNumber: 452,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                                className: "setup__more",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                            href: "/marketing/site",
                                            children: "Публикация и домен"
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                            lineNumber: 458,
                                            columnNumber: 15
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                        lineNumber: 457,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                            href: "/marketing/site/editor?full=1",
                                            children: "Расширенный режим"
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                            lineNumber: 461,
                                            columnNumber: 15
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                        lineNumber: 460,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                                lineNumber: 456,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                        lineNumber: 429,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                lineNumber: 206,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                className: "setup__site",
                "aria-label": "Сайт",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$preview$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SitePreview"], {
                    spec: spec,
                    pageId: null,
                    onPage: ()=>undefined,
                    locales: [
                        locale
                    ],
                    defaultLocale: locale,
                    assets: assetUrls,
                    selectedSectionId: null,
                    onPickSection: ()=>undefined,
                    onOpenSeparately: ()=>undefined,
                    mode: "select",
                    setMode: ()=>undefined,
                    onInlineEdit: ()=>undefined,
                    readOnly: true,
                    simple: true
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                    lineNumber: 468,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                lineNumber: 467,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
        lineNumber: 204,
        columnNumber: 5
    }, this);
}
_s(SimpleSiteSetup, "gzT8DZpX6waisrTJEB9hbuyM6ak=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$use$2d$confirm$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useConfirm"]
    ];
});
_c = SimpleSiteSetup;
/** Поле текста: правка уходит в сайт по выходу из поля (а не на каждую букву), Enter в однострочном применяет */ function TextBox({ id, label, hint, value, max, rows = 1, onCommit }) {
    _s1();
    const [text, setText] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(value);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "TextBox.useEffect": ()=>setText(value)
    }["TextBox.useEffect"], [
        value
    ]);
    const commit = ()=>{
        if (text !== value) onCommit(text);
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "setup__field",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                htmlFor: id,
                children: label
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                lineNumber: 514,
                columnNumber: 7
            }, this),
            hint && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "muted setup__hint",
                children: hint
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                lineNumber: 515,
                columnNumber: 16
            }, this),
            rows === 1 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                id: id,
                value: text,
                maxLength: max,
                onChange: (e)=>setText(e.currentTarget.value),
                onBlur: commit,
                onKeyDown: (e)=>e.key === 'Enter' && commit(),
                "data-testid": id
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                lineNumber: 517,
                columnNumber: 9
            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Textarea"], {
                id: id,
                rows: rows,
                value: text,
                maxLength: max,
                onChange: (e)=>setText(e.currentTarget.value),
                onBlur: commit,
                "data-testid": id
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
                lineNumber: 527,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/simple-setup.tsx",
        lineNumber: 513,
        columnNumber: 5
    }, this);
}
_s1(TextBox, "IKVtJHM2akjbAx+6GagMxy0f0zQ=");
_c1 = TextBox;
var _c, _c1;
__turbopack_context__.k.register(_c, "SimpleSiteSetup");
__turbopack_context__.k.register(_c1, "TextBox");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/app/marketing/site/editor/site-facts-card.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SiteFactsCard",
    ()=>SiteFactsCard
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$money$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/money.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$site$2d$facts$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/site-facts.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$plural$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/plural.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$vertical$2d$copy$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/vertical-copy.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/ui.tsx [app-client] (ecmascript)");
;
;
;
;
;
;
;
/**
 * Карточка «Что WETOP знает о филиале» (SITE-1, план §1 шаг 1): только данные системы, без ИИ. Каталог первыми
 * позициями и «ещё K», пробелы со ссылкой «Дополнить» туда, где данные заводятся. Сайт можно делать и с пробелами.
 */ const CATALOG_SHOWN = 5;
const STAFF_SHOWN = 6;
function SiteFactsCard({ vertical, facts }) {
    const copy = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$vertical$2d$copy$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["verticalCopy"])(vertical);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("aside", {
        className: "site-facts panel",
        "aria-labelledby": "site-facts-title",
        "data-testid": "create-site-facts",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                id: "site-facts-title",
                className: "site-facts__title",
                children: "Что WETOP знает о филиале"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/site-facts-card.tsx",
                lineNumber: 20,
                columnNumber: 7
            }, this),
            !facts.ok ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Alert"], {
                "data-testid": "site-facts-error",
                children: [
                    "Данные филиала не загрузились: ",
                    facts.message,
                    ". Сайт можно собрать и так, факты ИИ возьмёт на сервере."
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/site-facts-card.tsx",
                lineNumber: 24,
                columnNumber: 9
            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(FactsBody, {
                facts: facts.data,
                catalogTitle: copy.catalogTitle
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/site-facts-card.tsx",
                lineNumber: 26,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/site-facts-card.tsx",
        lineNumber: 19,
        columnNumber: 5
    }, this);
}
_c = SiteFactsCard;
function FactsBody({ facts, catalogTitle }) {
    const { location, catalog, staff, gaps } = facts;
    const items = catalog.items.slice(0, CATALOG_SHOWN);
    const more = catalog.items.length - items.length;
    const people = staff.slice(0, STAFF_SHOWN);
    const hourLines = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$site$2d$facts$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["hoursLines"])(facts);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dl", {
                className: "site-facts__list",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Row, {
                        label: "Филиал",
                        value: location.name
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/site-facts-card.tsx",
                        lineNumber: 41,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Row, {
                        label: "Город",
                        value: location.city
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/site-facts-card.tsx",
                        lineNumber: 42,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Row, {
                        label: "Адрес",
                        value: location.address
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/site-facts-card.tsx",
                        lineNumber: 43,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Row, {
                        label: "Телефон",
                        value: location.phone
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/site-facts-card.tsx",
                        lineNumber: 44,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Row, {
                        label: "WhatsApp",
                        value: location.whatsapp
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/site-facts-card.tsx",
                        lineNumber: 45,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/site-facts-card.tsx",
                lineNumber: 40,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                className: "site-facts__block",
                "aria-labelledby": "site-facts-catalog",
                "data-testid": "site-facts-catalog",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h4", {
                        id: "site-facts-catalog",
                        children: catalogTitle
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/site-facts-card.tsx",
                        lineNumber: 48,
                        columnNumber: 9
                    }, this),
                    items.length ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                        className: "site-facts__items",
                        children: items.map((item, i)=>{
                            const price = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$site$2d$facts$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["catalogPrice"])(item, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$money$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatMoney"]);
                            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        children: [
                                            item.name,
                                            item.durationMin ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "muted",
                                                children: [
                                                    ", ",
                                                    item.durationMin,
                                                    " мин"
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/site-facts-card.tsx",
                                                lineNumber: 57,
                                                columnNumber: 41
                                            }, this) : null
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/site-facts-card.tsx",
                                        lineNumber: 55,
                                        columnNumber: 19
                                    }, this),
                                    price && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("b", {
                                        className: "site-facts__price",
                                        children: price
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/site-facts-card.tsx",
                                        lineNumber: 59,
                                        columnNumber: 29
                                    }, this)
                                ]
                            }, `${item.code}-${i}`, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/site-facts-card.tsx",
                                lineNumber: 54,
                                columnNumber: 17
                            }, this);
                        })
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/site-facts-card.tsx",
                        lineNumber: 50,
                        columnNumber: 11
                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "muted",
                        children: "Пока пусто"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/site-facts-card.tsx",
                        lineNumber: 65,
                        columnNumber: 11
                    }, this),
                    more > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "muted",
                        "data-testid": "site-facts-more",
                        children: [
                            "и ещё ",
                            (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$plural$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["pluralRu"])(more, [
                                'позиция',
                                'позиции',
                                'позиций'
                            ])
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/site-facts-card.tsx",
                        lineNumber: 68,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/site-facts-card.tsx",
                lineNumber: 47,
                columnNumber: 7
            }, this),
            (facts.vertical === 'BEAUTY' || people.length > 0) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                className: "site-facts__block",
                "aria-labelledby": "site-facts-staff",
                "data-testid": "site-facts-staff",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h4", {
                        id: "site-facts-staff",
                        children: "Мастера"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/site-facts-card.tsx",
                        lineNumber: 75,
                        columnNumber: 11
                    }, this),
                    people.length ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        children: [
                            people.map((p)=>p.specialization ? `${p.name} (${p.specialization})` : p.name).join(', '),
                            staff.length > people.length ? ` и ещё ${staff.length - people.length}` : ''
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/site-facts-card.tsx",
                        lineNumber: 77,
                        columnNumber: 13
                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "muted",
                        children: "Пока нет"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/site-facts-card.tsx",
                        lineNumber: 82,
                        columnNumber: 13
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/site-facts-card.tsx",
                lineNumber: 74,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dl", {
                className: "site-facts__list",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "site-facts__row",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                children: facts.vertical === 'HOSPITALITY' ? 'Заезд и выезд' : 'Часы работы'
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/site-facts-card.tsx",
                                lineNumber: 88,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                children: hourLines.length ? hourLines.map((line)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "site-facts__line",
                                        children: line
                                    }, line, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/site-facts-card.tsx",
                                        lineNumber: 92,
                                        columnNumber: 17
                                    }, this)) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "muted",
                                    children: "Не указано"
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/site-facts-card.tsx",
                                    lineNumber: 97,
                                    columnNumber: 15
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/site-facts-card.tsx",
                                lineNumber: 89,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/site-facts-card.tsx",
                        lineNumber: 87,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Row, {
                        label: "Фото",
                        value: facts.photosCount ? `${facts.photosCount} фото` : null
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/site-facts-card.tsx",
                        lineNumber: 101,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Row, {
                        label: "Отзывы",
                        value: facts.reviews && facts.reviews.count ? `${facts.reviews.avg.toLocaleString('ru-RU', {
                            maximumFractionDigits: 1
                        })} из 5, ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$plural$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["pluralRu"])(facts.reviews.count, [
                            'отзыв',
                            'отзыва',
                            'отзывов'
                        ])}` : null
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/site-facts-card.tsx",
                        lineNumber: 102,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/site-facts-card.tsx",
                lineNumber: 86,
                columnNumber: 7
            }, this),
            gaps.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                className: "site-facts__block site-facts__gaps",
                "aria-labelledby": "site-facts-gaps",
                "data-testid": "site-facts-gaps",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h4", {
                        id: "site-facts-gaps",
                        children: "Чего не хватает"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/site-facts-card.tsx",
                        lineNumber: 109,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "muted",
                        children: "Сайт можно делать и так: ИИ не выдумывает факты, пустые блоки просто не появятся."
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/site-facts-card.tsx",
                        lineNumber: 110,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                        children: gaps.map((gap)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        children: gap.label
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/site-facts-card.tsx",
                                        lineNumber: 114,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                        className: "btn btn--secondary btn--sm",
                                        href: gap.href,
                                        "aria-label": `Дополнить: ${gap.label}`,
                                        children: "Дополнить"
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/site-facts-card.tsx",
                                        lineNumber: 115,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, gap.key, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/site-facts-card.tsx",
                                lineNumber: 113,
                                columnNumber: 15
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/site-facts-card.tsx",
                        lineNumber: 111,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/site-facts-card.tsx",
                lineNumber: 108,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/site-facts-card.tsx",
        lineNumber: 39,
        columnNumber: 5
    }, this);
}
_c1 = FactsBody;
function Row({ label, value }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "site-facts__row",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                children: label
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/site-facts-card.tsx",
                lineNumber: 130,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                children: value ?? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "muted",
                    children: "Не указано"
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/site-facts-card.tsx",
                    lineNumber: 131,
                    columnNumber: 21
                }, this)
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/site-facts-card.tsx",
                lineNumber: 131,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/site-facts-card.tsx",
        lineNumber: 129,
        columnNumber: 5
    }, this);
}
_c2 = Row;
var _c, _c1, _c2;
__turbopack_context__.k.register(_c, "SiteFactsCard");
__turbopack_context__.k.register(_c1, "FactsBody");
__turbopack_context__.k.register(_c2, "Row");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/app/marketing/site/editor/structure.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Structure",
    ()=>Structure
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/index.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/editor.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/ui.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/site/editor/fields.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
;
function Structure({ selection, select, ask, shownPage }) {
    _s();
    const c = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEditor"])();
    const [blocked, setBlocked] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [addType, setAddType] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('about');
    const pages = c.spec['pages'] ?? [];
    const openPage = selection.kind === 'site' ? shownPage : selection.page;
    const sectionsOf = (i)=>pages[i]?.['sections'] ?? [];
    const setPages = (next)=>c.set([
            'pages'
        ], next);
    const setSections = (i, next)=>c.set([
            'pages',
            i,
            'sections'
        ], next);
    const removePage = async (i)=>{
        const page = pages[i];
        const refs = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["pageReferences"])(c.spec, String(page['id']), c.defaultLocale);
        if (refs.length) return setBlocked({
            title: `Страницу «${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["localizedText"])(page['title'], c.defaultLocale)}» нельзя удалить: на неё ссылаются`,
            refs
        });
        if (!await ask('Удалить страницу?', 'Страница и её секции уйдут из черновика. Опубликованный сайт не изменится до публикации.')) return;
        setBlocked(null);
        setPages(pages.filter((_, j)=>j !== i));
        select({
            kind: 'site'
        });
    };
    const removeSection = async (i, j)=>{
        const section = sectionsOf(i)[j];
        const refs = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["sectionReferences"])(c.spec, String(pages[i]['id']), String(section['id']), c.defaultLocale);
        if (refs.length) return setBlocked({
            title: `Секцию «${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["localizedText"])(section['heading'], c.defaultLocale)}» нельзя удалить: на неё ссылаются`,
            refs
        });
        if (!await ask('Удалить секцию?', 'Секция уйдёт из черновика. Опубликованный сайт не изменится до публикации.')) return;
        setBlocked(null);
        setSections(i, sectionsOf(i).filter((_, k)=>k !== j));
        select({
            kind: 'page',
            page: i
        });
    };
    const addSection = (i)=>{
        const section = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["newSection"])(addType, {
            locale: c.defaultLocale,
            taken: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["specIds"])(c.spec),
            categories: c.categories.map((cat)=>cat.code),
            cardCodes: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["accommodationCardCodes"])(c.spec)
        });
        const list = sectionsOf(i);
        // секция героя по схеме первая на странице, остальные встают в конец
        const at = addType === 'hero' ? 0 : list.length;
        setSections(i, [
            ...list.slice(0, at),
            section,
            ...list.slice(at)
        ]);
        select({
            kind: 'section',
            page: i,
            section: at
        });
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("nav", {
        className: "ed-structure",
        "aria-label": "Структура сайта",
        "data-testid": "ed-structure",
        children: [
            blocked && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Alert"], {
                boxed: true,
                "data-testid": "ed-blocked",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("b", {
                        children: blocked.title
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/structure.tsx",
                        lineNumber: 87,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                        children: blocked.refs.map((r)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                children: r.where
                            }, r.path, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/structure.tsx",
                                lineNumber: 90,
                                columnNumber: 15
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/structure.tsx",
                        lineNumber: 88,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                        type: "button",
                        tone: "ghost",
                        size: "sm",
                        onClick: ()=>setBlocked(null),
                        children: "Понятно"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/structure.tsx",
                        lineNumber: 93,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/structure.tsx",
                lineNumber: 86,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                className: "ed-structure__title",
                children: "Страницы и блоки"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/structure.tsx",
                lineNumber: 98,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ol", {
                className: "ed-tree",
                children: pages.map((page, i)=>{
                    const home = page['isHome'] === true;
                    const title = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["localizedText"])(page['title'], c.defaultLocale) || 'Без названия';
                    const pageOn = selection.kind === 'page' && selection.page === i;
                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                        "data-testid": "ed-page",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "ed-node-row",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        type: "button",
                                        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cx"])('ed-node', pageOn && 'is-on'),
                                        "aria-current": pageOn ? 'true' : undefined,
                                        onClick: ()=>select({
                                                kind: 'page',
                                                page: i
                                            }),
                                        children: [
                                            title,
                                            home ? ' (главная)' : ''
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/structure.tsx",
                                        lineNumber: 107,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "ed-item-controls",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                                type: "button",
                                                tone: "ghost",
                                                size: "sm",
                                                "aria-label": `Страница «${title}»: выше`,
                                                disabled: c.readOnly || i === 0,
                                                onClick: ()=>setPages((0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["moveItem"])(pages, i, i - 1)),
                                                children: "↑"
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/structure.tsx",
                                                lineNumber: 117,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                                type: "button",
                                                tone: "ghost",
                                                size: "sm",
                                                "aria-label": `Страница «${title}»: ниже`,
                                                disabled: c.readOnly || i === pages.length - 1,
                                                onClick: ()=>setPages((0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["moveItem"])(pages, i, i + 1)),
                                                children: "↓"
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/structure.tsx",
                                                lineNumber: 120,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                                type: "button",
                                                tone: "ghost",
                                                size: "sm",
                                                "aria-label": `Страница «${title}»: удалить`,
                                                disabled: c.readOnly || home,
                                                onClick: ()=>void removePage(i),
                                                children: "Удалить"
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/structure.tsx",
                                                lineNumber: 123,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/structure.tsx",
                                        lineNumber: 116,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/structure.tsx",
                                lineNumber: 106,
                                columnNumber: 15
                            }, this),
                            openPage === i && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ol", {
                                className: "ed-tree ed-tree--sections",
                                children: [
                                    sectionsOf(i).map((section, j)=>{
                                        const on = selection.kind === 'section' && selection.page === i && selection.section === j;
                                        const type = __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SITE_EDITOR_SECTIONS"][String(section['type'])]?.label ?? String(section['type']);
                                        const heading = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["localizedText"])(section['heading'], c.defaultLocale);
                                        const name = heading ? `${type}: ${heading}` : type;
                                        const list = sectionsOf(i);
                                        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                            "data-testid": "ed-section",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "ed-node-row",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                        type: "button",
                                                        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cx"])('ed-node', on && 'is-on'),
                                                        "aria-current": on ? 'true' : undefined,
                                                        onClick: ()=>select({
                                                                kind: 'section',
                                                                page: i,
                                                                section: j
                                                            }),
                                                        children: name
                                                    }, void 0, false, {
                                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/structure.tsx",
                                                        lineNumber: 139,
                                                        columnNumber: 27
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "ed-item-controls",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                                                type: "button",
                                                                tone: "ghost",
                                                                size: "sm",
                                                                "aria-label": `${name}: выше`,
                                                                disabled: c.readOnly || j === 0,
                                                                onClick: ()=>{
                                                                    setSections(i, (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["moveItem"])(list, j, j - 1));
                                                                    select({
                                                                        kind: 'section',
                                                                        page: i,
                                                                        section: j - 1
                                                                    });
                                                                },
                                                                children: "↑"
                                                            }, void 0, false, {
                                                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/structure.tsx",
                                                                lineNumber: 148,
                                                                columnNumber: 29
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                                                type: "button",
                                                                tone: "ghost",
                                                                size: "sm",
                                                                "aria-label": `${name}: ниже`,
                                                                disabled: c.readOnly || j === list.length - 1,
                                                                onClick: ()=>{
                                                                    setSections(i, (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["moveItem"])(list, j, j + 1));
                                                                    select({
                                                                        kind: 'section',
                                                                        page: i,
                                                                        section: j + 1
                                                                    });
                                                                },
                                                                children: "↓"
                                                            }, void 0, false, {
                                                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/structure.tsx",
                                                                lineNumber: 151,
                                                                columnNumber: 29
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                                                type: "button",
                                                                tone: "ghost",
                                                                size: "sm",
                                                                "aria-label": `${name}: копия`,
                                                                disabled: c.readOnly || list.length >= 30 || section['type'] === 'hero' || section['type'] === 'booking',
                                                                onClick: ()=>{
                                                                    setSections(i, [
                                                                        ...list.slice(0, j + 1),
                                                                        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["duplicateSection"])(section, (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["specIds"])(c.spec)),
                                                                        ...list.slice(j + 1)
                                                                    ]);
                                                                    select({
                                                                        kind: 'section',
                                                                        page: i,
                                                                        section: j + 1
                                                                    });
                                                                },
                                                                children: "Копия"
                                                            }, void 0, false, {
                                                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/structure.tsx",
                                                                lineNumber: 154,
                                                                columnNumber: 29
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                                                type: "button",
                                                                tone: "ghost",
                                                                size: "sm",
                                                                "aria-label": `${name}: удалить`,
                                                                disabled: c.readOnly || list.length <= 1,
                                                                onClick: ()=>void removeSection(i, j),
                                                                children: "Удалить"
                                                            }, void 0, false, {
                                                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/structure.tsx",
                                                                lineNumber: 167,
                                                                columnNumber: 29
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/structure.tsx",
                                                        lineNumber: 147,
                                                        columnNumber: 27
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/structure.tsx",
                                                lineNumber: 138,
                                                columnNumber: 25
                                            }, this)
                                        }, String(section['id']), false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/structure.tsx",
                                            lineNumber: 137,
                                            columnNumber: 23
                                        }, this);
                                    }),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                        className: "ed-add",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                                                label: "Новая секция",
                                                controlId: `ed-add-type-${i}`,
                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Select"], {
                                                    value: addType,
                                                    disabled: c.readOnly,
                                                    onChange: (e)=>setAddType(e.currentTarget.value),
                                                    children: __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SITE_EDITOR_SECTION_TYPES"].map((t)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                            value: t,
                                                            children: __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SITE_EDITOR_SECTIONS"][t].label
                                                        }, t, false, {
                                                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/structure.tsx",
                                                            lineNumber: 179,
                                                            columnNumber: 27
                                                        }, this))
                                                }, void 0, false, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/structure.tsx",
                                                    lineNumber: 177,
                                                    columnNumber: 23
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/structure.tsx",
                                                lineNumber: 176,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                                type: "button",
                                                tone: "secondary",
                                                size: "sm",
                                                disabled: c.readOnly || sectionsOf(i).length >= 30,
                                                onClick: ()=>addSection(i),
                                                "data-testid": "ed-add-section",
                                                children: "Добавить секцию"
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/structure.tsx",
                                                lineNumber: 185,
                                                columnNumber: 21
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/structure.tsx",
                                        lineNumber: 175,
                                        columnNumber: 19
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/structure.tsx",
                                lineNumber: 129,
                                columnNumber: 17
                            }, this)
                        ]
                    }, String(page['id']), true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/structure.tsx",
                        lineNumber: 105,
                        columnNumber: 13
                    }, this);
                })
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/structure.tsx",
                lineNumber: 99,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                type: "button",
                tone: "secondary",
                size: "sm",
                disabled: c.readOnly || pages.length >= 20,
                "data-testid": "ed-add-page",
                onClick: ()=>{
                    const page = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["newPage"])({
                        locale: c.defaultLocale,
                        taken: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$editor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["specIds"])(c.spec),
                        slugs: new Set(pages.map((p)=>String(p['slug'])))
                    });
                    setPages([
                        ...pages,
                        page
                    ]);
                    select({
                        kind: 'page',
                        page: pages.length
                    });
                },
                children: "Добавить страницу"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/structure.tsx",
                lineNumber: 195,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/structure.tsx",
        lineNumber: 84,
        columnNumber: 5
    }, this);
}
_s(Structure, "EGgv5gSzIPdvIwVksXPixoicsRc=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$fields$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEditor"]
    ];
});
_c = Structure;
var _c;
__turbopack_context__.k.register(_c, "Structure");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/app/marketing/site/editor/template-gallery.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "TemplateGallery",
    ()=>TemplateGallery
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$overlay$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/overlay.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/ui.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$site$2d$preview$2d$spec$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/site-preview-spec.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature(), _s2 = __turbopack_context__.k.signature(), _s3 = __turbopack_context__.k.signature();
'use client';
;
;
;
;
let renderer = null;
const loadRenderer = ()=>renderer ??= __turbopack_context__.A("[project]/wt-personnel/apps/sites/src/draft-preview.ts [app-client] (ecmascript, async loader)");
/** Разметка сайта по шаблону (только картинка: без скриптов и фокусируемого) */ function useTemplateHtml(facts, templateId, spec) {
    _s();
    const [html, setHtml] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useTemplateHtml.useEffect": ()=>{
            let off = false;
            void loadRenderer().then({
                "useTemplateHtml.useEffect": (mod)=>{
                    if (off) return;
                    const doc = spec ?? (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$site$2d$preview$2d$spec$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["previewSpec"])(facts, templateId);
                    const r = doc ? mod.renderDraftPreview({
                        spec: doc,
                        pageId: null,
                        locale: 'ru',
                        assets: {}
                    }) : null;
                    setHtml(r?.ok ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$site$2d$preview$2d$spec$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["inertPreviewHtml"])(r.html) : null);
                }
            }["useTemplateHtml.useEffect"]);
            return ({
                "useTemplateHtml.useEffect": ()=>{
                    off = true;
                }
            })["useTemplateHtml.useEffect"];
        }
    }["useTemplateHtml.useEffect"], [
        facts,
        templateId,
        spec
    ]);
    return html;
}
_s(useTemplateHtml, "93wgfhGDgF+GzEb4oiUmw3eWHJ4=");
function Shot({ facts, template }) {
    _s1();
    const html = useTemplateHtml(facts, template.id);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        className: "site-design__shot",
        "aria-hidden": "true",
        children: html ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("iframe", {
            className: "site-design__frame",
            title: `Превью: ${template.name}`,
            srcDoc: html,
            sandbox: "allow-same-origin",
            tabIndex: -1,
            "data-testid": "site-design-frame"
        }, void 0, false, {
            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/template-gallery.tsx",
            lineNumber: 42,
            columnNumber: 9
        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
            className: "site-design__frame site-design__frame--empty skeleton"
        }, void 0, false, {
            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/template-gallery.tsx",
            lineNumber: 44,
            columnNumber: 9
        }, this)
    }, void 0, false, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/template-gallery.tsx",
        lineNumber: 40,
        columnNumber: 5
    }, this);
}
_s1(Shot, "5udpEj1rcsgAkRBFkCyUDeKsCV0=", false, function() {
    return [
        useTemplateHtml
    ];
});
_c = Shot;
/** Окно «Посмотреть»: сайт по шаблону целиком, с прокруткой, в ширину компьютера или телефона */ function TemplateViewer({ facts, template, chosen, onClose, onChoose, disabled }) {
    _s2();
    const html = useTemplateHtml(facts, template.id);
    const [device, setDevice] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('desktop');
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$overlay$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Overlay"], {
        open: true,
        onClose: onClose,
        title: `Шаблон «${template.name}»`,
        size: "lg",
        trapFocus: true,
        className: "tpl-viewer",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "tpl-viewer__body",
            "data-testid": "tpl-viewer",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "muted tpl-viewer__text",
                    children: [
                        template.description,
                        ". Так будет выглядеть ваш сайт с данными филиала из WETOP."
                    ]
                }, void 0, true, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/template-gallery.tsx",
                    lineNumber: 71,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "tpl-viewer__bar",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "ed-preview__device",
                            role: "group",
                            "aria-label": "Ширина просмотра",
                            children: [
                                [
                                    'desktop',
                                    'Компьютер'
                                ],
                                [
                                    'phone',
                                    'Телефон'
                                ]
                            ].map(([key, label])=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    type: "button",
                                    className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cx"])('ed-preview__device-btn', device === key && 'is-on'),
                                    "aria-pressed": device === key,
                                    onClick: ()=>setDevice(key),
                                    children: label
                                }, key, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/template-gallery.tsx",
                                    lineNumber: 80,
                                    columnNumber: 15
                                }, this))
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/template-gallery.tsx",
                            lineNumber: 73,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "tpl-viewer__grow"
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/template-gallery.tsx",
                            lineNumber: 85,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                            type: "button",
                            tone: "secondary",
                            onClick: onClose,
                            children: "Закрыть"
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/template-gallery.tsx",
                            lineNumber: 86,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                            type: "button",
                            disabled: disabled || chosen,
                            onClick: ()=>{
                                onChoose();
                                onClose();
                            },
                            "data-testid": "tpl-viewer-choose",
                            children: chosen ? 'Выбран' : 'Выбрать этот шаблон'
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/template-gallery.tsx",
                            lineNumber: 89,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/template-gallery.tsx",
                    lineNumber: 72,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cx"])('tpl-viewer__stage', device === 'phone' && 'is-phone'),
                    children: html ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("iframe", {
                        className: "tpl-viewer__frame",
                        title: `Сайт по шаблону «${template.name}»`,
                        srcDoc: html,
                        sandbox: "allow-same-origin",
                        "data-testid": "tpl-viewer-frame"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/template-gallery.tsx",
                        lineNumber: 103,
                        columnNumber: 13
                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tpl-viewer__frame skeleton"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/template-gallery.tsx",
                        lineNumber: 105,
                        columnNumber: 13
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/template-gallery.tsx",
                    lineNumber: 101,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/template-gallery.tsx",
            lineNumber: 70,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/template-gallery.tsx",
        lineNumber: 69,
        columnNumber: 5
    }, this);
}
_s2(TemplateViewer, "Hm+Dda5EDbf7LZZaeqJ1t8ppens=", false, function() {
    return [
        useTemplateHtml
    ];
});
_c1 = TemplateViewer;
function TemplateGallery({ facts, templates, chosen, onChoose, disabled, compact = false }) {
    _s3();
    const [open, setOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cx"])('site-design__cards', compact && 'site-design__cards--compact'),
                role: "radiogroup",
                "aria-label": "Шаблон сайта",
                "data-testid": "site-designs",
                onKeyDown: (e)=>{
                    // стрелки как у группы радиокнопок: выбор соседнего шаблона и фокус на нём
                    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
                    if (!step || disabled || !e.target.classList.contains('site-design__pick')) return;
                    e.preventDefault();
                    const i = templates.findIndex((t)=>t.id === chosen);
                    const next = templates[(i + step + templates.length) % templates.length];
                    onChoose(next.id);
                    const picks = e.currentTarget.querySelectorAll('.site-design__pick');
                    picks[templates.indexOf(next)]?.focus();
                },
                children: templates.map((tpl)=>{
                    const on = chosen === tpl.id;
                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cx"])('site-design', on && 'is-on', disabled && 'is-off'),
                        "data-testid": "site-design-card",
                        "data-design": tpl.id,
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                type: "button",
                                className: "site-design__pick",
                                role: "radio",
                                "aria-checked": on,
                                tabIndex: on || chosen === null && tpl === templates[0] ? 0 : -1,
                                "aria-label": `${tpl.name}: ${tpl.description}`,
                                disabled: disabled,
                                onClick: ()=>onChoose(tpl.id),
                                "data-testid": "setup-template-option",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Shot, {
                                    facts: facts,
                                    template: tpl
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/template-gallery.tsx",
                                    lineNumber: 164,
                                    columnNumber: 17
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/template-gallery.tsx",
                                lineNumber: 153,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "site-design__name",
                                children: [
                                    tpl.name,
                                    on && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "site-design__badge",
                                        children: "Выбран"
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/template-gallery.tsx",
                                        lineNumber: 168,
                                        columnNumber: 24
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/template-gallery.tsx",
                                lineNumber: 166,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "muted site-design__text",
                                children: tpl.description
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/template-gallery.tsx",
                                lineNumber: 170,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "site-design__actions",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                        type: "button",
                                        tone: "secondary",
                                        size: "sm",
                                        onClick: ()=>setOpen(tpl),
                                        "data-testid": "site-design-view",
                                        children: "Посмотреть"
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/template-gallery.tsx",
                                        lineNumber: 172,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                        type: "button",
                                        size: "sm",
                                        disabled: disabled || on,
                                        onClick: ()=>onChoose(tpl.id),
                                        "data-testid": "site-design-choose",
                                        children: on ? 'Выбран' : 'Выбрать'
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/template-gallery.tsx",
                                        lineNumber: 175,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/template-gallery.tsx",
                                lineNumber: 171,
                                columnNumber: 15
                            }, this)
                        ]
                    }, tpl.id, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/template-gallery.tsx",
                        lineNumber: 152,
                        columnNumber: 13
                    }, this);
                })
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/template-gallery.tsx",
                lineNumber: 132,
                columnNumber: 7
            }, this),
            open && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(TemplateViewer, {
                facts: facts,
                template: open,
                chosen: chosen === open.id,
                onClose: ()=>setOpen(null),
                onChoose: ()=>onChoose(open.id),
                disabled: disabled
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/template-gallery.tsx",
                lineNumber: 184,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/template-gallery.tsx",
        lineNumber: 131,
        columnNumber: 5
    }, this);
}
_s3(TemplateGallery, "3gHT60S3lHEhyYybFcB05ha95j4=");
_c2 = TemplateGallery;
var _c, _c1, _c2;
__turbopack_context__.k.register(_c, "Shot");
__turbopack_context__.k.register(_c1, "TemplateViewer");
__turbopack_context__.k.register(_c2, "TemplateGallery");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/app/marketing/site/editor/vertical-status.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createErrorText",
    ()=>createErrorText,
    "publishTarget",
    ()=>publishTarget,
    "verticalPending",
    ()=>verticalPending,
    "verticalPendingText",
    ()=>verticalPendingText
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$vertical$2d$copy$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/vertical-copy.ts [app-client] (ecmascript)");
;
function verticalPending(vertical, reply) {
    return vertical !== 'HOSPITALITY' && reply.status === 403 && !reply.code;
}
function verticalPendingText(vertical) {
    const copy = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$vertical$2d$copy$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["verticalCopy"])(vertical);
    return `Конструктор сайтов для ${copy.businessesOf} подключается. Данные филиала и выбранный дизайн уже готовы: создать сайт можно будет здесь же, как только конструктор заработает.`;
}
function createErrorText(vertical, reply) {
    return verticalPending(vertical, reply) ? verticalPendingText(vertical) : reply.message;
}
function publishTarget(vertical) {
    if (vertical === 'HOSPITALITY') return {
        href: '/marketing/site'
    };
    return {
        reason: `Публикация сайта ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$vertical$2d$copy$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["verticalCopy"])(vertical).businessesOf} появится вместе с онлайн-записью на сайте. Черновик и изображения сохраняются уже сейчас.`
    };
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/components/chip.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CheckChip",
    ()=>CheckChip,
    "Chip",
    ()=>Chip,
    "ChipGroup",
    ()=>ChipGroup
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
;
;
function Chip({ selected, size = 'md', count, children, className, ...rest }) {
    const cls = [
        'chip',
        size === 'sm' && 'chip--sm',
        className
    ].filter(Boolean).join(' ');
    const body = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            children,
            count !== undefined && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "chip__count",
                children: count
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/components/chip.tsx",
                lineNumber: 25,
                columnNumber: 31
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/components/chip.tsx",
        lineNumber: 23,
        columnNumber: 5
    }, this);
    if (rest.href !== undefined) {
        const { href, prefetch } = rest;
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
            href: href,
            prefetch: prefetch ?? false,
            className: cls,
            "aria-current": selected ? 'page' : undefined,
            children: body
        }, void 0, false, {
            fileName: "[project]/wt-personnel/apps/web/src/components/chip.tsx",
            lineNumber: 31,
            columnNumber: 7
        }, this);
    }
    const { type, ...button } = rest;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
        ...button,
        type: type ?? 'button',
        className: cls,
        "aria-pressed": selected,
        children: body
    }, void 0, false, {
        fileName: "[project]/wt-personnel/apps/web/src/components/chip.tsx",
        lineNumber: 43,
        columnNumber: 5
    }, this);
}
_c = Chip;
function ChipGroup({ as = 'div', label, labelledBy, className, children }) {
    const Tag = as;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Tag, {
        className: className ? `chip-group ${className}` : 'chip-group',
        role: as === 'div' ? 'group' : undefined,
        "aria-label": label,
        "aria-labelledby": labelledBy,
        children: children
    }, void 0, false, {
        fileName: "[project]/wt-personnel/apps/web/src/components/chip.tsx",
        lineNumber: 63,
        columnNumber: 5
    }, this);
}
_c1 = ChipGroup;
function CheckChip({ name, value, defaultChecked, disabled, icon, children }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
        className: "chip chip--check",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                className: "chip__input",
                type: "checkbox",
                name: name,
                value: value,
                defaultChecked: defaultChecked,
                disabled: disabled
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/components/chip.tsx",
                lineNumber: 96,
                columnNumber: 7
            }, this),
            icon,
            children
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/components/chip.tsx",
        lineNumber: 95,
        columnNumber: 5
    }, this);
}
_c2 = CheckChip;
var _c, _c1, _c2;
__turbopack_context__.k.register(_c, "Chip");
__turbopack_context__.k.register(_c1, "ChipGroup");
__turbopack_context__.k.register(_c2, "CheckChip");
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
"[project]/wt-personnel/apps/web/src/lib/site-facts.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Факты филиала для первого экрана «Сайт и SEO» (SITE-1, `plans/site-seo-flow-2026-10-15.md` §1 шаг 1). Источник
 * правды: API `GET /marketing/site/facts?locationId=…` и `GET /marketing/site/locations` (SITE-2), контракт `SiteFacts`
 * домена. Пока эндпоинта нет (404, старый сервер), факты собираются из уже существующих запросов стойки по
 * направлению в тот же контракт: гостиница из брифа сайта, салон из услуг и мастеров, ресторан из меню и часов работы.
 * ИИ здесь нет: только то, что уже лежит в системе; чего нет, то идёт в «пробелы» со ссылкой «Дополнить».
 *
 * Деньги в каталоге: целые тиыны строкой с валютой (ADR-008); на экран идут через `formatMoney`.
 */ __turbopack_context__.s([
    "catalogPrice",
    ()=>catalogPrice,
    "hoursLines",
    ()=>hoursLines,
    "loadSiteFacts",
    ()=>loadSiteFacts,
    "loadSiteLocations",
    ()=>loadSiteLocations,
    "weekHours",
    ()=>weekHours
]);
const statusOf = (e)=>typeof e === 'object' && e !== null && 'status' in e && typeof e.status === 'number' ? e.status : 0;
const messageOf = (e, fallback)=>e instanceof Error && e.message ? e.message : fallback;
/** Необязательная часть фактов: сбой одного источника не роняет карточку целиком */ async function optional(load, empty) {
    try {
        return await load();
    } catch  {
        return empty;
    }
}
const KZT = 'KZT';
const money = (minor)=>({
        minor,
        currency: KZT
    });
/** Код позиции каталога для документа сайта: id из данных, иначе порядковый */ const code = (id, prefix, i)=>id && /^[A-Za-z0-9_-]{1,64}$/.test(id) ? id : `${prefix}-${i + 1}`;
const WEEKDAYS = [
    'Вс',
    'Пн',
    'Вт',
    'Ср',
    'Чт',
    'Пт',
    'Сб'
];
function weekHours(days) {
    const order = [
        1,
        2,
        3,
        4,
        5,
        6,
        0
    ];
    return order.map((day)=>{
        const own = days.filter((r)=>r.weekday === day).sort((a, b)=>a.open < b.open ? -1 : 1);
        return own.length ? `${WEEKDAYS[day]} ${own.map((r)=>`${r.open}–${r.close}`).join(', ')}` : null;
    }).filter((x)=>x !== null);
}
function hoursLines(facts) {
    if (facts.vertical === 'HOSPITALITY') {
        const { checkInTime: inT, checkOutTime: outT } = facts.hours;
        const line = [
            inT ? `Заезд с ${inT}` : null,
            outT ? `выезд до ${outT}` : null
        ].filter(Boolean).join(', ');
        return line ? [
            line
        ] : [];
    }
    return weekHours(facts.hours.days);
}
/** Один интервал на день: самое раннее начало и самый поздний конец */ function dayHull(rows) {
    const byDay = new Map();
    for (const r of rows){
        const was = byDay.get(r.weekday);
        byDay.set(r.weekday, {
            weekday: r.weekday,
            open: !was || r.from < was.open ? r.from : was.open,
            close: !was || r.to > was.close ? r.to : was.close
        });
    }
    return [
        ...byDay.values()
    ].sort((a, b)=>a.weekday - b.weekday);
}
const GAP = {
    phone: (href)=>({
            key: 'phone',
            label: 'Нет телефона: посетитель не сможет позвонить',
            href
        }),
    address: (href)=>({
            key: 'address',
            label: 'Нет адреса: на сайте не будет карты и контактов',
            href
        }),
    photos: (href)=>({
            key: 'photos',
            label: 'Нет фото: сайт соберётся без галереи',
            href
        }),
    hours: (href, label)=>({
            key: 'hours',
            label,
            href
        }),
    catalog: (href, label)=>({
            key: 'catalog',
            label,
            href
        }),
    staff: (href)=>({
            key: 'staff',
            label: 'Нет мастеров: блок «Мастера» не появится',
            href
        })
};
const emptyHours = {
    days: [],
    checkInTime: null,
    checkOutTime: null
};
/** Гостиница: бриф сайта (то же, что видел первый экран MKT9.2), цены категорий и библиотека фото */ async function hospitalityFacts(locationId, src) {
    const brief = await src.hospitality.brief();
    const [prices, photos] = await Promise.all([
        optional(src.hospitality.prices, []),
        optional(src.hospitality.photos, 0)
    ]);
    const id = brief.input.identity;
    const price = new Map(prices.map((p)=>[
            p.code,
            p.priceMinor
        ]));
    const items = brief.input.accommodations.map((a, i)=>{
        const minor = price.get(a.categoryCode);
        return {
            code: code(a.categoryCode, 'room', i),
            name: a.name,
            ...minor && /^\d+$/.test(minor) ? {
                priceFrom: money(minor)
            } : {},
            ...a.capacityAdults ? {
                capacityAdults: a.capacityAdults
            } : {}
        };
    });
    const stay = brief.input.stay;
    const photosCount = Math.max(photos, brief.input.channelContent?.photoSummary?.total ?? 0);
    const gaps = [];
    if (!id.phone) gaps.push(GAP.phone('/hotel-settings'));
    if (!id.address) gaps.push(GAP.address('/hotel-settings'));
    if (!items.length) gaps.push(GAP.catalog('/rooms/categories', 'Нет категорий номеров: нечего показать в каталоге'));
    else if (!items.some((i)=>i.priceFrom)) gaps.push(GAP.catalog('/rates', 'Нет цен: на сайте не будет цены «от»'));
    if (!stay?.checkInTime && !stay?.checkOutTime) gaps.push(GAP.hours('/hotel-settings/stay', 'Нет времени заезда и выезда'));
    if (!photosCount) gaps.push(GAP.photos('/marketing/site/assets'));
    return {
        vertical: 'HOSPITALITY',
        location: {
            id: locationId,
            name: id.displayNameCandidate,
            address: id.address ?? null,
            phone: id.phone ?? null,
            whatsapp: null,
            city: id.city ?? null
        },
        catalog: {
            kind: 'rooms',
            items
        },
        staff: [],
        hours: {
            days: [],
            checkInTime: stay?.checkInTime ?? null,
            checkOutTime: stay?.checkOutTime ?? null
        },
        photosCount,
        reviews: null,
        gaps
    };
}
/** Салон: услуги филиала с его ценой и длительностью, мастера филиала и их общая неделя */ async function beautyFacts(locationId, src) {
    const [services, employees, hours, branch] = await Promise.all([
        src.beauty.services(),
        optional(src.beauty.employees, {
            locationId: null,
            items: []
        }),
        optional(src.beauty.hours, []),
        optional(src.branch, null)
    ]);
    const items = services.items.filter((s)=>s.effective?.sellable === true).map((s, i)=>{
        const eff = s.effective;
        return {
            code: code(s.id, 'svc', i),
            name: s.name,
            price: money(eff.priceMinor),
            durationMin: eff.durationMinutes,
            ...s.category ? {
                category: s.category
            } : {}
        };
    });
    const staff = employees.items.filter((e)=>e.active && e.locationIds.includes(locationId)).map((e, i)=>({
            id: e.id ?? `staff-${i + 1}`,
            name: e.name,
            specialization: null
        }));
    const days = dayHull(hours.flatMap((d)=>d.intervals.map((i)=>({
                weekday: d.weekday,
                from: i.timeFrom,
                to: i.timeTo
            }))));
    const gaps = [];
    if (!branch?.address) gaps.push(GAP.address('/branches'));
    gaps.push(GAP.phone('/branches'));
    if (!items.length) gaps.push(GAP.catalog('/services', 'Нет услуг с ценой в этом филиале'));
    if (!staff.length) gaps.push(GAP.staff('/employees'));
    if (!days.length) gaps.push(GAP.hours('/beauty/schedule', 'Нет графика работы'));
    gaps.push(GAP.photos('/marketing/site/assets'));
    return {
        vertical: 'BEAUTY',
        location: {
            id: locationId,
            name: branch?.name ?? 'Салон',
            address: branch?.address ?? null,
            phone: null,
            whatsapp: null,
            city: null
        },
        catalog: {
            kind: 'services',
            items
        },
        staff,
        hours: {
            ...emptyHours,
            days
        },
        photosCount: 0,
        reviews: null,
        gaps
    };
}
/** Ресторан: блюда меню по категориям и сервис-периоды как часы работы */ async function foodFacts(locationId, src) {
    const [categories, menu, periods, branch] = await Promise.all([
        optional(src.food.categories, []),
        src.food.items(),
        optional(src.food.periods, []),
        optional(src.branch, null)
    ]);
    const categoryName = new Map(categories.map((c)=>[
            c.id,
            c.name
        ]));
    const active = menu.filter((i)=>i.active);
    const items = active.map((i, n)=>{
        const category = categoryName.get(i.categoryId);
        return {
            code: code(i.id, 'dish', n),
            name: i.name,
            price: money(i.priceMinor),
            ...category ? {
                category
            } : {},
            hasPhoto: !!i.photoUrl
        };
    });
    const days = dayHull(periods.filter((p)=>p.active).map((p)=>({
            weekday: p.weekday,
            from: p.timeFrom,
            to: p.timeTo
        })));
    const photosCount = active.filter((i)=>i.photoUrl).length;
    const gaps = [];
    if (!branch?.address) gaps.push(GAP.address('/branches'));
    gaps.push(GAP.phone('/branches'));
    if (!items.length) gaps.push(GAP.catalog('/menu', 'Меню пустое: на сайте не будет блюд и цен'));
    if (!days.length) gaps.push(GAP.hours('/restaurant-settings', 'Нет часов работы'));
    if (!photosCount) gaps.push(GAP.photos('/menu'));
    return {
        vertical: 'FOOD_SERVICE',
        location: {
            id: locationId,
            name: branch?.name ?? 'Ресторан',
            address: branch?.address ?? null,
            phone: null,
            whatsapp: null,
            city: null
        },
        catalog: {
            kind: 'menu',
            items
        },
        staff: [],
        hours: {
            ...emptyHours,
            days
        },
        photosCount,
        reviews: null,
        gaps
    };
}
async function loadSiteFacts(locationId, vertical, src) {
    try {
        return {
            ok: true,
            data: await src.facts(locationId),
            source: 'api'
        };
    } catch (e) {
        if (statusOf(e) !== 404) return {
            ok: false,
            status: statusOf(e),
            message: messageOf(e, 'Не удалось получить данные филиала')
        };
    }
    try {
        const data = vertical === 'BEAUTY' ? await beautyFacts(locationId, src) : vertical === 'FOOD_SERVICE' ? await foodFacts(locationId, src) : await hospitalityFacts(locationId, src);
        return {
            ok: true,
            data,
            source: 'fallback'
        };
    } catch (e) {
        return {
            ok: false,
            status: statusOf(e),
            message: messageOf(e, 'Не удалось получить данные филиала')
        };
    }
}
async function loadSiteLocations(src, fallback, current) {
    try {
        const reply = await src.locations();
        return {
            ok: true,
            data: Array.isArray(reply) ? reply : reply.items,
            source: 'api'
        };
    } catch (e) {
        if (statusOf(e) !== 404) return {
            ok: false,
            status: statusOf(e),
            message: messageOf(e, 'Не удалось получить список филиалов')
        };
    }
    try {
        const branches = await fallback();
        return {
            ok: true,
            source: 'fallback',
            data: branches.map((b)=>({
                    id: b.locationId,
                    name: b.name,
                    vertical: b.vertical,
                    siteStatus: b.locationId === current.locationId ? current.siteStatus : null
                }))
        };
    } catch (e) {
        return {
            ok: false,
            status: statusOf(e),
            message: messageOf(e, 'Не удалось получить список филиалов')
        };
    }
}
function catalogPrice(item, format) {
    const m = item.price ?? item.priceFrom;
    if (!m || !/^\d+$/.test(m.minor)) return null;
    return item.price ? format(m.minor) : `от ${format(m.minor)}`;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/lib/site-preview-spec.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "inertPreviewHtml",
    ()=>inertPreviewHtml,
    "previewSpec",
    ()=>previewSpec
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/index.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$templates$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/site-templates.ts [app-client] (ecmascript)");
;
function previewSpec(facts, templateId) {
    const spec = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$templates$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["templateSiteSpec"])(facts, templateId);
    if (!spec) return null;
    // превью не индексируется и без аналитики: это только картинка карточки
    const site = spec['site'];
    site['seo'] = {
        ...site['seo'],
        robots: 'NOINDEX'
    };
    spec['integrations'] = {
        ...spec['integrations'],
        analytics: {
            mode: 'NONE',
            consent: 'NOT_REQUIRED'
        }
    };
    return spec;
}
/** В превью виджета брони и формы нет: служебные строки и кнопки внутри формы не показываем */ const PREVIEW_CSS = '#sec-booking p,#sec-booking .btn,#sec-form form{display:none}';
/**
 * Первый экран превью окрашен у глубоких шаблонов (NIGHT): без фото первые экраны всех шаблонов иначе выглядели бы
 * одинаково светлыми. Это только картинка карточки, документ сайта не меняется
 */ const DEEP_HERO_CSS = '.p-night .hero{background:var(--text);color:var(--bg)}.p-night .hero .lead{color:var(--border)}' + '.p-night .hero .btn{background:var(--bg);color:var(--text);border-color:var(--bg)}';
function inertPreviewHtml(html) {
    return html.replace('</head>', `<style>${PREVIEW_CSS}${DEEP_HERO_CSS}</style></head>`).replace(/<script\b[\s\S]*?<\/script>/g, '').replace(/<a class="skip"[^>]*>[\s\S]*?<\/a>/, '').replace(/<a\b[^>]*?(\sclass="[^"]*")?[^>]*>/g, (_m, cls)=>`<span${cls ?? ''}>`).replace(/<\/a>/g, '</span>').replace(/<(input|select|textarea|button)\b[^>]*>/g, '').replace(/<\/(select|textarea|button)>/g, '');
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/lib/use-dictation.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DICTATION_LANGS",
    ()=>DICTATION_LANGS,
    "DICTATION_TEXT",
    ()=>DICTATION_TEXT,
    "appendDictated",
    ()=>appendDictated,
    "finalTranscript",
    ()=>finalTranscript,
    "useDictation",
    ()=>useDictation
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
'use client';
;
const DICTATION_LANGS = [
    {
        value: 'ru-RU',
        label: 'Русский'
    },
    {
        value: 'kk-KZ',
        label: 'Қазақша'
    },
    {
        value: 'en-US',
        label: 'English'
    }
];
const DICTATION_TEXT = {
    unsupported: 'В этом браузере диктовка недоступна. Введите текст или воспользуйтесь системной диктовкой.',
    denied: 'Доступ к микрофону не разрешён. Разрешите его в браузере или введите текст.',
    failed: 'Не удалось распознать речь. Проверьте микрофон или продолжите текстом.',
    start: 'Не удалось начать диктовку. Попробуйте ещё раз или введите текст.'
};
function recognitionCtor() {
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    const browser = window;
    return browser.SpeechRecognition ?? browser.webkitSpeechRecognition ?? null;
}
function finalTranscript(event) {
    const parts = [];
    for(let i = event.resultIndex; i < event.results.length; i++){
        const r = event.results[i];
        if (r?.isFinal) parts.push(r[0].transcript.trim());
    }
    return parts.filter(Boolean).join(' ');
}
function appendDictated(previous, phrase, max) {
    if (!phrase) return previous;
    return `${previous}${previous && !/\s$/.test(previous) ? ' ' : ''}${phrase}`.slice(0, max);
}
function useDictation({ lang = 'ru-RU', onText, onError }) {
    _s();
    const [supported, setSupported] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [listening, setListening] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const recognition = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const handlers = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])({
        onText,
        onError
    });
    handlers.current = {
        onText,
        onError
    };
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useDictation.useEffect": ()=>{
            setSupported(recognitionCtor() !== null);
            return ({
                "useDictation.useEffect": ()=>{
                    const r = recognition.current;
                    if (!r) return;
                    r.onend = null;
                    r.onresult = null;
                    r.onerror = null;
                    r.abort();
                }
            })["useDictation.useEffect"];
        }
    }["useDictation.useEffect"], []);
    const stop = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useDictation.useCallback[stop]": ()=>{
            recognition.current?.stop();
            setListening(false);
        }
    }["useDictation.useCallback[stop]"], []);
    const start = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useDictation.useCallback[start]": ()=>{
            const Ctor = recognitionCtor();
            if (!Ctor) return handlers.current.onError(DICTATION_TEXT.unsupported);
            const recorder = new Ctor();
            recognition.current = recorder;
            recorder.lang = lang;
            recorder.continuous = true;
            recorder.interimResults = false;
            recorder.onresult = ({
                "useDictation.useCallback[start]": (event)=>{
                    const phrase = finalTranscript(event);
                    if (phrase) handlers.current.onText(phrase);
                }
            })["useDictation.useCallback[start]"];
            recorder.onerror = ({
                "useDictation.useCallback[start]": (event)=>{
                    setListening(false);
                    handlers.current.onError(event.error === 'not-allowed' ? DICTATION_TEXT.denied : DICTATION_TEXT.failed);
                }
            })["useDictation.useCallback[start]"];
            recorder.onend = ({
                "useDictation.useCallback[start]": ()=>setListening(false)
            })["useDictation.useCallback[start]"];
            try {
                recorder.start();
                setListening(true);
            } catch  {
                handlers.current.onError(DICTATION_TEXT.start);
            }
        }
    }["useDictation.useCallback[start]"], [
        lang
    ]);
    const toggle = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useDictation.useCallback[toggle]": ()=>{
            if (recognition.current && listening) stop();
            else start();
        }
    }["useDictation.useCallback[toggle]"], [
        listening,
        start,
        stop
    ]);
    return {
        supported,
        listening,
        toggle,
        stop
    };
}
_s(useDictation, "8ytY+XxLbajMskMJcWOhaYic+pk=");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/lib/vertical-copy.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "verticalCopy",
    ()=>verticalCopy
]);
const COPY = {
    HOSPITALITY: {
        business: 'гостиница',
        businessOf: 'гостиницы',
        clientsAcc: 'гостей',
        clients: 'Гости',
        clientsOf: 'гостей',
        onlineAction: 'Онлайн-бронирование',
        requests: 'Заявки на бронирование',
        conversionTo: 'в бронь',
        photoSubject: 'номера',
        photoIcon: 'bed',
        businessesOf: 'гостиниц',
        bookAction: 'Забронировать',
        catalogTitle: 'Номера и цены',
        siteChips: [
            'Сайт с онлайн-бронированием',
            'Акцент на семейном отдыхе',
            'Покажи трансфер'
        ],
        siteEditChips: [
            'Сделай тексты короче и проще',
            'Сделай первый экран ярче',
            'Подчеркни удобное расположение',
            'Добавь блок «Почему мы»'
        ]
    },
    BEAUTY: {
        business: 'салон',
        businessOf: 'салона',
        clientsAcc: 'клиентов',
        clients: 'Клиенты',
        clientsOf: 'клиентов',
        onlineAction: 'Онлайн-запись',
        requests: 'Заявки на запись',
        conversionTo: 'в запись',
        photoSubject: 'работы мастера',
        photoIcon: 'beauty',
        businessesOf: 'салонов',
        bookAction: 'Записаться',
        catalogTitle: 'Услуги и цены',
        siteChips: [
            'Сайт для записи на услуги',
            'Акцент на мастерах',
            'Акция на первое посещение'
        ],
        siteEditChips: [
            'Сделай тексты короче и проще',
            'Сделай первый экран ярче',
            'Подчеркни опыт мастеров',
            'Добавь акцию на первое посещение'
        ]
    },
    FOOD_SERVICE: {
        business: 'ресторан',
        businessOf: 'ресторана',
        clientsAcc: 'гостей',
        clients: 'Гости',
        clientsOf: 'гостей',
        onlineAction: 'Онлайн-бронь столов',
        requests: 'Заявки на бронь стола',
        conversionTo: 'в заказ',
        photoSubject: 'блюда',
        photoIcon: 'kitchen',
        businessesOf: 'ресторанов',
        bookAction: 'Забронировать стол',
        catalogTitle: 'Меню и цены',
        siteChips: [
            'Сайт с меню и бронью столов',
            'Акцент на банкетах',
            'Покажи бизнес-ланч'
        ],
        siteEditChips: [
            'Сделай тексты короче и проще',
            'Сделай первый экран аппетитнее',
            'Расскажи про банкеты',
            'Выдели бизнес-ланч'
        ]
    }
};
function verticalCopy(vertical) {
    return COPY[vertical in COPY ? vertical : 'HOSPITALITY'];
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=wt-personnel_apps_web_src_1nazf9b._.js.map