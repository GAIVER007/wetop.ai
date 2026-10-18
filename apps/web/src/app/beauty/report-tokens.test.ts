import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const tokens = readFileSync(new URL('../tokens.css', import.meta.url), 'utf8');
const declared = new Set([...tokens.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1]));

describe('report screens use existing design-system spacing', () => {
  for (const file of ['./beauty.css', './services/services.css']) {
    it(file, () => {
      const css = readFileSync(new URL(file, import.meta.url), 'utf8');
      const referenced = [...css.matchAll(/var\((--space-[\w-]+)\)/g)].map((match) => match[1]);
      expect([...new Set(referenced.filter((name) => !declared.has(name)))]).toEqual([]);
    });
  }
});
