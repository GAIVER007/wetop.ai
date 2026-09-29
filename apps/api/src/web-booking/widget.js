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
  /*
   * Оформление (дизайн «спокойная стойка», 12.09.2026). Виджет стоит на чужом сайте, поэтому:
   * все селекторы под `.pmsw`, свои переменные (владелец сайта может переопределить их своим CSS),
   * системные шрифты — не тянем гарнитуру на чужую страницу, `color-scheme: light` — чтобы поля дат
   * не почернели на тёмной теме сайта. Поля и кнопки 44 px: гость бронирует с телефона.
   */
  var css = [
    '.pmsw{--pmsw-accent:#1f4bd8;--pmsw-accent-dark:#17399f;--pmsw-ink:#16213a;--pmsw-ink-2:#3d4656;',
    '--pmsw-muted:#6b7280;--pmsw-line:#e3e5e8;--pmsw-line-soft:#eef0f3;--pmsw-field:#cbd0d6;',
    '--pmsw-ok:#176b3f;--pmsw-ok-bg:#dff5e7;--pmsw-err:#b4232c;--pmsw-radius:12px;',
    'color-scheme:light;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-size:15px;line-height:1.45;',
    'max-width:680px;color:var(--pmsw-ink);background:#fff;border:1px solid var(--pmsw-line);',
    'border-radius:16px;padding:20px;box-sizing:border-box;text-align:left}',
    '.pmsw *{box-sizing:border-box}',
    '.pmsw h3{margin:0;font-size:21px;font-weight:700;letter-spacing:-.01em;color:var(--pmsw-ink)}',
    '.pmsw .lede{margin:4px 0 16px;font-size:14px;color:var(--pmsw-muted)}',
    '.pmsw .row{display:flex;gap:10px;flex-wrap:wrap;align-items:end}',
    '.pmsw .search{background:#fafbfc;border:1px solid var(--pmsw-line);border-radius:var(--pmsw-radius);padding:12px}',
    '.pmsw label{display:grid;gap:5px;font-size:13px;font-weight:500;color:var(--pmsw-ink-2);flex:1 1 150px;min-width:0}',
    '.pmsw input,.pmsw select,.pmsw textarea{min-height:44px;padding:10px 12px;border:1px solid var(--pmsw-field);',
    'border-radius:10px;font-size:15px;font-family:inherit;color:var(--pmsw-ink);background:#fff;width:100%}',
    '.pmsw textarea{min-height:64px;resize:vertical}',
    '.pmsw input:focus-visible,.pmsw select:focus-visible,.pmsw textarea:focus-visible{outline:2px solid var(--pmsw-accent);outline-offset:-1px;border-color:var(--pmsw-accent)}',
    '.pmsw button{min-height:44px;padding:11px 18px;border-radius:10px;border:1px solid var(--pmsw-accent);',
    'background:var(--pmsw-accent);color:#fff;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer;white-space:nowrap}',
    '.pmsw button:hover{background:var(--pmsw-accent-dark);border-color:var(--pmsw-accent-dark)}',
    '.pmsw button.sec{background:#fff;color:var(--pmsw-accent)}',
    '.pmsw button.sec:hover{background:#f4f6fd}',
    '.pmsw button:disabled{opacity:.55;cursor:default}',
    '.pmsw button:focus-visible{outline:2px solid var(--pmsw-ink);outline-offset:2px}',
    '.pmsw .found{margin:16px 0 2px;font-size:14px;color:var(--pmsw-ink-2);font-weight:500}',
    '.pmsw .cat{display:flex;justify-content:space-between;gap:14px;align-items:center;',
    'border-top:1px solid var(--pmsw-line-soft);padding:14px 0}',
    '.pmsw .cat .n{font-weight:600;font-size:16px}',
    '.pmsw .cat .s{font-size:13px;color:var(--pmsw-muted);margin-top:2px}',
    '.pmsw .cat .p{font-size:20px;font-weight:700;white-space:nowrap;font-variant-numeric:tabular-nums;margin-left:auto}',
    '.pmsw .cat--off{opacity:.55}.pmsw .cat--off .p{font-weight:600;color:var(--pmsw-muted)}',
    '.pmsw .chosen{border-top:0;background:#fafbfc;border:1px solid var(--pmsw-line);border-radius:var(--pmsw-radius);padding:14px;margin-bottom:14px}',
    '.pmsw .msg{margin-top:12px;font-size:14px}',
    '.pmsw .err{color:var(--pmsw-err)}',
    '.pmsw .ok{color:var(--pmsw-ok)}',
    '.pmsw .done{background:var(--pmsw-ok-bg);border-radius:var(--pmsw-radius);padding:16px;margin-top:4px}',
    '.pmsw .done .n{font-size:17px;font-weight:700;color:var(--pmsw-ok);margin-bottom:4px}',
    '.pmsw .done .num{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:19px;font-weight:600;color:var(--pmsw-ink);letter-spacing:.02em;display:block;margin:6px 0}',
    '.pmsw .done .s{font-size:14px;color:var(--pmsw-ink-2)}',
    '.pmsw .note{font-size:12.5px;color:var(--pmsw-muted);margin-top:14px;padding-top:12px;border-top:1px solid var(--pmsw-line-soft)}',
    '.pmsw .hp{position:absolute;left:-9999px;top:-9999px}',
    '@media (max-width:460px){.pmsw{padding:16px;border-radius:12px}.pmsw label{flex:1 1 100%}',
    '.pmsw .row>button{width:100%}.pmsw .cat{flex-wrap:wrap}.pmsw .cat .p{margin-left:0}.pmsw .cat>button{width:100%}}',
  ].join('');

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
    })
      .catch(function () {
        // сеть недоступна или домен сайта не в списке разрешённых: гостю нельзя показывать
        // «Failed to fetch» — это ничего ему не говорит и выглядит поломкой
        throw new Error(
          'Не удалось связаться с системой бронирования. Обновите страницу или свяжитесь с нами.',
        );
      })
      .then(function (r) {
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
    // Промокод (D4): необязательный; скидку считает сервер, виджет только передаёт код и показывает ответ
    var promo = el('input', {
      type: 'text',
      name: 'promo',
      maxlength: '32',
      autocomplete: 'off',
      'data-pmsw': 'promo',
    });
    var quoteBtn = el('button', { type: 'button', text: 'Показать цены', 'data-pmsw': 'quote' });
    var list = el('div', { 'data-pmsw': 'list' });
    var msg = el('div', { class: 'msg', 'data-pmsw': 'msg' });
    var note = el('div', {
      class: 'note',
      text: 'Цены за весь период. Оплата при заселении; отмена — по правилам тарифа.',
    });
    root.appendChild(el('h3', { text: 'Забронировать' }));
    root.appendChild(
      el('div', {
        class: 'lede',
        text: 'Выберите даты — покажем свободные категории и цену за весь период.',
      }),
    );
    root.appendChild(
      el('div', { class: 'search' }, [
        el('div', { class: 'row' }, [
          el('label', { text: 'Заезд' }, [arrival]),
          el('label', { text: 'Выезд' }, [departure]),
          el('label', { text: 'Гостей' }, [adults]),
          el('label', { text: 'Промокод' }, [promo]),
          quoteBtn,
        ]),
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
          q.adults +
          (promo.value.trim() ? '&promo=' + encodeURIComponent(promo.value.trim()) : ''),
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
        class: 'found',
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
      if (r.promo)
        list.appendChild(
          el('div', {
            class: 'found',
            'data-pmsw': 'promo-applied',
            text:
              'Промокод ' +
              r.promo.code +
              ': скидка ' +
              r.promo.discountPercent +
              '%. Если у тарифа уже есть скидка, действует большая.',
          }),
        );
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
            class: can ? 'cat' : 'cat cat--off',
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
        el('div', { class: 'cat chosen' }, [
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
          promo: r.promo ? r.promo.code : '',
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
              el(
                'div',
                { class: 'done', 'data-pmsw': 'done', 'data-number': b.confirmationNumber },
                [
                  el('div', { class: 'n', text: 'Бронь принята' }),
                  el('span', { class: 'num', text: b.confirmationNumber }),
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
                ],
              ),
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
