import Link from 'next/link';
import { Page } from '../../components/page';
import { Badge } from '../../components/ui';
import { GUIDES, guideLang, guidePages } from '../../lib/guides';
import { currentLocale, serverT } from '../../i18n/server';
import './learn.css';

/**
 * «Обучение» (владелец 30.10.2026, вариант B): все инструкции строками. Строка: первая страница, название, описание,
 * для кого, сколько страниц и «Открыть». Открыто всем ролям и должностям, данных арендатора здесь нет.
 */
export default async function LearnPage() {
  const t = await serverT();
  const lang = guideLang(await currentLocale());
  return (
    <Page title={t('Обучение')} subtitle={t('Все инструкции WETOP. Нажмите на инструкцию, чтобы открыть и прочитать её целиком.')}>
      <ul className="learn-list" data-testid="learn-list">
        {GUIDES.map((g) => (
          <li key={g.slug} className="learn-row" data-testid="learn-row">
            <Link href={`/learn/${g.slug}`} className="learn-row__link">
              {/* обложка: третья страница, на ней уже скрин экрана; готовая картинка из public, без оптимизатора */}
              <img className="learn-row__cover" src={guidePages(g, lang)[2]} alt="" width={86} height={122} loading="lazy" />
              <span className="learn-row__text">
                <strong className="learn-row__title">{t(g.title)}</strong>
                <span className="learn-row__desc">{t(g.description)}</span>
              </span>
              <Badge tone="info">{t(g.audience)}</Badge>
              <span className="learn-row__meta">{t('{n} стр.', { n: g.files[lang].pages })}</span>
              <span className="btn btn--primary">{t('Открыть')}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Page>
  );
}
