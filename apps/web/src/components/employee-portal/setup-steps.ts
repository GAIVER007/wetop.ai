import { msg } from '../../i18n';

/** Что осталось сделать в карточке нового мастера, чтобы к нему могли записаться (онбординг, 21.10.2026) */
export interface MasterSetupStep {
  id: 'services' | 'week';
  label: string;
  done: boolean;
  /** id вкладки карточки (`Tabs` открывает её по `#id`) */
  tab: 'services' | 'week';
}

export function masterSetupSteps(input: {
  services: ReadonlyArray<{ assigned: boolean }>;
  week: ReadonlyArray<{ weekday?: number; intervals: ReadonlyArray<unknown> }>;
}): MasterSetupStep[] {
  const steps: MasterSetupStep[] = [
    { id: 'services', label: msg('Назначьте услуги'), done: input.services.some((s) => s.assigned), tab: 'services' },
    { id: 'week', label: msg('Задайте рабочие часы'), done: input.week.some((d) => d.intervals.length > 0), tab: 'week' },
  ];
  return steps.every((s) => s.done) ? [] : steps;
}
