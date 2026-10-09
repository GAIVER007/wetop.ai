import { describe, expect, it } from 'vitest';
import type { PlanQuestion } from './builder';
import {
  ASSISTANT_HISTORY_MAX_CHARS,
  ASSISTANT_HISTORY_MAX_TURNS,
  boundAssistantHistory,
  historyChars,
  parsePlanAnswers,
  planFollowUpText,
  type AssistantHistoryItem,
} from './conversation';

/**
 * Доводка MKT9.2: «мозг разговора». История для модели собирается платформой из своей базы, ограничена по ходам и
 * знакам и обрезается только целыми ходами; ответ на вопросы плана сверяется с вопросами родительской задачи и
 * превращается в самодостаточный запрос.
 */
const turn = (n: number, size = 10): AssistantHistoryItem => ({
  mode: 'CHAT',
  userText: `вопрос ${n} ${'я'.repeat(size)}`,
  assistantText: `ответ ${n}`,
  payload: null,
});

describe('история разговора для модели', () => {
  it('порядок от старых к новым сохраняется, короткая история целиком', () => {
    const items = [turn(1), turn(2), turn(3)];
    expect(boundAssistantHistory(items)).toEqual(items);
  });

  it('не больше 12 ходов: остаются самые новые', () => {
    const items = Array.from({ length: 20 }, (_, i) => turn(i + 1));
    const kept = boundAssistantHistory(items);
    expect(kept).toHaveLength(ASSISTANT_HISTORY_MAX_TURNS);
    expect(kept[0]!.userText).toMatch(/^вопрос 9 /);
    expect(kept.at(-1)!.userText).toMatch(/^вопрос 20 /);
  });

  it('не больше 16 000 знаков канонической записи: целые новые ходы, строка не режется', () => {
    const items = Array.from({ length: 6 }, (_, i) => turn(i + 1, 3900));
    const kept = boundAssistantHistory(items);
    expect(historyChars(kept)).toBeLessThanOrEqual(ASSISTANT_HISTORY_MAX_CHARS);
    expect(kept.length).toBeLessThan(6);
    expect(kept.at(-1)).toEqual(items.at(-1));
    for (const k of kept) expect(items).toContainEqual(k);
    // знаки считаются по символам, а не по байтам и не по половинкам пар
    expect(historyChars([{ mode: 'CHAT', userText: '😀', assistantText: null, payload: null }])).toBe(
      [...JSON.stringify([{ mode: 'CHAT', userText: '😀', assistantText: null, payload: null }])].length,
    );
  });

  it('ход, который один больше предела, и всё старше него отбрасываются: нового «дыра» не бывает', () => {
    const huge = { mode: 'CHAT' as const, userText: 'я'.repeat(4000), assistantText: 'о'.repeat(12000), payload: null };
    const kept = boundAssistantHistory([turn(1), huge, turn(3)]);
    expect(kept).toEqual([turn(3)]);
  });

  it('одинаковый вход даёт одинаковый результат', () => {
    const items = Array.from({ length: 15 }, (_, i) => turn(i + 1, 1500));
    expect(boundAssistantHistory(items)).toEqual(boundAssistantHistory(items));
  });
});

const QUESTIONS: PlanQuestion[] = [
  { id: 'tone', question: 'Какой тон?', options: ['Спокойный', 'Яркий'], allowCustom: false },
  { id: 'audience', question: 'Для кого сайт?', options: ['Туристы', 'Бизнес-путешественники'], allowCustom: true },
];

describe('ответы на вопросы плана', () => {
  it('каждый вопрос ровно один раз, вариант из списка или свой, если можно', () => {
    const ok = parsePlanAnswers(
      [
        { questionId: 'tone', answer: 'Спокойный' },
        { questionId: 'audience', answer: 'Семьи с детьми' },
      ],
      QUESTIONS,
    );
    expect(ok).toEqual({
      ok: true,
      answers: [
        { questionId: 'tone', answer: 'Спокойный' },
        { questionId: 'audience', answer: 'Семьи с детьми' },
      ],
    });
  });

  it('незнакомый вопрос, повтор, пропуск и лишние поля отклоняются', () => {
    const bad = [
      [{ questionId: 'budget', answer: 'Мало' }, { questionId: 'tone', answer: 'Яркий' }],
      [{ questionId: 'tone', answer: 'Яркий' }, { questionId: 'tone', answer: 'Спокойный' }],
      [{ questionId: 'tone', answer: 'Яркий' }],
      [
        { questionId: 'tone', answer: 'Яркий', extra: 1 },
        { questionId: 'audience', answer: 'Туристы' },
      ],
      'tone: Яркий',
      [],
    ];
    for (const raw of bad) expect(parsePlanAnswers(raw, QUESTIONS).ok).toBe(false);
  });

  it('свой ответ без allowCustom отклоняется; свой ответ длиннее 400 знаков отклоняется', () => {
    expect(
      parsePlanAnswers(
        [
          { questionId: 'tone', answer: 'Космический' },
          { questionId: 'audience', answer: 'Туристы' },
        ],
        QUESTIONS,
      ).ok,
    ).toBe(false);
    expect(
      parsePlanAnswers(
        [
          { questionId: 'tone', answer: 'Яркий' },
          { questionId: 'audience', answer: 'я'.repeat(401) },
        ],
        QUESTIONS,
      ).ok,
    ).toBe(false);
  });

  it('запрос ответа самодостаточен: исходная просьба, точные вопросы и ответы', () => {
    const text = planFollowUpText(
      'Сделай сайт более премиальным',
      QUESTIONS,
      [
        { questionId: 'tone', answer: 'Спокойный' },
        { questionId: 'audience', answer: 'Бизнес-путешественники' },
      ],
      null,
    );
    expect(text).toBe(
      [
        'Исходный запрос:',
        'Сделай сайт более премиальным',
        '',
        'Уточняющие вопросы:',
        'tone: Какой тон?',
        'audience: Для кого сайт?',
        '',
        'Ответы:',
        'tone: Спокойный',
        'audience: Бизнес-путешественники',
      ].join('\n'),
    );
    expect(planFollowUpText('Запрос', QUESTIONS.slice(0, 1), [{ questionId: 'tone', answer: 'Яркий' }], 'Без восклицаний')).toMatch(
      /\n\nДополнение:\nБез восклицаний$/,
    );
  });
});
