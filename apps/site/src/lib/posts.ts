import fs from 'node:fs';
import path from 'node:path';

/**
 * Статьи блога — файлы `content/blog/<slug>.md` с блоком полей в начале:
 *
 *   ---
 *   title: Заголовок
 *   date: 2026-09-14
 *   description: Одна фраза для списка и превью
 *   draft: true
 *   ---
 *
 * Разбор строгий и без зависимостей: неизвестное поле, пустое значение или неверная дата останавливают сборку
 * с именем файла. Опечатка в `draft` не должна тихо опубликовать черновик. `README.md` статьёй не считается.
 */
export type Post = {
  /** Имя файла без `.md` — адрес статьи `/blog/<slug>/`. */
  slug: string;
  title: string;
  /** ГГГГ-ММ-ДД. */
  date: string;
  description: string;
  /** Черновик не попадает ни в список, ни в sitemap.xml, ни в сборку. */
  draft: boolean;
  /** Текст статьи в Markdown, без блока полей. */
  body: string;
};

export type PostSource = { fileName: string; source: string };

const REQUIRED_FIELDS = ['title', 'date', 'description'] as const;
const KNOWN_FIELDS = new Set<string>([...REQUIRED_FIELDS, 'draft']);
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const FIELD_PATTERN = /^([A-Za-z_][\w-]*)\s*:(.*)$/;

export class PostError extends Error {
  readonly file: string;

  constructor(file: string, reason: string) {
    super(`Статья ${file}: ${reason}`);
    this.name = 'PostError';
    this.file = file;
  }
}

/** Файл блога — любой `*.md`, кроме README.md. */
export function isPostFileName(fileName: string): boolean {
  const base = path.basename(fileName).toLowerCase();
  return base.endsWith('.md') && base !== 'readme.md';
}

/** Настоящая календарная дата в формате ГГГГ-ММ-ДД (2026-02-30 — нет). */
export function isIsoDate(value: string): boolean {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

function unquote(value: string): string {
  const quoted =
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")));
  return quoted ? value.slice(1, -1).trim() : value;
}

export function parsePost(fileName: string, source: string): Post {
  const base = path.basename(fileName);
  const slug = base.replace(/\.md$/i, '');
  if (!SLUG_PATTERN.test(slug)) {
    throw new PostError(
      fileName,
      `имя файла становится адресом статьи, в нём допустимы только строчные латинские буквы, цифры и дефисы (например, kak-nachat.md), сейчас «${base}»`,
    );
  }

  const lines = source
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .split('\n');
  if (lines[0]?.trim() !== '---') {
    throw new PostError(
      fileName,
      'файл должен начинаться со строки «---», за ней поля title, date, description и снова «---»',
    );
  }
  const end = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  if (end === -1) {
    throw new PostError(fileName, 'блок полей не закрыт: после полей нужна строка «---»');
  }

  const fields = new Map<string, string>();
  for (let index = 1; index < end; index += 1) {
    const line = lines[index] ?? '';
    if (line.trim() === '') continue;
    const match = FIELD_PATTERN.exec(line);
    if (!match) {
      throw new PostError(
        fileName,
        `строка ${index + 1}: ожидается «поле: значение», сейчас «${line.trim()}»`,
      );
    }
    const [, key = '', rawValue = ''] = match;
    if (!KNOWN_FIELDS.has(key)) {
      throw new PostError(
        fileName,
        `строка ${index + 1}: неизвестное поле «${key}», допустимы title, date, description, draft`,
      );
    }
    if (fields.has(key)) {
      throw new PostError(fileName, `строка ${index + 1}: поле «${key}» указано дважды`);
    }
    fields.set(key, unquote(rawValue.trim()));
  }

  for (const key of REQUIRED_FIELDS) {
    const value = fields.get(key);
    if (value === undefined) throw new PostError(fileName, `нет обязательного поля «${key}»`);
    if (value === '') throw new PostError(fileName, `поле «${key}» пустое`);
  }

  const date = fields.get('date') ?? '';
  if (!isIsoDate(date)) {
    throw new PostError(
      fileName,
      `поле «date» — настоящая дата в формате ГГГГ-ММ-ДД, например 2026-09-14; сейчас «${date}»`,
    );
  }

  const draftValue = fields.get('draft');
  if (draftValue !== undefined && draftValue !== 'true' && draftValue !== 'false') {
    throw new PostError(fileName, `поле «draft» — true или false; сейчас «${draftValue}»`);
  }
  const draft = draftValue === 'true';

  const body = lines
    .slice(end + 1)
    .join('\n')
    .replace(/^(?:[ \t]*\n)+/, '')
    .trimEnd();
  if (!draft && body === '') {
    throw new PostError(fileName, 'после блока полей нет текста статьи');
  }

  return {
    slug,
    title: fields.get('title') ?? '',
    date,
    description: fields.get('description') ?? '',
    draft,
    body,
  };
}

function newestFirst(a: Post, b: Post): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return a.slug.localeCompare(b.slug);
}

/** Все статьи, включая черновики; README.md и файлы не `.md` пропускаются. Новые — первыми. */
export function parsePosts(sources: PostSource[]): Post[] {
  return sources
    .filter((item) => isPostFileName(item.fileName))
    .map((item) => parsePost(item.fileName, item.source))
    .sort(newestFirst);
}

/** Только опубликованные: без черновиков. Новые — первыми. */
export function publishedPosts(sources: PostSource[]): Post[] {
  return parsePosts(sources).filter((post) => !post.draft);
}

/**
 * Папка статей. `next build` запускается из apps/site, тесты — из корня репозитория: подходят оба.
 * Папки нет — ошибка, а не пустой блог: иначе ошибка запуска тихо спрятала бы все статьи.
 */
export function blogDirectory(cwd: string = process.cwd()): string {
  const candidates = [
    path.join(cwd, 'content', 'blog'),
    path.join(cwd, 'apps', 'site', 'content', 'blog'),
  ];
  const found = candidates.find((dir) => fs.existsSync(dir));
  if (!found) throw new Error(`Не найдена папка статей блога: ${candidates.join(' или ')}`);
  return found;
}

export function readPostSources(dir: string): PostSource[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && isPostFileName(entry.name))
    .map((entry) => {
      const fullPath = path.join(dir, entry.name);
      return {
        fileName: path.relative(process.cwd(), fullPath) || entry.name,
        source: fs.readFileSync(fullPath, 'utf8'),
      };
    });
}

export function getPublishedPosts(dir: string = blogDirectory()): Post[] {
  return publishedPosts(readPostSources(dir));
}

export function getPublishedPost(slug: string, dir: string = blogDirectory()): Post | undefined {
  return getPublishedPosts(dir).find((post) => post.slug === slug);
}
