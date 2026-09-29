import { describe, expect, it } from 'vitest';
import { CLOSED_ACCESS, sidebarSectionsFor } from './navigation';

describe('ИИ-продавец в меню', () => {
  it('остаётся в Продажах до загрузки прав и при выключенном расширении', () => {
    const sales = sidebarSectionsFor(CLOSED_ACCESS).find(section => section.id === 'sales');
    expect(sales?.items.some(item => item.href === '/ai-agents')).toBe(true);
  });
  it('не открывает раздел платформы без прав администратора', () => {
    expect(sidebarSectionsFor(CLOSED_ACCESS).some(section => section.id === 'platform')).toBe(false);
  });
});
