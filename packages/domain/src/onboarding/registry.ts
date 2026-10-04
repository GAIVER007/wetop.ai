import { parseBusinessVertical, type BusinessVertical } from '../verticals/registry';

export interface OnboardingStep {
  readonly id: string;
  readonly label: string;
  readonly skippable: boolean;
}
export interface OnboardingFlow {
  readonly vertical: BusinessVertical;
  readonly version: number;
  readonly steps: readonly OnboardingStep[];
  readonly completion: string;
}
const SHARED_STEPS: readonly OnboardingStep[] = [
  { id: 'business', label: 'Бизнес', skippable: false },
  { id: 'location', label: 'Филиал', skippable: false },
  { id: 'review', label: 'Проверка', skippable: false },
];
const FLOWS: Record<BusinessVertical, OnboardingFlow> = {
  HOSPITALITY: {
    vertical: 'HOSPITALITY',
    version: 1,
    steps: [{ id: 'hotel', label: 'Номера и цены', skippable: true }],
    completion: 'Отель настроен',
  },
  BEAUTY: {
    vertical: 'BEAUTY',
    version: 1,
    steps: SHARED_STEPS,
    completion:
      'Пилот Beauty подключён. Настройку услуг и сотрудников продолжим после активации модуля.',
  },
  FOOD_SERVICE: {
    vertical: 'FOOD_SERVICE',
    version: 1,
    steps: SHARED_STEPS,
    completion:
      'Пилот Food Service подключён. Настройку залов и столов продолжим после активации модуля.',
  },
};
/** Call with the verified Business vertical, never a query parameter. */
export function onboardingFlow(value: unknown): OnboardingFlow {
  const vertical = parseBusinessVertical(value);
  if (!vertical) throw new Error('Неизвестное направление бизнеса');
  return FLOWS[vertical];
}
export function moveOnboarding(
  flow: OnboardingFlow,
  currentStep: string,
  action: 'next' | 'back' | 'skip',
): string {
  const index = flow.steps.findIndex((step) => step.id === currentStep);
  if (index < 0) throw new Error('Неизвестный шаг настройки');
  if (action === 'skip' && !flow.steps[index]!.skippable)
    throw new Error('Этот шаг нельзя пропустить');
  const next =
    action === 'back' ? Math.max(0, index - 1) : Math.min(flow.steps.length - 1, index + 1);
  return flow.steps[next]!.id;
}
