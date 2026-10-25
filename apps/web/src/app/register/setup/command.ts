import { onboardingFlow } from '@pms/domain';
import type { SharedOnboardingState } from '../../../lib/api';
import { msg } from '../../../i18n';
export type Command = {
  action: 'save' | 'next' | 'back' | 'complete';
  draft: Record<string, unknown>;
  updatedAt: string | null;
};
export type ProgressReply = {
  status: number;
  state?: SharedOnboardingState;
  error?: string;
  loginUrl?: string;
};
const normalize = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(normalize)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.entries(value)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, item]) => [key, normalize(item)]),
        )
      : value;
/** A lost response is acknowledged only when the same draft and requested transition are persisted. */
export function committedCommand(
  before: SharedOnboardingState,
  latest: SharedOnboardingState,
  command: Command,
): boolean {
  if (
    before.vertical !== latest.vertical ||
    command.updatedAt !== before.updatedAt ||
    before.locationId !== latest.locationId ||
    before.businessId !== latest.businessId ||
    before.flowVersion !== latest.flowVersion ||
    before.updatedAt === latest.updatedAt ||
    JSON.stringify(normalize(command.draft)) !== JSON.stringify(normalize(latest.draft))
  )
    return false;
  const steps = onboardingFlow(before.vertical).steps;
  const index = steps.findIndex((step) => step.id === before.currentStep);
  if (command.action === 'complete') return !!latest.completedAt;
  if (latest.completedAt) return false;
  const target =
    command.action === 'next' ? index + 1 : command.action === 'back' ? index - 1 : index;
  return latest.currentStep === steps[target]?.id;
}
export function sameProgressScope(before: SharedOnboardingState, latest: SharedOnboardingState): boolean {
  return before.businessId === latest.businessId && before.locationId === latest.locationId &&
    before.flowVersion === latest.flowVersion && before.vertical === latest.vertical;
}
export function recoveryDecision(before: SharedOnboardingState, latest: SharedOnboardingState, failed: Command) {
  if (!sameProgressScope(before, latest)) return 'conflict';
  if (committedCommand(before, latest, failed)) return 'committed';
  return before.updatedAt === latest.updatedAt ? 'uncommitted' : 'conflict';
}
export async function progressRequest(command?: Command): Promise<ProgressReply> {
  try {
    const response = await fetch('/register/setup/progress', {
      method: command ? 'POST' : 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: command ? { 'content-type': 'application/json' } : {},
      ...(command ? { body: JSON.stringify(command) } : {}),
      // Backend keeps its 60s deadline. The browser waits for that reply before marking a commit uncertain.
      signal: AbortSignal.timeout(65_000),
    });
    return { ...(await response.json()), status: response.status } as ProgressReply;
  } catch {
    return {
      status: 503,
      error:
        msg('Нет связи с API. Введённые данные сохранены в форме. Повторите после восстановления связи.'),
    };
  }
}
