'use client';

import dynamic from 'next/dynamic';

// Только локальная разработка. Замечания копируются из браузера в чат вручную.
const Agentation =
  process.env.NODE_ENV === 'development'
    ? dynamic(() => import('agentation').then((m) => m.Agentation), { ssr: false })
    : null;

export function DevAgentation() {
  return Agentation ? <Agentation /> : null;
}
