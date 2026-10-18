'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { latestWhatsNew, WHATS_NEW_SEEN_KEY } from '../../lib/whats-new';
import type { WebVertical } from '../../lib/vertical-landing';
import { Icon } from '../icon';

function seen(): string | null {
  try {
    return window.localStorage.getItem(WHATS_NEW_SEEN_KEY);
  } catch {
    return null;
  }
}

/** «Что нового» в меню профиля (SUP1): точка, пока в браузере не отмечена последняя запись своего направления */
export function WhatsNewLink({ vertical, onClick }: { vertical: WebVertical; onClick: () => void }) {
  const latest = latestWhatsNew(vertical);
  const [unread, setUnread] = useState(false);
  useEffect(() => setUnread(!!latest && (seen() ?? '') < latest), [latest]);
  return (
    <Link href="/whats-new" onClick={onClick}>
      <Icon name="star" />
      Что нового
      {unread && (
        <span className="whats-new-dot" data-testid="whats-new-dot">
          <span className="sr-only">есть новое</span>
        </span>
      )}
    </Link>
  );
}

/** Ставит отметку «прочитано» при открытии страницы «Что нового» */
export function MarkWhatsNewSeen({ latest }: { latest: string | null }) {
  useEffect(() => {
    if (!latest) return;
    try {
      window.localStorage.setItem(WHATS_NEW_SEEN_KEY, latest);
    } catch {
      // приватное окно или запрет хранилища: точка просто покажется снова
    }
  }, [latest]);
  return null;
}
