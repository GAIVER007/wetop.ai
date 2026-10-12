import Link from 'next/link';
import { JsonLd, breadcrumbLd } from './json-ld';

/*
 * Хлебные крошки (11.10.2026): видимая цепочка «Главная / Направление / Тип» и та же цепочка в разметке
 * BreadcrumbList одним компонентом, чтобы они не разошлись. Последний шаг текущая страница, без ссылки.
 */
export function Breadcrumbs({
  trail,
  label,
}: {
  trail: Array<{ name: string; path: string }>;
  label: string;
}) {
  return (
    <>
      <nav className="breadcrumbs" aria-label={label}>
        <ol>
          {trail.map((step, index) =>
            index === trail.length - 1 ? (
              <li key={step.path} aria-current="page">
                {step.name}
              </li>
            ) : (
              <li key={step.path}>
                <Link href={step.path}>{step.name}</Link>
              </li>
            ),
          )}
        </ol>
      </nav>
      {/* после навигации: стили верха страницы ищут крошки первым элементом контейнера */}
      <JsonLd data={breadcrumbLd(trail)} />
    </>
  );
}
