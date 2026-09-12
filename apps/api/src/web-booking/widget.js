/*
 * Виджет бронирования PMS (срез 9). Код на сайт:
 *   <div id="pms-booking"></div>
 *   <script async src="https://<API>/w/widget.js" data-site="pms_…"></script>
 * Атрибуты: data-target="#селектор" (по умолчанию #pms-booking), data-phone="+7 …" (телефон в подписи).
 * Форма: даты и гости → цены по категориям → данные гостя → номер брони. Всё считает PMS; виджет только
 * показывает. Если на странице стоит счётчик (/a/pms.js), поиск и бронь попадают в аналитику.
 */
(function () {
  var script = document.currentScript;
  if (!script) return;
  var key = script.getAttribute('data-site');
  if (!key) return;
  var api = script.src.replace(/\/w\/widget\.js(\?.*)?$/, '');
  var targetSel = script.getAttribute('data-target') || '#pms-booking';
  var css =
    '.pmsw{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;max-width:640px;color:#1a1a1a;background:#fff;border:1px solid #e3e5e8;border-radius:12px;padding:16px;box-sizing:border-box}' +
    '.pmsw *{box-sizing:border-box}.pmsw h3{margin:0 0 12px;font-size:18px}.pmsw .row{display:flex;gap:8px;flex-wrap:wrap;align-items:end}' +
    '.pmsw label{display:grid;gap:4px;font-size:12px;color:#52514e;flex:1 1 140px}.pmsw input,.pmsw select,.pmsw textarea{padding:8px;border:1px solid #cfd3d8;border-radius:8px;font-size:15px;font-family:inherit;width:100%}' +
    '.pmsw button{padding:10px 14px;border-radius:8px;border:1px solid #2a78d6;background:#2a78d6;color:#fff;font-size:15px;cursor:pointer}.pmsw button.sec{background:#fff;color:#2a78d6}.pmsw button:disabled{opacity:.6;cursor:default}' +
    '.pmsw .cat{display:flex;justify-content:space-between;gap:12px;align-items:center;border-top:1px solid #f0f1f3;padding:10px 0}.pmsw .cat .n{font-weight:600}.pmsw .cat .s{font-size:13px;color:#52514e}.pmsw .cat .p{font-size:17px;font-weight:600;white-space:nowrap}' +
    '.pmsw .msg{margin-top:10px;font-size:14px}.pmsw .err{color:#b91c1c}.pmsw .ok{color:#166534}.pmsw .note{font-size:12px;color:#898781;margin-top:10px}.pmsw .hp{position:absolute;left:-9999px;top:-9999px}';

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }
  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs)
      for (var k in attrs)
        if (Object.prototype.hasOwnProperty.call(attrs, k)) {
          if (k === 'text') e.textContent = attrs[k];
          else if (k === 'class') e.className = attrs[k];
          else if (k.indexOf('on') === 0) e.addEventListener(k.slice(2), attrs[k]);
          else e.setAttribute(k, attrs[k]);
        }
    (children || []).forEach(function (c) {
      if (c) e.appendChild(c);
    });
    return e;
  }
  function money(minor, currency) {
    var s = String(minor);
    var neg = s.charAt(0) === '-';
    if (neg) s = s.slice(1);
    while (s.length < 3) s = '0' + s;
    var int = s.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    var sym = currency === 'KZT' ? '₸' : currency;
    return (neg ? '−' : '') + int + ' ' + sym;
  }
  function ru(date) {
    var p = date.split('-');
    return p[2] + '.' + p[1] + '.' + p[0];
  }
  function nightsWord(n) {
    var m10 = n % 10,
      m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return n + ' ночь';
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return n + ' ночи';
    return n + ' ночей';
  }
  function iso(d) {
    return (
      d.getFullYear() +
      '-' +
      String(d.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(d.getDate()).padStart(2, '0')
    );
  }
  function plusDays(d, n) {
    var x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  }
  function counterKeys() {
    var out = {};
    try {
      var v = localStorage.getItem('_pms_v');
      if (v) out.v = v;
      var s = JSON.parse(sessionStorage.getItem('_pms_s') || 'null');
      if (s && s.id) out.s = s.id;
    } catch (e) {}
    return out;
  }
  function track(name, props) {
    try {
      if (typeof window.pms === 'function') window.pms('event', name, props || {});
    } catch (e) {}
  }
  function request(method, path, body) {
    return fetch(api + path, {
      method: method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'omit',
    }).then(function (r) {
      return r
        .json()
        .catch(function () {
          return {};
        })
        .then(function (j) {
          if (!r.ok) {
            var m = j && j.message;
            throw new Error(Array.isArray(m) ? m.join('; ') : m || 'Ошибка ' + r.status);
          }
          return j;
        });
    });
  }

  ready(function () {
    var target = document.querySelector(targetSel);
    if (!target) return;
    if (!document.getElementById('pmsw-css')) {
      var st = document.createElement('style');
      st.id = 'pmsw-css';
      st.textContent = css;
      document.head.appendChild(st);
    }
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var root = el('div', { class: 'pmsw', 'data-pmsw': 'root' });
    var arrival = el('input', {
      type: 'date',
      name: 'arrival',
      min: iso(today),
      value: iso(plusDays(today, 1)),
      'data-pmsw': 'arrival',
    });
    var departure = el('input', {
      type: 'date',
      name: 'departure',
      min: iso(plusDays(today, 1)),
      value: iso(plusDays(today, 2)),
      'data-pmsw': 'departure',
    });
    var adults = el(
      'select',
      { name: 'adults', 'data-pmsw': 'adults' },
      [1, 2, 3, 4].map(function (n) {
        return el('option', { value: String(n), text: String(n) });
      }),
    );
    var quoteBtn = el('button', { type: 'button', text: 'Показать цены', 'data-pmsw': 'quote' });
    var list = el('div', { 'data-pmsw': 'list' });
    var msg = el('div', { class: 'msg', 'data-pmsw': 'msg' });
    var note = el('div', {
      class: 'note',
      text: 'Цены за весь период. Оплата при заселении; отмена — по правилам тарифа.',
    });
    root.appendChild(el('h3', { text: 'Забронировать' }));
    root.appendChild(
      el('div', { class: 'row' }, [
        el('label', { text: 'Заезд' }, [arrival]),
        el('label', { text: 'Выезд' }, [departure]),
        el('label', { text: 'Гостей' }, [adults]),
        quoteBtn,
      ]),
    );
    root.appendChild(list);
    root.appendChild(msg);
    root.appendChild(note);
    target.appendChild(root);

    arrival.addEventListener('change', function () {
      var a = new Date(arrival.value + 'T00:00:00');
      departure.min = iso(plusDays(a, 1));
      if (!departure.value || departure.value <= arrival.value)
        departure.value = iso(plusDays(a, 1));
    });

    function say(text, cls) {
      msg.textContent = text || '';
      msg.className = 'msg' + (cls ? ' ' + cls : '');
    }

    function quote() {
      say('');
      list.textContent = '';
      quoteBtn.disabled = true;
      var q = { k: key, arrival: arrival.value, departure: departure.value, adults: adults.value };
      track('search', { arrival: q.arrival, departure: q.departure, adults: Number(q.adults) });
      request(
        'GET',
        '/w/availability?k=' +
          encodeURIComponent(key) +
          '&arrival=' +
          q.arrival +
          '&departure=' +
          q.departure +
          '&adults=' +
          q.adults,
      )
        .then(function (r) {
          renderQuote(r);
        })
        .catch(function (e) {
          say(e.message, 'err');
        })
        .then(function () {
          quoteBtn.disabled = false;
        });
    }

    function renderQuote(r) {
      list.textContent = '';
      var head = el('div', {
        class: 's',
        text:
          ru(r.arrivalDate) +
          ' → ' +
          ru(r.departureDate) +
          ', ' +
          nightsWord(r.nights) +
          ', гостей: ' +
          r.adults +
          '. Заезд с ' +
          r.checkInTime +
          ', выезд до ' +
          r.checkOutTime +
          '.',
      });
      list.appendChild(head);
      var any = false;
      r.categories.forEach(function (c) {
        var can = c.fits && !c.closed && c.available > 0 && c.totalMinor !== null;
        var status = !c.fits
          ? 'вмещает не больше ' + c.capacity
          : c.closed
            ? 'нет продаж на эти даты'
            : c.available <= 0
              ? 'мест нет'
              : c.totalMinor === null
                ? 'цена не задана'
                : 'свободно: ' + c.available;
        var row = el(
          'div',
          {
            class: 'cat',
            'data-pmsw': 'cat',
            'data-code': c.code,
            'data-available': String(c.available),
          },
          [
            el('div', {}, [
              el('div', { class: 'n', text: c.name }),
              el('div', { class: 's', text: status }),
            ]),
            el('div', {
              class: 'p',
              text: c.totalMinor !== null ? money(c.totalMinor, r.currency) : '—',
            }),
            can
              ? el('button', {
                  type: 'button',
                  text: 'Забронировать',
                  'data-pmsw': 'choose',
                  onclick: function () {
                    showForm(r, c);
                  },
                })
              : null,
          ],
        );
        list.appendChild(row);
        if (can) any = true;
      });
      if (!r.categories.length) say('На эти даты ничего не продаётся.', 'err');
      else if (!any) say('На выбранные даты свободных мест нет — попробуйте другие даты.', 'err');
    }

    function showForm(r, c) {
      say('');
      list.textContent = '';
      track('booking_step', { step: 'guest', category: c.code });
      var first = el('input', {
        name: 'firstName',
        required: 'required',
        autocomplete: 'given-name',
        'data-pmsw': 'firstName',
      });
      var last = el('input', {
        name: 'lastName',
        required: 'required',
        autocomplete: 'family-name',
        'data-pmsw': 'lastName',
      });
      var phone = el('input', {
        name: 'phone',
        type: 'tel',
        required: 'required',
        placeholder: '+7 7XX XXX XX XX',
        autocomplete: 'tel',
        'data-pmsw': 'phone',
      });
      var email = el('input', {
        name: 'email',
        type: 'email',
        autocomplete: 'email',
        'data-pmsw': 'email',
      });
      var comment = el('textarea', { name: 'comment', rows: '2', 'data-pmsw': 'comment' });
      var hp = el('input', {
        name: 'website',
        tabindex: '-1',
        autocomplete: 'off',
        class: 'hp',
        'aria-hidden': 'true',
      });
      var submit = el('button', {
        type: 'submit',
        text: 'Подтвердить бронь',
        'data-pmsw': 'submit',
      });
      var back = el('button', {
        type: 'button',
        class: 'sec',
        text: 'Назад',
        onclick: function () {
          renderQuote(r);
        },
      });
      var form = el('form', { 'data-pmsw': 'form' }, [
        el('div', { class: 'cat' }, [
          el('div', {}, [
            el('div', { class: 'n', text: c.name }),
            el('div', {
              class: 's',
              text:
                ru(r.arrivalDate) +
                ' → ' +
                ru(r.departureDate) +
                ', ' +
                nightsWord(r.nights) +
                ', гостей: ' +
                r.adults,
            }),
          ]),
          el('div', { class: 'p', text: money(c.totalMinor, r.currency) }),
        ]),
        el('div', { class: 'row' }, [
          el('label', { text: 'Имя' }, [first]),
          el('label', { text: 'Фамилия' }, [last]),
        ]),
        el('div', { class: 'row' }, [
          el('label', { text: 'Телефон' }, [phone]),
          el('label', { text: 'Почта (необязательно)' }, [email]),
        ]),
        el('label', { text: 'Комментарий' }, [comment]),
        hp,
        el('div', { class: 'row' }, [submit, back]),
      ]);
      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        submit.disabled = true;
        say('Отправляем…');
        var keys = counterKeys();
        var body = {
          k: key,
          arrival: r.arrivalDate,
          departure: r.departureDate,
          category: c.code,
          adults: r.adults,
          guest: {
            firstName: first.value,
            lastName: last.value,
            phone: phone.value,
            email: email.value,
          },
          comment: comment.value,
          website: hp.value,
          v: keys.v,
          s: keys.s,
        };
        request('POST', '/w/book', body)
          .then(function (b) {
            track('booking_step', { step: 'done', category: c.code });
            list.textContent = '';
            list.appendChild(
              el('div', { class: 'ok', 'data-pmsw': 'done', 'data-number': b.confirmationNumber }, [
                el('div', { class: 'n', text: 'Бронь принята. Номер: ' + b.confirmationNumber }),
                el('div', {
                  class: 's',
                  text:
                    b.categoryName +
                    ', ' +
                    ru(b.arrivalDate) +
                    ' → ' +
                    ru(b.departureDate) +
                    ', ' +
                    nightsWord(b.nights) +
                    '. К оплате при заселении: ' +
                    money(b.totalMinor, b.currency) +
                    '. Заезд с ' +
                    b.checkInTime +
                    '.',
                }),
              ]),
            );
            say('Сохраните номер брони — его спросят при заселении.', 'ok');
          })
          .catch(function (e) {
            say(e.message, 'err');
            submit.disabled = false;
          });
      });
      list.appendChild(form);
      first.focus();
    }

    quoteBtn.addEventListener('click', quote);
  });
})();
