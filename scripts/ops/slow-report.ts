/**
 * Разбор «всё тормозит»: где уходит время — в базе, в API, в стойке или в самой машине.
 * Здесь только счёт и выводы; замеры делает `cli-slow.ts` (ему нужны `.env` и живые службы).
 */

export interface Measure {
  /** Что мерили: `SELECT 1`, путь API или экран стойки */
  name: string;
  /** Замеры в миллисекундах, по одному на проход */
  samples: number[];
  /** Сколько запросов в базу делает этот вызов — известно из кода, нужно для вывода */
  dbQueries?: number;
  error?: string;
}

export interface MachineFacts {
  platform: string;
  /** Память, ГБ */
  memoryGb?: number;
  /** Средняя загрузка за минуту и число ядер */
  load1?: number;
  cores?: number;
  /** Сколько выгружено в своп, ГБ */
  swapUsedGb?: number;
  /** Свободно на диске, ГБ */
  freeDiskGb?: number;
}

export interface Finding {
  /** Насколько это важно для «тормозит»: 1 — главное */
  rank: number;
  title: string;
  detail: string;
  advice: string;
}

export const median = (values: number[]): number => {
  if (values.length === 0) return Number.NaN;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : Math.round((s[mid - 1]! + s[mid]!) / 2);
};

export const ms = (value: number): string =>
  Number.isNaN(value) ? '—' : value >= 1000 ? `${(value / 1000).toFixed(1)} с` : `${Math.round(value)} мс`;

/** Строка таблицы: медиана, разброс и, если известно, цена по запросам в базу */
export function row(m: Measure, dbMedian: number): string {
  if (m.error) return `${m.name}\tошибка: ${m.error}`;
  const med = median(m.samples);
  const min = Math.min(...m.samples);
  const max = Math.max(...m.samples);
  const network =
    m.dbQueries && !Number.isNaN(dbMedian)
      ? `\tиз них сеть до базы ≈ ${ms(m.dbQueries * dbMedian)} (${m.dbQueries} запр.)`
      : '';
  return `${m.name}\t${ms(med)}\t(от ${ms(min)} до ${ms(max)})${network}`;
}

/**
 * Выводы по замерам. Порядок — по вкладу в «тормозит», а не по красоте:
 * сначала то, что отнимает больше всего времени.
 */
export function explainSlowness(input: {
  db?: Measure;
  api: Measure[];
  desk: Measure[];
  machine?: MachineFacts;
}): Finding[] {
  const found: Array<Omit<Finding, 'rank'> & { cost: number }> = [];
  const dbMedian = input.db && !input.db.error ? median(input.db.samples) : Number.NaN;

  // 1. Задержка до базы: умножается на число запросов, поэтому дороже всего
  if (!Number.isNaN(dbMedian)) {
    const heaviest = Math.max(0, ...input.api.map((m) => m.dbQueries ?? 0));
    const cost = dbMedian * Math.max(1, heaviest);
    if (dbMedian >= 20)
      found.push({
        cost,
        title: `Один запрос в базу идёт ${ms(dbMedian)}`,
        detail:
          `Самый тяжёлый экран делает до ${heaviest} запросов подряд — это ${ms(cost)} только на дороге. ` +
          'Так бывает, когда база и программа в разных регионах: у нас база в Сингапуре.',
        advice:
          'Перенести базу в тот же регион, где работает API (или наоборот). До переноса помогает только ' +
          'сокращение числа запросов на экран.',
      });
  }

  // 2а. Лежащий API — одна строка, а не по одной на каждый вызов: причина у всех одна
  const dead = input.api.filter((m) => m.error);
  if (dead.length > 1 && dead.length === input.api.length)
    found.push({
      cost: 1_000_000, // это не «медленно», это «не работает»: в отчёте всегда первой строкой
      title: 'API не ответил ни на один вызов',
      detail: `${dead.map((m) => m.name).join(', ')} — ${dead[0]!.error ?? 'без ответа'}`,
      advice: 'Проверить, что API поднят (`scripts/ops/launchd/status.sh`) и отвечает на 127.0.0.1.',
    });

  // 2б. Медленный эндпоинт: смотрим на сам ответ API
  for (const m of input.api) {
    if (m.error) {
      if (dead.length > 1 && dead.length === input.api.length) continue;
      found.push({
        cost: 0,
        title: `${m.name} не ответил`,
        detail: m.error,
        advice: 'Проверить, что API поднят (`scripts/ops/launchd/status.sh`) и отвечает на 127.0.0.1.',
      });
      continue;
    }
    const med = median(m.samples);
    // Дорогу до базы уже назвали выше: здесь важно то, что она НЕ объясняет — сам запрос и работа API
    const network = Number.isNaN(dbMedian) ? 0 : (m.dbQueries ?? 0) * dbMedian;
    const unexplained = Math.max(0, med - network);
    if (unexplained >= 800)
      found.push({
        cost: unexplained,
        title: `${m.name} отвечает ${ms(med)}, и дорога до базы объясняет только ${ms(network)}`,
        detail: `Запросов в базу на этот вызов: ${m.dbQueries ?? '—'}; необъяснённые ${ms(unexplained)}.`,
        advice:
          'Смотреть сам запрос: объём выборки и индексы (`cli-db-activity.ts` покажет, что выполняется ' +
          'и чего ждёт).',
      });
  }

  // 3. Стойка против API: сколько добавляет Next поверх данных
  const apiWorst = Math.max(0, ...input.api.filter((m) => !m.error).map((m) => median(m.samples)));
  for (const m of input.desk) {
    if (m.error) continue;
    const med = median(m.samples);
    const overhead = med - apiWorst;
    if (overhead >= 1000)
      found.push({
        cost: overhead,
        title: `Экран ${m.name} рисуется ${ms(med)} при самом медленном API ${ms(apiWorst)}`,
        detail: `Поверх данных стойка добавляет ${ms(overhead)}.`,
        advice:
          'Это не база: смотреть сборку стойки (`next start`, а не `next dev`), память машины и ' +
          'число запросов на экран (`tests/ui/requests.spec.ts`).',
      });
  }

  // 4. Машина: своп и загрузка
  const mach = input.machine;
  if (mach?.swapUsedGb !== undefined && mach.swapUsedGb >= 1)
    found.push({
      cost: 1500 * mach.swapUsedGb,
      title: `Машина в свопе: выгружено ${mach.swapUsedGb.toFixed(1)} ГБ`,
      detail:
        `Памяти ${mach.memoryGb?.toFixed(0) ?? '—'} ГБ, и на ней разом API, стойка, туннель и ` +
        'синхронизация. В свопе медленно всё, включая сборку страниц.',
      advice: 'Закрыть лишнее на время смены или перенести службы на сервер (Q-112).',
    });
  if (mach?.load1 !== undefined && mach.cores && mach.load1 > mach.cores)
    found.push({
      cost: 1000 * (mach.load1 - mach.cores),
      title: `Очередь к процессору: загрузка ${mach.load1.toFixed(1)} при ${mach.cores} ядрах`,
      detail: 'Что-то ещё занимает машину: прогон тестов, сборка, импорт.',
      advice: 'Посмотреть, что работает, и не держать прогоны тестов одновременно со сменой.',
    });
  if (mach?.freeDiskGb !== undefined && mach.freeDiskGb < 10)
    found.push({
      cost: 500,
      title: `На диске свободно ${mach.freeDiskGb.toFixed(0)} ГБ`,
      detail: 'При забитом диске падают сборка стойки и запись трасс тестов (было 15.09.2026).',
      advice: 'Вычистить кэши сборки и npm.',
    });

  return found
    .sort((a, b) => b.cost - a.cost)
    .map((f, i) => ({ rank: i + 1, title: f.title, detail: f.detail, advice: f.advice }));
}
