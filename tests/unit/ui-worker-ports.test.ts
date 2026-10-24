import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { authPorts, shardSpecs, workerPorts } from '../ui/worker-ports';

/**
 * Распределитель портов изолированных UI-стендов. До него второй worker основного UI садился на 4312 (демо-источник
 * стойки, ответ 503) и все его тесты падали (запись e2e-8135); шаг 20 чинил только порты по умолчанию.
 */
describe('порты UI-стендов', () => {
  it('основной UI по умолчанию: fixture 4311 и 4331, web 3100 и 3101, site 3002 и 3003', () => {
    expect(workerPorts({ fixture: 4311, web: 3100, site: 3002 }, 2, { fixture: 20 })).toEqual([
      { fixture: 4311, web: 3100, site: 3002 },
      { fixture: 4331, web: 3101, site: 3003 },
    ]);
  });

  it('auth по умолчанию: два набора api/proxy/web/site без пересечений и резерва', () => {
    expect(authPorts({})).toEqual([
      { api: 4313, proxy: 4323, web: 3102, site: 3002 },
      { api: 4314, proxy: 4324, web: 3103, site: 3003 },
    ]);
  });

  it('переопределение, которое сажает worker на демо-порт, останавливает запуск', () => {
    expect(() => workerPorts({ fixture: 4311, web: 3100, site: 3002 }, 2)).toThrow(
      /fixture worker 1: порт 4312 зарезервирован/,
    );
    expect(() => authPorts({ AUTH_API_PORT: '4311' })).toThrow(/api worker 1: порт 4312/);
    expect(() => workerPorts({ fixture: 4292, web: 3100, site: 3002 }, 2, { fixture: 20 })).toThrow(
      /4312/,
    );
  });

  it('пересечение ролей или workers останавливает запуск, а не делит сервер', () => {
    // proxy первого worker совпал бы с api второго
    expect(() => authPorts({ AUTH_PROXY_PORT: '4314' })).toThrow(
      /proxy worker 0: порт 4314|api worker 1: порт 4314/,
    );
    expect(() => workerPorts({ fixture: 4311, web: 4311, site: 3002 }, 1)).toThrow(/уже назначен/);
  });

  it('порт вне диапазона отклоняется', () => {
    expect(() => workerPorts({ web: 65_534 }, 2)).toThrow(/вне диапазона/);
    expect(() => authPorts({ AUTH_WEB_PORT: 'abc' })).toThrow(/вне диапазона/);
  });

  it('части UI: каждый файл ровно в одной части, у обоих worker в каждой части есть файлы', () => {
    const specs = Array.from({ length: 95 }, (_, i) => `s${String(i).padStart(2, '0')}.spec.ts`);
    const parts = [1, 2, 3].map((n) => shardSpecs(specs, `${n}/3`));
    expect(parts.flat().sort()).toEqual(specs);
    for (const part of parts)
      for (const worker of [0, 1])
        expect(part.filter((_, i) => i % 2 === worker).length).toBeGreaterThanOrEqual(15);
    expect(shardSpecs(specs, undefined)).toBe(specs);
    for (const bad of ['0/3', '4/3', '1', 'a/b'])
      expect(() => shardSpecs(specs, bad)).toThrow(/UI_SHARD/);
  });

  it('два обхода всех разделов (доступность и «все разделы») всегда в разных частях', () => {
    // 23.10.2026 новый desk-kk.spec.ts сдвинул круг, и оба обхода сели в часть 3/5 к одному next dev:
    // release-checks 39994754819, 40006629233, 40006997821, 40008057689, 40009112400 краснели только в 3/5
    const specs = readdirSync(join(__dirname, '../ui'))
      .filter((name) => name.endsWith('.spec.ts'))
      .sort();
    for (const extra of [[], ['a0.spec.ts'], ['a0.spec.ts', 'a1.spec.ts'], ['zz.spec.ts']]) {
      const all = [...specs, ...extra].sort();
      const parts = [1, 2, 3, 4, 5].map((n) => shardSpecs(all, `${n}/5`));
      expect(parts.flat().sort()).toEqual(all);
      const owner = (file: string) => parts.findIndex((part) => part.includes(file));
      expect(owner('accessibility.spec.ts')).not.toBe(owner('workspace.spec.ts'));
      const sizes = parts.map((part) => part.length);
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    }
  });
});
