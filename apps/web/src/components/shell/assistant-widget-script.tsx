'use client';

import Script from 'next/script';
import { useEffect } from 'react';
import { nextWidgetOwner } from '../../lib/assistant-widget';

/** Чья сессия была у виджета, когда он загрузился на этой странице. Живёт до полной перезагрузки */
let running: string | null = null;

/**
 * Тег виджета ИИ-помощника (ТЗ П2). `next/script` грузит скрипт один раз на страницу и переносит `data-identity`
 * в тег — виджет читает его при загрузке. Поэтому после входа или выхода (мягкий переход, без перезагрузки)
 * работающий виджет остался бы с прежним человеком: сторож сравнивает хозяина и перезагружает страницу один раз.
 */
export function AssistantWidgetScript({
  src,
  identity,
  owner,
}: {
  src: string;
  identity: string | null;
  owner: string;
}) {
  useEffect(() => {
    const next = nextWidgetOwner(running, owner);
    running = next.owner;
    if (next.reload) window.location.reload();
  }, [owner]);

  return identity ? <Script src={src} data-identity={identity} /> : <Script src={src} />;
}
