import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
it('business card migration has a unique timestamp after integrating current main', () => {
  const names = readdirSync(
    resolve(import.meta.dirname, '../../packages/database/prisma/migrations'),
  );
  const cards = names.filter((name) => name.endsWith('_business_card'));
  expect(cards).toHaveLength(1);
  const prefix = cards[0]!.split('_')[0];
  expect(names.filter((name) => name.startsWith(prefix + '_'))).toEqual(cards);
});
