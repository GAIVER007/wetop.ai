import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BOOKMARK_LABEL_MAX,
  SITE_AI_PAYLOAD_MAX_BYTES,
  applyDesignDirection,
  bootstrapSlug,
  decodeDesignInstruction,
  designInstructionText,
  encodeDesignInstruction,
  inlineTextTargets,
  parseAssistantResult,
  parseBookmarkLabel,
  parseBuilderInstructions,
  setInlineText,
  siteBuilderAccess,
  siteBuilderDenied,
  type DesignDirection,
} from './builder';
import { GENERATION_ERROR_TEXT, generationRetry, isGenerationErrorCode } from './generation';
import { validateSiteSpec } from './site-spec';

const SPEC = JSON.parse(readFileSync(resolve(__dirname, '../../../../docs/marketing/sitespec-v0.example.json'), 'utf8'));
const now = new Date('2026-10-08T07:00:00Z');

describe('лицензия конструктора сайта (MKT9.2)', () => {
  it('действует пробная и оплаченная до срока; вышел срок: только чтение; выключена или нет: закрыто', () => {
    expect(siteBuilderAccess({ status: 'ACTIVE', activeUntil: null }, now)).toBe('active');
    expect(siteBuilderAccess({ status: 'TRIAL', activeUntil: new Date('2026-10-09T00:00:00Z') }, now)).toBe('active');
    expect(siteBuilderAccess({ status: 'TRIAL', activeUntil: new Date('2026-10-08T07:00:00Z') }, now)).toBe('expired');
    expect(siteBuilderAccess({ status: 'ACTIVE', activeUntil: new Date('2026-10-01T00:00:00Z') }, now)).toBe('expired');
    expect(siteBuilderAccess({ status: 'OFF', activeUntil: null }, now)).toBe('off');
    expect(siteBuilderAccess(null, now)).toBe('off');
  });

  it('отказ называет причину кодом и словами', () => {
    expect(siteBuilderDenied('off')).toEqual({ code: 'SITE_BUILDER_NOT_ENABLED', message: 'Конструктор сайта не подключён для этого филиала' });
    expect(siteBuilderDenied('expired').code).toBe('SITE_BUILDER_EXPIRED');
    expect(siteBuilderDenied('expired').message).toMatch(/срок/i);
  });

  it('LICENSE_UNAVAILABLE: код задачи ИИ без повтора', () => {
    expect(isGenerationErrorCode('LICENSE_UNAVAILABLE')).toBe(true);
    expect(GENERATION_ERROR_TEXT.LICENSE_UNAVAILABLE).toMatch(/Конструктор сайта/);
    expect(generationRetry('LICENSE_UNAVAILABLE', 1, now)).toEqual({ retry: false });
  });
});

describe('адрес сайта при заведении (bootstrap)', () => {
  it('из имени филиала; занятый получает детерминированный суффикс', () => {
    expect(bootstrapSlug('Luxx Aparts', new Set())).toBe('luxx-aparts');
    expect(bootstrapSlug('Luxx Aparts', new Set(['luxx-aparts']))).toBe('luxx-aparts-2');
    expect(bootstrapSlug('Luxx Aparts', new Set(['luxx-aparts', 'luxx-aparts-2']))).toBe('luxx-aparts-3');
  });

  it('длинное имя обрезается так, чтобы суффикс влез в 40 знаков', () => {
    const name = 'Очень длинное название гостиницы у самого вокзала города';
    const base = bootstrapSlug(name, new Set());
    const next = bootstrapSlug(name, new Set([base]));
    expect(next.length).toBeLessThanOrEqual(40);
    expect(next).toMatch(/-2$/);
  });
});

describe('знания проекта и закладки', () => {
  it('знания: до 5000 знаков, пусто снимает', () => {
    expect(parseBuilderInstructions('  Пиши коротко  ')).toEqual({ ok: true, value: 'Пиши коротко' });
    expect(parseBuilderInstructions('')).toEqual({ ok: true, value: null });
    expect(parseBuilderInstructions('я'.repeat(5001)).ok).toBe(false);
    expect(parseBuilderInstructions(5).ok).toBe(false);
  });

  it('подпись закладки: обязательна и короче 120', () => {
    expect(parseBookmarkLabel(' Перед акцией ')).toEqual({ ok: true, value: 'Перед акцией' });
    expect(parseBookmarkLabel('').ok).toBe(false);
    expect(parseBookmarkLabel('я'.repeat(BOOKMARK_LABEL_MAX + 1)).ok).toBe(false);
  });
});

const direction = (over: Partial<DesignDirection> = {}): Record<string, unknown> => ({
  id: 'warm',
  name: 'Тёплый дом',
  shortDescription: 'Мягкие цвета и спокойный первый экран',
  theme: { preset: 'WARM', accent: 'TERRACOTTA', typography: 'CLASSIC', radius: 'ROUND', density: 'COMFORTABLE', colorScheme: 'LIGHT' },
  heroVariant: 'TEXT_ONLY',
  sectionOrder: ['hero', 'accommodations', 'about', 'booking'],
  ...over,
});

describe('ответ ассистента по режиму: строгая проверка платформой', () => {
  it('чат: ответ словами и подсказки, без лишних полей', () => {
    const r = parseAssistantResult('CHAT', { answer: 'Можно сделать короче первый экран.', suggestBuild: true, suggestPublish: false });
    expect(r).toEqual({ ok: true, assistantText: 'Можно сделать короче первый экран.', payload: { kind: 'CHAT', suggestBuild: true, suggestPublish: false } });
    expect(parseAssistantResult('CHAT', { answer: 'x', html: '<b>' }).ok).toBe(false);
    expect(parseAssistantResult('CHAT', { answer: '' }).ok).toBe(false);
    expect(parseAssistantResult('CHAT', { answer: 'я'.repeat(12001) }).ok).toBe(false);
  });

  it('план: до четырёх вопросов с вариантами', () => {
    const q = (id: string) => ({ id, question: 'Какой тон?', options: ['Строгий', 'Тёплый'], allowCustom: true });
    const ok = parseAssistantResult('PLAN', { kind: 'QUESTIONS', questions: [q('tone'), q('order')] });
    expect(ok.ok && ok.payload).toMatchObject({ kind: 'QUESTIONS', questions: [{ id: 'tone' }, { id: 'order' }] });
    expect(parseAssistantResult('PLAN', { kind: 'QUESTIONS', questions: [q('a'), q('b'), q('c'), q('d'), q('e')] }).ok).toBe(false);
    expect(parseAssistantResult('PLAN', { kind: 'QUESTIONS', questions: [q('a'), q('a')] }).ok).toBe(false);
    expect(parseAssistantResult('PLAN', { kind: 'QUESTIONS', questions: [{ ...q('a'), options: [] }] }).ok).toBe(false);
  });

  it('план: что меняется, шаги, компромиссы и инструкция сборки до 1800 знаков', () => {
    const plan = {
      kind: 'PLAN',
      summary: 'Сделать первый экран короче и поднять номера выше',
      affectedPages: ['page-home'],
      affectedSections: ['sec-hero', 'sec-rooms'],
      steps: ['Сократить заголовок', 'Переставить номера под первый экран'],
      tradeoffs: ['Раздел «О нас» опустится ниже'],
      buildInstruction: 'Сократи заголовок первого экрана и поставь номера сразу после него.',
    };
    const r = parseAssistantResult('PLAN', plan);
    expect(r.ok && r.assistantText).toBe(plan.summary);
    expect(parseAssistantResult('PLAN', { ...plan, buildInstruction: 'я'.repeat(1801) }).ok).toBe(false);
    expect(parseAssistantResult('PLAN', { ...plan, steps: [] }).ok).toBe(false);
    expect(parseAssistantResult('PLAN', { ...plan, publish: true }).ok).toBe(false);
  });

  it('оформление: ровно три направления только из перечислений SiteSpec, без кода, ссылок и картинок', () => {
    const three = [direction(), direction({ id: 'night' }), direction({ id: 'coast' })];
    const r = parseAssistantResult('DESIGN', { directions: three });
    expect(r.ok && (r.payload as { directions: unknown[] }).directions).toHaveLength(3);
    expect(parseAssistantResult('DESIGN', { directions: three.slice(0, 2) }).ok).toBe(false);
    expect(parseAssistantResult('DESIGN', { directions: [direction(), direction(), direction({ id: 'x' })] }).ok).toBe(false);
    const bad = (over: Record<string, unknown>) => parseAssistantResult('DESIGN', { directions: [direction(over as never), direction({ id: 'b' }), direction({ id: 'c' })] }).ok;
    expect(bad({ theme: { ...(direction().theme as object), preset: 'NEON' } })).toBe(false);
    expect(bad({ theme: { ...(direction().theme as object), css: 'body{}' } })).toBe(false);
    expect(bad({ heroVariant: 'VIDEO' })).toBe(false);
    expect(bad({ sectionOrder: ['hero', 'custom-html'] })).toBe(false);
    expect(bad({ sectionOrder: ['hero', 'hero'] })).toBe(false);
    expect(bad({ name: '<script>alert(1)</script>' })).toBe(false);
    expect(bad({ shortDescription: 'См. https://example.com' })).toBe(false);
    expect(bad({ imageAssetId: 'a' })).toBe(false);
  });

  it('структура ответа не больше 32 КиБ', () => {
    const plan = { kind: 'PLAN', summary: 's', affectedPages: [], affectedSections: [], steps: ['ш'], tradeoffs: [], buildInstruction: 'x' };
    const r = parseAssistantResult('PLAN', plan);
    expect(r.ok && Buffer.byteLength(JSON.stringify(r.payload))).toBeLessThan(SITE_AI_PAYLOAD_MAX_BYTES);
  });
});

describe('направление оформления: применение без ИИ и конверт первой сборки', () => {
  it('применяет тему, вариант первого экрана и порядок блоков главной; документ остаётся верным', () => {
    const d = parseAssistantResult('DESIGN', { directions: [direction(), direction({ id: 'b' }), direction({ id: 'c' })] });
    if (!d.ok) throw new Error('design');
    const chosen = (d.payload as { directions: DesignDirection[] }).directions[0]!;
    const next = applyDesignDirection(SPEC, chosen);
    expect(next.theme).toMatchObject({ preset: 'WARM', accent: 'TERRACOTTA', typography: 'CLASSIC', radius: 'ROUND' });
    const home = (next.pages as Array<{ isHome: boolean; sections: Array<{ type: string; variant: string }> }>).find((p) => p.isHome)!;
    const types = home.sections.map((s) => s.type);
    expect(types.indexOf('accommodations')).toBeLessThan(types.indexOf('about'));
    expect(home.sections.find((s) => s.type === 'hero')!.variant).toBe('TEXT_ONLY');
    expect(validateSiteSpec(next).ok).toBe(true);
    expect(SPEC.theme.preset).not.toBe('WARM');
  });

  it('вариант первого экрана с фото без фото в документе не ставится', () => {
    const noImage = structuredClone(SPEC);
    const hero = noImage.pages.find((p: { isHome: boolean }) => p.isHome).sections.find((s: { type: string }) => s.type === 'hero');
    hero.variant = 'TEXT_ONLY';
    delete hero.image;
    const next = applyDesignDirection(noImage, { ...(direction() as unknown as DesignDirection), heroVariant: 'IMAGE_FULL' });
    const nextHero = (next.pages as Array<{ isHome: boolean; sections: Array<{ type: string; variant: string }> }>)
      .find((p) => p.isHome)!
      .sections.find((s) => s.type === 'hero')!;
    expect(nextHero.variant).toBe('TEXT_ONLY');
  });

  it('конверт INITIAL: заголовок направления и пожелания; строгий разбор', () => {
    const d = direction() as unknown as DesignDirection;
    const raw = encodeDesignInstruction(d, 'Акцент на тишину');
    expect(raw.length).toBeLessThanOrEqual(2000);
    expect(decodeDesignInstruction(raw)).toEqual({ design: d, text: 'Акцент на тишину' });
    expect(decodeDesignInstruction(encodeDesignInstruction(d, null))).toEqual({ design: d, text: null });
    expect(decodeDesignInstruction('Просто пожелания')).toBeNull();
    expect(decodeDesignInstruction('{"v":1}\nтекст')).toBeNull();
    expect(designInstructionText({ design: d, text: 'Акцент' })).toMatch(/Тёплый дом/);
  });
});

describe('правка текста прямо на сайте: только разрешённые поля', () => {
  it('список целей: заголовки, тексты, подписи кнопок, меню и слоган; без цен, кодов, картинок и контактов', () => {
    const targets = inlineTextTargets(SPEC, 'ru');
    const paths = targets.map((t) => t.path);
    expect(paths).toContain('site.brand.tagline');
    expect(paths.some((p) => /^pages\[0\]\.sections\[\d+\]\.heading$/.test(p))).toBe(true);
    expect(paths.some((p) => p.endsWith('primaryAction.label'))).toBe(true);
    expect(paths.some((p) => p.startsWith('navigation.header['))).toBe(true);
    for (const p of paths) {
      expect(p).not.toMatch(/categoryCode|assetId|url|phone|email|address|price|seo|legal|slug|\.id$/);
    }
  });

  it('меняет только целевой текст на нужном языке, с пределом поля', () => {
    const target = inlineTextTargets(SPEC, 'ru').find((t) => t.path.endsWith('.heading'))!;
    const r = setInlineText(SPEC, target.path, 'ru', '  Новый заголовок  ');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(JSON.stringify(r.spec)).toContain('Новый заголовок');
    expect(validateSiteSpec(r.spec).ok).toBe(true);
    expect(setInlineText(SPEC, target.path, 'ru', 'я'.repeat(target.max + 1)).ok).toBe(false);
    expect(setInlineText(SPEC, target.path, 'ru', '   ').ok).toBe(false);
  });

  it('запрещённые пути отклоняются', () => {
    for (const path of ['site.contacts.phone', 'pages[0].slug', 'pages[0].sections[0].id', 'site.displayName', 'integrations.booking.mode', 'pages[0].sections[2].items[0].categoryCode'])
      expect(setInlineText(SPEC, path, 'ru', 'x').ok).toBe(false);
  });
});
