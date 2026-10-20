import { formatMoney, INTL_LOCALE } from './price-format';

/** Embedded in the existing same-origin lead asset, not a second booking client/backend. */
export const BEAUTY_FORM_JS = `
  var INTL_LOCALE = ${JSON.stringify(INTL_LOCALE)};
  var formatMoney = ${formatMoney.toString()};
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
