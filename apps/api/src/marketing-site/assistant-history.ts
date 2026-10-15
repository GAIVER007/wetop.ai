import {
  BUILD_HISTORY_REPLY,
  boundAssistantHistory,
  type AssistantHistoryItem,
  type AssistantPayload,
} from '@pms/domain';
import type { Db, DbTx } from '@pms/database';
import { runUserText } from './generation.service';

/**
 * История разговора для модели (доводка MKT9.2, `docs/marketing/licensed-site-builder-v0.md` §4.1). Источник только
 * база и только этот сайт: `site_id` текущей задачи, без организации, других филиалов, продавца и журнала. Берутся
 * успешные ходы до текущей задачи: разговоры (Чат, План с планом, Оформление) и сборки (текст человека и «Изменение
 * применено к сайту»). Упавшие ходы и упавшие сборки не берутся: модель не должна считать их выполненными. Ход PLAN с
 * вопросами не берётся: ответ на него сам несёт исходную просьбу, вопросы и ответы (одно повторение, не два).
 * Промпты, сырые ответы модели, тексты ошибок и журнал в историю не попадают по построению: их нет в выборке
 */
// больше предела в 12 ходов: часть строк отсеется (вопросы плана), а предел знаков решит домен
const SCAN = 40;
const BUILD_WITHOUT_WISHES = 'Собери сайт по данным филиала';

export async function siteAssistantHistory(db: Db | DbTx, run: { id: string; siteId: string; createdAt: Date }): Promise<AssistantHistoryItem[]> {
  const before = { lt: run.createdAt };
  const [talks, builds] = await Promise.all([
    db.siteAiRun.findMany({
      where: { siteId: run.siteId, status: 'SUCCEEDED', createdAt: before, id: { not: run.id } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: SCAN,
      select: { id: true, mode: true, userText: true, assistantText: true, payload: true, createdAt: true },
    }),
    db.generationRun.findMany({
      where: { siteId: run.siteId, status: 'SUCCEEDED', createdAt: before },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: SCAN,
      select: { id: true, type: true, instruction: true, createdAt: true },
    }),
  ]);
  const turns: Array<{ at: Date; id: string; item: AssistantHistoryItem }> = [];
  for (const t of talks) {
    const payload = (t.payload ?? null) as AssistantPayload | null;
    if (payload?.kind === 'QUESTIONS') continue;
    turns.push({ at: t.createdAt, id: t.id, item: { mode: t.mode, userText: t.userText, assistantText: t.assistantText, payload } });
  }
  for (const b of builds) {
    const text = runUserText(b.type, b.instruction)?.trim() || BUILD_WITHOUT_WISHES;
    turns.push({ at: b.createdAt, id: b.id, item: { mode: 'BUILD', userText: text, assistantText: BUILD_HISTORY_REPLY, payload: null } });
  }
  turns.sort((a, b) => a.at.getTime() - b.at.getTime() || a.id.localeCompare(b.id));
  return boundAssistantHistory(turns.map((t) => t.item));
}
