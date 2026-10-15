import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { redirect, unstable_rethrow } from 'next/navigation';
import { describe, expect, it } from 'vitest';

/**
 * Сторож: страница, которая ловит отказ API, чтобы нарисовать «сбой загрузки», сначала пробрасывает служебные
 * ошибки Next — переход на вход (`backendFetch` → `redirect('/login')` на 401), `notFound`.
 *
 * Разбор 26.09.2026 (reports/channex-cert-review-2026-09-24.md): `.then(успех, отказ)` ловит и переход на вход,
 * поэтому с истёкшей сессией «Менеджер каналов» и ещё восемь страниц показывали «сбой загрузки» вместо экрана входа,
 * а экранная проверка цикла Channex получала `channel-report-error`. `unstable_rethrow` из `next/navigation`
 * пробрасывает служебные ошибки Next и пропускает обычные — отказ API по-прежнему рисует «сбой загрузки».
 */
const APP = resolve(__dirname, 'app');

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sources(path));
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(path);
  }
  return out;
}

/** Обработчики отказа в `.then(успех, отказ)`, которые превращают отказ в `{ ok: false }` */
function rejectionHandlers(text: string): string[] {
  const re =
    /\.then\(\s*\(\w+\)\s*=>\s*\(\{\s*ok: true as const[^)]*\}\),\s*((?:\([^)]*\)|\w+)\s*=>[\s\S]*?ok: false as const)/g;
  return [...text.matchAll(re)].map((m) => m[1]!);
}

describe('страницы стойки не глотают переход на вход', () => {
  const found = sources(APP).flatMap((file) =>
    rejectionHandlers(readFileSync(file, 'utf8')).map((handler) => ({
      file: relative(APP, file),
      handler,
    })),
  );

  it('сторож видит обработчики отказа — иначе он молча ничего не проверяет', () => {
    expect(found.length).toBeGreaterThanOrEqual(15);
  });

  it('каждый обработчик отказа сначала зовёт unstable_rethrow', () => {
    expect(
      found.filter((x) => !x.handler.includes('unstable_rethrow(')).map((x) => x.file),
    ).toEqual([]);
  });

  it('unstable_rethrow пробрасывает переход на вход, а обычный отказ — нет', () => {
    let toLogin: unknown;
    try {
      redirect('/login');
    } catch (e) {
      toLogin = e;
    }
    expect(toLogin).toBeDefined();
    expect(() => unstable_rethrow(toLogin)).toThrow();
    expect(() => unstable_rethrow(new Error('HTTP 500'))).not.toThrow();
  });
});
