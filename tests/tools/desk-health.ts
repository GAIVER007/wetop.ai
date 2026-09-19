/**
 * Проверка стенда стойки перед прогоном e2e.
 *
 * 16.09.2026: полный прогон дал четыре красных (`chessboard`, `desk-day`, `stay-extras`, `web-analytics`),
 * и ни одно из них не было дефектом кода — в журнале сервера на каждой странице стояло
 * «Cannot find module '…/apps/web/.next/server/chunks/ssr/_1-p2ima._.js'». `next start` читает манифест
 * сборки при запуске и держит его в памяти, а чанки берёт с диска по требованию; пересборка стойки
 * (`npm run build -w apps/web`) в другой сессии заменила файлы чанков — имена в памяти перестали
 * существовать. Проверка готовности Playwright это не ловит: одна страница (`/inventory`) отвечала 200.
 */

export interface DeskProbe {
  path: string;
  status: number;
  body: string;
}

const STALE = /Cannot find module\s+'?([^'\s]*\.next[^'\s]*)/;

/** Первая страница, которая упала на пропавшем чанке сборки, и имя самого чанка. */
export function staleBuild(probes: DeskProbe[]): { path: string; chunk: string } | undefined {
  for (const p of probes) {
    if (p.status < 500) continue;
    const chunk = STALE.exec(p.body)?.[1];
    if (chunk) return { path: p.path, chunk };
  }
  return undefined;
}

/** Страницы, упавшие не из-за сборки: причину ищут по журналу сервера, прогон не останавливаем. */
export function serverErrors(probes: DeskProbe[]): DeskProbe[] {
  return probes.filter((p) => p.status >= 500 && !STALE.test(p.body));
}

export function staleBuildMessage(found: { path: string; chunk: string }, port: number): string {
  return [
    `Стойка на ${port} работает на устаревшей сборке: ${found.path} отдаёт 500, а чанка ${found.chunk} на диске нет.`,
    'Так бывает, когда `npm run build -w apps/web` прошёл уже после запуска `next start` (другая сессия, стенд e2e).',
    'Прогон остановлен до первого спека: иначе красными станут страницы, а не код.',
    `Починить: снять процесс стенда (\`lsof -ti tcp:${port} | xargs kill\`), пересобрать стойку`,
    '(`npm run build -w apps/web`) и запустить прогон снова — стенд Playwright поднимет сам.',
    'На машине стойки служба launchd: `launchctl kickstart -k gui/$(id -u)/kz.luxx.pms.web`.',
  ].join('\n');
}

/**
 * Условие допуска к прогону: устаревшая сборка — стоп до первого спека; прочие 500 только называем,
 * их причина в журнале сервера, и валить из-за них чужой прогон нельзя.
 */
export function assertDeskReady(probes: DeskProbe[], port: number): void {
  const found = staleBuild(probes);
  if (found) throw new Error(staleBuildMessage(found, port));
  const broken = serverErrors(probes);
  if (broken.length)
    console.log(`[стенд] 500 на страницах: ${broken.map((p) => p.path).join(', ')} — причина в журнале стойки`);
}

/** Опрос страниц стенда. Недоступный сервер не считаем неисправностью: готовность проверяет сам Playwright. */
export async function probeDesk(base: string, paths: string[]): Promise<DeskProbe[]> {
  const probes: DeskProbe[] = [];
  for (const path of paths) {
    try {
      const res = await fetch(`${base}${path}`, { redirect: 'follow' });
      probes.push({ path, status: res.status, body: await res.text() });
    } catch {
      // сервер не ответил — это не признак устаревшей сборки
    }
  }
  return probes;
}
