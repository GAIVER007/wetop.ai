import { describe, expect, it } from 'vitest';
import {
  kbActions,
  kbCategoryLabel,
  kbFilter,
  kbHref,
  kbStatusLabel,
  kbStatusTone,
  kbVisibilityLabel,
} from './support-kb';

describe('база знаний в кабинете (S3)', () => {
  it('слова: категория, видимость, статус; незнакомое — тире', () => {
    expect(kbCategoryLabel('KNOWN_ISSUE')).toBe('Известные проблемы');
    expect(kbVisibilityLabel('PLATFORM_ADMIN_ONLY')).toBe('Только администратор платформы');
    expect(kbStatusLabel('ACTIVE')).toBe('Отвечает');
    expect(kbStatusLabel('???')).toBe('—');
    expect(kbStatusLabel(null)).toBe('—');
  });

  it('тона: отвечает — ok, черновик — info, устарело — warn', () => {
    expect([kbStatusTone('ACTIVE'), kbStatusTone('DRAFT'), kbStatusTone('OUTDATED'), kbStatusTone('ARCHIVED')]).toEqual([
      'ok',
      'info',
      'warn',
      'neutral',
    ]);
  });

  it('действия по статусу: опубликовать — только у черновика, ACTIVE вручную не ставится', () => {
    expect(kbActions('DRAFT')).toContain('publish');
    for (const status of ['ACTIVE', 'OUTDATED', 'ARCHIVED']) expect(kbActions(status)).not.toContain('publish');
    expect(kbActions('ACTIVE')).toEqual(['outdated', 'archive']);
    expect(kbActions('OUTDATED')).toContain('draft');
    expect(kbActions('')).toEqual([]);
  });

  it('отбор из адреса: чужие значения отбрасываются, поиск режется', () => {
    expect(kbFilter({ status: 'ACTIVE', category: 'NOPE', visibility: 'PUBLIC_SUPPORT', q: '  стирка ' })).toEqual({
      status: 'ACTIVE',
      category: '',
      visibility: 'PUBLIC_SUPPORT',
      q: 'стирка',
    });
    expect(kbFilter({ q: 'я'.repeat(500) }).q).toHaveLength(200);
  });

  it('адрес каталога: пустые части не пишутся', () => {
    expect(kbHref({})).toBe('/platform/support/base');
    expect(kbHref({ status: 'DRAFT', id: 'abc', q: '' })).toBe('/platform/support/base?status=DRAFT&id=abc');
  });
});
