module.exports = [
"[project]/wt-personnel/apps/web/.next-internal/server/app/calendar/page/actions.js { ACTIONS_MODULE0 => \"[project]/wt-personnel/apps/web/src/app/login/actions.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE1 => \"[project]/wt-personnel/apps/web/src/app/branches/actions.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE2 => \"[project]/wt-personnel/apps/web/src/app/beauty/journal-actions.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE3 => \"[project]/wt-personnel/apps/web/src/app/beauty/review-invitation-actions.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE4 => \"[project]/wt-personnel/apps/web/src/app/beauty/appointment-history-actions.ts [app-rsc] (ecmascript)\" } [app-rsc] (server actions loader, ecmascript)", ((__turbopack_context__) => {
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
    "40a28645f8383dc9db60c5ad7c833791c6e6b74105",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["verifyEmailAction"],
    "40a3ec6082c769cd822baf77c3181fca96da306c5b",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["acceptInviteAction"],
    "40b40b535b4ee73667ff5a6be11164a285b559119f",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revokeInviteAction"],
    "600306e4b8fc469ae462106fea7cd1bad17e29583a",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$beauty$2f$appointment$2d$history$2d$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["loadAppointmentHistory"],
    "60274aaa6bd31e13c03d12280d9550a04fc7ec5972",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["setPassword"],
    "60453c707f49adaf442cd5f64c74b70a7df62a85d4",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$beauty$2f$journal$2d$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["setAppointmentStatus"],
    "607a392fa69b3d4a29e31af337631be9cfc424d61f",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["signIn"],
    "609df8f3d7d01cb388f2511215cd8d3ff71a51191e",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["resendVerification"],
    "60a0b4cd0b0b8e7c0b68d376f3c00a8694456a5154",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$beauty$2f$review$2d$invitation$2d$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["issueReviewInvitation"],
    "60b6c9bb4ab18d132b8ff40aeb76415996a8f938d1",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["setMemberRoleAction"],
    "60bc72f7bf447dd06da926e8743f6c4c884c4e36c0",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$beauty$2f$journal$2d$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["moveAppointment"],
    "60d33ca0bd2451452b775a43114684280eba03929f",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["requestReset"],
    "60d6dad01fad7c72ba12e4e980375acfcf0fb6a8a6",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["setMemberSuspendedAction"],
    "60ecd91b92602c04ec5a4678d18c343b4ff5b3e6b9",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$beauty$2f$journal$2d$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createAppointment"],
    "70434b18000c0934031866abd06e2b7ab54ab1984c",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["setMemberDetailsAction"],
    "70bc37ace9ff75b5dccdab8c6b420c7a47982d224f",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["setMemberScopesAction"],
    "7848c45355db0e16ec95579f5efb01a5bc2f409bfa",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["resendInviteAction"],
    "788dbe579ef7d0651d364161ab4e558c1fec3fc0ce",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["inviteAction"],
    "7c3545b90d36dddc0f55861aa8c5cf06c34730d6e5",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$beauty$2f$journal$2d$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["payAppointment"],
    "7ee719386a2a7db5588bf3b9f5caa5275dc5a33a46",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$beauty$2f$journal$2d$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["refundAppointment"]
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f2e$next$2d$internal$2f$server$2f$app$2f$calendar$2f$page$2f$actions$2e$js__$7b$__ACTIONS_MODULE0__$3d3e$__$225b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE1__$3d3e$__$225b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$branches$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE2__$3d3e$__$225b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$beauty$2f$journal$2d$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE3__$3d3e$__$225b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$beauty$2f$review$2d$invitation$2d$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE4__$3d3e$__$225b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$beauty$2f$appointment$2d$history$2d$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$2922$__$7d$__$5b$app$2d$rsc$5d$__$28$server__actions__loader$2c$__ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i('[project]/wt-personnel/apps/web/.next-internal/server/app/calendar/page/actions.js { ACTIONS_MODULE0 => "[project]/wt-personnel/apps/web/src/app/login/actions.ts [app-rsc] (ecmascript)", ACTIONS_MODULE1 => "[project]/wt-personnel/apps/web/src/app/branches/actions.ts [app-rsc] (ecmascript)", ACTIONS_MODULE2 => "[project]/wt-personnel/apps/web/src/app/beauty/journal-actions.ts [app-rsc] (ecmascript)", ACTIONS_MODULE3 => "[project]/wt-personnel/apps/web/src/app/beauty/review-invitation-actions.ts [app-rsc] (ecmascript)", ACTIONS_MODULE4 => "[project]/wt-personnel/apps/web/src/app/beauty/appointment-history-actions.ts [app-rsc] (ecmascript)" } [app-rsc] (server actions loader, ecmascript) <locals>');
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/login/actions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$branches$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/branches/actions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$beauty$2f$journal$2d$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/beauty/journal-actions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$beauty$2f$review$2d$invitation$2d$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/beauty/review-invitation-actions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$beauty$2f$appointment$2d$history$2d$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/beauty/appointment-history-actions.ts [app-rsc] (ecmascript)");
}),
"[project]/wt-personnel/apps/web/.next-internal/server/app/calendar/page/actions.js { ACTIONS_MODULE0 => \"[project]/wt-personnel/apps/web/src/app/login/actions.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE1 => \"[project]/wt-personnel/apps/web/src/app/branches/actions.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE2 => \"[project]/wt-personnel/apps/web/src/app/beauty/journal-actions.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE3 => \"[project]/wt-personnel/apps/web/src/app/beauty/review-invitation-actions.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE4 => \"[project]/wt-personnel/apps/web/src/app/beauty/appointment-history-actions.ts [app-rsc] (ecmascript)\" } [app-rsc] (server actions loader, ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/login/actions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$branches$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/branches/actions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$beauty$2f$journal$2d$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/beauty/journal-actions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$beauty$2f$review$2d$invitation$2d$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/beauty/review-invitation-actions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$beauty$2f$appointment$2d$history$2d$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/beauty/appointment-history-actions.ts [app-rsc] (ecmascript)");
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
;
;
;
;
;
;
;
}),
"[project]/wt-personnel/apps/web/src/app/beauty/appointment-history-actions.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/* __next_internal_action_entry_do_not_use__ [{"600306e4b8fc469ae462106fea7cd1bad17e29583a":{"name":"loadAppointmentHistory"}},"wt-personnel/apps/web/src/app/beauty/appointment-history-actions.ts",""] */ __turbopack_context__.s([
    "loadAppointmentHistory",
    ()=>loadAppointmentHistory
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/build/webpack/loaders/next-flight-loader/server-reference.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/api.ts [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2d$error$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/api-error.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-validate.js [app-rsc] (ecmascript)");
;
;
async function loadAppointmentHistory(id, scopeKey) {
    try {
        const expected = JSON.parse(scopeKey);
        const me = await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["authApi"].me();
        if (!expected.organizationId || !expected.businessId || !expected.locationId || me.user?.organizationId !== expected.organizationId || me.context?.businessId !== expected.businessId || me.context?.locationId !== expected.locationId) {
            return {
                error: 'Контекст изменён. Откройте запись в нужном филиале.'
            };
        }
        return {
            history: await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["beautyApi"].appointmentHistory(id)
        };
    } catch (error) {
        return {
            error: error instanceof __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2d$error$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ApiError"] ? error.message : 'Не удалось загрузить историю записи.'
        };
    }
}
;
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ensureServerEntryExports"])([
    loadAppointmentHistory
]);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(loadAppointmentHistory, "600306e4b8fc469ae462106fea7cd1bad17e29583a", null);
}),
"[project]/wt-personnel/apps/web/src/app/beauty/journal-actions.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/* __next_internal_action_entry_do_not_use__ [{"60453c707f49adaf442cd5f64c74b70a7df62a85d4":{"name":"setAppointmentStatus"},"60bc72f7bf447dd06da926e8743f6c4c884c4e36c0":{"name":"moveAppointment"},"60ecd91b92602c04ec5a4678d18c343b4ff5b3e6b9":{"name":"createAppointment"},"7c3545b90d36dddc0f55861aa8c5cf06c34730d6e5":{"name":"payAppointment"},"7ee719386a2a7db5588bf3b9f5caa5275dc5a33a46":{"name":"refundAppointment"}},"wt-personnel/apps/web/src/app/beauty/journal-actions.ts",""] */ __turbopack_context__.s([
    "createAppointment",
    ()=>createAppointment,
    "moveAppointment",
    ()=>moveAppointment,
    "payAppointment",
    ()=>payAppointment,
    "refundAppointment",
    ()=>refundAppointment,
    "setAppointmentStatus",
    ()=>setAppointmentStatus
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/build/webpack/loaders/next-flight-loader/server-reference.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/cache.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/api.ts [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2d$error$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/api-error.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-validate.js [app-rsc] (ecmascript)");
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
async function createAppointment(_prev, form) {
    // The initial scope is a guard, never an authority. API still checks all permissions.
    try {
        const expected = JSON.parse(text(form, 'scopeKey'));
        const me = await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["authApi"].me();
        if (!expected.organizationId || !expected.businessId || !expected.locationId || me.user?.organizationId !== expected.organizationId || me.context?.businessId !== expected.businessId || me.context?.locationId !== expected.locationId) return {
            outcome: 'rejected',
            error: 'Контекст изменён. Закройте старую форму и откройте запись в нужном филиале. Ввод сохранён.'
        };
    } catch  {
        return {
            outcome: 'rejected',
            error: 'Не удалось проверить исходный контекст. Ввод сохранён, команда не отправлена.'
        };
    }
    let selection = {
        employeeId: text(form, 'employeeId'),
        serviceId: text(form, 'serviceId')
    };
    if (form.has('items')) {
        try {
            const items = JSON.parse(text(form, 'items'));
            if (!Array.isArray(items) || !items.length || items.some((item)=>!item || typeof item !== 'object' || typeof item.employeeId !== 'string' || !item.employeeId || typeof item.serviceId !== 'string' || !item.serviceId)) throw new Error('items');
            selection = {
                items
            };
        } catch  {
            return {
                outcome: 'rejected',
                error: 'Проверьте список услуг и мастеров. Ввод сохранён, команда не отправлена.'
            };
        }
    }
    try {
        const saved = await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["beautyApi"].createAppointment({
            ...selection,
            startsAt: text(form, 'startsAt'),
            customerId: text(form, 'customerId'),
            firstName: text(form, 'firstName'),
            lastName: text(form, 'lastName'),
            phone: text(form, 'phone'),
            notes: text(form, 'notes')
        });
        if (!saved?.appointments?.some((row)=>typeof row.id === 'string' && row.id)) return {
            outcome: 'unknown',
            error: 'Результат не подтверждён. Проверьте список записей перед повторным созданием.'
        };
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/calendar');
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/appointments');
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/employees');
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/services');
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/customers');
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/beauty');
        return {
            message: 'Запись создана'
        };
    } catch (e) {
        return e instanceof __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2d$error$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ApiError"] && e.status >= 400 && e.status < 500 ? {
            outcome: 'rejected',
            error: e.message
        } : {
            outcome: 'unknown',
            error: 'Результат не подтверждён. Проверьте список записей перед повторным созданием. Автоматического повтора нет.'
        };
    }
}
async function moveAppointment(_prev, form) {
    try {
        let changes = {
            employeeId: text(form, 'employeeId')
        };
        if (form.has('items')) {
            const items = JSON.parse(text(form, 'items'));
            if (!Array.isArray(items) || !items.length || items.some((item)=>!item || typeof item !== 'object' || !item.employeeId || !item.serviceId)) return {
                outcome: 'rejected',
                error: 'Проверьте услуги и мастеров.'
            };
            changes = {
                items,
                notes: text(form, 'notes')
            };
        }
        await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["beautyApi"].moveAppointment(text(form, 'id'), {
            ...changes,
            startsAt: text(form, 'startsAt')
        });
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/calendar');
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/appointments');
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/employees');
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/services');
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/customers');
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/beauty');
        return {
            message: 'Запись перенесена'
        };
    } catch (e) {
        return failed(e, 'Не удалось перенести запись.');
    }
}
// Stale-form guard only. API remains the authority for organization/permissions.
async function moneyScopeMatches(scope) {
    try {
        const expected = JSON.parse(scope);
        const me = await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["authApi"].me();
        return Boolean(expected.organizationId && expected.businessId && expected.locationId && me.user?.organizationId === expected.organizationId && me.context?.businessId === expected.businessId && me.context?.locationId === expected.locationId);
    } catch  {
        return false;
    }
}
const unknownMoneyResult = ()=>({
        outcome: 'unknown',
        error: 'Результат операции не подтверждён. Не создавайте новую оплату или возврат. Повторите ту же операцию либо сверьте историю и кассу.'
    });
function moneyRevalidate() {
    try {
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/calendar');
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/appointments');
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/cashbox');
    } catch  {
    // API already confirmed the mutation. A cache failure is not a failed payment.
    }
}
async function payAppointment(id, method, amountMinor, idempotencyKey, scope) {
    if (!await moneyScopeMatches(scope)) return {
        outcome: 'rejected',
        error: 'Не удалось подтвердить исходный филиал. Команда не отправлена.'
    };
    try {
        const saved = await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["beautyApi"].payAppointment(id, {
            method,
            amount: amountMinor,
            idempotencyKey
        });
        if (!Array.isArray(saved?.appointments) || !saved.appointments.some((row)=>row.id === id)) return unknownMoneyResult();
        moneyRevalidate();
        return {
            message: 'Оплата принята'
        };
    } catch  {
        return unknownMoneyResult();
    }
}
async function refundAppointment(id, method, amountMinor, reason, idempotencyKey, scope) {
    if (!await moneyScopeMatches(scope)) return {
        outcome: 'rejected',
        error: 'Не удалось подтвердить исходный филиал. Команда не отправлена.'
    };
    try {
        const saved = await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["beautyApi"].refundAppointment(id, {
            method,
            amount: amountMinor,
            reason,
            idempotencyKey
        });
        if (!Array.isArray(saved?.appointments) || !saved.appointments.some((row)=>row.id === id)) return unknownMoneyResult();
        moneyRevalidate();
        return {
            message: 'Возврат оформлен'
        };
    } catch  {
        return unknownMoneyResult();
    }
}
async function setAppointmentStatus(id, status) {
    try {
        await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["beautyApi"].setAppointmentStatus(id, status);
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/calendar');
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/appointments');
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/employees');
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/services');
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/customers');
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/beauty');
        return {
            message: 'Состояние записи изменено'
        };
    } catch (e) {
        return failed(e, 'Не удалось изменить состояние записи.');
    }
}
;
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ensureServerEntryExports"])([
    createAppointment,
    moveAppointment,
    payAppointment,
    refundAppointment,
    setAppointmentStatus
]);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(createAppointment, "60ecd91b92602c04ec5a4678d18c343b4ff5b3e6b9", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(moveAppointment, "60bc72f7bf447dd06da926e8743f6c4c884c4e36c0", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(payAppointment, "7c3545b90d36dddc0f55861aa8c5cf06c34730d6e5", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(refundAppointment, "7ee719386a2a7db5588bf3b9f5caa5275dc5a33a46", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(setAppointmentStatus, "60453c707f49adaf442cd5f64c74b70a7df62a85d4", null);
}),
"[project]/wt-personnel/apps/web/src/app/beauty/review-invitation-actions.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/* __next_internal_action_entry_do_not_use__ [{"60a0b4cd0b0b8e7c0b68d376f3c00a8694456a5154":{"name":"issueReviewInvitation"}},"wt-personnel/apps/web/src/app/beauty/review-invitation-actions.ts",""] */ __turbopack_context__.s([
    "issueReviewInvitation",
    ()=>issueReviewInvitation
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/build/webpack/loaders/next-flight-loader/server-reference.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$api$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/api/navigation.react-server.js [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/client/components/navigation.react-server.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/api.ts [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2d$error$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/api-error.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-validate.js [app-rsc] (ecmascript)");
;
;
;
async function issueReviewInvitation(_previous, form) {
    try {
        const expected = JSON.parse(String(form.get('scopeKey') ?? ''));
        const me = await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["authApi"].me();
        if (!expected.organizationId || !expected.businessId || !expected.locationId || me.user?.organizationId !== expected.organizationId || me.context?.businessId !== expected.businessId || me.context?.locationId !== expected.locationId) return {
            error: 'Контекст изменён. Откройте запись в нужном филиале.'
        };
        return {
            invitation: await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["beautyApi"].issueReviewInvitation(String(form.get('appointmentId') ?? ''))
        };
    } catch (error) {
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["unstable_rethrow"])(error);
        return {
            error: error instanceof __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2d$error$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ApiError"] ? error.message : 'Не удалось создать ссылку на отзыв.'
        };
    }
}
;
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ensureServerEntryExports"])([
    issueReviewInvitation
]);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(issueReviewInvitation, "60a0b4cd0b0b8e7c0b68d376f3c00a8694456a5154", null);
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
];

//# sourceMappingURL=wt-personnel_apps_web_1asl03v._.js.map