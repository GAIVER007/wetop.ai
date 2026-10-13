'use client';

import dynamic from 'next/dynamic';

// Только локальная разработка. Замечания копируются из браузера в чат вручную.
const Agentation =
  process.env.NODE_ENV === 'development'
    ? dynamic(() => import('./agentation-preview').then((m) => m.AgentationPreview), { ssr: false })
    : null;

export function DevAgentation() {
  return Agentation ? <Agentation enabled /> : null;
}
