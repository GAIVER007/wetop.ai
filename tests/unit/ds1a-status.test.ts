import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

const expected = {
  hospitality: {
    TENTATIVE: 'Не подтверждена',
    CONFIRMED: 'Подтверждена',
    CHECKED_IN: 'Проживает',
    CHECKED_OUT: 'Выехал',
    CANCELLED: 'Отменена',
    NO_SHOW: 'Незаезд',
  },
  housekeeping: { DIRTY: 'Требует уборки', CLEAN: 'Убрано', INSPECTED: 'Проверено' },
  payment: {
    paid: 'Оплачено',
    partial: 'Оплачено частично',
    unpaid: 'Не оплачено',
    due: 'Есть долг',
    refund: 'К возврату',
    refunded: 'Возвращено',
  },
  beauty: {
    BOOKED: 'Записан',
    CONFIRMED: 'Подтверждена',
    DONE: 'Завершена',
    NO_SHOW: 'Не пришёл',
    CANCELLED: 'Отменена',
  },
  food: {
    BOOKED: 'Бронь',
    CONFIRMED: 'Подтверждено',
    SEATED: 'За столом',
    COMPLETED: 'Завершено',
    NO_SHOW: 'Не пришли',
    CANCELLED: 'Отменено',
  },
  source: {
    OTA: 'Канал продаж',
    DESK: 'Стойка',
    PHONE: 'Телефон',
    WHATSAPP: 'WhatsApp',
    WALK_IN: 'Без предварительной брони',
    INSTAGRAM: 'Instagram',
    WEBSITE: 'Сайт',
  },
};

describe('DS1a approved presentation', () => {
  for (const [kind, labels] of Object.entries(expected)) {
    it(`${kind}: every existing value has its approved label and semantic tone`, async () => {
      const { statusRegistries } = await import('../../apps/web/src/lib/status');
      const registry = statusRegistries[kind as keyof typeof statusRegistries];
      expect(
        Object.fromEntries(Object.entries(registry).map(([key, value]) => [key, value.label])),
      ).toEqual(labels);
      for (const value of Object.values(registry)) {
        expect(['neutral', 'info', 'success', 'warning', 'danger']).toContain(value.tone);
      }
    });
  }
  it('approved plural filters and lowercase contextual words derive from the same registry', async () => {
    const { hospitality, hospitalityWords, hospitalityGroups } =
      await import('../../apps/web/src/lib/status/hospitality');
    expect(Object.values(hospitalityGroups)).toEqual([
      'Не подтверждённые',
      'Подтверждённые',
      'Проживают',
      'Выехавшие',
      'Отменённые',
      'Незаезды',
    ]);
    for (const [key, value] of Object.entries(hospitality))
      expect(hospitalityWords[key]).toBe(value.label.toLocaleLowerCase('ru'));
  });
  it('unknown API strings remain readable with neutral tone, including prototype keys', async () => {
    const { statusPresentation } = await import('../../apps/web/src/lib/status');
    for (const value of ['NEW_STATUS', '__proto__', 'constructor']) {
      expect(statusPresentation('hospitality', value)).toEqual({ label: value, tone: 'neutral' });
    }
    expect(statusPresentation('hospitality', 'CHECKED_IN')).toMatchObject({
      label: 'Проживает',
      tone: 'success',
    });
  });
});

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(join(dir, entry.name))
      : /\.tsx?$/.test(entry.name) && !entry.name.endsWith('.test.ts')
        ? [join(dir, entry.name)]
        : [],
  );
}

it('status presentation dictionaries live only in lib/status', () => {
  const root = 'apps/web/src';
  // These are contextual instructions or domain grouping, not status labels/tones.
  const allowed = new Set([
    'app/chessboard/housekeeping-menu.tsx:DONE_RU',
    'app/units/[code]/unit-actions.tsx:HK_NEXT',
    'app/guests/filters.ts:LEGACY_STATUS',
  ]);
  const duplicates: string[] = [];
  for (const file of files(root)) {
    const name = relative(root, file);
    if (name.startsWith('lib/status/')) continue;
    const ast = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const visit = (node: ts.Node) => {
      if (
        ts.isPropertyAssignment(node) &&
        ['TENTATIVE', 'INSPECTED', 'DESK'].includes(node.name.getText(ast).replace(/['"]/g, ''))
      ) {
        let parent: ts.Node | undefined = node.parent;
        while (parent && !ts.isVariableDeclaration(parent)) parent = parent.parent;
        const variable = parent && ts.isVariableDeclaration(parent) ? parent.name.getText(ast) : '';
        if (!allowed.has(`${name}:${variable}`)) duplicates.push(`${name}:${variable}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(ast);
  }
  expect(duplicates).toEqual([]);
});
