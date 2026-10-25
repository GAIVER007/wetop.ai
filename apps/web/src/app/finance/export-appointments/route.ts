import { beautyApi } from '../../../lib/api';
import { ApiError } from '../../../lib/api-error';
import { serverT } from '../../../i18n/server';
import { validDate } from '../../../lib/hotel-api';
import { appointmentsCsv, type CsvDay } from '../appointments-csv';

/** Не длиннее месяца: день салона это отдельный запрос, длинный период выгружают частями */
const MAX_DAYS = 31;

const text = (status: number, body: string) =>
  new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });

const plusDay = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

/**
 * Выгрузка записей салона за период в CSV (Q-BS-6): финансовая проекция одним запросом (`/beauty/finance/appointments`,
 * право finance.view - кнопка живёт на экране «Финансы», и журнал смотреть для этого не нужно; в проекции нет заметок
 * и телефона, которых в CSV и так нет). Браузер к API напрямую не ходит: стойка берёт ответ с сессией вошедшего.
 */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const from = q.get('from') ?? '';
  const to = q.get('to') ?? '';
  if (!validDate(from) || !validDate(to) || from > to) {
    const t = await serverT();
    return text(400, t('Проверьте даты: окончание периода должно быть не раньше начала.'));
  }
  let count = 0;
  for (let d = from; d <= to; d = plusDay(d)) {
    count += 1;
    if (count > MAX_DAYS) {
      const t = await serverT();
      return text(422, t('Период длиннее {n} дней: выгрузите по частям.', { n: MAX_DAYS }));
    }
  }
  try {
    const period = await beautyApi.financePeriod(from, to);
    // CSV считает по дням: группируем строки по местному дню начала визита (`localDate` считает API в поясе филиала).
    const byDay = new Map<string, CsvDay>();
    for (const { localDate, ...appointment } of period.appointments) {
      let day = byDay.get(localDate);
      if (!day) {
        day = { location: period.location, date: localDate, columns: [], appointments: [] };
        byDay.set(localDate, day);
      }
      day.appointments.push(appointment);
    }
    return new Response(appointmentsCsv([...byDay.values()]), {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="wetop-appointments-${from}_${to}.csv"`,
        'cache-control': 'no-store',
      },
    });
  } catch (e) {
    if (e instanceof ApiError) return text(e.status >= 500 ? 502 : e.status, e.message);
    throw e;
  }
}
