import Link from 'next/link';
import { Page } from '../../components/page';
import { MarkWhatsNewSeen } from '../../components/shell/whats-new-link';
import { deskShell } from '../../lib/desk-shell';
import { displayDay } from '../../lib/display-date';
import { latestWhatsNew, whatsNewFor } from '../../lib/whats-new';
import { serverT } from '../../i18n/server';

/** «Что нового» (SUP1): короткие записи об изменениях своего направления и общих, свежие сверху */
export default async function WhatsNewPage() {
  const { vertical } = await deskShell();
  const entries = whatsNewFor(vertical);
  const t = await serverT();
  return (
    <Page title={t('Что нового')} subtitle={t('Что изменилось в WETOP после обновлений')}>
      <MarkWhatsNewSeen latest={latestWhatsNew(vertical)} />
      {entries.length === 0 ? (
        <p>{t('Пока записей нет.')}</p>
      ) : (
        entries.map((e) => (
          <article className="panel" key={`${e.date}-${e.title}`}>
            <p className="hint">
              <time dateTime={e.date}>{displayDay(e.date)}</time>
            </p>
            <h2>{t(e.title)}</h2>
            <p>{t(e.text)}</p>
            {e.href && <Link href={e.href}>{t('Открыть')}</Link>}
          </article>
        ))
      )}
    </Page>
  );
}
