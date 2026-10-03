/*
 * Виджет бронирования PMS (срез 9). Код на сайт:
 *   <div id="pms-booking"></div>
 *   <script async src="https://<API>/w/widget.js" data-site="pms_…"></script>
 * Атрибуты: data-target="#селектор" (по умолчанию #pms-booking), data-phone="+7 …" (телефон в подписи),
 * data-lang="ru|kk|en|zh" (язык по умолчанию; гость переключает сам, ADR-141).
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
   * Языки (ADR-141). Язык по умолчанию задаёт владелец сайта атрибутом data-lang, иначе русский: язык браузера
   * не угадываем, чтобы сайт на русском не открывался гостю по-английски. Гость переключает язык кнопками.
   * Казахский и китайский тексты проверяет носитель языка. Ответы сервера об ошибках пока на русском.
   */
  var LANGS = { ru: 'RU', kk: 'KZ', en: 'EN', zh: '中文' };
  var T = {
    ru: {
      title: 'Забронировать',
      lede: 'Выберите даты, и мы покажем свободные категории и цену за весь период.',
      arrival: 'Заезд',
      departure: 'Выезд',
      guests: 'Гостей',
      promo: 'Промокод',
      show: 'Показать цены',
      note: 'Цены за весь период. Оплата при заселении; отмена по правилам тарифа.',
      found: function (a, d, n, g, ci, co) {
        return (
          a + ' → ' + d + ', ' + n + ', гостей: ' + g + '. Заезд с ' + ci + ', выезд до ' + co + '.'
        );
      },
      promoApplied: function (code, pct) {
        return (
          'Промокод ' +
          code +
          ': скидка ' +
          pct +
          '%. Если у тарифа уже есть скидка, действует большая.'
        );
      },
      fitsMax: function (n) {
        return 'вмещает не больше ' + n;
      },
      closed: 'нет продаж на эти даты',
      noPlaces: 'мест нет',
      noPrice: 'цена не задана',
      free: function (n) {
        return 'свободно: ' + n;
      },
      book: 'Забронировать',
      nothingSold: 'На эти даты ничего не продаётся.',
      nothingFree: 'На выбранные даты свободных мест нет, попробуйте другие даты.',
      chosen: function (a, d, n, g) {
        return a + ' → ' + d + ', ' + n + ', гостей: ' + g;
      },
      first: 'Имя',
      last: 'Фамилия',
      phone: 'Телефон',
      email: 'Почта (необязательно)',
      emailHint: 'Пришлём подтверждение брони',
      comment: 'Комментарий',
      submit: 'Подтвердить бронь',
      back: 'Назад',
      sending: 'Отправляем…',
      done: 'Бронь принята',
      doneText: function (cat, a, d, n, sum, ci) {
        return (
          cat +
          ', ' +
          a +
          ' → ' +
          d +
          ', ' +
          n +
          '. К оплате при заселении: ' +
          sum +
          '. Заезд с ' +
          ci +
          '.'
        );
      },
      keep: 'Сохраните номер брони, его спросят при заселении.',
      network:
        'Не удалось связаться с системой бронирования. Обновите страницу или свяжитесь с нами.',
      captchaFail: 'Не удалось загрузить проверку. Обновите страницу и повторите.',
      captchaLoad: 'Не удалось загрузить проверку. Обновите страницу или свяжитесь с нами.',
      error: 'Ошибка ',
      nights: function (n) {
        var m10 = n % 10,
          m100 = n % 100;
        if (m10 === 1 && m100 !== 11) return n + ' ночь';
        if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return n + ' ночи';
        return n + ' ночей';
      },
    },
    kk: {
      title: 'Брондау',
      lede: 'Күндерді таңдаңыз: бос санаттар мен бүкіл кезеңнің бағасын көрсетеміз.',
      arrival: 'Келу',
      departure: 'Кету',
      guests: 'Қонақтар',
      promo: 'Промокод',
      show: 'Бағаларды көрсету',
      note: 'Бағалар бүкіл кезеңге. Төлем орналасу кезінде; болдырмау тариф ережелері бойынша.',
      found: function (a, d, n, g, ci, co) {
        return (
          a +
          ' → ' +
          d +
          ', ' +
          n +
          ', қонақтар: ' +
          g +
          '. Келу ' +
          ci +
          ' бастап, кету ' +
          co +
          ' дейін.'
        );
      },
      promoApplied: function (code, pct) {
        return (
          'Промокод ' +
          code +
          ': жеңілдік ' +
          pct +
          '%. Тарифте жеңілдік болса, үлкені қолданылады.'
        );
      },
      fitsMax: function (n) {
        return 'ең көбі ' + n + ' қонақ';
      },
      closed: 'бұл күндерге сатылым жоқ',
      noPlaces: 'орын жоқ',
      noPrice: 'баға белгіленбеген',
      free: function (n) {
        return 'бос: ' + n;
      },
      book: 'Брондау',
      nothingSold: 'Бұл күндерге ештеңе сатылмайды.',
      nothingFree: 'Таңдалған күндерге бос орын жоқ, басқа күндерді көріңіз.',
      chosen: function (a, d, n, g) {
        return a + ' → ' + d + ', ' + n + ', қонақтар: ' + g;
      },
      first: 'Аты',
      last: 'Тегі',
      phone: 'Телефон',
      email: 'Пошта (міндетті емес)',
      emailHint: 'Брондау растауын жібереміз',
      comment: 'Түсініктеме',
      submit: 'Брондауды растау',
      back: 'Артқа',
      sending: 'Жіберілуде…',
      done: 'Брондау қабылданды',
      doneText: function (cat, a, d, n, sum, ci) {
        return (
          cat +
          ', ' +
          a +
          ' → ' +
          d +
          ', ' +
          n +
          '. Орналасу кезінде төлеу: ' +
          sum +
          '. Келу ' +
          ci +
          ' бастап.'
        );
      },
      keep: 'Брондау нөмірін сақтаңыз, оны орналасу кезінде сұрайды.',
      network: 'Брондау жүйесімен байланыс жоқ. Бетті жаңартыңыз немесе бізге хабарласыңыз.',
      captchaFail: 'Тексеру жүктелмеді. Бетті жаңартып, қайталаңыз.',
      captchaLoad: 'Тексеру жүктелмеді. Бетті жаңартыңыз немесе бізге хабарласыңыз.',
      error: 'Қате ',
      nights: function (n) {
        return n + ' түн';
      },
    },
    en: {
      title: 'Book a stay',
      lede: 'Choose your dates: we will show available room types and the price for the whole stay.',
      arrival: 'Check-in',
      departure: 'Check-out',
      guests: 'Guests',
      promo: 'Promo code',
      show: 'Show prices',
      note: 'Prices are for the whole stay. Payment on arrival; cancellation follows the rate rules.',
      found: function (a, d, n, g, ci, co) {
        return (
          a +
          ' → ' +
          d +
          ', ' +
          n +
          ', guests: ' +
          g +
          '. Check-in from ' +
          ci +
          ', check-out until ' +
          co +
          '.'
        );
      },
      promoApplied: function (code, pct) {
        return (
          'Promo code ' +
          code +
          ': ' +
          pct +
          '% off. If the rate already has a discount, the larger one applies.'
        );
      },
      fitsMax: function (n) {
        return 'fits up to ' + n;
      },
      closed: 'not on sale for these dates',
      noPlaces: 'sold out',
      noPrice: 'no price set',
      free: function (n) {
        return 'available: ' + n;
      },
      book: 'Book',
      nothingSold: 'Nothing is on sale for these dates.',
      nothingFree: 'No availability for the selected dates. Please try other dates.',
      chosen: function (a, d, n, g) {
        return a + ' → ' + d + ', ' + n + ', guests: ' + g;
      },
      first: 'First name',
      last: 'Last name',
      phone: 'Phone',
      email: 'Email (optional)',
      emailHint: 'We will send the booking confirmation',
      comment: 'Comment',
      submit: 'Confirm booking',
      back: 'Back',
      sending: 'Sending…',
      done: 'Booking confirmed',
      doneText: function (cat, a, d, n, sum, ci) {
        return (
          cat +
          ', ' +
          a +
          ' → ' +
          d +
          ', ' +
          n +
          '. Pay on arrival: ' +
          sum +
          '. Check-in from ' +
          ci +
          '.'
        );
      },
      keep: 'Please keep the booking number, you will be asked for it at check-in.',
      network: 'Could not reach the booking system. Refresh the page or contact us.',
      captchaFail: 'Could not load the check. Refresh the page and try again.',
      captchaLoad: 'Could not load the check. Refresh the page or contact us.',
      error: 'Error ',
      nights: function (n) {
        return n + (n === 1 ? ' night' : ' nights');
      },
    },
    zh: {
      title: '预订',
      lede: '请选择日期：我们将显示可预订的房型和整个入住期的价格。',
      arrival: '入住',
      departure: '退房',
      guests: '客人',
      promo: '优惠码',
      show: '查看价格',
      note: '价格为整个入住期。入住时付款；取消按房价规则执行。',
      found: function (a, d, n, g, ci, co) {
        return (
          a + ' → ' + d + '，' + n + '，客人：' + g + '。' + ci + ' 起入住，' + co + ' 前退房。'
        );
      },
      promoApplied: function (code, pct) {
        return '优惠码 ' + code + '：优惠 ' + pct + '%。如房价已有折扣，按较大折扣计算。';
      },
      fitsMax: function (n) {
        return '最多可住 ' + n + ' 人';
      },
      closed: '该日期不出售',
      noPlaces: '已满',
      noPrice: '未设置价格',
      free: function (n) {
        return '剩余：' + n;
      },
      book: '预订',
      nothingSold: '该日期没有可出售的房间。',
      nothingFree: '所选日期没有空房，请尝试其他日期。',
      chosen: function (a, d, n, g) {
        return a + ' → ' + d + '，' + n + '，客人：' + g;
      },
      first: '名',
      last: '姓',
      phone: '电话',
      email: '电子邮箱（选填）',
      emailHint: '我们将发送预订确认',
      comment: '备注',
      submit: '确认预订',
      back: '返回',
      sending: '正在发送…',
      done: '预订成功',
      doneText: function (cat, a, d, n, sum, ci) {
        return (
          cat + '，' + a + ' → ' + d + '，' + n + '。入住时付款：' + sum + '。' + ci + ' 起入住。'
        );
      },
      keep: '请保存预订号，入住时需要出示。',
      network: '无法连接预订系统。请刷新页面或联系我们。',
      captchaFail: '验证加载失败。请刷新页面后重试。',
      captchaLoad: '验证加载失败。请刷新页面或联系我们。',
      error: '错误 ',
      nights: function (n) {
        return n + ' 晚';
      },
    },
  };
  function pickLang(v) {
    var head = String(v || '')
      .trim()
      .toLowerCase()
      .split(/[-_]/)[0];
    if (head === 'kz') head = 'kk';
    return T[head] ? head : 'ru';
  }
  var lang = pickLang(script.getAttribute('data-lang'));
  function t(k) {
    return T[lang][k];
  }
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
    '.pmsw .captcha{margin:2px 0 12px}',
    '.pmsw .head{display:flex;justify-content:space-between;align-items:start;gap:12px;flex-wrap:wrap}',
    '.pmsw .langs{display:flex;gap:4px}',
    '.pmsw .langs button{min-height:32px;min-width:44px;padding:4px 8px;font-size:13px;background:#fff;color:var(--pmsw-ink-2);border-color:var(--pmsw-line)}',
    '.pmsw .langs button[aria-pressed="true"]{background:var(--pmsw-accent);color:#fff;border-color:var(--pmsw-accent)}',
    '.pmsw .hint{font-size:12px;font-weight:400;color:var(--pmsw-muted)}',
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
    return t('nights')(n);
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
        throw new Error(t('network'));
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
              throw new Error(Array.isArray(m) ? m.join('; ') : m || t('error') + r.status);
            }
            return j;
          });
      });
  }

  /*
   * Проверка «не робот» (Cloudflare Turnstile, BOOK-SEC1). Публичный ключ приходит с сервера (`/w/config`): пока он не
   * задан, проверки нет и форма работает как раньше. Токен одноразовый — после каждой попытки виджет сбрасывается.
   * Поиск цен проверки не требует: она нужна только перед самой бронью.
   */
  var configPromise = null;
  function loadConfig() {
    if (!configPromise)
      configPromise = request('GET', '/w/config').catch(function () {
        return {};
      });
    return configPromise;
  }
  var turnstilePromise = null;
  function loadTurnstile() {
    if (window.turnstile) return Promise.resolve(window.turnstile);
    if (!turnstilePromise)
      turnstilePromise = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        s.async = true;
        s.onload = function () {
          resolve(window.turnstile);
        };
        s.onerror = function () {
          turnstilePromise = null;
          reject(new Error('turnstile'));
        };
        document.head.appendChild(s);
      });
    return turnstilePromise;
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
    loadConfig();
    mount({});

    // Язык меняется пересборкой формы: введённые даты, гости и промокод сохраняются (ADR-141)
    function mount(keep) {
      var today = new Date();
      today.setHours(0, 0, 0, 0);
      var root = el('div', { class: 'pmsw', 'data-pmsw': 'root' });
      var arrival = el('input', {
        type: 'date',
        name: 'arrival',
        min: iso(today),
        value: keep.arrival || iso(plusDays(today, 1)),
        'data-pmsw': 'arrival',
      });
      var departure = el('input', {
        type: 'date',
        name: 'departure',
        min: iso(plusDays(today, 1)),
        value: keep.departure || iso(plusDays(today, 2)),
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
      if (keep.adults) adults.value = keep.adults;
      var promo = el('input', {
        type: 'text',
        name: 'promo',
        value: keep.promo || '',
        maxlength: '32',
        autocomplete: 'off',
        'data-pmsw': 'promo',
      });
      var quoteBtn = el('button', { type: 'button', text: t('show'), 'data-pmsw': 'quote' });
      var list = el('div', { 'data-pmsw': 'list' });
      var msg = el('div', { class: 'msg', 'data-pmsw': 'msg' });
      var note = el('div', {
        class: 'note',
        text: t('note'),
      });
      var langs = el(
        'div',
        { class: 'langs', role: 'group', 'aria-label': 'Язык / Language', 'data-pmsw': 'langs' },
        Object.keys(LANGS).map(function (code) {
          return el('button', {
            type: 'button',
            text: LANGS[code],
            lang: code,
            'aria-pressed': code === lang ? 'true' : 'false',
            'data-pmsw': 'lang-' + code,
            onclick: function () {
              if (code === lang) return;
              var values = {
                arrival: arrival.value,
                departure: departure.value,
                adults: adults.value,
                promo: promo.value,
              };
              lang = code;
              root.parentNode.removeChild(root);
              mount(values);
            },
          });
        }),
      );
      root.setAttribute('lang', lang);
      root.appendChild(el('div', { class: 'head' }, [el('h3', { text: t('title') }), langs]));
      root.appendChild(
        el('div', {
          class: 'lede',
          text: t('lede'),
        }),
      );
      root.appendChild(
        el('div', { class: 'search' }, [
          el('div', { class: 'row' }, [
            el('label', { text: t('arrival') }, [arrival]),
            el('label', { text: t('departure') }, [departure]),
            el('label', { text: t('guests') }, [adults]),
            el('label', { text: t('promo') }, [promo]),
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
        var q = {
          k: key,
          arrival: arrival.value,
          departure: departure.value,
          adults: adults.value,
        };
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
          text: t('found')(
            ru(r.arrivalDate),
            ru(r.departureDate),
            nightsWord(r.nights),
            r.adults,
            r.checkInTime,
            r.checkOutTime,
          ),
        });
        list.appendChild(head);
        if (r.promo)
          list.appendChild(
            el('div', {
              class: 'found',
              'data-pmsw': 'promo-applied',
              text: t('promoApplied')(r.promo.code, r.promo.discountPercent),
            }),
          );
        var any = false;
        r.categories.forEach(function (c) {
          var can = c.fits && !c.closed && c.available > 0 && c.totalMinor !== null;
          var status = !c.fits
            ? t('fitsMax')(c.capacity)
            : c.closed
              ? t('closed')
              : c.available <= 0
                ? t('noPlaces')
                : c.totalMinor === null
                  ? t('noPrice')
                  : t('free')(c.available);
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
                    text: t('book'),
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
        if (!r.categories.length) say(t('nothingSold'), 'err');
        else if (!any) say(t('nothingFree'), 'err');
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
          text: t('submit'),
          'data-pmsw': 'submit',
        });
        var back = el('button', {
          type: 'button',
          class: 'sec',
          text: t('back'),
          onclick: function () {
            renderQuote(r);
          },
        });
        // BOOK-SEC1: кнопка ждёт ответа /w/config; есть публичный ключ — ещё и токена проверки
        var token = '';
        var widgetId = null;
        var captchaBox = el('div', { class: 'captcha', 'data-pmsw': 'captcha' });
        submit.disabled = true;
        loadConfig().then(function (cfg) {
          var siteKey = cfg && cfg.turnstileSiteKey;
          if (!siteKey) {
            submit.disabled = false;
            return;
          }
          loadTurnstile()
            .then(function (ts) {
              widgetId = ts.render(captchaBox, {
                sitekey: siteKey,
                action: 'booking',
                language: lang === 'kk' ? 'ru' : lang,
                theme: 'light',
                callback: function (t) {
                  token = t;
                  submit.disabled = false;
                },
                'expired-callback': function () {
                  token = '';
                  submit.disabled = true;
                },
                'error-callback': function () {
                  token = '';
                  submit.disabled = true;
                  say(t('captchaFail'), 'err');
                },
              });
            })
            .catch(function () {
              say(t('captchaLoad'), 'err');
            });
        });
        function resetCaptcha() {
          token = '';
          if (widgetId === null) return false;
          try {
            window.turnstile.reset(widgetId);
          } catch (e) {}
          submit.disabled = true;
          return true;
        }
        var form = el('form', { 'data-pmsw': 'form' }, [
          el('div', { class: 'cat chosen' }, [
            el('div', {}, [
              el('div', { class: 'n', text: c.name }),
              el('div', {
                class: 's',
                text: t('chosen')(
                  ru(r.arrivalDate),
                  ru(r.departureDate),
                  nightsWord(r.nights),
                  r.adults,
                ),
              }),
            ]),
            el('div', { class: 'p', text: money(c.totalMinor, r.currency) }),
          ]),
          el('div', { class: 'row' }, [
            el('label', { text: t('first') }, [first]),
            el('label', { text: t('last') }, [last]),
          ]),
          el('div', { class: 'row' }, [
            el('label', { text: t('phone') }, [phone]),
            el('label', { text: t('email') }, [
              email,
              el('span', { class: 'hint', text: t('emailHint') }),
            ]),
          ]),
          el('label', { text: t('comment') }, [comment]),
          hp,
          captchaBox,
          el('div', { class: 'row' }, [submit, back]),
        ]);
        form.addEventListener('submit', function (ev) {
          ev.preventDefault();
          submit.disabled = true;
          say(t('sending'));
          var keys = counterKeys();
          var body = {
            k: key,
            arrival: r.arrivalDate,
            departure: r.departureDate,
            category: c.code,
            adults: r.adults,
            promo: r.promo ? r.promo.code : '',
            lang: lang,
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
            turnstileToken: token || undefined,
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
                    el('div', { class: 'n', text: t('done') }),
                    el('span', { class: 'num', text: b.confirmationNumber }),
                    el('div', {
                      class: 's',
                      text: t('doneText')(
                        b.categoryName,
                        ru(b.arrivalDate),
                        ru(b.departureDate),
                        nightsWord(b.nights),
                        money(b.totalMinor, b.currency),
                        b.checkInTime,
                      ),
                    }),
                  ],
                ),
              );
              say(t('keep'), 'ok');
            })
            .catch(function (e) {
              say(e.message, 'err');
              // токен использован: с проверкой кнопка ждёт нового, без неё — сразу доступна
              if (!resetCaptcha()) submit.disabled = false;
            });
        });
        list.appendChild(form);
        first.focus();
      }

      quoteBtn.addEventListener('click', quote);
    }
  });
})();
