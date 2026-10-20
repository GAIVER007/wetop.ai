module.exports = [
"[project]/wt-personnel/apps/web/.next-internal/server/app/marketing/budget/page/actions.js { ACTIONS_MODULE0 => \"[project]/wt-personnel/apps/web/src/app/login/actions.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE1 => \"[project]/wt-personnel/apps/web/src/app/branches/actions.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE2 => \"[project]/wt-personnel/apps/web/src/app/marketing/budget/actions.ts [app-rsc] (ecmascript)\" } [app-rsc] (server actions loader, ecmascript)", ((__turbopack_context__) => {
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
    "60181a9d8b0f32d1f15904ab89ef0930413ee6a5e0",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$budget$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["saveExpenseAction"],
    "60274aaa6bd31e13c03d12280d9550a04fc7ec5972",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["setPassword"],
    "602f8efae5c43bb8cfc45ca60642b137f8201cc405",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$budget$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["savePlanAction"],
    "603ae98ee7ea3576f9a1b537ee3a5d6bb8077005f8",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$budget$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["saveLinesAction"],
    "604e119ca51fe0ee16c621e392da54eae43bfa43c6",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$budget$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["uploadExpenseFileAction"],
    "60556650b75a0931da8b9aa25b86fbcceab16148b8",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$budget$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["importExpensesAction"],
    "607a392fa69b3d4a29e31af337631be9cfc424d61f",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["signIn"],
    "609df8f3d7d01cb388f2511215cd8d3ff71a51191e",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["resendVerification"],
    "60b6c9bb4ab18d132b8ff40aeb76415996a8f938d1",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["setMemberRoleAction"],
    "60c9be465a8a5ffe3034d498e770453ac8f62f5200",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$budget$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["deleteExpenseAction"],
    "60cf1343bf3f38c6960d88d9cdb6c6f10d9b25ac7a",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$budget$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["removeExpenseFileAction"],
    "60d33ca0bd2451452b775a43114684280eba03929f",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["requestReset"],
    "60d6dad01fad7c72ba12e4e980375acfcf0fb6a8a6",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["setMemberSuspendedAction"],
    "70434b18000c0934031866abd06e2b7ab54ab1984c",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["setMemberDetailsAction"],
    "70bc37ace9ff75b5dccdab8c6b420c7a47982d224f",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["setMemberScopesAction"],
    "7848c45355db0e16ec95579f5efb01a5bc2f409bfa",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["resendInviteAction"],
    "788dbe579ef7d0651d364161ab4e558c1fec3fc0ce",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["inviteAction"]
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f2e$next$2d$internal$2f$server$2f$app$2f$marketing$2f$budget$2f$page$2f$actions$2e$js__$7b$__ACTIONS_MODULE0__$3d3e$__$225b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE1__$3d3e$__$225b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$branches$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE2__$3d3e$__$225b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$budget$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$2922$__$7d$__$5b$app$2d$rsc$5d$__$28$server__actions__loader$2c$__ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i('[project]/wt-personnel/apps/web/.next-internal/server/app/marketing/budget/page/actions.js { ACTIONS_MODULE0 => "[project]/wt-personnel/apps/web/src/app/login/actions.ts [app-rsc] (ecmascript)", ACTIONS_MODULE1 => "[project]/wt-personnel/apps/web/src/app/branches/actions.ts [app-rsc] (ecmascript)", ACTIONS_MODULE2 => "[project]/wt-personnel/apps/web/src/app/marketing/budget/actions.ts [app-rsc] (ecmascript)" } [app-rsc] (server actions loader, ecmascript) <locals>');
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/login/actions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$branches$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/branches/actions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$budget$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/budget/actions.ts [app-rsc] (ecmascript)");
}),
"[project]/wt-personnel/apps/web/.next-internal/server/app/marketing/budget/page/actions.js { ACTIONS_MODULE0 => \"[project]/wt-personnel/apps/web/src/app/login/actions.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE1 => \"[project]/wt-personnel/apps/web/src/app/branches/actions.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE2 => \"[project]/wt-personnel/apps/web/src/app/marketing/budget/actions.ts [app-rsc] (ecmascript)\" } [app-rsc] (server actions loader, ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/login/actions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$branches$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/branches/actions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$budget$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/budget/actions.ts [app-rsc] (ecmascript)");
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
"[project]/wt-personnel/apps/web/src/app/marketing/ads/meta-cookies.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/** Закрытые cookie выбора кабинета Meta (§55): ставит адрес возврата, снимает выбор; живут 10 минут, как заготовка входа */ __turbopack_context__.s([
    "META_ACCOUNTS_COOKIE",
    ()=>META_ACCOUNTS_COOKIE,
    "META_CHOICE_MAX_AGE_S",
    ()=>META_CHOICE_MAX_AGE_S,
    "META_PENDING_COOKIE",
    ()=>META_PENDING_COOKIE
]);
const META_PENDING_COOKIE = 'wetop_meta_pending';
const META_ACCOUNTS_COOKIE = 'wetop_meta_accounts';
const META_CHOICE_MAX_AGE_S = 600;
}),
"[project]/wt-personnel/apps/web/src/app/marketing/budget/actions.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/* __next_internal_action_entry_do_not_use__ [{"0071af012855b6e3858b3880f7800cacd89c0b4abc":{"name":"syncMetaAction"},"009bd1ea8b90676cd4fdddee9d07081dd91f01d902":{"name":"startMetaAction"},"00a0cfca99ccf564d0bf86ac58e3857e9e49784f21":{"name":"disconnectMetaAction"},"60181a9d8b0f32d1f15904ab89ef0930413ee6a5e0":{"name":"saveExpenseAction"},"602f8efae5c43bb8cfc45ca60642b137f8201cc405":{"name":"savePlanAction"},"603ae98ee7ea3576f9a1b537ee3a5d6bb8077005f8":{"name":"saveLinesAction"},"604e119ca51fe0ee16c621e392da54eae43bfa43c6":{"name":"uploadExpenseFileAction"},"60556650b75a0931da8b9aa25b86fbcceab16148b8":{"name":"importExpensesAction"},"605cacda876e388531a9f70d79b53fc6f875778605":{"name":"importCampaignDaysAction"},"60a7eeff707ffd357e318ccb6f084b7a0ae9edd431":{"name":"saveCampaignDayAction"},"60c19dd4bc176e33e8606ff71329033216d32dc794":{"name":"removeCampaignDayAction"},"60c9be465a8a5ffe3034d498e770453ac8f62f5200":{"name":"deleteExpenseAction"},"60cc415deba41ee3a11039acb406509140383aea17":{"name":"saveCampaignAction"},"60cf1343bf3f38c6960d88d9cdb6c6f10d9b25ac7a":{"name":"removeExpenseFileAction"},"60e15698ed11b9804449ba834226ac638b7d8ec890":{"name":"chooseMetaAction"}},"wt-personnel/apps/web/src/app/marketing/budget/actions.ts",""] */ __turbopack_context__.s([
    "chooseMetaAction",
    ()=>chooseMetaAction,
    "deleteExpenseAction",
    ()=>deleteExpenseAction,
    "disconnectMetaAction",
    ()=>disconnectMetaAction,
    "importCampaignDaysAction",
    ()=>importCampaignDaysAction,
    "importExpensesAction",
    ()=>importExpensesAction,
    "removeCampaignDayAction",
    ()=>removeCampaignDayAction,
    "removeExpenseFileAction",
    ()=>removeExpenseFileAction,
    "saveCampaignAction",
    ()=>saveCampaignAction,
    "saveCampaignDayAction",
    ()=>saveCampaignDayAction,
    "saveExpenseAction",
    ()=>saveExpenseAction,
    "saveLinesAction",
    ()=>saveLinesAction,
    "savePlanAction",
    ()=>savePlanAction,
    "startMetaAction",
    ()=>startMetaAction,
    "syncMetaAction",
    ()=>syncMetaAction,
    "uploadExpenseFileAction",
    ()=>uploadExpenseFileAction
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/build/webpack/loaders/next-flight-loader/server-reference.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/cache.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$index$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/index.ts [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$budget$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/budget.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/headers.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$api$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/api/navigation.react-server.js [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/client/components/navigation.react-server.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$ads$2f$meta$2d$cookies$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/ads/meta-cookies.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/api.ts [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2d$error$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/api-error.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$money$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/money.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$plural$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/plural.ts [app-rsc] (ecmascript)");
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
const describe = (e)=>e instanceof __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2d$error$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ApiError"] ? e.message : e instanceof Error ? e.message : String(e);
const s = (fd, k)=>{
    const v = fd.get(k);
    return typeof v === 'string' ? v.trim() : '';
};
const echo = (fd)=>{
    const out = {};
    for (const [k, v] of fd.entries())if (typeof v === 'string' && !k.startsWith('$')) out[k] = v;
    return out;
};
const done = (message)=>{
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/marketing/budget');
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/marketing/budget/expenses');
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/marketing/analytics');
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/marketing');
    return {
        error: null,
        ok: Date.now(),
        message
    };
};
const expenseBody = (fd)=>({
        date: s(fd, 'date'),
        platform: s(fd, 'platform'),
        campaign: s(fd, 'campaign'),
        category: s(fd, 'category'),
        description: s(fd, 'description'),
        amount: s(fd, 'amount'),
        currency: s(fd, 'currency'),
        fxRate: s(fd, 'fxRate'),
        // Switch шлёт пару значений: скрытое false и, если включено, true; значением считается последнее
        countedInBudget: fd.getAll('countedInBudget').at(-1) === 'true',
        campaignId: s(fd, 'campaignId')
    });
async function saveExpenseAction(_prev, fd) {
    const id = s(fd, 'id');
    try {
        if (id) await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["marketingBudgetApi"].updateExpense(id, expenseBody(fd));
        else await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["marketingBudgetApi"].createExpense(expenseBody(fd));
    } catch (e) {
        return {
            error: describe(e),
            ok: 0,
            values: echo(fd)
        };
    }
    return done(id ? 'Расход сохранён' : 'Расход добавлен');
}
/** Предел файла импорта: 1000 строк журнала с запасом; API принимает тело до 1 МБ */ const IMPORT_MAX_BYTES = 512 * 1024;
/** Excel на Windows сохраняет CSV в windows-1251: не UTF-8, значит, кириллица в однобайтовой кодировке */ const decodeCsv = (bytes)=>{
    try {
        return new TextDecoder('utf-8', {
            fatal: true
        }).decode(bytes);
    } catch  {
        return new TextDecoder('windows-1251').decode(bytes);
    }
};
async function importExpensesAction(_prev, fd) {
    const file = fd.get('file');
    if (!(file instanceof File) || file.size === 0) return {
        error: 'Выберите CSV-файл',
        ok: 0
    };
    if (file.size > IMPORT_MAX_BYTES) return {
        error: 'Файл больше 512 КБ: разделите его по месяцам',
        ok: 0
    };
    let r;
    try {
        r = await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["marketingBudgetApi"].importExpenses(decodeCsv(await file.arrayBuffer()));
    } catch (e) {
        return {
            error: describe(e),
            ok: 0
        };
    }
    const n = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$plural$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["pluralRu"])(r.imported, [
        'расход',
        'расхода',
        'расходов'
    ]);
    return done(`Загружено ${n} на ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$money$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["formatMoney"])(r.baseTotal, s(fd, 'currency'))}`);
}
async function uploadExpenseFileAction(_prev, fd) {
    const file = fd.get('file');
    if (!(file instanceof File) || file.size === 0) return {
        error: 'Выберите фото чека или PDF',
        ok: 0
    };
    try {
        await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["marketingBudgetApi"].uploadFile(s(fd, 'expenseId'), file);
    } catch (e) {
        return {
            error: describe(e),
            ok: 0
        };
    }
    return done('Файл приложен к расходу');
}
async function removeExpenseFileAction(_prev, fd) {
    try {
        await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["marketingBudgetApi"].removeFile(s(fd, 'expenseId'), s(fd, 'fileId'));
    } catch (e) {
        return {
            error: describe(e),
            ok: 0
        };
    }
    return done('Файл удалён, запись осталась в журнале организации');
}
const campaignBody = (fd)=>({
        platform: s(fd, 'platform'),
        name: s(fd, 'name'),
        status: s(fd, 'status'),
        startsOn: s(fd, 'startsOn'),
        endsOn: s(fd, 'endsOn')
    });
async function saveCampaignAction(_prev, fd) {
    const id = s(fd, 'id');
    try {
        if (id) await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["marketingCampaignsApi"].update(id, campaignBody(fd));
        else await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["marketingCampaignsApi"].create(campaignBody(fd));
    } catch (e) {
        return {
            error: describe(e),
            ok: 0,
            values: echo(fd)
        };
    }
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/marketing/ads');
    return done(id ? 'Кампания сохранена' : 'Кампания создана');
}
async function saveCampaignDayAction(_prev, fd) {
    try {
        await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["marketingCampaignsApi"].setDay(s(fd, 'id'), {
            date: s(fd, 'date'),
            impressions: s(fd, 'impressions'),
            clicks: s(fd, 'clicks'),
            leads: s(fd, 'leads')
        });
    } catch (e) {
        return {
            error: describe(e),
            ok: 0,
            values: echo(fd)
        };
    }
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/marketing/ads');
    return done('Статистика дня сохранена');
}
async function removeCampaignDayAction(_prev, fd) {
    try {
        await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["marketingCampaignsApi"].removeDay(s(fd, 'id'), s(fd, 'date'));
    } catch (e) {
        return {
            error: describe(e),
            ok: 0
        };
    }
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/marketing/ads');
    return done('День удалён, запись осталась в журнале организации');
}
async function importCampaignDaysAction(_prev, fd) {
    const file = fd.get('file');
    if (!(file instanceof File) || file.size === 0) return {
        error: 'Выберите CSV-файл',
        ok: 0
    };
    if (file.size > IMPORT_MAX_BYTES) return {
        error: 'Файл больше 512 КБ',
        ok: 0
    };
    let r;
    try {
        r = await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["marketingCampaignsApi"].importDays(s(fd, 'id'), decodeCsv(await file.arrayBuffer()));
    } catch (e) {
        return {
            error: describe(e),
            ok: 0
        };
    }
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/marketing/ads');
    return done(`Загружено ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$plural$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["pluralRu"])(r.imported, [
        'день',
        'дня',
        'дней'
    ])} статистики`);
}
async function startMetaAction() {
    let url;
    try {
        url = (await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["metaConnectionApi"].start()).url;
    } catch (e) {
        return {
            error: describe(e),
            ok: 0
        };
    }
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["redirect"])(url);
}
async function chooseMetaAction(_prev, fd) {
    const jar = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["cookies"])();
    const pending = jar.get(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$ads$2f$meta$2d$cookies$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["META_PENDING_COOKIE"])?.value ?? '';
    if (!pending) return {
        error: 'Выбор кабинета устарел: подключите заново',
        ok: 0
    };
    try {
        await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["metaConnectionApi"].choose(pending, s(fd, 'adAccountId'));
    } catch (e) {
        return {
            error: describe(e),
            ok: 0
        };
    }
    jar.delete(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$ads$2f$meta$2d$cookies$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["META_PENDING_COOKIE"]);
    jar.delete(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$ads$2f$meta$2d$cookies$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["META_ACCOUNTS_COOKIE"]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/marketing/ads');
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["redirect"])('/marketing/ads?meta=connected');
}
async function syncMetaAction() {
    let r;
    try {
        r = await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["metaConnectionApi"].sync();
    } catch (e) {
        return {
            error: describe(e),
            ok: 0
        };
    }
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/marketing/ads');
    if (!r.ok) return {
        error: r.error,
        ok: 0
    };
    return done(`Кабинет обновлён: ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$plural$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["pluralRu"])(r.campaigns, [
        'кампания',
        'кампании',
        'кампаний'
    ])}, ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$plural$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["pluralRu"])(r.days, [
        'день',
        'дня',
        'дней'
    ])}`);
}
async function disconnectMetaAction() {
    try {
        await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["metaConnectionApi"].disconnect();
    } catch (e) {
        return {
            error: describe(e),
            ok: 0
        };
    }
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/marketing/ads');
    return done('Кабинет отключён: ключ стёрт, кампании и статистика остались');
}
async function deleteExpenseAction(_prev, fd) {
    try {
        await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["marketingBudgetApi"].deleteExpense(s(fd, 'id'));
    } catch (e) {
        return {
            error: describe(e),
            ok: 0
        };
    }
    return done('Расход удалён, запись об удалении осталась в журнале');
}
async function saveLinesAction(_prev, fd) {
    const lines = __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$budget$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["MARKETING_PLATFORMS"].map((platform)=>({
            platform,
            amount: s(fd, `amount-${platform}`)
        }));
    try {
        await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["marketingBudgetApi"].setLines({
            month: s(fd, 'month'),
            lines
        });
    } catch (e) {
        return {
            error: describe(e),
            ok: 0,
            values: echo(fd)
        };
    }
    return done('План по каналам сохранён');
}
async function savePlanAction(_prev, fd) {
    try {
        await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["marketingBudgetApi"].setPlan({
            month: s(fd, 'month'),
            amount: s(fd, 'amount')
        });
    } catch (e) {
        return {
            error: describe(e),
            ok: 0,
            values: echo(fd)
        };
    }
    return done('План месяца сохранён');
}
;
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ensureServerEntryExports"])([
    saveExpenseAction,
    importExpensesAction,
    uploadExpenseFileAction,
    removeExpenseFileAction,
    saveCampaignAction,
    saveCampaignDayAction,
    removeCampaignDayAction,
    importCampaignDaysAction,
    startMetaAction,
    chooseMetaAction,
    syncMetaAction,
    disconnectMetaAction,
    deleteExpenseAction,
    saveLinesAction,
    savePlanAction
]);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(saveExpenseAction, "60181a9d8b0f32d1f15904ab89ef0930413ee6a5e0", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(importExpensesAction, "60556650b75a0931da8b9aa25b86fbcceab16148b8", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(uploadExpenseFileAction, "604e119ca51fe0ee16c621e392da54eae43bfa43c6", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(removeExpenseFileAction, "60cf1343bf3f38c6960d88d9cdb6c6f10d9b25ac7a", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(saveCampaignAction, "60cc415deba41ee3a11039acb406509140383aea17", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(saveCampaignDayAction, "60a7eeff707ffd357e318ccb6f084b7a0ae9edd431", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(removeCampaignDayAction, "60c19dd4bc176e33e8606ff71329033216d32dc794", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(importCampaignDaysAction, "605cacda876e388531a9f70d79b53fc6f875778605", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(startMetaAction, "009bd1ea8b90676cd4fdddee9d07081dd91f01d902", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(chooseMetaAction, "60e15698ed11b9804449ba834226ac638b7d8ec890", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(syncMetaAction, "0071af012855b6e3858b3880f7800cacd89c0b4abc", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(disconnectMetaAction, "00a0cfca99ccf564d0bf86ac58e3857e9e49784f21", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(deleteExpenseAction, "60c9be465a8a5ffe3034d498e770453ac8f62f5200", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(saveLinesAction, "603ae98ee7ea3576f9a1b537ee3a5d6bb8077005f8", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(savePlanAction, "602f8efae5c43bb8cfc45ca60642b137f8201cc405", null);
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

//# sourceMappingURL=wt-personnel_apps_web_1jpz_5g._.js.map