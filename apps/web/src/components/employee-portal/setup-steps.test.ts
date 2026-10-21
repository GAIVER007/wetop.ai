import { describe, expect, it } from 'vitest';
import { masterSetupSteps } from './setup-steps';

// Онбординг на живом сайте 21.10.2026: после «Создать мастера» открывалась вкладка «Профиль», а куда идти дальше
// (услуги, график) не было видно. Карточка подсказывает оставшиеся шаги и ведёт на нужную вкладку.
const svc = (assigned: boolean) => ({ assigned });
describe('masterSetupSteps', () => {
  it('новый мастер: оба шага не сделаны, ссылки на вкладки', () => {
    expect(masterSetupSteps({ services: [svc(false)], week: [] })).toEqual([
      { id: 'services', label: 'Назначьте услуги', done: false, tab: 'services' },
      { id: 'week', label: 'Задайте рабочие часы', done: false, tab: 'week' },
    ]);
  });
  it('услуга назначена, часов нет: первый сделан', () => {
    const steps = masterSetupSteps({ services: [svc(true)], week: [{ weekday: 1, intervals: [] }] });
    expect(steps.map((s) => s.done)).toEqual([true, false]);
  });
  it('всё готово: пустой список, блок не показывается', () => {
    expect(
      masterSetupSteps({ services: [svc(true)], week: [{ weekday: 1, intervals: [{ timeFrom: '09:00', timeTo: '18:00' }] }] }),
    ).toEqual([]);
  });
});
