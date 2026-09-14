import type { ChannexGateway } from './channels.repository';

/**
 * Единый выключатель исходящего ARI в Channex (Q-126, ADR-041; CUTOVER.md ROLLBACK, полный откат, шаг 1).
 * `CHANNEX_ARI=off` — остатки и ограничения из PMS в Channex не уходят ни одним путём: ни фоновой очередью, ни кнопками
 * «Отправить сейчас» и «Полная выгрузка», ни починкой сторожа. Изменения копятся в очереди и уходят после включения.
 * Приём броней (лента, webhook) выключатель не трогает: во время отката брони продолжают приходить и сверяются (шаг 6).
 * Включается и выключается одной командой `scripts/ops/ari.sh stop|start` (переменная для API под launchd + перезапуск).
 */
export const ARI_SWITCH_ENV = 'CHANNEX_ARI';

export const ARI_STOPPED_MESSAGE =
  'Исходящий ARI в Channex остановлен (CHANNEX_ARI=off, план отката CUTOVER.md): остатки и ограничения не отправляются, ' +
  'изменения ждут в очереди. Включить: scripts/ops/ari.sh start';

export function isAriStopped(env: Record<string, string | undefined> = process.env): boolean {
  return env[ARI_SWITCH_ENV]?.trim().toLowerCase() === 'off';
}

export class AriStoppedError extends Error {
  override readonly name = 'AriStoppedError';
  constructor() {
    super(ARI_STOPPED_MESSAGE);
  }
}

/**
 * Шлюз, который перед отправкой остатков и ограничений спрашивает выключатель. Стоит на выходе из PMS,
 * поэтому закрывает и те пути, которые появятся позже. Остальные методы — исходного шлюза, с его контекстом.
 */
export function guardAriGateway<
  G extends Pick<ChannexGateway, 'updateAvailability' | 'updateRestrictions'>,
>(gateway: G): G {
  const availability = gateway.updateAvailability.bind(gateway);
  const restrictions = gateway.updateRestrictions.bind(gateway);
  const guarded = Object.create(gateway) as G;
  guarded.updateAvailability = ((values) =>
    isAriStopped()
      ? Promise.reject(new AriStoppedError())
      : availability(values)) as G['updateAvailability'];
  guarded.updateRestrictions = ((values) =>
    isAriStopped()
      ? Promise.reject(new AriStoppedError())
      : restrictions(values)) as G['updateRestrictions'];
  return guarded;
}
