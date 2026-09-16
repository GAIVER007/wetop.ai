/**
 * Выводы разбора «всё тормозит» считаются по замерам, а не на глаз: главное — то, что отнимает
 * больше всего времени. Правила проверяются на числах, похожих на настоящие (16.09.2026).
 */
import { describe, expect, it } from 'vitest';
import { explainSlowness, median, ms, row } from './slow-report';

const samples = (...v: number[]) => v;

describe('счёт', () => {
  it('медиана берёт середину, а не среднее: один выброс не портит картину', () => {
    expect(median(samples(100, 110, 5000))).toBe(110);
    expect(median(samples(100, 200))).toBe(150);
    expect(median([])).toBeNaN();
  });

  it('время читается словами: миллисекунды до секунды, дальше секунды', () => {
    expect(ms(120)).toBe('120 мс');
    expect(ms(2400)).toBe('2.4 с');
    expect(ms(Number.NaN)).toBe('—');
  });

  it('в строке видно цену дороги: число запросов × задержку базы', () => {
    const line = row({ name: '/desk/dashboard', samples: samples(3000, 3200), dbQueries: 12 }, 180);
    expect(line).toContain('/desk/dashboard');
    expect(line).toContain('сеть до базы ≈ 2.2 с');
    expect(line).toContain('12 запр.');
  });
});

describe('выводы', () => {
  it('дорога до базы называется первой, когда запросов много', () => {
    const findings = explainSlowness({
      db: { name: 'SELECT 1', samples: samples(180, 190, 200) },
      api: [{ name: '/desk/dashboard', samples: samples(2600, 2800), dbQueries: 12 }],
      desk: [{ name: '/today', samples: samples(3000) }],
    });
    expect(findings[0]?.title).toMatch(/Один запрос в базу идёт 19\d мс/);
    expect(findings[0]?.detail).toContain('12 запросов');
    expect(findings[0]?.advice).toContain('регион');
  });

  it('быстрая база рядом — про регион не пишем', () => {
    const findings = explainSlowness({
      db: { name: 'SELECT 1', samples: samples(3, 4, 4) },
      api: [{ name: '/chessboard', samples: samples(120), dbQueries: 4 }],
      desk: [{ name: '/chessboard', samples: samples(300) }],
    });
    expect(findings.map((f) => f.title).join(' ')).not.toContain('запрос в базу');
  });

  it('стойка, которая рисует дольше данных, — отдельная причина, не база', () => {
    const findings = explainSlowness({
      db: { name: 'SELECT 1', samples: samples(4) },
      api: [{ name: '/desk/today', samples: samples(150), dbQueries: 2 }],
      desk: [{ name: '/today', samples: samples(5900) }],
    });
    expect(findings[0]?.title).toContain('Экран /today рисуется 5.9 с');
    expect(findings[0]?.advice).toContain('next start');
  });

  it('своп и забитый диск попадают в выводы: в свопе медленно всё', () => {
    const findings = explainSlowness({
      api: [],
      desk: [],
      machine: { platform: 'darwin', memoryGb: 8, swapUsedGb: 14, freeDiskGb: 6, load1: 9, cores: 8 },
    });
    const titles = findings.map((f) => f.title).join('\n');
    expect(titles).toContain('Машина в свопе');
    expect(titles).toContain('Очередь к процессору');
    expect(titles).toContain('свободно 6 ГБ');
    // своп дороже всего остального
    expect(findings[0]?.title).toContain('своп');
  });

  it('не ответивший API называется, а не прячется за медианой', () => {
    const findings = explainSlowness({
      api: [{ name: '/desk/dashboard', samples: [], error: 'connect ECONNREFUSED 127.0.0.1:3001' }],
      desk: [],
    });
    expect(findings[0]?.title).toContain('не ответил');
    expect(findings[0]?.advice).toContain('launchd');
  });
});
