/**
 * Клиентский скрипт формы заявки (`leadForm`, SITE-2). Файл WETOP на том же хосте (`/_wetop/lead-<хэш>.js`), как
 * скрипт цен: CSP остаётся без `unsafe-inline`. Форма в HTML скрыта, рядом видна запасная строка с телефоном; скрипт
 * показывает форму и прячет запасную строку, поэтому без JavaScript посетитель видит телефон, а не мёртвую форму.
 *
 * Отправка: JSON на `data-api + data-endpoint` (`/w/beauty/book`, `/w/food/reserve`, `/w/lead`; контракт тела
 * `packages/domain/src/marketing/site-lead.ts`), без cookies. Ключ запроса один на попытку и живёт до успеха: повтор
 * после сбоя сети не создаёт вторую заявку. Turnstile, если API отдаёт его ключ в `GET /w/config`, тем же порядком,
 * что у виджета брони. Ответ показывается текстом (`textContent`), разметки из ответа нет.
 */
import { BEAUTY_FORM_JS } from './beauty-form-script';

export const LEAD_JS = `(function () {
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
  ${BEAUTY_FORM_JS}
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
