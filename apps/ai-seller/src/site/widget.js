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
  var BASE = script.src.replace(/\/widget\.js(\?.*)?$/, '');
  var IDENTITY = script.getAttribute('data-identity') || '';
  var ORG_KEY = script.getAttribute('data-key') || '';
  var STORE_KEY = 'pmsw.visitor';
  var DEFAULT_TTL_HOURS = 720;
  var RETRY_MIN_MS = 2000;
  var RETRY_MAX_MS = 20000;
  var XHR_TIMEOUT_MS = 60000;
  var IDLE_PAUSE_MS = 700;

  var CSS = [
    ".pmsw{--cw-bg:#fff;--cw-soft:#f5f7fb;--cw-text:#182438;--cw-muted:#56667e;--cw-border:#dfe6ef;--cw-own:#e7f1ff;font:14px/1.5 system-ui,sans-serif}",
    "[data-theme=dark] .pmsw{--cw-bg:#0e1726;--cw-soft:#111e30;--cw-text:#eff5ff;--cw-muted:#9aaec6;--cw-border:#27384d;--cw-own:#173657;color-scheme:dark}",
    ".pmsw *{box-sizing:border-box}.pmsw button,.pmsw textarea{font:inherit}.pmsw button{cursor:pointer}.pmsw button:disabled{cursor:default;opacity:.45}.pmsw button:focus-visible,.pmsw textarea:focus-visible{outline:2px solid #419bff;outline-offset:3px}",
    ".pmsw-b{position:fixed;right:24px;bottom:24px;width:52px;height:52px;border:1px solid #398fff;border-radius:18px;background:#176be0;color:#fff;font-size:24px;box-shadow:0 6px 24px #0003;z-index:2147483000}",
    ".pmsw-p{position:fixed;right:24px;bottom:88px;width:400px;max-width:calc(100vw - 32px);height:560px;max-height:calc(100dvh - 112px);display:none;flex-direction:column;background:var(--surface,var(--cw-bg));color:var(--text,var(--cw-text));border:1px solid var(--border,var(--cw-border));border-radius:22px;overflow:hidden;box-shadow:0 20px 70px #0004;z-index:2147483000}",
    ".pmsw-p.pmsw-on{display:flex}.pmsw-h{display:flex;gap:12px;align-items:center;padding:18px;border-bottom:1px solid var(--cw-border)}",
    ".pmsw-mark{display:grid;place-items:center;width:40px;height:40px;flex-shrink:0;border-radius:14px;background:var(--cw-own);color:var(--primary,#3588ec);font-size:17px;font-weight:700}.pmsw-title{flex:1;font-weight:650;font-size:15px}.pmsw-note{font-size:12px;color:var(--cw-muted);font-weight:400;margin-top:2px}",
    ".pmsw-close,.pmsw-remove{border:0;background:transparent;color:var(--cw-muted);width:36px;height:36px;border-radius:10px;font-size:24px!important}",
    ".pmsw-l{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:18px;background:var(--cw-soft);scrollbar-width:thin}.pmsw-empty{padding:22px 4px}.pmsw-empty h3{font-size:21px;line-height:1.3;margin:16px 0 8px;color:var(--cw-text)}.pmsw-empty p{margin:0 0 20px;color:var(--cw-muted);font-size:14px}",
    ".pmsw-suggest{display:block;width:100%;margin:8px 0;padding:12px 14px;border:1px solid var(--cw-border);border-radius:12px;background:var(--cw-bg);color:var(--cw-text);text-align:left}.pmsw-suggest:hover{border-color:#419bff}",
    ".pmsw-m{margin:0 0 12px;padding:11px 14px;border-radius:16px;max-width:88%;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.6;background:var(--cw-bg);border:1px solid var(--cw-border)}.pmsw-own{background:var(--cw-own);margin-left:auto;border-color:transparent;border-bottom-right-radius:5px}.pmsw-bot,.pmsw-op{border-bottom-left-radius:5px}.pmsw-op{border-left:3px solid #d99d32}",
    ".pmsw-chip{font-size:12px;color:var(--cw-muted);padding:0 18px}.pmsw-chip:not(:empty){padding-top:10px}.pmsw-file{display:flex;align-items:center;justify-content:space-between;padding:0 18px;font-size:12px;color:var(--cw-muted)}.pmsw-file:empty{display:none}.pmsw-file span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pmsw-remove{flex-shrink:0}",
    ".pmsw-f{display:flex;align-items:flex-end;gap:8px;padding:12px 14px 8px}.pmsw-i{flex:1;min-width:0;resize:none;max-height:112px;padding:10px 12px;border:1px solid var(--cw-border);border-radius:13px;background:var(--cw-soft);color:var(--cw-text);line-height:22px!important}.pmsw-i::placeholder{color:var(--cw-muted)}",
    ".pmsw-s,.pmsw-a{display:grid;place-items:center;flex-shrink:0;width:40px;height:44px;border:0;border-radius:12px;background:#176be0;color:#fff;font-size:22px!important}.pmsw-a{background:var(--cw-soft);color:var(--cw-muted)}.pmsw-hint{padding:0 18px 12px;font-size:11px;color:var(--cw-muted)}.pmsw-chip .pmsw-s{width:auto;padding:8px 14px;font-size:14px!important}",
    ".pmsw-toolbar{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 18px;background:var(--cw-bg);color:var(--cw-muted);font-size:11px}.pmsw-human{padding:7px 10px;border:1px solid var(--cw-border);border-radius:9px;background:var(--cw-soft);color:var(--cw-text);font-size:12px!important}.pmsw-meta{display:flex;justify-content:space-between;gap:12px;margin-bottom:5px;white-space:normal;font-size:11px;color:var(--cw-muted)}.pmsw-author{font-weight:650}.pmsw-op .pmsw-author{color:var(--cw-text)}.pmsw-op{border-left:0;box-shadow:inset 3px 0 #24ac94}.pmsw-note[data-mode=owner_takeover]{color:var(--cw-text)}.pmsw-l{scroll-behavior:smooth}.pmsw-empty{padding-top:8px}.pmsw-h{border-bottom:0}.pmsw-m{border:0}.pmsw-own{background:var(--cw-own)}@media(prefers-reduced-motion:reduce){.pmsw-l{scroll-behavior:auto}}",
    "@media(max-width:600px){.pmsw-p{right:12px;width:calc(100vw - 24px);max-width:none;border-radius:18px}.pmsw-b{right:16px}.pmsw-i{font-size:16px!important}.pmsw-hint{display:none}.pmsw-f{padding-bottom:14px}}"
  ].join('');

  var root = null, list = null, input = null, panel = null, note = null, chip = null, fileInput = null;
  var visitorKey = '';
  var after = '';
  var seen = {};
  var generation = 0;
  var attachmentId = '';
  var retryMs = RETRY_MIN_MS;
  var resetting = false;
  var busy = false, uploading = false, sendButton, attachButton, empty, fileChip, humanButton;
  var humanRequested = false;
  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) { node.className = cls; }
    if (text) { node.textContent = text; }
    return node;
  }
  function saved() {
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
    if (ORG_KEY) { path += (path.indexOf('?') >= 0 ? '&' : '?') + 'k=' + encodeURIComponent(ORG_KEY); }
    xhr.open(method, BASE + path, true);
    if (!isForm) { xhr.setRequestHeader('Content-Type', 'application/json'); }
    if (IDENTITY) { xhr.setRequestHeader('X-Widget-Identity', IDENTITY); }
    if (visitorKey) { xhr.setRequestHeader('X-Widget-Visitor', visitorKey); }
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
    empty.style.display = 'none';
    var nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
    var message = el('div', cls);
    var meta = el('div', 'pmsw-meta');
    meta.appendChild(el('span', 'pmsw-author', msg.role === 'user' ? 'Вы' : msg.from_operator ? (ORG_KEY ? 'Сотрудник' : 'Сотрудник поддержки') : 'ИИ-помощник'));
    var date = msg.at ? new Date(msg.at) : null;
    if (date && !isNaN(date.getTime())) {
      var time = el('time', '', date.toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'}));
      time.setAttribute('datetime', date.toISOString()); time.setAttribute('title', date.toLocaleString('ru-RU')); meta.appendChild(time);
    }
    message.appendChild(meta); message.appendChild(el('div', 'pmsw-text', msg.text));
    list.appendChild(message);
    if (nearBottom || msg.role === 'user') { list.scrollTop = list.scrollHeight; }
  }

  function showMode(mode) {
    var labels = {bot_active: 'Отвечает ИИ-помощник', needs_human: 'Ожидаем сотрудника · ИИ продолжает помогать', owner_takeover: 'Диалог принят сотрудником'};
    note.textContent = labels[mode] || 'Уточняем статус поддержки';
    note.setAttribute('data-mode', labels[mode] ? mode : 'unknown');
    if (humanButton) {
      humanButton.disabled = busy || !visitorKey || humanRequested || mode === 'needs_human' || mode === 'owner_takeover';
      humanButton.textContent = mode === 'owner_takeover' ? 'Сотрудник подключён' : mode === 'needs_human' ? 'Ожидаем сотрудника' : humanRequested ? 'Запрос сотруднику отправлен' : 'Позвать сотрудника';
    }
  }

  function poll(mine) {
    if (mine !== generation) { return; }
    var url = '/messages?after=' + encodeURIComponent(after);
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
      note.textContent = 'Переподключаемся… История сохранена';
      if (status === 403) { resetSession(); return; }
      window.setTimeout(function () { poll(mine); }, retryMs);
      retryMs = Math.min(retryMs * 2, RETRY_MAX_MS);
    });
  }

  function restartPoll() {
    generation += 1;
    poll(generation);
  }

  function controls() {
    sendButton.disabled = busy || uploading || !visitorKey || !input.value.trim();
    attachButton.disabled = busy || uploading || !visitorKey;
    input.readOnly = busy;
    if (humanButton) { humanButton.disabled = busy || uploading || !visitorKey || humanRequested || note.getAttribute('data-mode') === 'needs_human' || note.getAttribute('data-mode') === 'owner_takeover'; }
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 112) + 'px';
  }
  function showAttachment(name) {
    fileChip.textContent = '';
    if (!attachmentId) { return; }
    fileChip.appendChild(el('span', '', name));
    var remove = el('button', 'pmsw-remove', '×');
    remove.setAttribute('aria-label', 'Убрать вложение');
    remove.onclick = function () { if (!busy) { attachmentId = ''; fileChip.textContent = ''; } };
    fileChip.appendChild(remove);
  }
  function submit(requestHuman) {
    requestHuman = requestHuman === true;
    var text = input.value.replace(/^\s+|\s+$/g, '');
    if (requestHuman) { text = 'Прошу подключить сотрудника технической поддержки к этому диалогу.'; }
    if (!text || !visitorKey || busy || uploading) { return; }
    busy = true; controls(); chip.textContent = 'Отправляем…';
    var body = { visitor_key: visitorKey, text: text, identity: IDENTITY };
    if (attachmentId && !requestHuman) { body.attachment_id = attachmentId; }
    send('POST', '/message', body, false, function () {
      busy = false;
      if (requestHuman) { humanRequested = true; chip.textContent = 'Запрос отправлен в диалог. Подключение сотрудника появится в статусе чата.'; }
      else { input.value = ''; attachmentId = ''; fileChip.textContent = ''; chip.textContent = ''; }
      controls(); restartPoll(); input.focus();
    }, function (status) {
      busy = false; controls();
      chip.textContent = status === 429 ? 'Слишком часто. Подождите немного.' : 'Не отправилось. Текст сохранён — попробуйте ещё раз.';
      if (status === 403) { resetSession(); }
    });
  }
  function attach() {
    var file = fileInput.files && fileInput.files[0];
    if (!file || busy || uploading) { return; }
    var form = new FormData(); form.append('file', file);
    uploading = true; controls(); chip.textContent = 'Загружаем снимок…';
    send('POST', '/attachment', form, true, function (data) {
      uploading = false; attachmentId = data.attachment_id || '';
      showAttachment(file.name); chip.textContent = attachmentId ? '' : 'Файл не принят';
      fileInput.value = ''; controls();
    }, function () {
      uploading = false; chip.textContent = 'Файл не принят'; fileInput.value = ''; controls();
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

    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', ORG_KEY ? 'Чат с помощником' : 'Поддержка WETOP');
    var head = el('div', 'pmsw-h');
    head.appendChild(el('span', 'pmsw-mark', 'W'));
    var title = el('div', 'pmsw-title'); title.appendChild(el('span', '', ORG_KEY ? 'Чат' : 'Поддержка WETOP'));
    var close = el('button', 'pmsw-close', '×'); close.setAttribute('aria-label', 'Закрыть чат');
    note = el('div', 'pmsw-note'); note.setAttribute('role', 'status');
    title.appendChild(note); head.appendChild(title); head.appendChild(close);
    list = el('div', 'pmsw-l');
    list.setAttribute('aria-label', 'Переписка с поддержкой');
    list.setAttribute('role', 'log'); list.setAttribute('aria-live', 'polite');
    empty = el('div', 'pmsw-empty');
    empty.appendChild(el('span', 'pmsw-mark', '?'));
    empty.appendChild(el('h3', '', 'Чем помочь?'));
    empty.appendChild(el('p', '', ORG_KEY ? 'Напишите ваш вопрос — начнём разговор.' : 'Сначала поможет ИИ. Если нужен сотрудник — позовите его в этот же диалог.' + (IDENTITY ? ' Ваш аккаунт уже известен поддержке.' : '')));
    if (!ORG_KEY) { ['Как создать бронь?', 'Как найти свободный номер?'].forEach(function (text) {
      var suggestion = el('button', 'pmsw-suggest', text);
      suggestion.onclick = function () { if (!busy) { input.value = text; controls(); input.focus(); } };
      empty.appendChild(suggestion);
    }); }
    list.appendChild(empty);
    chip = el('div', 'pmsw-chip'); chip.setAttribute('role', 'status');
    fileChip = el('div', 'pmsw-file');

    var form = el('div', 'pmsw-f');
    input = el('textarea', 'pmsw-i');
    input.setAttribute('rows', '1'); input.setAttribute('aria-label', 'Сообщение');
    input.setAttribute('placeholder', 'Ваш вопрос');
    fileInput = el('input');
    fileInput.setAttribute('type', 'file');
    fileInput.setAttribute('accept', 'image/png,image/jpeg,image/webp');
    fileInput.style.display = 'none';
    var attachBtn = el('button', 'pmsw-a', '📎');
    attachBtn.setAttribute('type', 'button');
    attachBtn.setAttribute('aria-label', 'Прикрепить снимок экрана');
    var sendBtn = el('button', 'pmsw-s', '↑');
    sendBtn.setAttribute('aria-label', 'Отправить сообщение'); sendBtn.setAttribute('title', 'Отправить сообщение');
    sendButton = sendBtn; attachButton = attachBtn;
    sendBtn.setAttribute('type', 'button');

    form.appendChild(input);
    form.appendChild(attachBtn);
    form.appendChild(sendBtn);
    panel.appendChild(head);
    if (!ORG_KEY) {
      var toolbar = el('div', 'pmsw-toolbar');
      humanButton = el('button', 'pmsw-human', 'Позвать сотрудника');
      humanButton.setAttribute('type', 'button');
      humanButton.onclick = function () { submit(true); };
      toolbar.appendChild(el('span', '', 'Один диалог — вся помощь'));
      toolbar.appendChild(humanButton); panel.appendChild(toolbar);
    }
    panel.appendChild(list);
    panel.appendChild(chip);
    panel.appendChild(fileChip);
    panel.appendChild(form);
    panel.appendChild(el('div', 'pmsw-hint', 'Enter — отправить · Shift + Enter — новая строка'));
    root.appendChild(panel);
    root.appendChild(bubble);
    document.body.appendChild(root);

    function toggle() {
      var on = panel.className.indexOf('pmsw-on') >= 0;
      panel.className = on ? 'pmsw-p' : 'pmsw-p pmsw-on';
      bubble.setAttribute('aria-expanded', String(!on));
      if (!on) { input.focus(); controls(); } else { bubble.focus(); }
    }
    bubble.setAttribute('aria-expanded', 'false');
    bubble.onclick = toggle; close.onclick = toggle;
    panel.onkeydown = function (ev) { if (ev.key === 'Escape') { toggle(); } };
    sendBtn.onclick = submit;
    attachBtn.onclick = function () { fileInput.click(); };
    fileInput.onchange = attach;
    input.oninput = controls;
    input.onkeydown = function (ev) { if (ev.keyCode === 13 && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); submit(); } };
    controls(); showMode('bot_active');
    panel.appendChild(fileInput);
  }

  function askConsent() {
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
      if (!root) { build(); } // с ключом кнопка рисуется после открытой двери
      visitorKey = String(data.visitor_key);
      remember(visitorKey, data.session_ttl_hours);
      controls();
      restartPoll();
      if (data.consent_required) { askConsent(); }
    }, function () {
      resetting = false;
      if (!root) { return; }
      chip.textContent = 'Чат сейчас недоступен.';
    });
  }

  function resetSession() {
    if (resetting) { return; }
    resetting = true;
    forget();
    visitorKey = ''; controls();
    generation += 1;
    openSession('');
  }

  function start() {
    if (!ORG_KEY) { build(); }
    openSession(saved());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
