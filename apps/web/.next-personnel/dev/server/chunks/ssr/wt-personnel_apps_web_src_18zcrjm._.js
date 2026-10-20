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
"[project]/wt-personnel/apps/web/src/app/growth/business-sales.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "beautySales",
    ()=>beautySales,
    "foodSales",
    ()=>foodSales,
    "loadBusinessSales",
    ()=>loadBusinessSales,
    "salesPeriodFor",
    ()=>salesPeriodFor
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$api$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/api/navigation.react-server.js [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/client/components/navigation.react-server.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/api.ts [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$food$2d$data$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/food-data.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$ai$2d$seller$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/ai-seller.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$workspace$2d$context$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/workspace-context.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$beauty$2f$time$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/beauty/time.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$management$2f$analytics$2f$vertical$2f$metrics$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/management/analytics/vertical/metrics.ts [app-rsc] (ecmascript)");
;
;
;
;
;
;
;
const DAY = 86_400_000;
const shift = (iso, days)=>new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
function salesPeriodFor(sp, today) {
    if (sp.from && sp.to) {
        try {
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$management$2f$analytics$2f$vertical$2f$metrics$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["periodDates"])(sp.from, sp.to);
            if (sp.to <= today) return {
                from: sp.from,
                to: sp.to,
                preset: 'custom'
            };
        } catch  {
        /* неверный период: обычные 7 дней */ }
    }
    const days = sp.days === '30' ? 30 : 7;
    return {
        from: shift(today, -(days - 1)),
        to: today,
        preset: days === 30 ? '30' : '7'
    };
}
const add = (map, key, minor)=>{
    const row = map.get(key) ?? {
        count: 0,
        revenue: 0n
    };
    row.count += 1;
    row.revenue += BigInt(minor || '0');
    map.set(key, row);
};
const ranked = (map, limit = 5)=>[
        ...map.entries()
    ].sort(([, a], [, b])=>b.revenue === a.revenue ? b.count - a.count : b.revenue > a.revenue ? 1 : -1).slice(0, limit).map(([name, v])=>({
            name,
            count: v.count,
            revenueMinor: v.revenue.toString()
        }));
function beautySales(days) {
    const names = new Map();
    for (const d of days)for (const c of d.columns)names.set(c.id, c.name);
    const rows = days.flatMap((d)=>d.appointments);
    const done = rows.filter((r)=>r.status === 'DONE');
    const revenue = done.reduce((s, r)=>s + BigInt(r.priceMinor || '0'), 0n);
    const services = new Map();
    const masters = new Map();
    for (const r of done){
        const visitMasters = new Map();
        for (const item of r.items?.length ? r.items : [
            r
        ]){
            add(services, item.serviceName, item.priceMinor);
            visitMasters.set(item.employeeId, (visitMasters.get(item.employeeId) ?? 0n) + BigInt(item.priceMinor));
        }
        for (const [employeeId, price] of visitMasters)add(masters, names.get(employeeId) ?? 'Мастер', price.toString());
    }
    return {
        currency: days.at(-1)?.location.currency ?? done[0]?.currency ?? 'KZT',
        revenueMinor: revenue.toString(),
        averageCheckMinor: done.length ? (revenue / BigInt(done.length)).toString() : null,
        sold: done.length,
        bookings: rows.length,
        lost: rows.filter((r)=>r.status === 'NO_SHOW' || r.status === 'CANCELLED').length,
        top: ranked(services),
        team: ranked(masters)
    };
}
function foodSales(report, reservations) {
    return {
        currency: report?.currency ?? 'KZT',
        revenueMinor: report?.revenueMinor ?? null,
        averageCheckMinor: report?.averageCheckMinor ?? null,
        sold: report?.ordersCount ?? null,
        guests: report?.guestsCount ?? null,
        bookings: reservations ? reservations.length : null,
        lost: reservations ? reservations.filter((r)=>r.status === 'NO_SHOW' || r.status === 'CANCELLED').length : null,
        top: (report?.topDishes ?? []).slice(0, 5).map((d)=>({
                name: d.name,
                count: d.qty,
                revenueMinor: d.revenueMinor
            })),
        team: (report?.waiters ?? []).slice(0, 5).map((w)=>({
                name: w.name,
                count: w.orders,
                revenueMinor: w.revenueMinor
            }))
    };
}
const quiet = async (p)=>{
    try {
        return await p;
    } catch (error) {
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["unstable_rethrow"])(error);
        return null;
    }
};
async function loadSeller() {
    const status = await quiet(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sellerApi"].status());
    if (!status) return null;
    const connected = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$ai$2d$seller$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["sellerConnected"])(status) && status.state !== 'extension-off';
    return {
        connected,
        extensionOff: status.state === 'extension-off',
        summary: connected ? await quiet(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sellerApi"].summary()) : null
    };
}
async function beautyDays(branch, dates) {
    const out = [];
    // по дням последовательно, как у аналитики: нагрузка на API ограничена
    for (const date of dates)out.push(await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["branchReportDay"])(branch, date));
    return out;
}
async function foodReservations(branch, dates) {
    const out = [];
    for (const date of dates){
        const rows = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$food$2d$data$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["completeFoodList"])((cursor)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["branchReportDay"])(branch, date, cursor), __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$food$2d$data$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["validFoodReservation"]);
        // брони дня включают пересечения: в период идёт бронь по местной дате начала
        out.push(...rows.filter((r)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$beauty$2f$time$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["localInput"])(r.startsAt, branch.timezone).slice(0, 10) === date));
    }
    return out;
}
async function loadBusinessSales(sp) {
    const branch = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$workspace$2d$context$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["selectedWorkspaceBranch"])();
    const today = branch ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$beauty$2f$time$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["localInput"])(new Date().toISOString(), branch.timezone).slice(0, 10) : new Date().toISOString().slice(0, 10);
    const period = salesPeriodFor(sp, today);
    const seller = await loadSeller();
    const empty = {
        period,
        currency: branch?.currency ?? 'KZT',
        revenueMinor: null,
        averageCheckMinor: null,
        sold: null,
        bookings: null,
        lost: null,
        guests: null,
        top: [],
        team: [],
        seller,
        error: branch ? null : 'Выберите филиал, чтобы увидеть продажи.'
    };
    if (!branch) return empty;
    const dates = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$management$2f$analytics$2f$vertical$2f$metrics$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["periodDates"])(period.from, period.to);
    try {
        if (branch.vertical === 'BEAUTY') {
            return {
                ...empty,
                ...beautySales(await beautyDays(branch, dates)),
                guests: null
            };
        }
        const [report, reservations] = await Promise.all([
            quiet((0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["branchFoodPeriod"])(branch, period.from, period.to)),
            quiet(foodReservations(branch, dates))
        ]);
        return {
            ...empty,
            ...foodSales(report, reservations),
            error: report || reservations ? null : 'Не удалось получить данные ресторана. Обновите страницу.'
        };
    } catch (error) {
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["unstable_rethrow"])(error);
        return {
            ...empty,
            error: 'Не удалось получить данные филиала. Обновите страницу.'
        };
    }
}
}),
"[project]/wt-personnel/apps/web/src/app/growth/business-screen.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "BusinessGrowthScreen",
    ()=>BusinessGrowthScreen
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-jsx-dev-runtime.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/client/app-dir/link.react-server.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$page$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/page.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$icon$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/icon.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$kpi$2d$tile$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/kpi-tile.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/ui.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$hub$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/hub.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$money$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/money.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$plural$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/plural.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$display$2d$date$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/display-date.ts [app-rsc] (ecmascript)");
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
;
;
;
;
const DASH = '–';
function BusinessGrowthScreen({ vertical, mode, data = null }) {
    if (mode === 'marketing') return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$hub$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["MarketingHub"], {
        vertical: vertical
    }, void 0, false, {
        fileName: "[project]/wt-personnel/apps/web/src/app/growth/business-screen.tsx",
        lineNumber: 32,
        columnNumber: 36
    }, this);
    const restaurant = vertical === 'FOOD_SERVICE';
    const copy = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$vertical$2d$copy$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["verticalCopy"])(vertical);
    const money = (minor)=>minor === null || !data ? DASH : (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$money$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["formatMoney"])(minor, data.currency);
    const count = (n)=>n === null || n === undefined ? DASH : String(n);
    const seller = data?.seller ?? null;
    const dialogs = seller?.summary ?? null;
    const conversion = data && data.bookings !== null && data.bookings > 0 && data.sold !== null ? `${Math.round(data.sold / data.bookings * 100)}%` : null;
    const period = data?.period;
    const q = (extra)=>`/sales?${extra}`;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$page$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Page"], {
        title: "Обзор продаж",
        subtitle: period ? `${restaurant ? 'Заказы и брони столов' : 'Записи и оказанные услуги'} за ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$display$2d$date$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["displayDate"])(period.from)} — ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$display$2d$date$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["displayDate"])(period.to)}` : 'Инструменты роста и ИИ-продаж в одном разделе.',
        actions: period && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("nav", {
            className: "chips sales-chips",
            "aria-label": "Период продаж",
            "data-testid": "sales-period",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                    href: q('days=7'),
                    "aria-current": period.preset === '7' ? 'page' : undefined,
                    children: "7 дней"
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/growth/business-screen.tsx",
                    lineNumber: 56,
                    columnNumber: 13
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                    href: q('days=30'),
                    "aria-current": period.preset === '30' ? 'page' : undefined,
                    children: "30 дней"
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/growth/business-screen.tsx",
                    lineNumber: 59,
                    columnNumber: 13
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/wt-personnel/apps/web/src/app/growth/business-screen.tsx",
            lineNumber: 55,
            columnNumber: 11
        }, this),
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "sales-hub growth-hub",
            "data-testid": "business-sales",
            children: [
                data?.error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Alert"], {
                    tone: "warning",
                    role: "alert",
                    "data-testid": "business-sales-error",
                    children: data.error
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/growth/business-screen.tsx",
                    lineNumber: 68,
                    columnNumber: 11
                }, this),
                period && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
                    className: "growth-period",
                    action: "/sales",
                    "data-testid": "sales-custom-period",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                            children: [
                                "С",
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                    type: "date",
                                    name: "from",
                                    defaultValue: period.from,
                                    required: true
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/growth/business-screen.tsx",
                                    lineNumber: 76,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/growth/business-screen.tsx",
                            lineNumber: 74,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                            children: [
                                "По",
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                    type: "date",
                                    name: "to",
                                    defaultValue: period.to,
                                    required: true
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/growth/business-screen.tsx",
                                    lineNumber: 80,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/growth/business-screen.tsx",
                            lineNumber: 78,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            className: "btn btn--secondary",
                            type: "submit",
                            children: "Показать"
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/growth/business-screen.tsx",
                            lineNumber: 82,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "muted",
                            children: "период до 31 дня"
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/growth/business-screen.tsx",
                            lineNumber: 85,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/growth/business-screen.tsx",
                    lineNumber: 73,
                    columnNumber: 11
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "kpi-row",
                    "data-testid": "sales-kpis",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$kpi$2d$tile$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["KpiTile"], {
                            icon: "money",
                            label: "Выручка",
                            testId: "sales-kpi-revenue",
                            value: money(data?.revenueMinor ?? null),
                            caption: restaurant ? 'закрытые заказы' : 'выполненные записи',
                            href: restaurant ? '/restaurant-finance' : '/finance'
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/growth/business-screen.tsx",
                            lineNumber: 89,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$kpi$2d$tile$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["KpiTile"], {
                            icon: "check",
                            label: restaurant ? 'Заказов' : 'Оказано услуг',
                            testId: "sales-kpi-sold",
                            value: count(data?.sold),
                            caption: data?.averageCheckMinor ? `средний чек ${money(data.averageCheckMinor)}` : 'средний чек появится с продажами',
                            href: restaurant ? '/orders' : '/appointments'
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/growth/business-screen.tsx",
                            lineNumber: 97,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$kpi$2d$tile$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["KpiTile"], {
                            icon: "booking",
                            label: restaurant ? 'Броней столов' : 'Записей',
                            testId: "sales-kpi-bookings",
                            value: count(data?.bookings),
                            caption: restaurant ? data?.guests != null ? `${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$plural$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["pluralRu"])(data.guests, [
                                'гость',
                                'гостя',
                                'гостей'
                            ])} в заказах` : 'все статусы' : conversion ? `${conversion} дошли до визита` : 'все статусы',
                            href: restaurant ? '/table-reservations' : '/appointments'
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/growth/business-screen.tsx",
                            lineNumber: 105,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$kpi$2d$tile$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["KpiTile"], {
                            icon: "incidents",
                            label: "Неявки и отмены",
                            testId: "sales-kpi-lost",
                            value: count(data?.lost),
                            caption: data?.lost ? 'стоит напомнить клиентам о визите' : 'потерь нет',
                            href: restaurant ? '/table-reservations' : '/appointments'
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/growth/business-screen.tsx",
                            lineNumber: 121,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$kpi$2d$tile$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["KpiTile"], {
                            icon: "chat",
                            label: "Диалогов ИИ-продавца",
                            testId: "sales-kpi-dialogs",
                            value: dialogs ? String(dialogs.dialogs) : DASH,
                            caption: dialogs ? 'за 24 часа' : seller?.extensionOff ? 'расширение не подключено' : 'ИИ-продавец не подключён',
                            href: "/ai-agents"
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/growth/business-screen.tsx",
                            lineNumber: 129,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$kpi$2d$tile$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["KpiTile"], {
                            icon: "guests",
                            label: "Лидов",
                            testId: "sales-kpi-leads",
                            value: dialogs ? String(dialogs.leads) : DASH,
                            caption: dialogs ? 'оставили контакт за 24 часа' : `контакты ${copy.clientsOf} от ИИ-продавца`,
                            href: "/ai-agents"
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/growth/business-screen.tsx",
                            lineNumber: 137,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/growth/business-screen.tsx",
                    lineNumber: 88,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "sales-trio",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(RankCard, {
                            testId: "sales-card-top",
                            icon: "star",
                            title: restaurant ? 'Лучшие блюда' : 'Лучшие услуги',
                            text: "Что приносит больше всего выручки за период.",
                            rows: data?.top ?? [],
                            unit: restaurant ? [
                                'порция',
                                'порции',
                                'порций'
                            ] : [
                                'раз',
                                'раза',
                                'раз'
                            ],
                            currency: data?.currency ?? 'KZT',
                            empty: restaurant ? 'Закрытых заказов за период нет.' : 'Выполненных записей за период нет.',
                            href: restaurant ? '/menu' : '/services',
                            cta: restaurant ? 'Меню и цены' : 'Услуги и цены'
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/growth/business-screen.tsx",
                            lineNumber: 148,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(RankCard, {
                            testId: "sales-card-team",
                            icon: "guests",
                            title: restaurant ? 'Официанты' : 'Мастера',
                            text: restaurant ? 'Заказы и выручка по официантам.' : 'Услуги и выручка по мастерам.',
                            rows: data?.team ?? [],
                            unit: restaurant ? [
                                'заказ',
                                'заказа',
                                'заказов'
                            ] : [
                                'услуга',
                                'услуги',
                                'услуг'
                            ],
                            currency: data?.currency ?? 'KZT',
                            empty: "Пока нет продаж с исполнителем.",
                            href: "/employees",
                            cta: "Сотрудники"
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/growth/business-screen.tsx",
                            lineNumber: 160,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(SellerCard, {
                            connected: seller?.connected ?? false,
                            extensionOff: seller?.extensionOff ?? false,
                            restaurant: restaurant
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/growth/business-screen.tsx",
                            lineNumber: 172,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/growth/business-screen.tsx",
                    lineNumber: 147,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/wt-personnel/apps/web/src/app/growth/business-screen.tsx",
            lineNumber: 66,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/wt-personnel/apps/web/src/app/growth/business-screen.tsx",
        lineNumber: 46,
        columnNumber: 5
    }, this);
}
function RankCard({ testId, icon, title, text, rows, unit, currency, empty, href, cta }) {
    const max = rows.reduce((m, r)=>BigInt(r.revenueMinor) > m ? BigInt(r.revenueMinor) : m, 0n);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Panel"], {
        className: "sales-card",
        "aria-labelledby": `${testId}-title`,
        "data-testid": testId,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "sales-card__head",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "sales-card__icon",
                        "aria-hidden": "true",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$icon$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Icon"], {
                            name: icon
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/growth/business-screen.tsx",
                            lineNumber: 211,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/growth/business-screen.tsx",
                        lineNumber: 210,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                id: `${testId}-title`,
                                children: title
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/growth/business-screen.tsx",
                                lineNumber: 214,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                children: text
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/growth/business-screen.tsx",
                                lineNumber: 215,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/growth/business-screen.tsx",
                        lineNumber: 213,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/growth/business-screen.tsx",
                lineNumber: 209,
                columnNumber: 7
            }, this),
            rows.length ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("ol", {
                className: "growth-rank",
                children: rows.map((r)=>{
                    const share = max > 0n ? Number(BigInt(r.revenueMinor) * 100n / max) : 0;
                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "growth-rank__name",
                                children: r.name
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/growth/business-screen.tsx",
                                lineNumber: 224,
                                columnNumber: 17
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "growth-rank__value",
                                children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$money$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["formatMoney"])(r.revenueMinor, currency)
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/growth/business-screen.tsx",
                                lineNumber: 225,
                                columnNumber: 17
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "growth-rank__bar",
                                "aria-hidden": "true",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    style: {
                                        width: `${Math.max(4, share)}%`
                                    }
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/growth/business-screen.tsx",
                                    lineNumber: 227,
                                    columnNumber: 19
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/growth/business-screen.tsx",
                                lineNumber: 226,
                                columnNumber: 17
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "growth-rank__count muted",
                                children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$plural$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["pluralRu"])(r.count, unit)
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/growth/business-screen.tsx",
                                lineNumber: 229,
                                columnNumber: 17
                            }, this)
                        ]
                    }, r.name, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/growth/business-screen.tsx",
                        lineNumber: 223,
                        columnNumber: 15
                    }, this);
                })
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/growth/business-screen.tsx",
                lineNumber: 219,
                columnNumber: 9
            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "sales-card__note",
                children: empty
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/growth/business-screen.tsx",
                lineNumber: 235,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "sales-card__foot",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                    className: "btn btn--secondary",
                    href: href,
                    children: [
                        cta,
                        " ",
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$icon$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Icon"], {
                            name: "arrow",
                            width: 16,
                            "aria-hidden": "true"
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/growth/business-screen.tsx",
                            lineNumber: 239,
                            columnNumber: 17
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/growth/business-screen.tsx",
                    lineNumber: 238,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/growth/business-screen.tsx",
                lineNumber: 237,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/growth/business-screen.tsx",
        lineNumber: 208,
        columnNumber: 5
    }, this);
}
function SellerCard({ connected, extensionOff, restaurant }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Panel"], {
        className: "sales-card",
        "aria-labelledby": "sales-seller-title",
        "data-testid": "sales-card-seller",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "sales-card__head",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "sales-card__icon sales-card__icon--seller",
                        "aria-hidden": "true",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$icon$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Icon"], {
                            name: "chat"
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/growth/business-screen.tsx",
                            lineNumber: 259,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/growth/business-screen.tsx",
                        lineNumber: 258,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                id: "sales-seller-title",
                                children: "ИИ-продавец"
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/growth/business-screen.tsx",
                                lineNumber: 262,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                children: "Отвечает клиентам в WhatsApp, Telegram и на сайте круглосуточно."
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/growth/business-screen.tsx",
                                lineNumber: 263,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/growth/business-screen.tsx",
                        lineNumber: 261,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/growth/business-screen.tsx",
                lineNumber: 257,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                className: "sales-card__checks",
                children: [
                    'Ответы на вопросы о ценах и услугах',
                    restaurant ? 'Бронь столов и заказы' : 'Запись к мастеру',
                    'Передача сложных диалогов администратору'
                ].map((t)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$icon$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Icon"], {
                                name: "check",
                                width: 16,
                                "aria-hidden": "true"
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/growth/business-screen.tsx",
                                lineNumber: 270,
                                columnNumber: 15
                            }, this),
                            t
                        ]
                    }, t, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/growth/business-screen.tsx",
                        lineNumber: 269,
                        columnNumber: 13
                    }, this))
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/growth/business-screen.tsx",
                lineNumber: 266,
                columnNumber: 7
            }, this),
            extensionOff && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "sales-card__note",
                "data-testid": "sales-seller-off",
                children: "Расширение «ИИ-продавец» подключает администратор WETOP после оплаты по счёту."
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/growth/business-screen.tsx",
                lineNumber: 277,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "sales-card__foot",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                    className: "btn",
                    href: "/ai-agents",
                    children: [
                        connected ? 'Открыть ИИ-продавцов' : extensionOff ? 'Подробнее' : 'Настроить ИИ-продавца',
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$icon$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Icon"], {
                            name: "arrow",
                            width: 16,
                            "aria-hidden": "true"
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/growth/business-screen.tsx",
                            lineNumber: 284,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/growth/business-screen.tsx",
                    lineNumber: 282,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/growth/business-screen.tsx",
                lineNumber: 281,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/growth/business-screen.tsx",
        lineNumber: 256,
        columnNumber: 5
    }, this);
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
"[project]/wt-personnel/apps/web/src/app/sales/page.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>SalesHubPage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-jsx-dev-runtime.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$growth$2f$business$2d$screen$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/growth/business-screen.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$growth$2f$business$2d$sales$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/growth/business-sales.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/client/app-dir/link.react-server.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$api$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/api/navigation.react-server.js [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/client/components/navigation.react-server.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$index$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/index.ts [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$market$2f$occupancy$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/market/occupancy.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$search$2d$params$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/search-params.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$hotel$2d$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/hotel-api.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/api.ts [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$dashboard$2d$format$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/dashboard-format.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$vertical$2d$guard$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/vertical-guard.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$ai$2d$seller$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/ai-seller.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$sales$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/sales.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$page$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/page.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$icon$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/icon.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$kpi$2d$tile$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/kpi-tile.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/ui.tsx [app-rsc] (ecmascript)");
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
/**
 * Хаб «Продажи» по макету владельца 09.10.2026 (экран 1): шесть плиток, три карточки (конкуренты, ИИ-продавец,
 * рекомендации). Хаб ничего не придумывает: число берётся оттуда же, откуда у экрана модуля, у чего источника нет, там
 * знак пропуска и причина. Рынок это среднее по внесённым данным конкурентов, а не измеренная загрузка отелей.
 */ const settle = (promise)=>promise.then((value)=>({
            ok: true,
            value
        }), (error)=>{
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["unstable_rethrow"])(error);
        return {
            ok: false
        };
    });
const DASH = '–';
const NIGHTS = 14;
const pct = (bp)=>bp === null || bp === undefined ? DASH : (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$market$2f$occupancy$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["formatOccupancy"])(Math.round(bp / 100) * 100);
const minusDays = (iso, n)=>new Date(Date.parse(`${iso}T00:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);
async function SalesHubPage({ searchParams }) {
    const me = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$vertical$2d$guard$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["requireFeature"])('/sales');
    if (me.context?.vertical === 'BEAUTY' || me.context?.vertical === 'FOOD_SERVICE') {
        const data = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$growth$2f$business$2d$sales$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["loadBusinessSales"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$search$2d$params$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["normalizeSearchParams"])(await searchParams));
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$growth$2f$business$2d$screen$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["BusinessGrowthScreen"], {
            vertical: me.context.vertical,
            mode: "sales",
            data: data
        }, void 0, false, {
            fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
            lineNumber: 51,
            columnNumber: 12
        }, this);
    }
    const sp = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$search$2d$params$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["normalizeSearchParams"])(await searchParams);
    const today = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$hotel$2d$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["hotelToday"])();
    const period = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$sales$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["salesPeriod"])({
        days: sp.days,
        from: sp.from,
        to: sp.to
    }, today);
    const status = await settle(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sellerApi"].status());
    const botReadable = status.ok && (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$ai$2d$seller$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["sellerConnected"])(status.value) && status.value.state !== 'extension-off';
    const [summary, bot, needsHuman, market, weekAgo] = await Promise.all([
        settle(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["salesApi"].summary(period.from, period.to)),
        botReadable ? settle(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sellerApi"].summary()) : null,
        botReadable ? settle(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sellerApi"].conversations('needs_human')) : null,
        settle(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["marketApi"].occupancy({
            from: today,
            days: NIGHTS,
            compare: 0
        })),
        // те же ночи по данным недельной давности: изменение средней рынка «за 7 дней»
        settle(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["marketApi"].occupancy({
            from: today,
            days: NIGHTS,
            compare: 0,
            asOf: minusDays(today, 7)
        }))
    ]);
    const sales = summary.ok ? summary.value : null;
    const dialogs = bot?.ok ? bot.value : null;
    const humanCount = needsHuman?.ok ? needsHuman.value.items.length : null;
    const board = market.ok ? market.value.board : null;
    const boardWeek = weekAgo.ok ? weekAgo.value.board : null;
    const noSeller = !botReadable ? 'ИИ-продавец не подключён' : 'Нет данных от продавца';
    const marketDelta = board?.summary.marketBp != null && boardWeek?.summary.marketBp != null ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$dashboard$2d$format$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["deltaPoints"])(board.summary.marketBp / 100, boardWeek.summary.marketBp / 100) : undefined;
    const gap = board?.summary.gapBp ?? null;
    const gapDelta = gap === null ? undefined : {
        direction: gap > 0 ? 'up' : gap < 0 ? 'down' : 'flat',
        text: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$market$2f$occupancy$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["formatPoints"])(Math.round(gap / 100) * 100)
    };
    const conversion = sales ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$sales$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["conversionText"])(sales.conversionPermille.current) : null;
    const conversionDelta = sales && sales.conversionPermille.current !== null && sales.conversionPermille.previous !== null ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$dashboard$2d$format$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["deltaPoints"])(sales.conversionPermille.current / 10, sales.conversionPermille.previous / 10) : undefined;
    const added = sales?.competitors.addedLast30 ?? 0;
    const fresh = sales ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$sales$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["competitorsFreshness"])(sales.competitors, today) : null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$page$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Page"], {
        title: "Обзор продаж",
        subtitle: "Инструменты роста, анализа рынка и ИИ-продаж в одном разделе.",
        actions: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("nav", {
            className: "chips sales-chips",
            "aria-label": "Период броней и конверсии",
            "data-testid": "sales-period",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                    href: "/sales?days=7",
                    "aria-current": period.preset === '7' ? 'page' : undefined,
                    children: "7 дней"
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                    lineNumber: 95,
                    columnNumber: 11
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                    href: "/sales?days=30",
                    "aria-current": period.preset === '30' ? 'page' : undefined,
                    children: "30 дней"
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                    lineNumber: 98,
                    columnNumber: 11
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
            lineNumber: 94,
            columnNumber: 9
        }, this),
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "sales-hub",
            children: [
                !sales && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Alert"], {
                    tone: "warning",
                    role: "alert",
                    "data-testid": "sales-summary-error",
                    children: "Не удалось посчитать брони и конкурентов. Остальное показано как есть, обновите страницу."
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                    lineNumber: 106,
                    columnNumber: 11
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "kpi-row",
                    "data-testid": "sales-kpis",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$kpi$2d$tile$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["KpiTile"], {
                            icon: "channels",
                            label: "Конкурентов в отслеживании",
                            testId: "sales-kpi-competitors",
                            value: sales ? String(sales.competitors.count) : DASH,
                            delta: added > 0 ? {
                                direction: 'up',
                                text: `+${added}`
                            } : undefined,
                            caption: !sales || !fresh ? 'Нет данных' : added > 0 ? 'с прошлого месяца' : fresh.state === 'empty' ? 'добавьте первого конкурента' : fresh.state === 'none' ? 'снимков загрузки ещё нет' : `обновлено ${sales.competitors.lastObservedOn?.slice(8, 10)}.${sales.competitors.lastObservedOn?.slice(5, 7)}`,
                            href: "/market"
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                            lineNumber: 112,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$kpi$2d$tile$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["KpiTile"], {
                            icon: "analytics",
                            label: "Средняя загрузка рынка",
                            testId: "sales-kpi-market",
                            value: pct(board?.summary.marketBp),
                            delta: marketDelta,
                            caption: board ? marketDelta ? 'за последние 7 дней' : 'по внесённым данным' : 'Нет данных',
                            href: "/market"
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                            lineNumber: 131,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$kpi$2d$tile$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["KpiTile"], {
                            icon: "board",
                            label: "Ваша загрузка vs рынок",
                            testId: "sales-kpi-own",
                            value: pct(board?.summary.ownBp),
                            delta: gapDelta,
                            caption: gap === null ? board ? 'нет данных конкурентов' : 'Нет данных' : gap === 0 ? 'вровень с рынком' : `${gap > 0 ? 'выше' : 'ниже'} на ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$market$2f$occupancy$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["formatPoints"])(Math.abs(Math.round(gap / 100) * 100)).replace('+', '')}`,
                            href: "/market"
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                            lineNumber: 140,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$kpi$2d$tile$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["KpiTile"], {
                            icon: "chat",
                            label: "Активных диалогов",
                            testId: "sales-kpi-dialogs",
                            value: dialogs ? String(dialogs.dialogs) : DASH,
                            caption: dialogs ? humanCount ? `за 24 часа, ${humanCount} ждут человека` : 'за 24 часа' : noSeller,
                            href: "/ai-seller/dialogs"
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                            lineNumber: 157,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$kpi$2d$tile$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["KpiTile"], {
                            icon: "check",
                            label: "Конверсия в бронь",
                            testId: "sales-kpi-conversion",
                            value: conversion ?? DASH,
                            delta: conversionDelta,
                            caption: !sales ? 'Нет данных' : conversion === null ? 'за период предложений не было' : `${sales.bookings.current} из ${sales.offers.current} предложений`,
                            href: "/ai-seller/dialogs"
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                            lineNumber: 171,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$kpi$2d$tile$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["KpiTile"], {
                            icon: "guests",
                            label: "Лидов",
                            testId: "sales-kpi-leads",
                            value: dialogs ? String(dialogs.leads) : DASH,
                            caption: dialogs ? 'оставили контакт за 24 часа' : noSeller,
                            href: "/ai-seller/dialogs"
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                            lineNumber: 186,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                    lineNumber: 111,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "sales-trio",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(MarketCard, {
                            board: board
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                            lineNumber: 197,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(SellerCard, {
                            connected: botReadable,
                            extensionOff: status.ok && status.value.state === 'extension-off'
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                            lineNumber: 198,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(RecommendationsCard, {
                            insights: board?.insights ?? null,
                            empty: sales?.competitors.count === 0
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                            lineNumber: 199,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                    lineNumber: 196,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
            lineNumber: 104,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
        lineNumber: 90,
        columnNumber: 5
    }, this);
}
function CheckList({ items }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
        className: "sales-card__checks",
        children: items.map((item)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$icon$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Icon"], {
                        name: "check",
                        width: 16,
                        "aria-hidden": "true"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                        lineNumber: 211,
                        columnNumber: 11
                    }, this),
                    item
                ]
            }, item, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                lineNumber: 210,
                columnNumber: 9
            }, this))
    }, void 0, false, {
        fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
        lineNumber: 208,
        columnNumber: 5
    }, this);
}
/** Мини-столбцы по реальным данным: средняя загрузка рынка на ближайшие ночи; нет данных, нет и картинки */ function MarketBars({ board }) {
    const bars = board?.market.filter((m)=>m.bp !== null) ?? [];
    if (!board || bars.length === 0) return null;
    const label = `Средняя загрузка рынка на ближайшие ${board.dates.length} ночей`;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
        className: "sales-card__art",
        viewBox: "0 0 112 56",
        role: "img",
        "aria-label": label,
        children: board.market.map((m, i)=>{
            const h = m.bp === null ? 0 : Math.max(3, Math.min(m.bp, 10000) / 10000 * 52);
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("rect", {
                x: i * 8,
                y: 54 - h,
                width: 5,
                height: h,
                rx: 1.5,
                fill: "var(--chart-1)",
                opacity: 0.35 + 0.65 * (i / board.market.length),
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("title", {
                    children: `${m.date}: ${pct(m.bp)}`
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                    lineNumber: 230,
                    columnNumber: 13
                }, this)
            }, m.date, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                lineNumber: 229,
                columnNumber: 11
            }, this);
        })
    }, void 0, false, {
        fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
        lineNumber: 225,
        columnNumber: 5
    }, this);
}
function MarketCard({ board }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Panel"], {
        className: "sales-card",
        "aria-labelledby": "sales-market-title",
        "data-testid": "sales-card-market",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "sales-card__head",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "sales-card__icon",
                        "aria-hidden": "true",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$icon$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Icon"], {
                            name: "analytics"
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                            lineNumber: 243,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                        lineNumber: 242,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                id: "sales-market-title",
                                children: "Анализ конкурентов"
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                                lineNumber: 246,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                children: "Мониторинг рынка, сравнение загрузки, подсказки к цене."
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                                lineNumber: 247,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                        lineNumber: 245,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                lineNumber: 241,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "sales-card__body",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(CheckList, {
                        items: [
                            'Ручной ввод и разрешённые источники',
                            'Графики загрузки по ночам',
                            'Подсказки к цене по спросу'
                        ]
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                        lineNumber: 251,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(MarketBars, {
                        board: board
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                        lineNumber: 252,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                lineNumber: 250,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "sales-card__foot",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                    className: "btn",
                    href: "/market",
                    children: [
                        "Открыть аналитику",
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$icon$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Icon"], {
                            name: "arrow",
                            "aria-hidden": "true"
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                            lineNumber: 257,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                    lineNumber: 255,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                lineNumber: 254,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
        lineNumber: 240,
        columnNumber: 5
    }, this);
}
function ChatArt() {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
        className: "sales-card__art",
        viewBox: "0 0 112 72",
        "aria-hidden": "true",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("rect", {
                x: "6",
                y: "6",
                width: "68",
                height: "34",
                rx: "12",
                fill: "var(--primary-soft)"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                lineNumber: 267,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("circle", {
                cx: "26",
                cy: "23",
                r: "3.5",
                fill: "var(--primary)"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                lineNumber: 268,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("circle", {
                cx: "40",
                cy: "23",
                r: "3.5",
                fill: "var(--primary)",
                opacity: "0.7"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                lineNumber: 269,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("circle", {
                cx: "54",
                cy: "23",
                r: "3.5",
                fill: "var(--primary)",
                opacity: "0.4"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                lineNumber: 270,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("rect", {
                x: "38",
                y: "32",
                width: "68",
                height: "34",
                rx: "12",
                fill: "var(--chart-1)",
                opacity: "0.18"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                lineNumber: 271,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("rect", {
                x: "52",
                y: "44",
                width: "40",
                height: "5",
                rx: "2.5",
                fill: "var(--chart-1)",
                opacity: "0.55"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                lineNumber: 272,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("rect", {
                x: "52",
                y: "54",
                width: "26",
                height: "5",
                rx: "2.5",
                fill: "var(--chart-1)",
                opacity: "0.35"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                lineNumber: 273,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
        lineNumber: 266,
        columnNumber: 5
    }, this);
}
function SellerCard({ connected, extensionOff }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Panel"], {
        className: "sales-card",
        "aria-labelledby": "sales-seller-title",
        "data-testid": "sales-card-seller",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "sales-card__head",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "sales-card__icon sales-card__icon--seller",
                        "aria-hidden": "true",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$icon$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Icon"], {
                            name: "chat"
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                            lineNumber: 283,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                        lineNumber: 282,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                id: "sales-seller-title",
                                children: "ИИ-продавец"
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                                lineNumber: 286,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                children: "Сайт и WhatsApp. Ответы на вопросы, заявки и брони."
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                                lineNumber: 287,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                        lineNumber: 285,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                lineNumber: 281,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "sales-card__body",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(CheckList, {
                        items: [
                            'Подключение каналов',
                            'Умные ответы на вопросы гостей',
                            'Квалификация и бронирование'
                        ]
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                        lineNumber: 291,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(ChatArt, {}, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                        lineNumber: 292,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                lineNumber: 290,
                columnNumber: 7
            }, this),
            extensionOff && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "sales-card__note",
                "data-testid": "sales-seller-off",
                children: "Расширение «ИИ-продавец» не подключено: подключает администратор WETOP после оплаты по счёту."
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                lineNumber: 295,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "sales-card__foot",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                    className: "btn",
                    href: extensionOff ? '/ai-agents' : '/ai-seller',
                    children: [
                        extensionOff ? 'Подробнее' : connected ? 'Открыть ИИ-продавца' : 'Настроить ИИ-продавца',
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$icon$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Icon"], {
                            name: "arrow",
                            "aria-hidden": "true"
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                            lineNumber: 302,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                    lineNumber: 300,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                lineNumber: 299,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
        lineNumber: 280,
        columnNumber: 5
    }, this);
}
const REC_ICON = {
    'high-behind': 'arrow',
    high: 'arrow',
    'low-ahead': 'check',
    low: 'board',
    missing: 'help'
};
function RecommendationsCard({ insights, empty }) {
    const shown = (insights ?? []).slice(0, 3);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Panel"], {
        className: "sales-card",
        "aria-labelledby": "sales-recs-title",
        "data-testid": "sales-card-recs",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "sales-card__head",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "sales-card__icon sales-card__icon--tip",
                        "aria-hidden": "true",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$icon$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Icon"], {
                            name: "sun"
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                            lineNumber: 323,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                        lineNumber: 322,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                id: "sales-recs-title",
                                children: "Рекомендации сегодня"
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                                lineNumber: 326,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                children: "Что видно на рынке на ближайшие две недели."
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                                lineNumber: 327,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                        lineNumber: 325,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                lineNumber: 321,
                columnNumber: 7
            }, this),
            shown.length > 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                className: "sales-recs",
                "data-testid": "sales-recs",
                children: shown.map((i)=>{
                    const t = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$market$2f$insight$2d$text$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["insightText"])(i);
                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["cx"])('sales-rec', `sales-rec--${t.tone}`),
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "sales-rec__icon",
                                "aria-hidden": "true",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$icon$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Icon"], {
                                    name: REC_ICON[i.kind]
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                                    lineNumber: 337,
                                    columnNumber: 19
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                                lineNumber: 336,
                                columnNumber: 17
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                        children: t.title
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                                        lineNumber: 340,
                                        columnNumber: 19
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        children: t.text
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                                        lineNumber: 341,
                                        columnNumber: 19
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                                lineNumber: 339,
                                columnNumber: 17
                            }, this)
                        ]
                    }, `${i.kind}-${i.from}`, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                        lineNumber: 335,
                        columnNumber: 15
                    }, this);
                })
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                lineNumber: 331,
                columnNumber: 9
            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "sales-card__note",
                "data-testid": "sales-recs-empty",
                children: empty ? 'Добавьте ближайших конкурентов и внесите их загрузку: WETOP покажет, где рынок полон и цену можно поднять.' : insights === null ? 'Не удалось получить данные рынка.' : 'Пока подсказок нет: на ближайшие ночи рынок без резких перепадов.'
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                lineNumber: 348,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "sales-card__foot",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                    className: "btn btn--secondary",
                    href: "/market?add=1",
                    children: [
                        "Добавить конкурента",
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$icon$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Icon"], {
                            name: "plus",
                            "aria-hidden": "true"
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                            lineNumber: 359,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                    lineNumber: 357,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
                lineNumber: 356,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/app/sales/page.tsx",
        lineNumber: 320,
        columnNumber: 5
    }, this);
}
}),
"[project]/wt-personnel/apps/web/src/app/sales/page.tsx [app-rsc] (ecmascript, Next.js Server Component)", (function(__turbopack_context__){

__turbopack_context__.n(__turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/sales/page.tsx [app-rsc] (ecmascript)"));
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
"[project]/wt-personnel/apps/web/src/components/kpi-tile.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "KpiTile",
    ()=>KpiTile
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-jsx-dev-runtime.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/client/app-dir/link.react-server.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$icon$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/icon.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/ui.tsx [app-rsc] (ecmascript)");
;
;
;
;
function KpiTile({ icon, label, value, delta, caption, href, testId }) {
    const body = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "kpi-tile__head",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "kpi-tile__icon",
                        "aria-hidden": "true",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$icon$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Icon"], {
                            name: icon
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/components/kpi-tile.tsx",
                            lineNumber: 34,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/kpi-tile.tsx",
                        lineNumber: 33,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "kpi-tile__label",
                        children: label
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/kpi-tile.tsx",
                        lineNumber: 36,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/components/kpi-tile.tsx",
                lineNumber: 32,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "kpi-tile__row",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "kpi-tile__value",
                        "data-testid": testId,
                        children: value
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/kpi-tile.tsx",
                        lineNumber: 39,
                        columnNumber: 9
                    }, this),
                    delta && delta.direction && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "kpi-tile__delta",
                        "data-direction": delta.direction,
                        children: delta.text
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/kpi-tile.tsx",
                        lineNumber: 43,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/components/kpi-tile.tsx",
                lineNumber: 38,
                columnNumber: 7
            }, this),
            caption && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "kpi-tile__caption",
                children: caption
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/components/kpi-tile.tsx",
                lineNumber: 48,
                columnNumber: 19
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/components/kpi-tile.tsx",
        lineNumber: 31,
        columnNumber: 5
    }, this);
    return href ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
        href: href,
        prefetch: false,
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["cx"])('kpi-tile', 'kpi-tile--link'),
        children: body
    }, void 0, false, {
        fileName: "[project]/wt-personnel/apps/web/src/components/kpi-tile.tsx",
        lineNumber: 52,
        columnNumber: 5
    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "kpi-tile",
        children: body
    }, void 0, false, {
        fileName: "[project]/wt-personnel/apps/web/src/components/kpi-tile.tsx",
        lineNumber: 56,
        columnNumber: 5
    }, this);
}
}),
"[project]/wt-personnel/apps/web/src/lib/ai-seller.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SELLER_LEGACY_VIEWS",
    ()=>SELLER_LEGACY_VIEWS,
    "SELLER_PROMPT_MAX",
    ()=>SELLER_PROMPT_MAX,
    "SELLER_TABS",
    ()=>SELLER_TABS,
    "categoryPriceLine",
    ()=>categoryPriceLine,
    "conversationChannelLabel",
    ()=>conversationChannelLabel,
    "conversationModeLabel",
    ()=>conversationModeLabel,
    "conversationStageLabel",
    ()=>conversationStageLabel,
    "extensionLastDay",
    ()=>extensionLastDay,
    "extensionReminder",
    ()=>extensionReminder,
    "knowledgeSourceLabel",
    ()=>knowledgeSourceLabel,
    "leadFacts",
    ()=>leadFacts,
    "replyTimeText",
    ()=>replyTimeText,
    "sellerBanner",
    ()=>sellerBanner,
    "sellerCanAct",
    ()=>sellerCanAct,
    "sellerChecklist",
    ()=>sellerChecklist,
    "sellerConnected",
    ()=>sellerConnected,
    "sellerDataLinks",
    ()=>sellerDataLinks,
    "sellerPromptDraft",
    ()=>sellerPromptDraft,
    "sellerReadOnlyReason",
    ()=>sellerReadOnlyReason,
    "sellerVerticalUiCopy",
    ()=>sellerVerticalUiCopy
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$index$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/index.ts [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$accounts$2f$extensions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/accounts/extensions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$ai$2d$seller$2f$profile$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/ai-seller/profile.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$property$2d$time$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/property-time.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$display$2d$date$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/display-date.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$money$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/money.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$plural$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/plural.ts [app-rsc] (ecmascript)");
;
;
;
;
;
const SELLER_TABS = [
    {
        view: 'overview',
        href: '/ai-seller/overview',
        label: 'Обзор'
    },
    {
        view: '',
        href: '/ai-seller',
        label: 'Настройка'
    },
    {
        view: 'dialogs',
        href: '/ai-seller/dialogs',
        label: 'Диалоги'
    },
    {
        view: 'knowledge',
        href: '/ai-seller/knowledge',
        label: 'Знания'
    },
    {
        view: 'connections',
        href: '/ai-seller/connections',
        label: 'Подключения'
    },
    {
        view: 'scenarios',
        href: '/ai-seller/scenarios',
        label: 'Сценарии'
    },
    {
        view: 'analytics',
        href: '/ai-seller/analytics',
        label: 'Аналитика'
    }
];
function sellerVerticalUiCopy(vertical) {
    if (vertical === 'BEAUTY') {
        return {
            setupData: 'Услуги, мастера и часы работы продавец берёт из WETOP сам, их писать не нужно.',
            scenarioSales: 'Отвечает клиентам на сайте и в мессенджерах, подбирает услугу и мастера по данным WETOP, собирает контакт и передаёт запрос администратору.',
            scenarioSupport: 'Отвечает на вопросы об услугах и правилах без продажи.',
            embedIdentity: 'Клиент пишет анонимно. В коде находится публичный ключ вашего салона: по нему продавец узнаёт салон и отвечает только с доменов его сайта.',
            embedNoSite: 'У салона нет сайта в «Настройках сайта». Заведите сайт с доменом, и продавец начнёт пускать с него.',
            extensionOff: 'Продавец отвечает клиентам в чате на сайте салона: рассказывает об услугах и правилах, помогает выбрать услугу и мастера, берёт контакт и зовёт администратора, когда нужно.',
            agentCard: 'Автоматизируйте ответы клиентам, подбор услуг и передачу заявок администратору.'
        };
    }
    if (vertical === 'FOOD_SERVICE') {
        return {
            setupData: 'Меню, залы и часы работы продавец берёт из WETOP сам, их писать не нужно.',
            scenarioSales: 'Отвечает гостям ресторана на сайте и в мессенджерах, рассказывает о меню и залах, помогает выбрать время, собирает контакт и передаёт бронь стола администратору.',
            scenarioSupport: 'Отвечает на вопросы о меню, залах и правилах без продажи.',
            embedIdentity: 'Гость пишет анонимно. В коде находится публичный ключ вашего ресторана: по нему продавец узнаёт ресторан и отвечает только с доменов его сайта.',
            embedNoSite: 'У ресторана нет сайта в «Настройках сайта». Заведите сайт с доменом, и продавец начнёт пускать с него.',
            extensionOff: 'Продавец отвечает гостям в чате на сайте ресторана: рассказывает о меню, залах и правилах, помогает выбрать время, берёт контакт и зовёт администратора, когда нужно.',
            agentCard: 'Автоматизируйте ответы гостям, брони столов и передачу заявок администратору.'
        };
    }
    return {
        setupData: 'Цены, номера, заезд и выезд продавец берёт из WETOP сам, их писать не нужно.',
        scenarioSales: 'Отвечает гостям на сайте и в мессенджерах, подбирает номер на даты, называет цену из WETOP, собирает контакт и после явного согласия гостя создаёт бронь.',
        scenarioSupport: 'Отвечает на вопросы о проживании и правилах без продажи.',
        embedIdentity: 'Гость пишет анонимно. В коде находится публичный ключ вашей гостиницы: по нему продавец узнаёт её и отвечает только с доменов её сайта.',
        embedNoSite: 'У гостиницы нет сайта в «Настройках сайта». Заведите сайт с доменом, и продавец начнёт пускать с него.',
        extensionOff: 'Продавец отвечает гостям в чате на сайте объекта: называет цены по тарифу сайта, рассказывает о правилах, берёт контакт и зовёт человека, когда нужно.',
        agentCard: 'Автоматизируйте ответы гостям, подбор размещения и продажи.'
    };
}
const SELLER_PROMPT_MAX = 20_000;
const SELLER_LEGACY_VIEWS = {
    data: 'knowledge',
    model: 'connections',
    embed: 'connections',
    whatsapp: 'connections',
    check: ''
};
function sellerReadOnlyReason(status) {
    if (status.state === 'extension-expired') return 'Срок расширения вышел: настройки только для просмотра. Продлевает администратор WETOP.';
    // старый API ролей не знает — тогда настраивать может каждый, как было до ADR-083
    if (status.canConfigure === false) return 'Настройки продавца меняют владелец и управляющий.';
    return null;
}
function sellerConnected(status) {
    return (status.connection ?? status.state) === 'ready';
}
function sellerCanAct(status) {
    return status.state === 'ready';
}
function extensionLastDay(activeUntil) {
    const t = Date.parse(activeUntil);
    return Number.isNaN(t) ? '' : (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$property$2d$time$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["propertyClock"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$accounts$2f$extensions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["PLATFORM_TIMEZONE"]).date(new Date(t - 1).toISOString());
}
function extensionReminder(extension) {
    if (!extension || extension.access !== 'active' || !extension.activeUntil) return null;
    const days = extension.daysLeft;
    if (days === null || days > 7) return null;
    const day = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$display$2d$date$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["displayDay"])(extensionLastDay(extension.activeUntil));
    const what = extension.status === 'TRIAL' ? 'Пробный доступ к ИИ-продавцу' : 'Расширение «ИИ-продавец»';
    const left = days <= 1 ? `действует последний день — по ${day}` : `действует ещё ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$plural$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["pluralRu"])(days, [
        'день',
        'дня',
        'дней'
    ])} — по ${day}`;
    return `${what} ${left}. Потом раздел останется только для чтения. Продлевает администратор WETOP после оплаты.`;
}
function sellerBanner(status) {
    if (status.state === 'extension-off') return {
        tone: 'warn',
        value: 'не подключён',
        title: 'Расширение «ИИ-продавец» не подключено',
        text: 'Раздел открывается организациям с подключённым расширением. Подключает администратор WETOP после оплаты по счёту.'
    };
    if (status.state === 'extension-expired') return {
        tone: 'alarm',
        value: 'срок вышел',
        title: 'Срок расширения «ИИ-продавец» вышел',
        text: 'Раздел только для чтения: настройки, знания и диалоги видны, но отвечать гостям и менять настройки нельзя. Ничего не удалено. Продлевает администратор WETOP.'
    };
    if (status.state === 'not-configured') return {
        tone: 'warn',
        value: 'не подключён',
        title: 'ИИ-продавец не подключён',
        text: 'Настройки можно сохранить заранее: продавец получит их, как только его подключат. Адрес и ключ продавца задаёт владелец в настройках сервера.'
    };
    if (status.lastError && status.retrying) return {
        tone: 'alarm',
        value: 'не принял правки',
        title: 'Продавец не принял правки',
        text: `${status.lastError}. Повторяем отправку автоматически раз в минуту.`
    };
    // отказ по содержанию: та же версия будет отклонена снова, и сверка её сама не шлёт (ADR-079)
    if (status.lastError) return {
        tone: 'alarm',
        value: 'отклонил правки',
        title: 'Продавец отклонил правки',
        text: `${status.lastError}. Сами не повторяем: исправьте, что назвал продавец, и нажмите «Сохранить и применить» во вкладке «Настройка».`
    };
    if (!status.profile.saved) return {
        tone: 'warn',
        value: 'не настроен',
        title: 'Продавец ещё не настроен',
        text: 'Опишите продавца своими словами во вкладке «Настройка» и нажмите «Сохранить и применить».'
    };
    if (status.profile.applied && status.facts.applied) return {
        tone: 'calm',
        value: 'настройки применены',
        title: 'Инструкция и данные переданы продавцу',
        text: 'Правки настроек, карточки объекта и цен уходят продавцу сами.'
    };
    return {
        tone: 'warn',
        value: 'правки в пути',
        title: 'Правки ещё в пути',
        text: 'Настройки или данные объекта изменились — отправим продавцу в течение минуты.'
    };
}
function sellerChecklist(status, keySet, prompt) {
    const items = [];
    if (!sellerConnected(status)) items.push({
        key: 'connect',
        title: 'Подключить продавца',
        hint: 'Адрес и ключ продавца задаются на сервере — это делает администратор WETOP.',
        done: false
    });
    items.push({
        key: 'model',
        title: 'Проверить модель',
        hint: keySet ? 'Ключ модели сохранён.' : 'Личный ключ не задан. Если модель подключена платформой, проверьте ответ в «Проверке». Свой ключ можно добавить в подключениях.',
        done: keySet === true,
        href: '/ai-seller/connections'
    });
    items.push({
        key: 'prompt',
        title: 'Написать инструкцию',
        hint: prompt?.applied ? 'Сохранена и отправлена продавцу.' : prompt?.saved ? 'Сохранена, но ещё не у продавца: нажмите «Сохранить и применить».' : 'Опишите продавца своими словами ниже.',
        done: prompt?.applied === true
    });
    if (items.every((item)=>item.done)) return null;
    items.push({
        key: 'check',
        title: 'Проверить ответ',
        hint: 'Напишите продавцу в «Проверке» так, как написал бы гость.',
        done: false
    });
    return items;
}
const lines = (items)=>items.map((item)=>item.trim()).filter(Boolean).map((item)=>`- ${item}`);
function sellerPromptDraft(profile, vertical = 'HOSPITALITY') {
    const p = profile;
    const name = p?.botName?.trim();
    const languages = (p?.languages.length ? p.languages : [
        'ru'
    ]).map((code)=>(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$ai$2d$seller$2f$profile$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SELLER_LANGUAGES"][code] ?? code).toLowerCase());
    const conversation = vertical === 'BEAUTY' ? [
        'При подборе услуги уточняй только недостающие услугу, мастера и желаемое время. Для справочного вопроса подбор не начинай.',
        'Подбери подходящую услугу и мастера по данным WETOP.',
        'Если клиент хочет записаться, собери недостающие данные и передай запрос администратору. Не обещай созданную запись без подтверждения системы.'
    ] : [
        'При подборе размещения уточняй только недостающие даты, количество гостей и тип размещения. Для справочного вопроса подбор не начинай.',
        'Подбери подходящий вариант и расскажи о нём.',
        'При желании оформить бронь используй контакт канала и только проверенные действия платформы.'
    ];
    const clarificationExample = vertical === 'BEAUTY' ? 'Если нужны услуга и мастер, сначала уточни только услугу; не объединяй два вопроса в один.' : 'Если нужны даты и тип номера, сначала уточни только даты; не объединяй два вопроса в один.';
    const parts = [
        'Разговор по шагам',
        ...lines(conversation)
    ];
    const rules = lines([
        p?.includedInPrice.trim() ? `Входит в цену: ${p.includedInPrice.trim()}` : '',
        p?.extraCharges.trim() ? `За доплату: ${p.extraCharges.trim()}` : '',
        ...p?.houseRules.split('\n') ?? []
    ]);
    if (rules.length) parts.push('', 'Правила объекта', ...rules);
    if (p?.prohibitions.length) parts.push('', 'Чего не делать', ...lines(p.prohibitions));
    if (p?.callHumanWhen.length) parts.push('', 'Когда ещё звать человека', ...lines(p.callHumanWhen));
    parts.push('', 'Стиль', ...lines([
        'Сначала ответь прямо на вопрос: обычно достаточно 1–3 коротких предложений.',
        'Не повторяй уже известные сведения, приветствия и рекламные предложения. Не добавляй список своих возможностей к каждому ответу.',
        `Задавай не больше одного необходимого уточняющего вопроса за сообщение, только если без него нельзя помочь. Не спрашивай повторно то, что уже известно из диалога. ${clarificationExample}`,
        'Не запрашивай телефон у пользователя. Контакт бери из канала связи, а данные вошедшего пользователя — из авторизованного контекста системы. Не проси повторить уже известные имя, контакты или объект. Если контекст недоступен, не выдумывай его и не запрашивай телефон вместо восстановления подключения.',
        'Не выдумывай цены, доступность, причины ошибок или выполненные действия. Если проверенных данных нет, кратко скажи об этом и предложи следующий шаг.',
        'Подробности давай по просьбе: тогда объясняй полно, по шагам, без искусственного ограничения длины.',
        'О передаче специалисту или создании заявки говори в прошедшем времени только после подтверждения системой. Иначе предложи передачу.',
        name ? `Тебя зовут ${name}.` : '',
        `Обращайся к гостю ${__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$ai$2d$seller$2f$profile$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SELLER_ADDRESS_FORMS"][p?.addressForm ?? 'FORMAL']}, отвечай ${__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$ai$2d$seller$2f$profile$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SELLER_REPLY_LENGTHS"][p?.replyLength ?? 'SHORT']}, эмодзи — ${__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$ai$2d$seller$2f$profile$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SELLER_EMOJI"][p?.emoji ?? 'NEVER']}.`,
        `Отвечай на языке гостя: ${languages.join(', ')}.`,
        p?.greeting.trim() ? `Первое сообщение: ${p.greeting.trim()}` : ''
    ]));
    if (p?.faq.length) parts.push('', 'Готовые ответы', ...p.faq.map((item)=>`- ${item.question.trim()} → ${item.answer.trim()}`));
    return parts.join('\n').trim() + '\n';
}
function categoryPriceLine(price, currency) {
    if (price.reason === 'same' && price.priceMinor !== null) {
        const guests = price.occupancy && price.occupancy > 1 ? ` за ${price.occupancy} гостей` : '';
        return {
            value: `${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$money$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["formatMoney"])(price.priceMinor, currency)} за ночь${guests}`,
            note: null,
            known: true
        };
    }
    if (price.reason === 'varies' && price.min !== null && price.max !== null) return {
        value: 'уточнит администратор',
        note: `цена меняется по датам: от ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$money$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["formatMoney"])(price.min, currency)} до ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$money$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["formatMoney"])(price.max, currency)}`,
        known: false
    };
    return {
        value: 'уточнит администратор',
        note: 'в тарифе сайта цены нет',
        known: false
    };
}
function knowledgeSourceLabel(source) {
    return source === 'platform:facts.md' ? 'Данные объекта (от платформы)' : source;
}
function conversationModeLabel(mode) {
    if (mode === 'needs_human') return {
        label: 'нужен человек',
        tone: 'warn'
    };
    if (mode === 'owner_takeover') return {
        label: 'ведёт человек',
        tone: 'info'
    };
    if (mode === 'bot_active') return {
        label: 'ведёт бот',
        tone: 'neutral'
    };
    return {
        label: mode,
        tone: 'neutral'
    };
}
/**
 * Что продавец узнал о госте: поля ядра бота (`LeadFields`) и ключи свободной сумки `extra`, которые бот отдаёт в бронь
 * (`create_lead`, `src/integrations/wetop.py`), — словами стойки; остальные ключи `extra` задаёт промпт — как есть
 */ const LEAD_LABELS = {
    interest: 'Что ищет',
    budget: 'Бюджет',
    timeframe: 'Когда',
    notes: 'Заметки',
    arrival: 'Заезд',
    departure: 'Выезд',
    category: 'Категория',
    guests: 'Гостей'
};
/** Контакт стоит в карточке отдельно — в сведениях о госте он не повторяется */ const LEAD_CONTACT = new Set([
    'name',
    'phone',
    'email'
]);
const leadValue = (v)=>{
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'string') return v;
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    return JSON.stringify(v);
};
function leadFacts(data) {
    const out = [];
    const push = (key, raw)=>{
        const value = leadValue(raw);
        if (value !== null) out.push({
            label: LEAD_LABELS[key] ?? key,
            value
        });
    };
    for (const [key, raw] of Object.entries(data)){
        if (LEAD_CONTACT.has(key)) continue;
        if (key === 'extra') {
            if (raw && typeof raw === 'object' && !Array.isArray(raw)) for (const [k, v] of Object.entries(raw))push(k, v);
            continue;
        }
        push(key, raw);
    }
    return out;
}
/** Этап воронки продавца (FunnelStage бота) словами стойки */ const STAGES = {
    new: 'новый',
    qualifying: 'уточняет',
    presenting: 'выбирает',
    objection: 'сомневается',
    closing: 'готов бронировать',
    won: 'договорились',
    lost: 'ушёл'
};
function conversationStageLabel(stage) {
    if (!stage) return '—';
    return STAGES[stage] ?? stage;
}
function conversationChannelLabel(channel) {
    if (!channel) return '—';
    if (channel === 'widget') return 'чат на сайте';
    if (channel === 'sandbox') return 'проверка';
    return channel;
}
function replyTimeText(seconds) {
    if (seconds === null) return null;
    if (seconds < 60) return `${seconds} с`;
    if (seconds < 3600) {
        const s = seconds % 60;
        return `${Math.floor(seconds / 60)} мин${s ? ` ${s} с` : ''}`;
    }
    const m = Math.floor(seconds % 3600 / 60);
    return `${Math.floor(seconds / 3600)} ч${m ? ` ${m} мин` : ''}`;
}
function sellerDataLinks(vertical) {
    if (vertical === 'BEAUTY') return [
        {
            href: '/services',
            label: 'Изменить услуги и цены'
        },
        {
            href: '/employees',
            label: 'Мастера филиала'
        },
        {
            href: '/branches',
            label: 'Карточка филиала'
        }
    ];
    if (vertical === 'FOOD_SERVICE') return [
        {
            href: '/menu',
            label: 'Изменить меню и цены'
        },
        {
            href: '/restaurant-settings',
            label: 'Часы работы и брони'
        },
        {
            href: '/branches',
            label: 'Карточка филиала'
        }
    ];
    return [
        {
            href: '/hotel-settings',
            label: 'Изменить карточку объекта'
        },
        {
            href: '/rooms/categories',
            label: 'Изменить цены в «Категориях номеров»'
        },
        {
            href: '/website/booking',
            label: 'Тариф сайта'
        }
    ];
}
}),
"[project]/wt-personnel/apps/web/src/lib/dashboard-format.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
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
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$status$2f$source$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/status/source.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$status$2f$types$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/status/types.ts [app-rsc] (ecmascript)");
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
const sourceLabel = (source, channel)=>channel || (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$status$2f$types$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["statusLabel"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$status$2f$source$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["sourceStatus"], source);
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
"[project]/wt-personnel/apps/web/src/lib/sales.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "STALE_AFTER_DAYS",
    ()=>STALE_AFTER_DAYS,
    "competitorsFreshness",
    ()=>competitorsFreshness,
    "conversionText",
    ()=>conversionText,
    "countDelta",
    ()=>countDelta,
    "moneyDelta",
    ()=>moneyDelta,
    "salesPeriod",
    ()=>salesPeriod
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$dashboard$2d$format$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/dashboard-format.ts [app-rsc] (ecmascript)");
;
/**
 * Хаб «Продажи» (SALES2.2): то, что экран считает сам. Без запросов и разметки. Правило страницы: неизвестное не
 * рисуется нулём. Нет предложений, нет и конверсии; нет базы сравнения, нет и «+0 %».
 */ const DAY_MS = 86_400_000;
const ymd = (ms)=>new Date(ms).toISOString().slice(0, 10);
const ms = (date)=>Date.parse(`${date}T00:00:00Z`);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const validDate = (v)=>!!v && DATE.test(v) && !Number.isNaN(ms(v)) && ymd(ms(v)) === v;
const STALE_AFTER_DAYS = 3;
function salesPeriod(query, today) {
    const lastDays = (n)=>({
            from: ymd(ms(today) - (n - 1) * DAY_MS),
            to: today,
            preset: n === 7 ? '7' : '30'
        });
    if (validDate(query.from) && validDate(query.to) && query.from <= query.to) {
        const days = (ms(query.to) - ms(query.from)) / DAY_MS + 1;
        if (days <= 366) return {
            from: query.from,
            to: query.to,
            preset: 'custom'
        };
    }
    return lastDays(query.days === '7' ? 7 : 30);
}
const countDelta = (current, previous)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$dashboard$2d$format$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["deltaPercent"])(current, previous);
const moneyDelta = (currentMinor, previousMinor)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$dashboard$2d$format$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["deltaPercent"])(BigInt(currentMinor), BigInt(previousMinor));
const percent = new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 1
});
const conversionText = (permille)=>permille === null ? null : `${percent.format(permille / 10)} %`;
function competitorsFreshness(competitors, today) {
    if (competitors.count === 0) return {
        state: 'empty',
        ageDays: null
    };
    if (!competitors.lastObservedOn) return {
        state: 'none',
        ageDays: null
    };
    const ageDays = Math.max(0, Math.round((ms(today) - ms(competitors.lastObservedOn)) / DAY_MS));
    return {
        state: ageDays > STALE_AFTER_DAYS ? 'stale' : 'fresh',
        ageDays
    };
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

//# sourceMappingURL=wt-personnel_apps_web_src_18zcrjm._.js.map