'use client';

import dynamic from 'next/dynamic';

/*
 * Agentation: панель пометок для ИИ-агента (щелчок по элементу → заметка с селектором).
 * Только при `npm run dev`: в статическую сборку для Cloudflare Pages панель не попадает,
 * ветку с импортом сборщик выкидывает по NODE_ENV.
 * Прямая передача пометок агенту: NEXT_PUBLIC_AGENTATION_ENDPOINT=http://localhost:4747
 * и `npx -y agentation-mcp server` в MCP-клиенте.
 */
const Agentation =
  process.env.NODE_ENV === 'development'
    ? dynamic(() => import('agentation').then((m) => m.Agentation), { ssr: false })
    : null;

export function DevAgentation() {
  if (!Agentation) return null;
  const endpoint = process.env.NEXT_PUBLIC_AGENTATION_ENDPOINT;
  return endpoint ? <Agentation endpoint={endpoint} /> : <Agentation />;
}
