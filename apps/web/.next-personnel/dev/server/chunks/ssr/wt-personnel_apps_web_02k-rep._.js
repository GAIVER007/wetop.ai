module.exports = [
"[project]/wt-personnel/apps/web/.next-internal/server/app/marketing/site/editor/page/actions.js { ACTIONS_MODULE0 => \"[project]/wt-personnel/apps/web/src/app/login/actions.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE1 => \"[project]/wt-personnel/apps/web/src/app/branches/actions.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE2 => \"[project]/wt-personnel/apps/web/src/app/marketing/site/editor/actions.ts [app-rsc] (ecmascript)\" } [app-rsc] (server actions loader, ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "001a7d4c3ae8959e7e3022e9cb649e7634eb880b7f",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["versionsAction"],
    "006e5fc1898f6ae417ffb62b54cb1d413c3d8159b2",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["logoutAllAction"],
    "007d1442f5a8d0cd6e013f22d98ca02ad493e384e8",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["signOut"],
    "00d659178cdba3651f0abc0c3752238282ee1e32fb",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$branches$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["branchChoices"],
    "00ebb5c478b8bac0e65f6b0c39b1721b3be480d800",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["conversationAction"],
    "401353221f6c5c80268fc824069017281f10a9a27b",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createSiteAction"],
    "401b09559e5bc95449e9ecec69d5744d09c555f7b4",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["publishSimpleAction"],
    "401b64881c2c904aef39072d4079583fa7bb90d6ad",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["saveContextAction"],
    "4051f91126f03a2287a9bf7ffbb4f1e344bb31cf04",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["removeMemberAction"],
    "4052f29f697ed23477e3e82392fdd75d5efa81cee1",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerAction"],
    "405add4ac8b023f91674b78a847ea5caced76b052f",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$branches$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["selectBranch"],
    "40757e30ef9189f7b144e989121d759deb17d26e2f",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["versionAction"],
    "407ea4da56bf7d1cfe21bafadc859abdb8a9506c7b",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["assistantAction"],
    "4080b9b451ea5cc93374902d731696823f79a17c8c",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["uploadSitePhotoAction"],
    "4081becb0042da473a7563fe0126416592c2ca9ebe",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createFromTemplateAction"],
    "40a2466925104d38ea8605d0fed401ad7fa6d252bf",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["runAction"],
    "40a28645f8383dc9db60c5ad7c833791c6e6b74105",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["verifyEmailAction"],
    "40a3ec6082c769cd822baf77c3181fca96da306c5b",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["acceptInviteAction"],
    "40b40b535b4ee73667ff5a6be11164a285b559119f",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revokeInviteAction"],
    "40bfc184339208cc33625bfbf7439164bfe195827a",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["editorPreviewAction"],
    "40e55c19574da2edee9ed5e034c5823c638950b042",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["assistantRunAction"],
    "40e8889380cd88c383646ab56d2e50580a96c0cd1d",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["chooseSiteLocationAction"],
    "60274aaa6bd31e13c03d12280d9550a04fc7ec5972",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["setPassword"],
    "60774c2cdea79a8d90779bf45de58aa9be74c292c6",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["approvePlanAction"],
    "607a392fa69b3d4a29e31af337631be9cfc424d61f",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["signIn"],
    "6086a98797250064ff51f29fbf579c9b5fb5ee1344",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["restoreAction"],
    "6090aab0c1b2e014085cb912772a722ec130e2b556",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["patchAction"],
    "609df8f3d7d01cb388f2511215cd8d3ff71a51191e",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["resendVerification"],
    "60a2f6725a3291dd8e64d5f068c4382e8dcef705b4",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["saveDraftAction"],
    "60b6c9bb4ab18d132b8ff40aeb76415996a8f938d1",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["setMemberRoleAction"],
    "60c7c4bd9311c812af3079f67f02316c4b907cfad6",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["diffAction"],
    "60d33ca0bd2451452b775a43114684280eba03929f",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["requestReset"],
    "60d6dad01fad7c72ba12e4e980375acfcf0fb6a8a6",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["setMemberSuspendedAction"],
    "60effe4ab97dc082d9056f84db1afa18043edb3727",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["bookmarkAction"],
    "70434b18000c0934031866abd06e2b7ab54ab1984c",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["setMemberDetailsAction"],
    "70bc37ace9ff75b5dccdab8c6b420c7a47982d224f",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["setMemberScopesAction"],
    "7848c45355db0e16ec95579f5efb01a5bc2f409bfa",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["resendInviteAction"],
    "785715a80488f83e49eaaca78c6b167e1e0af0305b",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["sectionAction"],
    "788dbe579ef7d0651d364161ab4e558c1fec3fc0ce",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["inviteAction"]
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f2e$next$2d$internal$2f$server$2f$app$2f$marketing$2f$site$2f$editor$2f$page$2f$actions$2e$js__$7b$__ACTIONS_MODULE0__$3d3e$__$225b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE1__$3d3e$__$225b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$branches$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE2__$3d3e$__$225b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$2922$__$7d$__$5b$app$2d$rsc$5d$__$28$server__actions__loader$2c$__ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i('[project]/wt-personnel/apps/web/.next-internal/server/app/marketing/site/editor/page/actions.js { ACTIONS_MODULE0 => "[project]/wt-personnel/apps/web/src/app/login/actions.ts [app-rsc] (ecmascript)", ACTIONS_MODULE1 => "[project]/wt-personnel/apps/web/src/app/branches/actions.ts [app-rsc] (ecmascript)", ACTIONS_MODULE2 => "[project]/wt-personnel/apps/web/src/app/marketing/site/editor/actions.ts [app-rsc] (ecmascript)" } [app-rsc] (server actions loader, ecmascript) <locals>');
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/login/actions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$branches$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/branches/actions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/site/editor/actions.ts [app-rsc] (ecmascript)");
}),
"[project]/wt-personnel/apps/web/.next-internal/server/app/marketing/site/editor/page/actions.js { ACTIONS_MODULE0 => \"[project]/wt-personnel/apps/web/src/app/login/actions.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE1 => \"[project]/wt-personnel/apps/web/src/app/branches/actions.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE2 => \"[project]/wt-personnel/apps/web/src/app/marketing/site/editor/actions.ts [app-rsc] (ecmascript)\" } [app-rsc] (server actions loader, ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$login$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/login/actions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$branches$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/branches/actions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$marketing$2f$site$2f$editor$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/marketing/site/editor/actions.ts [app-rsc] (ecmascript)");
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
"[project]/wt-personnel/apps/web/src/app/marketing/site/editor/actions.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/* __next_internal_action_entry_do_not_use__ [{"001a7d4c3ae8959e7e3022e9cb649e7634eb880b7f":{"name":"versionsAction"},"00ebb5c478b8bac0e65f6b0c39b1721b3be480d800":{"name":"conversationAction"},"401353221f6c5c80268fc824069017281f10a9a27b":{"name":"createSiteAction"},"401b09559e5bc95449e9ecec69d5744d09c555f7b4":{"name":"publishSimpleAction"},"401b64881c2c904aef39072d4079583fa7bb90d6ad":{"name":"saveContextAction"},"40757e30ef9189f7b144e989121d759deb17d26e2f":{"name":"versionAction"},"407ea4da56bf7d1cfe21bafadc859abdb8a9506c7b":{"name":"assistantAction"},"4080b9b451ea5cc93374902d731696823f79a17c8c":{"name":"uploadSitePhotoAction"},"4081becb0042da473a7563fe0126416592c2ca9ebe":{"name":"createFromTemplateAction"},"40891d770c81b195f2b10c5d1c4dff6fe2bdb4c5e3":{"name":"templateFactsAction"},"4091eed8ef680b9e47cf8b58a641f0447e4cdfc0c1":{"name":"designFirstAction"},"40a2466925104d38ea8605d0fed401ad7fa6d252bf":{"name":"runAction"},"40bfc184339208cc33625bfbf7439164bfe195827a":{"name":"editorPreviewAction"},"40e55c19574da2edee9ed5e034c5823c638950b042":{"name":"assistantRunAction"},"40e8889380cd88c383646ab56d2e50580a96c0cd1d":{"name":"chooseSiteLocationAction"},"60774c2cdea79a8d90779bf45de58aa9be74c292c6":{"name":"approvePlanAction"},"6086a98797250064ff51f29fbf579c9b5fb5ee1344":{"name":"restoreAction"},"6090aab0c1b2e014085cb912772a722ec130e2b556":{"name":"patchAction"},"60a2f6725a3291dd8e64d5f068c4382e8dcef705b4":{"name":"saveDraftAction"},"60c7c4bd9311c812af3079f67f02316c4b907cfad6":{"name":"diffAction"},"60effe4ab97dc082d9056f84db1afa18043edb3727":{"name":"bookmarkAction"},"785715a80488f83e49eaaca78c6b167e1e0af0305b":{"name":"sectionAction"}},"wt-personnel/apps/web/src/app/marketing/site/editor/actions.ts",""] */ __turbopack_context__.s([
    "approvePlanAction",
    ()=>approvePlanAction,
    "assistantAction",
    ()=>assistantAction,
    "assistantRunAction",
    ()=>assistantRunAction,
    "bookmarkAction",
    ()=>bookmarkAction,
    "chooseSiteLocationAction",
    ()=>chooseSiteLocationAction,
    "conversationAction",
    ()=>conversationAction,
    "createFromTemplateAction",
    ()=>createFromTemplateAction,
    "createSiteAction",
    ()=>createSiteAction,
    "designFirstAction",
    ()=>designFirstAction,
    "diffAction",
    ()=>diffAction,
    "editorPreviewAction",
    ()=>editorPreviewAction,
    "patchAction",
    ()=>patchAction,
    "publishSimpleAction",
    ()=>publishSimpleAction,
    "restoreAction",
    ()=>restoreAction,
    "runAction",
    ()=>runAction,
    "saveContextAction",
    ()=>saveContextAction,
    "saveDraftAction",
    ()=>saveDraftAction,
    "sectionAction",
    ()=>sectionAction,
    "templateFactsAction",
    ()=>templateFactsAction,
    "uploadSitePhotoAction",
    ()=>uploadSitePhotoAction,
    "versionAction",
    ()=>versionAction,
    "versionsAction",
    ()=>versionsAction
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/build/webpack/loaders/next-flight-loader/server-reference.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:crypto [external] (node:crypto, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/cache.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/api.ts [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2d$error$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/api-error.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$branches$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/branches/actions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-validate.js [app-rsc] (ecmascript)");
;
;
;
;
;
/**
 * Действия редактора сайта (MKT9). Каждое зовёт API строгого scope филиала и возвращает стойке ответ как есть:
 * при отказе код и пути ошибок, чтобы ввод остался на экране, а поле подсветилось. Перезагрузки страницы до разбора
 * ошибки нет: несохранённый документ живёт только в браузере.
 */ const failed = (e)=>({
        ok: false,
        status: e instanceof __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2d$error$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ApiError"] ? e.status : 0,
        code: null,
        message: e instanceof Error ? e.message : 'Нет связи с сервером: изменения остались на экране',
        errors: [],
        paths: []
    });
async function safe(fn) {
    try {
        return await fn();
    } catch (e) {
        return failed(e);
    }
}
async function saveDraftAction(baseRevision, spec) {
    const reply = await safe(()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["siteEditorApi"].save(baseRevision, spec));
    if (reply.ok) (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/marketing/site');
    return reply;
}
async function versionAction(id) {
    return safe(()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["siteEditorApi"].version(id));
}
async function versionsAction() {
    try {
        const r = await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["siteEditorApi"].versions();
        return {
            ok: true,
            versions: r.versions,
            bookmarks: r.bookmarks ?? []
        };
    } catch (e) {
        return {
            ok: false,
            message: e instanceof Error ? e.message : 'Не удалось загрузить историю'
        };
    }
}
async function diffAction(id, against) {
    return safe(()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["siteEditorApi"].diff(id, against));
}
async function restoreAction(id, baseRevision) {
    const reply = await safe(()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["siteEditorApi"].restore(id, baseRevision));
    if (reply.ok) (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/marketing/site');
    return reply;
}
async function editorPreviewAction(versionId) {
    try {
        return {
            url: (await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["marketingSiteApi"].preview(versionId)).url,
            error: null
        };
    } catch (e) {
        return {
            url: null,
            error: e instanceof Error ? e.message : 'Предпросмотр недоступен'
        };
    }
}
async function patchAction(baseVersionId, instruction) {
    return safe(()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["siteEditorApi"].generate({
            requestKey: (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["randomUUID"])(),
            type: 'PATCH',
            baseVersionId,
            instruction
        }));
}
async function sectionAction(baseVersionId, pageId, sectionId, instruction) {
    const text = instruction.trim();
    return safe(()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["siteEditorApi"].generate({
            requestKey: (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["randomUUID"])(),
            type: 'SECTION',
            baseVersionId,
            pageId,
            sectionId,
            ...text ? {
                instruction: text
            } : {}
        }));
}
async function createSiteAction(input) {
    const site = await safe(()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["siteEditorApi"].bootstrap());
    if (!site.ok) return {
        ok: false,
        siteCreated: false,
        status: site.status,
        message: site.message,
        code: site.code
    };
    let briefHash = input.briefHash;
    if (!briefHash) {
        try {
            briefHash = (await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["siteEditorApi"].brief()).briefHash;
        } catch (e) {
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/marketing/site');
            return {
                ok: false,
                siteCreated: true,
                status: e instanceof __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2d$error$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ApiError"] ? e.status : 0,
                message: e instanceof Error ? e.message : 'Нет связи с сервером',
                code: null
            };
        }
    }
    const text = input.instruction.trim();
    const design = input.design;
    const reply = await safe(()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["siteEditorApi"].generate({
            requestKey: (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["randomUUID"])(),
            expectedBriefHash: briefHash,
            ...text ? {
                instruction: text
            } : {},
            ...design && 'presetId' in design ? {
                designPresetId: design.presetId
            } : {},
            ...design && 'runId' in design ? {
                designRunId: design.runId,
                designId: design.id
            } : {}
        }));
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/marketing/site');
    if (!reply.ok) return {
        ok: false,
        siteCreated: true,
        status: reply.status,
        message: reply.message,
        code: reply.code
    };
    return {
        ok: true,
        siteCreated: true,
        run: reply.data.run
    };
}
async function createFromTemplateAction(templateId) {
    const reply = await safe(()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["siteEditorApi"].fromTemplate(templateId));
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/marketing/site');
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/marketing/site/editor');
    return reply;
}
async function chooseSiteLocationAction(locationId) {
    let branchId;
    try {
        const { items } = await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["branchesApi"].list();
        branchId = items.find((b)=>b.locationId === locationId)?.id ?? null;
    } catch (e) {
        return {
            ok: false,
            message: e instanceof Error ? e.message : 'Не удалось загрузить филиалы'
        };
    }
    if (!branchId) return {
        ok: false,
        message: 'Филиал недоступен. Обновите страницу.'
    };
    const form = new FormData();
    form.set('id', branchId);
    form.set('returnTo', '/marketing/site/editor');
    // `selectBranch` заканчивается переходом (redirect): он уходит наружу как есть
    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$branches$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["selectBranch"])(form);
    return {
        ok: false,
        message: 'Не удалось переключить филиал'
    };
}
async function designFirstAction(instruction) {
    const site = await safe(()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["siteEditorApi"].bootstrap());
    if (!site.ok) return site;
    const text = instruction.trim();
    return safe(()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["siteEditorApi"].assistant({
            requestKey: (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["randomUUID"])(),
            mode: 'DESIGN',
            ...text ? {
                text
            } : {}
        }));
}
async function assistantAction(input) {
    const text = input.text.trim();
    return safe(()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["siteEditorApi"].assistant({
            requestKey: (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["randomUUID"])(),
            mode: input.mode,
            ...text ? {
                text
            } : {},
            ...input.reply ? {
                replyToRunId: input.reply.runId,
                answers: input.reply.answers
            } : {}
        }));
}
async function assistantRunAction(id) {
    return safe(()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["siteEditorApi"].assistantRun(id));
}
async function approvePlanAction(id, instruction) {
    return safe(()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["siteEditorApi"].approve(id, instruction.trim() || undefined));
}
async function conversationAction() {
    return safe(()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["siteEditorApi"].conversation());
}
async function saveContextAction(instructions) {
    return safe(()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["siteEditorApi"].saveContext(instructions));
}
async function bookmarkAction(id, label) {
    return safe(async ()=>{
        if (label === null) {
            const r = await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["siteEditorApi"].removeBookmark(id);
            return r.ok ? {
                ok: true,
                data: null
            } : r;
        }
        const r = await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["siteEditorApi"].bookmark(id, label);
        return r.ok ? {
            ok: true,
            data: r.data.bookmark.label
        } : r;
    });
}
async function runAction(id) {
    return safe(()=>__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["siteEditorApi"].run(id));
}
async function uploadSitePhotoAction(form) {
    const file = form.get('file');
    if (!(file instanceof File) || file.size === 0) return {
        ok: false,
        message: 'Выберите фото: JPEG, PNG или WebP'
    };
    if (file.size > 10 * 1024 * 1024) return {
        ok: false,
        message: 'Фото больше 10 МБ'
    };
    try {
        const { asset } = await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["siteAssetsApi"].upload(file, 'IMAGE');
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/marketing/site/assets');
        return {
            ok: true,
            asset
        };
    } catch (e) {
        if (e instanceof __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2d$error$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ApiError"] && e.status === 413) return {
            ok: false,
            message: 'Фото больше 10 МБ'
        };
        if (e instanceof __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2d$error$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ApiError"] && e.status === 429) return {
            ok: false,
            message: 'Лимит загрузок за час исчерпан, попробуйте позже'
        };
        if (e instanceof __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2d$error$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ApiError"] && e.status < 500) return {
            ok: false,
            message: e.message
        };
        return {
            ok: false,
            message: 'Не удалось загрузить фото, попробуйте ещё раз'
        };
    }
}
async function templateFactsAction(locationId) {
    try {
        return {
            ok: true,
            facts: await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["marketingSiteApi"].facts(locationId)
        };
    } catch (e) {
        return {
            ok: false,
            message: e instanceof Error ? e.message : 'Нет данных филиала'
        };
    }
}
async function publishSimpleAction(expectedVersionId) {
    try {
        const r = await __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["marketingSiteApi"].publish(expectedVersionId);
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/marketing/site');
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/marketing/site/editor');
        return {
            ok: true,
            url: r.site.url
        };
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Не удалось опубликовать';
        const needsSetup = e instanceof __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$api$2d$error$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ApiError"] && e.status === 409 && /тариф/i.test(message);
        return {
            ok: false,
            message,
            needsSetup
        };
    }
}
;
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ensureServerEntryExports"])([
    saveDraftAction,
    versionAction,
    versionsAction,
    diffAction,
    restoreAction,
    editorPreviewAction,
    patchAction,
    sectionAction,
    createSiteAction,
    createFromTemplateAction,
    chooseSiteLocationAction,
    designFirstAction,
    assistantAction,
    assistantRunAction,
    approvePlanAction,
    conversationAction,
    saveContextAction,
    bookmarkAction,
    runAction,
    uploadSitePhotoAction,
    templateFactsAction,
    publishSimpleAction
]);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(saveDraftAction, "60a2f6725a3291dd8e64d5f068c4382e8dcef705b4", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(versionAction, "40757e30ef9189f7b144e989121d759deb17d26e2f", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(versionsAction, "001a7d4c3ae8959e7e3022e9cb649e7634eb880b7f", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(diffAction, "60c7c4bd9311c812af3079f67f02316c4b907cfad6", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(restoreAction, "6086a98797250064ff51f29fbf579c9b5fb5ee1344", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(editorPreviewAction, "40bfc184339208cc33625bfbf7439164bfe195827a", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(patchAction, "6090aab0c1b2e014085cb912772a722ec130e2b556", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(sectionAction, "785715a80488f83e49eaaca78c6b167e1e0af0305b", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(createSiteAction, "401353221f6c5c80268fc824069017281f10a9a27b", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(createFromTemplateAction, "4081becb0042da473a7563fe0126416592c2ca9ebe", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(chooseSiteLocationAction, "40e8889380cd88c383646ab56d2e50580a96c0cd1d", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(designFirstAction, "4091eed8ef680b9e47cf8b58a641f0447e4cdfc0c1", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(assistantAction, "407ea4da56bf7d1cfe21bafadc859abdb8a9506c7b", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(assistantRunAction, "40e55c19574da2edee9ed5e034c5823c638950b042", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(approvePlanAction, "60774c2cdea79a8d90779bf45de58aa9be74c292c6", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(conversationAction, "00ebb5c478b8bac0e65f6b0c39b1721b3be480d800", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(saveContextAction, "401b64881c2c904aef39072d4079583fa7bb90d6ad", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(bookmarkAction, "60effe4ab97dc082d9056f84db1afa18043edb3727", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(runAction, "40a2466925104d38ea8605d0fed401ad7fa6d252bf", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(uploadSitePhotoAction, "4080b9b451ea5cc93374902d731696823f79a17c8c", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(templateFactsAction, "40891d770c81b195f2b10c5d1c4dff6fe2bdb4c5e3", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(publishSimpleAction, "401b09559e5bc95449e9ecec69d5744d09c555f7b4", null);
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

//# sourceMappingURL=wt-personnel_apps_web_02k-rep._.js.map