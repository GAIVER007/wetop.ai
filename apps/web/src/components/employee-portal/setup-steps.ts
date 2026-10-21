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
  week: ReadonlyArray<{ intervals: ReadonlyArray<unknown> }>;
}): MasterSetupStep[] {
  const steps: MasterSetupStep[] = [
    { id: 'services', label: 'Назначьте услуги', done: input.services.some((s) => s.assigned), tab: 'services' },
    { id: 'week', label: 'Задайте рабочие часы', done: input.week.some((d) => d.intervals.length > 0), tab: 'week' },
  ];
  return steps.every((s) => s.done) ? [] : steps;
}
