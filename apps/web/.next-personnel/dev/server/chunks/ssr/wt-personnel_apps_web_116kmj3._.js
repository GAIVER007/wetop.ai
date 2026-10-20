module.exports = [
"[project]/wt-personnel/apps/web/.next-internal/server/app/employees/[id]/profile/page/actions.js { ACTIONS_MODULE0 => \"[project]/wt-personnel/apps/web/src/app/login/actions.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE1 => \"[project]/wt-personnel/apps/web/src/app/branches/actions.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE2 => \"[project]/wt-personnel/apps/web/src/app/beauty/actions.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE3 => \"[project]/wt-personnel/apps/web/src/app/my-work/actions.ts [app-rsc] (ecmascript)\" } [app-rsc] (server actions loader, ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "006e5fc1898f6ae417ffb62b54cb1d413c3d8159b2",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["logoutAllAction"],
    "007d1442f5a8d0cd6e013f22d98ca02ad493e384e8",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["signOut"],
    "00d659178cdba3651f0abc0c3752238282ee1e32fb",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$branches$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["branchChoices"],
    "4051f91126f03a2287a9bf7ffbb4f1e344bb31cf04",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["removeMemberAction"],
    "4052f29f697ed23477e3e82392fdd75d5efa81cee1",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerAction"],
    "405add4ac8b023f91674b78a847ea5caced76b052f",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$branches$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["selectBranch"],
    "408a4b37b5735c79c2a08991396d665af6781ac358",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$beauty$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["loadBeautyEmployee"],
    "40a28645f8383dc9db60c5ad7c833791c6e6b74105",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["verifyEmailAction"],
    "40a3ec6082c769cd822baf77c3181fca96da306c5b",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["acceptInviteAction"],
    "40b40b535b4ee73667ff5a6be11164a285b559119f",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revokeInviteAction"],
    "60274aaa6bd31e13c03d12280d9550a04fc7ec5972",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["setPassword"],
    "60335ab786e08952807d64399406b9025324d076b2",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$my$2d$work$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["loadPortalWeek"],
    "605f624c9a7322c12bc33ed1e961cfab5f4be3dea0",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$beauty$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["saveBeautyEmployee"],
    "607a392fa69b3d4a29e31af337631be9cfc424d61f",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["signIn"],
    "609df8f3d7d01cb388f2511215cd8d3ff71a51191e",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["resendVerification"],
    "60abc013b5dbea7b8b9292befc773e2f4a40f551fa",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$beauty$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["saveBeautyEmployeeLocations"],
    "60b6c9bb4ab18d132b8ff40aeb76415996a8f938d1",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["setMemberRoleAction"],
    "60d33ca0bd2451452b775a43114684280eba03929f",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["requestReset"],
    "60d6dad01fad7c72ba12e4e980375acfcf0fb6a8a6",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["setMemberSuspendedAction"],
    "70434b18000c0934031866abd06e2b7ab54ab1984c",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["setMemberDetailsAction"],
    "70bc37ace9ff75b5dccdab8c6b420c7a47982d224f",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["setMemberScopesAction"],
    "70bde5c2a7438fe8b77075f317bffd1523fe8fbb50",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$my$2d$work$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["removeEmployeeServicePrice"],
    "70d57a9256651bfa2247eb2f868fdfc181a6f42cdd",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$my$2d$work$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["saveEmployeeServicePrice"],
    "7848c45355db0e16ec95579f5efb01a5bc2f409bfa",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["resendInviteAction"],
    "788dbe579ef7d0651d364161ab4e558c1fec3fc0ce",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["inviteAction"],
    "789065d3d232e1a26a03316ef24c10ad4d389f7ac3",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$my$2d$work$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["savePortal"]
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f2e$next$2d$internal$2f$server$2f$app$2f$employees$2f5b$id$5d2f$profile$2f$page$2f$actions$2e$js__$7b$__ACTIONS_MODULE0__$3d3e$__$225b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE1__$3d3e$__$225b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$branches$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE2__$3d3e$__$225b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$beauty$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE3__$3d3e$__$225b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$my$2d$work$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$2922$__$7d$__$5b$app$2d$rsc$5d$__$28$server__actions__loader$2c$__ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i('[project]/wt-personnel/apps/web/.next-internal/server/app/employees/[id]/profile/page/actions.js { ACTIONS_MODULE0 => "[project]/wt-personnel/apps/web/src/app/login/actions.ts [app-rsc] (ecmascript)", ACTIONS_MODULE1 => "[project]/wt-personnel/apps/web/src/app/branches/actions.ts [app-rsc] (ecmascript)", ACTIONS_MODULE2 => "[project]/wt-personnel/apps/web/src/app/beauty/actions.ts [app-rsc] (ecmascript)", ACTIONS_MODULE3 => "[project]/wt-personnel/apps/web/src/app/my-work/actions.ts [app-rsc] (ecmascript)" } [app-rsc] (server actions loader, ecmascript) <locals>');
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/login/actions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$branches$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/branches/actions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$beauty$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/beauty/actions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$my$2d$work$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/my-work/actions.ts [app-rsc] (ecmascript)");
}),
"[project]/wt-personnel/apps/web/.next-internal/server/app/employees/[id]/profile/page/actions.js { ACTIONS_MODULE0 => \"[project]/wt-personnel/apps/web/src/app/login/actions.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE1 => \"[project]/wt-personnel/apps/web/src/app/branches/actions.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE2 => \"[project]/wt-personnel/apps/web/src/app/beauty/actions.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE3 => \"[project]/wt-personnel/apps/web/src/app/my-work/actions.ts [app-rsc] (ecmascript)\" } [app-rsc] (server actions loader, ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/login/actions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$branches$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/branches/actions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$beauty$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/beauty/actions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$my$2d$work$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/my-work/actions.ts [app-rsc] (ecmascript)");
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
}),
"[project]/wt-personnel/apps/web/src/app/beauty/actions.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/* __next_internal_action_entry_do_not_use__ [{"408a4b37b5735c79c2a08991396d665af6781ac358":{"name":"loadBeautyEmployee"},"40d9c9552c657ff715eb1a062e03f89c5a459b6c65":{"name":"loadBeautySchedule"},"60024cd99aee3db52369f0677e731d8c768b1f949a":{"name":"saveBeautyService"},"603a57df7883a1012513377566d54056cd2f08aecb":{"name":"addBeautyTimeOff"},"605f624c9a7322c12bc33ed1e961cfab5f4be3dea0":{"name":"saveBeautyEmployee"},"6082d887773a9844ea5a1473b77d9e1ea97c5aaa4e":{"name":"removeBeautyTimeOff"},"60abc013b5dbea7b8b9292befc773e2f4a40f551fa":{"name":"saveBeautyEmployeeLocations"},"60d2e1dc0926fdd743d3ba539b163deb882cc9f3f5":{"name":"saveLocationService"},"60f165aee7d984b172cdf94c6c978047cfe89fd025":{"name":"saveBeautyWorkingHours"},"7050ab9d7bca821a8252e5abfea9bd931da2158017":{"name":"assignBeautyPersonnelKind"}},"wt-personnel/apps/web/src/app/beauty/actions.ts",""] */ __turbopack_context__.s([
    "addBeautyTimeOff",
    ()=>addBeautyTimeOff,
    "assignBeautyPersonnelKind",
    ()=>assignBeautyPersonnelKind,
    "loadBeautyEmployee",
    ()=>loadBeautyEmployee,
    "loadBeautySchedule",
    ()=>loadBeautySchedule,
    "removeBeautyTimeOff",
    ()=>removeBeautyTimeOff,
    "saveBeautyEmployee",
    ()=>saveBeautyEmployee,
    "saveBeautyEmployeeLocations",
    ()=>saveBeautyEmployeeLocations,
    "saveBeautyService",
    ()=>saveBeautyService,
    "saveBeautyWorkingHours",
    ()=>saveBeautyWorkingHours,
    "saveLocationService",
    ()=>saveLocationService
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/build/webpack/loaders/next-flight-loader/server-reference.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/cache.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/api.ts [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2d$error$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/api-error.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$plural$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/plural.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-validate.js [app-rsc] (ecmascript)");
;
;
;
;
const failed = (e, fallback)=>({
        error: e instanceof __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2d$error$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ApiError"] ? e.message : fallback
    });
function text(form, key) {
    const value = form.get(key);
    return typeof value === 'string' ? value : '';
}
async function scopeError(form) {
    const expected = text(form, 'scopeKey');
    if (!expected) return null;
    try {
        const { context } = await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["authApi"].me();
        return context?.locationId === expected ? null : {
            error: 'Филиал изменён. Вернитесь к настройке текущего филиала; прежний ввод не сохранён поверх его данных.'
        };
    } catch  {
        return {
            error: 'Не удалось проверить филиал. Попробуйте ещё раз; данные формы сохранены.'
        };
    }
}
function changedBody(form, body) {
    const raw = text(form, 'changedFields');
    if (!raw) return body;
    const keys = JSON.parse(raw);
    if (!Array.isArray(keys) || keys.some((key)=>typeof key !== 'string' || !(key in body))) throw new Error('Некорректные поля изменения');
    return Object.fromEntries(keys.map((key)=>[
            key,
            body[key]
        ]));
}
async function saveBeautyService(_prev, form) {
    const id = text(form, 'id');
    const mismatch = await scopeError(form);
    if (mismatch) return mismatch;
    const body = {
        name: text(form, 'name'),
        category: text(form, 'category'),
        durationMinutes: text(form, 'durationMinutes'),
        priceMinor: text(form, 'priceMinor'),
        currency: text(form, 'currency'),
        active: form.get('active') === 'on'
    };
    try {
        const saved = id ? await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["beautyApi"].updateService(id, changedBody(form, body)) : await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["beautyApi"].createService({
            ...body,
            creationId: text(form, 'creationId') || undefined
        });
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/calendar');
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/appointments');
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/employees');
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/services');
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/customers');
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/beauty/services');
        return {
            message: id ? 'Услуга сохранена' : 'Услуга создана. Включите её в выбранном филиале ниже.',
            resourceId: saved.id
        };
    } catch (e) {
        return failed(e, 'Не удалось сохранить услугу. Обновите страницу перед повтором.');
    }
}
async function saveLocationService(_prev, form) {
    const id = text(form, 'id');
    const mismatch = await scopeError(form);
    if (mismatch) return mismatch;
    try {
        await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["beautyApi"].setLocationService(id, {
            enabled: form.get('enabled') === 'on',
            priceOverrideMinor: text(form, 'priceOverrideMinor'),
            durationOverrideMinutes: text(form, 'durationOverrideMinutes')
        });
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/calendar');
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/appointments');
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/employees');
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/services');
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/customers');
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/beauty/services');
        return {
            message: 'Настройки филиала сохранены'
        };
    } catch (e) {
        return failed(e, 'Не удалось сохранить настройки филиала.');
    }
}
async function saveBeautyEmployee(_prev, form) {
    const id = text(form, 'id');
    const mismatch = await scopeError(form);
    if (mismatch) return mismatch;
    const section = text(form, 'section') || 'all';
    let resourceId = id || _prev?.resourceId;
    let revision = text(form, 'expectedRevision') || _prev?.revision;
    let employee;
    try {
        if (section !== 'skills' && !(_prev?.resourceId && !id)) {
            const body = {
                name: text(form, 'name'),
                phone: text(form, 'phone'),
                email: text(form, 'email'),
                active: form.has('activePresent') || id ? form.get('active') === 'on' : !form.has('active') || form.get('active') === 'on'
            };
            const saved = id ? await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["beautyApi"].updateEmployee(id, {
                ...changedBody(form, body),
                ...text(form, 'expectedProfileRevision') ? {
                    expectedProfileRevision: text(form, 'expectedProfileRevision')
                } : {}
            }) : await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["beautyApi"].createEmployee({
                ...body,
                // назначение нового сотрудника выбирает руководитель в форме; старые клиенты поле не шлют
                ...isPersonnelKind(text(form, 'personnelKind')) ? {
                    personnelKind: text(form, 'personnelKind')
                } : {},
                creationId: text(form, 'creationId') || undefined
            });
            employee = saved;
            resourceId = saved.id;
            if (!id) revision = saved.servicesRevision;
        }
        if (!resourceId) return {
            error: 'Сотрудник не создан. Проверьте данные.'
        };
        const assignServices = section === 'skills' || section === 'all' && (Boolean(id) || form.has('serviceIds'));
        if (assignServices) {
            const serviceIds = form.getAll('serviceIds').filter((v)=>typeof v === 'string');
            const saved = await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["beautyApi"].setEmployeeServices(resourceId, serviceIds, revision);
            revision = saved.servicesRevision;
            employee = saved;
        }
        for (const path of [
            '/calendar',
            '/appointments',
            '/employees',
            '/services',
            '/customers',
            '/beauty/masters',
            '/register/setup'
        ])(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])(path);
        return {
            message: section === 'skills' ? 'Услуги назначены' : section === 'basic' && id ? 'Сотрудник сохранён' : assignServices ? 'Сотрудник создан, услуги назначены' : 'Сотрудник создан',
            resourceId,
            ...employee ? {
                employee
            } : {},
            ...revision ? {
                revision
            } : {}
        };
    } catch (e) {
        const current = e instanceof __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2d$error$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ApiError"] && e.status === 409 && id && section === 'basic' ? await loadBeautyEmployee(id) : null;
        const sameScope = current && (!text(form, 'scopeKey') || current.locationId === text(form, 'scopeKey'));
        return {
            ...sameScope && current.employee ? {
                currentEmployee: current.employee
            } : {},
            ...failed(e, 'Не удалось сохранить. Введённые данные оставлены в форме.'),
            ...resourceId ? {
                resourceId
            } : {},
            ...revision ? {
                revision
            } : {}
        };
    }
}
const isPersonnelKind = (value)=>value === 'SPECIALIST' || value === 'OTHER_EMPLOYEE' || value === 'BOTH';
async function assignBeautyPersonnelKind(id, personnelKind, expectedProfileRevision) {
    if (!isPersonnelKind(personnelKind)) return {
        error: 'Выберите назначение: специалист, другой сотрудник или оба.'
    };
    try {
        const employee = await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["beautyApi"].assignEmployeePersonnelKind(id, {
            personnelKind,
            expectedProfileRevision
        });
        for (const path of [
            '/employees',
            '/beauty/masters'
        ])(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])(path);
        return {
            employee
        };
    } catch (e) {
        if (e instanceof __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2d$error$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ApiError"] && e.status === 409) return {
            conflict: true,
            error: 'Сотрудника изменили в другом окне. Список обновлён, выберите назначение ещё раз.'
        };
        return failed(e, 'Не удалось сохранить назначение. Попробуйте ещё раз.');
    }
}
async function saveBeautyWorkingHours(_prev, form) {
    const id = text(form, 'id');
    const mismatch = await scopeError(form);
    if (mismatch) return mismatch;
    let intervals;
    try {
        intervals = JSON.parse(text(form, 'intervals') || '[]');
    } catch  {
        return {
            error: 'Не удалось прочитать график. Обновите страницу перед повтором.'
        };
    }
    try {
        const saved = await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["beautyApi"].setWorkingHours(id, intervals, text(form, 'expectedRevision') || undefined);
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/calendar');
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/appointments');
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/employees');
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/services');
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/customers');
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/beauty/schedule');
        return {
            message: 'График сохранён',
            ...saved.weekRevision ? {
                revision: saved.weekRevision
            } : {}
        };
    } catch (e) {
        return failed(e, 'Не удалось сохранить график. Обновите страницу перед повтором.');
    }
}
async function addBeautyTimeOff(_prev, form) {
    const id = text(form, 'id');
    try {
        const { affected } = await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["beautyApi"].addTimeOff(id, {
            dateFrom: text(form, 'dateFrom'),
            dateTo: text(form, 'dateTo'),
            reason: text(form, 'reason')
        });
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/calendar');
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/appointments');
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/employees');
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/services');
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/customers');
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/beauty/schedule');
        // записи отсутствие не отменяет: это деньги, решение владельца по Q-252 ещё не принято
        return {
            message: affected ? `Отсутствие добавлено. В эти дни у специалиста остаётся ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$plural$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["pluralRu"])(affected, [
                'запись',
                'записи',
                'записей'
            ])}: их никто не отменил.` : 'Отсутствие добавлено'
        };
    } catch (e) {
        return failed(e, 'Не удалось добавить отсутствие. Обновите страницу перед повтором.');
    }
}
async function removeBeautyTimeOff(employeeId, timeOffId) {
    try {
        await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["beautyApi"].removeTimeOff(employeeId, timeOffId);
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/calendar');
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/appointments');
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/employees');
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/services');
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/customers');
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/beauty/schedule');
        return {
            message: 'Отсутствие снято'
        };
    } catch (e) {
        return failed(e, 'Не удалось снять отсутствие. Обновите страницу перед повтором.');
    }
}
async function saveBeautyEmployeeLocations(_prev, form) {
    const id = text(form, 'id');
    // филиалы приходят одним списком: снятая галочка должна сниматься, а не копиться
    const locationIds = form.getAll('locationIds').filter((v)=>typeof v === 'string');
    try {
        await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["beautyApi"].setEmployeeLocations(id, locationIds);
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/calendar');
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/appointments');
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/employees');
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/services');
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/customers');
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/beauty/schedule');
        return {
            message: 'Филиалы специалиста сохранены'
        };
    } catch (e) {
        return failed(e, 'Не удалось сохранить филиалы специалиста.');
    }
}
async function loadBeautySchedule(employeeId) {
    try {
        return {
            data: await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["beautyApi"].schedule(employeeId)
        };
    } catch (error) {
        return {
            error: failed(error, 'Не удалось загрузить график').error ?? 'Не удалось загрузить график'
        };
    }
}
async function loadBeautyEmployee(id) {
    try {
        const data = await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["beautyApi"].employees();
        const employee = data.items.find((row)=>row.id === id);
        return employee ? {
            employee,
            locationId: data.locationId,
            error: null
        } : {
            employee: null,
            locationId: data.locationId,
            error: 'Специалист недоступен'
        };
    } catch (error) {
        return {
            employee: null,
            locationId: null,
            error: error instanceof __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2d$error$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ApiError"] ? error.message : 'Не удалось прочитать актуальные услуги'
        };
    }
}
;
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ensureServerEntryExports"])([
    saveBeautyService,
    saveLocationService,
    saveBeautyEmployee,
    assignBeautyPersonnelKind,
    saveBeautyWorkingHours,
    addBeautyTimeOff,
    removeBeautyTimeOff,
    saveBeautyEmployeeLocations,
    loadBeautySchedule,
    loadBeautyEmployee
]);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(saveBeautyService, "60024cd99aee3db52369f0677e731d8c768b1f949a", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(saveLocationService, "60d2e1dc0926fdd743d3ba539b163deb882cc9f3f5", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(saveBeautyEmployee, "605f624c9a7322c12bc33ed1e961cfab5f4be3dea0", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(assignBeautyPersonnelKind, "7050ab9d7bca821a8252e5abfea9bd931da2158017", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(saveBeautyWorkingHours, "60f165aee7d984b172cdf94c6c978047cfe89fd025", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(addBeautyTimeOff, "603a57df7883a1012513377566d54056cd2f08aecb", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(removeBeautyTimeOff, "6082d887773a9844ea5a1473b77d9e1ea97c5aaa4e", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(saveBeautyEmployeeLocations, "60abc013b5dbea7b8b9292befc773e2f4a40f551fa", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(loadBeautySchedule, "40d9c9552c657ff715eb1a062e03f89c5a459b6c65", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(loadBeautyEmployee, "408a4b37b5735c79c2a08991396d665af6781ac358", null);
}),
"[project]/wt-personnel/apps/web/src/app/branches/actions.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/* __next_internal_action_entry_do_not_use__ [{"00d659178cdba3651f0abc0c3752238282ee1e32fb":{"name":"branchChoices"},"405add4ac8b023f91674b78a847ea5caced76b052f":{"name":"selectBranch"},"40753ddf87514472ee99c5fafb3386ffe9d392dcb0":{"name":"archiveBranch"},"40977bbb3460f749b000fc17d880c3ef8caf29744c":{"name":"restoreBranch"},"40d542ea1d5de60d1be7b036e721c5a7a01febd2ca":{"name":"saveBusinessCard"},"605781dc0389026aa02cb89003d46887788e15afef":{"name":"createBranch"}},"wt-personnel/apps/web/src/app/branches/actions.ts",""] */ __turbopack_context__.s([
    "archiveBranch",
    ()=>archiveBranch,
    "branchChoices",
    ()=>branchChoices,
    "createBranch",
    ()=>createBranch,
    "restoreBranch",
    ()=>restoreBranch,
    "saveBusinessCard",
    ()=>saveBusinessCard,
    "selectBranch",
    ()=>selectBranch
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/build/webpack/loaders/next-flight-loader/server-reference.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$vertical$2d$landing$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/vertical-landing.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/cache.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$api$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/api/navigation.react-server.js [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/client/components/navigation.react-server.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/api.ts [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2d$error$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/api-error.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$branch$2d$destination$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/branch-destination.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$session$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/session.ts [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-validate.js [app-rsc] (ecmascript)");
;
;
;
;
;
;
;
async function selectBranch(form) {
    const { items } = await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["branchesApi"].list();
    const branch = items.find((item)=>item.id === String(form.get('id')));
    if (!branch) throw new Error('Филиал недоступен. Обновите список.');
    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$session$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["setScopeCookie"])(`business=${branch.location.businessId};location=${branch.locationId}`);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/', 'layout');
    // Салону гостиничный онбординг не нужен: у него нет ни объекта, ни номеров (DATA_MODEL §19)
    if (branch.vertical !== 'HOSPITALITY') {
        const destination = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$branch$2d$destination$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["branchDestination"])(String(form.get('returnTo') ?? ''));
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["redirect"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$branch$2d$destination$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SHARED_BRANCH_DESTINATIONS"].has(destination) ? destination : (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$vertical$2d$landing$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["landingForVertical"])(branch.vertical));
    }
    const destination = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$branch$2d$destination$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["branchDestination"])(String(form.get('returnTo') ?? ''));
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["redirect"])(branch._count.inventoryUnits || destination === '/hotel-settings' || destination === '/marketing/site/editor' ? destination : '/onboarding');
}
async function createBranch(_prev, form) {
    try {
        const vertical = form.get('vertical') === 'FOOD_SERVICE' ? 'FOOD_SERVICE' : form.get('vertical') === 'BEAUTY' ? 'BEAUTY' : 'HOSPITALITY';
        const businessId = String(form.get('businessId') ?? '');
        const isNew = form.get('mode') === 'BUSINESS';
        const businessName = String(form.get('businessName') ?? '').trim();
        await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["branchesApi"].create({
            id: String(form.get('id')),
            name: String(form.get('name') ?? '').trim() || (isNew ? businessName : ''),
            address: String(form.get('address') ?? ''),
            currency: String(form.get('currency') ?? ''),
            timezone: String(form.get('timezone') ?? ''),
            vertical,
            ...businessId ? {
                businessId
            } : {},
            ...isNew ? {
                businessName,
                newBusinessId: String(form.get('newBusinessId') ?? '')
            } : {}
        });
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/branches');
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/platform');
        return {
            message: vertical === 'FOOD_SERVICE' ? 'Ресторан создан. Откройте его, чтобы настроить зал и меню.' : vertical === 'BEAUTY' ? 'Салон создан. Откройте его, чтобы увидеть, что в нём уже работает.' : 'Филиал создан. Откройте его, чтобы добавить категории и номера.'
        };
    } catch (e) {
        return {
            error: e instanceof __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2d$error$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ApiError"] ? e.message : 'Не удалось сохранить. Обновите список перед повтором.'
        };
    }
}
async function branchChoices() {
    try {
        const [{ items }, me] = await Promise.all([
            __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["branchesApi"].list(),
            __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["authApi"].me()
        ]);
        const selected = items.find((item)=>item.locationId === me.context?.locationId && item.location.businessId === me.context?.businessId);
        const currentId = selected?.id ?? null;
        return {
            items: items.map(({ id, name, address, vertical })=>({
                    id,
                    name,
                    address,
                    vertical
                })),
            currentId
        };
    } catch  {
        return {
            error: 'Не удалось загрузить филиалы. Попробуйте ещё раз.'
        };
    }
}
async function saveBusinessCard(form) {
    const { businessCardsApi } = await __turbopack_context__.A("[project]/wt-personnel/apps/web/src/lib/api.ts [app-rsc] (ecmascript, async loader)");
    const id = String(form.get('businessId') ?? '');
    const payload = new FormData();
    for (const key of [
        'name',
        'description',
        'expectedUpdatedAt',
        'removeCover',
        'file'
    ]){
        const value = form.get(key);
        if (value !== null) payload.append(key, value);
    }
    try {
        const business = await businessCardsApi.save(id, payload);
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/branches');
        return {
            business
        };
    } catch (error) {
        return {
            error: error instanceof __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2d$error$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ApiError"] ? error.message : 'Не удалось сохранить карточку. Повторите попытку.'
        };
    }
}
async function archiveBranch(form) {
    try {
        const { branchLifecycleApi } = await __turbopack_context__.A("[project]/wt-personnel/apps/web/src/lib/api.ts [app-rsc] (ecmascript, async loader)");
        await branchLifecycleApi.archive(String(form.get('locationId')));
        const { clearScopeCookie } = await __turbopack_context__.A("[project]/wt-personnel/apps/web/src/lib/session.ts [app-rsc] (ecmascript, async loader)");
        await clearScopeCookie();
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/', 'layout');
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/branches');
        return {};
    } catch (error) {
        return {
            error: error instanceof __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2d$error$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ApiError"] ? error.message : 'Не удалось архивировать объект.'
        };
    }
}
async function restoreBranch(form) {
    try {
        const { branchLifecycleApi } = await __turbopack_context__.A("[project]/wt-personnel/apps/web/src/lib/api.ts [app-rsc] (ecmascript, async loader)");
        await branchLifecycleApi.restore(String(form.get('locationId')));
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/', 'layout');
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/branches');
        return {};
    } catch (error) {
        return {
            error: error instanceof __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2d$error$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ApiError"] ? error.message : 'Не удалось восстановить объект.'
        };
    }
}
;
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ensureServerEntryExports"])([
    selectBranch,
    createBranch,
    branchChoices,
    saveBusinessCard,
    archiveBranch,
    restoreBranch
]);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(selectBranch, "405add4ac8b023f91674b78a847ea5caced76b052f", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(createBranch, "605781dc0389026aa02cb89003d46887788e15afef", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(branchChoices, "00d659178cdba3651f0abc0c3752238282ee1e32fb", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(saveBusinessCard, "40d542ea1d5de60d1be7b036e721c5a7a01febd2ca", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(archiveBranch, "40753ddf87514472ee99c5fafb3386ffe9d392dcb0", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(restoreBranch, "40977bbb3460f749b000fc17d880c3ef8caf29744c", null);
}),
"[project]/wt-personnel/apps/web/src/app/my-work/actions.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/* __next_internal_action_entry_do_not_use__ [{"60335ab786e08952807d64399406b9025324d076b2":{"name":"loadPortalWeek"},"70bde5c2a7438fe8b77075f317bffd1523fe8fbb50":{"name":"removeEmployeeServicePrice"},"70d57a9256651bfa2247eb2f868fdfc181a6f42cdd":{"name":"saveEmployeeServicePrice"},"789065d3d232e1a26a03316ef24c10ad4d389f7ac3":{"name":"savePortal"}},"wt-personnel/apps/web/src/app/my-work/actions.ts",""] */ __turbopack_context__.s([
    "loadPortalWeek",
    ()=>loadPortalWeek,
    "removeEmployeeServicePrice",
    ()=>removeEmployeeServicePrice,
    "saveEmployeeServicePrice",
    ()=>saveEmployeeServicePrice,
    "savePortal",
    ()=>savePortal
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/build/webpack/loaders/next-flight-loader/server-reference.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/cache.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$api$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/api/navigation.react-server.js [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/client/components/navigation.react-server.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$index$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/index.ts [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$finance$2f$finance$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/finance/finance.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$restaurant$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/food/restaurant.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$beauty$2f$schedule$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/beauty/schedule.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$employee$2d$portal$2d$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/employee-portal-api.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$scope$2d$pointer$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/scope-pointer.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2d$error$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/api-error.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/api.ts [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$money$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/money.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-validate.js [app-rsc] (ecmascript)");
;
;
;
;
;
;
;
;
;
const text = (form, key)=>String(form.get(key) ?? '').trim();
const checked = (form, key)=>form.get(key) === 'on';
const managerCommands = new Set([
    'publication',
    'account',
    'unlink',
    'pay',
    'pay-policy',
    'active'
]);
async function savePortal(target, scope, command, form) {
    try {
        const currentScope = (await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$scope$2d$pointer$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["requestScopeHeader"])())['x-wetop-scope'] ?? '';
        if (scope !== currentScope) return {
            error: 'Филиал изменился. Откройте карточку заново; ввод сохранён.'
        };
        const current = await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$employee$2d$portal$2d$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["employeePortalApi"].load(target);
        if (managerCommands.has(command) && current.access !== 'MANAGER') return {
            error: 'Эту настройку меняет руководитель.'
        };
        const revision = text(form, 'expectedRevision');
        let data;
        switch(command){
            case 'profile':
                if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(text(form, 'expectedProfileRevision'))) return {
                    error: 'Исходная версия профиля отсутствует. Загрузите актуальные данные; ввод сохранён.'
                };
                data = await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$employee$2d$portal$2d$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["employeePortalApi"].profile(target, {
                    name: text(form, 'name'),
                    phone: text(form, 'phone') || null,
                    email: text(form, 'email') || null,
                    headline: text(form, 'headline'),
                    biography: text(form, 'biography'),
                    practiceSinceYear: text(form, 'practiceSinceYear') ? Number(text(form, 'practiceSinceYear')) : null,
                    expectedRevision: revision,
                    expectedProfileRevision: text(form, 'expectedProfileRevision')
                });
                break;
            case 'avatar':
            case 'add-work':
                {
                    const file = form.get('file');
                    if (!(file instanceof File) || !file.size) return {
                        error: 'Выберите изображение.'
                    };
                    if (![
                        'image/jpeg',
                        'image/png',
                        'image/webp'
                    ].includes(file.type) || file.size > 5 * 1024 * 1024) return {
                        error: 'Нужно JPG, PNG или WebP до 5 МиБ.'
                    };
                    const upload = new FormData();
                    upload.set('file', file);
                    if (command === 'add-work') {
                        upload.set('title', text(form, 'title'));
                        upload.set('description', text(form, 'description'));
                        if (text(form, 'serviceId')) upload.set('serviceId', text(form, 'serviceId'));
                        upload.set('publicationConsent', String(checked(form, 'publicationConsent')));
                        upload.set('published', String(current.access === 'MANAGER' && checked(form, 'published')));
                    }
                    data = command === 'avatar' ? await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$employee$2d$portal$2d$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["employeePortalApi"].avatar(target, upload) : await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$employee$2d$portal$2d$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["employeePortalApi"].addWork(target, upload);
                    break;
                }
            case 'remove-avatar':
                data = await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$employee$2d$portal$2d$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["employeePortalApi"].removeAvatar(target);
                break;
            case 'work':
                data = await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$employee$2d$portal$2d$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["employeePortalApi"].work(target, text(form, 'workId'), {
                    title: text(form, 'title'),
                    description: text(form, 'description'),
                    serviceId: text(form, 'serviceId') || null,
                    publicationConsent: checked(form, 'publicationConsent'),
                    published: current.access === 'MANAGER' && checked(form, 'published')
                });
                break;
            case 'remove-work':
                data = await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$employee$2d$portal$2d$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["employeePortalApi"].removeWork(target, text(form, 'workId'));
                break;
            case 'publication':
                data = await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$employee$2d$portal$2d$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["employeePortalApi"].publication(target, {
                    published: checked(form, 'published'),
                    publicationConsent: checked(form, 'publicationConsent'),
                    expectedRevision: revision
                });
                break;
            case 'services':
                data = await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$employee$2d$portal$2d$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["employeePortalApi"].services(target, form.getAll('serviceIds').map(String), revision);
                break;
            case 'week':
                {
                    const raw = JSON.parse(text(form, 'intervals'));
                    const parsed = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$beauty$2f$schedule$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["parseWorkingHoursWeek"])({
                        intervals: raw
                    });
                    if (!parsed.ok) return {
                        error: parsed.reason
                    };
                    data = await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$employee$2d$portal$2d$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["employeePortalApi"].week(target, parsed.value, revision);
                    break;
                }
            case 'time-off':
                {
                    const input = {
                        dateFrom: text(form, 'dateFrom'),
                        dateTo: text(form, 'dateTo'),
                        reason: text(form, 'reason')
                    };
                    const parsed = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$beauty$2f$schedule$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["parseTimeOffInput"])(input);
                    if (!parsed.ok) return {
                        error: parsed.reason
                    };
                    data = await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$employee$2d$portal$2d$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["employeePortalApi"].timeOff(target, input);
                    break;
                }
            case 'remove-time-off':
                data = await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$employee$2d$portal$2d$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["employeePortalApi"].removeTimeOff(target, text(form, 'timeOffId'));
                break;
            case 'account':
                {
                    const userId = text(form, 'userId');
                    if (!/^[0-9a-f-]{36}$/i.test(userId)) return {
                        error: 'Выберите подтверждённого участника команды. Идентификатор не создаёт аккаунт.'
                    };
                    data = await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$employee$2d$portal$2d$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["employeePortalApi"].account(target, userId);
                    break;
                }
            case 'unlink':
                data = await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$employee$2d$portal$2d$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["employeePortalApi"].unlink(target);
                break;
            case 'pay':
                {
                    let fixedMinor;
                    try {
                        fixedMinor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$finance$2f$finance$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["parseMoney"])(text(form, 'fixedAmount').replace(/\s/g, ''));
                    } catch  {
                        return {
                            error: 'Введите фиксированную ставку, не больше двух знаков после запятой.'
                        };
                    }
                    if (fixedMinor < 0n || fixedMinor > BigInt(Number.MAX_SAFE_INTEGER)) return {
                        error: 'Введите допустимую фиксированную ставку.'
                    };
                    const input = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$food$2f$restaurant$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["parsePaySettings"])({
                        model: text(form, 'model'),
                        fixedMinor: Number(fixedMinor),
                        percent: Number(text(form, 'percent'))
                    });
                    data = await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$employee$2d$portal$2d$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["employeePortalApi"].pay(target, {
                        ...input,
                        fixedMinor: input.fixedMinor.toString()
                    });
                    break;
                }
            case 'pay-policy':
                {
                    const basis = text(form, 'percentBasis');
                    if (basis !== 'COMPLETED_SERVICES' && basis !== 'PAID_COMPLETED_SERVICES') return {
                        error: 'Выберите базу процента.'
                    };
                    await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$employee$2d$portal$2d$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["employeePortalApi"].payPolicy(basis, revision || undefined);
                    data = await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$employee$2d$portal$2d$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["employeePortalApi"].load(target);
                    break;
                }
            case 'active':
                {
                    // E5 (паритет с zapis.kz): «В архив / Вернуть» из карточки; право employees.update проверяет API
                    await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["beautyApi"].updateEmployee(current.employee.id, {
                        active: text(form, 'active') === 'true'
                    });
                    data = await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$employee$2d$portal$2d$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["employeePortalApi"].load(target);
                    break;
                }
            default:
                return {
                    error: 'Неизвестное действие.'
                };
        }
        return {
            data
        };
    } catch (error) {
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["unstable_rethrow"])(error);
        return {
            error: error instanceof __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2d$error$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ApiError"] && error.status < 500 ? error.message : 'Не удалось подтвердить сохранение. Ввод сохранён. Проверьте результат перед повтором.'
        };
    }
}
async function loadPortalWeek(target, scope) {
    try {
        if (scope !== ((await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$scope$2d$pointer$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["requestScopeHeader"])())['x-wetop-scope'] ?? '')) return {
            error: 'Филиал изменился. Откройте карточку заново.'
        };
        return {
            data: await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$employee$2d$portal$2d$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["employeePortalApi"].load(target)
        };
    } catch (error) {
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["unstable_rethrow"])(error);
        return {
            error: 'Не удалось перечитать график. Ваш ввод сохранён.'
        };
    }
}
const employeePriceTypes = new Set([
    'FIXED',
    'RANGE',
    'FREE',
    'UNFIXED'
]);
async function servicePriceScopeChanged(scope) {
    return scope !== ((await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$scope$2d$pointer$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["requestScopeHeader"])())['x-wetop-scope'] ?? '');
}
function servicePriceError(error) {
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["unstable_rethrow"])(error);
    return {
        error: error instanceof __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2d$error$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ApiError"] && error.status < 500 ? error.message : 'Не удалось подтвердить сохранение. Ввод сохранён. Проверьте результат перед повтором.'
    };
}
async function saveEmployeeServicePrice(employeeId, scope, form) {
    try {
        if (await servicePriceScopeChanged(scope)) {
            return {
                error: 'Филиал изменился. Откройте карточку заново; ввод сохранён.'
            };
        }
        const serviceId = text(form, 'serviceId');
        const priceType = text(form, 'priceType');
        const expectedRevision = Number(text(form, 'expectedRevision'));
        const durationMinutes = Number(text(form, 'durationMinutes'));
        const currency = text(form, 'currency').toUpperCase();
        if (!/^[0-9a-f-]{36}$/i.test(employeeId) || !/^[0-9a-f-]{36}$/i.test(serviceId)) {
            return {
                error: 'Услуга или мастер не найдены.'
            };
        }
        if (!employeePriceTypes.has(priceType)) return {
            error: 'Выберите тип цены.'
        };
        if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
            return {
                error: 'Версия цены устарела. Перезагрузите карточку.'
            };
        }
        if (!Number.isInteger(durationMinutes) || durationMinutes <= 0 || durationMinutes > 1440) {
            return {
                error: 'Укажите длительность от 1 до 1440 минут.'
            };
        }
        if (!/^[A-Z]{3}$/.test(currency)) return {
            error: 'Валюта услуги не определена.'
        };
        let priceMinMinor = null;
        let priceMaxMinor = null;
        if (priceType === 'FREE') {
            priceMinMinor = '0';
            priceMaxMinor = '0';
        } else if (priceType === 'FIXED' || priceType === 'RANGE') {
            const min = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$money$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["inputToMinor"])(text(form, 'priceMin'));
            const max = priceType === 'RANGE' ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$money$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["inputToMinor"])(text(form, 'priceMax')) : min;
            if (min === null || min === '' || max === null || max === '') {
                return {
                    error: 'Введите цену, не больше двух знаков после запятой.'
                };
            }
            if (BigInt(max) < BigInt(min)) return {
                error: 'Максимальная цена должна быть не меньше минимальной.'
            };
            priceMinMinor = min;
            priceMaxMinor = max;
        }
        const items = await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["beautyApi"].setEmployeeServicePrice(employeeId, serviceId, {
            expectedRevision,
            priceType,
            priceMinMinor,
            priceMaxMinor,
            durationMinutes,
            currency
        });
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])(`/employees/${employeeId}/profile`);
        return {
            items,
            error: null
        };
    } catch (error) {
        return servicePriceError(error);
    }
}
async function removeEmployeeServicePrice(employeeId, scope, form) {
    try {
        if (await servicePriceScopeChanged(scope)) {
            return {
                error: 'Филиал изменился. Откройте карточку заново.'
            };
        }
        const serviceId = text(form, 'serviceId');
        const expectedRevision = Number(text(form, 'expectedRevision'));
        if (!/^[0-9a-f-]{36}$/i.test(employeeId) || !/^[0-9a-f-]{36}$/i.test(serviceId)) {
            return {
                error: 'Услуга или мастер не найдены.'
            };
        }
        if (!Number.isInteger(expectedRevision) || expectedRevision <= 0) {
            return {
                error: 'Своя цена мастера ещё не сохранена.'
            };
        }
        const items = await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["beautyApi"].removeEmployeeServicePrice(employeeId, serviceId, {
            expectedRevision
        });
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])(`/employees/${employeeId}/profile`);
        return {
            items,
            error: null
        };
    } catch (error) {
        return servicePriceError(error);
    }
}
;
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ensureServerEntryExports"])([
    savePortal,
    loadPortalWeek,
    saveEmployeeServicePrice,
    removeEmployeeServicePrice
]);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(savePortal, "789065d3d232e1a26a03316ef24c10ad4d389f7ac3", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(loadPortalWeek, "60335ab786e08952807d64399406b9025324d076b2", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(saveEmployeeServicePrice, "70d57a9256651bfa2247eb2f868fdfc181a6f42cdd", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(removeEmployeeServicePrice, "70bde5c2a7438fe8b77075f317bffd1523fe8fbb50", null);
}),
"[project]/wt-personnel/apps/web/src/lib/branch-destination.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SHARED_BRANCH_DESTINATIONS",
    ()=>SHARED_BRANCH_DESTINATIONS,
    "branchDestination",
    ()=>branchDestination
]);
/** Only collection routes survive a branch switch. Object IDs and query filters belong to the old branch. */ const pages = new Set([
    '/today',
    '/chessboard',
    '/reservations',
    '/guests',
    '/inventory',
    '/rooms',
    '/rooms/categories',
    '/rooms/availability',
    '/finance',
    '/management/analytics',
    '/management/analytics/occupancy',
    '/management/analytics/units',
    '/management/analytics/channels',
    '/channels',
    '/channels/connections',
    '/channels/mapping',
    '/channels/sync',
    '/channels/events',
    '/hotel-settings',
    '/hotel-settings/stay',
    '/hotel-settings/services',
    '/hotel-settings/directories',
    '/team',
    '/connections',
    '/incidents',
    '/journal',
    '/ai-agents',
    '/ai-seller',
    '/website',
    // SITE-1: выбор филиала на экране «Сайт и SEO» переключает стойку тем же действием и остаётся на экране
    '/marketing/site/editor',
    '/branches',
    '/platform'
]);
const SHARED_BRANCH_DESTINATIONS = new Set([
    '/management/analytics',
    '/marketing/site/editor'
]);
function branchDestination(value) {
    const path = value.split(/[?#]/, 1)[0] ?? '';
    if (pages.has(path)) return path;
    for (const root of [
        '/reservations',
        '/guests',
        '/ai-agents',
        '/ai-seller',
        '/website'
    ]){
        if (path.startsWith(`${root}/`)) return root;
    }
    return path.startsWith('/units/') ? '/inventory' : '/today';
}
}),
"[project]/wt-personnel/apps/web/src/lib/employee-portal-api.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "employeePortalApi",
    ()=>employeePortalApi,
    "publicEmployee",
    ()=>publicEmployee
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/api.ts [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2d$error$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/api-error.ts [app-rsc] (ecmascript)");
;
;
;
const base = (target)=>target.employeeId ? `/employee-portal/employees/${encodeURIComponent(target.employeeId)}` : '/employee-portal/me';
const employeePortalApi = {
    load: (target, query = {})=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["portalTransport"])(`${base(target)}?${new URLSearchParams(query)}`),
    profile: (target, input)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["portalTransport"])(`${base(target)}/profile`, 'PATCH', input),
    avatar: (target, form)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["portalTransport"])(`${base(target)}/avatar`, 'PUT', form),
    removeAvatar: (target)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["portalTransport"])(`${base(target)}/avatar`, 'DELETE'),
    addWork: (target, form)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["portalTransport"])(`${base(target)}/portfolio`, 'POST', form),
    work: (target, id, input)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["portalTransport"])(`${base(target)}/portfolio/${encodeURIComponent(id)}`, 'PATCH', input),
    removeWork: (target, id)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["portalTransport"])(`${base(target)}/portfolio/${encodeURIComponent(id)}`, 'DELETE'),
    publication: (target, input)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["portalTransport"])(`${base(target)}/publication`, 'PUT', input),
    services: (target, serviceIds, expectedRevision)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["portalTransport"])(`${base(target)}/services`, 'PUT', {
            serviceIds,
            expectedRevision
        }),
    week: (target, intervals, expectedRevision)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["portalTransport"])(`${base(target)}/week`, 'PUT', {
            intervals,
            expectedRevision
        }),
    timeOff: (target, input)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["portalTransport"])(`${base(target)}/time-offs`, 'POST', input),
    removeTimeOff: (target, id)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["portalTransport"])(`${base(target)}/time-offs/${encodeURIComponent(id)}`, 'DELETE'),
    account: (target, userId)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["portalTransport"])(`${base(target)}/account`, 'PUT', {
            userId
        }),
    accountOptions: (employeeId)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["portalTransport"])(`/employee-portal/employees/${encodeURIComponent(employeeId)}/account-options`),
    unlink: (target)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["portalTransport"])(`${base(target)}/account`, 'DELETE'),
    pay: (target, input)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["portalTransport"])(`${base(target)}/pay-settings`, 'PUT', input),
    payPolicy: (percentBasis, expectedRevision)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["portalTransport"])('/employee-portal/pay-policy', 'PUT', {
            percentBasis,
            ...expectedRevision ? {
                expectedRevision
            } : {}
        })
};
async function publicEmployee(slug, locationId) {
    const endpoint = process.env.APP_API_URL?.trim() || 'http://127.0.0.1:3001';
    const url = `${endpoint.replace(/\/$/, '')}/employee-portal/public/${encodeURIComponent(slug)}${locationId ? `?${new URLSearchParams({
        locationId
    })}` : ''}`;
    let response;
    try {
        response = await fetch(url, {
            cache: 'no-store',
            signal: AbortSignal.timeout(60_000)
        });
    } catch (error) {
        if (!(error instanceof TypeError || error instanceof DOMException)) throw error;
        throw new __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2d$error$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ApiError"](503, 'Страница специалиста временно недоступна.');
    }
    if (!response.ok) throw new __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2d$error$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ApiError"](response.status, response.status === 404 ? 'Специалист не найден или страница ещё не опубликована.' : 'Страница специалиста временно недоступна.');
    return response.json();
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
];

//# sourceMappingURL=wt-personnel_apps_web_116kmj3._.js.map