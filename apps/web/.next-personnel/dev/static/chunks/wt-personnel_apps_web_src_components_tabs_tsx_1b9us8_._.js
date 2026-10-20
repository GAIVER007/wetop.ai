(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
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
]);

//# sourceMappingURL=wt-personnel_apps_web_src_components_tabs_tsx_1b9us8_._.js.map