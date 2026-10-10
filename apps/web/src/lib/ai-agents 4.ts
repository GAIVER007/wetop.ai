import {
  CHANNEL_LABELS,
  READ_ONLY_MESSAGE,
  channelWord,
  type AgentChannel,
  type AgentStatus,
  type ChannelState,
} from '@pms/domain';
import type { AgentCardView, AgentCatalogView } from './api';

/**
 * Слова и кнопки каталога «ИИ-агентов» (SA1, plans/business-ai-seller-v2-2026-09-29.md §8). Только то, что видно в
 * данных сегодня; хранимого состояния агента и второго продавца в организации пока нет.
 */

export interface CreateButton {
  label: string;
  /** Куда ведёт активная кнопка; `null` — кнопка неактивна */
  href: string | null;
  /** Почему неактивна */
  reason: string | null;
  /** Расширения нет или оно истекло: рядом ссылка «Как подключить» на страницу с объяснением (Q-SA-1) */
  connectHref: string | null;
}

export const CREATE_LABEL = '+ Подключить AI-продавца';

/**
 * Кнопка под списком (SA2, решение владельца 30.09): видна всегда, при невозможности — неактивна с причиной, а не спрятана.
 * Доступность и причину считает сервер (`catalog.create`); страница ничего не пересчитывает. Для расширения без действия
 * рядом остаётся ссылка на страницу с объяснением: самообслуживания и цены нет.
 */
export function createButton(catalog: AgentCatalogView, readOnly = false): CreateButton {
  // «только чтение» знает оболочка стойки, а не сервер раздела: запись всё равно отклонит `SessionGuard` до контроллера
  if (readOnly) return { label: CREATE_LABEL, href: null, reason: READ_ONLY_MESSAGE, connectHref: null };
  const access = catalog.extension?.access ?? 'off';
  const connectHref = access === 'off' || access === 'expired' ? '/ai-seller' : null;
  if (catalog.create.enabled) return { label: CREATE_LABEL, href: '/ai-agents/new', reason: null, connectHref };
  return { label: CREATE_LABEL, href: null, reason: catalog.create.reason, connectHref };
}

/** Куда ведёт «Открыть»: рабочий продавец — в свой раздел, агент с филиалом — на страницу состояния, черновик мастера — в его редактор */
export function agentHref(agent: AgentCardView): string {
  if (agent.kind === 'seller') return '/ai-seller';
  return agent.kind === 'agent' ? `/ai-agents/${agent.id}` : `/ai-seller/agents/${agent.id}`;
}

/** Business и Location карточки одной строкой; у черновика мастера их нет, у организации без объекта — тоже */
export function placement(business: { name: string }, location: { name: string }): string {
  return `${business.name} · ${location.name}`;
}

export function placementLine(agent: AgentCardView): string {
  if (agent.business && agent.location) return placement(agent.business, agent.location);
  return agent.kind === 'draft' ? 'Business и Location не выбраны' : 'Объект ещё не создан';
}

export function channelLines(
  agent: AgentCardView,
): Array<{ label: string; word: string; state: ChannelState }> {
  if (!agent.channels) return [];
  return (['site', 'whatsapp'] as AgentChannel[]).map((channel) => {
    const state = agent.channels![channel];
    return { label: CHANNEL_LABELS[channel], word: channelWord(channel, state), state };
  });
}

export type StatusTone = 'ok' | 'warn' | 'danger' | 'neutral';

export function statusTone(status: AgentStatus): StatusTone {
  if (status === 'WORKING') return 'ok';
  if (status === 'BOT_OFFLINE') return 'danger';
  if (status === 'DRAFT') return 'neutral';
  return 'warn';
}
