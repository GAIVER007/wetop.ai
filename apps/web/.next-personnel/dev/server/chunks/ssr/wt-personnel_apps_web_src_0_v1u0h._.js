module.exports = [
"[project]/wt-personnel/apps/web/src/app/marketing/budget/derive.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Производные числа раздела «Маркетинг → Бюджет» (МКТ-В1/В2, ТЗ §6): чистые функции поверх ответа
 * `GET /marketing/budget`, без своих запросов (как derive в /market). Деньги BigInt в minor units
 * (ADR-008): входные строки API превращаются в bigint здесь и форматируются только на экране.
 */ __turbopack_context__.s([
    "byDay",
    ()=>byDay,
    "byPlatform",
    ()=>byPlatform,
    "channelPlan",
    ()=>channelPlan,
    "monthDelta",
    ()=>monthDelta,
    "summarize",
    ()=>summarize
]);
const daysIn = (month)=>{
    const [y, m] = month.split('-').map(Number);
    return new Date(Date.UTC(y, m, 0)).getUTCDate();
};
const counted = (expenses)=>expenses.filter((e)=>e.countedInBudget);
const pct = (part, whole)=>Number((part * 100n + whole / 2n) / whole);
/** План месяца по правилу §52: общий план главный, без него план это сумма каналов; ни того ни другого: null */ const effectivePlan = (plan, lines)=>{
    if (plan !== null) return BigInt(plan);
    const sum = (lines ?? []).reduce((s, l)=>s + BigInt(l.amount), 0n);
    return sum > 0n ? sum : null;
};
function summarize(view) {
    const daysInMonth = daysIn(view.month);
    const todayMonth = view.today.slice(0, 7);
    const daysPassed = view.month < todayMonth ? daysInMonth : view.month > todayMonth ? 0 : Number(view.today.slice(8, 10));
    const daysLeft = daysInMonth - daysPassed;
    const spent = counted(view.expenses).reduce((s, e)=>s + BigInt(e.baseAmount), 0n);
    const plan = effectivePlan(view.plan, view.lines);
    const forecast = view.month > todayMonth ? null : view.month < todayMonth || daysPassed === 0 ? spent : spent * BigInt(daysInMonth) / BigInt(daysPassed);
    return {
        spent,
        remainder: plan === null ? null : plan - spent,
        forecast,
        daysInMonth,
        daysPassed,
        daysLeft,
        planUsedPct: plan === null || plan === 0n ? null : pct(spent, plan),
        onTrack: plan === null || forecast === null ? null : forecast <= plan
    };
}
function channelPlan(view) {
    const t = summarize({
        ...view,
        lines: []
    });
    const scale = (v)=>t.forecast === null ? null : t.daysPassed === 0 || t.daysPassed === t.daysInMonth ? v : v * BigInt(t.daysInMonth) / BigInt(t.daysPassed);
    const spentBy = new Map();
    for (const e of counted(view.expenses))spentBy.set(e.platform, (spentBy.get(e.platform) ?? 0n) + BigInt(e.baseAmount));
    const row = (platform, plan)=>{
        const spent = spentBy.get(platform) ?? 0n;
        const forecast = scale(spent);
        return {
            platform,
            plan,
            spent,
            remainder: plan === null ? null : plan - spent,
            forecast,
            over: plan !== null && forecast !== null && forecast > plan
        };
    };
    const desc = (a, b)=>a === b ? 0 : a > b ? -1 : 1;
    const planned = view.lines.map((l)=>row(l.platform, BigInt(l.amount))).sort((a, b)=>desc(a.plan, b.plan));
    const unplanned = [
        ...spentBy.keys()
    ].filter((p)=>!view.lines.some((l)=>l.platform === p)).map((p)=>row(p, null)).sort((a, b)=>desc(a.spent, b.spent));
    const allocated = view.lines.reduce((s, l)=>s + BigInt(l.amount), 0n);
    const plan = view.plan === null ? null : BigInt(view.plan);
    return {
        rows: [
            ...planned,
            ...unplanned
        ],
        allocated,
        unallocated: plan === null ? null : plan - allocated,
        overAllocated: plan !== null && allocated > plan
    };
}
function byPlatform(expenses) {
    const sums = new Map();
    for (const e of counted(expenses))sums.set(e.platform, (sums.get(e.platform) ?? 0n) + BigInt(e.baseAmount));
    const total = [
        ...sums.values()
    ].reduce((s, v)=>s + v, 0n);
    if (total === 0n) return [];
    return [
        ...sums.entries()
    ].map(([platform, base])=>({
            platform,
            base,
            share: pct(base, total)
        })).sort((a, b)=>a.base === b.base ? a.platform.localeCompare(b.platform) : a.base > b.base ? -1 : 1);
}
function byDay(expenses, month) {
    const days = Array.from({
        length: daysIn(month)
    }, ()=>0n);
    for (const e of expenses){
        if (e.date.slice(0, 7) !== month) continue;
        const i = Number(e.date.slice(8, 10)) - 1;
        days[i] = days[i] + BigInt(e.baseAmount);
    }
    return days;
}
function monthDelta(current, previous) {
    if (previous === 0n) return null;
    return Number(((current - previous) * 100n + (current >= previous ? previous / 2n : -(previous / 2n))) / previous);
}
}),
"[project]/wt-personnel/apps/web/src/app/marketing/hub.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "MarketingHub",
    ()=>MarketingHub,
    "liveModules",
    ()=>liveModules
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-jsx-dev-runtime.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/client/app-dir/link.react-server.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$action$2d$menu$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/action-menu.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$icon$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/icon.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$page$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/page.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/ui.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$money$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/money.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$vertical$2d$copy$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/vertical-copy.ts [app-rsc] (ecmascript)");
;
;
;
;
;
;
;
;
;
const modules = (c)=>[
        {
            key: 'site',
            testId: 'marketing-site',
            title: 'Сайт и SEO',
            icon: 'analytics',
            href: '/marketing/site/editor',
            text: `Создайте сайт ${c.businessOf} с помощью ИИ, подключите ${c.onlineAction.toLowerCase()} и продвигайте его в поиске.`,
            caps: [
                'ИИ-конструктор сайта',
                c.onlineAction,
                'SEO-оптимизация'
            ]
        },
        {
            // МКТ-В1/В2 (ADR-MKT-B1): учёт бюджета и расходов работает с базой
            key: 'budget',
            testId: 'marketing-budget',
            title: 'Бюджет',
            icon: 'money',
            href: '/marketing/budget',
            text: 'Планируйте рекламный бюджет, ведите расходы по каналам и следите за прогнозом месяца.',
            caps: [
                'План месяца и прогноз',
                'Журнал расходов по каналам',
                'Аналитика маркетинга'
            ]
        },
        {
            key: 'ads',
            testId: 'marketing-ads',
            title: 'Реклама',
            icon: 'channels',
            href: '/marketing/ads',
            text: 'Запускайте рекламные кампании в Facebook и Instagram с помощью ИИ-таргетолога.',
            caps: [
                'Подключение рекламных кабинетов',
                'Автоматическая настройка и оптимизация',
                'Подробная аналитика и отчёты'
            ]
        },
        {
            // ADR-184: конкуренты в «Продвижении»; у гостиницы загрузка и цены соседей (ADR-142)
            key: 'competitors',
            testId: 'marketing-competitors',
            title: 'Конкуренты',
            icon: 'analytics',
            href: '/market',
            text: `Загрузка и цены ближайших конкурентов рядом с вашими и подсказки, когда поднять цену.`,
            caps: [
                'Конкуренты рядом',
                'Загрузка по датам',
                'Подсказки к цене'
            ]
        },
        {
            key: 'content',
            testId: 'marketing-content',
            title: 'Контент',
            icon: 'journal',
            href: '/marketing/content',
            text: 'Создавайте фото, тексты, видео и посты с помощью ИИ. Планируйте публикации во все соцсети.',
            caps: [
                'Генерация фото и видео',
                'Готовые шаблоны постов',
                'Планировщик публикаций'
            ]
        }
    ];
const results = (c)=>[
        {
            key: 'visits',
            label: 'Переходы на сайт',
            icon: 'system'
        },
        {
            key: 'requests',
            label: c.requests,
            icon: 'guests'
        },
        {
            key: 'spent',
            label: 'Потрачено на рекламу',
            icon: 'money'
        },
        {
            key: 'income',
            label: 'Доход с рекламы',
            icon: 'analytics'
        }
    ];
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
const monthWord = (month)=>MONTHS[Number(month.slice(5, 7)) - 1] ?? month;
const SITE_MENU = [
    {
        label: 'Публикация',
        href: '/marketing/site'
    },
    {
        label: 'Изображения',
        href: '/marketing/site/assets'
    },
    {
        label: 'Бронирование и аналитика',
        href: '/website'
    }
];
const BUDGET_MENU = [
    {
        label: 'Расходы',
        href: '/marketing/budget/expenses'
    },
    {
        label: 'Аналитика маркетинга',
        href: '/marketing/analytics'
    }
];
function liveModules(vertical) {
    return new Set(vertical === 'HOSPITALITY' ? [
        'site',
        'budget',
        'competitors'
    ] : [
        'site',
        'budget'
    ]);
}
/** Публикация, изображения и бронирование сайта пока гостиничные экраны: меню «⋯» у сайта только у гостиницы */ function ModuleCard({ module, live, soonForVertical, hospitality }) {
    const headingId = `${module.testId}-title`;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        className: `panel marketing-module marketing-module--${module.key}`,
        "aria-labelledby": headingId,
        "data-testid": "marketing-module",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            "data-testid": module.testId,
            className: "marketing-module__body",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "marketing-module__head",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "marketing-module__icon",
                            "aria-hidden": "true",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$icon$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Icon"], {
                                name: module.icon
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/hub.tsx",
                                lineNumber: 146,
                                columnNumber: 13
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/hub.tsx",
                            lineNumber: 145,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                            id: headingId,
                            children: module.title
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/hub.tsx",
                            lineNumber: 148,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Badge"], {
                            tone: live ? 'ok' : 'info',
                            "data-testid": `${module.testId}-status`,
                            children: live ? 'Доступно' : 'Скоро'
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/hub.tsx",
                            lineNumber: 149,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/hub.tsx",
                    lineNumber: 144,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "marketing-module__text",
                    children: soonForVertical ? `${module.text} Для этого направления модуль готовится к подключению.` : module.text
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/hub.tsx",
                    lineNumber: 153,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                    className: "marketing-module__caps",
                    children: module.caps.map((cap)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$icon$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Icon"], {
                                    name: "check",
                                    width: 16,
                                    "aria-hidden": "true"
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/hub.tsx",
                                    lineNumber: 161,
                                    columnNumber: 15
                                }, this),
                                cap
                            ]
                        }, cap, true, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/hub.tsx",
                            lineNumber: 160,
                            columnNumber: 13
                        }, this))
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/hub.tsx",
                    lineNumber: 158,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "marketing-module__foot",
                    children: [
                        soonForVertical ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            className: "btn",
                            disabled: true,
                            children: [
                                "Скоро ",
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$icon$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Icon"], {
                                    name: "arrow",
                                    width: 16,
                                    "aria-hidden": "true"
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/hub.tsx",
                                    lineNumber: 169,
                                    columnNumber: 21
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/hub.tsx",
                            lineNumber: 168,
                            columnNumber: 13
                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                            className: "btn",
                            href: module.href,
                            "aria-label": `Открыть: ${module.title}`,
                            children: [
                                "Открыть ",
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$icon$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Icon"], {
                                    name: "arrow",
                                    width: 16,
                                    "aria-hidden": "true"
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/hub.tsx",
                                    lineNumber: 173,
                                    columnNumber: 23
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/hub.tsx",
                            lineNumber: 172,
                            columnNumber: 13
                        }, this),
                        live && module.key !== 'competitors' && (module.key !== 'site' || hospitality) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$action$2d$menu$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ActionMenu"], {
                            label: `Ещё действия: ${module.title}`,
                            items: module.key === 'budget' ? BUDGET_MENU : SITE_MENU
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/hub.tsx",
                            lineNumber: 177,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/hub.tsx",
                    lineNumber: 166,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/hub.tsx",
            lineNumber: 143,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/hub.tsx",
        lineNumber: 138,
        columnNumber: 5
    }, this);
}
function MarketingHub({ vertical, spend = null }) {
    const hospitality = vertical === 'HOSPITALITY';
    const copy = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$vertical$2d$copy$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["verticalCopy"])(vertical);
    const live = liveModules(vertical);
    // Реклама и контент пока «Скоро» у всех направлений; ссылка на экран-превью есть, кнопок действий нет
    const PREVIEW = new Set([
        'ads',
        'content'
    ]);
    const value = (key)=>{
        if (key === 'spent' && spend) return (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$money$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["formatMoney"])(spend.spentMinor, spend.currency);
        return 'Нет данных';
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$page$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Page"], {
        title: "Продвижение",
        subtitle: `Привлекайте ${copy.clientsAcc}, ведите рекламный бюджет и развивайте бренд ${copy.businessOf} с помощью ИИ.`,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "marketing-hub",
            "data-testid": hospitality ? 'marketing-hub' : 'business-marketing',
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "marketing-hub__modules",
                    children: modules(copy).map((m)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(ModuleCard, {
                            module: m,
                            live: live.has(m.key),
                            soonForVertical: !live.has(m.key) && !PREVIEW.has(m.key),
                            hospitality: hospitality
                        }, m.key, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/hub.tsx",
                            lineNumber: 216,
                            columnNumber: 13
                        }, this))
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/hub.tsx",
                    lineNumber: 214,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("aside", {
                    className: "marketing-hub__aside",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                            className: "panel marketing-results",
                            "aria-labelledby": "marketing-results-title",
                            "data-testid": "marketing-results",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                    id: "marketing-results-title",
                                    children: spend ? `Результаты за ${monthWord(spend.month)}` : 'Результаты за месяц'
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/hub.tsx",
                                    lineNumber: 231,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("dl", {
                                    className: "marketing-results__list",
                                    children: results(copy).map(({ key, label, icon })=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "marketing-results__row",
                                            "data-testid": "marketing-result",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "marketing-results__mark",
                                                    "aria-hidden": "true",
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$icon$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Icon"], {
                                                        name: icon,
                                                        width: 18
                                                    }, void 0, false, {
                                                        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/hub.tsx",
                                                        lineNumber: 238,
                                                        columnNumber: 21
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/hub.tsx",
                                                    lineNumber: 237,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                                    children: label
                                                }, void 0, false, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/hub.tsx",
                                                    lineNumber: 240,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                                    "data-testid": `marketing-result-${key}`,
                                                    className: value(key) === 'Нет данных' ? 'muted' : undefined,
                                                    children: value(key)
                                                }, void 0, false, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/hub.tsx",
                                                    lineNumber: 241,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, key, true, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/hub.tsx",
                                            lineNumber: 236,
                                            columnNumber: 17
                                        }, this))
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/hub.tsx",
                                    lineNumber: 234,
                                    columnNumber: 13
                                }, this),
                                spend?.planMinor && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "marketing-results__note",
                                    "data-testid": "marketing-plan",
                                    children: [
                                        "План месяца: ",
                                        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$money$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["formatMoney"])(spend.planMinor, spend.currency),
                                        ".",
                                        ' ',
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                                            href: "/marketing/budget",
                                            children: "Открыть бюджет"
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/hub.tsx",
                                            lineNumber: 250,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/hub.tsx",
                                    lineNumber: 248,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "marketing-results__note",
                                    children: [
                                        hospitality ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Fragment"], {
                                            children: [
                                                "Посещения и заявки сайта: ",
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                                                    href: "/website/analytics",
                                                    children: "Аналитика сайта"
                                                }, void 0, false, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/hub.tsx",
                                                    lineNumber: 256,
                                                    columnNumber: 45
                                                }, this),
                                                "."
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/hub.tsx",
                                            lineNumber: 255,
                                            columnNumber: 17
                                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Fragment"], {
                                            children: [
                                                "Показатели филиала: ",
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                                                    href: "/management/analytics",
                                                    children: "Аналитика"
                                                }, void 0, false, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/hub.tsx",
                                                    lineNumber: 260,
                                                    columnNumber: 39
                                                }, this),
                                                "."
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/hub.tsx",
                                            lineNumber: 259,
                                            columnNumber: 17
                                        }, this),
                                        ' ',
                                        "Переходы и доход с рекламы появятся после подключения рекламных кабинетов."
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/hub.tsx",
                                    lineNumber: 253,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/hub.tsx",
                            lineNumber: 226,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                            className: "panel marketing-start",
                            "aria-labelledby": "marketing-start-title",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "marketing-start__head",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "marketing-start__icon",
                                            "aria-hidden": "true",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$icon$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Icon"], {
                                                name: "send"
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/app/marketing/hub.tsx",
                                                lineNumber: 269,
                                                columnNumber: 17
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/hub.tsx",
                                            lineNumber: 268,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "marketing-start__body",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                                    id: "marketing-start-title",
                                                    children: [
                                                        "Больше ",
                                                        copy.clientsAcc,
                                                        ", меньше рутины"
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/hub.tsx",
                                                    lineNumber: 272,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    children: hospitality ? 'Сайт, реклама и контент в одном рабочем пространстве. Доступность указана в каждом модуле.' : `Начните с сайта: WETOP уже знает ${copy.catalogTitle.toLowerCase()} филиала и предложит три дизайна.`
                                                }, void 0, false, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/hub.tsx",
                                                    lineNumber: 273,
                                                    columnNumber: 17
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/hub.tsx",
                                            lineNumber: 271,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/hub.tsx",
                                    lineNumber: 267,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                                    className: "btn btn--secondary marketing-start__cta",
                                    href: "/marketing/site/editor",
                                    children: "Начать с сайта"
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/hub.tsx",
                                    lineNumber: 280,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/hub.tsx",
                            lineNumber: 266,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/marketing/hub.tsx",
                    lineNumber: 225,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/wt-personnel/apps/web/src/app/marketing/hub.tsx",
            lineNumber: 210,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/hub.tsx",
        lineNumber: 206,
        columnNumber: 5
    }, this);
}
}),
"[project]/wt-personnel/apps/web/src/app/marketing/page.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>MarketingPage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-jsx-dev-runtime.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$api$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/api/navigation.react-server.js [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/client/components/navigation.react-server.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$vertical$2d$guard$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/vertical-guard.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/api.ts [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$budget$2f$derive$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/budget/derive.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$hub$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/hub.tsx [app-rsc] (ecmascript)");
;
;
;
;
;
;
/** Хаб читает одно: бюджет филиала за текущий месяц. Нет филиала или ошибка: «Нет данных», хаб не падает. */ async function loadSpend() {
    try {
        const view = await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["marketingBudgetApi"].view();
        return {
            month: view.month,
            spentMinor: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$budget$2f$derive$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["summarize"])(view).spent.toString(),
            planMinor: view.plan,
            currency: view.reportingCurrency
        };
    } catch (error) {
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["unstable_rethrow"])(error);
        return null;
    }
}
async function MarketingPage() {
    const me = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$vertical$2d$guard$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["requireFeature"])('/marketing');
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$hub$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["MarketingHub"], {
        vertical: me.context?.vertical ?? 'HOSPITALITY',
        spend: await loadSpend()
    }, void 0, false, {
        fileName: "[project]/wt-personnel/apps/web/src/app/marketing/page.tsx",
        lineNumber: 25,
        columnNumber: 10
    }, this);
}
}),
"[project]/wt-personnel/apps/web/src/app/marketing/page.tsx [app-rsc] (ecmascript, Next.js Server Component)", (function(__turbopack_context__){

__turbopack_context__.n(__turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/page.tsx [app-rsc] (ecmascript)"));
}),
"[project]/wt-personnel/apps/web/src/components/action-menu.tsx [app-rsc] (client reference proxy)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ActionMenu",
    ()=>ActionMenu
]);
// This file is generated by next-core EcmascriptClientReferenceModule.
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const ActionMenu = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call ActionMenu() from the server but ActionMenu is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/wt-personnel/apps/web/src/components/action-menu.tsx", "ActionMenu");
}),
"[project]/wt-personnel/apps/web/src/components/action-menu.tsx [app-rsc] (client reference proxy) <module evaluation>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ActionMenu",
    ()=>ActionMenu
]);
// This file is generated by next-core EcmascriptClientReferenceModule.
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const ActionMenu = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call ActionMenu() from the server but ActionMenu is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/wt-personnel/apps/web/src/components/action-menu.tsx <module evaluation>", "ActionMenu");
}),
"[project]/wt-personnel/apps/web/src/components/action-menu.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$action$2d$menu$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__$3c$module__evaluation$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/action-menu.tsx [app-rsc] (client reference proxy) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$action$2d$menu$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/action-menu.tsx [app-rsc] (client reference proxy)");
;
__turbopack_context__.n(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$action$2d$menu$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__);
}),
"[project]/wt-personnel/apps/web/src/lib/vertical-copy.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
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

//# sourceMappingURL=wt-personnel_apps_web_src_0_v1u0h._.js.map