"use strict";
var __dsPreview = (() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __esm = (fn, res, err) => function __init() {
    if (err) throw err[0];
    try {
      return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
    } catch (e) {
      throw err = [e], e;
    }
  };
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __reExport = (target, mod, secondTarget) => (__copyProps(target, mod, "default"), secondTarget && __copyProps(secondTarget, mod, "default"));
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // <define:import.meta.env>
  var init_define_import_meta_env = __esm({
    "<define:import.meta.env>"() {
    }
  });

  // ds-raw:__ds_raw__
  var require_ds_raw = __commonJS({
    "ds-raw:__ds_raw__"(exports, module) {
      init_define_import_meta_env();
      module.exports = window.Wetop;
    }
  });

  // shim:react-shim
  var require_react_shim = __commonJS({
    "shim:react-shim"(exports, module) {
      init_define_import_meta_env();
      var R = window.React;
      function np(p, k) {
        var o = {};
        for (var x in p) if (x !== "children") o[x] = p[x];
        if (k !== void 0) o.key = k;
        return o;
      }
      function jsx2(t, p, k) {
        var c = p && p.children;
        return c === void 0 ? R.createElement(t, np(p, k)) : R.createElement(t, np(p, k), c);
      }
      function jsxs2(t, p, k) {
        return R.createElement.apply(R, [t, np(p, k)].concat(p.children));
      }
      module.exports = R;
      module.exports.jsx = jsx2;
      module.exports.jsxs = jsxs2;
      module.exports.jsxDEV = function(t, p, k, s) {
        return (s ? jsxs2 : jsx2)(t, p, k);
      };
      module.exports.Fragment = R.Fragment;
    }
  });

  // .design-sync/previews/Table.tsx
  var Table_exports = {};
  __export(Table_exports, {
    Dense: () => Dense,
    RowStates: () => RowStates,
    Stays: () => Stays
  });
  init_define_import_meta_env();

  // ds-shim:ds
  var ds_exports = {};
  __export(ds_exports, {
    default: () => ds_default
  });
  init_define_import_meta_env();
  __reExport(ds_exports, __toESM(require_ds_raw()));
  var g = window.Wetop;
  var ds_default = "default" in g ? g.default : g;

  // .design-sync/previews/Table.tsx
  var import_jsx_runtime = __toESM(require_react_shim(), 1);
  var Stays = () => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.Panel, { title: "Проживания брони 20260920-0007", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ds_exports.Table, { "aria-label": "Проживания брони", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Гость" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Проживание" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Место" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Статус" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Стоимость" })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tbody", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: "Иванов Пётр" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("time", { dateTime: "2026-09-20", children: "20 сент. → 23 сент." }),
          ", 3 ночи"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: "R01" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.StatusBadge, { status: "CHECKED_IN", label: "живёт" }) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { className: "num", children: "33 000 ₸" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: "Ким Алия" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("time", { dateTime: "2026-09-21", children: "21 сент. → 23 сент." }),
          ", 2 ночи"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: "M03" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.StatusBadge, { status: "CONFIRMED", label: "ждём" }) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { className: "num", children: "16 000 ₸" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: "Сатпаев Ерлан" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("time", { dateTime: "2026-09-21", children: "21 сент. → 22 сент." }),
          ", 1 ночь"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: "—" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.StatusBadge, { status: "TENTATIVE", label: "не подтверждена" }) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { className: "num", children: "8 000 ₸" })
      ] })
    ] })
  ] }) });
  var Dense = () => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.Panel, { title: "Очередь отправок в Channex", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ds_exports.Table, { size: "sm", dense: true, nowrap: true, "aria-label": "Очередь отправок", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Что" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Категории" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Ночи" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Статус" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Попыток" })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tbody", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: "остатки" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: "Мужской общий номер" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: "20.09 → 23.09" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: "отправлено" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { className: "num", children: "1" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: "цены и ограничения" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: "Двухместный номер" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: "20.09 → 30.09" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: "в очереди" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { className: "num", children: "0" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: "остатки" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: "Женский общий номер" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: "21.09 → 21.09" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: "ошибка" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { className: "num", children: "3" })
      ] })
    ] })
  ] }) });
  var RowStates = () => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.Panel, { title: "Строка выбрана, строка отменена", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ds_exports.Table, { "aria-label": "Состояния строк", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Бронь" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Гость" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Источник" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "К оплате" })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tbody", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { className: "is-active", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: "20260920-0007" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: "Иванов Пётр" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: "Стойка" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.AmountChip, { minor: "1600000", tone: "due" }) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: "20260920-0008" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: "Ким Алия" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: "Booking.com" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.AmountChip, { minor: "1600000", tone: "paid" }) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { className: "is-void", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: "20260919-0004" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: "Сатпаев Ерлан" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: "Trip.com" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: "—" })
      ] })
    ] })
  ] }) });
  return __toCommonJS(Table_exports);
})();
