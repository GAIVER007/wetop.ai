import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import { surplusUnitCost } from './stock';

const require = createRequire(import.meta.url);
const { nodeFileTrace } = require('next/dist/compiled/@vercel/nft');

it('traces the guarded exact stock average without folding its initial zero denominator', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'wetop-stock-trace-'));
  try {
    const file = join(directory, 'stock.js');
    await writeFile(file, `export const surplusUnitCost = ${surplusUnitCost.toString()};`);
    await expect(nodeFileTrace([file], { base: directory })).resolves.toBeDefined();
    expect(surplusUnitCost([])).toBeNull();
    expect(surplusUnitCost([{ remaining: 0n, unitCost: 1n }])).toBeNull();
    expect(surplusUnitCost([{ remaining: 3n, unitCost: 900719925474099300n }])).toBe(900719925474099300n);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
