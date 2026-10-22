import { getDictionary, type Locale } from '../i18n';

/*
 * Переключатель языка страницы (фаза 1 казахской версии, 21.10.2026): обычная подчёркнутая ссылка на пару
 * текущей страницы, без нового CSS-блока. `data-lang-switch` держат тесты. Рисуется только там, где пара
 * существует: в фазе 1 это страницы раздела «для кого».
 */
export function LangSwitch({
  locale,
  ruPath,
  kkPath,
}: {
  locale: Locale;
  ruPath: string;
  kkPath: string;
}) {
  const t = getDictionary(locale);
  const target = locale === 'kk' ? ruPath : kkPath;
  const label = locale === 'kk' ? t.a11y.switchToRu : t.a11y.switchToKk;
  return (
    <p>
      <a data-lang-switch href={target} hrefLang={locale === 'kk' ? 'ru' : 'kk'}>
        {label}
      </a>
    </p>
  );
}
