import Link from 'next/link';
import { BackToModules } from '../marketing/parts';
import type { TrackedSiteCard } from '../../lib/api';
import { EmptyState, Notice, Stack } from '../../components/ui';
import { WEBSITE_TABS, WEBSITE_TITLE, type WebsiteView } from '../../lib/website';
import { Tabs } from '../../components/tabs';
import { serverT } from '../../i18n/server';

/**
 * Сайт объекта, продукт «Маркетинга» (MKT2): над заголовком возврат в хаб. Один вид на весь модуль: тот же
 * «Назад к модулям», что у «Рекламы» и «Контента» по макету Marketing 2.0 (мастер-проход UI 11.10.2026)
 */
export function MarketingCrumb() {
  return <BackToModules />;
}

/** Вкладки модуля: общий `Tabs` маршрутами, как у «ИИ-продавца» и «Каналов» */
export async function WebsiteTabs({ current }: { current: WebsiteView }) {
  const t = await serverT();
  return (
    <div data-testid="website-tabs">
      <Tabs
        label={t(WEBSITE_TITLE)}
        items={WEBSITE_TABS.map((tab) => ({ href: tab.href, label: t(tab.label), current: tab.view === current }))}
      />
    </div>
  );
}

/**
 * MKT7: сайт счётчика управляемого сайта WETOP настраивает только публикация. Здесь его не правят и не удаляют
 * (API ответит 409 MANAGED_SITE_READ_ONLY), поэтому вместо формы строка со ссылкой туда, где он настраивается
 */
export async function ManagedSitesNotice({ cards }: { cards: TrackedSiteCard[] }) {
  const t = await serverT();
  return cards.map((card) => (
    <Notice tone="muted" key={card.site.id} data-testid="website-managed-site">
      {t('«{name}» это сайт WETOP: домены, пауза и бронь настраиваются в', { name: card.site.name })}{' '}
      <Link href="/marketing/site">{t('«Маркетинг → Публикация сайта»')}</Link>.
    </Notice>
  ));
}

/**
 * Сайта нет или у него только домен-заглушка: пустое состояние, а не «сайт» с зелёным статусом. Заготовку в базе
 * не трогаем — её ключ уже в выданном коде для сайта; достаточно вписать настоящий адрес в «Настройках».
 */
export async function WebsiteNotConnected({ drafts }: { drafts: TrackedSiteCard[] }) {
  const t = await serverT();
  return (
    <Stack>
      <EmptyState
        data-testid="website-not-connected"
        title={t('Сайт ещё не подключён')}
        actions={
          <Link className="btn" href="/website/settings">
            {t('Подключить сайт')}
          </Link>
        }
      >
        {t('Подключите существующий сайт, чтобы принимать с него бронирования и видеть аналитику.')}
      </EmptyState>
      {drafts.map((draft) => (
        <Notice tone="muted" key={draft.site.id} data-testid="website-draft">
          {t('Заготовка «{name}» ждёт адреса сайта: пока его нет, WETOP не принимает с сайта ни посещения, ни брони. Код, который уже выдан для сайта, менять не придётся.', { name: draft.site.name })}
        </Notice>
      ))}
    </Stack>
  );
}
