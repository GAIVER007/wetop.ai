// Заглушка next/navigation: хуки роутера вне приложения Next падают («expected app router
// to be mounted»). В превью и в макетах действия навигации — пустые, экран остаётся живым.
const noop = () => {};

export function useRouter() {
  return { push: noop, replace: noop, refresh: noop, back: noop, forward: noop, prefetch: noop };
}
export function usePathname(): string {
  return '/';
}
export function useSearchParams(): URLSearchParams {
  return new URLSearchParams();
}
export function useParams(): Record<string, string> {
  return {};
}
export function useSelectedLayoutSegment(): string | null {
  return null;
}
export function redirect(_url: string): void {}
export function notFound(): void {}
