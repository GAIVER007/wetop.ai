/* Виджет чата для сайта платформы.

   Без зависимостей и без сборки, ES5: скрипт вставляется одной строкой
   в чужую страницу, и тянуть туда сборщик нельзя.

   Свои стили под префиксом .pmsw — чтобы не спорить со стилями платформы.

   🔴 Текст сообщений вставляется только через textContent: ответ бота и
   реплика оператора — чужой текст, и вставка его разметкой превращает чат
   в дыру межсайтового скриптинга.
*/
(function () {
  'use strict';

  var script = document.currentScript || (function () {
    var all = document.getElementsByTagName('script');
    return all[all.length - 1];
  })();
  // Адрес бота берётся из адреса самого скрипта: на странице платформы
  // домен бота другой, и зашивать его в код нельзя.
  var BASE = script.src.replace(/\/widget\.js(\?.*)?$/, '');
  // Признак пользователя платформы: подписан её ключом, бот проверит подпись.
  var IDENTITY = script.getAttribute('data-identity') || '';
  var STORE_KEY = 'pmsw.visitor';
  // Срок жизни ключа задаёт настройка бота: он приходит ответом /session
  // и хранится рядом с ключом. Здесь запас на самый первый заход.
  var DEFAULT_TTL_HOURS = 720;
  var RETRY_MIN_MS = 2000;
  var RETRY_MAX_MS = 20000;
  // Таймаут больше серверного срока опроса: подвисшее соединение иначе
  // оставляет виджет немым до перезагрузки страницы.
  var XHR_TIMEOUT_MS = 60000;
  // Пауза после пустого опроса: нулевой серверный срок иначе крутит цикл
  // без задержки.
  var IDLE_PAUSE_MS = 700;

  var CSS = [
    '.pmsw-b{position:fixed;right:20px;bottom:20px;width:56px;height:56px;border:0;border-radius:28px;',
    'background:#1f6feb;color:#fff;font-size:24px;cursor:pointer;box-shadow:0 2px 12px rgba(0,0,0,.25);z-index:2147483000}',
    '.pmsw-p{position:fixed;right:20px;bottom:88px;width:340px;max-width:calc(100vw - 40px);height:480px;',
    'max-height:calc(100vh - 120px);display:none;flex-direction:column;background:#fff;color:#111;border-radius:12px;',
    'overflow:hidden;font:14px/1.45 system-ui,sans-serif;box-shadow:0 8px 32px rgba(0,0,0,.28);z-index:2147483000}',
    '.pmsw-p.pmsw-on{display:flex}.pmsw-h{padding:12px 14px;background:#1f6feb;color:#fff;font-weight:600}',
    '.pmsw-note{font-weight:400;font-size:12px;opacity:.9}.pmsw-l{flex:1;overflow-y:auto;padding:12px;background:#f6f7f9}',
    '.pmsw-m{margin:0 0 8px;padding:8px 10px;border-radius:10px;max-width:85%;white-space:pre-wrap;word-wrap:break-word}',
    '.pmsw-bot{background:#fff;border:1px solid #e3e6ea}.pmsw-own{background:#dbeafe;margin-left:auto}',
    '.pmsw-op{background:#fff;border:1px solid #f0c36d}.pmsw-chip{padding:0 12px 6px;font-size:12px;color:#555}',
    '.pmsw-f{display:flex;align-items:center;gap:6px;padding:8px;border-top:1px solid #e3e6ea}',
    '.pmsw-i{flex:1;min-width:0;padding:8px;border:1px solid #cfd4da;border-radius:8px;font:inherit}',
    '.pmsw-s,.pmsw-a{border:0;background:#1f6feb;color:#fff;border-radius:8px;padding:8px 12px;cursor:pointer;font:inherit}',
    '.pmsw-a{background:#6b7280}'
  ].join('');

  var root = null, list = null, input = null, panel = null, note = null, chip = null, fileInput = null;
  var visitorKey = '';
  var after = '';
  var seen = {};
  var generation = 0;
  var attachmentId = '';
  var retryMs = RETRY_MIN_MS;
  var resetting = false;

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) { node.className = cls; }
    if (text) { node.textContent = text; }
    return node;
  }

  function saved() {
    // localStorage бывает закрыт настройками приватности — это не повод
    // ломать виджет: посетитель просто начнёт разговор заново.
    try {
      var raw = window.localStorage.getItem(STORE_KEY);
      if (!raw) { return ''; }
      var box = JSON.parse(raw);
      var ttl = (Number(box.ttl) || DEFAULT_TTL_HOURS) * 3600000;
      if (!box || !box.key || (Date.now() - box.at) > ttl) { return ''; }
      return String(box.key);
    } catch (e) { return ''; }
  }

  function forget() {
    try { window.localStorage.removeItem(STORE_KEY); } catch (e) { /* нечего забывать */ }
  }

  function remember(key, ttlHours) {
    try {
      window.localStorage.setItem(STORE_KEY,
        JSON.stringify({ key: key, at: Date.now(), ttl: ttlHours || DEFAULT_TTL_HOURS }));
    } catch (e) { /* приватный режим: ключ живёт до перезагрузки страницы */ }
  }

  function send(method, path, body, isForm, done, fail) {
    var xhr = new XMLHttpRequest();
    xhr.open(method, BASE + path, true);
    if (!isForm) { xhr.setRequestHeader('Content-Type', 'application/json'); }
    // Признак — заголовком: адреса оседают в журналах, а в нём почта.
    if (IDENTITY) { xhr.setRequestHeader('X-Widget-Identity', IDENTITY); }
    xhr.timeout = XHR_TIMEOUT_MS;
    xhr.ontimeout = function () { if (fail) { fail(0); } };
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) { return; }
      if (xhr.status >= 200 && xhr.status < 300) {
        var data = null;
        try { data = JSON.parse(xhr.responseText); } catch (e) { data = null; }
        done(data || {});
      } else if (fail) { fail(xhr.status); }
    };
    xhr.send(isForm ? body : (body ? JSON.stringify(body) : '{}'));
  }

  function addMessage(msg) {
    if (seen[msg.id]) { return; }
    seen[msg.id] = 1;
    var cls = 'pmsw-m ';
    if (msg.role === 'user') { cls += 'pmsw-own'; }
    else if (msg.from_operator) { cls += 'pmsw-op'; }
    else { cls += 'pmsw-bot'; }
    // 🔴 Только textContent: разметку из текста не строим никогда.
    list.appendChild(el('div', cls, msg.text));
    list.scrollTop = list.scrollHeight;
  }

  function showMode(mode) {
    note.textContent = mode && mode !== 'bot_active' ? 'с вами оператор' : '';
  }

  function poll(mine) {
    if (mine !== generation) { return; }
    // Ключ платформы предсказуем: опрос тоже требует подписи из заголовка.
    var url = '/messages?visitor_key=' + encodeURIComponent(visitorKey) +
      '&after=' + encodeURIComponent(after);
    send('GET', url, null, false, function (data) {
      if (mine !== generation) { return; }  // цикл устарел: был перезапуск
      retryMs = RETRY_MIN_MS;
      var items = data.messages || [];
      for (var i = 0; i < items.length; i++) {
        addMessage(items[i]);
        after = items[i].id;
      }
      showMode(data.mode);
      window.setTimeout(function () { poll(mine); }, items.length ? 0 : IDLE_PAUSE_MS);
    }, function (status) {
      if (mine !== generation) { return; }
      if (status === 403) { resetSession(); return; }
      // Обрыв связи не должен молотить сервер: пауза растёт до предела.
      window.setTimeout(function () { poll(mine); }, retryMs);
      retryMs = Math.min(retryMs * 2, RETRY_MAX_MS);
    });
  }

  function restartPoll() {
    // Свою реплику видно только следующим опросом; старый запрос ещё висит
    // на сервере, поэтому его ответ помечается устаревшим номером цикла.
    generation += 1;
    poll(generation);
  }

  function submit() {
    var text = input.value.replace(/^\s+|\s+$/g, '');
    if (!text || !visitorKey) { return; }
    input.value = '';
    var body = { visitor_key: visitorKey, text: text, identity: IDENTITY };
    if (attachmentId) { body.attachment_id = attachmentId; }
    attachmentId = '';
    chip.textContent = '';
    send('POST', '/message', body, false, function () {
      restartPoll();
    }, function (status) {
      if (status === 403) { resetSession(); return; }
      chip.textContent = status === 429
        ? 'Слишком часто. Подождите немного.'
        : 'Не отправилось, попробуйте ещё раз.';
    });
  }

  function attach() {
    var file = fileInput.files && fileInput.files[0];
    if (!file) { return; }
    var form = new FormData();
    form.append('file', file);
    chip.textContent = 'Загружаю…';
    var url = '/attachment?visitor_key=' + encodeURIComponent(visitorKey);
    send('POST', url, form, true, function (data) {
      attachmentId = data.attachment_id || '';
      chip.textContent = attachmentId ? 'Снимок прикреплён' : 'Файл не принят';
      fileInput.value = '';
    }, function () {
      chip.textContent = 'Файл не принят';
      fileInput.value = '';
    });
  }

  function build() {
    var style = el('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    root = el('div', 'pmsw');
    var bubble = el('button', 'pmsw-b', '💬');
    bubble.setAttribute('type', 'button');
    bubble.setAttribute('aria-label', 'Открыть чат');
    panel = el('div', 'pmsw-p');

    var head = el('div', 'pmsw-h', 'Чат');
    note = el('div', 'pmsw-note');
    head.appendChild(note);
    list = el('div', 'pmsw-l');
    chip = el('div', 'pmsw-chip');

    var form = el('div', 'pmsw-f');
    input = el('input', 'pmsw-i');
    input.setAttribute('type', 'text');
    input.setAttribute('placeholder', 'Ваш вопрос');
    fileInput = el('input');
    fileInput.setAttribute('type', 'file');
    fileInput.setAttribute('accept', 'image/png,image/jpeg,image/webp');
    fileInput.style.display = 'none';
    var attachBtn = el('button', 'pmsw-a', '📎');
    attachBtn.setAttribute('type', 'button');
    attachBtn.setAttribute('aria-label', 'Прикрепить снимок экрана');
    var sendBtn = el('button', 'pmsw-s', 'Отправить');
    sendBtn.setAttribute('type', 'button');

    form.appendChild(input);
    form.appendChild(attachBtn);
    form.appendChild(sendBtn);
    panel.appendChild(head);
    panel.appendChild(list);
    panel.appendChild(chip);
    panel.appendChild(form);
    root.appendChild(panel);
    root.appendChild(bubble);
    document.body.appendChild(root);

    bubble.onclick = function () {
      var on = panel.className.indexOf('pmsw-on') >= 0;
      panel.className = on ? 'pmsw-p' : 'pmsw-p pmsw-on';
      if (!on) { input.focus(); }
    };
    sendBtn.onclick = submit;
    attachBtn.onclick = function () { fileInput.click(); };
    fileInput.onchange = attach;
    input.onkeydown = function (ev) { if (ev.keyCode === 13) { submit(); } };
    panel.appendChild(fileInput);
  }

  function askConsent() {
    // Кнопка согласия (слой 0б). Без неё при включённом гейте бот показывал
    // бы экран согласия на каждую реплику: записать согласие было бы нечем.
    var btn = el('button', 'pmsw-s', 'Согласен');
    btn.setAttribute('type', 'button');
    btn.onclick = function () {
      send('POST', '/consent', { visitor_key: visitorKey, identity: IDENTITY }, false, function () {
        chip.textContent = '';
        restartPoll();
      }, function () { chip.textContent = 'Не получилось, попробуйте ещё раз.'; });
    };
    chip.textContent = '';
    chip.appendChild(btn);
  }

  function openSession(key) {
    send('POST', '/session', { visitor_key: key, identity: IDENTITY }, false, function (data) {
      resetting = false;
      if (!data.visitor_key) { return; }
      visitorKey = String(data.visitor_key);
      remember(visitorKey, data.session_ttl_hours);
      restartPoll();
      if (data.consent_required) { askConsent(); }
    }, function () {
      resetting = false;
      chip.textContent = 'Чат сейчас недоступен.';
    });
  }

  function resetSession() {
    // Признак пользователя протух: сохранённый ключ платформы бот больше
    // не принимает. Начинаем сессию заново — один раз, чтобы не зациклиться
    // на закрытой двери.
    if (resetting) { return; }
    resetting = true;
    forget();
    visitorKey = '';
    generation += 1;
    openSession('');
  }

  function start() {
    build();
    openSession(saved());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
