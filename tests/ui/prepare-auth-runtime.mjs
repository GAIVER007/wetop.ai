import { cpSync, existsSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import process from 'node:process';

const [app, worker] = process.argv.slice(2);
if ((app !== 'web' && app !== 'site') || !/^\d+$/.test(worker || '')) {
  throw new Error('Usage: prepare-auth-runtime.mjs <web|site> <worker>');
}

const repository = process.cwd();
const configuredRoot = process.env.AUTH_RUNTIME_ROOT || 'test-results/auth-runtime';
const runtimeRoot = `${isAbsolute(configuredRoot) ? configuredRoot : resolve(configuredRoot)}-${worker}`;
const source = join(repository, 'apps', app);
const destination = join(runtimeRoot, 'apps', app);

mkdirSync(join(runtimeRoot, 'apps'), { recursive: true });
rmSync(destination, { recursive: true, force: true });
cpSync(source, destination, {
  recursive: true,
  filter: (path) => {
    const name = path.slice(path.lastIndexOf('/') + 1);
    return !name.startsWith('.next') && name !== 'next-env.d.ts' && name !== 'node_modules';
  },
});

for (const name of ['node_modules', 'packages', 'tsconfig.base.json']) {
  const link = join(runtimeRoot, name);
  if (!existsSync(link)) symlinkSync(join(repository, name), link);
}
