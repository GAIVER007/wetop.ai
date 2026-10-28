import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import { requireFeature } from '../../../../lib/vertical-guard';
import { Page } from '../../../../components/page';
import { LoadError } from '../../../../components/load-error';
import { loadErrorProps } from '../../../../lib/load-error';
import { Tabs } from '../../../../components/tabs';
import { siteLeadsApi } from '../../../../lib/api';
import { deskShell } from '../../../../lib/desk-shell';
import { MarketingCrumb } from '../../../website/parts';
import { currentLocale, serverT } from '../../../../i18n/server';
import { msg } from '../../../../i18n';
import { LeadsBoard } from './board';
import { LEAD_FILTERS, leadFilter } from './lead-flow';
import '../../marketing.css';

/**
 * «Заявки с сайта» (аудит «Сайт и SEO» 28.10.2026, S3): просьбы перезвонить и вопросы с сайта филиала (SITE-5).
 * Запись салона, бронь стола и бронь номера с выбором времени сразу встают в журнал, сюда не попадают.
 */
const FILTER_LABEL = { NEW: msg('Новые'), IN_PROGRESS: msg('В работе'), DONE: msg('Готово'), SPAM: msg('Спам') } as const;

export default async function SiteLeadsPage({ searchParams }: { searchParams?: Promise<{ status?: string }> }) {
  await requireFeature('/marketing/site/leads');
  const status = leadFilter((await searchParams)?.status);
  const shell = await deskShell();
  const t = await serverT();
  const locale = await currentLocale();
  const title = t('Заявки с сайта');
  const loaded = await siteLeadsApi
    .list(status)
    .then((data) => ({ ok: true as const, data }))
    .catch((error: unknown) => {
      unstable_rethrow(error);
      return { ok: false as const, error };
    });
  if (!loaded.ok)
    return (
      <Page crumbs={<MarketingCrumb />} title={title}>
        <LoadError testId="site-leads-load-error" {...loadErrorProps(loaded.error)} />
      </Page>
    );
  return (
    <Page
      crumbs={<MarketingCrumb />}
      title={title}
      subtitle={t('Просьбы перезвонить и вопросы с сайта. Запись и бронь с выбором времени сразу в журнале.')}
      actions={
        <Link className="btn btn--secondary" href="/marketing/site/editor" data-testid="site-leads-editor">
          {t('Редактор сайта')}
        </Link>
      }
    >
      <Tabs
        label={t('Заявки по статусу')}
        items={LEAD_FILTERS.map((s) => ({
          href: s === 'NEW' ? '/marketing/site/leads' : `/marketing/site/leads?status=${s}`,
          label: t(FILTER_LABEL[s]),
          current: s === status,
          ...(s === 'NEW' ? { count: loaded.data.newCount } : {}),
        }))}
      />
      <LeadsBoard key={status} items={loaded.data.items} readOnly={shell.readOnly} locale={locale} />
    </Page>
  );
}
