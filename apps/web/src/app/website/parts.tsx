import Link from 'next/link';
import type { TrackedSiteCard } from '../../lib/api';
import { EmptyState, Notice, Stack } from '../../components/ui';
import { WEBSITE_TABS, WEBSITE_TITLE, type WebsiteView } from '../../lib/website';

/** Сайт объекта, продукт «Маркетинга» (MKT2): над заголовком ссылка в хаб, тем же приёмом, что у «Каналов продаж» */
export function MarketingCrumb() {
  return <Link href="/marketing">Маркетинг</Link>;
}

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
 * MKT7: сайт счётчика управляемого сайта WETOP настраивает только публикация. Здесь его не правят и не удаляют
 * (API ответит 409 MANAGED_SITE_READ_ONLY), поэтому вместо формы строка со ссылкой туда, где он настраивается
 */
export function ManagedSitesNotice({ cards }: { cards: TrackedSiteCard[] }) {
  return cards.map((card) => (
    <Notice tone="muted" key={card.site.id} data-testid="website-managed-site">
      «{card.site.name}» это сайт WETOP: домены, пауза и бронь настраиваются в{' '}
      <Link href="/marketing/site">«Маркетинг → Публикация сайта»</Link>.
    </Notice>
  ));
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
