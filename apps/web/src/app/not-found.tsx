import Link from 'next/link';
import { Page } from '../components/page';
export default function NotFound() {
  return (
    <Page title="Страница не найдена" width="narrow">
      <section className="empty-state">
        <p>Проверьте адрес или вернитесь к рабочему дню.</p>
        {/* «/» ведёт на стартовую страницу направления (у гостиницы «Финансы», у салона и ресторана «Сегодня») */}
        <Link href="/" className="btn">
          На главную
        </Link>
      </section>
    </Page>
  );
}
