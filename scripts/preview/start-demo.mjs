/** An explicit local preview. No credentials, DB or external providers are used. */
import { spawn } from 'node:child_process';
import process from 'node:process';
const children = [];
let closing = false;
function stop(code = 0) {
  if (closing) return;
  closing = true;
  for (const child of children) child.kill('SIGTERM');
  process.exitCode = code;
}
const launch = (args, env) => {
  const child = spawn('npm', args, { stdio: 'inherit', env: { ...process.env, ...env } });
  children.push(child);
  child.on('exit', (code) => stop(code || 0));
  child.on('error', () => stop(1));
  return child;
};
launch(['exec', '--', 'tsx', 'scripts/preview/fixture-api.ts'], { WETOP_PREVIEW_MODE: 'demo' });
launch(
  ['exec', '-w', 'apps/web', '--', 'next', 'dev', '--port', '3000', '--hostname', '127.0.0.1'],
  { APP_DEMO_MODE: '1', APP_ALLOW_TEST_DATA: '', APP_API_URL: 'http://127.0.0.1:4312' },
);
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
