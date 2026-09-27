import Link from 'next/link';
import type { TrackedSiteCard } from '../../lib/api';
import { EmptyState, Notice, Stack } from '../../components/ui';
import { WEBSITE_TABS, WEBSITE_TITLE, type WebsiteView } from '../../lib/website';

/** Вкладки модуля — ссылки со своим адресом, как у «ИИ-продавца» и «Настроек гостиницы» (`.settings-tabs`) */
export function WebsiteTabs({ current }: { current: WebsiteView }) {
  return (
    <nav className="settings-tabs" aria-label={WEBSITE_TITLE} data-testid="website-tabs">
      {WEBSITE_TABS.map((tab) => (
        <Link
          key={tab.view}
          href={tab.href}
          prefetch={false}
          aria-current={tab.view === current ? 'page' : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

/**
 * Сайта нет или у него только домен-заглушка: пустое состояние, а не «сайт» с зелёным статусом. Заготовку в базе
 * не трогаем — её ключ уже в выданном коде для сайта; достаточно вписать настоящий адрес в «Настройках».
 */
export function WebsiteNotConnected({ drafts }: { drafts: TrackedSiteCard[] }) {
  return (
    <Stack>
      <EmptyState
        data-testid="website-not-connected"
        title="Сайт ещё не подключён"
        actions={
          <Link className="btn" href="/website/settings">
            Подключить сайт
          </Link>
        }
      >
        Подключите существующий сайт, чтобы принимать с него бронирования и видеть аналитику.
      </EmptyState>
      {drafts.map((draft) => (
        <Notice tone="muted" key={draft.site.id} data-testid="website-draft">
          Заготовка «{draft.site.name}» ждёт адреса сайта: пока его нет, WETOP не принимает с сайта
          ни посещения, ни брони. Код, который уже выдан для сайта, менять не придётся.
        </Notice>
      ))}
    </Stack>
  );
}
