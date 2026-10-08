import { createHash } from 'node:crypto';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';

export type UiWorkerRuntime = {
  index: number;
  root: string;
  uiDir: string;
  testMatch: string[];
  fixturePort: number;
  webPort: number;
  sitePort: number;
  fixtureOrigin: string;
  webOrigin: string;
  siteOrigin: string;
};

export type IsolatedUiWorkers = {
  root: string;
  runtimeParent: string;
  workers: [UiWorkerRuntime, UiWorkerRuntime];
  specialTests: string[];
  manifestPath: string;
};

type FileProof = {
  path: string;
  sourceSha256: string;
  mirrorSha256: string;
  replacements: number;
};

const SPECIAL_TESTS = ['a27-auth-boundary.spec.ts'];
const TEXT_EXTENSIONS = new Set(['.cjs', '.js', '.json', '.mjs', '.ts', '.tsx']);
const COPY_IGNORES = new Set(['node_modules', 'out']);
const RUNTIME_ROOT_FILES = ['package.json', 'package-lock.json', 'tsconfig.base.json'];

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function configuredPort(name: string, fallback: number): number {
  const raw = process.env[name];
  const port = raw === undefined || raw === '' ? fallback : Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65_534)
    throw new Error(`${name} must be an integer from 1 to 65534`);
  return port;
}

function replaceAllCount(
  source: string,
  from: string,
  to: string,
): { text: string; count: number } {
  const parts = source.split(from);
  return { text: parts.join(to), count: parts.length - 1 };
}

function rewriteUiSource(
  source: string,
  path: string,
  origins: Pick<UiWorkerRuntime, 'fixtureOrigin' | 'webOrigin' | 'siteOrigin'>,
): { text: string; replacements: number } {
  let text = source;
  let replacements = 0;
  const originReplacements = new Map([
    ['http://127.0.0.1:4311', origins.fixtureOrigin],
    ['http://127.0.0.1:3100', origins.webOrigin],
    ['http://127.0.0.1:3002', origins.siteOrigin],
  ]);
  for (const [from, to] of originReplacements) {
    const result = replaceAllCount(text, from, to);
    text = result.text;
    replacements += result.count;
  }

  if (path === 'fixtures.ts') {
    const fixtureSelection =
      /const fixturePort = process\.env\['FIXTURE_PORT'\];\nexport const FIXTURE_API =\n[ ]{2}process\.env\['UI_FIXTURE_API'\] \?\?\n[ ]{2}\(fixturePort \? `http:\/\/127\.0\.0\.1:\$\{fixturePort\}` : 'http:\/\/127\.0\.0\.1:\d+'\);/;
    if (!fixtureSelection.test(text))
      throw new Error(
        'tests/ui/fixtures.ts fixture origin selector changed; isolated mirror is unsafe',
      );
    text = text.replace(fixtureSelection, `export const FIXTURE_API = '${origins.fixtureOrigin}';`);
    replacements += 1;
  }
  return { text, replacements };
}

function copyTree(
  sourceRoot: string,
  targetRoot: string,
  transform?: (source: string, path: string) => { text: string; replacements: number },
): FileProof[] {
  const proofs: FileProof[] = [];
  const visit = (sourceDir: string, targetDir: string) => {
    mkdirSync(targetDir, { recursive: true });
    for (const entry of readdirSync(sourceDir, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      if (COPY_IGNORES.has(entry.name) || entry.name.startsWith('.next')) continue;
      const sourcePath = join(sourceDir, entry.name);
      const targetPath = join(targetDir, entry.name);
      if (entry.isDirectory()) {
        visit(sourcePath, targetPath);
        continue;
      }
      if (!entry.isFile()) continue;
      const path = relative(sourceRoot, sourcePath);
      const bytes = readFileSync(sourcePath);
      if (transform && TEXT_EXTENSIONS.has(extname(entry.name))) {
        const result = transform(bytes.toString('utf8'), path);
        mkdirSync(dirname(targetPath), { recursive: true });
        writeFileSync(targetPath, result.text);
        proofs.push({
          path,
          sourceSha256: sha256(bytes),
          mirrorSha256: sha256(result.text),
          replacements: result.replacements,
        });
      } else {
        copyFileSync(sourcePath, targetPath);
        proofs.push({
          path,
          sourceSha256: sha256(bytes),
          mirrorSha256: sha256(bytes),
          replacements: 0,
        });
      }
    }
  };
  visit(sourceRoot, targetRoot);
  return proofs;
}

function link(source: string, target: string): void {
  mkdirSync(dirname(target), { recursive: true });
  symlinkSync(source, target, 'dir');
}

/** Creates two external, origin-only test mirrors and disjoint app runtimes. */
export function prepareIsolatedUiWorkers(repoRoot: string): IsolatedUiWorkers {
  const fixtureBase = configuredPort('UI_FIXTURE_PORT', 4311);
  const webBase = configuredPort('UI_WEB_PORT', 3100);
  const siteBase = configuredPort('UI_SITE_PORT', 3002);
  const runtimeParent = resolve(process.env.UI_RUNTIME_PARENT || dirname(repoRoot));
  const repoFromParent = relative(runtimeParent, repoRoot);
  if (repoFromParent.startsWith('..') || isAbsolute(repoFromParent))
    throw new Error('UI_RUNTIME_PARENT must contain the repository checkout');
  mkdirSync(runtimeParent, { recursive: true });
  const root = mkdtempSync(join(runtimeParent, '.wetop-main-ui-'));
  const sourceUi = join(repoRoot, 'tests/ui');
  const allSpecs = readdirSync(sourceUi)
    .filter((name) => name.endsWith('.spec.ts'))
    .sort();
  const mainSpecs = allSpecs;
  const manifests: Array<{
    index: number;
    files: FileProof[];
    apps: FileProof[];
    testMatch: string[];
    origins: Record<string, string>;
  }> = [];

  const workers = [0, 1].map((index): UiWorkerRuntime => {
    const workerRoot = join(root, `worker-${index}`);
    const uiDir = join(workerRoot, 'tests/ui');
    const fixturePort = fixtureBase + index;
    const webPort = webBase + index;
    const sitePort = siteBase + index;
    const runtime = {
      index,
      root: workerRoot,
      uiDir,
      testMatch: mainSpecs.filter((_, specIndex) => specIndex % 2 === index),
      fixturePort,
      webPort,
      sitePort,
      fixtureOrigin: `http://127.0.0.1:${fixturePort}`,
      webOrigin: `http://127.0.0.1:${webPort}`,
      siteOrigin: `http://127.0.0.1:${sitePort}`,
    };
    const files = copyTree(sourceUi, uiDir, (source, path) =>
      rewriteUiSource(source, path, runtime),
    );
    const apps = [
      ...copyTree(join(repoRoot, 'apps/web'), join(workerRoot, 'apps/web')),
      ...copyTree(join(repoRoot, 'apps/site'), join(workerRoot, 'apps/site')),
    ];
    for (const file of RUNTIME_ROOT_FILES)
      copyFileSync(join(repoRoot, file), join(workerRoot, file));
    link(join(repoRoot, 'node_modules'), join(workerRoot, 'node_modules'));
    link(join(repoRoot, 'packages'), join(workerRoot, 'packages'));
    link(join(repoRoot, 'scripts'), join(workerRoot, 'scripts'));
    link(join(repoRoot, 'tests/e2e'), join(workerRoot, 'tests/e2e'));
    manifests.push({
      index,
      files,
      apps,
      testMatch: runtime.testMatch,
      origins: {
        fixture: runtime.fixtureOrigin,
        web: runtime.webOrigin,
        site: runtime.siteOrigin,
      },
    });
    return runtime;
  }) as [UiWorkerRuntime, UiWorkerRuntime];

  const manifestPath = join(root, 'manifest.json');
  writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        source: repoRoot,
        transform: 'origin-only',
        sourceSpecCount: allSpecs.length,
        partitionedSpecCount: mainSpecs.length,
        specialTests: SPECIAL_TESTS,
        workers: manifests,
      },
      null,
      2,
    ),
  );
  return { root, runtimeParent, workers, specialTests: [...SPECIAL_TESTS], manifestPath };
}
