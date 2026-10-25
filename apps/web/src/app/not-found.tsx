import Link from 'next/link';
import { Page } from '../components/page';
import { serverT } from '../i18n/server';
export default async function NotFound() {
  const t = await serverT();
  return (
    <Page title={t('Страница не найдена')} width="narrow">
      <section className="empty-state">
        <p>{t('Проверьте адрес или вернитесь к рабочему дню.')}</p>
        {/* «/» ведёт на стартовую страницу направления (у гостиницы «Финансы», у салона и ресторана «Сегодня») */}
        <Link href="/" className="btn">
          {t('На главную')}
        </Link>
      </section>
    </Page>
  );
}
