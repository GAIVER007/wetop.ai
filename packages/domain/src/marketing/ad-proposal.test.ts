import { describe, expect, it } from 'vitest';
import { normalizeAdProposal } from './ad-proposal';

/**
 * Ответ ИИ-таргетолога (ADR-MKT-LAUNCH, `ad-proposal/0`) проходит правила домена: модель советует, код решает.
 * Тексты вымышленные (ADR-010).
 */
const good = {
  headline: 'Осень у моря',
  primaryText: 'Номер с видом на горы и завтрак. Напишите, подберём даты.',
  description: null,
  ageMin: 25,
  ageMax: 54,
  genders: [],
  interests: ['путешествия', 'горы'],
  welcomeMessage: 'Здравствуйте! Подскажем свободные даты',
  autofill: 'Хочу узнать цены',
  notes: ['широкая аудитория'],
};

describe('предложение ИИ-таргетолога: правила домена', () => {
  it('годный ответ проходит как есть, приветствие у переписки', () => {
    expect(normalizeAdProposal(good, 'WHATSAPP')).toEqual({
      headline: 'Осень у моря',
      primaryText: 'Номер с видом на горы и завтрак. Напишите, подберём даты.',
      description: null,
      ageMin: 25,
      ageMax: 54,
      genders: [],
      interests: ['путешествия', 'горы'],
      welcome: { text: 'Здравствуйте! Подскажем свободные даты', autofill: 'Хочу узнать цены' },
      notes: ['широкая аудитория'],
    });
  });

  it('форма заявок и сайт: приветствия нет, даже если модель его написала', () => {
    expect(normalizeAdProposal(good, 'LEAD_FORM').welcome).toBeNull();
    expect(normalizeAdProposal(good, 'WEBSITE').welcome).toBeNull();
  });

  it('возраст в 18–65, перевёрнутый меняется местами, не число: широкая аудитория', () => {
    expect(normalizeAdProposal({ ...good, ageMin: 12, ageMax: 90 }, 'WHATSAPP')).toMatchObject({
      ageMin: 18,
      ageMax: 65,
    });
    expect(normalizeAdProposal({ ...good, ageMin: 50, ageMax: 30 }, 'WHATSAPP')).toMatchObject({
      ageMin: 30,
      ageMax: 50,
    });
    expect(normalizeAdProposal({ ...good, ageMin: '25', ageMax: 40.5 }, 'WHATSAPP')).toMatchObject({
      ageMin: 18,
      ageMax: 65,
    });
  });

  it('пол: только [], [1] или [2]; прочее значит все', () => {
    expect(normalizeAdProposal({ ...good, genders: [2] }, 'WHATSAPP').genders).toEqual([2]);
    expect(normalizeAdProposal({ ...good, genders: [1, 2] }, 'WHATSAPP').genders).toEqual([]);
    expect(normalizeAdProposal({ ...good, genders: ['female'] }, 'WHATSAPP').genders).toEqual([]);
  });

  it('длины по пределам Meta и экрана; длинное тире убирается; лишние интересы и пояснения отрезаются', () => {
    const p = normalizeAdProposal(
      {
        ...good,
        headline: 'Очень длинный заголовок, который не влезет в сорок знаков',
        primaryText: 'Текст \u2014 с тире',
        interests: ['a', 'b', 'c', 'd', 'e', 'f'],
        notes: ['1', '2', '3', '4'],
      },
      'WHATSAPP',
    );
    expect(p.headline.length).toBeLessThanOrEqual(40);
    expect(p.primaryText).toBe('Текст, с тире');
    expect(p.interests).toHaveLength(5);
    expect(p.notes).toHaveLength(3);
  });

  it('без заголовка или текста предложения нет: модель не ответила по схеме', () => {
    expect(() => normalizeAdProposal({ ...good, headline: '  ' }, 'WHATSAPP')).toThrow(/заголов/);
    expect(() => normalizeAdProposal({ ...good, primaryText: 42 }, 'WHATSAPP')).toThrow(/текст/);
    expect(() => normalizeAdProposal('строка', 'WHATSAPP')).toThrow();
  });
});
