import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss from 'postcss';
import { expect, it } from 'vitest';

for (const [file, selector] of [
  ['apps/web/src/app/chessboard/board.css', 'calendar-workspace'],
  ['apps/web/src/app/directory.css', 'reservation-actions'],
]) {
  it(`${selector} retains the selected DS0b sections cascade`, () => {
    const root = postcss.parse(readFileSync(resolve(file!), 'utf8'));
    const violations: string[] = [];
    let checked = 0;
    root.walkRules((rule) => {
      if (!rule.selector.includes(selector!)) return;
      checked++;
      let parent:
        | import('postcss').Root
        | import('postcss').Rule
        | import('postcss').AtRule
        | import('postcss').Document
        | undefined = rule.parent;
      let section = false;
      while (parent) {
        if (parent.type === 'atrule' && parent.name === 'layer' && parent.params === 'sections')
          section = true;
        parent = parent.parent;
      }
      if (!section) violations.push(rule.selector);
    });
    expect(checked).toBeGreaterThan(0);
    expect(violations).toEqual([]);
  });
}
