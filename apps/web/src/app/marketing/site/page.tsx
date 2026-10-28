import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import { requireFeature } from '../../../lib/vertical-guard';
import { Page } from '../../../components/page';
import { LoadError } from '../../../components/load-error';
import { loadErrorProps } from '../../../lib/load-error';
import { EmptyState } from '../../../components/ui';
import { marketingSiteApi } from '../../../lib/api';
import { deskShell } from '../../../lib/desk-shell';
import { MarketingCrumb } from '../../website/parts';
import { PublicationBoard } from './board';
import { serverT } from '../../../i18n/server';
import '../marketing.css';

/**
 * «Маркетинг → Публикация сайта» (MKT7, `docs/marketing/site-publication-v0.md` §6). Тонкая страница управления, не
 * редактор (MKT9): состояние, ревизии, адрес, превью, публикация, пауза, журнал с откатом, источник брони для
 * ИИ-продавца (Q-275) и архив. Право `marketing` и строгий scope филиала проверяет API.
 */
export default async function MarketingSitePage() {
  await requireFeature('/marketing/site');
  const shell = await deskShell();
  const t = await serverT();
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
  const title = t('Публикация сайта');
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
      subtitle={t('Предпросмотр, публикация и откат управляемого сайта филиала.')}
      actions={
        <>
          <Link className="btn btn--secondary" href="/marketing/site/editor" data-testid="publication-editor-link">
            {t('Редактор сайта')}
          </Link>
          <Link className="btn btn--secondary" href="/marketing/site/assets" data-testid="publication-assets-link">
            {t('Изображения сайта')}
          </Link>
          <Link className="btn btn--secondary" href="/marketing/site/leads" data-testid="publication-leads-link">
            {t('Заявки с сайта')}
          </Link>
        </>
      }
    >
      {site && loaded.journal && loaded.booking ? (
        <PublicationBoard
          site={site}
          publications={loaded.journal.publications}
          booking={loaded.booking}
          readOnly={shell.readOnly}
        />
      ) : (
        <EmptyState title={t('Сайт филиала ещё не создан')} data-testid="marketing-site-empty">
          {t('Когда у филиала появится сайт и первая версия, здесь можно будет посмотреть её и опубликовать.')}
        </EmptyState>
      )}
    </Page>
  );
}
