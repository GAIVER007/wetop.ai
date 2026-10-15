import { afterEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { redirect } from 'next/navigation';
import LoginPage from '../app/login/page';
import RegisterPage from '../app/register/page';

vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
afterEach(() => vi.clearAllMocks());
it('старые ссылки сохраняют безопасный адрес возврата и режим', async () => {
  await LoginPage({ searchParams: Promise.resolve({ next: '/journal' }) });
  expect(redirect).toHaveBeenLastCalledWith('https://wetop.ai/?next=%2Fjournal#login');
  await RegisterPage();
  expect(redirect).toHaveBeenLastCalledWith('https://wetop.ai/?next=%2Ftoday#register');
});
it('старый вход больше не рендерит дублирующий экран', () => {
  const source = readFileSync('apps/web/src/app/login/page.tsx', 'utf8');
  expect(source).not.toContain('<LoginForm');
  expect(source).toContain('publicAuthUrl');
});
it('старая регистрация больше не рендерит дублирующий экран', () => {
  const source = readFileSync('apps/web/src/app/register/page.tsx', 'utf8');
  expect(source).not.toContain('<LoginForm');
  expect(source).toContain("publicAuthUrl('register')");
});
