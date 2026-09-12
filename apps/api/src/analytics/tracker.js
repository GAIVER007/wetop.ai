/*
 * Счётчик посещений PMS (план среза 8 §4). Одна строка на сайт:
 *   <script async src="https://<API>/a/pms.js" data-site="pms_…"></script>
 * Шлёт в приёмник только: ключ сайта, случайный ID посетителя (localStorage) и сессии (sessionStorage),
 * адрес и заголовок страницы, реферер, ширину экрана, язык, пояс. Никаких cookies, форм и персональных данных.
 * Публичная функция: pms('event', 'search', {arrival:'2026-10-01', departure:'2026-10-03', adults:2});
 * pms('consent') — запустить, если стоит data-consent="wait".
 * ES5 намеренно: старые WebView.
 */
(function () {
  var script = document.currentScript;
  if (!script) return;
  var key = script.getAttribute('data-site');
  if (!key) return;
  var endpoint = script.src.replace(/pms\.js(\?.*)?$/, 'hit');
  var GAP = 30 * 60 * 1000;
  var PING = 15 * 1000;
  var MAX_IDLE_PINGS = 40; // 10 минут без движения — дальше не пингуем, пока посетитель не шевельнётся
  var QUEUE_TTL = 24 * 60 * 60 * 1000;
  var VKEY = '_pms_v';
  var SKEY = '_pms_s';
  var QKEY = '_pms_q';
  var started = false;
  var idlePings = 0;
  var lastPath = null;

  function uid() {
    try {
      if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    } catch (e) {}
    var s = '';
    for (var i = 0; i < 32; i++) s += Math.floor(Math.random() * 16).toString(16);
    return s;
  }
  function get(store, k) {
    try {
      return window[store].getItem(k);
    } catch (e) {
      return null;
    }
  }
  function set(store, k, v) {
    try {
      window[store].setItem(k, v);
    } catch (e) {}
  }
  function visitor() {
    var v = get('localStorage', VKEY);
    if (!v) {
      v = uid();
      set('localStorage', VKEY, v);
    }
    return v;
  }
  function session() {
    var now = Date.now();
    var s = null;
    try {
      s = JSON.parse(get('sessionStorage', SKEY));
    } catch (e) {}
    if (!s || !s.id || now - s.at > GAP) s = { id: uid(), at: now };
    s.at = now;
    set('sessionStorage', SKEY, JSON.stringify(s));
    return s.id;
  }
  function tz() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    } catch (e) {
      return '';
    }
  }
  function payload(type, extra) {
    var p = {
      k: key,
      v: visitor(),
      s: session(),
      t: type,
      u: location.href,
      r: document.referrer || '',
      w: (window.screen && screen.width) || 0,
      l: navigator.language || '',
      z: tz(),
      ti: document.title || '',
      ts: Date.now(),
    };
    if (extra)
      for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) p[k] = extra[k];
    return JSON.stringify(p);
  }
  function enqueue(body) {
    var q = [];
    try {
      q = JSON.parse(get('localStorage', QKEY)) || [];
    } catch (e) {}
    q.push({ b: body, at: Date.now() });
    if (q.length > 50) q = q.slice(q.length - 50);
    set('localStorage', QKEY, JSON.stringify(q));
  }
  function post(body, beacon) {
    if (beacon && navigator.sendBeacon) {
      try {
        if (navigator.sendBeacon(endpoint, body)) return;
      } catch (e) {}
    }
    try {
      fetch(endpoint, {
        method: 'POST',
        body: body,
        keepalive: true,
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
      }).catch(function () {
        enqueue(body);
      });
    } catch (e) {
      enqueue(body);
    }
  }
  function drain() {
    var q = null;
    try {
      q = JSON.parse(get('localStorage', QKEY));
    } catch (e) {}
    if (!q || !q.length) return;
    set('localStorage', QKEY, '[]');
    var now = Date.now();
    for (var i = 0; i < q.length; i++) if (now - q[i].at < QUEUE_TTL) post(q[i].b, false);
  }
  function pageview() {
    lastPath = location.pathname + location.search;
    idlePings = 0;
    post(payload('pageview'), false);
  }
  function ping() {
    if (document.visibilityState !== 'visible') return;
    if (idlePings >= MAX_IDLE_PINGS) return;
    idlePings++;
    post(payload('ping'), false);
  }
  function leave() {
    post(payload('leave'), true);
  }
  function wake() {
    idlePings = 0;
  }
  function start() {
    if (started) return;
    started = true;
    drain();
    pageview();
    setInterval(ping, PING);
    ['click', 'scroll', 'keydown', 'touchstart', 'mousemove'].forEach(function (ev) {
      window.addEventListener(ev, wake, { passive: true });
    });
    window.addEventListener('pagehide', leave);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') leave();
    });
    // сайты-SPA: смена адреса без перезагрузки — новый просмотр
    var push = history.pushState;
    if (push) {
      history.pushState = function () {
        var r = push.apply(this, arguments);
        if (location.pathname + location.search !== lastPath) pageview();
        return r;
      };
    }
    window.addEventListener('popstate', function () {
      if (location.pathname + location.search !== lastPath) pageview();
    });
  }
  window.pms = function (cmd, name, props) {
    if (cmd === 'consent') return start();
    if (cmd === 'event' && started) post(payload('event', { n: name, p: props || {} }), false);
  };
  if (script.getAttribute('data-consent') !== 'wait') start();
})();
