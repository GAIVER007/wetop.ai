import { expect, it } from 'vitest';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';

/** tsx executes the actual JSX page; the unit runner intentionally preserves JSX. */
async function renderTeam(status: number): Promise<string> {
  const server = createServer((_request, response) => {
    response.writeHead(status, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ message: 'Synthetic session response' }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Owned fixture failed');
  const script = `import { createRequire } from 'node:module';
    const require = createRequire(import.meta.url);
    require.extensions['.css'] = () => {};
    const { default: TeamPage } = await import('./apps/web/src/app/team/page.tsx');
    globalThis.React = await import('react');
    const render = typeof TeamPage === 'function' ? TeamPage : TeamPage.default;
    try { await render(); console.log('TEAM_RENDERED'); }
    catch(error) { console.log(typeof error.digest==='string' && error.digest.startsWith('NEXT_REDIRECT') ? 'TEAM_REDIRECT' : 'TEAM_OTHER_FAILURE'); }`;
  try {
    return await new Promise<string>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        ['--conditions=import', '--import', 'tsx', '--input-type=module', '-e', script],
        {
          cwd: process.cwd(),
          env: {
            PATH: process.env.PATH ?? '',
            NODE_ENV: 'development',
            APP_AUTH_REQUIRED: '1',
            APP_API_URL: `http://127.0.0.1:${address.port}`,
            WETOP_SITE_URL: 'https://wetop.ai',
          },
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );
      let output = '';
      let errors = '';
      child.stdout.on('data', (chunk) => {
        output += String(chunk);
      });
      child.stderr.on('data', (chunk) => {
        errors += String(chunk);
      });
      child.on('error', reject);
      child.on('exit', (code) => {
        if (code === 0) resolve(output.trim());
        else reject(new Error(`Team harness exited ${code ?? 'without status'}: ${errors.trim()}`));
      });
    });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

it('team navigation preserves the common session redirect', async () => {
  expect(await renderTeam(401)).toBe('TEAM_REDIRECT');
});
it('a non-session API failure retains the existing safe team fallback', async () => {
  expect(await renderTeam(503)).toBe('TEAM_RENDERED');
});
