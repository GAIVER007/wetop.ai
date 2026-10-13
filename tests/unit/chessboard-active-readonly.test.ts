import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Chessboard } from '../../apps/web/src/lib/api';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push() {}, refresh() {} }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('next/link', async () => {
  const { createElement: element } = await import('react');
  return {
    default: ({
      children,
      onClick,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      ...props
    }: React.AnchorHTMLAttributes<HTMLAnchorElement>) =>
      element(
        'a',
        {
          ...props,
          'data-click-handler': onClick ? 'true' : undefined,
          'data-pointer-down-handler': onPointerDown ? 'true' : undefined,
          'data-pointer-move-handler': onPointerMove ? 'true' : undefined,
          'data-pointer-up-handler': onPointerUp ? 'true' : undefined,
        },
        children,
      ),
  };
});

import { ChessboardGrid } from '../../apps/web/src/app/chessboard/board-grid';

const dates = ['2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13'];
const board = {
  from: dates[0]!,
  to: dates.at(-1)!,
  dates,
  rows: [
    {
      unit: {
        id: 'fixture-room-a',
        code: 'T101',
        kind: 'ROOM',
        accommodationTypeCode: 'PRIVATE',
        accommodationTypeName: 'Тестовый номер',
        housekeepingStatus: 'INSPECTED',
      },
      cells: [
        {
          date: dates[0]!,
          state: 'OCCUPIED',
          itemId: 'fixture-stay-a',
          itemStatus: 'CONFIRMED',
          confirmationNumber: 'FIXTURE-ACTIVE-001',
          guestLabel: 'Алия Тестова',
          isArrival: true,
          source: 'DESK',
          balanceMinor: '0',
        },
        {
          date: dates[1]!,
          state: 'OCCUPIED',
          itemId: 'fixture-stay-a',
          itemStatus: 'CONFIRMED',
          confirmationNumber: 'FIXTURE-ACTIVE-001',
          guestLabel: 'Алия Тестова',
          source: 'DESK',
          balanceMinor: '0',
        },
        {
          date: dates[2]!,
          state: 'OCCUPIED',
          itemId: 'fixture-stay-a',
          itemStatus: 'CONFIRMED',
          confirmationNumber: 'FIXTURE-ACTIVE-001',
          guestLabel: 'Алия Тестова',
          isLastNight: true,
          source: 'DESK',
          balanceMinor: '0',
        },
        { date: dates[3]!, state: 'FREE' },
      ],
    },
  ],
  summary: Object.fromEntries(
    dates.map((date, index) => [
      date,
      index < 3 ? { occupied: 1, blocked: 0, free: 0 } : { occupied: 0, blocked: 0, free: 1 },
    ]),
  ),
  byCategory: Object.fromEntries(
    dates.map((date, index) => [
      date,
      {
        PRIVATE:
          index < 3
            ? { units: 1, occupied: 1, blocked: 0, free: 0 }
            : { units: 1, occupied: 0, blocked: 0, free: 1 },
      },
    ]),
  ),
  unassigned: [],
} satisfies Chessboard;

const render = (readOnly: boolean) =>
  renderToStaticMarkup(createElement(ChessboardGrid, { board, today: dates[0]!, readOnly }));

const count = (markup: string, token: string) => markup.split(token).length - 1;

describe('шахматка: ACTIVE и READ_ONLY для многосуточного проживания', () => {
  it('ACTIVE оставляет ручку продления на последней ночи, drag и выделение свободной клетки', () => {
    const markup = render(false);

    expect(count(markup, 'data-testid="stay-cell"')).toBe(3);
    expect(count(markup, 'board-stay-caption')).toBe(1);
    expect(count(markup, 'draggable="true"')).toBe(3);
    expect(count(markup, 'board-stay-resize')).toBe(1);
    expect(count(markup, 'data-pointer-down-handler="true"')).toBe(1);
    expect(count(markup, 'data-pointer-move-handler="true"')).toBe(1);
    expect(count(markup, 'data-pointer-up-handler="true"')).toBe(1);
  });

  it('READ_ONLY сохраняет чтение брони, но убирает resize, drag и free-cell writes', () => {
    const markup = render(true);

    expect(count(markup, 'data-testid="stay-cell"')).toBe(3);
    expect(markup).toContain('href="/reservations/FIXTURE-ACTIVE-001"');
    expect(count(markup, 'data-testid="free-cell"')).toBe(1);
    expect(markup).toMatch(/<button\b[^>]*data-testid="free-cell"/);
    expect(markup).not.toContain('href="/reservations/new?arrival=2026-10-13');
    expect(count(markup, 'board-stay-resize')).toBe(0);
    expect(count(markup, 'draggable="true"')).toBe(0);
    expect(count(markup, 'data-pointer-down-handler="true"')).toBe(0);
    expect(count(markup, 'data-pointer-move-handler="true"')).toBe(0);
    expect(count(markup, 'data-pointer-up-handler="true"')).toBe(0);
  });
});
