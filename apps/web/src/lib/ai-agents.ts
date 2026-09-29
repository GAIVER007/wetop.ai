import {
  CHANNEL_LABELS,
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

/** Второго рабочего продавца в организации нет: он один на организацию, несколько — следующий этап (Q-SA-4) */
export const SECOND_SELLER_REASON =
  'В организации пока один AI-продавец. Несколько — следующий этап.';

export type CatalogButton =
  | { label: string; href: string }
  | { label: string; href: null; reason: string };

/**
 * Кнопка под списком. Сотруднику смены её нет: настройки продавца — владелец и управляющий (ADR-107). Расширение не
 * подключено — на страницу-объяснение, самообслуживания и цены нет (Q-SA-1); срок вышел — то же место, где видна дата.
 */
export function catalogButton(catalog: AgentCatalogView): CatalogButton | null {
  if (!catalog.canManage) return null;
  const access = catalog.extension?.access ?? 'off';
  if (access === 'off') return { label: 'Подключить', href: '/ai-seller' };
  if (access === 'expired') return { label: 'Возобновить', href: '/ai-seller' };
  const seller = catalog.agents.find((a) => a.kind === 'seller');
  if (!seller || seller.status === 'NOT_CONFIGURED' || seller.status === 'BOT_OFFLINE')
    return { label: 'Настроить', href: '/ai-seller' };
  return { label: '+ Подключить AI-продавца', href: null, reason: SECOND_SELLER_REASON };
}

/** Business и Location карточки одной строкой; у черновика их нет, у организации без объекта — тоже */
export function placementLine(agent: AgentCardView): string {
  if (agent.business && agent.location) return `${agent.business.name} · ${agent.location.name}`;
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
