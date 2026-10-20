module.exports = [
"[project]/wt-personnel/apps/web/.next-internal/server/app/bar/consumables/page/actions.js { ACTIONS_MODULE0 => \"[project]/wt-personnel/apps/web/src/app/login/actions.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE1 => \"[project]/wt-personnel/apps/web/src/app/branches/actions.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE2 => \"[project]/wt-personnel/apps/web/src/app/food/stock-actions.ts [app-rsc] (ecmascript)\" } [app-rsc] (server actions loader, ecmascript)", ((__turbopack_context__) => {
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
    "60274aaa6bd31e13c03d12280d9550a04fc7ec5972",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["setPassword"],
    "6029be68988f5b89583e3c4ecfa6a99ce573a9ff4e",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$food$2f$stock$2d$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["mutateStock"],
    "607a392fa69b3d4a29e31af337631be9cfc424d61f",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["signIn"],
    "609df8f3d7d01cb388f2511215cd8d3ff71a51191e",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["resendVerification"],
    "60aa10d29d7561c8c2b24c7673b6fbfa442e3321d4",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$food$2f$stock$2d$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["loadLots"],
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
    "7848c45355db0e16ec95579f5efb01a5bc2f409bfa",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["resendInviteAction"],
    "788dbe579ef7d0651d364161ab4e558c1fec3fc0ce",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["inviteAction"]
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f2e$next$2d$internal$2f$server$2f$app$2f$bar$2f$consumables$2f$page$2f$actions$2e$js__$7b$__ACTIONS_MODULE0__$3d3e$__$225b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE1__$3d3e$__$225b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$branches$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE2__$3d3e$__$225b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$food$2f$stock$2d$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$2922$__$7d$__$5b$app$2d$rsc$5d$__$28$server__actions__loader$2c$__ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i('[project]/wt-personnel/apps/web/.next-internal/server/app/bar/consumables/page/actions.js { ACTIONS_MODULE0 => "[project]/wt-personnel/apps/web/src/app/login/actions.ts [app-rsc] (ecmascript)", ACTIONS_MODULE1 => "[project]/wt-personnel/apps/web/src/app/branches/actions.ts [app-rsc] (ecmascript)", ACTIONS_MODULE2 => "[project]/wt-personnel/apps/web/src/app/food/stock-actions.ts [app-rsc] (ecmascript)" } [app-rsc] (server actions loader, ecmascript) <locals>');
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/login/actions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$branches$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/branches/actions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$food$2f$stock$2d$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/food/stock-actions.ts [app-rsc] (ecmascript)");
}),
"[project]/wt-personnel/apps/web/.next-internal/server/app/bar/consumables/page/actions.js { ACTIONS_MODULE0 => \"[project]/wt-personnel/apps/web/src/app/login/actions.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE1 => \"[project]/wt-personnel/apps/web/src/app/branches/actions.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE2 => \"[project]/wt-personnel/apps/web/src/app/food/stock-actions.ts [app-rsc] (ecmascript)\" } [app-rsc] (server actions loader, ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/login/actions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$branches$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/branches/actions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$food$2f$stock$2d$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/food/stock-actions.ts [app-rsc] (ecmascript)");
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
"[project]/wt-personnel/apps/web/src/app/food/stock-actions.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/* __next_internal_action_entry_do_not_use__ [{"6029be68988f5b89583e3c4ecfa6a99ce573a9ff4e":{"name":"mutateStock"},"60aa10d29d7561c8c2b24c7673b6fbfa442e3321d4":{"name":"loadLots"}},"wt-personnel/apps/web/src/app/food/stock-actions.ts",""] */ __turbopack_context__.s([
    "loadLots",
    ()=>loadLots,
    "mutateStock",
    ()=>mutateStock
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/build/webpack/loaders/next-flight-loader/server-reference.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/cache.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$api$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/api/navigation.react-server.js [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/client/components/navigation.react-server.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/api.ts [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2d$error$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/api-error.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$desk$2d$shell$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/desk-shell.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$food$2d$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/food-api.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-validate.js [app-rsc] (ecmascript)");
;
;
;
;
;
;
async function scope(key) {
    const { context } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$desk$2d$shell$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["currentMe"])();
    const vertical = context?.vertical;
    if (!context || vertical !== 'BEAUTY' && vertical !== 'FOOD_SERVICE' || !context.businessId || !context.locationId || key !== `${context.businessId}:${context.locationId}`) throw new __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2d$error$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ApiError"](409, `Выбран другой ${context?.vertical === 'BEAUTY' ? 'салон' : 'ресторан'}. Откройте форму заново.`);
    return vertical;
}
async function mutateStock(scopeKey, command) {
    try {
        const vertical = await scope(scopeKey);
        switch(command.kind){
            case 'product':
                if (command.id) await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$food$2d$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["stockApi"].updateProduct(command.id, command.body);
                else await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$food$2d$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["stockApi"].createProduct(command.body);
                break;
            case 'receipt':
                await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$food$2d$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["stockApi"].receipt(command.body);
                break;
            case 'reverse':
                await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$food$2d$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["stockApi"].reverseLot(command.id);
                break;
            case 'write-off':
                await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$food$2d$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["stockApi"].writeOff(command.body);
                break;
            case 'inventory':
                await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$food$2d$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["stockApi"].inventory(command.body);
                break;
        }
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])(vertical === 'BEAUTY' ? '/bar/consumables' : '/stock');
        return {
            error: null
        };
    } catch (error) {
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["unstable_rethrow"])(error);
        return {
            error: error instanceof Error ? error.message : 'Не удалось сохранить. Повторите действие.'
        };
    }
}
async function loadLots(scopeKey, productId) {
    try {
        await scope(scopeKey);
        return {
            error: null,
            items: (await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$food$2d$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["stockApi"].lots(productId)).items
        };
    } catch (error) {
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["unstable_rethrow"])(error);
        return {
            error: error instanceof Error ? error.message : 'Не удалось загрузить партии',
            items: []
        };
    }
}
;
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ensureServerEntryExports"])([
    mutateStock,
    loadLots
]);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(mutateStock, "6029be68988f5b89583e3c4ecfa6a99ce573a9ff4e", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(loadLots, "60aa10d29d7561c8c2b24c7673b6fbfa442e3321d4", null);
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
"[project]/wt-personnel/apps/web/src/lib/food-api.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "foodApi",
    ()=>foodApi,
    "restaurantApi",
    ()=>restaurantApi,
    "stockApi",
    ()=>stockApi
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/api.ts [app-rsc] (ecmascript) <locals>");
;
const base = '/food-service';
const idPath = (collection, id)=>`${base}/${collection}/${encodeURIComponent(id)}`;
const query = (cursor, date)=>{
    const q = new URLSearchParams({
        limit: '100'
    });
    if (cursor) q.set('cursor', cursor);
    if (date) q.set('date', date);
    return `?${q}`;
};
const foodApi = {
    areas: (cursor)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getJsonPublic"])(`${base}/areas${query(cursor)}`),
    createArea: (body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('POST', `${base}/areas`, body),
    updateArea: (id, body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('PATCH', idPath('areas', id), body),
    /** Правила брони столов (§43): настройки и будущие закрытые дни */ bookingRules: ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getJsonPublic"])(`${base}/booking-rules`),
    setBookingRules: (rules)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('PUT', `${base}/booking-rules`, rules),
    addClosedDay: (body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('POST', `${base}/closed-days`, body),
    removeClosedDay: (id)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('DELETE', idPath('closed-days', id), {}),
    /** Схема зала (§42): расстановка зоны целиком */ setLayout: (areaId, tables)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('PUT', `${idPath('areas', areaId)}/layout`, {
            tables
        }),
    tables: (cursor)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getJsonPublic"])(`${base}/tables${query(cursor)}`),
    createTable: (body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('POST', `${base}/tables`, body),
    updateTable: (id, body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('PATCH', idPath('tables', id), body),
    periods: (cursor)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getJsonPublic"])(`${base}/service-periods${query(cursor)}`),
    createPeriod: (body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('POST', `${base}/service-periods`, body),
    updatePeriod: (id, body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('PATCH', idPath('service-periods', id), body),
    customers: (cursor)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getJsonPublic"])(`${base}/customers${query(cursor)}`),
    updateCustomer: (id, body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('PATCH', idPath('customers', id), body),
    reservations: (date, cursor)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getJsonPublic"])(`${base}/reservations${query(cursor, date)}`),
    create: (body, key)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('POST', `${base}/reservations`, body, {
            'Idempotency-Key': key
        }),
    update: (id, body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('PATCH', idPath('reservations', id), body),
    status: (id, body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('POST', `${idPath('reservations', id)}/status`, body),
    assign: (id, body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('PUT', `${idPath('reservations', id)}/table`, body),
    unassign: (id, body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('DELETE', `${idPath('reservations', id)}/table`, body)
};
const restaurantApi = {
    categories: (cursor)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getJsonPublic"])(`${base}/menu/categories${query(cursor)}`),
    createCategory: (body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('POST', `${base}/menu/categories`, body),
    updateCategory: (id, body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('PATCH', idPath('menu/categories', id), body),
    menuItems: (cursor)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getJsonPublic"])(`${base}/menu/items${query(cursor)}`),
    menuItem: (id)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getJsonPublic"])(idPath('menu/items', id)),
    createMenuItem: (body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('POST', `${base}/menu/items`, body),
    updateMenuItem: (id, body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('PATCH', idPath('menu/items', id), body),
    replaceIngredients: (id, ingredients)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('PUT', `${idPath('menu/items', id)}/ingredients`, {
            ingredients
        }),
    orders: (date, cursor)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getJsonPublic"])(`${base}/orders${query(cursor, date)}`),
    openOrders: (cursor)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getJsonPublic"])(`${base}/orders${query(cursor)}&open=1`),
    createOrder: (body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('POST', `${base}/orders`, body),
    updateOrder: (id, body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('PATCH', idPath('orders', id), body),
    orderStatus: (id, body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('POST', `${idPath('orders', id)}/status`, body),
    payOrder: (id, body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('POST', `${idPath('orders', id)}/payments`, body),
    rateOrder: (id, body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('POST', `${idPath('orders', id)}/rating`, body),
    /** Ссылка на оценку с телефона гостя (§40): ключ только в ответе, 72 часа */ ratingLink: (id)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('POST', `${idPath('orders', id)}/rating-link`, {}),
    voidPayment: (id, reason)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('POST', `${idPath('payments', id)}/void`, {
            reason
        }),
    /** Возврат по закрытому заказу (§56) */ refundOrder: (id, body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('POST', `${idPath('orders', id)}/refunds`, body),
    // период считает сервер (ADR-181); без дат прежние последние 100 строк для экрана «Касса»
    cash: (period)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getJsonPublic"])(`${base}/cash${period ? `?from=${period.from}&to=${period.to}` : ''}`),
    cashOperation: (body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('POST', `${base}/cash/operations`, body),
    voidCashOperation: (id)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('POST', `${idPath('cash/operations', id)}/void`, {}),
    cashReconciliation: (body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('POST', `${base}/cash/reconciliations`, body),
    payout: (id, body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('POST', `${idPath('employees', id)}/payouts`, body),
    tableCleaning: (id, needsCleaning)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('POST', `${idPath('tables', id)}/cleaning`, {
            needsCleaning
        }),
    report: (date)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getJsonPublic"])(`${base}/report?date=${date}`),
    employees: (cursor)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getJsonPublic"])(`${base}/employees${query(cursor)}`),
    assignEmployeePersonnelKind: (id, body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('PATCH', `${idPath('employees', id)}/personnel-kind`, body),
    createEmployee: (body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('POST', `${base}/employees`, body),
    updateEmployee: (id, body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('PATCH', idPath('employees', id), body),
    shifts: ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getJsonPublic"])(`${base}/shifts`),
    setShifts: (id, intervals, expectedRevision)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('PUT', `${idPath('employees', id)}/working-hours`, {
            intervals,
            expectedRevision
        }),
    payroll: (month)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getJsonPublic"])(`${base}/payroll?month=${month}`),
    setPaySettings: (id, body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('PUT', `${idPath('employees', id)}/pay-settings`, body),
    addPayAdjustment: (id, body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('POST', `${idPath('employees', id)}/pay-adjustments`, body)
};
const stockApi = {
    products: ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getJsonPublic"])(`${base}/stock/products`),
    createProduct: (body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('POST', `${base}/stock/products`, body),
    updateProduct: (id, body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('PATCH', idPath('stock/products', id), body),
    lots: (productId)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getJsonPublic"])(`${base}/stock/lots?productId=${encodeURIComponent(productId)}`),
    movements: ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getJsonPublic"])(`${base}/stock/movements`),
    receipt: (body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('POST', `${base}/stock/receipts`, body),
    reverseLot: (id)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('POST', `${idPath('stock/lots', id)}/reverse`, {}),
    writeOff: (body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('POST', `${base}/stock/write-offs`, body),
    inventory: (body)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["sendJson"])('POST', `${base}/stock/inventory`, body)
};
}),
];

//# sourceMappingURL=wt-personnel_apps_web_01ykszn._.js.map