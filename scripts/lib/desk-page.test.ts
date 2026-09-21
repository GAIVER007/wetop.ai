import { describe, expect, it } from 'vitest';
import { deskHeaders, judgeDeskPage, reportTarget } from './desk-page';

/**
 * Скрипты сверки читают экраны стойки простым fetch. 20.09.2026 на сервере включили замок входа
 * (ADR-053), и три экранные проверки живого круга Channex «упали» с HTTP 200 — им отдали страницу
 * входа. Это не дефект стойки, и красным быть не должно: проверка либо идёт с сессией, либо честно
 * помечается пропущенной.
 */
describe('экран стойки под замком', () => {
  it('переброс на /login — это «пропущено (замок)», а не FAIL', () => {
    const v = judgeDeskPage(
      {
        status: 200,
        url: 'https://desk/login?next=%2Freservations%2F1',
        html: '<form>Email</form>',
      },
      (html) => html.includes('BDC-1'),
    );
    expect(v).toEqual({
      verdict: 'locked',
      detail: 'стойка за замком: нет сессии, проверка пропущена',
    });
  });

  it('страница открылась и ожидание нашлось — ок', () => {
    const v = judgeDeskPage(
      { status: 200, url: 'https://desk/reservations/1', html: '<h1>BDC-1</h1>' },
      (html) => html.includes('BDC-1'),
    );
    expect(v.verdict).toBe('ok');
  });

  it('страница открылась, а ожидания нет — настоящий FAIL', () => {
    const v = judgeDeskPage(
      { status: 200, url: 'https://desk/reservations/1', html: '<h1>другое</h1>' },
      (html) => html.includes('BDC-1'),
    );
    expect(v.verdict).toBe('fail');
    expect(v.detail).toContain('HTTP 200');
  });

  it('экран входа по тому же адресу — «пропущено (замок)», а не FAIL', () => {
    const v = judgeDeskPage(
      { status: 200, url: 'http://web:3000/chessboard', html: '<input name="password" />' },
      (h) => h.includes('BDC-1'),
    );
    expect(v.verdict).toBe('locked');
    expect(v.detail).toMatch(/экран входа/);
  });

  it('страница со сбоем загрузки называет сбой, а не просто «HTTP 200»', () => {
    const v = judgeDeskPage(
      {
        status: 200,
        url: 'http://web:3000/chessboard',
        html: '<div data-testid="chessboard-error">…</div>',
      },
      (h) => h.includes('BDC-1'),
    );
    expect(v.verdict).toBe('fail');
    expect(v.detail).toMatch(/сбой загрузки.*chessboard-error/);
  });

  it('обычная страница без искомого говорит об этом прямо и называет длину', () => {
    const v = judgeDeskPage(
      { status: 200, url: 'http://web:3000/chessboard', html: '<main>пусто</main>' },
      (h) => h.includes('BDC-1'),
    );
    expect(v.verdict).toBe('fail');
    expect(v.detail).toMatch(/искомого на ней нет/);
    expect(v.detail).toMatch(/знаков/);
  });

  it('сессия для стойки берётся из WEB_SESSION_COOKIE и только оттуда', () => {
    expect(deskHeaders({})).toEqual({});
    expect(deskHeaders({ WEB_SESSION_COOKIE: 'pms_session=abc' })).toEqual({
      cookie: 'pms_session=abc',
    });
  });

  it('отчёт пишется туда, куда можно писать: REPORTS_DIR, иначе reports/ проекта', () => {
    expect(reportTarget('/app', {}, 'x.md')).toBe('/app/reports/x.md');
    expect(reportTarget('/app', { REPORTS_DIR: '/data/reports' }, 'x.md')).toBe(
      '/data/reports/x.md',
    );
  });
});
