import { describe, expect, it } from 'vitest';
import {
  emptyQuickStart,
  quickIssues,
  quickPlan,
  parseRows,
  type QuickStart,
} from './model';

const base = (): QuickStart => ({
  ...emptyQuickStart('QAR', 'Asia/Qatar'),
  salon: {
    ...emptyQuickStart('QAR', 'Asia/Qatar').salon,
    name: 'Lashes Studio',
    address: 'Doha, Garafa',
    phone: '+974 5000 0000',
    days: [0, 1, 2, 3, 4, 5, 6],
    timeFrom: '10:00',
    timeTo: '22:00',
  },
  services: [
    { category: 'Lashes', name: 'Classic', minutes: '90', price: '380' },
    { category: 'Nails', name: 'Gel manicure', minutes: '60', price: '250' },
  ],
  masters: [
    {
      name: 'Samira A.',
      email: 'samira@mail.example',
      phone: '+974 5000 0001',
      services: ['Gel manicure'],
      timeFrom: '',
      timeTo: '',
      pay: 'PERCENT',
      fixed: '',
      percent: '40',
    },
  ],
  staff: [{ name: 'Sara A.', email: 'sara@mail.example', phone: '', role: 'STAFF' }],
  products: [{ category: 'Bar', name: 'Juice', price: '15' }],
});

describe('быстрый запуск салона: проверка до создания', () => {
  it('чистая анкета без замечаний', () => {
    expect(quickIssues(base())).toEqual([]);
  });

  it('находит опечатку gmail.ru и предлагает исправление', () => {
    const q = base();
    q.masters[0]!.email = 'aidai@gmail.ru';
    const [issue] = quickIssues(q);
    expect(issue).toMatchObject({ level: 'error', section: 'masters', row: 0, field: 'email' });
    expect(issue!.fix).toMatchObject({ kind: 'set', value: 'aidai@gmail.com' });
  });

  it('мастер работает дольше салона: два решения кнопками', () => {
    const q = base();
    q.masters[0]!.timeTo = '23:00';
    const issue = quickIssues(q).find((i) => i.field === 'timeTo');
    expect(issue?.level).toBe('warning');
    expect(issue?.choices?.map((c) => c.kind)).toEqual(['salon-until', 'master-until']);
  });

  it('строка-пример из шаблона и одна почта у двух людей', () => {
    const q = base();
    q.masters.push({ ...q.masters[0]!, name: 'Maria Santos', email: 'maria@pearl-beauty.example' });
    q.staff[0]!.email = 'samira@mail.example';
    const issues = quickIssues(q);
    expect(issues.some((i) => i.field === 'name' && i.row === 1 && i.fix?.kind === 'remove-row')).toBe(true);
    expect(issues.some((i) => i.section === 'staff' && i.field === 'email' && i.level === 'warning')).toBe(true);
  });

  it('пустые обязательные поля и услуга мастера, которой нет в списке', () => {
    const q = base();
    q.salon.name = '';
    q.services[0]!.price = 'abc';
    q.masters[0]!.services = ['Haircut'];
    const fields = quickIssues(q).map((i) => `${i.section}.${i.field}`);
    expect(fields).toEqual(expect.arrayContaining(['salon.name', 'services.price', 'masters.services']));
  });
});

describe('быстрый запуск салона: план создания', () => {
  it('переводит анкету в шаги существующих действий WETOP', () => {
    const plan = quickPlan(base());
    expect(plan.profile).toEqual({
      businessName: 'Lashes Studio',
      locationName: 'Lashes Studio',
      currency: 'QAR',
      timezone: 'Asia/Qatar',
      address: 'Doha, Garafa',
      phone: '+974 5000 0000',
    });
    expect(plan.hours).toHaveLength(7);
    expect(plan.hours[0]).toEqual({ weekday: 0, timeFrom: '10:00', timeTo: '22:00' });
    expect(plan.services[0]).toEqual({ name: 'Classic', category: 'Lashes', durationMinutes: '90', priceMinor: '38000' });
    expect(plan.masters[0]).toMatchObject({
      name: 'Samira A.',
      personnelKind: 'SPECIALIST',
      services: ['Gel manicure'],
      pay: { model: 'PERCENT', fixedMinor: '0', percent: 40 },
      invite: 'PORTAL',
    });
    // часы мастера по умолчанию как у салона
    expect(plan.masters[0]!.hours).toEqual(plan.hours);
    expect(plan.staff[0]).toMatchObject({ personnelKind: 'OTHER_EMPLOYEE', invite: 'STAFF' });
    expect(plan.products[0]).toEqual({ category: 'Bar', name: 'Juice', salePriceMinor: '1500' });
    expect(plan.payments.find((m) => m.method === 'CASH')?.enabled).toBe(true);
  });

  it('один человек и админ, и мастер: один сотрудник «и то и другое»', () => {
    const q = base();
    q.staff[0]!.email = 'samira@mail.example';
    q.staff[0]!.name = 'Samira A.';
    const plan = quickPlan(q);
    expect(plan.staff).toHaveLength(0);
    expect(plan.masters[0]).toMatchObject({ personnelKind: 'BOTH', invite: 'STAFF' });
  });

  it('бесплатное угощение не идёт в склад, пустые строки пропускаются', () => {
    const q = base();
    q.products.push({ category: 'Bar', name: 'Water', price: '0' }, { category: '', name: '', price: '' });
    expect(quickPlan(q).products.map((p) => p.name)).toEqual(['Juice']);
  });
});

describe('вставка строк', () => {
  it('раскладывает строки с табуляцией по колонкам', () => {
    expect(parseRows('Lashes\tClassic\t90\t380\nNails\tGel\t60\t250\n', 4)).toEqual([
      ['Lashes', 'Classic', '90', '380'],
      ['Nails', 'Gel', '60', '250'],
    ]);
  });
});
