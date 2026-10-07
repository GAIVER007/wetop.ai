import { unstable_rethrow } from 'next/navigation';
import { requireVertical } from '../../../lib/vertical-guard';
import { Page } from '../../../components/page';
import { LoadError } from '../../../components/load-error';
import { loadErrorProps } from '../../../lib/load-error';
import { EmptyState } from '../../../components/ui';
import { marketingSiteApi } from '../../../lib/api';
import { deskShell } from '../../../lib/desk-shell';
import { MarketingCrumb } from '../../website/parts';
import { PublicationBoard } from './board';
import '../marketing.css';

/**
 * «Маркетинг → Публикация сайта» (MKT7, `docs/marketing/site-publication-v0.md` §6). Тонкая страница управления, не
 * редактор (MKT9): состояние, ревизии, адрес, превью, публикация, пауза, журнал с откатом, источник брони для
 * ИИ-продавца (Q-275) и архив. Право `settings` и строгий scope филиала проверяет API.
 */
export default async function MarketingSitePage() {
  await requireVertical(['HOSPITALITY']);
  const shell = await deskShell();
  // журнал и источник брони есть только у существующего сайта: без него страница показывает пустое состояние
  const loaded = await marketingSiteApi
    .current()
    .then(async (current) => {
      if (!current.site) return { ok: true as const, current, journal: null, booking: null };
      const [journal, booking] = await Promise.all([marketingSiteApi.publications(), marketingSiteApi.bookingSource()]);
      return { ok: true as const, current, journal, booking };
    })
    .catch((error: unknown) => {
      unstable_rethrow(error);
      return { ok: false as const, error };
    });
  const title = 'Публикация сайта';
  if (!loaded.ok)
    return (
      <Page crumbs={<MarketingCrumb />} title={title}>
        <LoadError testId="marketing-site-error" {...loadErrorProps(loaded.error)} />
      </Page>
    );
  const site = loaded.current.site;
  return (
    <Page
      crumbs={<MarketingCrumb />}
      title={title}
      subtitle="Предпросмотр, публикация и откат управляемого сайта филиала."
    >
      {site && loaded.journal && loaded.booking ? (
        <PublicationBoard
          site={site}
          publications={loaded.journal.publications}
          booking={loaded.booking}
          readOnly={shell.readOnly}
        />
      ) : (
        <EmptyState title="Сайт филиала ещё не создан" data-testid="marketing-site-empty">
          Когда у филиала появится сайт и первая версия, здесь можно будет посмотреть её и опубликовать.
        </EmptyState>
      )}
    </Page>
  );
}
