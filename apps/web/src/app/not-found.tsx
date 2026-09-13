import Link from 'next/link';
import { Page } from '../components/page';
export default function NotFound() {
  return (
    <Page title="Страница не найдена" width="narrow">
      <section className="empty-state">
        <p>Проверьте адрес или вернитесь к рабочему дню.</p>
        <Link href="/today" className="btn">
          Открыть «Сегодня»
        </Link>
      </section>
    </Page>
  );
}
