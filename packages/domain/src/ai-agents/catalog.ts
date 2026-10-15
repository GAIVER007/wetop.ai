import type { ExtensionAccess } from '../accounts/extensions';

/**
 * Каталог Business Agents (SA1, plans/business-ai-seller-v2-2026-09-29.md §8.1). Статус карточки считается из того,
 * что уже есть, и нигде не хранится: хранимое состояние агента (`TESTING`, `PAUSED`, `ERROR`) вводит SA9, а здесь
 * показывается только то, что видно в данных сегодня.
 */

/** `DRAFT`, запись гостевого мастера (`seller_agents`), продавец по ней не запущен */
export type AgentStatus =
  | 'WORKING'
  | 'NOT_CONFIGURED'
  | 'BOT_OFFLINE'
  | 'SUBSCRIPTION_INACTIVE'
  | 'DRAFT';

export const AGENT_STATUS_WORDS: Record<AgentStatus, string> = {
  WORKING: 'Работает',
  NOT_CONFIGURED: 'Не настроен',
  BOT_OFFLINE: 'Бот не подключён',
  SUBSCRIPTION_INACTIVE: 'Подписка не активна',
  DRAFT: 'Черновик',
};

/**
 * Статус рабочего продавца организации. `null`, расширение не подключено: карточки нет, вместо неё объяснение.
 * «Работает» значит «расширение действует и продавец принял профиль»; готовность каналов в него не входит.
 */
export function agentStatus(input: {
  extension: ExtensionAccess;
  /** `not-configured`, у платформы нет адреса и ключа бота (`SellerStatus.connection`) */
  connection: 'ready' | 'not-configured';
  /** Продавец принял текущую версию профиля */
  profileApplied: boolean;
}): AgentStatus | null {
  if (input.extension === 'off') return null;
  if (input.extension === 'expired') return 'SUBSCRIPTION_INACTIVE';
  if (input.connection === 'not-configured') return 'BOT_OFFLINE';
  return input.profileApplied ? 'WORKING' : 'NOT_CONFIGURED';
}

/** `UNKNOWN`, данных нет: бот не ответил вовремя. Состояний `VERIFYING`/`ERROR` у канала пока нет (SA6) */
export type ChannelState = 'ON' | 'OFF' | 'UNKNOWN';
export type AgentChannel = 'site' | 'whatsapp';

const CHANNEL_WORDS: Record<AgentChannel, Record<ChannelState, string>> = {
  site: { ON: 'Домены заданы', OFF: 'Не заданы', UNKNOWN: 'Нет данных' },
  whatsapp: { ON: 'Подключён', OFF: 'Не подключён', UNKNOWN: 'Нет данных' },
};

export const CHANNEL_LABELS: Record<AgentChannel, string> = { site: 'Сайт', whatsapp: 'WhatsApp' };

export const channelWord = (channel: AgentChannel, state: ChannelState): string =>
  CHANNEL_WORDS[channel][state];
