/**
 * Заголовки безопасности стойки (аудит 29.09.2026, SEC-4). Ставит их `middleware.ts` на каждый ответ страницы.
 *
 * Принудительно — только то, что не может сломать страницу: запрет встраивания во фрейм (кликджекинг формы входа и
 * действий), `nosniff`, referrer без пути. Полная политика CSP идёт в режиме report-only: нарушения видны в консоли
 * браузера, страницы не ломаются. Inline-скрипты (тема, гидратация Next) пока разрешены — без nonce политика их
 * не отличит; строгая политика — отдельным шагом после недели без нарушений и приёмника отчётов.
 *
 * HSTS здесь не ставится: он липкий и включается в Cloudflare на зоне, по решению владельца.
 */
export interface SecurityHeaderEnv {
  /** `ASSISTANT_URL`: откуда грузится скрипт ИИ-помощника (`assistant-widget.tsx`) */
  assistantUrl?: string | undefined;
}

/** Происхождение адреса, только http(s): `javascript:` и `data:` в политику не попадают */
function httpOrigin(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.origin : null;
  } catch {
    return null;
  }
}

export function securityHeaders(env: SecurityHeaderEnv): Record<string, string> {
  const assistant = httpOrigin(env.assistantUrl);
  const withAssistant = (base: string) => (assistant ? `${base} ${assistant}` : base);
  const reportOnly = [
    "default-src 'self'",
    withAssistant("script-src 'self' 'unsafe-inline'"),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    withAssistant("connect-src 'self'"),
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
  return {
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "frame-ancestors 'none'",
    'Content-Security-Policy-Report-Only': reportOnly,
  };
}
