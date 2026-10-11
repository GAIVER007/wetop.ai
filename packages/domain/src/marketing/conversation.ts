import { parseAssistantText, type AssistantPayload, type PlanQuestion, type SiteAiMode } from './builder';

/**
 * «Мозг разговора» конструктора сайта (доводка MKT9.2, `docs/marketing/licensed-site-builder-v0.md` §4.1).
 *
 * История для модели: прошлые успешные ходы ЭТОГО сайта, которые собирает воркер из своей базы (браузер историю не
 * присылает), без текущего запроса. Не больше 12 ходов и 16 000 знаков канонической записи; обрезается только целыми
 * ходами с самых старых, строки не режутся.
 *
 * Ответ на вопросы плана: каждый вопрос родительской задачи ровно один раз, вариант из списка или свой (если вопрос
 * это разрешает, до 400 знаков). Новая задача плана хранит самодостаточный запрос: исходная просьба, точные вопросы и
 * ответы. Поэтому ход PLAN с вопросами в историю модели не идёт: его содержимое уже в ответе на него (одно повторение,
 * не два).
 */
export const ASSISTANT_HISTORY_MAX_TURNS = 12;
export const ASSISTANT_HISTORY_MAX_CHARS = 16_000;
export const PLAN_ANSWER_MAX = 400;
/** Что видит модель на месте ответа успешной сборки: результат словами, без версии и без сырого ответа */
export const BUILD_HISTORY_REPLY = 'Изменение применено к сайту';

export interface AssistantHistoryItem {
  mode: SiteAiMode | 'BUILD';
  userText: string;
  assistantText: string | null;
  payload: AssistantPayload | null;
}

/** Длина канонической записи истории в символах (а не в байтах и не в половинках суррогатных пар) */
export function historyChars(items: AssistantHistoryItem[]): number {
  return [...JSON.stringify(items)].length;
}

/**
 * Самые новые целые ходы, которые влезают в оба предела, в порядке от старых к новым. Вход тоже от старых к новым.
 * Первый же ход, который не влезает, останавливает отбор: история остаётся сплошной, без пропусков в середине
 */
export function boundAssistantHistory(chronological: AssistantHistoryItem[]): AssistantHistoryItem[] {
  const kept: AssistantHistoryItem[] = [];
  let chars = 2; // скобки массива
  for (let i = chronological.length - 1; i >= 0 && kept.length < ASSISTANT_HISTORY_MAX_TURNS; i -= 1) {
    const item = chronological[i]!;
    const size = [...JSON.stringify(item)].length + (kept.length ? 1 : 0);
    if (chars + size > ASSISTANT_HISTORY_MAX_CHARS) break;
    chars += size;
    kept.unshift(item);
  }
  return kept;
}

export interface PlanAnswer {
  questionId: string;
  answer: string;
}

export type PlanAnswersResult = { ok: true; answers: PlanAnswer[] } | { ok: false; message: string };

/** Ответы человека на вопросы родительского плана: в порядке вопросов, по одному на каждый */
export function parsePlanAnswers(raw: unknown, questions: PlanQuestion[]): PlanAnswersResult {
  if (!Array.isArray(raw) || raw.length !== questions.length)
    return { ok: false, message: `answers: ответ на каждый из ${questions.length} вопросов ровно один раз` };
  const byId = new Map(questions.map((q) => [q.id, q]));
  const seen = new Map<string, string>();
  for (const [i, item] of raw.entries()) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return { ok: false, message: `answers[${i}]: объект` };
    const extra = Object.keys(item).filter((key) => key !== 'questionId' && key !== 'answer');
    if (extra.length) return { ok: false, message: `answers[${i}]: лишние поля ${extra.join(', ')}` };
    const { questionId, answer } = item as Record<string, unknown>;
    const question = typeof questionId === 'string' ? byId.get(questionId) : undefined;
    if (!question) return { ok: false, message: `answers[${i}].questionId: такого вопроса в плане нет` };
    if (seen.has(question.id)) return { ok: false, message: `answers[${i}].questionId: вопрос «${question.id}» уже отвечен` };
    const text = parseAssistantText(answer, false);
    if (!text.ok || !text.value || [...text.value].length > PLAN_ANSWER_MAX)
      return { ok: false, message: `answers[${i}].answer: от 1 до ${PLAN_ANSWER_MAX} знаков` };
    if (!question.options.includes(text.value) && !question.allowCustom)
      return { ok: false, message: `answers[${i}].answer: выберите один из вариантов вопроса «${question.id}»` };
    seen.set(question.id, text.value);
  }
  return { ok: true, answers: questions.map((q) => ({ questionId: q.id, answer: seen.get(q.id)! })) };
}

/** Самодостаточный запрос новой задачи плана: исходная просьба, точные вопросы, ответы и (если есть) дополнение */
export function planFollowUpText(parentUserText: string, questions: PlanQuestion[], answers: PlanAnswer[], extra: string | null): string {
  const parts = [
    `Исходный запрос:\n${parentUserText}`,
    `Уточняющие вопросы:\n${questions.map((q) => `${q.id}: ${q.question}`).join('\n')}`,
    `Ответы:\n${answers.map((a) => `${a.questionId}: ${a.answer}`).join('\n')}`,
  ];
  if (extra) parts.push(`Дополнение:\n${extra}`);
  return parts.join('\n\n');
}
