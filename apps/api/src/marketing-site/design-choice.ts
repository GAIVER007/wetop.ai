import { BadRequestException } from '@nestjs/common';
import { designPresetById, designPresetDirection, type DesignDirection } from '@pms/domain';

/**
 * Выбор оформления первой сборки (MKT9.2 + SITE-1). Два источника, браузер передаёт только id:
 *
 * - направление из ответа ИИ этого сайта: `designRunId` + `designId` (направление сервер берёт из задачи DESIGN);
 * - готовое направление набора `DESIGN_PRESETS` домена: `designPresetId` (доверенный источник, ИИ не нужен).
 *
 * Вместе их передать нельзя; неизвестный пресет это 400, а не первое попавшееся оформление.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ID_RE = /^[a-z0-9][a-z0-9-]{0,47}$/;

export type DesignChoice = { runId: string; directionId: string } | { preset: DesignDirection };

export function parseDesignChoice(input: Record<string, unknown>): DesignChoice | null {
  const byRun = input['designRunId'] !== undefined || input['designId'] !== undefined;
  const byPreset = input['designPresetId'] !== undefined;
  if (byRun && byPreset) throw new BadRequestException('Оформление: либо designPresetId, либо designRunId и designId');
  if (byPreset) {
    const id = input['designPresetId'];
    const preset = typeof id === 'string' && ID_RE.test(id) ? designPresetById(id) : null;
    if (!preset) throw new BadRequestException('designPresetId: готовое оформление из набора');
    return { preset: designPresetDirection(preset) };
  }
  if (!byRun) return null;
  const runId = input['designRunId'];
  const designId = input['designId'];
  if (typeof runId !== 'string' || !UUID_RE.test(runId) || typeof designId !== 'string' || !ID_RE.test(designId))
    throw new BadRequestException('designRunId и designId: выбранное оформление');
  return { runId: runId.toLowerCase(), directionId: designId };
}

/** Что пишется в журнал аудита о выборе: id, без темы и текста */
export function designAudit(choice: DesignChoice | null | undefined): Record<string, string> {
  if (!choice) return {};
  return 'preset' in choice ? { designPresetId: choice.preset.id } : { designRunId: choice.runId, designId: choice.directionId };
}
