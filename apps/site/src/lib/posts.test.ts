import { describe, expect, it } from 'vitest';
import {
  blogDirectory,
  getPublishedPosts,
  isIsoDate,
  parsePost,
  parsePosts,
  publishedPosts,
  readPostSources,
} from './posts';

// Вымышленные статьи: только поля и текст, никаких данных гостей.
function article(fields: Record<string, string>, body = 'Текст статьи.'): string {
  const lines = Object.entries(fields).map(([key, value]) => `${key}: ${value}`);
  return ['---', ...lines, '---', '', body].join('\n');
}

const validFields = {
  title: 'Как устроена шахматка',
  date: '2026-09-14',
  description: 'Номера и койко-места на одной сетке',
};

describe('parsePost', () => {
  it('reads a valid post; slug is the file name', () => {
    expect(parsePost('content/blog/kak-ustroena-shakhmatka.md', article(validFields))).toEqual({
      slug: 'kak-ustroena-shakhmatka',
      title: 'Как устроена шахматка',
      date: '2026-09-14',
      description: 'Номера и койко-места на одной сетке',
      draft: false,
      body: 'Текст статьи.',
    });
  });

  it('accepts CRLF line endings, a BOM, quoted values and colons inside values', () => {
    const source =
      `\uFEFF${article({ ...validFields, title: '"Каналы: как приходят брони"', draft: 'false' })}`.replace(
        /\n/g,
        '\r\n',
      );
    const post = parsePost('kanaly.md', source);
    expect(post.title).toBe('Каналы: как приходят брони');
    expect(post.draft).toBe(false);
    expect(post.body).toBe('Текст статьи.');
  });

  it('throws naming the file when a required field is missing or empty', () => {
    const withoutDescription = { title: validFields.title, date: validFields.date };
    expect(() => parsePost('content/blog/no-description.md', article(withoutDescription))).toThrow(
      /content\/blog\/no-description\.md: нет обязательного поля «description»/,
    );
    expect(() => parsePost('empty-title.md', article({ ...validFields, title: '' }))).toThrow(
      /empty-title\.md: поле «title» пустое/,
    );
  });

  it('throws naming the file on a bad date', () => {
    expect(() => parsePost('bad-date.md', article({ ...validFields, date: '14.09.2026' }))).toThrow(
      /bad-date\.md: поле «date»/,
    );
    expect(() => parsePost('feb-30.md', article({ ...validFields, date: '2026-02-30' }))).toThrow(
      /feb-30\.md: поле «date»/,
    );
    expect(isIsoDate('2028-02-29')).toBe(true);
    expect(isIsoDate('2026-9-14')).toBe(false);
  });

  it('rejects unknown fields, so a typo in draft cannot publish a draft', () => {
    expect(() => parsePost('typo.md', article({ ...validFields, drat: 'true' }))).toThrow(
      /typo\.md: строка 5: неизвестное поле «drat»/,
    );
    expect(() => parsePost('draft-yes.md', article({ ...validFields, draft: 'yes' }))).toThrow(
      /draft-yes\.md: поле «draft» — true или false/,
    );
  });

  it('rejects files without front matter, unclosed front matter and non-latin slugs', () => {
    expect(() => parsePost('plain.md', '# Просто текст')).toThrow(
      /plain\.md: файл должен начинаться/,
    );
    expect(() => parsePost('open.md', '---\ntitle: Заголовок\n')).toThrow(
      /open\.md: блок полей не закрыт/,
    );
    expect(() => parsePost('Шахматка.md', article(validFields))).toThrow(/Шахматка\.md: имя файла/);
    expect(() => parsePost('Big-Letters.md', article(validFields))).toThrow(
      /Big-Letters\.md: имя файла/,
    );
  });

  it('requires text in a published post but allows an empty draft', () => {
    expect(() => parsePost('no-body.md', article(validFields, ''))).toThrow(
      /no-body\.md: после блока полей нет текста/,
    );
    expect(parsePost('stub.md', article({ ...validFields, draft: 'true' }, '')).draft).toBe(true);
  });
});

describe('publishedPosts', () => {
  it('excludes drafts and sorts newest first', () => {
    const posts = publishedPosts([
      { fileName: 'older.md', source: article({ ...validFields, date: '2026-09-01' }) },
      {
        fileName: 'draft.md',
        source: article({ ...validFields, date: '2026-09-20', draft: 'true' }),
      },
      { fileName: 'newer.md', source: article({ ...validFields, date: '2026-09-10' }) },
    ]);
    expect(posts.map((post) => post.slug)).toEqual(['newer', 'older']);
  });

  it('skips README.md (any case) and files that are not markdown', () => {
    const posts = parsePosts([
      { fileName: 'content/blog/README.md', source: '# Как писать статьи\n\nБез блока полей.' },
      { fileName: 'readme.md', source: 'тоже не статья' },
      { fileName: 'notes.txt', source: 'не статья' },
      { fileName: 'first.md', source: article(validFields) },
    ]);
    expect(posts.map((post) => post.slug)).toEqual(['first']);
  });
});

describe('content/blog in this repository', () => {
  it('parses every article and keeps the how-to draft unpublished', () => {
    const dir = blogDirectory();
    const all = parsePosts(readPostSources(dir));
    const howTo = all.find((post) => post.slug === 'kak-dobavit-statyu');
    expect(howTo?.draft).toBe(true);
    expect(getPublishedPosts(dir).map((post) => post.slug)).not.toContain('kak-dobavit-statyu');
  });
});
