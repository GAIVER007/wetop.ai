import { existsSync, unlinkSync } from 'node:fs';
import { cleanupRuntime, STATE_PATH } from './runtime-state';

export default async function globalTeardown() {
  if (!existsSync(STATE_PATH)) return;
  await cleanupRuntime();
  unlinkSync(STATE_PATH);
}
