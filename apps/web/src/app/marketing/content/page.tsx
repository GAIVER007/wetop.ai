import Link from 'next/link';
import { requireFeature } from '../../../lib/vertical-guard';
import { verticalCopy, type VerticalCopy } from '../../../lib/vertical-copy';
import '../marketing.css';
import { Icon, type IconName } from '../../../components/icon';
import { Page } from '../../../components/page';
import { Tabs } from '../../../components/tabs';
import { Alert, EmptyState } from '../../../components/ui';
import { contentApi, type ContentWeekView } from '../../../lib/api';
import { BackToModules, WeekPlan } from '../parts';
import { ContentPlan, ContentStudio } from './studio';
import './content.css';

/**
 * Модуль «Контент» (макет Marketing 2.0 владельца 09.10.2026, экран 3 «генерация и планирование»). С 23.10.2026
 * (CONTENT-DRAFTS-20261022) работают тексты постов: ИИ пишет 1–2 варианта по карточке филиала, человек правит и
 * ставит черновик на день недели. В соцсети WETOP не публикует; картинки и видео следующими срезами.
 * Право `marketing` как у хаба; данные недели из `/marketing/content/drafts`.
 */
const formats = (c: VerticalCopy): Array<{ title: string; text: string; icon: IconName }> => [
  { title: `Фото ${c.photoSubject}`, text: 'Снимок в нужном стиле', icon: c.photoIcon },
  { title: 'Видео-тур', text: 'Ролик до 30 секунд', icon: 'board' },
  { title: 'Пост для Instagram', text: 'Текст и картинка', icon: 'send' },
  { title: 'Сторис', text: 'Вертикальный кадр', icon: 'journal' },
  { title: 'Пост с отзывом', text: `Из отзывов ${c.clientsOf}`, icon: 'chat' },
  { title: 'Рилс', text: 'Короткое видео', icon: 'refresh' },
  { title: 'Баннер для рекламы', text: 'Для модуля «Реклама»', icon: 'channels' },
];
const KINDS = ['Фото', 'Видео', 'Посты', 'Сторис', 'Рилс', 'Рассылка'];

function Ideas({ copy }: { copy: VerticalCopy }) {
  return (
    <div className="marketing-screen__stack">
      <ul className="marketing-kinds" aria-label="Форматы">
        {KINDS.map((kind) => (
          <li key={kind}>{kind}</li>
        ))}
      </ul>
      <ul className="marketing-formats" data-testid="marketing-content-formats">
        <li className="marketing-format marketing-format--create" aria-disabled="true">
          <Icon name="plus" aria-hidden="true" />
          <strong>Создать с ИИ</strong>
          <span>Опишите, что нужно, например: фото {copy.photoSubject} в стиле «уют и минимализм».</span>
        </li>
        {formats(copy).map((f) => (
          <li key={f.title} className="marketing-format" aria-disabled="true">
            <span className="marketing-format__art" aria-hidden="true">
              <Icon name={f.icon} />
            </span>
            <strong>{f.title}</strong>
            <span>{f.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function MarketingContentPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireFeature('/marketing/content');
  const copy = verticalCopy(me.context?.vertical);
  const q = await searchParams;
  const weekParam = typeof q.week === 'string' ? q.week : undefined;
  let week: ContentWeekView | null = null;
  let loadError: string | null = null;
  try {
    week = await contentApi.week(weekParam);
  } catch (e) {
    loadError = e instanceof Error ? e.message : 'Не удалось загрузить черновики';
  }
  const days = week ? Array.from({ length: 7 }, (_, i) => addDays(week.week.from, i)) : [];
  return (
    <Page
      crumbs={<BackToModules />}
      title="Контент"
      subtitle="Тексты постов с ИИ по данным вашего филиала. Правьте, ставьте на день недели и копируйте в соцсети."
    >
      <div className="marketing-screen" data-testid="marketing-content-screen">
        {loadError && (
          <Alert boxed data-testid="content-load-error">
            Черновики не загрузились: {loadError}. Остальное на странице работает.
          </Alert>
        )}
        <Tabs
          label="Разделы контента"
          panels={[
            {
              id: 'generate',
              label: 'Создать пост',
              content: week ? (
                <ContentStudio ctas={week.ctas} days={days} />
              ) : (
                <EmptyState title="Создание недоступно">Обновите страницу через минуту.</EmptyState>
              ),
            },
            {
              id: 'plan',
              label: 'План публикаций',
              content: week ? (
                <div className="marketing-screen__stack">
                  <nav className="content-week-nav" aria-label="Неделя">
                    <Link className="btn btn--ghost btn--sm" href={`/marketing/content?week=${addDays(week.week.from, -7)}#plan`}>
                      ← Прошлая неделя
                    </Link>
                    <span data-testid="content-week-range">
                      с {dayLabel(week.week.from)} по {dayLabel(week.week.to)}
                    </span>
                    <Link className="btn btn--ghost btn--sm" href={`/marketing/content?week=${addDays(week.week.from, 7)}#plan`}>
                      Следующая неделя →
                    </Link>
                  </nav>
                  <ContentPlan items={week.items} from={week.week.from} today={week.today} ctas={week.ctas} />
                </div>
              ) : (
                <WeekPlan testId="marketing-content-plan" />
              ),
            },
            { id: 'ideas', label: 'Идеи', content: <Ideas copy={copy} /> },
            {
              id: 'library',
              label: 'Медиатека',
              content: (
                <EmptyState
                  title="Изображения сайта"
                  actions={
                    <Link className="btn btn--secondary" href="/marketing/site/assets">
                      Открыть изображения
                    </Link>
                  }
                >
                  Фото, загруженные для сайта и из менеджера каналов, уже лежат в медиатеке сайта.
                </EmptyState>
              ),
            },
          ]}
        />
      </div>
    </Page>
  );
}

const dayLabel = (iso: string) =>
  new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
const addDays = (iso: string, n: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
