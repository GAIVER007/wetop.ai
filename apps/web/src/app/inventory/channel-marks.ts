import { channelsApi } from '../../lib/api';

export interface ChannelMark {
  key: string;
  title: string;
  mark: string;
}

/**
 * Каналы по возможности: внешний Channex или нехватка права не должны ронять экран фонда и панель места.
 * Привязка каналов в проекте идёт по категории, поэтому `mapped` это коды категорий с сопоставлением.
 */
export async function channelMarks(): Promise<{ channels: ChannelMark[]; mapped: string[] }> {
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500));
  const [catalog, mapping] = await Promise.all([
    Promise.race([channelsApi.catalog().catch(() => null), timeout]),
    channelsApi.mapping().catch(() => []),
  ]);
  const channels = (catalog?.connections ?? [])
    .filter((c) => c.active && c.removalDate === null)
    .map((c) => ({
      key: c.id,
      title: c.channelTitle,
      mark: c.shortCode ?? c.channelTitle.slice(0, 1),
    }));
  const mapped = [
    ...new Set(mapping.map((m) => m.localAccommodationTypeCode).filter((c): c is string => !!c)),
  ];
  return { channels, mapped };
}
