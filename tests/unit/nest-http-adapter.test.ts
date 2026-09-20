/**
 * Сетевой слой Nest должен быть виден оттуда, откуда его ищут.
 *
 * Поймано прогоном 20.09.2026: 19 наборов тестов API падали, 207 проверок молча не выполнялись.
 * Причина не в коде — в раскладке зависимостей. `@nestjs/testing` и `@nestjs/common` лежат в корневом
 * node_modules, а `@nestjs/platform-express` npm положил в apps/api/node_modules. `createNestApplication()`
 * внутри `@nestjs/common/utils/load-package.util.js` делает require от своего места, наверх по дереву —
 * и вложенную копию не видит. Наружу это выглядит как «process.exit(1)» без объяснения, а счётчик
 * показывает «пропущено», а не «упало»: дыру легко принять за зелёный прогон.
 *
 * Проверяем не «пакет установлен», а «разрешается из того же места, что и @nestjs/common» — это и есть
 * условие, которое ломается. Объявление в корневом package.json держит раскладку при следующем npm ci.
 */
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../..');
const require_ = createRequire(import.meta.url);

describe('сетевой слой Nest', () => {
  it('@nestjs/platform-express разрешается из того места, где лежит @nestjs/common', () => {
    // Не `@nestjs/common/package.json`: карта `exports` пакета его не отдаёт, и Node ищет
    // «package.json.js» — тест падал в CI на всех платформах (20.09.2026). Главный модуль лежит в корне пакета.
    const common = dirname(require_.resolve('@nestjs/common'));
    expect(() => require_.resolve('@nestjs/platform-express', { paths: [common] })).not.toThrow();
  });

  it('корневой package.json объявляет platform-express — иначе npm ci снова спрячет его в apps/api', () => {
    const root = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));
    const declared = { ...root.dependencies, ...root.devDependencies };
    expect(declared['@nestjs/platform-express']).toBeTruthy();
  });
});
