import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fingerprint, watchPathspec as pathspec } from './journal';

/**
 * Состояние кода для журнала прогонов (TESTING.md): коммит, изменённые файлы набора, отпечаток содержимого.
 * Только чтение git — в репозитории ничего не меняется.
 */

export const ROOT = resolve(import.meta.dirname, '../..');

function git(args: readonly string[], input?: string): string {
  return execFileSync('git', [...args], {
    cwd: ROOT,
    encoding: 'utf8',
    input,
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

const zsplit = (out: string): string[] => out.split('\0').filter(Boolean);

export function headCommit(): string {
  return git(['rev-parse', 'HEAD']).trim();
}

export function currentBranch(): string {
  return git(['rev-parse', '--abbrev-ref', 'HEAD']).trim();
}

/** Файлы набора на диске: закоммиченные и новые, без того, что закрыто .gitignore */
export function watchedFiles(watch: readonly string[]): string[] {
  const listed = zsplit(
    git(['ls-files', '-z', '--cached', '--others', '--exclude-standard', ...pathspec(watch)]),
  );
  return [...new Set(listed)].filter((f) => {
    const path = resolve(ROOT, f);
    return existsSync(path) && statSync(path).isFile();
  });
}

/** Отпечаток содержимого файлов набора в том виде, в каком они лежат сейчас, с незакоммиченными правками */
export function codeFingerprint(watch: readonly string[]): string {
  const files = watchedFiles(watch);
  if (!files.length) return fingerprint([]);
  const hashes = git(['hash-object', '--stdin-paths'], `${files.join('\n')}\n`)
    .trim()
    .split('\n');
  return fingerprint(files.map((f, i) => [f, hashes[i] ?? ''] as const));
}

/** Файлы набора, которые отличаются от HEAD: изменённые, удалённые, новые */
export function dirtyFiles(watch: readonly string[]): string[] {
  const entries = zsplit(
    git(['status', '--porcelain=v1', '-z', '--untracked-files=all', ...pathspec(watch)]),
  );
  const files: string[] = [];
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i] ?? '';
    files.push(entry.slice(3));
    // у переименования и копии следом идёт старый путь
    if (/^[RC]/.test(entry)) i += 1;
  }
  return files;
}

/** Что изменилось в файлах набора с коммита прогона; null — такого коммита нет в этой копии */
export function changedSince(commit: string, watch: readonly string[]): string[] | null {
  try {
    git(['cat-file', '-e', `${commit}^{commit}`]);
  } catch {
    return null;
  }
  const tracked = zsplit(git(['diff', '--name-only', '-z', commit, ...pathspec(watch)]));
  const untracked = zsplit(
    git(['ls-files', '-z', '--others', '--exclude-standard', ...pathspec(watch)]),
  );
  return [...new Set([...tracked, ...untracked])].sort();
}
