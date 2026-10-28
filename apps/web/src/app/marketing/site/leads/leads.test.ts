import { describe, expect, it } from 'vitest';
import { featureVerticals, ALL_VERTICALS } from '../../../../lib/features';
import { LEAD_NEXT, leadFilter } from './lead-flow';

/** «Заявки с сайта» (аудит «Сайт и SEO» 28.10.2026, S3): экран у всех направлений, порядок статусов */
describe('заявки с сайта', () => {
  it('экран открыт всем трём направлениям', () => {
    expect([...featureVerticals('/marketing/site/leads')].sort()).toEqual([...ALL_VERTICALS].sort());
  });
  it('новую берут в работу или в спам, в работе закрывают, закрытую и спам возвращают', () => {
    expect(LEAD_NEXT.NEW).toEqual(['IN_PROGRESS', 'SPAM']);
    expect(LEAD_NEXT.IN_PROGRESS).toEqual(['DONE']);
    expect(LEAD_NEXT.DONE).toEqual(['NEW']);
    expect(LEAD_NEXT.SPAM).toEqual(['NEW']);
  });
  it('фильтр из адреса: чужое значение значит «Новые»', () => {
    expect(leadFilter(undefined)).toBe('NEW');
    expect(leadFilter('DONE')).toBe('DONE');
    expect(leadFilter('DROP TABLE')).toBe('NEW');
  });
});
