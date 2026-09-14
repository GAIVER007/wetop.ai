import { notFound } from 'next/navigation';

/**
 * Страницы только для разработки (DESIGN.md: `/design-system`): в production-сборке отвечают 404.
 * `notFound()` бросает исключение, которое Next превращает в страницу «не найдено»
 * (документация Next, functions/not-found). Вызывать в теле серверного компонента до рендера.
 */
export function developmentOnly(env: string | undefined = process.env.NODE_ENV): void {
  if (env === 'production') notFound();
}
