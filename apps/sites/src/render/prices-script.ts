import { formatFromPrice } from './price-format';

/**
 * Клиентский скрипт цены «от» (`B-FROMPRICE`, Q-276). Файл WETOP на том же хосте (`/_wetop/prices-<хэш>.js`), а не
 * встроенный скрипт: CSP остаётся без `unsafe-inline`. Он спрашивает `GET /w/from-prices` у API WETOP с ключом сайта и
 * заполняет только места с `data-from-price`. Цена никогда не попадает в HTML страницы: нет ответа или ошибка, значит
 * число не показывается, а не берётся старое.
 */
export const PRICES_JS = `(function () {
  var s = document.currentScript;
  if (!s || !window.fetch) return;
  var api = s.getAttribute('data-api');
  var key = s.getAttribute('data-site');
  var locale = s.getAttribute('data-locale') || 'ru-RU';
  var label = s.getAttribute('data-label') || '{price}';
  var format = ${formatFromPrice.toString()};
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
