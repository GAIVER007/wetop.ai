(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/wt-personnel/apps/web/src/app/beauty/creation-key.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "clearPendingCreation",
    ()=>clearPendingCreation,
    "pendingCreation",
    ()=>pendingCreation,
    "useCreationKey",
    ()=>useCreationKey
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
'use client';
;
const storageKey = (scope, kind)=>`wetop:beauty:create:${scope}:${kind}`;
function pendingCreation(scope, kind) {
    try {
        return sessionStorage.getItem(storageKey(scope, kind));
    } catch  {
        return null;
    }
}
function clearPendingCreation(scope, kind, expectedId) {
    try {
        const key = storageKey(scope, kind);
        if (sessionStorage.getItem(key) === expectedId) sessionStorage.removeItem(key);
    } catch  {
    /* keep the key for a later confirmed recovery */ }
}
function useCreationKey(scope, kind, existing) {
    _s();
    const [id, setId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useCreationKey.useEffect": ()=>{
            if (existing) return;
            try {
                if (!scope) throw new Error('scope');
                const saved = pendingCreation(scope, kind) ?? crypto.randomUUID();
                sessionStorage.setItem(storageKey(scope, kind), saved);
                setId(saved);
            } catch  {
                setError('Для безопасного продолжения разрешите хранение данных этой вкладки. Объект ещё не создан.');
            }
        }
    }["useCreationKey.useEffect"], [
        scope,
        kind,
        existing
    ]);
    const clear = ()=>{
        try {
            clearPendingCreation(scope, kind, id);
        } catch  {
        /* no mutation */ }
    };
    return {
        id,
        error,
        clear
    };
}
_s(useCreationKey, "IWHefff1HJ8PD6CzEQwYByobkos=");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/app/beauty/data:6a46b4 [app-client] (ecmascript) <text/javascript>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "saveBeautyEmployeeLocations",
    ()=>$$RSC_SERVER_ACTION_7
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-client-wrapper.js [app-client] (ecmascript)");
/* __next_internal_action_entry_do_not_use__ [{"60abc013b5dbea7b8b9292befc773e2f4a40f551fa":{"name":"saveBeautyEmployeeLocations"}},"wt-personnel/apps/web/src/app/beauty/actions.ts",""] */ "use turbopack no side effects";
;
const $$RSC_SERVER_ACTION_7 = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createServerReference"])("60abc013b5dbea7b8b9292befc773e2f4a40f551fa", __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["callServer"], void 0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["findSourceMapURL"], "saveBeautyEmployeeLocations");
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/app/beauty/data:7c5f1a [app-client] (ecmascript) <text/javascript>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "saveBeautyEmployee",
    ()=>$$RSC_SERVER_ACTION_2
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-client-wrapper.js [app-client] (ecmascript)");
/* __next_internal_action_entry_do_not_use__ [{"605f624c9a7322c12bc33ed1e961cfab5f4be3dea0":{"name":"saveBeautyEmployee"}},"wt-personnel/apps/web/src/app/beauty/actions.ts",""] */ "use turbopack no side effects";
;
const $$RSC_SERVER_ACTION_2 = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createServerReference"])("605f624c9a7322c12bc33ed1e961cfab5f4be3dea0", __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["callServer"], void 0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["findSourceMapURL"], "saveBeautyEmployee");
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/app/beauty/data:a7bcb5 [app-client] (ecmascript) <text/javascript>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "loadBeautyEmployee",
    ()=>$$RSC_SERVER_ACTION_9
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-client-wrapper.js [app-client] (ecmascript)");
/* __next_internal_action_entry_do_not_use__ [{"408a4b37b5735c79c2a08991396d665af6781ac358":{"name":"loadBeautyEmployee"}},"wt-personnel/apps/web/src/app/beauty/actions.ts",""] */ "use turbopack no side effects";
;
const $$RSC_SERVER_ACTION_9 = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createServerReference"])("408a4b37b5735c79c2a08991396d665af6781ac358", __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["callServer"], void 0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["findSourceMapURL"], "loadBeautyEmployee");
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/app/my-work/data:3e6b1b [app-client] (ecmascript) <text/javascript>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "saveEmployeeServicePrice",
    ()=>$$RSC_SERVER_ACTION_2
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-client-wrapper.js [app-client] (ecmascript)");
/* __next_internal_action_entry_do_not_use__ [{"70d57a9256651bfa2247eb2f868fdfc181a6f42cdd":{"name":"saveEmployeeServicePrice"}},"wt-personnel/apps/web/src/app/my-work/actions.ts",""] */ "use turbopack no side effects";
;
const $$RSC_SERVER_ACTION_2 = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createServerReference"])("70d57a9256651bfa2247eb2f868fdfc181a6f42cdd", __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["callServer"], void 0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["findSourceMapURL"], "saveEmployeeServicePrice");
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/app/my-work/data:7b90e6 [app-client] (ecmascript) <text/javascript>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "savePortal",
    ()=>$$RSC_SERVER_ACTION_0
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-client-wrapper.js [app-client] (ecmascript)");
/* __next_internal_action_entry_do_not_use__ [{"789065d3d232e1a26a03316ef24c10ad4d389f7ac3":{"name":"savePortal"}},"wt-personnel/apps/web/src/app/my-work/actions.ts",""] */ "use turbopack no side effects";
;
const $$RSC_SERVER_ACTION_0 = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createServerReference"])("789065d3d232e1a26a03316ef24c10ad4d389f7ac3", __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["callServer"], void 0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["findSourceMapURL"], "savePortal");
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/app/my-work/data:9b1899 [app-client] (ecmascript) <text/javascript>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "loadPortalWeek",
    ()=>$$RSC_SERVER_ACTION_1
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-client-wrapper.js [app-client] (ecmascript)");
/* __next_internal_action_entry_do_not_use__ [{"60335ab786e08952807d64399406b9025324d076b2":{"name":"loadPortalWeek"}},"wt-personnel/apps/web/src/app/my-work/actions.ts",""] */ "use turbopack no side effects";
;
const $$RSC_SERVER_ACTION_1 = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createServerReference"])("60335ab786e08952807d64399406b9025324d076b2", __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["callServer"], void 0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["findSourceMapURL"], "loadPortalWeek");
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/app/my-work/data:c8949f [app-client] (ecmascript) <text/javascript>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "removeEmployeeServicePrice",
    ()=>$$RSC_SERVER_ACTION_3
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-client-wrapper.js [app-client] (ecmascript)");
/* __next_internal_action_entry_do_not_use__ [{"70bde5c2a7438fe8b77075f317bffd1523fe8fbb50":{"name":"removeEmployeeServicePrice"}},"wt-personnel/apps/web/src/app/my-work/actions.ts",""] */ "use turbopack no side effects";
;
const $$RSC_SERVER_ACTION_3 = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createServerReference"])("70bde5c2a7438fe8b77075f317bffd1523fe8fbb50", __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["callServer"], void 0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["findSourceMapURL"], "removeEmployeeServicePrice");
;
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
"[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "EmployeeCabinet",
    ()=>EmployeeCabinet
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/ui.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$money$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/money.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$employee$2d$portal$2f$forms$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/employee-portal/forms.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$employee$2d$portal$2f$media$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/employee-portal/media.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$employee$2d$portal$2f$management$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/employee-portal/management.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$employee$2d$portal$2f$locations$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/employee-portal/locations.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$employee$2d$portal$2f$service$2d$prices$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/employee-portal/service-prices.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$employee$2d$portal$2f$reviews$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/employee-portal/reviews.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$tabs$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/tabs.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$status$2f$beauty$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/status/beauty.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$status$2f$food$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/status/food.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$employee$2d$workspace$2f$workspace$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/employee-workspace/workspace.tsx [app-client] (ecmascript)");
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
function servicePriceLabel(service) {
    if (!service.available) return 'В этом филиале недоступна';
    if (service.priceType === 'FREE') return 'Бесплатно';
    if (service.priceType === 'UNFIXED') return 'Цена не задана';
    if (service.priceType === 'RANGE') {
        if (service.priceMinMinor != null && service.priceMaxMinor != null) {
            return `${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$money$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatMoney"])(service.priceMinMinor, service.currency)} - ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$money$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatMoney"])(service.priceMaxMinor, service.currency)}`;
        }
        if (service.priceMinMinor != null) return `от ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$money$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatMoney"])(service.priceMinMinor, service.currency)}`;
        if (service.priceMaxMinor != null) return `до ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$money$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatMoney"])(service.priceMaxMinor, service.currency)}`;
        return 'Цена не задана';
    }
    return service.priceMinor === null ? 'Цена не задана' : (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$money$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatMoney"])(service.priceMinor, service.currency);
}
function EmployeeCabinet({ initial, target, scope, locationAssignments, servicePrices, accountOptions, dayStatus }) {
    _s();
    const [data, setData] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(initial);
    const [draftEpoch, setDraftEpoch] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(0);
    const [invalidScope, setInvalidScope] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const registerGuard = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "EmployeeCabinet.useCallback[registerGuard]": ()=>{}
    }["EmployeeCabinet.useCallback[registerGuard]"], []);
    const context = {
        target,
        scope,
        onSaved: setData
    };
    const beauty = data.business.vertical === 'BEAUTY';
    const manager = data.access === 'MANAGER';
    const access = data.sectionAccess;
    const canEditProfile = !access || (manager ? access.employeesUpdate : access.journalUpdate);
    const showWork = !beauty || !access || access.appointmentsView;
    const showReviews = beauty && (!access || access.reviewsView);
    const showServices = beauty && (!access || access.servicesView);
    const showSchedule = !beauty || !access || access.journalView;
    const showPay = !beauty || !access || access.payrollView;
    const showMedia = !access || canEditProfile;
    const showManagement = manager && (!access || access.employeesUpdate);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "EmployeeCabinet.useEffect": ()=>{
            const invalidate = {
                "EmployeeCabinet.useEffect.invalidate": ()=>setInvalidScope(scope)
            }["EmployeeCabinet.useEffect.invalidate"];
            window.addEventListener('wetop-scope-switch', invalidate);
            return ({
                "EmployeeCabinet.useEffect": ()=>window.removeEventListener('wetop-scope-switch', invalidate)
            })["EmployeeCabinet.useEffect"];
        }
    }["EmployeeCabinet.useEffect"], [
        scope
    ]);
    if (invalidScope === scope) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$employee$2d$workspace$2f$workspace$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["EmployeeTransitionGuard"], {
        register: registerGuard,
        discard: ()=>setDraftEpoch((value)=>value + 1),
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "employee-portal",
            "data-testid": manager ? 'employee-manager' : beauty ? 'employee-self-master' : 'employee-self-waiter',
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("header", {
                    className: "panel portal-section portal-heading",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "portal-identity-line",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Badge"], {
                                            children: manager ? 'Управление сотрудником' : 'Мой кабинет'
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                            lineNumber: 78,
                                            columnNumber: 50
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                            children: data.employee.name
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                            lineNumber: 78,
                                            columnNumber: 117
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                    lineNumber: 78,
                                    columnNumber: 12
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                                    className: "portal-identity-meta",
                                    "aria-label": "Место работы и статус",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                            children: data.business.name
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                            lineNumber: 79,
                                            columnNumber: 81
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                            children: data.location?.name ?? 'Филиал не выбран'
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                            lineNumber: 79,
                                            columnNumber: 110
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                            children: beauty ? 'Мастер' : 'Сотрудник ресторана'
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                            lineNumber: 79,
                                            columnNumber: 162
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                            children: data.employee.active ? 'Активен' : 'В архиве'
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                            lineNumber: 79,
                                            columnNumber: 214
                                        }, this),
                                        beauty && data.employee.active && dayStatus && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                            "data-testid": "employee-day-status",
                                            children: dayStatus.state === 'ON_SHIFT' ? `На смене${dayStatus.hours ? `, ${dayStatus.hours}` : ''}` : dayStatus.state === 'OFF' ? 'Выходной' : 'График недоступен'
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                            lineNumber: 79,
                                            columnNumber: 318
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                    lineNumber: 79,
                                    columnNumber: 9
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                            lineNumber: 78,
                            columnNumber: 7
                        }, this),
                        data.avatar && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                            className: "portal-avatar",
                            src: data.avatar.url,
                            alt: `Фото: ${data.employee.name}`,
                            width: 96,
                            height: 96
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                            lineNumber: 81,
                            columnNumber: 23
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                    lineNumber: 77,
                    columnNumber: 5
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$tabs$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Tabs"], {
                    label: "Разделы кабинета",
                    className: "portal-tabs",
                    panels: [
                        {
                            id: 'professional',
                            label: 'Профиль',
                            content: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                                className: "panel portal-section",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                        children: "Профессиональный профиль"
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                        lineNumber: 84,
                                        columnNumber: 98
                                    }, this),
                                    canEditProfile ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$employee$2d$portal$2f$forms$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PortalForm"], {
                                        context: context,
                                        command: "profile",
                                        revision: data.profile.revision,
                                        profileRevision: data.employee.profileRevision,
                                        label: "Сохранить профиль",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                                                label: "Имя в карточке",
                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                                    name: "name",
                                                    required: true,
                                                    maxLength: 200,
                                                    defaultValue: data.employee.name
                                                }, void 0, false, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                    lineNumber: 87,
                                                    columnNumber: 39
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                lineNumber: 87,
                                                columnNumber: 9
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                                                label: "Телефон для связи",
                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                                    name: "phone",
                                                    type: "tel",
                                                    maxLength: 32,
                                                    defaultValue: data.employee.phone ?? ''
                                                }, void 0, false, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                    lineNumber: 88,
                                                    columnNumber: 42
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                lineNumber: 88,
                                                columnNumber: 9
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                                                label: "Почта для связи",
                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                                    name: "email",
                                                    type: "email",
                                                    maxLength: 320,
                                                    defaultValue: data.employee.email ?? ''
                                                }, void 0, false, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                    lineNumber: 89,
                                                    columnNumber: 40
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                lineNumber: 89,
                                                columnNumber: 9
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                                                label: "Специализация",
                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                                    name: "headline",
                                                    maxLength: 200,
                                                    defaultValue: data.profile.headline
                                                }, void 0, false, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                    lineNumber: 91,
                                                    columnNumber: 38
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                lineNumber: 91,
                                                columnNumber: 9
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                                                label: "О себе",
                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("textarea", {
                                                    name: "biography",
                                                    rows: 5,
                                                    maxLength: 5000,
                                                    defaultValue: data.profile.biography
                                                }, void 0, false, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                    lineNumber: 92,
                                                    columnNumber: 31
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                lineNumber: 92,
                                                columnNumber: 9
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                                                label: "Год начала практики",
                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                                    name: "practiceSinceYear",
                                                    type: "number",
                                                    min: 1900,
                                                    max: new Date().getUTCFullYear(),
                                                    defaultValue: data.profile.practiceSinceYear ?? ''
                                                }, void 0, false, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                    lineNumber: 93,
                                                    columnNumber: 44
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                lineNumber: 93,
                                                columnNumber: 9
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                        lineNumber: 86,
                                        columnNumber: 25
                                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dl", {
                                        className: "portal-pay-grid",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                                children: "Имя в карточке"
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                lineNumber: 95,
                                                columnNumber: 9
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                                children: data.employee.name
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                lineNumber: 95,
                                                columnNumber: 32
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                                children: "Телефон для связи"
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                lineNumber: 96,
                                                columnNumber: 9
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                                children: data.employee.phone ?? 'Не указан'
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                lineNumber: 96,
                                                columnNumber: 35
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                                children: "Почта для связи"
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                lineNumber: 97,
                                                columnNumber: 9
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                                children: data.employee.email ?? 'Не указана'
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                lineNumber: 97,
                                                columnNumber: 33
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                                children: "Специализация"
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                lineNumber: 98,
                                                columnNumber: 9
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                                children: data.profile.headline || 'Не указана'
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                lineNumber: 98,
                                                columnNumber: 31
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                                children: "О себе"
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                lineNumber: 99,
                                                columnNumber: 9
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                                children: data.profile.biography || 'Не указано'
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                lineNumber: 99,
                                                columnNumber: 24
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                                children: "Год начала практики"
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                lineNumber: 100,
                                                columnNumber: 9
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                                children: data.profile.practiceSinceYear ?? 'Не указан'
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                lineNumber: 100,
                                                columnNumber: 37
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                        lineNumber: 94,
                                        columnNumber: 23
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        children: "Контакты не публикуются. Почта для входа не изменится."
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                        lineNumber: 102,
                                        columnNumber: 7
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        children: data.profile.published ? 'Профиль опубликован' : 'Профиль не опубликован / ожидает одобрения'
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                        lineNumber: 103,
                                        columnNumber: 7
                                    }, this),
                                    data.profile.published && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                        href: `/specialists/${encodeURIComponent(data.profile.slug)}`,
                                        target: "_blank",
                                        rel: "noreferrer",
                                        children: "Открыть публичную страницу"
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                        lineNumber: 104,
                                        columnNumber: 34
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                lineNumber: 84,
                                columnNumber: 56
                            }, this)
                        },
                        ...showWork ? [
                            {
                                id: 'work',
                                label: beauty ? 'Записи' : 'Заказы',
                                content: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                                    className: "panel portal-section",
                                    "data-testid": "portal-own-work",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                            children: beauty ? 'Мои записи' : 'Мои заказы'
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                            lineNumber: 106,
                                            columnNumber: 155
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
                                            className: "portal-filters",
                                            method: "get",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                                                    label: "Дата записей",
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                                        name: "date",
                                                        type: "date"
                                                    }, void 0, false, {
                                                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                        lineNumber: 107,
                                                        columnNumber: 81
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                    lineNumber: 107,
                                                    columnNumber: 53
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                                                    label: "Месяц оплаты труда",
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                                        name: "month",
                                                        type: "month",
                                                        defaultValue: data.pay.month
                                                    }, void 0, false, {
                                                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                        lineNumber: 107,
                                                        columnNumber: 156
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                    lineNumber: 107,
                                                    columnNumber: 122
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                    className: "btn btn--secondary",
                                                    type: "submit",
                                                    children: "Показать"
                                                }, void 0, false, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                    lineNumber: 107,
                                                    columnNumber: 229
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                            lineNumber: 107,
                                            columnNumber: 7
                                        }, this),
                                        beauty ? data.appointments.length ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                                            className: "portal-list",
                                            children: data.appointments.map((a)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                                            children: a.serviceName
                                                        }, void 0, false, {
                                                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                            lineNumber: 108,
                                                            columnNumber: 115
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            children: a.date
                                                        }, void 0, false, {
                                                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                            lineNumber: 108,
                                                            columnNumber: 147
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            children: new Intl.DateTimeFormat('ru-RU', {
                                                                hour: '2-digit',
                                                                minute: '2-digit',
                                                                timeZone: data.location?.timezone ?? 'UTC'
                                                            }).format(new Date(a.startsAt))
                                                        }, void 0, false, {
                                                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                            lineNumber: 108,
                                                            columnNumber: 168
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            children: a.customerName
                                                        }, void 0, false, {
                                                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                            lineNumber: 108,
                                                            columnNumber: 328
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            children: __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$status$2f$beauty$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["beautyStatus"][a.status]?.label ?? 'Неизвестный статус'
                                                        }, void 0, false, {
                                                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                            lineNumber: 108,
                                                            columnNumber: 357
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$money$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatMoney"])(a.priceMinor, a.currency)
                                                        }, void 0, false, {
                                                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                            lineNumber: 108,
                                                            columnNumber: 446
                                                        }, this)
                                                    ]
                                                }, a.id, true, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                    lineNumber: 108,
                                                    columnNumber: 100
                                                }, this))
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                            lineNumber: 108,
                                            columnNumber: 44
                                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            children: "На выбранную дату записей нет"
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                            lineNumber: 108,
                                            columnNumber: 513
                                        }, this) : data.orders.length ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                                            className: "portal-list",
                                            children: data.orders.map((order)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                                            children: [
                                                                "Заказ №",
                                                                order.number
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                            lineNumber: 109,
                                                            columnNumber: 105
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            children: order.tableName ?? 'Стол не указан'
                                                        }, void 0, false, {
                                                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                            lineNumber: 109,
                                                            columnNumber: 143
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            children: __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$status$2f$food$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["foodOrderStatus"][order.status]?.label ?? 'Неизвестный статус'
                                                        }, void 0, false, {
                                                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                            lineNumber: 109,
                                                            columnNumber: 193
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$money$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatMoney"])(order.totalMinor, order.currency)
                                                        }, void 0, false, {
                                                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                            lineNumber: 109,
                                                            columnNumber: 283
                                                        }, this)
                                                    ]
                                                }, order.id, true, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                    lineNumber: 109,
                                                    columnNumber: 86
                                                }, this))
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                            lineNumber: 109,
                                            columnNumber: 32
                                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            children: "Собственных заказов за выбранный период нет"
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                            lineNumber: 109,
                                            columnNumber: 358
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                    lineNumber: 106,
                                    columnNumber: 83
                                }, this)
                            }
                        ] : [],
                        ...showReviews ? [
                            {
                                id: 'reviews',
                                label: 'Отзывы',
                                content: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$employee$2d$portal$2f$reviews$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["EmployeeReviews"], {
                                    reviews: data.reviews,
                                    timezone: data.location?.timezone ?? 'UTC'
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                    lineNumber: 114,
                                    columnNumber: 18
                                }, this)
                            }
                        ] : [],
                        ...showServices ? [
                            {
                                id: 'services',
                                label: 'Услуги',
                                content: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                                    className: "panel portal-section",
                                    "data-testid": "portal-services",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                            children: "Мои услуги"
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                            lineNumber: 116,
                                            columnNumber: 143
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            children: "Услуги, на которые к вам могут записаться. Цены устанавливает руководитель."
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                            lineNumber: 117,
                                            columnNumber: 7
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                                            className: "portal-list",
                                            "data-testid": "portal-assigned-services",
                                            children: data.services.filter((service)=>service.assigned).map((service)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                                            children: service.name
                                                        }, void 0, false, {
                                                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                            lineNumber: 118,
                                                            columnNumber: 157
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            children: [
                                                                service.durationMinutes,
                                                                " мин"
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                            lineNumber: 118,
                                                            columnNumber: 188
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            children: servicePriceLabel(service)
                                                        }, void 0, false, {
                                                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                            lineNumber: 118,
                                                            columnNumber: 230
                                                        }, this)
                                                    ]
                                                }, service.id, true, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                    lineNumber: 118,
                                                    columnNumber: 136
                                                }, this))
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                            lineNumber: 118,
                                            columnNumber: 7
                                        }, this),
                                        !data.services.some((service)=>service.assigned) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            children: "Услуги пока не выбраны"
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                            lineNumber: 119,
                                            columnNumber: 58
                                        }, this),
                                        manager && (!access || access.servicesUpdate) && servicePrices !== undefined && target.employeeId && (servicePrices ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$employee$2d$portal$2f$service$2d$prices$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["EmployeeServicePrices"], {
                                            employeeId: target.employeeId,
                                            scope: scope,
                                            initial: servicePrices
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                            lineNumber: 121,
                                            columnNumber: 11
                                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            role: "alert",
                                            children: "Не удалось загрузить цены мастера."
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                            lineNumber: 122,
                                            columnNumber: 11
                                        }, this)),
                                        canEditProfile && (!data.location ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            children: "Выберите филиал, чтобы увидеть действующие цены и назначить услуги."
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                            lineNumber: 123,
                                            columnNumber: 44
                                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("details", {
                                            className: "portal-service-picker",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("summary", {
                                                    role: "button",
                                                    className: "btn btn--secondary",
                                                    children: "Добавить услугу"
                                                }, void 0, false, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                    lineNumber: 123,
                                                    columnNumber: 164
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    children: "Отметьте услуги из каталога салона. Чтобы убрать услугу, снимите отметку."
                                                }, void 0, false, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                    lineNumber: 123,
                                                    columnNumber: 243
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$employee$2d$portal$2f$forms$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PortalForm"], {
                                                    context: context,
                                                    command: "services",
                                                    revision: data.servicesRevision,
                                                    label: "Сохранить услуги",
                                                    children: [
                                                        !data.services.length && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            children: "В каталоге пока нет услуг"
                                                        }, void 0, false, {
                                                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                            lineNumber: 124,
                                                            columnNumber: 35
                                                        }, this),
                                                        data.services.map((service)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                                className: "portal-service",
                                                                children: [
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                                        type: "checkbox",
                                                                        name: "serviceIds",
                                                                        value: service.id,
                                                                        defaultChecked: service.assigned
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                                        lineNumber: 125,
                                                                        columnNumber: 90
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                        children: [
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                                                                children: service.name
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                                                lineNumber: 125,
                                                                                columnNumber: 192
                                                                            }, this),
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("small", {
                                                                                className: "portal-service-meta",
                                                                                children: [
                                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                        children: [
                                                                                            service.durationMinutes,
                                                                                            " мин"
                                                                                        ]
                                                                                    }, void 0, true, {
                                                                                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                                                        lineNumber: 125,
                                                                                        columnNumber: 262
                                                                                    }, this),
                                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                        children: servicePriceLabel(service)
                                                                                    }, void 0, false, {
                                                                                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                                                        lineNumber: 125,
                                                                                        columnNumber: 304
                                                                                    }, this)
                                                                                ]
                                                                            }, void 0, true, {
                                                                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                                                lineNumber: 125,
                                                                                columnNumber: 223
                                                                            }, this)
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                                        lineNumber: 125,
                                                                        columnNumber: 186
                                                                    }, this)
                                                                ]
                                                            }, service.id, true, {
                                                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                                lineNumber: 125,
                                                                columnNumber: 39
                                                            }, this))
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                    lineNumber: 123,
                                                    columnNumber: 323
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                            lineNumber: 123,
                                            columnNumber: 121
                                        }, this))
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                    lineNumber: 116,
                                    columnNumber: 71
                                }, this)
                            }
                        ] : [],
                        ...beauty && manager && (!access || access.employeesUpdate) ? [
                            {
                                id: 'locations',
                                label: 'Филиалы',
                                content: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                                    className: "panel portal-section",
                                    "data-testid": "portal-locations",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                            children: "Филиалы"
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                            lineNumber: 128,
                                            columnNumber: 190
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            children: "Выберите филиалы, в которых принимает мастер."
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                            lineNumber: 129,
                                            columnNumber: 7
                                        }, this),
                                        locationAssignments && target.employeeId ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$employee$2d$portal$2f$locations$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["EmployeeLocationsForm"], {
                                            employeeId: target.employeeId,
                                            locations: locationAssignments
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                            lineNumber: 131,
                                            columnNumber: 11
                                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            children: "Назначение филиалов сейчас недоступно."
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                            lineNumber: 132,
                                            columnNumber: 11
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                    lineNumber: 128,
                                    columnNumber: 117
                                }, this)
                            }
                        ] : [],
                        ...showSchedule ? [
                            {
                                id: 'week',
                                label: 'График',
                                content: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "portal-schedule",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                                            className: "panel portal-section",
                                            "data-testid": "portal-week",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                                    children: "Обычная неделя"
                                                }, void 0, false, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                    lineNumber: 134,
                                                    columnNumber: 168
                                                }, this),
                                                !data.location ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    children: "Выберите филиал для недельного графика."
                                                }, void 0, false, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                    lineNumber: 135,
                                                    columnNumber: 25
                                                }, this) : manager && (!access || access.employeesUpdate) ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$employee$2d$portal$2f$forms$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PortalWeek"], {
                                                    context: context,
                                                    week: data.week,
                                                    revision: data.weekRevision
                                                }, void 0, false, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                    lineNumber: 135,
                                                    columnNumber: 123
                                                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$employee$2d$portal$2f$forms$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PortalWeekView"], {
                                                    week: data.week
                                                }, void 0, false, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                    lineNumber: 135,
                                                    columnNumber: 204
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                            lineNumber: 134,
                                            columnNumber: 100
                                        }, this),
                                        beauty && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                                            className: "panel portal-section",
                                            "data-testid": "portal-schedule-conflicts",
                                            "aria-live": "polite",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                                    children: "Записи и график"
                                                }, void 0, false, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                    lineNumber: 137,
                                                    columnNumber: 117
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    children: "Проверяем предстоящие собственные записи во всех назначенных филиалах по местному времени каждого филиала. Записи не отменены и не перенесены автоматически."
                                                }, void 0, false, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                    lineNumber: 138,
                                                    columnNumber: 7
                                                }, this),
                                                data.scheduleConflicts.items.length ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            role: "alert",
                                                            children: "Есть записи вне графика или в дни отсутствия. Согласуйте изменения с руководителем."
                                                        }, void 0, false, {
                                                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                            lineNumber: 139,
                                                            columnNumber: 48
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                                                            className: "portal-list",
                                                            children: data.scheduleConflicts.items.map((a)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                                                    children: [
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                                                            children: a.serviceName
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                                            lineNumber: 139,
                                                                            columnNumber: 233
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                            children: a.locationName
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                                            lineNumber: 139,
                                                                            columnNumber: 265
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                            children: [
                                                                                a.date,
                                                                                " ",
                                                                                new Intl.DateTimeFormat('ru-RU', {
                                                                                    hour: '2-digit',
                                                                                    minute: '2-digit',
                                                                                    timeZone: a.timezone
                                                                                }).format(new Date(a.startsAt)),
                                                                                " (",
                                                                                a.timezone,
                                                                                ")"
                                                                            ]
                                                                        }, void 0, true, {
                                                                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                                            lineNumber: 139,
                                                                            columnNumber: 294
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                            children: a.reason === 'TIME_OFF' ? 'В день отсутствия' : 'Вне рабочих часов'
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                                            lineNumber: 139,
                                                                            columnNumber: 456
                                                                        }, this)
                                                                    ]
                                                                }, a.id, true, {
                                                                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                                    lineNumber: 139,
                                                                    columnNumber: 218
                                                                }, this))
                                                        }, void 0, false, {
                                                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                            lineNumber: 139,
                                                            columnNumber: 151
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                    lineNumber: 139,
                                                    columnNumber: 46
                                                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    children: data.scheduleConflicts.truncated ? 'В проверенной части конфликтов нет.' : 'Предстоящих записей, противоречащих графику, нет.'
                                                }, void 0, false, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                    lineNumber: 139,
                                                    columnNumber: 556
                                                }, this),
                                                data.scheduleConflicts.truncated && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    role: "alert",
                                                    children: "Проверены только первые 500 предстоящих записей. Проверка неполная: остальные записи нужно проверить с руководителем."
                                                }, void 0, false, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                    lineNumber: 140,
                                                    columnNumber: 44
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                            lineNumber: 137,
                                            columnNumber: 16
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                    lineNumber: 134,
                                    columnNumber: 67
                                }, this)
                            }
                        ] : [],
                        ...showPay ? [
                            {
                                id: 'pay',
                                label: 'Оплата труда',
                                content: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                                    className: "panel portal-section",
                                    "data-testid": "portal-pay",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        "data-testid": "personal-finance",
                                        "data-month": data.pay.month,
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "portal-finance-top",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                                                children: "Мои финансы"
                                                            }, void 0, false, {
                                                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                                lineNumber: 144,
                                                                columnNumber: 48
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                children: "Оплата труда за выбранный месяц"
                                                            }, void 0, false, {
                                                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                                lineNumber: 144,
                                                                columnNumber: 68
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                        lineNumber: 144,
                                                        columnNumber: 43
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
                                                        className: "portal-finance-period",
                                                        method: "get",
                                                        action: "#pay",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                                                                label: "Месяц расчёта",
                                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                                                    name: "month",
                                                                    type: "month",
                                                                    defaultValue: data.pay.month,
                                                                    required: true
                                                                }, void 0, false, {
                                                                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                                    lineNumber: 144,
                                                                    columnNumber: 208
                                                                }, this)
                                                            }, void 0, false, {
                                                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                                lineNumber: 144,
                                                                columnNumber: 179
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                className: "btn btn--secondary",
                                                                type: "submit",
                                                                children: "Показать"
                                                            }, void 0, false, {
                                                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                                lineNumber: 144,
                                                                columnNumber: 290
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                        lineNumber: 144,
                                                        columnNumber: 112
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                lineNumber: 144,
                                                columnNumber: 7
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "portal-finance-kpis",
                                                children: [
                                                    [
                                                        'finance-earned',
                                                        'Начислено',
                                                        data.pay.status === 'AVAILABLE' ? data.pay.earnedMinor : null,
                                                        'Заработок по расчёту за месяц'
                                                    ],
                                                    [
                                                        'finance-paid',
                                                        'Выплачено',
                                                        data.pay.paidMinor,
                                                        'Выплаты, учтённые руководителем'
                                                    ],
                                                    [
                                                        'finance-remaining',
                                                        'Осталось к выплате',
                                                        data.pay.status === 'AVAILABLE' ? data.pay.remainingMinor : null,
                                                        'Остаток по данным расчёта'
                                                    ]
                                                ].map(([key, label, amount, hint])=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("article", {
                                                        "data-testid": key,
                                                        "data-amount": amount ?? undefined,
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                children: label
                                                            }, void 0, false, {
                                                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                                lineNumber: 149,
                                                                columnNumber: 119
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                                                children: amount === null ? key === 'finance-paid' ? 'Нет данных' : 'Нет расчёта' : (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$money$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatMoney"])(amount, data.pay.currency)
                                                            }, void 0, false, {
                                                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                                lineNumber: 149,
                                                                columnNumber: 139
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("small", {
                                                                children: hint
                                                            }, void 0, false, {
                                                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                                lineNumber: 149,
                                                                columnNumber: 259
                                                            }, this)
                                                        ]
                                                    }, key, true, {
                                                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                        lineNumber: 149,
                                                        columnNumber: 50
                                                    }, this))
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                lineNumber: 145,
                                                columnNumber: 7
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                role: "status",
                                                className: "portal-finance-notice",
                                                children: data.pay.status === 'AVAILABLE' ? 'Суммы получены из расчёта оплаты труда.' : data.pay.status === 'SELECT_LOCATION' ? 'Выберите филиал в общем переключателе филиалов, чтобы увидеть начисления, выплаты и остаток за месяц.' : data.pay.status === 'NOT_CONFIGURED' ? 'Условия оплаты ещё не настроены. Подтверждённые выплаты отображаются отдельно.' : 'Автоматический расчёт для салона пока недоступен. Выплаты и условия оплаты доступны ниже.'
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                lineNumber: 150,
                                                columnNumber: 7
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "portal-finance-extras",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                children: "Бонусы"
                                                            }, void 0, false, {
                                                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                                lineNumber: 151,
                                                                columnNumber: 49
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                                                children: data.pay.bonusMinor === null ? 'Не указаны' : (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$money$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatMoney"])(data.pay.bonusMinor, data.pay.currency)
                                                            }, void 0, false, {
                                                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                                lineNumber: 151,
                                                                columnNumber: 68
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                        lineNumber: 151,
                                                        columnNumber: 46
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                children: "Удержания"
                                                            }, void 0, false, {
                                                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                                lineNumber: 151,
                                                                columnNumber: 184
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                                                children: data.pay.penaltyMinor === null ? 'Не указаны' : (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$money$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatMoney"])(data.pay.penaltyMinor, data.pay.currency)
                                                            }, void 0, false, {
                                                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                                lineNumber: 151,
                                                                columnNumber: 206
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                        lineNumber: 151,
                                                        columnNumber: 181
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                lineNumber: 151,
                                                columnNumber: 7
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("details", {
                                                className: "portal-finance-conditions",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("summary", {
                                                        children: "Условия оплаты"
                                                    }, void 0, false, {
                                                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                        lineNumber: 152,
                                                        columnNumber: 54
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dl", {
                                                        className: "portal-pay-grid",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                                                children: "Модель"
                                                            }, void 0, false, {
                                                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                                lineNumber: 154,
                                                                columnNumber: 9
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                                                children: data.pay.model ? ({
                                                                    FIXED: 'Фиксированная',
                                                                    PERCENT: 'Процент',
                                                                    FIXED_PLUS_PERCENT: 'Фиксированная + процент',
                                                                    BONUS_ONLY: 'Только бонусы'
                                                                })[data.pay.model] : 'Не настроена'
                                                            }, void 0, false, {
                                                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                                lineNumber: 154,
                                                                columnNumber: 24
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                                                children: "Ставка"
                                                            }, void 0, false, {
                                                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                                lineNumber: 155,
                                                                columnNumber: 9
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                                                children: data.pay.fixedMinor === null ? 'Не настроена' : (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$money$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatMoney"])(data.pay.fixedMinor, data.pay.currency)
                                                            }, void 0, false, {
                                                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                                lineNumber: 155,
                                                                columnNumber: 24
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                                                children: "Процент"
                                                            }, void 0, false, {
                                                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                                lineNumber: 156,
                                                                columnNumber: 9
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                                                children: data.pay.percent === null ? 'Не настроен' : `${data.pay.percent}%`
                                                            }, void 0, false, {
                                                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                                lineNumber: 156,
                                                                columnNumber: 25
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                                                children: "База процента"
                                                            }, void 0, false, {
                                                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                                lineNumber: 157,
                                                                columnNumber: 9
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                                                children: data.pay.percentBasis === 'COMPLETED_SERVICES' ? 'Стоимость оказанных услуг' : data.pay.percentBasis === 'PAID_COMPLETED_SERVICES' ? 'Оплаченные оказанные услуги' : beauty ? 'Не настроена' : 'По закрытым заказам, расчёт сервера'
                                                            }, void 0, false, {
                                                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                                lineNumber: 157,
                                                                columnNumber: 31
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                        lineNumber: 153,
                                                        columnNumber: 7
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        children: data.pay.explanation
                                                    }, void 0, false, {
                                                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                        lineNumber: 159,
                                                        columnNumber: 7
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                lineNumber: 152,
                                                columnNumber: 7
                                            }, this),
                                            !!data.pay.adjustments.length && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                        children: "Бонусы и удержания: подробности"
                                                    }, void 0, false, {
                                                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                        lineNumber: 160,
                                                        columnNumber: 43
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                                                        className: "portal-list",
                                                        children: data.pay.adjustments.map((item)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                                                children: [
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                                                        children: item.reason
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                                        lineNumber: 160,
                                                                        columnNumber: 163
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                        children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$money$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatMoney"])(item.amountMinor, data.pay.currency)
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                                        lineNumber: 160,
                                                                        columnNumber: 193
                                                                    }, this)
                                                                ]
                                                            }, item.id, true, {
                                                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                                lineNumber: 160,
                                                                columnNumber: 145
                                                            }, this))
                                                    }, void 0, false, {
                                                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                        lineNumber: 160,
                                                        columnNumber: 83
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                lineNumber: 160,
                                                columnNumber: 41
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "portal-finance-footer",
                                                children: "Условия и выплаты меняет руководитель. Здесь вы видите свои данные."
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                                lineNumber: 161,
                                                columnNumber: 7
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                        lineNumber: 143,
                                        columnNumber: 134
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                    lineNumber: 143,
                                    columnNumber: 67
                                }, this)
                            }
                        ] : [],
                        ...showMedia ? [
                            {
                                id: 'media',
                                label: 'Фото и работы',
                                content: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$employee$2d$portal$2f$media$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PortalMedia"], {
                                    data: data,
                                    context: context
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                    lineNumber: 164,
                                    columnNumber: 72
                                }, this)
                            }
                        ] : [],
                        ...showManagement ? [
                            {
                                id: 'management',
                                label: 'Управление',
                                content: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$employee$2d$portal$2f$management$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PortalManagement"], {
                                    data: data,
                                    context: context,
                                    ...accountOptions === undefined ? {} : {
                                        accountOptions
                                    }
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                                    lineNumber: 169,
                                    columnNumber: 11
                                }, this)
                            }
                        ] : []
                    ]
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
                    lineNumber: 83,
                    columnNumber: 5
                }, this)
            ]
        }, `${scope}:${data.employee.id}:${draftEpoch}`, true, {
            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
            lineNumber: 76,
            columnNumber: 4
        }, this)
    }, void 0, false, {
        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/cabinet.tsx",
        lineNumber: 73,
        columnNumber: 10
    }, this);
}
_s(EmployeeCabinet, "oFXNBWWqKbXm7Dv9/wa6ll3g69Y=");
_c = EmployeeCabinet;
var _c;
__turbopack_context__.k.register(_c, "EmployeeCabinet");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/components/employee-portal/forms.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "PortalForm",
    ()=>PortalForm,
    "PortalWeek",
    ()=>PortalWeek,
    "PortalWeekView",
    ()=>PortalWeekView
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$my$2d$work$2f$data$3a$9b1899__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/my-work/data:9b1899 [app-client] (ecmascript) <text/javascript>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$my$2d$work$2f$data$3a$7b90e6__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/my-work/data:7b90e6 [app-client] (ecmascript) <text/javascript>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/ui.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$use$2d$confirm$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/use-confirm.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$employee$2d$workspace$2f$workspace$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/employee-workspace/workspace.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
'use client';
;
;
;
;
;
function PortalForm({ context, command, children, label = 'Сохранить', revision, profileRevision, testId }) {
    _s();
    const [pending, start] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTransition"])();
    const { ask, dialog } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$use$2d$confirm$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useConfirm"])();
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    const [saved, setSaved] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    // Dirty drafts keep their starting version; untouched forms can follow a sibling save.
    const [expectedRevision, setRevision] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(revision ?? '');
    const [expectedProfileRevision, setProfileRevision] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(profileRevision ?? '');
    const [dirty, setDirty] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [rebaseline, setRebaseline] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(0);
    const formRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "PortalForm.useEffect": ()=>{
            const form = formRef.current;
            if (!rebaseline || !form) return;
            form.dispatchEvent(new CustomEvent('employee-save-result', {
                bubbles: true,
                detail: {
                    success: true,
                    snapshot: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$employee$2d$workspace$2f$workspace$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["employeeFormSignature"])(form)
                }
            }));
        }
    }["PortalForm.useEffect"], [
        rebaseline
    ]);
    const alive = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(true);
    const requestVersion = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(0);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "PortalForm.useEffect": ()=>{
            alive.current = true;
            const invalidate = {
                "PortalForm.useEffect.invalidate": ()=>{
                    requestVersion.current++;
                }
            }["PortalForm.useEffect.invalidate"];
            window.addEventListener('wetop-scope-switch', invalidate);
            return ({
                "PortalForm.useEffect": ()=>{
                    alive.current = false;
                    requestVersion.current++;
                    window.removeEventListener('wetop-scope-switch', invalidate);
                }
            })["PortalForm.useEffect"];
        }
    }["PortalForm.useEffect"], [
        context.scope
    ]);
    // An untouched form follows the latest version; PortalWeek passes a newer one only when its hours match the server.
    const formRevision = dirty ? expectedRevision : revision ?? expectedRevision;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
                ref: formRef,
                "data-testid": testId ?? `portal-${command}-form`,
                className: "portal-form",
                "data-employee-transition-form": true,
                onReset: (event)=>event.preventDefault(),
                onChange: ()=>{
                    if (!dirty) setRevision(revision ?? expectedRevision);
                    setDirty(true);
                    setSaved(false);
                },
                onSubmit: (event)=>{
                    event.preventDefault();
                    const element = event.currentTarget;
                    const snapshot = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$employee$2d$workspace$2f$workspace$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["employeeFormSignature"])(element);
                    const form = new FormData(element);
                    const version = ++requestVersion.current;
                    setSaved(false);
                    setError('');
                    start(async ()=>{
                        try {
                            const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$my$2d$work$2f$data$3a$7b90e6__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__["savePortal"])(context.target, context.scope, command, form);
                            if (!alive.current || version !== requestVersion.current) return;
                            if (result.error || !result.data) {
                                setError(result.error || 'Не удалось подтвердить сохранение. Повторите попытку.');
                                element.dispatchEvent(new CustomEvent('employee-save-result', {
                                    bubbles: true,
                                    detail: {
                                        success: false
                                    }
                                }));
                                return;
                            }
                            element.dispatchEvent(new CustomEvent('employee-save-result', {
                                bubbles: true,
                                detail: {
                                    success: true,
                                    snapshot
                                }
                            }));
                            // Upload forms create a new item: the remounted fieldset comes back empty, so re-baseline after that render.
                            if (element.querySelector('input[type="file"]')) setRebaseline((n)=>n + 1);
                            context.onSaved(result.data);
                            setSaved(true);
                            setDirty(false);
                            if (command === 'profile') setProfileRevision(result.data.employee.profileRevision);
                            const next = command === 'services' ? result.data.servicesRevision : command === 'week' ? result.data.weekRevision : command === 'pay-policy' ? result.data.pay.policyRevision : result.data.profile.revision;
                            setRevision(next ?? '');
                        } catch  {
                            if (!alive.current || version !== requestVersion.current) return;
                            setError('Не удалось подтвердить сохранение. Ваш ввод сохранён в форме. Повторите попытку.');
                            element.dispatchEvent(new CustomEvent('employee-save-result', {
                                bubbles: true,
                                detail: {
                                    success: false
                                }
                            }));
                        }
                    });
                },
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                        type: "hidden",
                        name: "expectedRevision",
                        value: formRevision
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/forms.tsx",
                        lineNumber: 93,
                        columnNumber: 5
                    }, this),
                    command === 'profile' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                        type: "hidden",
                        name: "expectedProfileRevision",
                        value: expectedProfileRevision
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/forms.tsx",
                        lineNumber: 94,
                        columnNumber: 31
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("fieldset", {
                        disabled: pending,
                        children: [
                            children,
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                type: "submit",
                                disabled: pending,
                                children: pending ? 'Сохраняем…' : label
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/forms.tsx",
                                lineNumber: 97,
                                columnNumber: 7
                            }, this)
                        ]
                    }, formRevision, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/forms.tsx",
                        lineNumber: 95,
                        columnNumber: 5
                    }, this),
                    (pending || saved) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        role: "status",
                        children: pending ? 'Ждём подтверждение сервера…' : 'Сохранено на сервере'
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/forms.tsx",
                        lineNumber: 99,
                        columnNumber: 28
                    }, this),
                    error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Alert"], {
                        children: error
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/forms.tsx",
                        lineNumber: 100,
                        columnNumber: 15
                    }, this),
                    error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        children: "Ввод не сброшен. При конфликте откройте карточку в новой вкладке и сравните изменения."
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/forms.tsx",
                        lineNumber: 102,
                        columnNumber: 15
                    }, this),
                    error && command === 'profile' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                        type: "button",
                        tone: "secondary",
                        onClick: async ()=>{
                            if (!await ask({
                                title: 'Отменить черновик профиля?',
                                body: 'Несохранённые изменения будут потеряны. Вместо них загрузится актуальный профиль сотрудника.',
                                confirmLabel: 'Отменить черновик и загрузить профиль',
                                cancelLabel: 'Оставить черновик'
                            })) return;
                            window.location.reload();
                        },
                        children: "Отменить черновик и загрузить профиль"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/forms.tsx",
                        lineNumber: 103,
                        columnNumber: 40
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/forms.tsx",
                lineNumber: 48,
                columnNumber: 12
            }, this),
            dialog
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/forms.tsx",
        lineNumber: 48,
        columnNumber: 10
    }, this);
}
_s(PortalForm, "FPBnIpo4q49LCC93ZEu9xoBF9Nw=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTransition"],
        __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$use$2d$confirm$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useConfirm"]
    ];
});
_c = PortalForm;
const DAYS = [
    'Воскресенье',
    'Понедельник',
    'Вторник',
    'Среда',
    'Четверг',
    'Пятница',
    'Суббота'
];
function PortalWeekView({ week }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        "data-testid": "portal-week-view",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "portal-week-help",
                children: "График меняет руководитель. Нет часов: выходной."
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/forms.tsx",
                lineNumber: 117,
                columnNumber: 46
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                className: "portal-list",
                children: [
                    1,
                    2,
                    3,
                    4,
                    5,
                    6,
                    0
                ].map((weekday)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                children: DAYS[weekday]
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/forms.tsx",
                                lineNumber: 118,
                                columnNumber: 89
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: week.find((d)=>d.weekday === weekday)?.intervals.map((i)=>`${i.timeFrom}–${i.timeTo}`).join(', ') || 'Выходной'
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/forms.tsx",
                                lineNumber: 118,
                                columnNumber: 121
                            }, this)
                        ]
                    }, weekday, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/forms.tsx",
                        lineNumber: 118,
                        columnNumber: 71
                    }, this))
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/forms.tsx",
                lineNumber: 118,
                columnNumber: 5
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/forms.tsx",
        lineNumber: 117,
        columnNumber: 10
    }, this);
}
_c1 = PortalWeekView;
const weekDays = (week)=>[
        1,
        2,
        3,
        4,
        5,
        6,
        0
    ].map((weekday)=>({
            weekday,
            intervals: week.find((d)=>d.weekday === weekday)?.intervals.map((i)=>({
                    ...i
                })) ?? []
        }));
function PortalWeek({ week, revision, context }) {
    _s1();
    const [days, setDays] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        "PortalWeek.useState": ()=>weekDays(week)
    }["PortalWeek.useState"]);
    const [originalRevision, setOriginalRevision] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(revision);
    // The week version also moves when the profile is saved. When new server data arrives and the hours on screen still
    // equal the server's, the draft takes the new version; edited hours keep theirs and get a conflict, not a lost update.
    const [base, setBase] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(revision);
    const hours = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(days);
    hours.current = days;
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "PortalWeek.useEffect": ()=>{
            if (JSON.stringify(weekDays(week)) === JSON.stringify(hours.current)) setBase(revision);
        }
    }["PortalWeek.useEffect"], [
        revision,
        week
    ]);
    const [comparison, setComparison] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [readError, setReadError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    const [reading, reread] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTransition"])();
    const intervals = days.flatMap((day)=>day.intervals.map((slot)=>({
                weekday: day.weekday,
                ...slot
            })));
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(PortalForm, {
                context: context,
                command: "week",
                revision: base,
                label: "Сохранить график",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "portal-week-help",
                        children: "Рабочие часы по дням. Нет интервалов: выходной."
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/forms.tsx",
                        lineNumber: 137,
                        columnNumber: 5
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                        type: "hidden",
                        name: "intervals",
                        value: JSON.stringify(intervals)
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/forms.tsx",
                        lineNumber: 138,
                        columnNumber: 5
                    }, this),
                    days.map((day)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "portal-week-row",
                            role: "group",
                            "aria-label": DAYS[day.weekday],
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "portal-day-full",
                                            children: DAYS[day.weekday]
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/forms.tsx",
                                            lineNumber: 140,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("abbr", {
                                            className: "portal-day-short",
                                            title: DAYS[day.weekday],
                                            children: [
                                                'Вс',
                                                'Пн',
                                                'Вт',
                                                'Ср',
                                                'Чт',
                                                'Пт',
                                                'Сб'
                                            ][day.weekday]
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/forms.tsx",
                                            lineNumber: 140,
                                            columnNumber: 75
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/forms.tsx",
                                    lineNumber: 140,
                                    columnNumber: 7
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "portal-week-slots",
                                    children: [
                                        !day.intervals.length && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: "Выходной"
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/forms.tsx",
                                            lineNumber: 142,
                                            columnNumber: 33
                                        }, this),
                                        day.intervals.map((slot, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "portal-time-row",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                        className: "portal-time-field",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                children: "С"
                                                            }, void 0, false, {
                                                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/forms.tsx",
                                                                lineNumber: 144,
                                                                columnNumber: 46
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                                                "aria-label": `${DAYS[day.weekday]}: начало`,
                                                                type: "time",
                                                                required: true,
                                                                value: slot.timeFrom,
                                                                onChange: (e)=>setDays((prev)=>prev.map((d)=>d.weekday === day.weekday ? {
                                                                                ...d,
                                                                                intervals: d.intervals.map((s, i)=>i === index ? {
                                                                                        ...s,
                                                                                        timeFrom: e.target.value
                                                                                    } : s)
                                                                            } : d))
                                                            }, void 0, false, {
                                                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/forms.tsx",
                                                                lineNumber: 144,
                                                                columnNumber: 60
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/forms.tsx",
                                                        lineNumber: 144,
                                                        columnNumber: 9
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                        className: "portal-time-field",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                children: "До"
                                                            }, void 0, false, {
                                                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/forms.tsx",
                                                                lineNumber: 145,
                                                                columnNumber: 46
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                                                "aria-label": `${DAYS[day.weekday]}: до, интервал ${index + 1}`,
                                                                type: "time",
                                                                required: true,
                                                                value: slot.timeTo,
                                                                onChange: (e)=>setDays((prev)=>prev.map((d)=>d.weekday === day.weekday ? {
                                                                                ...d,
                                                                                intervals: d.intervals.map((s, i)=>i === index ? {
                                                                                        ...s,
                                                                                        timeTo: e.target.value
                                                                                    } : s)
                                                                            } : d))
                                                            }, void 0, false, {
                                                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/forms.tsx",
                                                                lineNumber: 145,
                                                                columnNumber: 61
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/forms.tsx",
                                                        lineNumber: 145,
                                                        columnNumber: 9
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                                        type: "button",
                                                        tone: "secondary",
                                                        "aria-label": `${DAYS[day.weekday]}: убрать интервал ${index + 1}`,
                                                        onClick: ()=>setDays((prev)=>prev.map((d)=>d.weekday === day.weekday ? {
                                                                        ...d,
                                                                        intervals: d.intervals.filter((_, i)=>i !== index)
                                                                    } : d)),
                                                        children: "−"
                                                    }, void 0, false, {
                                                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/forms.tsx",
                                                        lineNumber: 146,
                                                        columnNumber: 9
                                                    }, this)
                                                ]
                                            }, index, true, {
                                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/forms.tsx",
                                                lineNumber: 143,
                                                columnNumber: 43
                                            }, this))
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/forms.tsx",
                                    lineNumber: 141,
                                    columnNumber: 7
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                    type: "button",
                                    tone: "secondary",
                                    "aria-label": `${DAYS[day.weekday]}: добавить интервал`,
                                    onClick: ()=>setDays((prev)=>prev.map((d)=>d.weekday === day.weekday ? {
                                                    ...d,
                                                    intervals: [
                                                        ...d.intervals,
                                                        {
                                                            timeFrom: '',
                                                            timeTo: ''
                                                        }
                                                    ]
                                                } : d)),
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            "aria-hidden": "true",
                                            children: "+"
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/forms.tsx",
                                            lineNumber: 149,
                                            columnNumber: 249
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "portal-add-label",
                                            children: " Ещё время"
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/forms.tsx",
                                            lineNumber: 149,
                                            columnNumber: 282
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/forms.tsx",
                                    lineNumber: 149,
                                    columnNumber: 7
                                }, this)
                            ]
                        }, day.weekday, true, {
                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/forms.tsx",
                            lineNumber: 139,
                            columnNumber: 22
                        }, this))
                ]
            }, originalRevision, true, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/forms.tsx",
                lineNumber: 136,
                columnNumber: 12
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                type: "button",
                tone: "secondary",
                disabled: reading,
                onClick: ()=>reread(async ()=>{
                        const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$my$2d$work$2f$data$3a$9b1899__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__["loadPortalWeek"])(context.target, context.scope);
                        setReadError(result.error ?? '');
                        if (result.data) setComparison(result.data);
                    }),
                children: "Сравнить с актуальным графиком"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/forms.tsx",
                lineNumber: 152,
                columnNumber: 5
            }, this),
            readError && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Alert"], {
                children: readError
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/forms.tsx",
                lineNumber: 157,
                columnNumber: 19
            }, this),
            comparison && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                "aria-label": "Сохранено на сервере",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                        children: "Сохранено на сервере"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/forms.tsx",
                        lineNumber: 159,
                        columnNumber: 7
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                        children: comparison.week.map((day)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                children: [
                                    DAYS[day.weekday],
                                    ": ",
                                    day.intervals.map((i)=>`${i.timeFrom} до ${i.timeTo}`).join(', ') || 'Выходной'
                                ]
                            }, day.weekday, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/forms.tsx",
                                lineNumber: 160,
                                columnNumber: 39
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/forms.tsx",
                        lineNumber: 160,
                        columnNumber: 7
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        children: "Ваш ввод остаётся в форме. Принятие сохранённого графика заменит черновик."
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/forms.tsx",
                        lineNumber: 161,
                        columnNumber: 7
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                        type: "button",
                        tone: "secondary",
                        onClick: ()=>{
                            setDays(weekDays(comparison.week));
                            setOriginalRevision(comparison.weekRevision);
                            setBase(comparison.weekRevision);
                            setComparison(null);
                        },
                        children: "Принять сохранённый график"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/forms.tsx",
                        lineNumber: 162,
                        columnNumber: 7
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/forms.tsx",
                lineNumber: 158,
                columnNumber: 20
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/forms.tsx",
        lineNumber: 136,
        columnNumber: 10
    }, this);
}
_s1(PortalWeek, "Sw6u9P6pO3nPBaVZUtcwcoHS9xc=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTransition"]
    ];
});
_c2 = PortalWeek;
var _c, _c1, _c2;
__turbopack_context__.k.register(_c, "PortalForm");
__turbopack_context__.k.register(_c1, "PortalWeekView");
__turbopack_context__.k.register(_c2, "PortalWeek");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/components/employee-portal/locations.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "EmployeeLocationsForm",
    ()=>EmployeeLocationsForm
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$beauty$2f$data$3a$6a46b4__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/beauty/data:6a46b4 [app-client] (ecmascript) <text/javascript>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/ui.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
;
function EmployeeLocationsForm({ employeeId, locations }) {
    _s();
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"])();
    const [state, action, pending] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useActionState"])({
        "EmployeeLocationsForm.useActionState": async (previous, form)=>{
            const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$beauty$2f$data$3a$6a46b4__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__["saveBeautyEmployeeLocations"])(previous, form);
            if (!result.error) router.refresh();
            return result;
        }
    }["EmployeeLocationsForm.useActionState"], null);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
        action: action,
        className: "beauty-form",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                type: "hidden",
                name: "id",
                value: employeeId
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/locations.tsx",
                lineNumber: 30,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("fieldset", {
                className: "beauty-skills",
                disabled: pending,
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("legend", {
                        children: "Где мастер работает"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/locations.tsx",
                        lineNumber: 32,
                        columnNumber: 9
                    }, this),
                    locations.map((location)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                            className: "beauty-check",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                    type: "checkbox",
                                    name: "locationIds",
                                    value: location.id,
                                    defaultChecked: location.assigned
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/locations.tsx",
                                    lineNumber: 35,
                                    columnNumber: 13
                                }, this),
                                location.name
                            ]
                        }, location.id, true, {
                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/locations.tsx",
                            lineNumber: 34,
                            columnNumber: 11
                        }, this))
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/locations.tsx",
                lineNumber: 31,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "beauty-note",
                children: "Снятый филиал забирает и график мастера в нём. Если там остались будущие записи, филиал не снимется: сначала разберитесь с записями."
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/locations.tsx",
                lineNumber: 45,
                columnNumber: 7
            }, this),
            state?.error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Alert"], {
                children: state.error
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/locations.tsx",
                lineNumber: 49,
                columnNumber: 24
            }, this),
            state?.message && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                role: "status",
                children: state.message
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/locations.tsx",
                lineNumber: 50,
                columnNumber: 26
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                type: "submit",
                disabled: pending,
                children: pending ? 'Сохраняем…' : 'Сохранить филиалы'
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/locations.tsx",
                lineNumber: 51,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/locations.tsx",
        lineNumber: 29,
        columnNumber: 5
    }, this);
}
_s(EmployeeLocationsForm, "+FOZ+6QHSK4njYQ35fWoFEYT0jc=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"],
        __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useActionState"]
    ];
});
_c = EmployeeLocationsForm;
var _c;
__turbopack_context__.k.register(_c, "EmployeeLocationsForm");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/components/employee-portal/management.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "PortalManagement",
    ()=>PortalManagement
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/ui.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$money$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/money.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$employee$2d$portal$2f$forms$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/employee-portal/forms.tsx [app-client] (ecmascript)");
'use client';
;
;
;
;
function PortalManagement({ data, context, accountOptions }) {
    if (data.access !== 'MANAGER') return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        className: "panel portal-section",
        "data-testid": "portal-manager-controls",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                children: "Настройки руководителя"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/management.tsx",
                lineNumber: 20,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                children: "Публичная страница"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/management.tsx",
                lineNumber: 21,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                children: "Публикуются только одобренные профессиональные сведения и работы с согласием. Контакты, заказы и оплата труда остаются закрытыми."
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/management.tsx",
                lineNumber: 22,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$employee$2d$portal$2f$forms$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PortalForm"], {
                context: context,
                command: "publication",
                revision: data.profile.revision,
                label: "Сохранить публикацию",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                name: "publicationConsent",
                                type: "checkbox",
                                defaultChecked: data.profile.publicationConsent
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/management.tsx",
                                lineNumber: 24,
                                columnNumber: 14
                            }, this),
                            " Получено согласие на публичную страницу"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/management.tsx",
                        lineNumber: 24,
                        columnNumber: 7
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                name: "published",
                                type: "checkbox",
                                defaultChecked: data.profile.published
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/management.tsx",
                                lineNumber: 25,
                                columnNumber: 14
                            }, this),
                            " Одобрить публикацию профиля"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/management.tsx",
                        lineNumber: 25,
                        columnNumber: 7
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/management.tsx",
                lineNumber: 23,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                children: "Статус"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/management.tsx",
                lineNumber: 27,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                children: [
                    "Сейчас ",
                    data.employee.active ? 'активен' : 'в архиве',
                    ". Архивный мастер не показывается в журнале и онлайн-записи, его записи и история остаются."
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/management.tsx",
                lineNumber: 28,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$employee$2d$portal$2f$forms$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PortalForm"], {
                context: context,
                command: "active",
                label: data.employee.active ? 'Убрать в архив' : 'Вернуть из архива',
                testId: "portal-active-form",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                    type: "hidden",
                    name: "active",
                    value: data.employee.active ? 'false' : 'true'
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/management.tsx",
                    lineNumber: 39,
                    columnNumber: 7
                }, this)
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/management.tsx",
                lineNumber: 33,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                children: "Доступ сотрудника"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/management.tsx",
                lineNumber: 41,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                children: [
                    data.employee.accountLinked ? 'Аккаунт привязан.' : 'Аккаунт не привязан. Личный кабинет пока недоступен.',
                    " Используйте существующий вход по коду или приглашение в команду, без создания пароля."
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/management.tsx",
                lineNumber: 42,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                href: "/team",
                children: "Участники команды и приглашения"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/management.tsx",
                lineNumber: 43,
                columnNumber: 5
            }, this),
            !data.employee.accountLinked && accountOptions === null && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                role: "alert",
                children: "Не удалось загрузить участников команды. Обновите страницу и попробуйте снова."
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/management.tsx",
                lineNumber: 45,
                columnNumber: 7
            }, this),
            !data.employee.accountLinked && accountOptions !== undefined && accountOptions !== null && accountOptions.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                children: "Нет подтверждённых участников с доступом к этому филиалу. Сначала добавьте участника в команду или настройте его доступ."
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/management.tsx",
                lineNumber: 48,
                columnNumber: 7
            }, this),
            !data.employee.accountLinked && accountOptions && accountOptions.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$employee$2d$portal$2f$forms$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PortalForm"], {
                context: context,
                command: "account",
                label: "Привязать подтверждённого участника",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                        label: "Участник команды",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Select"], {
                            name: "userId",
                            required: true,
                            defaultValue: "",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                    value: "",
                                    disabled: true,
                                    children: "Выберите участника"
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/management.tsx",
                                    lineNumber: 54,
                                    columnNumber: 13
                                }, this),
                                accountOptions.map((option)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                        value: option.userId,
                                        children: option.label
                                    }, option.userId, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/management.tsx",
                                        lineNumber: 55,
                                        columnNumber: 45
                                    }, this))
                            ]
                        }, void 0, true, {
                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/management.tsx",
                            lineNumber: 53,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/management.tsx",
                        lineNumber: 52,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        children: "Сервер повторно проверит активное членство, подтверждённый вход и доступ к филиалу."
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/management.tsx",
                        lineNumber: 58,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/management.tsx",
                lineNumber: 51,
                columnNumber: 7
            }, this),
            data.employee.accountLinked && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$employee$2d$portal$2f$forms$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PortalForm"], {
                context: context,
                command: "unlink",
                label: "Отвязать аккаунт"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/management.tsx",
                lineNumber: 61,
                columnNumber: 37
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                children: "Условия оплаты труда"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/management.tsx",
                lineNumber: 62,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$employee$2d$portal$2f$forms$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PortalForm"], {
                context: context,
                command: "pay",
                label: "Сохранить условия оплаты",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                        label: "Модель оплаты",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Select"], {
                            name: "model",
                            defaultValue: data.pay.model ?? '',
                            required: true,
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                    value: "",
                                    disabled: true,
                                    children: "Выберите модель"
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/management.tsx",
                                    lineNumber: 64,
                                    columnNumber: 102
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                    value: "FIXED",
                                    children: "Фиксированная"
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/management.tsx",
                                    lineNumber: 64,
                                    columnNumber: 152
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                    value: "PERCENT",
                                    children: "Процент"
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/management.tsx",
                                    lineNumber: 64,
                                    columnNumber: 196
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                    value: "FIXED_PLUS_PERCENT",
                                    children: "Фиксированная + процент"
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/management.tsx",
                                    lineNumber: 64,
                                    columnNumber: 236
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                    value: "BONUS_ONLY",
                                    children: "Только бонусы"
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/management.tsx",
                                    lineNumber: 64,
                                    columnNumber: 303
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/management.tsx",
                            lineNumber: 64,
                            columnNumber: 36
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/management.tsx",
                        lineNumber: 64,
                        columnNumber: 7
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                        label: `Фиксированная ставка, ${data.pay.currency === 'KZT' ? '₸' : data.pay.currency}`,
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                            name: "fixedAmount",
                            inputMode: "decimal",
                            required: true,
                            defaultValue: data.pay.fixedMinor === null ? '' : (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$money$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["minorToInput"])(data.pay.fixedMinor)
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/management.tsx",
                            lineNumber: 65,
                            columnNumber: 103
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/management.tsx",
                        lineNumber: 65,
                        columnNumber: 7
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                        label: "Процент, от 0 до 100",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                            name: "percent",
                            type: "number",
                            min: 0,
                            max: 100,
                            step: 1,
                            required: true,
                            defaultValue: data.pay.percent ?? ''
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/management.tsx",
                            lineNumber: 66,
                            columnNumber: 43
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/management.tsx",
                        lineNumber: 66,
                        columnNumber: 7
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        children: "Введите сумму в выбранной валюте. Расчёт выполняет сервер."
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/management.tsx",
                        lineNumber: 67,
                        columnNumber: 7
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/management.tsx",
                lineNumber: 63,
                columnNumber: 5
            }, this),
            data.business.vertical === 'BEAUTY' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                        children: "База процента для бизнеса"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/management.tsx",
                        lineNumber: 70,
                        columnNumber: 7
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        children: "Настройка общая для бизнеса, а не только для этого сотрудника. Неподдерживаемые закрытые периоды и возвраты не рассчитываются в браузере."
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/management.tsx",
                        lineNumber: 71,
                        columnNumber: 7
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$employee$2d$portal$2f$forms$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PortalForm"], {
                        context: context,
                        command: "pay-policy",
                        revision: data.pay.policyRevision,
                        label: "Сохранить базу процента",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                            label: "База процента",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Select"], {
                                name: "percentBasis",
                                required: true,
                                defaultValue: data.pay.percentBasis ?? '',
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                        value: "",
                                        disabled: true,
                                        children: "Не настроена"
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/management.tsx",
                                        lineNumber: 73,
                                        columnNumber: 118
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                        value: "COMPLETED_SERVICES",
                                        children: "Стоимость оказанных услуг"
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/management.tsx",
                                        lineNumber: 73,
                                        columnNumber: 165
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                        value: "PAID_COMPLETED_SERVICES",
                                        children: "Оплаченные оказанные услуги"
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/management.tsx",
                                        lineNumber: 73,
                                        columnNumber: 234
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/management.tsx",
                                lineNumber: 73,
                                columnNumber: 38
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/management.tsx",
                            lineNumber: 73,
                            columnNumber: 9
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/management.tsx",
                        lineNumber: 72,
                        columnNumber: 7
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/management.tsx",
                lineNumber: 69,
                columnNumber: 45
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/management.tsx",
        lineNumber: 19,
        columnNumber: 10
    }, this);
}
_c = PortalManagement;
var _c;
__turbopack_context__.k.register(_c, "PortalManagement");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/components/employee-portal/media.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "PortalMedia",
    ()=>PortalMedia
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/ui.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$employee$2d$portal$2f$forms$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/employee-portal/forms.tsx [app-client] (ecmascript)");
'use client';
;
;
;
function PortalMedia({ data, context }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                className: "panel portal-section",
                "data-testid": "portal-avatar",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                        children: "Фото профиля"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/media.tsx",
                        lineNumber: 7,
                        columnNumber: 75
                    }, this),
                    data.avatar ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                        className: "portal-avatar",
                        src: data.avatar.url,
                        alt: `Фото: ${data.employee.name}`,
                        width: 120,
                        height: 120
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/media.tsx",
                        lineNumber: 8,
                        columnNumber: 22
                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        children: "Фото пока нет"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/media.tsx",
                        lineNumber: 8,
                        columnNumber: 141
                    }, this),
                    data.canUpload ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                children: "JPG, PNG или WebP до 5 МиБ. Старое фото остаётся до подтверждения загрузки сервером."
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/media.tsx",
                                lineNumber: 10,
                                columnNumber: 9
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$employee$2d$portal$2f$forms$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PortalForm"], {
                                context: context,
                                command: "avatar",
                                label: "Загрузить фото",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                                    label: "Новое фото",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                        name: "file",
                                        type: "file",
                                        accept: "image/jpeg,image/png,image/webp",
                                        required: true
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/media.tsx",
                                        lineNumber: 11,
                                        columnNumber: 105
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/media.tsx",
                                    lineNumber: 11,
                                    columnNumber: 79
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/media.tsx",
                                lineNumber: 11,
                                columnNumber: 9
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/media.tsx",
                        lineNumber: 9,
                        columnNumber: 25
                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        role: "status",
                        children: "Хранилище изображений не подключено. Загрузка фото временно недоступна."
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/media.tsx",
                        lineNumber: 12,
                        columnNumber: 13
                    }, this),
                    data.avatar && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$employee$2d$portal$2f$forms$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PortalForm"], {
                        context: context,
                        command: "remove-avatar",
                        label: "Удалить фото"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/media.tsx",
                        lineNumber: 13,
                        columnNumber: 23
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/media.tsx",
                lineNumber: 7,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                className: "panel portal-section",
                "data-testid": "portal-portfolio",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                        children: "Портфолио"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/media.tsx",
                        lineNumber: 15,
                        columnNumber: 78
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        children: "Без согласия на публикацию работа не показывается клиентам. Изменения сотрудника требуют повторного одобрения руководителя."
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/media.tsx",
                        lineNumber: 16,
                        columnNumber: 7
                    }, this),
                    !data.portfolio.length && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        children: "Работ пока нет. Добавьте первую работу как черновик."
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/media.tsx",
                        lineNumber: 17,
                        columnNumber: 34
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "portal-gallery",
                        children: data.portfolio.map((work)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("article", {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                                        src: work.image.url,
                                        alt: work.title,
                                        width: work.image.width,
                                        height: work.image.height
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/media.tsx",
                                        lineNumber: 19,
                                        columnNumber: 9
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                        children: work.title
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/media.tsx",
                                        lineNumber: 20,
                                        columnNumber: 9
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        children: work.published ? 'Опубликовано' : 'Черновик / ожидает одобрения'
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/media.tsx",
                                        lineNumber: 21,
                                        columnNumber: 9
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("details", {
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("summary", {
                                                children: "Редактировать работу"
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/media.tsx",
                                                lineNumber: 22,
                                                columnNumber: 18
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$employee$2d$portal$2f$forms$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PortalForm"], {
                                                context: context,
                                                command: "work",
                                                label: "Сохранить работу",
                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(WorkFields, {
                                                    data: data,
                                                    work: work
                                                }, void 0, false, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/media.tsx",
                                                    lineNumber: 23,
                                                    columnNumber: 79
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/media.tsx",
                                                lineNumber: 23,
                                                columnNumber: 9
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$employee$2d$portal$2f$forms$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PortalForm"], {
                                                context: context,
                                                command: "remove-work",
                                                label: "Удалить работу",
                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                    type: "hidden",
                                                    name: "workId",
                                                    value: work.id
                                                }, void 0, false, {
                                                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/media.tsx",
                                                    lineNumber: 24,
                                                    columnNumber: 84
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/media.tsx",
                                                lineNumber: 24,
                                                columnNumber: 9
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/media.tsx",
                                        lineNumber: 22,
                                        columnNumber: 9
                                    }, this)
                                ]
                            }, work.id, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/media.tsx",
                                lineNumber: 18,
                                columnNumber: 67
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/media.tsx",
                        lineNumber: 18,
                        columnNumber: 7
                    }, this),
                    data.canUpload && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("details", {
                        className: "portal-add-work",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("summary", {
                                children: "Добавить работу"
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/media.tsx",
                                lineNumber: 27,
                                columnNumber: 63
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$employee$2d$portal$2f$forms$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PortalForm"], {
                                context: context,
                                command: "add-work",
                                label: "Добавить работу",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                                        label: "Фото работы",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                            name: "file",
                                            type: "file",
                                            accept: "image/jpeg,image/png,image/webp",
                                            required: true
                                        }, void 0, false, {
                                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/media.tsx",
                                            lineNumber: 29,
                                            columnNumber: 36
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/media.tsx",
                                        lineNumber: 29,
                                        columnNumber: 9
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(WorkFields, {
                                        data: data
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/media.tsx",
                                        lineNumber: 30,
                                        columnNumber: 9
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/media.tsx",
                                lineNumber: 28,
                                columnNumber: 7
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/media.tsx",
                        lineNumber: 27,
                        columnNumber: 26
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/media.tsx",
                lineNumber: 15,
                columnNumber: 5
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/media.tsx",
        lineNumber: 6,
        columnNumber: 10
    }, this);
}
_c = PortalMedia;
function WorkFields({ data, work }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            work && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                type: "hidden",
                name: "workId",
                value: work.id
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/media.tsx",
                lineNumber: 38,
                columnNumber: 14
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                label: "Название работы",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                    name: "title",
                    required: true,
                    maxLength: 200,
                    defaultValue: work?.title ?? ''
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/media.tsx",
                    lineNumber: 39,
                    columnNumber: 36
                }, this)
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/media.tsx",
                lineNumber: 39,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                label: "Описание работы",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("textarea", {
                    name: "description",
                    rows: 3,
                    maxLength: 2000,
                    defaultValue: work?.description ?? ''
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/media.tsx",
                    lineNumber: 40,
                    columnNumber: 36
                }, this)
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/media.tsx",
                lineNumber: 40,
                columnNumber: 5
            }, this),
            data.business.vertical === 'BEAUTY' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                label: "Услуга работы",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Select"], {
                    name: "serviceId",
                    defaultValue: work?.serviceId ?? '',
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                            value: "",
                            children: "Без привязки к услуге"
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/media.tsx",
                            lineNumber: 41,
                            columnNumber: 136
                        }, this),
                        data.services.map((s)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                value: s.id,
                                children: s.name
                            }, s.id, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/media.tsx",
                                lineNumber: 41,
                                columnNumber: 207
                            }, this))
                    ]
                }, void 0, true, {
                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/media.tsx",
                    lineNumber: 41,
                    columnNumber: 74
                }, this)
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/media.tsx",
                lineNumber: 41,
                columnNumber: 45
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                        type: "checkbox",
                        name: "publicationConsent",
                        defaultChecked: work?.publicationConsent ?? false
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/media.tsx",
                        lineNumber: 42,
                        columnNumber: 12
                    }, this),
                    " Есть согласие на публичный показ этой работы"
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/media.tsx",
                lineNumber: 42,
                columnNumber: 5
            }, this),
            data.access === 'MANAGER' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                        type: "checkbox",
                        name: "published",
                        defaultChecked: work?.published ?? false
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/media.tsx",
                        lineNumber: 43,
                        columnNumber: 42
                    }, this),
                    " Одобрить публикацию работы"
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/media.tsx",
                lineNumber: 43,
                columnNumber: 35
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/media.tsx",
        lineNumber: 37,
        columnNumber: 10
    }, this);
}
_c1 = WorkFields;
var _c, _c1;
__turbopack_context__.k.register(_c, "PortalMedia");
__turbopack_context__.k.register(_c1, "WorkFields");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/components/employee-portal/reviews.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "EmployeeReviews",
    ()=>EmployeeReviews
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$plural$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/plural.ts [app-client] (ecmascript)");
;
;
const score = new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 1
});
function EmployeeReviews({ reviews, timezone }) {
    const submittedDate = new Intl.DateTimeFormat('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: timezone
    });
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        className: "panel portal-section portal-reviews",
        "data-testid": "portal-reviews",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("header", {
                className: "portal-reviews-summary",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                        children: "Отзывы"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/reviews.tsx",
                        lineNumber: 17,
                        columnNumber: 9
                    }, this),
                    reviews.count > 0 && reviews.averageStars !== null && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                children: score.format(reviews.averageStars)
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/reviews.tsx",
                                lineNumber: 20,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: " из 5"
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/reviews.tsx",
                                lineNumber: 21,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$plural$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["pluralRu"])(reviews.count, [
                                    'отзыв',
                                    'отзыва',
                                    'отзывов'
                                ])
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/reviews.tsx",
                                lineNumber: 22,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/reviews.tsx",
                        lineNumber: 19,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/reviews.tsx",
                lineNumber: 16,
                columnNumber: 7
            }, this),
            reviews.items.length > 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                className: "portal-review-list",
                children: reviews.items.map((review)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "portal-review-meta",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                        "aria-label": `Оценка ${review.stars} из 5`,
                                        children: [
                                            review.stars,
                                            " из 5"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/reviews.tsx",
                                        lineNumber: 32,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("time", {
                                        dateTime: review.submittedAt,
                                        children: submittedDate.format(new Date(review.submittedAt))
                                    }, void 0, false, {
                                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/reviews.tsx",
                                        lineNumber: 33,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/reviews.tsx",
                                lineNumber: 31,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                children: review.comment ?? 'Без комментария'
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/reviews.tsx",
                                lineNumber: 35,
                                columnNumber: 15
                            }, this)
                        ]
                    }, review.appointmentId, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/reviews.tsx",
                        lineNumber: 30,
                        columnNumber: 13
                    }, this))
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/reviews.tsx",
                lineNumber: 28,
                columnNumber: 9
            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                children: "Отзывов пока нет."
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/reviews.tsx",
                lineNumber: 40,
                columnNumber: 9
            }, this),
            reviews.hasMore && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "portal-review-limit",
                children: "Показаны последние 50 отзывов."
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/reviews.tsx",
                lineNumber: 43,
                columnNumber: 27
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/reviews.tsx",
        lineNumber: 15,
        columnNumber: 5
    }, this);
}
_c = EmployeeReviews;
var _c;
__turbopack_context__.k.register(_c, "EmployeeReviews");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/components/employee-portal/service-prices.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "EmployeeServicePrices",
    ()=>EmployeeServicePrices
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$money$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/lib/money.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$my$2d$work$2f$data$3a$c8949f__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/my-work/data:c8949f [app-client] (ecmascript) <text/javascript>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$my$2d$work$2f$data$3a$3e6b1b__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/my-work/data:3e6b1b [app-client] (ecmascript) <text/javascript>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/ui.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
'use client';
;
;
;
;
const sourceLabel = {
    MASTER: 'Своя цена мастера',
    LOCATION: 'Цена филиала',
    CATALOG: 'Цена каталога'
};
function EmployeeServicePrices({ employeeId, scope, initial }) {
    _s();
    const [items, setItems] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([
        ...initial
    ]);
    const [savedServiceId, setSavedServiceId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "portal-service-prices",
        "data-testid": "portal-service-prices",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                children: "Цена и длительность у мастера"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/service-prices.tsx",
                lineNumber: 30,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                children: "Настройка действует для выбранного филиала. Суммы вводятся в валюте филиала."
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/service-prices.tsx",
                lineNumber: 31,
                columnNumber: 5
            }, this),
            !items.length && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                children: "Сначала назначьте мастеру услугу в этом филиале."
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/service-prices.tsx",
                lineNumber: 32,
                columnNumber: 23
            }, this),
            items.map((row)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ServicePriceForm, {
                    row: row,
                    employeeId: employeeId,
                    scope: scope,
                    saved: savedServiceId === row.serviceId,
                    onSaving: ()=>setSavedServiceId(null),
                    onSaved: (next)=>{
                        setItems(next);
                        setSavedServiceId(row.serviceId);
                    }
                }, `${row.serviceId}:${row.revision ?? 0}:${row.priceType}`, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/service-prices.tsx",
                    lineNumber: 33,
                    columnNumber: 25
                }, this))
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/service-prices.tsx",
        lineNumber: 29,
        columnNumber: 10
    }, this);
}
_s(EmployeeServicePrices, "eSBNKll9SpAlRko9FCcKhDFcX1c=");
_c = EmployeeServicePrices;
function ServicePriceForm({ row, employeeId, scope, saved, onSaving, onSaved }) {
    _s1();
    const [priceType, setPriceType] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(row.priceType);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [pending, startTransition] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTransition"])();
    const save = (form)=>startTransition(async ()=>{
            setError(null);
            onSaving();
            const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$my$2d$work$2f$data$3a$3e6b1b__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__["saveEmployeeServicePrice"])(employeeId, scope, form);
            if (result.error) return setError(result.error);
            if (result.items) onSaved(result.items);
        });
    const remove = ()=>startTransition(async ()=>{
            setError(null);
            onSaving();
            const form = new FormData();
            form.set('serviceId', row.serviceId);
            form.set('expectedRevision', String(row.revision ?? 0));
            const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$my$2d$work$2f$data$3a$c8949f__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__["removeEmployeeServicePrice"])(employeeId, scope, form);
            if (result.error) return setError(result.error);
            if (result.items) onSaved(result.items);
        });
    const minValue = row.priceMinMinor === null ? '' : (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$money$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["minorToInput"])(row.priceMinMinor);
    const maxValue = row.priceMaxMinor === null ? '' : (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$lib$2f$money$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["minorToInput"])(row.priceMaxMinor);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
        action: save,
        className: "portal-service-price-form",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("header", {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                children: row.serviceName
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/service-prices.tsx",
                                lineNumber: 88,
                                columnNumber: 12
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("small", {
                                children: sourceLabel[row.source]
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/service-prices.tsx",
                                lineNumber: 88,
                                columnNumber: 46
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/service-prices.tsx",
                        lineNumber: 88,
                        columnNumber: 7
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        children: row.sellable ? 'Доступна для записи' : 'Пока недоступна'
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/service-prices.tsx",
                        lineNumber: 89,
                        columnNumber: 7
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/service-prices.tsx",
                lineNumber: 87,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                type: "hidden",
                name: "serviceId",
                value: row.serviceId
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/service-prices.tsx",
                lineNumber: 91,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                type: "hidden",
                name: "currency",
                value: row.currency
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/service-prices.tsx",
                lineNumber: 92,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                type: "hidden",
                name: "expectedRevision",
                value: row.revision ?? 0
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/service-prices.tsx",
                lineNumber: 93,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                label: "Тип цены",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                    name: "priceType",
                    value: priceType,
                    onChange: (event)=>setPriceType(event.target.value),
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                            value: "FIXED",
                            children: "Фиксированная"
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/service-prices.tsx",
                            lineNumber: 96,
                            columnNumber: 9
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                            value: "RANGE",
                            children: "Диапазон"
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/service-prices.tsx",
                            lineNumber: 97,
                            columnNumber: 9
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                            value: "FREE",
                            children: "Бесплатно"
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/service-prices.tsx",
                            lineNumber: 98,
                            columnNumber: 9
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                            value: "UNFIXED",
                            children: "Цена не задана"
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/service-prices.tsx",
                            lineNumber: 99,
                            columnNumber: 9
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/service-prices.tsx",
                    lineNumber: 95,
                    columnNumber: 7
                }, this)
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/service-prices.tsx",
                lineNumber: 94,
                columnNumber: 5
            }, this),
            priceType === 'FIXED' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                label: `Цена, ${row.currency}`,
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                    name: "priceMin",
                    inputMode: "decimal",
                    defaultValue: minValue,
                    required: true
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/service-prices.tsx",
                    lineNumber: 103,
                    columnNumber: 7
                }, this)
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/service-prices.tsx",
                lineNumber: 102,
                columnNumber: 31
            }, this),
            priceType === 'RANGE' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                        label: `Цена от, ${row.currency}`,
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                            name: "priceMin",
                            inputMode: "decimal",
                            defaultValue: minValue,
                            required: true
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/service-prices.tsx",
                            lineNumber: 106,
                            columnNumber: 49
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/service-prices.tsx",
                        lineNumber: 106,
                        columnNumber: 7
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                        label: `Цена до, ${row.currency}`,
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                            name: "priceMax",
                            inputMode: "decimal",
                            defaultValue: maxValue,
                            required: true
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/service-prices.tsx",
                            lineNumber: 107,
                            columnNumber: 49
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/service-prices.tsx",
                        lineNumber: 107,
                        columnNumber: 7
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/service-prices.tsx",
                lineNumber: 105,
                columnNumber: 31
            }, this),
            priceType === 'FREE' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "portal-service-price-note",
                        children: "Бесплатно"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/service-prices.tsx",
                        lineNumber: 109,
                        columnNumber: 32
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                        type: "hidden",
                        name: "priceMin",
                        value: "0"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/service-prices.tsx",
                        lineNumber: 109,
                        columnNumber: 86
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/service-prices.tsx",
                lineNumber: 109,
                columnNumber: 30
            }, this),
            priceType === 'UNFIXED' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "portal-service-price-note",
                children: "Цена не задана, её нужно указать при записи."
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/service-prices.tsx",
                lineNumber: 110,
                columnNumber: 33
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                label: "Длительность, минут",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                    name: "durationMinutes",
                    type: "number",
                    min: 1,
                    max: 1440,
                    step: 1,
                    defaultValue: row.durationMinutes,
                    required: true
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/service-prices.tsx",
                    lineNumber: 112,
                    columnNumber: 7
                }, this)
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/service-prices.tsx",
                lineNumber: 111,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "portal-service-price-actions",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        className: "btn",
                        type: "submit",
                        disabled: pending,
                        children: pending ? 'Сохраняем…' : 'Сохранить'
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/service-prices.tsx",
                        lineNumber: 115,
                        columnNumber: 7
                    }, this),
                    row.revision !== null && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        className: "btn btn--secondary",
                        type: "button",
                        disabled: pending,
                        onClick: remove,
                        children: "Сбросить свою цену"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/service-prices.tsx",
                        lineNumber: 116,
                        columnNumber: 33
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/service-prices.tsx",
                lineNumber: 114,
                columnNumber: 5
            }, this),
            error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                role: "alert",
                children: error
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/service-prices.tsx",
                lineNumber: 118,
                columnNumber: 15
            }, this),
            saved && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                role: "status",
                children: "Сохранено"
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/service-prices.tsx",
                lineNumber: 119,
                columnNumber: 15
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/components/employee-portal/service-prices.tsx",
        lineNumber: 86,
        columnNumber: 10
    }, this);
}
_s1(ServicePriceForm, "Fl7P1vsUgRIrBcI65Vd+sm+xdLY=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTransition"]
    ];
});
_c1 = ServicePriceForm;
var _c, _c1;
__turbopack_context__.k.register(_c, "EmployeeServicePrices");
__turbopack_context__.k.register(_c1, "ServicePriceForm");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/components/employee-workspace/basic-form.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "EmployeeBasicForm",
    ()=>EmployeeBasicForm
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/index.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$personnel$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/personnel.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/ui.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
function EmployeeBasicForm({ draft, onChange, onSave, onCancel, creating, pending, disabled, error, current, formRef, personnelKind, onPersonnelKindChange }) {
    _s();
    const prefix = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useId"])();
    const problem = error && !current ? /имя/i.test(error) ? 'name' : /почт/i.test(error) ? 'email' : /телефон/i.test(error) ? 'phone' : null : null;
    const field = (key, label)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
            label: label,
            controlId: `${prefix}-${key}`,
            required: key === 'name',
            ...problem === key ? {
                error: error ?? undefined
            } : {},
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                required: key === 'name',
                name: key,
                value: draft[key],
                maxLength: key === 'name' ? 200 : key === 'phone' ? 32 : 320,
                type: key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text',
                disabled: pending || disabled,
                onChange: (event)=>onChange({
                        ...draft,
                        [key]: event.target.value
                    })
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-workspace/basic-form.tsx",
                lineNumber: 60,
                columnNumber: 7
            }, this)
        }, void 0, false, {
            fileName: "[project]/wt-personnel/apps/web/src/components/employee-workspace/basic-form.tsx",
            lineNumber: 54,
            columnNumber: 5
        }, this);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
        ref: formRef,
        className: "employee-workspace-form",
        "data-employee-transition-form": true,
        onSubmit: onSave,
        children: [
            error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                tabIndex: -1,
                "data-employee-error": true,
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Alert"], {
                    boxed: true,
                    children: error
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-workspace/basic-form.tsx",
                    lineNumber: 80,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-workspace/basic-form.tsx",
                lineNumber: 79,
                columnNumber: 9
            }, this),
            current && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                className: "employee-conflict",
                "aria-label": "Сохранённый профиль",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                        children: "Сейчас сохранено"
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-workspace/basic-form.tsx",
                        lineNumber: 85,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dl", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                children: "Имя"
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-workspace/basic-form.tsx",
                                lineNumber: 87,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                children: current.name
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-workspace/basic-form.tsx",
                                lineNumber: 88,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                children: "Телефон"
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-workspace/basic-form.tsx",
                                lineNumber: 89,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                children: current.phone || 'Не указан'
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-workspace/basic-form.tsx",
                                lineNumber: 90,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                children: "Почта"
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-workspace/basic-form.tsx",
                                lineNumber: 91,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                children: current.email || 'Не указана'
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-workspace/basic-form.tsx",
                                lineNumber: 92,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                children: "Статус"
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-workspace/basic-form.tsx",
                                lineNumber: 93,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                children: current.active ? 'Активен' : 'В архиве'
                            }, void 0, false, {
                                fileName: "[project]/wt-personnel/apps/web/src/components/employee-workspace/basic-form.tsx",
                                lineNumber: 94,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-workspace/basic-form.tsx",
                        lineNumber: 86,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        children: "Ваш ввод остаётся ниже. Отмените черновик и загрузите сохранённый профиль, затем внесите изменения заново."
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-workspace/basic-form.tsx",
                        lineNumber: 96,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-workspace/basic-form.tsx",
                lineNumber: 84,
                columnNumber: 9
            }, this),
            field('name', 'Имя мастера'),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "employee-workspace-contacts",
                children: [
                    field('phone', 'Телефон'),
                    field('email', 'Почта')
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-workspace/basic-form.tsx",
                lineNumber: 102,
                columnNumber: 7
            }, this),
            !creating && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                className: "employee-workspace-status",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                        type: "checkbox",
                        name: "active",
                        checked: draft.active,
                        disabled: pending || disabled,
                        onChange: (event)=>onChange({
                                ...draft,
                                active: event.target.checked
                            })
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-workspace/basic-form.tsx",
                        lineNumber: 108,
                        columnNumber: 11
                    }, this),
                    "Специалист работает"
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-workspace/basic-form.tsx",
                lineNumber: 107,
                columnNumber: 9
            }, this),
            creating && personnelKind && onPersonnelKindChange && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Field"], {
                label: "Кто это",
                controlId: `${prefix}-personnelKind`,
                hint: "Специалист принимает клиентов, другой сотрудник помогает в работе салона.",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Select"], {
                    name: "personnelKind",
                    value: personnelKind,
                    disabled: pending || disabled,
                    onChange: (event)=>onPersonnelKindChange(event.target.value),
                    children: __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$personnel$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PERSONNEL_KINDS"].map((value)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                            value: value,
                            children: __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$personnel$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PERSONNEL_KIND_LABELS"][value]
                        }, value, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-workspace/basic-form.tsx",
                            lineNumber: 131,
                            columnNumber: 15
                        }, this))
                }, void 0, false, {
                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-workspace/basic-form.tsx",
                    lineNumber: 124,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-workspace/basic-form.tsx",
                lineNumber: 119,
                columnNumber: 9
            }, this),
            creating && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "employee-workspace-note",
                children: "Услуги и рабочее время можно настроить после создания."
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-workspace/basic-form.tsx",
                lineNumber: 139,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "employee-workspace-actions",
                children: [
                    !disabled && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                        type: "submit",
                        disabled: pending || current !== null,
                        children: pending ? 'Сохраняем…' : creating ? 'Создать мастера' : 'Сохранить изменения'
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-workspace/basic-form.tsx",
                        lineNumber: 145,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                        type: "button",
                        tone: "secondary",
                        disabled: pending,
                        onClick: onCancel,
                        children: current ? 'Отменить черновик и загрузить профиль' : 'Отмена'
                    }, void 0, false, {
                        fileName: "[project]/wt-personnel/apps/web/src/components/employee-workspace/basic-form.tsx",
                        lineNumber: 149,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-workspace/basic-form.tsx",
                lineNumber: 143,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/components/employee-workspace/basic-form.tsx",
        lineNumber: 72,
        columnNumber: 5
    }, this);
}
_s(EmployeeBasicForm, "2+H8wWDbRJ2lfq7+7COCK7uLnK0=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useId"]
    ];
});
_c = EmployeeBasicForm;
var _c;
__turbopack_context__.k.register(_c, "EmployeeBasicForm");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/web/src/components/employee-workspace/workspace.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "EmployeeProfile",
    ()=>EmployeeProfile,
    "EmployeeTransitionGuard",
    ()=>EmployeeTransitionGuard,
    "employeeFormSignature",
    ()=>employeeFormSignature
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/index.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$beauty$2f$catalog$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/beauty/catalog.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$beauty$2f$data$3a$a7bcb5__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/beauty/data:a7bcb5 [app-client] (ecmascript) <text/javascript>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$beauty$2f$data$3a$7c5f1a__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/beauty/data:7c5f1a [app-client] (ecmascript) <text/javascript>");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$beauty$2f$creation$2d$key$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/app/beauty/creation-key.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$employee$2d$workspace$2f$basic$2d$form$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/employee-workspace/basic-form.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$overlay$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/overlay.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/ui.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$tabs$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/web/src/components/tabs.tsx [app-client] (ecmascript)");
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
;
const fields = (row)=>({
        name: row?.name ?? '',
        phone: row?.phone ?? '',
        email: row?.email ?? '',
        active: row?.active ?? true
    });
function EmployeeProfile({ row, scopeKey, canEdit, onSaved, onCancelCreate }) {
    _s();
    const [original, setOriginal] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        "EmployeeProfile.useState": ()=>fields(row)
    }["EmployeeProfile.useState"]);
    const [draft, setDraft] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(original);
    const [revision, setRevision] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(row?.profileRevision);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [current, setCurrent] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [pending, setPending] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    // по умолчанию «Специалист»: руководитель видит выбор и может сменить его до создания
    const [personnelKind, setPersonnelKind] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('SPECIALIST');
    const form = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const alive = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(true);
    const busy = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(false);
    const requestVersion = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(0);
    const creation = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$beauty$2f$creation$2d$key$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCreationKey"])(scopeKey, 'employee', Boolean(row));
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "EmployeeProfile.useEffect": ()=>{
            alive.current = true;
            return ({
                "EmployeeProfile.useEffect": ()=>{
                    alive.current = false;
                }
            })["EmployeeProfile.useEffect"];
        }
    }["EmployeeProfile.useEffect"], []);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "EmployeeProfile.useEffect": ()=>{
            const switched = {
                "EmployeeProfile.useEffect.switched": ()=>{
                    requestVersion.current++;
                    setPending(false);
                    setError('Филиал изменяется. Ответ прежнего запроса не будет применён к форме.');
                }
            }["EmployeeProfile.useEffect.switched"];
            window.addEventListener('wetop-scope-switch', switched);
            return ({
                "EmployeeProfile.useEffect": ()=>window.removeEventListener('wetop-scope-switch', switched)
            })["EmployeeProfile.useEffect"];
        }
    }["EmployeeProfile.useEffect"], []);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "EmployeeProfile.useEffect": ()=>{
            if (error) form.current?.querySelector('[data-employee-error]')?.focus();
        }
    }["EmployeeProfile.useEffect"], [
        error,
        current
    ]);
    const finish = (success, saved)=>{
        const element = form.current;
        element?.dispatchEvent(new CustomEvent('employee-save-result', {
            bubbles: true,
            detail: {
                success,
                snapshot: saved ? employeeFormSignature(element, saved) : undefined
            }
        }));
    };
    const save = async ()=>{
        if (busy.current || !canEdit || current) {
            finish(false);
            return;
        }
        const parsed = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$beauty$2f$catalog$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["parseEmployeeInput"])(draft);
        if (!parsed.ok) {
            setError(parsed.reason);
            finish(false);
            return;
        }
        if (row && !revision) {
            setError('Обновите профиль через «Отмена» перед сохранением.');
            finish(false);
            return;
        }
        if (!row && !creation.id) {
            setError(creation.error || 'Подготавливаем создание.');
            finish(false);
            return;
        }
        const version = ++requestVersion.current;
        busy.current = true;
        setPending(true);
        setError(null);
        const data = new FormData();
        data.set('section', 'basic');
        data.set('scopeKey', scopeKey);
        data.set('activePresent', '1');
        for (const key of [
            'name',
            'phone',
            'email'
        ])data.set(key, draft[key]);
        if (draft.active) data.set('active', 'on');
        if (row) {
            data.set('id', row.id);
            data.set('expectedProfileRevision', revision);
            data.set('changedFields', JSON.stringify(Object.keys(draft).filter((key)=>draft[key] !== original[key])));
        } else {
            data.set('creationId', creation.id);
            data.set('personnelKind', personnelKind);
        }
        try {
            const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$beauty$2f$data$3a$7c5f1a__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__["saveBeautyEmployee"])(null, data);
            if (!alive.current || version !== requestVersion.current) return;
            if (result.error || !result.employee) {
                setError(result.error || 'Не удалось получить сохранённый профиль. Повторите сохранение.');
                setCurrent(result.currentEmployee ?? null);
                finish(false);
                return;
            }
            const saved = result.employee;
            setDraft(fields(saved));
            setOriginal(fields(saved));
            setRevision(saved.profileRevision);
            creation.clear();
            finish(true, fields(saved));
            onSaved(saved);
        } catch  {
            if (alive.current && version === requestVersion.current) {
                setError('Не удалось подтвердить сохранение. Ваш ввод сохранён в форме. Повторите попытку.');
                finish(false);
            }
        } finally{
            busy.current = false;
            if (alive.current && version === requestVersion.current) setPending(false);
        }
    };
    const cancel = async ()=>{
        if (!row) {
            setDraft(fields(null));
            setOriginal(fields(null));
            setError(null);
            setCurrent(null);
            finish(true, fields(null));
            return;
        }
        setPending(true);
        const version = ++requestVersion.current;
        try {
            const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$beauty$2f$data$3a$a7bcb5__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__["loadBeautyEmployee"])(row.id);
            if (!alive.current || version !== requestVersion.current) return;
            if (!result.employee || result.locationId !== scopeKey) {
                setError(result.error || 'Филиал изменён. Откройте профиль в текущем филиале.');
                return;
            }
            setDraft(fields(result.employee));
            setOriginal(fields(result.employee));
            setRevision(result.employee.profileRevision);
            setCurrent(null);
            setError(null);
            finish(true, fields(result.employee));
        } catch  {
            if (alive.current && version === requestVersion.current) setError('Не удалось обновить профиль. Черновик сохранён, повторите загрузку.');
        } finally{
            if (alive.current && version === requestVersion.current) setPending(false);
        }
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$employee$2d$workspace$2f$basic$2d$form$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["EmployeeBasicForm"], {
            draft: draft,
            onChange: setDraft,
            onSave: (event)=>{
                event.preventDefault();
                void save();
            },
            onCancel: ()=>{
                if (!row && onCancelCreate) onCancelCreate();
                else void cancel();
            },
            creating: !row,
            pending: pending,
            disabled: !canEdit,
            error: error || creation.error || null,
            current: current ? fields(current) : null,
            formRef: form,
            ...row ? {} : {
                personnelKind,
                onPersonnelKindChange: setPersonnelKind
            }
        }, void 0, false, {
            fileName: "[project]/wt-personnel/apps/web/src/components/employee-workspace/workspace.tsx",
            lineNumber: 182,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/wt-personnel/apps/web/src/components/employee-workspace/workspace.tsx",
        lineNumber: 181,
        columnNumber: 5
    }, this);
}
_s(EmployeeProfile, "HTkRpDfVTFC+tUe9ibuWnVOodV0=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$app$2f$beauty$2f$creation$2d$key$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCreationKey"]
    ];
});
_c = EmployeeProfile;
function employeeFormSignature(form, saved) {
    return JSON.stringify(Array.from(form.elements).flatMap((control)=>{
        if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement)) return [];
        if (control instanceof HTMLInputElement && [
            'hidden',
            'submit',
            'button'
        ].includes(control.type)) return [];
        return [
            [
                control.name,
                saved && Object.hasOwn(saved, control.name) ? saved[control.name] : control instanceof HTMLInputElement && [
                    'checkbox',
                    'radio'
                ].includes(control.type) ? control.checked : control.value
            ]
        ];
    }));
}
function saveSignal(event) {
    const detail = event.detail;
    return typeof detail === 'boolean' ? {
        success: detail
    } : detail;
}
function EmployeeTransitionGuard({ children, register, discard }) {
    _s1();
    const root = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const baselines = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(new WeakMap());
    const submitted = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(new WeakMap());
    const [destination, setDestination] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [saving, setSaving] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    const bypass = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(false);
    const dirty = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "EmployeeTransitionGuard.useCallback[dirty]": ()=>Array.from(root.current?.querySelectorAll('form') ?? []).filter({
                "EmployeeTransitionGuard.useCallback[dirty]": (form)=>baselines.current.has(form) && baselines.current.get(form) !== employeeFormSignature(form)
            }["EmployeeTransitionGuard.useCallback[dirty]"])
    }["EmployeeTransitionGuard.useCallback[dirty]"], []);
    const request = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "EmployeeTransitionGuard.useCallback[request]": (action)=>{
            if (dirty().length === 0) {
                action();
                return;
            }
            setError('');
            setDestination({
                "EmployeeTransitionGuard.useCallback[request]": ()=>action
            }["EmployeeTransitionGuard.useCallback[request]"]);
        }
    }["EmployeeTransitionGuard.useCallback[request]"], [
        dirty
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "EmployeeTransitionGuard.useEffect": ()=>{
            register(request);
        }
    }["EmployeeTransitionGuard.useEffect"], [
        register,
        request
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "EmployeeTransitionGuard.useEffect": ()=>{
            const element = root.current;
            if (!element) return;
            const initialize = {
                "EmployeeTransitionGuard.useEffect.initialize": ()=>element.querySelectorAll('form[data-employee-transition-form]').forEach({
                        "EmployeeTransitionGuard.useEffect.initialize": (form)=>{
                            if (!baselines.current.has(form)) {
                                baselines.current.set(form, employeeFormSignature(form));
                            }
                        }
                    }["EmployeeTransitionGuard.useEffect.initialize"])
            }["EmployeeTransitionGuard.useEffect.initialize"];
            initialize();
            const observer = new MutationObserver(initialize);
            observer.observe(element, {
                childList: true,
                subtree: true
            });
            const saved = {
                "EmployeeTransitionGuard.useEffect.saved": (event)=>{
                    if (!(event.target instanceof HTMLFormElement)) return;
                    const form = event.target;
                    const result = saveSignal(event);
                    if (result.success) {
                        baselines.current.set(form, result.snapshot ?? submitted.current.get(form) ?? employeeFormSignature(form));
                        if (result.reset) {
                            requestAnimationFrame({
                                "EmployeeTransitionGuard.useEffect.saved": ()=>baselines.current.set(form, employeeFormSignature(form))
                            }["EmployeeTransitionGuard.useEffect.saved"]);
                        }
                    }
                    submitted.current.delete(form);
                }
            }["EmployeeTransitionGuard.useEffect.saved"];
            element.addEventListener('employee-save-result', saved);
            const beforeUnload = {
                "EmployeeTransitionGuard.useEffect.beforeUnload": (event)=>{
                    if (!dirty().length) return;
                    event.preventDefault();
                    event.returnValue = '';
                }
            }["EmployeeTransitionGuard.useEffect.beforeUnload"];
            window.addEventListener('beforeunload', beforeUnload);
            // Intercept application links and scope controls before their handlers change context.
            const click = {
                "EmployeeTransitionGuard.useEffect.click": (event)=>{
                    if (bypass.current || event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
                    const target = event.target instanceof Element ? event.target : null;
                    const control = target?.closest('a[href], .branch-switcher__options button');
                    if (!control || control.closest('[data-employee-confirm]') || !dirty().length) return;
                    if (control instanceof HTMLAnchorElement && (control.target === '_blank' || control.origin !== location.origin)) return;
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    request({
                        "EmployeeTransitionGuard.useEffect.click": ()=>{
                            bypass.current = true;
                            control.click();
                            bypass.current = false;
                        }
                    }["EmployeeTransitionGuard.useEffect.click"]);
                }
            }["EmployeeTransitionGuard.useEffect.click"];
            document.addEventListener('click', click, true);
            return ({
                "EmployeeTransitionGuard.useEffect": ()=>{
                    observer.disconnect();
                    element.removeEventListener('employee-save-result', saved);
                    window.removeEventListener('beforeunload', beforeUnload);
                    document.removeEventListener('click', click, true);
                }
            })["EmployeeTransitionGuard.useEffect"];
        }
    }["EmployeeTransitionGuard.useEffect"], [
        dirty,
        request
    ]);
    const submit = (form)=>new Promise((resolve)=>{
            if (!form.reportValidity()) {
                resolve(false);
                return;
            }
            let settled = false;
            const done = (success)=>{
                if (settled) return;
                settled = true;
                clearTimeout(timeout);
                observer.disconnect();
                form.removeEventListener('employee-save-result', result);
                resolve(success);
            };
            const result = (event)=>done(saveSignal(event).success);
            const previousError = form.querySelector('[role="alert"]')?.textContent;
            const observer = new MutationObserver(()=>{
                const message = form.querySelector('[role="alert"]')?.textContent;
                if (message && message !== previousError) done(false);
            });
            observer.observe(form, {
                childList: true,
                subtree: true,
                characterData: true
            });
            const timeout = setTimeout(()=>done(false), 20000);
            form.addEventListener('employee-save-result', result);
            form.requestSubmit();
        });
    const leave = async ()=>{
        setSaving(true);
        setError('');
        for (const form of dirty()){
            if (!await submit(form)) {
                setSaving(false);
                setError('Сохранение не завершено. Исправьте ошибку в форме или оставайтесь в карточке.');
                return;
            }
        }
        setSaving(false);
        const action = destination;
        setDestination(null);
        requestAnimationFrame(()=>action?.());
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        ref: root,
        onSubmitCapture: (event)=>{
            if (event.target instanceof HTMLFormElement) submitted.current.set(event.target, employeeFormSignature(event.target));
        },
        onClickCapture: (event)=>{
            if (bypass.current) return;
            const tab = event.target.closest('[role="tab"]');
            if (!tab || tab.getAttribute('aria-selected') === 'true' || !dirty().length) return;
            event.preventDefault();
            event.stopPropagation();
            const index = Array.from(root.current.querySelectorAll('[role="tab"]')).indexOf(tab);
            request(()=>requestAnimationFrame(()=>{
                    bypass.current = true;
                    root.current?.querySelectorAll('[role="tab"]')[index]?.click();
                    bypass.current = false;
                }));
        },
        onKeyDownCapture: (event)=>{
            if (bypass.current || !dirty().length) return;
            const tabs = Array.from(root.current?.querySelectorAll('[role="tab"]') ?? []);
            const index = tabs.indexOf(event.target);
            const next = index < 0 ? -1 : (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$tabs$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["rovingIndex"])(event.key, index, tabs.length);
            if (next < 0) return;
            event.preventDefault();
            event.stopPropagation();
            request(()=>requestAnimationFrame(()=>{
                    bypass.current = true;
                    const target = root.current?.querySelectorAll('[role="tab"]')[next];
                    target?.click();
                    target?.focus();
                    bypass.current = false;
                }));
        },
        children: [
            children,
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$overlay$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Overlay"], {
                open: Boolean(destination),
                onClose: ()=>{
                    if (!saving) setDestination(null);
                },
                title: "Несохранённые изменения",
                trapFocus: true,
                size: "sm",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    "data-employee-confirm": true,
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            children: "Сохранить изменения перед переходом?"
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-workspace/workspace.tsx",
                            lineNumber: 442,
                            columnNumber: 11
                        }, this),
                        error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Alert"], {
                            children: error
                        }, void 0, false, {
                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-workspace/workspace.tsx",
                            lineNumber: 443,
                            columnNumber: 21
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "employee-workspace-actions",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                    disabled: saving,
                                    onClick: ()=>{
                                        void leave();
                                    },
                                    children: saving ? 'Сохраняем…' : 'Сохранить и перейти'
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-workspace/workspace.tsx",
                                    lineNumber: 445,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                    tone: "secondary",
                                    disabled: saving,
                                    onClick: ()=>{
                                        const action = destination;
                                        setDestination(null);
                                        dirty().forEach((form)=>baselines.current.set(form, employeeFormSignature(form)));
                                        discard();
                                        action?.();
                                    },
                                    children: "Не сохранять"
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-workspace/workspace.tsx",
                                    lineNumber: 453,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$web$2f$src$2f$components$2f$ui$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                    tone: "secondary",
                                    disabled: saving,
                                    onClick: ()=>setDestination(null),
                                    children: "Остаться"
                                }, void 0, false, {
                                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-workspace/workspace.tsx",
                                    lineNumber: 468,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/wt-personnel/apps/web/src/components/employee-workspace/workspace.tsx",
                            lineNumber: 444,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/wt-personnel/apps/web/src/components/employee-workspace/workspace.tsx",
                    lineNumber: 441,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/wt-personnel/apps/web/src/components/employee-workspace/workspace.tsx",
                lineNumber: 432,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/wt-personnel/apps/web/src/components/employee-workspace/workspace.tsx",
        lineNumber: 389,
        columnNumber: 5
    }, this);
}
_s1(EmployeeTransitionGuard, "t3kc6f0KWGBK3VeX+4+0ZzhHAbM=");
_c1 = EmployeeTransitionGuard;
var _c, _c1;
__turbopack_context__.k.register(_c, "EmployeeProfile");
__turbopack_context__.k.register(_c1, "EmployeeTransitionGuard");
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

//# sourceMappingURL=wt-personnel_apps_web_src_06wq9tr._.js.map