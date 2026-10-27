import { describe, expect, it } from 'vitest';
import {
  emptyHotelStart,
  emptyRestaurantStart,
  hotelDone,
  hotelIssues,
  hotelPlan,
  restaurantDone,
  restaurantIssues,
  restaurantPlan,
  type HotelStart,
  type RestaurantStart,
} from './vertical-model';

/** Быстрый запуск гостиницы и ресторана (владелец 27.10.2026: «во всех вертикалях»), то же окно, что у салона */
function hotel(): HotelStart {
  const h = emptyHotelStart('QAR');
  h.hotel = { ...h.hotel, name: 'Pearl Hotel', address: 'Doha, Pearl', phone: '+974 5000 0002', checkIn: '14:00', checkOut: '12:00' };
  h.rooms = [
    { name: 'Standard', kind: 'PRIVATE_ROOM', guests: '2', count: '10', price: '450' },
    { name: 'Dorm bed', kind: 'DORM_BED', guests: '1', count: '8', price: '90' },
  ];
  h.extras = [{ name: 'Breakfast', price: '45' }];
  h.staff = [
    { name: 'Rita A.', email: 'rita@gmail.com', phone: '', role: 'STAFF', pay: 'FIXED', fixed: '3000', perCleaning: '' },
    { name: 'Nora C.', email: '', phone: '+974 1', role: 'NONE', pay: 'BONUS_ONLY', fixed: '', perCleaning: '15' },
  ];
  return h;
}
function restaurant(): RestaurantStart {
  const r = emptyRestaurantStart('QAR', 'Asia/Qatar');
  r.restaurant = { ...r.restaurant, name: 'Sea Grill', address: 'Doha, Corniche', phone: '+974 5000 0003' };
  r.tables = [
    { area: 'Hall', name: '1', seats: '4' },
    { area: 'Hall', name: '2', seats: '2' },
    { area: 'Terrace', name: 'T1', seats: '6' },
  ];
  r.menu = [
    { category: 'Kitchen', name: 'Grilled fish', price: '85', station: 'KITCHEN' },
    { category: 'Drinks', name: 'Lemonade', price: '18', station: 'BAR' },
  ];
  r.staff = [{ name: 'Omar K.', email: 'omar@gmail.ru', phone: '', role: 'STAFF', pay: 'FIXED_PLUS_PERCENT', fixed: '2500', percent: '5' }];
  return r;
}

describe('гостиница: проверка до создания', () => {
  it('чистая анкета без ошибок', () => {
    expect(hotelIssues(hotel())).toEqual([]);
  });
  it('номера: число, вместимость и цена обязательны; повтор категории подсвечен', () => {
    const h = hotel();
    h.rooms.push({ name: 'Standard', kind: 'PRIVATE_ROOM', guests: '0', count: 'x', price: '' });
    const fields = hotelIssues(h).map((i) => `${i.section}:${i.row}:${i.field}`);
    expect(fields).toEqual(expect.arrayContaining(['rooms:2:name', 'rooms:2:guests', 'rooms:2:count', 'rooms:2:price']));
  });
  it('без номеров создать нельзя; опечатка почты сотрудника правится кнопкой', () => {
    const h = hotel();
    h.rooms = [];
    h.staff[0]!.email = 'rita@gmail.ru';
    const issues = hotelIssues(h);
    expect(issues.find((i) => i.section === 'rooms')?.level).toBe('error');
    expect(issues.find((i) => i.field === 'email')?.fix).toMatchObject({ kind: 'set', value: 'rita@gmail.com' });
  });
});

describe('гостиница: план', () => {
  it('категории, услуги, сотрудники с оплатой, контакты и способы оплаты гостиницы', () => {
    const plan = hotelPlan(hotel());
    expect(plan.provision).toEqual({
      currency: 'QAR',
      categories: [
        { name: 'Standard', kind: 'PRIVATE_ROOM', capacityAdults: 2, units: 10, priceMinor: 45000 },
        { name: 'Dorm bed', kind: 'DORM_BED', capacityAdults: 1, units: 8, priceMinor: 9000 },
      ],
    });
    expect(plan.settings).toEqual({
      name: 'Pearl Hotel',
      address: 'Doha, Pearl',
      phone: '+974 5000 0002',
      checkInTime: '14:00',
      checkOutTime: '12:00',
    });
    expect(plan.extras).toEqual([{ name: 'Breakfast', price: '45' }]);
    expect(plan.staff).toEqual([
      { name: 'Rita A.', email: 'rita@gmail.com', phone: '', invite: 'STAFF', pay: { model: 'FIXED', fixedMinor: 300000, percent: 0, perCleaningMinor: 0 } },
      { name: 'Nora C.', email: '', phone: '+974 1', invite: null, pay: { model: 'BONUS_ONLY', fixedMinor: 0, percent: 0, perCleaningMinor: 1500 } },
    ]);
    expect(plan.payments.filter((p) => p.enabled).map((p) => p.method)).toEqual(['CASH', 'CARD_TERMINAL']);
  });
  it('итог «Гостиница готова»: цифры, номера, команда', () => {
    const s = hotelDone(hotelPlan(hotel()), []);
    expect(s.counts).toEqual({ categories: 2, units: 18, extras: 1, staff: 2, invites: 1 });
    expect(s.rooms[0]).toEqual({ name: 'Standard', units: 10, guests: 2, priceMinor: '45000' });
    expect(s.team.map((m) => m.invite)).toEqual(['sent', 'none']);
  });
});

describe('ресторан: проверка до создания', () => {
  it('опечатка почты и места числом', () => {
    const r = restaurant();
    r.tables.push({ area: '', name: '9', seats: '0' });
    const issues = restaurantIssues(r);
    expect(issues.find((i) => i.field === 'email')?.fix).toMatchObject({ kind: 'set', value: 'omar@gmail.com' });
    expect(issues.map((i) => `${i.section}:${i.row}:${i.field}`)).toEqual(expect.arrayContaining(['tables:3:area', 'tables:3:seats']));
  });
  it('повтор стола в зале и блюдо без цены', () => {
    const r = restaurant();
    r.tables.push({ area: 'Hall', name: '1', seats: '4' });
    r.menu.push({ category: 'Kitchen', name: 'Soup', price: '', station: 'KITCHEN' });
    const fields = restaurantIssues(r).map((i) => `${i.section}:${i.row}:${i.field}`);
    expect(fields).toEqual(expect.arrayContaining(['tables:3:name', 'menu:2:price']));
  });
});

describe('ресторан: план', () => {
  it('профиль с контактами, залы со столами, меню по станциям, сотрудники с оплатой', () => {
    const r = restaurant();
    r.staff[0]!.email = 'omar@gmail.com';
    const plan = restaurantPlan(r);
    expect(plan.profile).toEqual({
      businessName: 'Sea Grill',
      locationName: 'Sea Grill',
      currency: 'QAR',
      timezone: 'Asia/Qatar',
      address: 'Doha, Corniche',
      phone: '+974 5000 0003',
    });
    expect(plan.areas).toEqual([
      { name: 'Hall', tables: [{ name: '1', capacity: 4 }, { name: '2', capacity: 2 }] },
      { name: 'Terrace', tables: [{ name: 'T1', capacity: 6 }] },
    ]);
    expect(plan.menu).toEqual([
      { name: 'Kitchen', station: 'KITCHEN', items: [{ name: 'Grilled fish', price: 8500 }] },
      { name: 'Drinks', station: 'BAR', items: [{ name: 'Lemonade', price: 1800 }] },
    ]);
    expect(plan.staff[0]).toEqual({
      name: 'Omar K.',
      email: 'omar@gmail.com',
      phone: '',
      invite: 'STAFF',
      pay: { model: 'FIXED_PLUS_PERCENT', fixedMinor: 250000, percent: 5 },
    });
  });
  it('итог «Ресторан готов»: столы, места, блюда', () => {
    const r = restaurant();
    r.staff[0]!.email = 'omar@gmail.com';
    const s = restaurantDone(restaurantPlan(r), ['omar@gmail.com']);
    expect(s.counts).toEqual({ areas: 2, tables: 3, seats: 12, dishes: 2, staff: 1, invites: 0 });
    expect(s.team[0]!.invite).toBe('failed');
  });
});
