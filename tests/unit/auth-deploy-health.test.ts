import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('deploy health uses the first-party fallback, not the public homepage redirect', () => {
  const compose = readFileSync('deploy/compose.yml', 'utf8');
  const deploy = readFileSync('scripts/ops/auto-deploy.sh', 'utf8');
  expect(compose).toContain("fetch('http://127.0.0.1:3000/auth/fallback')");
  expect(deploy).toContain("const pages = ['/auth/fallback', '/today', '/chessboard', '/reservations']");
});
