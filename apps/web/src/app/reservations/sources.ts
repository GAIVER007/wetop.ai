export { manualSources as SOURCES, channels as CHANNELS } from '../../lib/status/source';

/** Бронь пришла из Channex: её внешний ID — `unique_id` с кодом канала (`BDC-9996013801`), стойка его не правит */
export const fromChannex = (externalId: string | null | undefined) =>
  /^[A-Z]{3}-/.test(externalId ?? '');
