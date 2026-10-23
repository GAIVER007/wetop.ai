import { describe, expect, it } from 'vitest';
import { bookingPreview, setupCountLine, setupPath } from './setup-path';

const steps = (done: boolean[]) =>
  ['services', 'masters', 'skills', 'schedule'].map((id, i) => ({
    id,
    done: done[i]!,
    count: done[i] ? i + 1 : 0,
    reason: `причина ${id}`,
  }));

/** Вариант B первичной настройки (решение владельца 21.10.2026): путь из 5 шагов и превью онлайн-записи */
describe('путь настройки салона', () => {
  it('пока не сохранены сведения о салоне, текущий шаг первый, остальные дальше', () => {
    const rows = setupPath({ profileApplied: false, steps: steps([false, false, false, false]) });
    expect(rows.map((r) => r.id)).toEqual(['profile', 'services', 'masters', 'skills', 'schedule']);
    expect(rows.map((r) => r.status)).toEqual(['current', 'todo', 'todo', 'todo', 'todo']);
  });
  it('текущий это первый невыполненный шаг, выполненные отмечены', () => {
    const rows = setupPath({ profileApplied: true, steps: steps([true, true, false, false]) });
    expect(rows.map((r) => r.status)).toEqual(['done', 'done', 'done', 'current', 'todo']);
  });
  it('шаг без права на действие помечен, но не мешает следующему стать текущим', () => {
    const rows = setupPath({
      profileApplied: true,
      steps: steps([false, false, false, false]),
      permissions: { services: false, masters: true, skills: true, schedule: true },
    });
    expect(rows[1]!.status).toBe('locked');
    expect(rows[2]!.status).toBe('current');
  });
  it('всё сделано: текущего шага нет', () => {
    const rows = setupPath({ profileApplied: true, steps: steps([true, true, true, true]) });
    expect(rows.every((r) => r.status === 'done')).toBe(true);
  });
});

describe('превью онлайн-записи из данных салона', () => {
  const service = (name: string, enabled: boolean, extra: Record<string, unknown> = {}) => ({
    id: name,
    name,
    durationMinutes: 60,
    priceMinor: '800000',
    currency: 'KZT',
    active: true,
    location: { enabled, priceOverrideMinor: null, durationOverrideMinutes: null },
    ...extra,
  });
  it('только услуги, включённые в филиале, с ценой филиала, не больше четырёх', () => {
    const p = bookingPreview(
      [
        service('Стрижка', true, { location: { enabled: true, priceOverrideMinor: '900000', durationOverrideMinutes: 45 } }),
        service('Маникюр', false),
        service('Архив', true, { active: false }),
        ...['А', 'Б', 'В', 'Г'].map((n) => service(n, true)),
      ],
      [],
      'loc',
    );
    expect(p.services).toHaveLength(4);
    expect(p.services[0]).toEqual({ name: 'Стрижка', minutes: 45, price: '9 000 ₸' });
    expect(p.services.map((s) => s.name)).not.toContain('Маникюр');
    expect(p.moreServices).toBe(1);
  });
  it('мастера этого филиала, кроме других сотрудников, инициалы', () => {
    const p = bookingPreview(
      [],
      [
        { id: '1', name: 'Айгерим Тестова', active: true, locationIds: ['loc'], serviceIds: [], personnelKind: 'SPECIALIST' },
        { id: '2', name: 'Администратор', active: true, locationIds: ['loc'], serviceIds: [], personnelKind: 'OTHER_EMPLOYEE' },
        { id: '3', name: 'Чужой филиал', active: true, locationIds: ['other'], serviceIds: [], personnelKind: null },
        { id: '4', name: 'Сауле', active: true, locationIds: ['loc'], serviceIds: [], personnelKind: null },
      ],
      'loc',
    );
    expect(p.masters).toEqual([
      { name: 'Айгерим Тестова', initials: 'АТ' },
      { name: 'Сауле', initials: 'С' },
    ]);
  });
});

describe('итог выполненного шага словами (аудит салона 22.10.2026)', () => {
  it('без технических слов «пригодных сочетаний»', () => {
    expect(setupCountLine('schedule', 8)).toBe('Можно записаться: 8 вариантов услуги и мастера');
    expect(setupCountLine('schedule', 1)).toBe('Можно записаться: 1 вариант услуги и мастера');
    expect(setupCountLine('services', 3)).toBe('Услуг в филиале: 3');
    expect(setupCountLine('masters', 2)).toBe('Мастеров: 2');
    expect(setupCountLine('skills', 5)).toBe('Услуг назначено мастерам: 5');
  });
});
