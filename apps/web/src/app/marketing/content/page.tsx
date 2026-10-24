import Link from 'next/link';
import { requireFeature } from '../../../lib/vertical-guard';
import { verticalCopy } from '../../../lib/vertical-copy';
import type { WebVertical } from '../../../lib/vertical-landing';
import { intlLocale, msg, type Translate } from '../../../i18n';
import { dateFormat } from '../../../i18n/dates';
import { currentLocale, serverT } from '../../../i18n/server';
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
/** Слова направления фразами целиком (KK3): русские падежи `VerticalCopy` не подставляются в перевод */
const VERTICAL_WORDS: Record<WebVertical, { photo: string; reviews: string; example: string }> = {
  HOSPITALITY: {
    photo: msg('Фото номера'),
    reviews: msg('Из отзывов гостей'),
    example: msg('Опишите, что нужно, например: фото номера в стиле «уют и минимализм».'),
  },
  BEAUTY: {
    photo: msg('Фото работы мастера'),
    reviews: msg('Из отзывов клиентов'),
    example: msg('Опишите, что нужно, например: фото работы мастера в стиле «уют и минимализм».'),
  },
  FOOD_SERVICE: {
    photo: msg('Фото блюда'),
    reviews: msg('Из отзывов гостей'),
    example: msg('Опишите, что нужно, например: фото блюда в стиле «уют и минимализм».'),
  },
};

const formats = (vertical: WebVertical, photoIcon: IconName): Array<{ title: string; text: string; icon: IconName }> => [
  { title: VERTICAL_WORDS[vertical].photo, text: msg('Снимок в нужном стиле'), icon: photoIcon },
  { title: msg('Видео-тур'), text: msg('Ролик до 30 секунд'), icon: 'board' },
  { title: msg('Пост для Instagram'), text: msg('Текст и картинка'), icon: 'send' },
  { title: msg('Сторис'), text: msg('Вертикальный кадр'), icon: 'journal' },
  { title: msg('Пост с отзывом'), text: VERTICAL_WORDS[vertical].reviews, icon: 'chat' },
  { title: msg('Рилс'), text: msg('Короткое видео'), icon: 'refresh' },
  { title: msg('Баннер для рекламы'), text: msg('Для модуля «Реклама»'), icon: 'channels' },
];
const KINDS = [msg('Фото'), msg('Видео'), msg('Посты'), msg('Сторис'), msg('Рилс'), msg('Рассылка')];

function Ideas({ vertical, photoIcon, t }: { vertical: WebVertical; photoIcon: IconName; t: Translate }) {
  return (
    <div className="marketing-screen__stack">
      <ul className="marketing-kinds" aria-label={t('Форматы')}>
        {KINDS.map((kind) => (
          <li key={kind}>{t(kind)}</li>
        ))}
      </ul>
      <ul className="marketing-formats" data-testid="marketing-content-formats">
        <li className="marketing-format marketing-format--create" aria-disabled="true">
          <Icon name="plus" aria-hidden="true" />
          <strong>{t('Создать с ИИ')}</strong>
          <span>{t(VERTICAL_WORDS[vertical].example)}</span>
        </li>
        {formats(vertical, photoIcon).map((f) => (
          <li key={f.title} className="marketing-format" aria-disabled="true">
            <span className="marketing-format__art" aria-hidden="true">
              <Icon name={f.icon} />
            </span>
            <strong>{t(f.title)}</strong>
            <span>{t(f.text)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function MarketingContentPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireFeature('/marketing/content');
  const vertical: WebVertical = me.context?.vertical ?? 'HOSPITALITY';
  const copy = verticalCopy(vertical);
  const [t, locale] = await Promise.all([serverT(), currentLocale()]);
  const dayLabel = (iso: string) =>
    dateFormat(intlLocale(locale), { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
  const q = await searchParams;
  const weekParam = typeof q.week === 'string' ? q.week : undefined;
  let week: ContentWeekView | null = null;
  let loadError: string | null = null;
  try {
    week = await contentApi.week(weekParam);
  } catch (e) {
    loadError = e instanceof Error ? e.message : t('Не удалось загрузить черновики');
  }
  const days = week ? Array.from({ length: 7 }, (_, i) => addDays(week.week.from, i)) : [];
  return (
    <Page
      crumbs={<BackToModules />}
      title={t('Контент')}
      subtitle={t('Тексты постов с ИИ по данным вашего филиала. Правьте, ставьте на день недели и копируйте в соцсети.')}
    >
      <div className="marketing-screen" data-testid="marketing-content-screen">
        {loadError && (
          <Alert boxed data-testid="content-load-error">
            {t('Черновики не загрузились: {error}. Остальное на странице работает.', { error: loadError })}
          </Alert>
        )}
        <Tabs
          label={t('Разделы контента')}
          panels={[
            {
              id: 'generate',
              label: t('Создать пост'),
              content: week ? (
                <ContentStudio ctas={week.ctas} days={days} />
              ) : (
                <EmptyState title={t('Создание недоступно')}>{t('Обновите страницу через минуту.')}</EmptyState>
              ),
            },
            {
              id: 'plan',
              label: t('План публикаций'),
              content: week ? (
                <div className="marketing-screen__stack">
                  <nav className="content-week-nav" aria-label={t('Неделя')}>
                    <Link className="btn btn--ghost btn--sm" href={`/marketing/content?week=${addDays(week.week.from, -7)}#plan`}>
                      {t('Прошлая неделя')}
                    </Link>
                    <span data-testid="content-week-range">
                      {t('с {from} по {to}', { from: dayLabel(week.week.from), to: dayLabel(week.week.to) })}
                    </span>
                    <Link className="btn btn--ghost btn--sm" href={`/marketing/content?week=${addDays(week.week.from, 7)}#plan`}>
                      {t('Следующая неделя')}
                    </Link>
                  </nav>
                  <ContentPlan items={week.items} from={week.week.from} today={week.today} ctas={week.ctas} />
                </div>
              ) : (
                <WeekPlan testId="marketing-content-plan" />
              ),
            },
            { id: 'ideas', label: t('Идеи'), content: <Ideas vertical={vertical} photoIcon={copy.photoIcon} t={t} /> },
            {
              id: 'library',
              label: t('Медиатека'),
              content: (
                <EmptyState
                  title={t('Изображения сайта')}
                  actions={
                    <Link className="btn btn--secondary" href="/marketing/site/assets">
                      {t('Открыть изображения')}
                    </Link>
                  }
                >
                  {t('Фото, загруженные для сайта и из менеджера каналов, уже лежат в медиатеке сайта.')}
                </EmptyState>
              ),
            },
          ]}
        />
      </div>
    </Page>
  );
}

const addDays = (iso: string, n: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
