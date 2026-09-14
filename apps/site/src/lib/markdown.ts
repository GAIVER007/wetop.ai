import { Marked } from 'marked';

/*
 * Markdown статей → HTML во время сборки. Тексты — файлы репозитория, им доверяем, поэтому HTML внутри Markdown
 * не вычищается. Заголовок статьи на странице — единственный h1: «# …» в тексте становится разделом второго уровня.
 */
const markdown = new Marked({
  gfm: true,
  walkTokens(token) {
    if (token.type === 'heading' && token.depth === 1) token.depth = 2;
  },
});

export function renderMarkdown(source: string): string {
  // Широкая таблица прокручивается в своей рамке, а не растягивает страницу на телефоне.
  return markdown
    .parse(source, { async: false })
    .replace(/<table>/g, '<div class="table-scroll"><table>')
    .replace(/<\/table>/g, '</table></div>');
}
