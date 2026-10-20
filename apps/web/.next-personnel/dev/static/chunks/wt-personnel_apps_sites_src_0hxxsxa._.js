(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/wt-personnel/apps/sites/src/assets.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CSS_PATH",
    ()=>CSS_PATH,
    "LEAD_PATH",
    ()=>LEAD_PATH,
    "PRICES_PATH",
    ()=>PRICES_PATH
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$lead$2d$script$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/sites/src/render/lead-script.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$prices$2d$script$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/sites/src/render/prices-script.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$theme$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/sites/src/render/theme.ts [app-client] (ecmascript)");
;
;
;
/** Неизменяемые файлы рантайма с хэшем содержимого в имени: долгий кэш безопасен, новая версия даёт новый адрес */ function fnv1a(text) {
    let hash = 0x811c9dc5;
    for(let i = 0; i < text.length; i++){
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
}
const CSS_PATH = `/_wetop/site-${fnv1a(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$theme$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SITE_CSS"])}.css`;
const PRICES_PATH = `/_wetop/prices-${fnv1a(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$prices$2d$script$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PRICES_JS"])}.js`;
const LEAD_PATH = `/_wetop/lead-${fnv1a(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$lead$2d$script$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["LEAD_JS"])}.js`;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/sites/src/draft-preview.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "EDITOR_PREVIEW_CSS",
    ()=>EDITOR_PREVIEW_CSS,
    "renderDraftPreview",
    ()=>renderDraftPreview
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$assets$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/sites/src/assets.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$page$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/sites/src/render/page.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$theme$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/sites/src/render/theme.ts [app-client] (ecmascript)");
;
;
;
const SEO = {
    indexable: false,
    canonicalOrigin: null,
    sitemapOrigin: 'https://preview.invalid'
};
const EDITOR_PREVIEW_CSS = 'main section{cursor:pointer}' + 'main section:hover{outline:2px dashed #2563eb;outline-offset:-2px}' + 'main section[data-ed-selected]{outline:3px solid #2563eb;outline-offset:-3px}' + // MKT9.2, режим «Текст»: правится текст, а не блок; редактируемый текст обведён
'html[data-ed-mode="text"] main section{cursor:default}' + 'html[data-ed-mode="text"] main section:hover{outline:none}' + 'html[data-ed-mode="text"] [data-editor-path]{cursor:text;border-radius:2px}' + 'html[data-ed-mode="text"] [data-editor-path]:hover{outline:2px dashed #2563eb;outline-offset:2px}' + '[data-editor-path][contenteditable]{outline:2px solid #2563eb;outline-offset:2px;background:#eff6ff}';
const OPEN = '\uE000';
const MID = '\uE001';
const CLOSE = '\uE002';
const MARK_RE = /\uE000(\d+)\uE001([\s\S]*?)\uE002/g;
/** Узел документа по пути вида `pages[0].sections[1].heading`; нет такого: `undefined` */ function nodeAt(root, path) {
    let node = root;
    for (const m of path.matchAll(/([a-zA-Z]+)|\[(\d+)\]/g)){
        if (node === null || typeof node !== 'object') return undefined;
        node = node[m[1] ?? Number(m[2])];
    }
    return node !== null && typeof node === 'object' && !Array.isArray(node) ? node : undefined;
}
/** Метки вокруг текстов целей на языке просмотра: служебные знаки, которых не бывает в тексте документа */ function markTexts(spec, locale, paths) {
    const copy = structuredClone(spec);
    paths.forEach((path, i)=>{
        const node = nodeAt(copy, path);
        const text = node?.[locale];
        if (typeof text === 'string' && text) node[locale] = `${OPEN}${i}${MID}${text}${CLOSE}`;
    });
    return copy;
}
/**
 * Разметка меток: в тексте тела страницы метка становится `<span data-editor-path>`; внутри тегов (атрибуты), скриптов
 * и `<head>` метка снимается, остаётся текст
 */ function placeMarks(html, paths) {
    const strip = (part)=>part.replace(MARK_RE, '$2');
    const at = html.indexOf('<body');
    if (at < 0) return strip(html);
    const body = html.slice(at).split(/(<script[\s\S]*?<\/script>|<[^>]+>)/).map((part, i)=>i % 2 === 1 ? strip(part) : part.replace(MARK_RE, (_m, n, text)=>{
            const path = paths[Number(n)];
            return path ? `<span data-editor-path="${path}">${text}</span>` : text;
        })).join('');
    return strip(html.slice(0, at)) + body;
}
function renderDraftPreview(input) {
    try {
        const original = input.spec;
        if (!Array.isArray(original?.pages) || original.pages.length === 0) return {
            ok: false
        };
        const paths = input.editorPaths ?? [];
        const spec = paths.length ? markTexts(original, input.locale, paths) : original;
        const page = spec.pages.find((p)=>p.id === input.pageId) ?? spec.pages.find((p)=>p.isHome) ?? spec.pages[0];
        const ctx = {
            spec,
            locale: input.locale,
            page,
            facts: null,
            publicKey: null,
            bookingLive: false,
            apiOrigin: null,
            assets: input.assets,
            previewToken: null
        };
        const rendered = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$page$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["renderPage"])(ctx, SEO, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$assets$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CSS_PATH"]).replace(`<link rel="stylesheet" href="${__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$assets$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CSS_PATH"]}">`, `<style>${__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$theme$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SITE_CSS"]}${EDITOR_PREVIEW_CSS}</style>`);
        const html = paths.length ? placeMarks(rendered, paths) : rendered;
        return {
            ok: true,
            html,
            pageId: page.id
        };
    } catch  {
        return {
            ok: false
        };
    }
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/sites/src/render/beauty-form-script.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "BEAUTY_FORM_JS",
    ()=>BEAUTY_FORM_JS
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$price$2d$format$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/sites/src/render/price-format.ts [app-client] (ecmascript)");
;
const BEAUTY_FORM_JS = `
  var INTL_LOCALE = ${JSON.stringify(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$price$2d$format$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["INTL_LOCALE"])};
  var formatMoney = ${__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$price$2d$format$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatMoney"].toString()};
  function setupBeauty(form, say, submit) {
    var service = form.elements.serviceId;
    var employee = form.elements.employeeId;
    var date = form.elements.date;
    var starts = form.elements.startsAt;
    var details = form.querySelector('[data-beauty-details]');
    var labels = {
      ru: ['Выберите время', 'Выберите услугу и дату', 'Загрузка свободного времени…', 'Нет свободного времени', 'Не удалось загрузить свободное время. Измените дату или повторите поиск.', 'Выбор из ссылки (проверяется)', 'Обновить свободное время'],
      kk: ['Уақытты таңдаңыз', 'Қызмет пен күнді таңдаңыз', 'Бос уақыт жүктелуде…', 'Бос уақыт жоқ', 'Бос уақытты жүктеу мүмкін болмады. Қайта іздеңіз.', 'Сілтемедегі таңдау (тексерілуде)', 'Бос уақытты жаңарту'],
      en: ['Choose a time', 'Choose a service and date', 'Loading available times…', 'No available times', 'Could not load available times. Change the date or retry.', 'Link selection (checking)', 'Refresh available times']
    }[lang] || ['Choose a time', 'Choose a service and date', 'Loading available times…', 'No available times', 'Could not load available times. Change the date or retry.', 'Link selection (checking)', 'Refresh available times'];
    var idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    var generation = 0;
    var available = [];
    var busy = false;
    function option(select, id, name) {
      var found = Array.prototype.find.call(select.options, function (o) { return o.value === id; });
      if (!found) { found = document.createElement('option'); found.value = id; select.appendChild(found); }
      found.textContent = name;
      return found;
    }
    function prefill(select, name) {
      var id = new URLSearchParams(window.location.search).get(name);
      if (id === null) return;
      id = id.toLowerCase();
      // A missing/invalid link target must never quietly select the first service or any master.
      if (!id) id = 'invalid-link-target';
      var found = Array.prototype.find.call(select.options, function (o) { return o.value === id; });
      if (!found) option(select, id, labels[5]);
      select.value = id;
    }
    prefill(service, 'serviceId');
    prefill(employee, 'employeeId');
    function ready() { return !busy && available.indexOf(value(form, 'startsAt')) !== -1; }
    function sync() { submit.disabled = !ready(); }
    function clear() {
      generation++;
      available = [];
      starts.textContent = '';
      option(starts, '', labels[0]);
      starts.value = '';
      starts.disabled = true;
      if (details) { details.textContent = ''; details.removeAttribute('data-price-minor'); }
      sync();
    }
    function load() {
      clear();
      var version = generation;
      var selectedService = value(form, 'serviceId');
      var selectedEmployee = value(form, 'employeeId');
      var selectedDate = value(form, 'date');
      if (!idPattern.test(selectedService) || (selectedEmployee && !idPattern.test(selectedEmployee))) { say(labels[4]); return; }
      if (!selectedDate) { say(labels[1]); return; }
      say(labels[2]);
      var query = '?k=' + encodeURIComponent(key) + '&service=' + encodeURIComponent(selectedService) + '&date=' + encodeURIComponent(selectedDate);
      if (selectedEmployee) query += '&employee=' + encodeURIComponent(selectedEmployee);
      fetch(api + '/w/beauty/slots' + query, { credentials: 'omit', cache: 'no-store' })
        .then(function (r) { return r.json().then(function (data) { if (!r.ok) throw new Error(typeof data.message === 'string' ? data.message : labels[4]); return data; }); })
        .then(function (data) {
          if (version !== generation) return;
          if (!data || data.date !== selectedDate || !data.service || data.service.id !== selectedService ||
              typeof data.service.name !== 'string' || typeof data.timezone !== 'string' || !data.timezone ||
              !Array.isArray(data.employees) || !Array.isArray(data.slots) ||
              (selectedEmployee && !data.employees.some(function (e) { return e.id === selectedEmployee; }))) throw new Error(labels[4]);
          option(service, data.service.id, data.service.name);
          // Preserve the selected target; only the API may supply a missing target's authoritative label.
          data.employees.forEach(function (e) { if (idPattern.test(e.id) && typeof e.name === 'string') option(employee, e.id, e.name); });
          employee.value = selectedEmployee;
          data.slots.forEach(function (slot) {
            if (typeof slot.startsAt !== 'string' || !/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}(:\\d{2}(\\.\\d{1,3})?)?(Z|[+-]\\d{2}:\\d{2})$/.test(slot.startsAt) ||
                isNaN(Date.parse(slot.startsAt)) || !/^([01]\\d|2[0-3]):[0-5]\\d$/.test(slot.time) ||
                !Array.isArray(slot.employeeIds) || !slot.employeeIds.length ||
                (selectedEmployee && slot.employeeIds.indexOf(selectedEmployee) === -1)) return;
            if (available.indexOf(slot.startsAt) !== -1) return;
            available.push(slot.startsAt);
            option(starts, slot.startsAt, slot.time + ' (' + data.timezone + ')');
          });
          if (details) {
            var price = formatMoney({ minor: data.service.priceMinor, currency: data.service.currency }, lang);
            details.textContent = data.service.name + ' · ' + data.timezone + (price ? ' · ' + price : '');
            if (price) details.setAttribute('data-price-minor', data.service.priceMinor);
          }
          starts.disabled = !available.length || busy;
          say(available.length ? '' : labels[3]);
          sync();
        })
        .catch(function (error) { if (version === generation) { clear(); say(error.message || labels[4]); } });
    }
    [service, employee, date].forEach(function (el) { el.addEventListener('change', load); });
    starts.addEventListener('change', sync);
    var refresh = form.querySelector('[data-beauty-refresh]');
    if (refresh) { refresh.textContent = labels[6]; refresh.addEventListener('click', load); }
    load();
    return {
      ready: ready,
      clear: clear,
      confirm: function (data) {
        var price = data && formatMoney({ minor: data.priceMinor, currency: data.currency }, lang);
        if (!data || !idPattern.test(data.appointmentId) || typeof data.status !== 'string' || !data.status ||
            !data.service || data.service.id !== service.value || typeof data.service.name !== 'string' ||
            !data.employee || !idPattern.test(data.employee.id) || typeof data.employee.name !== 'string' ||
            (employee.value && data.employee.id !== employee.value) ||
            Date.parse(data.startsAt) !== Date.parse(starts.value) || !price) return false;
        clear();
        if (details) {
          details.textContent = data.service.name + ' · ' + data.employee.name + ' · ' + data.startsAt + ' · ' + price;
          details.setAttribute('data-price-minor', data.priceMinor);
        }
        return true;
      },
      pending: function (pending) {
        busy = pending;
        // Do not allow the submission fingerprint to change while the response is in flight.
        Array.prototype.forEach.call(form.elements, function (el) { el.disabled = pending; });
        if (!pending) { starts.disabled = !available.length; sync(); }
      }
    };
  }
`;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/sites/src/render/context.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "RenderError",
    ()=>RenderError,
    "actionHref",
    ()=>actionHref,
    "bookingHref",
    ()=>bookingHref,
    "isBookingTarget",
    ()=>isBookingTarget,
    "leadLive",
    ()=>leadLive,
    "localHref",
    ()=>localHref,
    "pagePath",
    ()=>pagePath,
    "pricingRows",
    ()=>pricingRows,
    "resolvedImages",
    ()=>resolvedImages,
    "sectionVisible",
    ()=>sectionVisible,
    "targetHref",
    ()=>targetHref,
    "usesHotelWidget",
    ()=>usesHotelWidget,
    "usesLeadScript",
    ()=>usesLeadScript,
    "visibleCards",
    ()=>visibleCards
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/sites/src/render/text.ts [app-client] (ecmascript)");
;
class RenderError extends Error {
}
const pagePath = (page)=>page.isHome ? '/' : `/${page.slug}`;
function localHref(path, ctx) {
    if (!ctx.previewToken || path.startsWith('#')) return path;
    const hash = path.indexOf('#');
    const base = hash < 0 ? path : path.slice(0, hash);
    const fragment = hash < 0 ? '' : path.slice(hash);
    return `${base}?token=${encodeURIComponent(ctx.previewToken)}${fragment}`;
}
function pricingRows(section, ctx) {
    const codes = Array.isArray(section['categoryCodes']) ? section['categoryCodes'] : [];
    const titles = new Map();
    for (const s of ctx.spec.pages.flatMap((p)=>p.sections))if (s.type === 'accommodations' && Array.isArray(s['items'])) {
        for (const item of s['items'])if (typeof item['categoryCode'] === 'string' && !titles.has(item['categoryCode'])) titles.set(item['categoryCode'], item['title']);
    }
    return codes.filter((code)=>typeof code === 'string' && titles.has(code)).filter((code)=>!ctx.facts || ctx.facts.categories.some((c)=>c.code === code && c.active)).map((code)=>({
            code,
            title: titles.get(code)
        }));
}
function sectionVisible(section, ctx) {
    switch(section.type){
        case 'gallery':
            return resolvedImages(section['images'], ctx.assets).length > 0;
        case 'pricing':
            // Q-276: цена живая и приходит только по тарифу брони сайта; без брони цен нет, без строк секции нет
            return ctx.bookingLive && pricingRows(section, ctx).length > 0;
        case 'accommodations':
            return visibleCards(section, ctx.facts).length > 0;
        // SITE-2: пустой каталог не рисуется (валидатор и так требует от одного элемента)
        case 'services':
        case 'staff':
            return Array.isArray(section['items']) && section['items'].length > 0;
        case 'menu':
            return Array.isArray(section['categories']) && section['categories'].length > 0;
        default:
            return true;
    }
}
function resolvedImages(images, assets) {
    if (!Array.isArray(images)) return [];
    return images.map((img)=>{
        // id в документе может быть в любом регистре, карта API в нижнем (UUID)
        const id = String(img?.assetId ?? '');
        return {
            src: assets[id] ?? assets[id.toLowerCase()],
            alt: img?.alt
        };
    }).filter((img)=>typeof img.src === 'string');
}
function visibleCards(section, facts) {
    const items = Array.isArray(section['items']) ? section['items'] : [];
    if (!facts) return items;
    return items.filter((item)=>facts.categories.some((c)=>c.code === item['categoryCode'] && c.active));
}
function findSection(spec, pageId, sectionId) {
    const page = spec.pages.find((p)=>p.id === pageId);
    if (!page) return null;
    if (sectionId === undefined) return {
        page,
        section: null
    };
    const section = page.sections.find((s)=>s.id === sectionId);
    return section ? {
        page,
        section
    } : null;
}
function targetHref(target, ctx) {
    if (target.kind === 'EXTERNAL') {
        const href = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["safeHttps"])(target.url);
        return href ? {
            href,
            external: true
        } : null;
    }
    const found = findSection(ctx.spec, target.pageId, target.kind === 'SECTION' ? target.sectionId : undefined);
    if (!found) return null;
    // секция цен скрыта, пока скрипт не покажет строку с ценой: ссылка на неё вела бы в пустоту
    if (found.section && (found.section.type === 'pricing' || !sectionVisible(found.section, ctx))) return null;
    const path = pagePath(found.page);
    if (!found.section) return {
        href: localHref(path, ctx),
        external: false
    };
    return {
        href: found.page.id === ctx.page.id ? `#${found.section.id}` : localHref(`${path}#${found.section.id}`, ctx),
        external: false
    };
}
const isBookingTarget = (s)=>s.type === 'booking' || s.type === 'leadForm';
const usesHotelWidget = (s)=>s.type === 'booking' || s.type === 'leadForm' && s['mode'] === 'HOTEL_BOOKING';
const usesLeadScript = (s)=>s.type === 'leadForm' && s['mode'] !== 'HOTEL_BOOKING';
const leadLive = (ctx)=>!!ctx.publicKey && !!ctx.apiOrigin && !ctx.previewToken;
function bookingHref(ctx) {
    const here = ctx.page.sections.find(isBookingTarget);
    if (here) return `#${here.id}`;
    const home = ctx.spec.pages.find((p)=>p.isHome);
    const there = home?.sections.find(isBookingTarget);
    return home && there ? localHref(`/#${there.id}`, ctx) : null;
}
function actionHref(action, ctx) {
    const contacts = ctx.spec.site.contacts ?? {};
    const local = (href)=>href ? {
            href,
            external: false
        } : null;
    switch(action.kind){
        case 'BOOK':
            return local(bookingHref(ctx));
        case 'PHONE':
            return local((0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["phoneHref"])(contacts.phone));
        case 'WHATSAPP':
            {
                const href = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["whatsappHref"])(contacts.whatsapp);
                return href ? {
                    href,
                    external: true
                } : null;
            }
        case 'EMAIL':
            return local((0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["mailHref"])(contacts.email));
        case 'PAGE':
            return targetHref({
                kind: 'PAGE',
                pageId: action.pageId
            }, ctx);
        case 'SECTION':
            return targetHref({
                kind: 'SECTION',
                pageId: action.pageId,
                sectionId: action.sectionId
            }, ctx);
        case 'EXTERNAL':
            return targetHref({
                kind: 'EXTERNAL',
                url: action.url
            }, ctx);
        default:
            throw new RenderError(`action:${String(action.kind)}`);
    }
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/sites/src/render/icons.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ICON_NAMES",
    ()=>ICON_NAMES,
    "icon",
    ()=>icon
]);
/**
 * Значки словаря `Icon` SiteSpec v0 §3: свои линейные SVG рантайма, в разметку встраиваются как есть, `aria-hidden`.
 * Это код WETOP, а не содержимое документа: документ выбирает только имя из словаря.
 */ const PATHS = {
    CLOCK: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    PARKING: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M10 17V7h3a3 3 0 0 1 0 6h-3"/>',
    WIFI: '<path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19" r="1"/>',
    BREAKFAST: '<path d="M4 10h13v4a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6zM17 11h1.5a2.5 2.5 0 0 1 0 5H17M8 3v4M12 3v4"/>',
    LAUNDRY: '<rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="12" cy="13" r="4.5"/><path d="M8 6h1"/>',
    LUGGAGE: '<rect x="5" y="7" width="14" height="13" rx="2"/><path d="M9 7V4h6v3M9 11v5M15 11v5"/>',
    KITCHEN: '<path d="M6 3v8a2 2 0 0 0 2 2v8M10 3v6M14 21V3c3 1 4 4 4 8h-4"/>',
    AIRCON: '<rect x="3" y="5" width="18" height="7" rx="2"/><path d="M7 16c0 2-1 3-2 4M12 16v5M17 16c0 2 1 3 2 4"/>',
    TRANSFER: '<path d="M4 16V9a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v7z"/><circle cx="8" cy="18" r="2"/><circle cx="16" cy="18" r="2"/><path d="M4 11h16"/>',
    PETS: '<circle cx="7" cy="9" r="1.8"/><circle cx="17" cy="9" r="1.8"/><circle cx="10" cy="5.5" r="1.8"/><circle cx="14" cy="5.5" r="1.8"/><path d="M8 17a4 4 0 0 1 8 0c0 2-2 3-4 3s-4-1-4-3z"/>',
    ACCESSIBLE: '<circle cx="12" cy="4" r="1.6"/><path d="M8 8h8M12 8v6h4l2 5M12 14a5 5 0 1 0 4 6"/>',
    FAMILY: '<circle cx="8" cy="6" r="2.5"/><circle cx="16" cy="6" r="2.5"/><circle cx="12" cy="13" r="2"/><path d="M4 21v-6a4 4 0 0 1 8 0M12 21v-4a4 4 0 0 1 8-2v6"/>',
    QUIET: '<path d="M20 15A8 8 0 1 1 9 4a6 6 0 0 0 11 11z"/>',
    CENTER: '<path d="M12 21s7-6 7-12a7 7 0 0 0-14 0c0 6 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>',
    STATION: '<rect x="6" y="3" width="12" height="13" rx="3"/><path d="M6 10h12M9 20l-2 2M15 20l2 2M9 13h.01M15 13h.01"/>',
    STAR: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>'
};
const ICON_NAMES = Object.keys(PATHS);
_c = ICON_NAMES;
function icon(name) {
    const paths = typeof name === 'string' ? PATHS[name] : undefined;
    if (!paths) throw new Error(`icon:${String(name)}`);
    return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
}
var _c;
__turbopack_context__.k.register(_c, "ICON_NAMES");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/sites/src/render/lead-script.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "LEAD_JS",
    ()=>LEAD_JS
]);
/**
 * Клиентский скрипт формы заявки (`leadForm`, SITE-2). Файл WETOP на том же хосте (`/_wetop/lead-<хэш>.js`), как
 * скрипт цен: CSP остаётся без `unsafe-inline`. Форма в HTML скрыта, рядом видна запасная строка с телефоном; скрипт
 * показывает форму и прячет запасную строку, поэтому без JavaScript посетитель видит телефон, а не мёртвую форму.
 *
 * Отправка: JSON на `data-api + data-endpoint` (`/w/beauty/book`, `/w/food/reserve`, `/w/lead`; контракт тела
 * `packages/domain/src/marketing/site-lead.ts`), без cookies. Ключ запроса один на попытку и живёт до успеха: повтор
 * после сбоя сети не создаёт вторую заявку. Turnstile, если API отдаёт его ключ в `GET /w/config`, тем же порядком,
 * что у виджета брони. Ответ показывается текстом (`textContent`), разметки из ответа нет.
 */ var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$beauty$2d$form$2d$script$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/sites/src/render/beauty-form-script.ts [app-client] (ecmascript)");
;
const LEAD_JS = `(function () {
  var s = document.currentScript;
  if (!s || !window.fetch || !window.JSON) return;
  var api = s.getAttribute('data-api');
  var key = s.getAttribute('data-site');
  var lang = s.getAttribute('data-locale') || 'ru';
  if (!api || !key) return;
  var configPromise = null;
  function config() {
    if (!configPromise)
      configPromise = fetch(api + '/w/config', { credentials: 'omit' })
        .then(function (r) { return r.ok ? r.json() : {}; })
        .catch(function () { return {}; });
    return configPromise;
  }
  var turnstilePromise = null;
  function turnstile() {
    if (window.turnstile) return Promise.resolve(window.turnstile);
    if (!turnstilePromise)
      turnstilePromise = new Promise(function (resolve, reject) {
        var t = document.createElement('script');
        t.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        t.async = true;
        t.onload = function () { resolve(window.turnstile); };
        t.onerror = function () { turnstilePromise = null; reject(new Error('turnstile')); };
        document.head.appendChild(t);
      });
    return turnstilePromise;
  }
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var b = new Uint8Array(16);
    crypto.getRandomValues(b);
    b[6] = (b[6] & 15) | 64;
    b[8] = (b[8] & 63) | 128;
    var h = Array.prototype.map.call(b, function (x) { return (x + 256).toString(16).slice(1); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }
  function value(form, name) {
    var el = form.elements[name];
    return el ? String(el.value || '').trim() : '';
  }
  ${__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$beauty$2d$form$2d$script$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BEAUTY_FORM_JS"]}
  function setup(form) {
    var mode = form.getAttribute('data-mode');
    var endpoint = form.getAttribute('data-endpoint');
    var status = form.querySelector('[data-lead-status]');
    var submit = form.querySelector('button[type=submit]');
    var box = form.querySelector('[data-lead-captcha]');
    var fallback = document.querySelector('[data-lead-fallback="' + form.id + '"]');
    var attempt = null;
    var widget = null;
    var token = '';
    form.hidden = false;
    if (fallback) fallback.hidden = true;
    function say(text) { if (status) status.textContent = text; }
    config().then(function (cfg) {
      var siteKey = cfg && cfg.turnstileSiteKey;
      if (!siteKey || !box) return;
      turnstile().then(function (ts) {
        widget = ts.render(box, {
          sitekey: siteKey,
          action: 'booking',
          callback: function (t) { token = t; },
          'expired-callback': function () { token = ''; },
        });
      }).catch(function () {});
    });
    var beauty = mode === 'BEAUTY_APPOINTMENT' ? setupBeauty(form, say, submit) : null;
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (beauty && !beauty.ready()) return;
      if (!form.reportValidity || form.reportValidity()) {
        if (!attempt) attempt = uuid();
        var body = { k: key, name: value(form, 'name'), phone: value(form, 'phone'), requestKey: attempt, lang: lang };
        var comment = value(form, 'comment');
        if (comment) body.comment = comment;
        var hp = form.elements['website'];
        if (hp && hp.value) body.website = hp.value;
        if (token) body.turnstileToken = token;
        if (mode === 'BEAUTY_APPOINTMENT') {
          body.serviceId = value(form, 'serviceId');
          var employee = value(form, 'employeeId');
          if (employee) body.employeeId = employee;
          body.startsAt = value(form, 'startsAt');
        } else if (mode === 'TABLE_RESERVATION') {
          body.date = value(form, 'date');
          body.time = value(form, 'time');
          body.partySize = parseInt(value(form, 'partySize'), 10);
        }
        if (beauty) beauty.pending(true);
        submit.disabled = true;
        say(form.getAttribute('data-sending'));
        fetch(api + endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          credentials: 'omit',
        })
          .then(function (r) {
            return r.json().catch(function () { return {}; }).then(function (data) { return { ok: r.ok, status: r.status, data: data }; });
          })
          .then(function (res) {
            if (res.ok) {
              if (beauty && !beauty.confirm(res.data)) throw new Error('Invalid booking response');
              attempt = null;
              if (!beauty) form.reset();
              else {
                token = '';
                if (widget !== null && window.turnstile) try { window.turnstile.reset(widget); } catch (e) {}
              }
              say(form.getAttribute('data-done'));
              try { if (typeof window.pms === 'function') window.pms('event', 'booking_step', { step: 'done' }); } catch (e) {}
            } else {
              if (beauty) {
                token = '';
                if (widget !== null && window.turnstile) try { window.turnstile.reset(widget); } catch (e) {}
              }
              if (beauty && res.status === 409) beauty.clear();
              var msg = res.data && typeof res.data.message === 'string' ? res.data.message : form.getAttribute('data-error');
              say(msg);
            }
          })
          .catch(function () { say(form.getAttribute('data-error')); })
          .then(function () {
            if (beauty) beauty.pending(false);
            else {
              submit.disabled = false;
              token = '';
              if (widget !== null && window.turnstile) try { window.turnstile.reset(widget); } catch (e) {}
            }
          });
      }
    });
  }
  var forms = document.querySelectorAll('form[data-lead-form]');
  for (var i = 0; i < forms.length; i++) setup(forms[i]);
})();
`;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/sites/src/render/page.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "pageNeedsLead",
    ()=>pageNeedsLead,
    "pageNeedsPrices",
    ()=>pageNeedsPrices,
    "renderNotFound",
    ()=>renderNotFound,
    "renderPage",
    ()=>renderPage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$assets$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/sites/src/assets.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$seo$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/sites/src/seo.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$context$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/sites/src/render/context.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$price$2d$format$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/sites/src/render/price-format.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$sections$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/sites/src/render/sections.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$theme$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/sites/src/render/theme.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/sites/src/render/text.ts [app-client] (ecmascript)");
;
;
;
;
;
;
;
function renderPage(ctx, seo, cssHref) {
    const main = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$sections$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["renderSections"])(ctx);
    return documentHtml(ctx, seo, cssHref, main);
}
function renderNotFound(ctx, seo, cssHref) {
    const s = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ui"])(ctx.locale);
    const main = `<div class="wrap not-found"><h1>${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(s.notFoundTitle)}</h1><p>${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(s.notFoundText)}</p><p><a class="btn" href="${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$context$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["localHref"])('/', ctx))}">${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(s.home)}</a></p></div>`;
    const page = {
        ...ctx.page,
        seo: {
            ...ctx.page.seo,
            index: false,
            title: {
                [ctx.locale]: s.notFoundTitle
            }
        }
    };
    return documentHtml({
        ...ctx,
        page
    }, seo, cssHref, main);
}
function documentHtml(ctx, seo, cssHref, main) {
    const { spec, locale } = ctx;
    const strings = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ui"])(locale);
    const name = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["tx"])(spec.site.displayName, locale));
    const nav = spec.navigation.header.map((item)=>{
        const target = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$context$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["targetHref"])(item.target, ctx);
        if (!target) return '';
        const current = !target.external && target.href === (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$context$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["localHref"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$context$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["pagePath"])(ctx.page), ctx) ? ' aria-current="page"' : '';
        const rel = target.external ? ' rel="noopener noreferrer"' : '';
        return `<a href="${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(target.href)}"${rel}${current}>${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["tx"])(item.label, locale))}</a>`;
    }).filter(Boolean).join('');
    const headerCta = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$sections$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ctaLink"])(spec.navigation.headerCta, ctx);
    const footerLinks = spec.navigation.footer.map((item)=>{
        const target = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$context$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["targetHref"])(item.target, ctx);
        if (!target) return '';
        const rel = target.external ? ' rel="noopener noreferrer"' : '';
        return `<a href="${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(target.href)}"${rel}>${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["tx"])(item.label, locale))}</a>`;
    }).filter(Boolean).join('');
    const privacyPage = spec.site.legal?.privacyPageId ? spec.pages.find((p)=>p.id === spec.site.legal?.privacyPageId) : undefined;
    const privacyHref = privacyPage ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$context$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["localHref"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$context$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["pagePath"])(privacyPage), ctx) : '';
    const privacy = privacyPage && !footerLinks.includes(`href="${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(privacyHref)}"`) ? `<a href="${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(privacyHref)}">${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(strings.privacy)}</a>` : '';
    const operator = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["tx"])(spec.site.legal?.operatorName, locale);
    const tagline = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["tx"])(spec.site.brand?.tagline, locale);
    const footer = `<footer class="site-footer"><div class="wrap">${footerLinks || privacy ? `<nav aria-label="${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(strings.footerNav)}">${footerLinks}${privacy}</nav>` : ''}<p><strong>${name}</strong>${tagline ? `. ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(tagline)}` : ''}</p>${operator ? `<p>${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(operator)}</p>` : ''}<p>${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(strings.madeWith)}</p></div></footer>`;
    const [logo] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$context$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["resolvedImages"])(spec.site.brand?.logo ? [
        spec.site.brand.logo
    ] : [], ctx.assets);
    const logoImg = logo ? `<img class="brand__logo" src="${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(logo.src)}" alt="" decoding="async">` : '';
    const header = `<header class="site-header"><div class="wrap"><a class="brand" href="${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$context$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["localHref"])('/', ctx))}">${logoImg}${name}</a>${nav ? `<nav class="nav" aria-label="${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(strings.menu)}">${nav}</nav>` : ''}${headerCta}</div></header>`;
    const bar = mobileBar(ctx);
    const bodyClass = `${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$theme$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["themeClasses"])(spec.theme)}${bar ? ' has-mobile-bar' : ''}`;
    return `<!doctype html><html lang="${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(locale)}"><head>${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$seo$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["renderHead"])(ctx, seo, cssHref)}</head><body class="${bodyClass}"><a class="skip" href="#main">${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(strings.skip)}</a>${header}<main id="main">${main}</main>${footer}${bar}${scripts(ctx)}</body></html>`;
}
/**
 * SITE-2: закреплённая внизу экрана на телефоне кнопка заявки и WhatsApp (план §1 шаг 4, п. 9). Только ссылки, без
 * скрипта; на широком экране скрыта стилем. Кнопка заявки ведёт к форме или виджету брони; WhatsApp только с номером
 */ function mobileBar(ctx) {
    const bar = ctx.spec.navigation.mobileBar;
    if (!bar) return '';
    const strings = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ui"])(ctx.locale);
    const links = [];
    const book = bar.book ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$context$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["bookingHref"])(ctx) : null;
    if (book) links.push(`<a class="btn" href="${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(book)}">${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$sections$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["leadLabel"])(ctx))}</a>`);
    const wa = bar.whatsapp ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["whatsappHref"])(ctx.spec.site.contacts?.whatsapp) : null;
    if (wa) links.push(`<a class="btn btn--ghost" href="${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(wa)}" rel="noopener noreferrer">${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(strings.writeWhatsapp)}</a>`);
    return links.length ? `<nav class="mobile-bar" aria-label="${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(strings.quickActions)}">${links.join('')}</nav>` : '';
}
function pageNeedsLead(ctx) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$context$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["leadLive"])(ctx) && ctx.page.sections.some((s)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$context$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["usesLeadScript"])(s) && (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$context$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["sectionVisible"])(s, ctx));
}
function pageNeedsPrices(ctx) {
    if (!ctx.bookingLive || !ctx.apiOrigin || !ctx.publicKey) return false;
    return ctx.page.sections.some((s)=>s.type === 'accommodations' && s['showFromPrice'] === true && (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$context$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["sectionVisible"])(s, ctx) || s.type === 'pricing' && (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$context$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["sectionVisible"])(s, ctx));
}
/** Только скрипты WETOP с публичным ключом связанного сайта счётчика; ни одного своего встроенного скрипта */ function scripts(ctx) {
    if (!ctx.apiOrigin || !ctx.publicKey) return '';
    const key = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(ctx.publicKey);
    const api = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(ctx.apiOrigin);
    const parts = [];
    const analytics = ctx.spec.integrations.analytics;
    if (analytics.mode === 'WETOP_TRACKER') {
        const consent = analytics.consent === 'WAIT_FOR_CONSENT' ? ' data-consent="wait"' : '';
        parts.push(`<script async src="${api}/a/pms.js" data-site="${key}"${consent}></script>`);
    }
    const bookingOnPage = ctx.page.sections.some(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$context$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["usesHotelWidget"]);
    if (ctx.bookingLive && bookingOnPage) parts.push(`<script async src="${api}/w/widget.js" data-site="${key}"></script>`);
    if (pageNeedsLead(ctx)) parts.push(`<script defer src="${__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$assets$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["LEAD_PATH"]}" data-api="${api}" data-site="${key}" data-locale="${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(ctx.locale)}"></script>`);
    if (pageNeedsPrices(ctx)) parts.push(`<script defer src="${__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$assets$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PRICES_PATH"]}" data-api="${api}" data-site="${key}" data-locale="${__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$price$2d$format$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["INTL_LOCALE"][ctx.locale]}" data-label="${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$price$2d$format$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PRICE_LABEL"][ctx.locale])}"></script>`);
    return parts.join('');
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/sites/src/render/price-format.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "INTL_LOCALE",
    ()=>INTL_LOCALE,
    "PRICE_LABEL",
    ()=>PRICE_LABEL,
    "formatFromPrice",
    ()=>formatFromPrice,
    "formatMoney",
    ()=>formatMoney,
    "moneyDecimal",
    ()=>moneyDecimal
]);
const PRICE_LABEL = {
    ru: 'от {price} / ночь',
    kk: '{price} бастап / түн',
    en: 'from {price} / night'
};
const INTL_LOCALE = {
    ru: 'ru-RU',
    kk: 'kk-KZ',
    en: 'en-US'
};
function formatFromPrice(minor, currency, locale, label) {
    if (typeof minor !== 'string' || !/^\d{1,15}$/.test(minor)) return null;
    if (typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)) return null;
    const major = Number(minor) / 100;
    let price;
    try {
        price = new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currency,
            currencyDisplay: 'narrowSymbol',
            minimumFractionDigits: major % 1 === 0 ? 0 : 2,
            maximumFractionDigits: 2
        }).format(major);
    } catch  {
        return null;
    }
    return label.replace('{price}', price);
}
function formatMoney(money, locale) {
    if (money === null || typeof money !== 'object') return null;
    const { minor, currency } = money;
    if (typeof minor !== 'string' || !/^(?:0|[1-9][0-9]{0,14})$/.test(minor)) return null;
    if (typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)) return null;
    let format;
    try {
        format = new Intl.NumberFormat(INTL_LOCALE[locale] ?? 'ru-RU', {
            style: 'currency',
            currency,
            currencyDisplay: 'narrowSymbol'
        });
    } catch  {
        return null;
    }
    const digits = format.resolvedOptions().maximumFractionDigits ?? 2;
    const padded = minor.padStart(digits + 1, '0');
    const whole = padded.slice(0, padded.length - digits) || '0';
    const fraction = digits ? padded.slice(padded.length - digits) : '';
    const exact = fraction && /[1-9]/.test(fraction) ? `${whole}.${fraction}` : whole;
    try {
        return new Intl.NumberFormat(INTL_LOCALE[locale] ?? 'ru-RU', {
            style: 'currency',
            currency,
            currencyDisplay: 'narrowSymbol',
            minimumFractionDigits: exact.includes('.') ? digits : 0,
            maximumFractionDigits: digits
        }).format(exact);
    } catch  {
        return null;
    }
}
function moneyDecimal(money) {
    if (money === null || typeof money !== 'object') return null;
    const { minor, currency } = money;
    if (typeof minor !== 'string' || !/^(?:0|[1-9][0-9]{0,14})$/.test(minor)) return null;
    if (typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)) return null;
    let digits;
    try {
        digits = new Intl.NumberFormat('en', {
            style: 'currency',
            currency
        }).resolvedOptions().maximumFractionDigits ?? 2;
    } catch  {
        return null;
    }
    const padded = minor.padStart(digits + 1, '0');
    const whole = padded.slice(0, padded.length - digits);
    return {
        price: digits ? `${whole}.${padded.slice(padded.length - digits)}` : whole,
        currency
    };
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/sites/src/render/prices-script.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "PRICES_JS",
    ()=>PRICES_JS
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$price$2d$format$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/sites/src/render/price-format.ts [app-client] (ecmascript)");
;
const PRICES_JS = `(function () {
  var s = document.currentScript;
  if (!s || !window.fetch) return;
  var api = s.getAttribute('data-api');
  var key = s.getAttribute('data-site');
  var locale = s.getAttribute('data-locale') || 'ru-RU';
  var label = s.getAttribute('data-label') || '{price}';
  var format = ${__TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$price$2d$format$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatFromPrice"].toString()};
  fetch(api + '/w/from-prices?k=' + encodeURIComponent(key), { credentials: 'omit' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) {
      if (!data || !Array.isArray(data.categories)) return;
      var byCode = {};
      data.categories.forEach(function (c) {
        if (c && typeof c.code === 'string') byCode[c.code] = c.fromMinor;
      });
      var places = document.querySelectorAll('[data-from-price]');
      for (var i = 0; i < places.length; i++) {
        var el = places[i];
        var text = format(byCode[el.getAttribute('data-from-price')], data.currency, locale, label);
        if (!text) continue;
        el.textContent = text;
        el.hidden = false;
        var row = el.closest('[data-price-row]');
        if (row) row.hidden = false;
      }
      var sections = document.querySelectorAll('[data-price-section]');
      for (var j = 0; j < sections.length; j++)
        if (sections[j].querySelector('[data-price-row]:not([hidden])')) sections[j].hidden = false;
    })
    .catch(function () {});
})();
`;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/sites/src/render/sections.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SECTION_RENDERERS",
    ()=>SECTION_RENDERERS,
    "ctaLink",
    ()=>ctaLink,
    "leadLabel",
    ()=>leadLabel,
    "renderSections",
    ()=>renderSections
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$lead$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/packages/domain/src/marketing/site-lead.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$context$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/sites/src/render/context.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$icons$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/sites/src/render/icons.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$price$2d$format$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/sites/src/render/price-format.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/sites/src/render/text.ts [app-client] (ecmascript)");
;
;
;
;
;
const t = (value, ctx)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["tx"])(value, ctx.locale));
const heading = (section, ctx, h1)=>`<${h1 ? 'h1' : 'h2'} id="${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(section.id)}-title">${t(section.heading, ctx)}</${h1 ? 'h1' : 'h2'}>`;
const open = (section, extra = '')=>`<section id="${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(section.id)}" aria-labelledby="${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(section.id)}-title"${extra}><div class="wrap">`;
const close = '</div></section>';
const list = (value)=>Array.isArray(value) ? value : [];
function ctaLink(cta, ctx, ghost = false) {
    if (!cta) return '';
    const target = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$context$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["actionHref"])(cta.action, ctx);
    if (!target) return '';
    const rel = target.external ? ' rel="noopener noreferrer"' : '';
    return `<a class="btn${ghost ? ' btn--ghost' : ''}" href="${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(target.href)}"${rel}>${t(cta.label, ctx)}</a>`;
}
/** Картинка только с подписанным адресом из карты ассетов (MKT8); адреса нет, нет и картинки */ function image(ref, ctx, eager = false) {
    const [img] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$context$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["resolvedImages"])(ref ? [
        ref
    ] : [], ctx.assets);
    if (!img) return '';
    return `<img src="${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(img.src)}" alt="${t(img.alt, ctx)}"${eager ? '' : ' loading="lazy"'} decoding="async">`;
}
const hero = (s, ctx, { h1 })=>{
    const sub = s['subheading'] ? `<p class="lead">${t(s['subheading'], ctx)}</p>` : '';
    const actions = [
        ctaLink(s['primaryAction'], ctx),
        ctaLink(s['secondaryAction'], ctx, true)
    ].filter(Boolean).join('');
    return `${open(s, ' class="hero"')}${heading(s, ctx, h1)}${sub}${actions ? `<div class="actions">${actions}</div>` : ''}${image(s['image'], ctx, true)}${close}`;
};
const about = (s, ctx, { h1 })=>`${open(s)}${heading(s, ctx, h1)}${list(s['paragraphs']).map((p)=>`<p>${t(p, ctx)}</p>`).join('')}${image(s['image'], ctx)}${close}`;
const features = (s, ctx, { h1 })=>{
    const items = list(s['items']).map((i)=>`<li class="card item">${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$icons$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["icon"])(i['icon'])}<div><h3>${t(i['title'], ctx)}</h3><p class="muted">${t(i['text'], ctx)}</p></div></li>`).join('');
    const cls = s.variant === 'GRID' ? 'list grid' : 'list';
    return `${open(s)}${heading(s, ctx, h1)}<ul class="${cls}">${items}</ul>${close}`;
};
const accommodations = (s, ctx, { h1 })=>{
    const showCapacity = s['showLiveCapacity'] === true;
    const cards = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$context$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["visibleCards"])(s, ctx.facts).map((item)=>{
        const fact = ctx.facts?.categories.find((c)=>c.code === item['categoryCode']);
        const capacity = showCapacity && fact?.active && typeof fact.capacityAdults === 'number' ? `<p class="muted">${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ui"])(ctx.locale).capacity(fact.capacityAdults))}</p>` : '';
        const highlights = list(item['highlights']);
        const chips = highlights.length ? `<ul class="chips">${highlights.map((h)=>`<li>${t(h, ctx)}</li>`).join('')}</ul>` : '';
        const pics = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$context$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["resolvedImages"])(item['images'], ctx.assets).map((img)=>`<img src="${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(img.src)}" alt="${t(img.alt, ctx)}" loading="lazy" decoding="async">`).join('');
        // B-FROMPRICE (Q-276): в HTML только скрытое место, число ставит скрипт цен по живому ответу API
        const price = s['showFromPrice'] === true && ctx.bookingLive ? fromPricePlace(String(item['categoryCode'])) : '';
        const action = ctaLink(s['itemAction'] ?? {
            label: {
                [ctx.locale]: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ui"])(ctx.locale).book
            },
            action: {
                kind: 'BOOK'
            }
        }, ctx);
        const body = `${pics}<h3>${t(item['title'], ctx)}</h3><p>${t(item['description'], ctx)}</p>${capacity}${price}${chips}${action ? `<div class="actions">${action}</div>` : ''}`;
        return s.variant === 'ROWS' ? `<li class="row"><div>${body}</div></li>` : `<li class="card">${body}</li>`;
    }).join('');
    const cls = s.variant === 'ROWS' ? 'list' : 'list grid';
    return `${open(s)}${heading(s, ctx, h1)}<ul class="${cls}">${cards}</ul>${close}`;
};
const amenities = (s, ctx, { h1 })=>{
    const items = list(s['items']).map((i)=>{
        const note = i['note'] ? `<br><span class="muted">${t(i['note'], ctx)}</span>` : '';
        return `<li class="item">${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$icons$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["icon"])(i['icon'])}<span>${t(i['label'], ctx)}${note}</span></li>`;
    }).join('');
    return `${open(s)}${heading(s, ctx, h1)}<ul class="list list--cols">${items}</ul>${close}`;
};
/** Скрытое место под цену «от»: число ставит только скрипт цен, в HTML его нет никогда */ const fromPricePlace = (code)=>`<p class="from-price" data-from-price="${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(code)}" hidden></p>`;
/**
 * `pricing` (Q-276): строки категорий с живой ценой. Секция и строки скрыты в HTML; скрипт цен показывает строку, когда
 * пришла её цена, и секцию, когда видна хотя бы одна строка. Ответа нет: секция остаётся скрытой.
 */ const pricing = (s, ctx, { h1 })=>{
    const action = ctaLink({
        label: {
            [ctx.locale]: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ui"])(ctx.locale).book
        },
        action: {
            kind: 'BOOK'
        }
    }, ctx);
    const rows = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$context$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["pricingRows"])(s, ctx).map((row)=>`<li class="row" data-price-row hidden><div><h3>${t(row.title, ctx)}</h3>${fromPricePlace(row.code)}</div>${action ? `<div>${action}</div>` : ''}</li>`).join('');
    const note = s['note'] ? `<p class="muted">${t(s['note'], ctx)}</p>` : '';
    return `${open(s, ' class="pricing" data-price-section hidden')}${heading(s, ctx, h1)}<ul class="list">${rows}</ul>${note}${close}`;
};
const gallery = (s, ctx, { h1 })=>{
    const imgs = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$context$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["resolvedImages"])(s['images'], ctx.assets).map((img)=>`<li><img src="${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(img.src)}" alt="${t(img.alt, ctx)}" loading="lazy" decoding="async"></li>`).join('');
    return `${open(s)}${heading(s, ctx, h1)}<ul class="list grid">${imgs}</ul>${close}`;
};
function checkInOut(ctx) {
    const from = ctx.facts?.checkInTime;
    const to = ctx.facts?.checkOutTime;
    const strings = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ui"])(ctx.locale);
    if (!from && !to) return '';
    const parts = [
        from ? strings.checkIn(from) : '',
        to ? strings.checkOut(to) : ''
    ].filter(Boolean).join(', ');
    return `<p class="muted">${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(parts.charAt(0).toUpperCase() + parts.slice(1))}</p>`;
}
const booking = (s, ctx, { h1 })=>{
    const note = s['note'] ? `<p class="booking-note">${t(s['note'], ctx)}</p>` : '';
    const times = s['showCheckInOut'] === true ? checkInOut(ctx) : '';
    let body;
    if (ctx.bookingLive) {
        // точка монтирования виджета: сам виджет и его запросы `/w/*` идут из браузера прямо в API, рантайм их не проксирует
        body = '<div id="pms-booking"></div>';
    } else {
        const phone = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["phoneHref"])(ctx.spec.site.contacts?.phone);
        const strings = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ui"])(ctx.locale);
        body = `<p>${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(strings.bookingUnavailable)}</p>${phone ? `<p><a class="btn" href="${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(phone)}">${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(strings.callUs)}</a></p>` : ''}`;
    }
    return `${open(s)}${heading(s, ctx, h1)}${times}${note}${body}${close}`;
};
const contacts = (s, ctx, { h1 })=>{
    const c = ctx.spec.site.contacts ?? {};
    const strings = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ui"])(ctx.locale);
    const rows = [];
    const phone = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["phoneHref"])(c.phone);
    if (s['showPhone'] === true && phone) rows.push(`<li>${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(strings.phone)}: <a href="${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(phone)}">${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(c.phone)}</a></li>`);
    const wa = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["whatsappHref"])(c.whatsapp);
    if (s['showWhatsapp'] === true && wa) rows.push(`<li>${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(strings.whatsapp)}: <a href="${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(wa)}" rel="noopener noreferrer">${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(c.whatsapp)}</a></li>`);
    const mail = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["mailHref"])(c.email);
    if (s['showEmail'] === true && mail) rows.push(`<li>${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(strings.email)}: <a href="${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(mail)}">${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(c.email)}</a></li>`);
    if (s['showAddress'] === true && c.address) rows.push(`<li>${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(strings.address)}: ${t(c.address, ctx)}</li>`);
    if (s.variant === 'WITH_MAP' && s['map'] && c.geo) {
        const { lat, lng } = c.geo;
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
            const href = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
            rows.push(`<li><a href="${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(href)}" rel="noopener noreferrer">${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(strings.map)}</a></li>`);
        }
    }
    const directions = s['directions'] ? `<p>${t(s['directions'], ctx)}</p>` : '';
    return `${open(s)}${heading(s, ctx, h1)}${rows.length ? `<ul class="contact-list">${rows.join('')}</ul>` : ''}${directions}${close}`;
};
const faq = (s, ctx, { h1 })=>{
    const items = list(s['items']);
    const body = s.variant === 'ACCORDION' ? items.map((i)=>`<details><summary>${t(i['question'], ctx)}</summary><p>${t(i['answer'], ctx)}</p></details>`).join('') : items.map((i)=>`<h3>${t(i['question'], ctx)}</h3><p>${t(i['answer'], ctx)}</p>`).join('');
    return `${open(s, ' class="faq"')}${heading(s, ctx, h1)}${body}${close}`;
};
const cta = (s, ctx, { h1 })=>{
    const text = s['text'] ? `<p>${t(s['text'], ctx)}</p>` : '';
    const action = ctaLink(s['action'], ctx);
    return `${open(s, ' class="cta-band"')}${heading(s, ctx, h1)}${text}${action ? `<div class="actions">${action}</div>` : ''}${image(s['image'], ctx)}${close}`;
};
function leadLabel(ctx) {
    const strings = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ui"])(ctx.locale);
    const form = ctx.spec.pages.flatMap((p)=>p.sections).find((s)=>s.type === 'leadForm');
    const mode = form?.['mode'];
    if (mode === 'BEAUTY_APPOINTMENT') return strings.appoint;
    if (mode === 'TABLE_RESERVATION') return strings.bookTable;
    if (mode === 'CALLBACK') return strings.callback;
    return strings.book;
}
const bookCta = (ctx)=>({
        label: {
            [ctx.locale]: leadLabel(ctx)
        },
        action: {
            kind: 'BOOK'
        }
    });
/** Цена снимком из данных: точная или «от»; нет или битая: строки цены нет */ function priceText(money, from, ctx) {
    const formatted = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$price$2d$format$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatMoney"])(money, ctx.locale);
    if (!formatted) return '';
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(from ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ui"])(ctx.locale).priceFrom(formatted) : formatted);
}
const priceTag = (money, from, ctx)=>{
    const text = priceText(money, from, ctx);
    return text ? `<strong class="price">${text}</strong>` : '';
};
const services = (s, ctx, { h1 })=>{
    const strings = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ui"])(ctx.locale);
    const items = list(s['items']);
    const action = ctaLink(s['itemAction'] ?? bookCta(ctx), ctx, true);
    const item = (i)=>{
        const meta = [
            s['showDuration'] === true && typeof i['durationMin'] === 'number' ? `<span>${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(strings.minutes(i['durationMin']))}</span>` : '',
            s['showPrices'] === true ? priceTag(i['price'], i['priceFrom'] === true, ctx) : ''
        ].filter(Boolean);
        const desc = i['description'] ? `<p class="muted">${t(i['description'], ctx)}</p>` : '';
        const body = `<div><h3>${t(i['title'], ctx)}</h3>${desc}</div><div class="item-side">${meta.length ? `<p class="item-meta">${meta.join('')}</p>` : ''}${action}</div>`;
        return s.variant === 'CARDS' ? `<li class="card catalog-item">${body}</li>` : `<li class="row catalog-item">${body}</li>`;
    };
    const cls = s.variant === 'CARDS' ? 'list grid' : 'list';
    let body;
    if (s['groupByCategory'] === true) {
        const groups = [];
        for (const i of items){
            const key = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["tx"])(i['category'], ctx.locale);
            let g = groups.find((x)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["tx"])(x.title, ctx.locale) === key);
            if (!g) groups.push(g = {
                title: i['category'],
                items: []
            });
            g.items.push(i);
        }
        body = groups.map((g)=>`${g.title ? `<h3 class="group-title">${t(g.title, ctx)}</h3>` : ''}<ul class="${cls}">${g.items.map(item).join('')}</ul>`).join('');
    } else body = `<ul class="${cls}">${items.map(item).join('')}</ul>`;
    return `${open(s, ' class="catalog"')}${heading(s, ctx, h1)}${body}${close}`;
};
const staff = (s, ctx, { h1 })=>{
    const cards = list(s['items']).map((i)=>{
        const spec = i['specialization'] ? `<p class="muted">${t(i['specialization'], ctx)}</p>` : '';
        const body = `${image(i['image'], ctx)}<h3>${t(i['name'], ctx)}</h3>${spec}`;
        return s.variant === 'CARDS' ? `<li class="card person">${body}</li>` : `<li class="row person">${body}</li>`;
    }).join('');
    return `${open(s)}${heading(s, ctx, h1)}<ul class="${s.variant === 'CARDS' ? 'list grid' : 'list'}">${cards}</ul>${close}`;
};
const menu = (s, ctx, { h1 })=>{
    const strings = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ui"])(ctx.locale);
    const photos = s['showPhotos'] === true;
    const cats = list(s['categories']).map((c)=>{
        const items = list(c['items']).map((i)=>{
            const weight = typeof i['weightGrams'] === 'number' ? `<span class="muted">${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(strings.grams(i['weightGrams']))}</span>` : '';
            const price = priceText(i['price'], false, ctx);
            const desc = i['description'] ? `<p class="muted">${t(i['description'], ctx)}</p>` : '';
            const pic = photos ? image(i['image'], ctx) : '';
            const cls = s.variant === 'CARDS' ? 'card dish' : 'row dish';
            return `<li class="${cls}">${pic}<div><h4>${t(i['title'], ctx)}</h4>${desc}${weight}</div>${price ? `<strong class="price">${price}</strong>` : ''}</li>`;
        }).join('');
        return `<h3 class="group-title">${t(c['title'], ctx)}</h3><ul class="${s.variant === 'CARDS' ? 'list grid' : 'list'}">${items}</ul>`;
    }).join('');
    return `${open(s, ' class="catalog"')}${heading(s, ctx, h1)}${cats}${close}`;
};
/** Дни с понедельника, как читают расписание; дней нет в документе: строки нет (о выходных ничего не утверждаем) */ const WEEK_ORDER = [
    1,
    2,
    3,
    4,
    5,
    6,
    0
];
const hours = (s, ctx, { h1 })=>{
    const strings = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ui"])(ctx.locale);
    const days = list(s['days']);
    const byDay = new Map(days.map((d)=>[
            d.weekday,
            d
        ]));
    const span = (d)=>`${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(d.open)}–${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(d.close)}`;
    let body;
    if (s.variant === 'COMPACT') {
        const runs = [];
        for (const w of WEEK_ORDER){
            const d = byDay.get(w);
            if (!d) continue;
            const text = span(d);
            const last = runs.at(-1);
            if (last && last.text === text && WEEK_ORDER.indexOf(last.to) === WEEK_ORDER.indexOf(w) - 1) last.to = w;
            else runs.push({
                from: w,
                to: w,
                text
            });
        }
        body = `<ul class="hours-compact">${runs.map((r)=>`<li><b>${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(strings.weekdaysShort[r.from])}${r.to !== r.from ? `–${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(strings.weekdaysShort[r.to])}` : ''}</b> ${r.text}</li>`).join('')}</ul>`;
    } else body = `<table class="hours"><tbody>${WEEK_ORDER.filter((w)=>byDay.has(w)).map((w)=>`<tr><th scope="row">${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(strings.weekdays[w])}</th><td>${span(byDay.get(w))}</td></tr>`).join('')}</tbody></table>`;
    const note = s['note'] ? `<p class="muted">${t(s['note'], ctx)}</p>` : '';
    return `${open(s)}${heading(s, ctx, h1)}${body}${note}${close}`;
};
function field(id, label, control) {
    return `<p class="field"><label for="${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(id)}">${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(label)}</label>${control}</p>`;
}
/** Запасной путь без скрипта: позвонить или написать; без контактов строки нет */ function leadFallback(ctx, formId, visible) {
    const c = ctx.spec.site.contacts ?? {};
    const strings = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ui"])(ctx.locale);
    const phone = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["phoneHref"])(c.phone);
    const wa = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["whatsappHref"])(c.whatsapp);
    const links = [
        phone ? `<a class="btn" href="${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(phone)}">${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(strings.callUs)}</a>` : '',
        wa ? `<a class="btn btn--ghost" href="${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(wa)}" rel="noopener noreferrer">${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(strings.writeWhatsapp)}</a>` : ''
    ].filter(Boolean);
    if (!links.length) return '';
    return `<div class="actions" data-lead-fallback="${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(formId)}"${visible ? '' : ' hidden'}>${links.join('')}</div>`;
}
const leadForm = (s, ctx, { h1 })=>{
    const strings = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ui"])(ctx.locale);
    const mode = String(s['mode']);
    const note = s['note'] ? `<p class="booking-note">${t(s['note'], ctx)}</p>` : '';
    const formId = `${s.id}-form`;
    if (mode === 'HOTEL_BOOKING') {
        // гостиница: тот же виджет `/w/book`, что у секции `booking`
        const body = ctx.bookingLive ? '<div id="pms-booking"></div>' : `<p>${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(strings.bookingUnavailable)}</p>${leadFallback(ctx, formId, true)}`;
        return `${open(s)}${heading(s, ctx, h1)}${note}${body}${close}`;
    }
    const live = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$context$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["leadLive"])(ctx);
    const id = (name)=>`${s.id}-${name}`;
    const controls = [];
    if (mode === 'BEAUTY_APPOINTMENT') {
        const all = ctx.spec.pages.flatMap((p)=>p.sections);
        const serviceOptions = all.filter((x)=>x.type === 'services').flatMap((x)=>list(x['items'])).map((i)=>`<option value="${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(String(i['serviceCode']))}">${t(i['title'], ctx)}</option>`).join('');
        const staffOptions = all.filter((x)=>x.type === 'staff').flatMap((x)=>list(x['items'])).map((i)=>`<option value="${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(String(i['employeeId']))}">${t(i['name'], ctx)}</option>`).join('');
        // SiteSpec keeps the existing serviceCode catalog field; the public booking wire calls that UUID serviceId.
        controls.push(field(id('service'), strings.formService, `<select id="${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(id('service'))}" name="serviceId" required>${serviceOptions}</select>`));
        controls.push(field(id('master'), strings.formMaster, `<select id="${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(id('master'))}" name="employeeId"><option value="">${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(strings.formAnyMaster)}</option>${staffOptions}</select>`));
    }
    if (mode === 'BEAUTY_APPOINTMENT' || mode === 'TABLE_RESERVATION') {
        controls.push(field(id('date'), strings.formDate, `<input id="${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(id('date'))}" name="date" type="date" required>`));
        if (mode === 'TABLE_RESERVATION') controls.push(field(id('time'), strings.formTime, `<input id="${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(id('time'))}" name="time" type="time" step="900" required>`));
        else {
            controls.push(field(id('time'), strings.formTime, `<select id="${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(id('time'))}" name="startsAt" required disabled><option value=""></option></select>`));
            controls.push('<p data-beauty-details aria-live="polite"></p><p><button type="button" data-beauty-refresh></button></p>');
        }
    }
    if (mode === 'TABLE_RESERVATION') controls.push(field(id('party'), strings.formParty, `<input id="${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(id('party'))}" name="partySize" type="number" min="1" max="50" value="2" inputmode="numeric" required>`));
    controls.push(field(id('name'), strings.formName, `<input id="${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(id('name'))}" name="name" type="text" maxlength="${mode === 'BEAUTY_APPOINTMENT' ? 100 : 120}" autocomplete="name" required>`));
    controls.push(field(id('phone'), strings.formPhone, `<input id="${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(id('phone'))}" name="phone" type="tel" maxlength="32" autocomplete="tel" inputmode="tel" required>`));
    if (s['showComment'] === true) controls.push(field(id('comment'), strings.formComment, `<textarea id="${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(id('comment'))}" name="comment" rows="3" maxlength="1000"></textarea>`));
    // ловушка для ботов: человек её не видит и не достаёт табом
    controls.push('<p class="hp" aria-hidden="true"><input name="website" type="text" tabindex="-1" autocomplete="off"></p>');
    const submit = s['submitLabel'] ? t(s['submitLabel'], ctx) : (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(strings.formSend);
    const endpoint = __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$packages$2f$domain$2f$src$2f$marketing$2f$site$2d$lead$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SITE_LEAD_ENDPOINTS"][mode] ?? '';
    const attrs = [
        `id="${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(formId)}"`,
        'class="lead-form"',
        'data-lead-form',
        `data-mode="${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(mode)}"`,
        `data-endpoint="${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(endpoint)}"`,
        `data-sending="${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(strings.formSending)}"`,
        `data-done="${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(strings.formDone)}"`,
        `data-error="${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(strings.formError)}"`,
        // форму показывает скрипт; без скрипта видна запасная строка с телефоном. Превью и сайт без ключа: форма видна,
        // но выключена, чтобы было видно, как она выглядит
        live ? 'hidden' : ''
    ].filter(Boolean);
    const inner = `${controls.join('')}<div data-lead-captcha></div><p><button class="btn" type="submit">${submit}</button></p><p class="lead-status" role="status" aria-live="polite" data-lead-status></p>`;
    const form = `<form ${attrs.join(' ')}>${live ? inner : `<fieldset disabled>${inner}</fieldset>`}</form>`;
    return `${open(s, s.variant === 'CARD' ? ' class="lead lead--card"' : ' class="lead"')}${heading(s, ctx, h1)}${note}${form}${leadFallback(ctx, formId, live)}${close}`;
};
const SECTION_RENDERERS = {
    hero: {
        IMAGE_FULL: hero,
        IMAGE_SIDE: hero,
        TEXT_ONLY: hero
    },
    about: {
        TEXT_ONLY: about,
        TEXT_IMAGE: about
    },
    features: {
        GRID: features,
        LIST: features
    },
    accommodations: {
        CARDS: accommodations,
        ROWS: accommodations
    },
    amenities: {
        LIST: amenities,
        ICONS: amenities
    },
    pricing: {
        FROM_PRICES: pricing
    },
    gallery: {
        GRID: gallery,
        CAROUSEL: gallery
    },
    booking: {
        INLINE: booking
    },
    contacts: {
        PLAIN: contacts,
        WITH_MAP: contacts
    },
    faq: {
        ACCORDION: faq,
        LIST: faq
    },
    cta: {
        BANNER: cta,
        SPLIT: cta
    },
    services: {
        LIST: services,
        CARDS: services
    },
    staff: {
        CARDS: staff,
        LIST: staff
    },
    menu: {
        LIST: menu,
        CARDS: menu
    },
    hours: {
        TABLE: hours,
        COMPACT: hours
    },
    leadForm: {
        INLINE: leadForm,
        CARD: leadForm
    }
};
function renderSections(ctx) {
    const sections = ctx.page.sections;
    for (const s of sections){
        const byVariant = Object.hasOwn(SECTION_RENDERERS, s.type) ? SECTION_RENDERERS[s.type] : undefined;
        if (!byVariant || !Object.hasOwn(byVariant, s.variant)) throw new __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$context$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["RenderError"](`section:${s.type}:${s.variant}`);
    }
    const heroFirst = sections[0]?.type === 'hero';
    const title = heroFirst ? '' : `<div class="wrap"><h1 class="page-title">${t(ctx.page.title, ctx)}</h1></div>`;
    const body = sections.filter((s)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$context$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["sectionVisible"])(s, ctx)).map((s, i)=>SECTION_RENDERERS[s.type][s.variant](s, ctx, {
            h1: heroFirst && i === 0 && s.type === 'hero'
        })).join('');
    return title + body;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/sites/src/render/text.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "esc",
    ()=>esc,
    "mailHref",
    ()=>mailHref,
    "phoneHref",
    ()=>phoneHref,
    "safeHttps",
    ()=>safeHttps,
    "tx",
    ()=>tx,
    "ui",
    ()=>ui,
    "whatsappHref",
    ()=>whatsappHref
]);
function esc(value) {
    return value.replace(/[&<>"']/g, (c)=>c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;');
}
function tx(text, locale) {
    return text?.[locale] ?? '';
}
function safeHttps(raw) {
    if (typeof raw !== 'string') return null;
    try {
        const url = new URL(raw);
        if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
        return url.href;
    } catch  {
        return null;
    }
}
const PHONE_RE = /^\+[1-9][0-9]{9,14}$/;
const phoneHref = (phone)=>typeof phone === 'string' && PHONE_RE.test(phone) ? `tel:${phone}` : null;
const whatsappHref = (phone)=>typeof phone === 'string' && PHONE_RE.test(phone) ? `https://wa.me/${phone.slice(1)}` : null;
const mailHref = (email)=>typeof email === 'string' && /^[^\s<>@]+@[^\s<>@]+$/.test(email) && email.length <= 254 ? `mailto:${email}` : null;
const UI = {
    ru: {
        skip: 'Перейти к содержимому',
        checkIn: (from)=>`Заезд с ${from}`,
        checkOut: (to)=>`выезд до ${to}`,
        bookingUnavailable: 'Онлайн-бронирование сейчас недоступно.',
        callUs: 'Позвоните нам',
        capacity: (n)=>`До ${n} ${n === 1 ? 'гостя' : 'гостей'}`,
        phone: 'Телефон',
        whatsapp: 'WhatsApp',
        email: 'Почта',
        address: 'Адрес',
        map: 'Открыть на карте',
        madeWith: 'Сайт сделан на WETOP',
        privacy: 'Политика конфиденциальности',
        menu: 'Основное меню',
        footerNav: 'Ссылки сайта',
        notFoundTitle: 'Страница не найдена',
        notFoundText: 'Такой страницы на сайте нет.',
        home: 'На главную',
        book: 'Забронировать',
        appoint: 'Записаться',
        bookTable: 'Забронировать стол',
        callback: 'Перезвоните мне',
        writeWhatsapp: 'WhatsApp',
        minutes: (n)=>`${n} мин`,
        grams: (n)=>`${n} г`,
        priceFrom: (price)=>`от ${price}`,
        weekdays: [
            'Воскресенье',
            'Понедельник',
            'Вторник',
            'Среда',
            'Четверг',
            'Пятница',
            'Суббота'
        ],
        weekdaysShort: [
            'Вс',
            'Пн',
            'Вт',
            'Ср',
            'Чт',
            'Пт',
            'Сб'
        ],
        formName: 'Имя',
        formPhone: 'Телефон',
        formComment: 'Комментарий',
        formService: 'Услуга',
        formMaster: 'Мастер',
        formAnyMaster: 'Любой мастер',
        formDate: 'Дата',
        formTime: 'Время',
        formParty: 'Гостей',
        formSend: 'Отправить',
        formSending: 'Отправляем…',
        formDone: 'Заявка принята. Мы свяжемся с вами.',
        formError: 'Не удалось отправить. Попробуйте ещё раз или позвоните нам.',
        formUnavailable: 'Онлайн-запись сейчас недоступна.',
        quickActions: 'Быстрые действия'
    },
    kk: {
        skip: 'Мазмұнға өту',
        checkIn: (from)=>`Кіру ${from}-ден бастап`,
        checkOut: (to)=>`шығу ${to}-ге дейін`,
        bookingUnavailable: 'Онлайн брондау қазір қолжетімсіз.',
        callUs: 'Бізге қоңырау шалыңыз',
        capacity: (n)=>`${n} қонаққа дейін`,
        phone: 'Телефон',
        whatsapp: 'WhatsApp',
        email: 'Пошта',
        address: 'Мекенжай',
        map: 'Картадан ашу',
        madeWith: 'Сайт WETOP-та жасалған',
        privacy: 'Құпиялылық саясаты',
        menu: 'Негізгі мәзір',
        footerNav: 'Сайт сілтемелері',
        notFoundTitle: 'Бет табылмады',
        notFoundText: 'Сайтта мұндай бет жоқ.',
        home: 'Басты бетке',
        book: 'Брондау',
        appoint: 'Жазылу',
        bookTable: 'Үстел брондау',
        callback: 'Маған қоңырау шалыңыз',
        writeWhatsapp: 'WhatsApp',
        minutes: (n)=>`${n} мин`,
        grams: (n)=>`${n} г`,
        priceFrom: (price)=>`${price} бастап`,
        weekdays: [
            'Жексенбі',
            'Дүйсенбі',
            'Сейсенбі',
            'Сәрсенбі',
            'Бейсенбі',
            'Жұма',
            'Сенбі'
        ],
        weekdaysShort: [
            'Жс',
            'Дс',
            'Сс',
            'Ср',
            'Бс',
            'Жм',
            'Сб'
        ],
        formName: 'Аты',
        formPhone: 'Телефон',
        formComment: 'Пікір',
        formService: 'Қызмет',
        formMaster: 'Шебер',
        formAnyMaster: 'Кез келген шебер',
        formDate: 'Күні',
        formTime: 'Уақыты',
        formParty: 'Қонақтар',
        formSend: 'Жіберу',
        formSending: 'Жіберілуде…',
        formDone: 'Өтінім қабылданды. Біз сізбен хабарласамыз.',
        formError: 'Жіберу мүмкін болмады. Қайталап көріңіз немесе бізге қоңырау шалыңыз.',
        formUnavailable: 'Онлайн жазылу қазір қолжетімсіз.',
        quickActions: 'Жылдам әрекеттер'
    },
    en: {
        skip: 'Skip to content',
        checkIn: (from)=>`Check-in from ${from}`,
        checkOut: (to)=>`check-out until ${to}`,
        bookingUnavailable: 'Online booking is not available right now.',
        callUs: 'Call us',
        capacity: (n)=>`Up to ${n} ${n === 1 ? 'guest' : 'guests'}`,
        phone: 'Phone',
        whatsapp: 'WhatsApp',
        email: 'Email',
        address: 'Address',
        map: 'Open on the map',
        madeWith: 'Site made with WETOP',
        privacy: 'Privacy policy',
        menu: 'Main menu',
        footerNav: 'Site links',
        notFoundTitle: 'Page not found',
        notFoundText: 'There is no such page on this site.',
        home: 'Go to home page',
        book: 'Book',
        appoint: 'Book a visit',
        bookTable: 'Book a table',
        callback: 'Call me back',
        writeWhatsapp: 'WhatsApp',
        minutes: (n)=>`${n} min`,
        grams: (n)=>`${n} g`,
        priceFrom: (price)=>`from ${price}`,
        weekdays: [
            'Sunday',
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday'
        ],
        weekdaysShort: [
            'Sun',
            'Mon',
            'Tue',
            'Wed',
            'Thu',
            'Fri',
            'Sat'
        ],
        formName: 'Name',
        formPhone: 'Phone',
        formComment: 'Comment',
        formService: 'Service',
        formMaster: 'Specialist',
        formAnyMaster: 'Any specialist',
        formDate: 'Date',
        formTime: 'Time',
        formParty: 'Guests',
        formSend: 'Send',
        formSending: 'Sending…',
        formDone: 'Request received. We will contact you.',
        formError: 'Could not send. Please try again or call us.',
        formUnavailable: 'Online booking is not available right now.',
        quickActions: 'Quick actions'
    }
};
const ui = (locale)=>UI[locale] ?? UI.ru;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/sites/src/render/theme.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Темы рантайма (SiteSpec v0 §5): документ выбирает значения из словарей, цвета и шрифты живут здесь. Все пресеты
 * светлые (`colorScheme` в v0 только `LIGHT`). Контраст каждого сочетания пресета и акцента проверяет тест
 * `theme.test.ts` (WCAG AA 4,5:1) один раз для библиотеки, а не на каждом сайте.
 */ __turbopack_context__.s([
    "ACCENTS",
    ()=>ACCENTS,
    "DENSITY",
    ()=>DENSITY,
    "PRESETS",
    ()=>PRESETS,
    "RADIUS",
    ()=>RADIUS,
    "SITE_CSS",
    ()=>SITE_CSS,
    "TYPOGRAPHY",
    ()=>TYPOGRAPHY,
    "themeClasses",
    ()=>themeClasses
]);
const PRESETS = {
    CALM: {
        bg: '#ffffff',
        surface: '#f3f5f7',
        text: '#1c2630',
        muted: '#4c5966',
        border: '#d5dce3'
    },
    WARM: {
        bg: '#fffaf4',
        surface: '#f6ede2',
        text: '#2a1f16',
        muted: '#5a4838',
        border: '#e5d5c2'
    },
    NIGHT: {
        bg: '#f4f6fb',
        surface: '#e6eaf3',
        text: '#101726',
        muted: '#465267',
        border: '#cbd3e2'
    },
    COAST: {
        bg: '#f6fbfc',
        surface: '#e6f1f4',
        text: '#11303a',
        muted: '#3e5d67',
        border: '#c8dfe5'
    }
};
const ACCENTS = {
    TEAL: {
        accent: '#0d6a62',
        onAccent: '#ffffff'
    },
    INDIGO: {
        accent: '#3a3db0',
        onAccent: '#ffffff'
    },
    TERRACOTTA: {
        accent: '#9c4127',
        onAccent: '#ffffff'
    },
    FOREST: {
        accent: '#2c6537',
        onAccent: '#ffffff'
    },
    GRAPHITE: {
        accent: '#343c48',
        onAccent: '#ffffff'
    },
    GOLD: {
        accent: '#7d5200',
        onAccent: '#ffffff'
    }
};
const TYPOGRAPHY = {
    MODERN: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    CLASSIC: 'Georgia, "Times New Roman", "PT Serif", serif',
    ROUNDED: 'ui-rounded, "SF Pro Rounded", "Nunito", system-ui, sans-serif'
};
const RADIUS = {
    SHARP: '2px',
    SOFT: '10px',
    ROUND: '20px'
};
const DENSITY = {
    COMPACT: {
        section: '40px',
        gap: '16px'
    },
    COMFORTABLE: {
        section: '72px',
        gap: '24px'
    }
};
function themeClasses(theme) {
    const pick = (value, dict, prefix)=>{
        if (typeof value !== 'string' || !(value in dict)) throw new Error(`theme:${prefix}:${String(value)}`);
        return `${prefix}-${value.toLowerCase()}`;
    };
    if (theme['colorScheme'] !== 'LIGHT') throw new Error(`theme:scheme:${String(theme['colorScheme'])}`);
    return [
        pick(theme['preset'], PRESETS, 'p'),
        pick(theme['accent'], ACCENTS, 'a'),
        pick(theme['typography'], TYPOGRAPHY, 't'),
        pick(theme['radius'], RADIUS, 'r'),
        pick(theme['density'], DENSITY, 'd')
    ].join(' ');
}
const vars = (selector, pairs)=>`${selector}{${Object.entries(pairs).map(([k, v])=>`--${k}:${v}`).join(';')}}`;
const SITE_CSS = [
    ...Object.entries(PRESETS).map(([k, t])=>vars(`.p-${k.toLowerCase()}`, {
            bg: t.bg,
            surface: t.surface,
            text: t.text,
            muted: t.muted,
            border: t.border
        })),
    ...Object.entries(ACCENTS).map(([k, t])=>vars(`.a-${k.toLowerCase()}`, {
            accent: t.accent,
            'on-accent': t.onAccent
        })),
    ...Object.entries(TYPOGRAPHY).map(([k, f])=>vars(`.t-${k.toLowerCase()}`, {
            font: f
        })),
    ...Object.entries(RADIUS).map(([k, r])=>vars(`.r-${k.toLowerCase()}`, {
            radius: r
        })),
    ...Object.entries(DENSITY).map(([k, d])=>vars(`.d-${k.toLowerCase()}`, {
            section: d.section,
            gap: d.gap
        })),
    `*,*::before,*::after{box-sizing:border-box}
[hidden]{display:none!important}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth;scroll-padding-top:88px}
body{margin:0;background:var(--bg);color:var(--text);font-family:var(--font);font-size:17px;line-height:1.6;overflow-wrap:anywhere}
a{color:var(--accent)}
a:focus-visible,summary:focus-visible{outline:3px solid var(--accent);outline-offset:3px;border-radius:4px}
img{max-width:100%;height:auto}
.skip{position:absolute;left:-9999px;top:0}
.skip:focus{left:16px;top:16px;z-index:10;background:var(--bg);padding:12px 16px}
.wrap{width:100%;max-width:1120px;margin:0 auto;padding:0 20px}
.site-header{position:sticky;top:0;z-index:5;background:var(--bg);border-bottom:1px solid var(--border)}
.site-header .wrap{display:flex;flex-wrap:wrap;align-items:center;gap:8px 24px;padding-top:12px;padding-bottom:12px}
.brand{font-weight:700;font-size:20px;color:var(--text);text-decoration:none;min-height:44px;display:inline-flex;align-items:center}
.brand__logo{height:32px;width:auto;max-width:160px;margin-right:8px;object-fit:contain}
.nav{display:flex;flex-wrap:wrap;gap:4px 16px;margin-right:auto}
.nav a{color:var(--text);text-decoration:none;min-height:44px;display:inline-flex;align-items:center}
.nav a:hover{color:var(--accent);text-decoration:underline}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:12px 24px;border-radius:var(--radius);background:var(--accent);color:var(--on-accent);font-weight:600;text-decoration:none;border:2px solid var(--accent)}
.btn:hover{filter:brightness(1.08)}
.btn--ghost{background:transparent;color:var(--accent)}
main section{padding:var(--section) 0}
main section:nth-of-type(even){background:var(--surface)}
h1,h2,h3{line-height:1.2;margin:0 0 16px}
h1{font-size:clamp(32px,6vw,52px)}
h2{font-size:clamp(26px,4vw,36px)}
h3{font-size:20px}
p{margin:0 0 16px}
.lead{font-size:20px;color:var(--muted);max-width:720px}
.muted{color:var(--muted)}
.hero{padding:calc(var(--section) * 1.2) 0}
.actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:24px}
.grid{display:grid;gap:var(--gap);grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));margin-top:24px}
.card{background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);padding:24px}
main section:nth-of-type(odd) .card{background:var(--surface)}
.list{list-style:none;margin:24px 0 0;padding:0;display:grid;gap:12px}
.list--cols{grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))}
.item{display:flex;gap:12px;align-items:flex-start}
.icon{flex:none;width:28px;height:28px;color:var(--accent)}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 0;padding:0;list-style:none}
.chips li{border:1px solid var(--border);border-radius:999px;padding:4px 12px;font-size:15px}
.row{display:grid;gap:8px 24px;grid-template-columns:1fr;border-top:1px solid var(--border);padding:24px 0}
@media (min-width:800px){.row{grid-template-columns:1fr 2fr}}
.faq details{border-top:1px solid var(--border);padding:8px 0}
.faq summary{cursor:pointer;font-weight:600;min-height:44px;display:flex;align-items:center}
.contact-list{list-style:none;padding:0;margin:24px 0 0;display:grid;gap:12px}
.contact-list a{min-height:44px;display:inline-flex;align-items:center}
.cta-band{background:var(--accent);color:var(--on-accent)}
main section.cta-band{background:var(--accent)}
.cta-band .btn{background:var(--on-accent);color:var(--accent);border-color:var(--on-accent)}
.cta-band p{color:var(--on-accent)}
.booking-note{margin-top:16px}
#pms-booking{margin-top:24px}
.site-footer{border-top:1px solid var(--border);padding:40px 0;font-size:15px;color:var(--muted)}
.site-footer nav{display:flex;flex-wrap:wrap;gap:4px 20px;margin-bottom:16px}
.site-footer a{color:var(--text);min-height:44px;display:inline-flex;align-items:center}
.from-price{font-weight:700;font-size:19px;color:var(--text);margin:8px 0 0}
.pricing .row{align-items:center}
.page-title{padding-top:48px;margin-bottom:0}
.not-found{padding:96px 0}
.group-title{margin-top:32px}
.catalog-item{display:grid;gap:8px 24px;align-items:center}
@media (min-width:800px){.catalog .row.catalog-item{grid-template-columns:2fr 1fr}}
.item-side{display:flex;flex-wrap:wrap;align-items:center;gap:12px 20px}
.item-meta{display:flex;flex-wrap:wrap;gap:4px 16px;margin:0;color:var(--muted)}
.price{font-weight:700;color:var(--text);white-space:nowrap}
.dish{display:grid;grid-template-columns:1fr auto;gap:8px 16px;align-items:start}
.dish img{grid-column:1/-1;border-radius:var(--radius);aspect-ratio:4/3;object-fit:cover;width:100%}
.dish h4{margin:0 0 4px;font-size:18px}
.person img{border-radius:var(--radius);aspect-ratio:1;object-fit:cover;width:100%;margin-bottom:12px}
.hours{border-collapse:collapse;margin-top:24px;min-width:min(100%,360px)}
.hours th,.hours td{text-align:left;padding:10px 24px 10px 0;border-top:1px solid var(--border);font-weight:400}
.hours th{color:var(--muted)}
.hours-compact{list-style:none;padding:0;margin:24px 0 0;display:grid;gap:8px}
.lead-form{margin-top:24px;max-width:560px;display:grid;gap:4px}
.lead-form fieldset{border:0;margin:0;padding:0;display:grid;gap:4px;min-width:0}
.lead--card .lead-form{background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);padding:24px}
.field{display:grid;gap:6px;margin:0 0 12px}
.field label{font-weight:600}
.field input,.field select,.field textarea{font:inherit;color:var(--text);background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);min-height:48px;padding:10px 14px;width:100%}
.field input:focus-visible,.field select:focus-visible,.field textarea:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
.lead-form button[disabled]{opacity:.6;cursor:progress}
.lead-status{min-height:1.6em;margin:8px 0 0}
.hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
.mobile-bar{position:fixed;left:0;right:0;bottom:0;z-index:6;display:flex;gap:8px;padding:10px 12px calc(10px + env(safe-area-inset-bottom));background:var(--bg);border-top:1px solid var(--border)}
.mobile-bar .btn{flex:1}
body.has-mobile-bar{padding-bottom:80px}
@media (min-width:800px){.mobile-bar{display:none}body.has-mobile-bar{padding-bottom:0}}`
].join('\n');
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/wt-personnel/apps/sites/src/seo.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "jsonForScript",
    ()=>jsonForScript,
    "pageIndexed",
    ()=>pageIndexed,
    "pageTitle",
    ()=>pageTitle,
    "renderHead",
    ()=>renderHead,
    "robotsTxt",
    ()=>robotsTxt,
    "seoSettings",
    ()=>seoSettings,
    "sitemapXml",
    ()=>sitemapXml,
    "structuredData",
    ()=>structuredData
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$context$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/sites/src/render/context.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/sites/src/render/text.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$price$2d$format$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/wt-personnel/apps/sites/src/render/price-format.ts [app-client] (ecmascript)");
;
;
;
function seoSettings(envName, primaryHost, requestOrigin) {
    const canonicalOrigin = envName === 'production' && primaryHost ? `https://${primaryHost}` : null;
    return {
        indexable: canonicalOrigin !== null,
        canonicalOrigin,
        sitemapOrigin: canonicalOrigin ?? requestOrigin
    };
}
const OG_LOCALE = {
    ru: 'ru_RU',
    kk: 'kk_KZ',
    en: 'en_US'
};
function pageTitle(page, spec, locale) {
    const own = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["tx"])(page.seo.title, locale);
    if (own) return own;
    const base = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["tx"])(page.title, locale);
    const template = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["tx"])(spec.site.seo.titleTemplate, locale);
    return template ? template.replace('%s', base) : base;
}
function pageIndexed(page, spec, seo) {
    return seo.indexable && spec.site.seo.robots === 'INDEX' && page.seo.index === true;
}
function jsonForScript(value) {
    return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}
const SCHEMA_TYPE = {
    HOTEL: 'Hotel',
    HOSTEL: 'Hostel',
    APARTMENT: 'Apartment',
    LODGING: 'LodgingBusiness',
    // SITE-2: салон и ресторан
    BEAUTY_SALON: 'BeautySalon',
    RESTAURANT: 'Restaurant',
    CAFE: 'CafeOrCoffeeShop'
};
const DAY_OF_WEEK = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday'
];
const items = (v)=>Array.isArray(v) ? v : [];
/** Часы работы из первой видимой секции `hours` сайта: `OpeningHoursSpecification` по каждому дню */ function openingHours(spec) {
    const section = spec.pages.flatMap((p)=>p.sections).find((s)=>s.type === 'hours');
    return items(section?.['days']).filter((d)=>typeof d['weekday'] === 'number' && DAY_OF_WEEK[d['weekday']]).map((d)=>({
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: `https://schema.org/${DAY_OF_WEEK[d['weekday']]}`,
            opens: d['open'],
            closes: d['close']
        }));
}
function offer(money) {
    const m = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$price$2d$format$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["moneyDecimal"])(money);
    return m ? {
        '@type': 'Offer',
        price: m.price,
        priceCurrency: m.currency
    } : null;
}
/** Ресторан: меню целиком в `hasMenu` (Menu → MenuSection → MenuItem с ценой из снимка документа) */ function menuOf(sections, locale) {
    const menus = sections.filter((s)=>s.type === 'menu');
    const hasMenuSection = menus.flatMap((m)=>items(m['categories']).map((c)=>({
                '@type': 'MenuSection',
                name: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["tx"])(c['title'], locale),
                hasMenuItem: items(c['items']).map((i)=>{
                    const item = {
                        '@type': 'MenuItem',
                        name: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["tx"])(i['title'], locale)
                    };
                    const description = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["tx"])(i['description'], locale);
                    if (description) item['description'] = description;
                    const o = offer(i['price']);
                    if (o) item['offers'] = o;
                    return item;
                })
            })));
    return hasMenuSection.length ? {
        '@type': 'Menu',
        hasMenuSection
    } : null;
}
/** Салон: услуги с ценой из снимка документа в `hasOfferCatalog` */ function servicesOf(sections, locale) {
    const list = sections.filter((s)=>s.type === 'services').flatMap((s)=>items(s['items'])).map((i)=>{
        const o = offer(i['price']) ?? {
            '@type': 'Offer'
        };
        o['itemOffered'] = {
            '@type': 'Service',
            name: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["tx"])(i['title'], locale)
        };
        return o;
    });
    return list.length ? {
        '@type': 'OfferCatalog',
        name: 'Services',
        itemListElement: list
    } : null;
}
function structuredData(ctx, seo) {
    const { spec, locale, page } = ctx;
    const out = [];
    if (page.isHome) {
        const sd = spec.site.seo.structuredData;
        const contacts = spec.site.contacts ?? {};
        const business = {
            '@context': 'https://schema.org',
            '@type': SCHEMA_TYPE[sd.type] ?? 'LodgingBusiness',
            name: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["tx"])(spec.site.displayName, locale)
        };
        const description = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["tx"])(page.seo.description, locale);
        if (description) business['description'] = description;
        if (seo.canonicalOrigin) business['url'] = `${seo.canonicalOrigin}/`;
        if (sd.includeAddress) {
            const address = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["tx"])(contacts.address, locale);
            if (address) business['address'] = {
                '@type': 'PostalAddress',
                streetAddress: address
            };
            if (contacts.phone) business['telephone'] = contacts.phone;
        }
        if (sd.includeGeo && contacts.geo) business['geo'] = {
            '@type': 'GeoCoordinates',
            latitude: contacts.geo.lat,
            longitude: contacts.geo.lng
        };
        const amenities = spec.pages.flatMap((p)=>p.sections).filter((s)=>s.type === 'amenities').flatMap((s)=>Array.isArray(s['items']) ? s['items'] : []).map((i)=>({
                '@type': 'LocationFeatureSpecification',
                name: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["tx"])(i.label, locale),
                value: true
            }));
        if (amenities.length) business['amenityFeature'] = amenities;
        const vertical = spec.site.vertical;
        if (vertical === 'HOSPITALITY') {
            const facts = ctx.facts;
            if (facts?.checkInTime) business['checkinTime'] = facts.checkInTime;
            if (facts?.checkOutTime) business['checkoutTime'] = facts.checkOutTime;
        } else {
            // SITE-2: часы, меню и услуги только из снимка документа, который собран из данных филиала
            const all = spec.pages.flatMap((p)=>p.sections).filter((s)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$context$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["sectionVisible"])(s, ctx));
            const hours = openingHours(spec);
            if (hours.length) business['openingHoursSpecification'] = hours;
            if (vertical === 'FOOD_SERVICE') {
                const menu = menuOf(all, locale);
                if (menu) business['hasMenu'] = menu;
            }
            if (vertical === 'BEAUTY') {
                const catalog = servicesOf(all, locale);
                if (catalog) business['hasOfferCatalog'] = catalog;
            }
        }
        out.push(business);
    }
    const faqs = page.sections.filter((s)=>s.type === 'faq' && s['emitStructuredData'] === true && (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$context$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["sectionVisible"])(s, ctx));
    const questions = faqs.flatMap((s)=>(Array.isArray(s['items']) ? s['items'] : []).map((i)=>({
                '@type': 'Question',
                name: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["tx"])(i.question, locale),
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["tx"])(i.answer, locale)
                }
            })));
    if (questions.length) out.push({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: questions
    });
    return out;
}
function renderHead(ctx, seo, cssHref) {
    const { spec, page, locale } = ctx;
    const title = pageTitle(page, spec, locale);
    const description = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["tx"])(page.seo.description, locale);
    const robots = pageIndexed(page, spec, seo) ? 'index, follow' : 'noindex, nofollow';
    const url = seo.canonicalOrigin ? `${seo.canonicalOrigin}${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$context$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["pagePath"])(page)}` : null;
    const ogTitle = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["tx"])(page.seo.og?.title, locale) || title;
    const ogDescription = (0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["tx"])(page.seo.og?.description, locale) || description;
    const assetUrl = (id)=>typeof id === 'string' ? ctx.assets[id.toLowerCase()] ?? ctx.assets[id] : undefined;
    const ogImage = assetUrl(page.seo.og?.imageAssetId);
    const favicon = assetUrl(spec.site.brand?.faviconAssetId);
    const meta = [
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        `<title>${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(title)}</title>`,
        description ? `<meta name="description" content="${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(description)}">` : '',
        `<meta name="robots" content="${robots}">`,
        url ? `<link rel="canonical" href="${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(url)}">` : '',
        '<meta property="og:type" content="website">',
        `<meta property="og:title" content="${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(ogTitle)}">`,
        ogDescription ? `<meta property="og:description" content="${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(ogDescription)}">` : '',
        `<meta property="og:site_name" content="${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["tx"])(spec.site.displayName, locale))}">`,
        `<meta property="og:locale" content="${OG_LOCALE[locale] ?? 'ru_RU'}">`,
        url ? `<meta property="og:url" content="${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(url)}">` : '',
        // MKT8: картинка соцсетей страницы и фавиконка из карты подписанных адресов; нет адреса, нет и тега
        ogImage ? `<meta property="og:image" content="${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(ogImage)}">` : '',
        favicon ? `<link rel="icon" href="${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(favicon)}">` : '',
        `<link rel="stylesheet" href="${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(cssHref)}">`,
        ...structuredData(ctx, seo).map((d)=>`<script type="application/ld+json">${jsonForScript(d)}</script>`)
    ];
    return meta.filter(Boolean).join('');
}
function robotsTxt(spec, seo) {
    if (!seo.indexable || spec.site.seo.robots !== 'INDEX') return 'User-agent: *\nDisallow: /\n';
    return `User-agent: *\nAllow: /\n\nSitemap: ${seo.sitemapOrigin}/sitemap.xml\n`;
}
function sitemapXml(spec, seo) {
    const pages = spec.pages.filter((p)=>p.seo.includeInSitemap === true && pageIndexed(p, spec, seo));
    const urls = pages.map((p)=>`<url><loc>${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$text$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["esc"])(`${seo.sitemapOrigin}${(0, __TURBOPACK__imported__module__$5b$project$5d2f$wt$2d$personnel$2f$apps$2f$sites$2f$src$2f$render$2f$context$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["pagePath"])(p)}`)}</loc></url>`).join('');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>\n`;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=wt-personnel_apps_sites_src_0hxxsxa._.js.map