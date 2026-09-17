import { describe, expect, it } from 'vitest';
import { isLocalDatabase, LOCAL_PROPERTY } from '../tools/seed-local';

/**
 * Засев локального стенда обязан отказаться от чужой базы: тот же скрипт с dev-адресом в переменной
 * окружения создал бы объект и единицы в Сингапуре, где живут настоящие брони (SECURITY.md §3).
 */
describe('seed-local: только локальная база', () => {
  it('localhost и 127.0.0.1 — можно', () => {
    expect(isLocalDatabase('postgresql://postgres@127.0.0.1:55432/pmslocal')).toBe(true);
    expect(isLocalDatabase('postgresql://postgres@localhost:55432/pmslocal')).toBe(true);
  });

  it('dev-БД, боевая и мусор — нельзя', () => {
    expect(isLocalDatabase('postgresql://u:p@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres')).toBe(false);
    expect(isLocalDatabase('postgresql://u:p@db.example.kz:5432/pms')).toBe(false);
    expect(isLocalDatabase('')).toBe(false);
    expect(isLocalDatabase('не адрес')).toBe(false);
    // хост, который лишь начинается как локальный, локальным не считается
    expect(isLocalDatabase('postgresql://u@localhost.attacker.example/pms')).toBe(false);
  });

  it('объект стенда — пустая коробка с рабочим именем, без данных гостей', () => {
    expect(LOCAL_PROPERTY.address).toBe('нигде');
    expect(LOCAL_PROPERTY.timezone).toBe('Asia/Almaty');
  });
});
