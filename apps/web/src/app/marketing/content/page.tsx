import Link from 'next/link';
import { requireVertical } from '../../../lib/vertical-guard';
import '../marketing.css';
import { Icon, type IconName } from '../../../components/icon';
import { Page } from '../../../components/page';
import { Tabs } from '../../../components/tabs';
import { Button, EmptyState } from '../../../components/ui';
import { BackToModules, ModuleSoon, WeekPlan } from '../parts';

/**
 * Модуль «Контент» (макет Marketing 2.0 владельца 09.10.2026, экран 3 «генерация и планирование»; MKT10.7–10.8 в
 * plans/mkt10-marketing-2-audit-2026-10-09.md). Генерации и плана публикаций ещё нет, поэтому экран показывает
 * форматы и пустую неделю, без выдуманных постов. Живое здесь одно: медиатека ведёт в изображения сайта (MKT8).
 * Своих запросов к API у страницы нет, право `settings` как у хаба.
 */
const FORMATS: Array<{ title: string; text: string; icon: IconName }> = [
  { title: 'Фото номера', text: 'Снимок в нужном стиле', icon: 'bed' },
  { title: 'Видео-тур', text: 'Ролик до 30 секунд', icon: 'board' },
  { title: 'Пост для Instagram', text: 'Текст и картинка', icon: 'send' },
  { title: 'История (Stories)', text: 'Вертикальный кадр', icon: 'journal' },
  { title: 'Пост с отзывом', text: 'Из отзывов гостей', icon: 'chat' },
  { title: 'Reels', text: 'Короткое видео', icon: 'refresh' },
  { title: 'Баннер для рекламы', text: 'Для модуля «Реклама»', icon: 'channels' },
];
const KINDS = ['Фото', 'Видео', 'Посты', 'Stories', 'Reels', 'Email'];
const SOON = 'marketing-content-soon';

function Ideas() {
  return (
    <div className="marketing-screen__stack">
      <ul className="marketing-kinds" aria-label="Форматы">
        {KINDS.map((kind) => (
          <li key={kind}>{kind}</li>
        ))}
      </ul>
      <ul className="marketing-formats" data-testid="marketing-content-formats">
        <li className="marketing-format marketing-format--create">
          <Icon name="plus" aria-hidden="true" />
          <strong>Создать с ИИ</strong>
          <span>Опишите, что нужно, например: фото номера в стиле «уют и минимализм».</span>
        </li>
        {FORMATS.map((f) => (
          <li key={f.title} className="marketing-format">
            <span className="marketing-format__art" aria-hidden="true">
              <Icon name={f.icon} />
            </span>
            <strong>{f.title}</strong>
            <span>{f.text}</span>
          </li>
        ))}
      </ul>
      <section aria-labelledby="marketing-content-week" className="marketing-screen__stack">
        <h2 id="marketing-content-week" className="marketing-screen__title">
          План публикаций на неделю
        </h2>
        <WeekPlan testId="marketing-content-week" />
      </section>
    </div>
  );
}

export default async function MarketingContentPage() {
  await requireVertical(['HOSPITALITY']);
  return (
    <Page
      crumbs={<BackToModules />}
      title="Контент"
      subtitle="Создавайте фото, тексты, видео и посты с помощью ИИ. Планируйте публикации во все соцсети."
      actions={
        <Button disabled aria-describedby={SOON}>
          <Icon name="plus" width={16} aria-hidden="true" />
          Создать контент
        </Button>
      }
    >
      <div className="marketing-screen" data-testid="marketing-content-screen">
        <ModuleSoon id={SOON} testId={SOON}>
          Модуль в разработке: генерация и план публикаций появятся в следующих этапах. Изображения сайта уже живут в
          медиатеке.
        </ModuleSoon>
        <Tabs
          label="Разделы контента"
          panels={[
            { id: 'ideas', label: 'Идеи', content: <Ideas /> },
            {
              id: 'generate',
              label: 'Генерация',
              content: <EmptyState title="Пока пусто">ИИ будет создавать тексты, фото и видео по вашему описанию.</EmptyState>,
            },
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
            {
              id: 'plan',
              label: 'План публикаций',
              content: <WeekPlan testId="marketing-content-plan" />,
            },
            {
              id: 'stats',
              label: 'Статистика',
              content: <EmptyState title="Пока пусто">Охваты и переходы по публикациям появятся после первых постов.</EmptyState>,
            },
          ]}
        />
      </div>
    </Page>
  );
}
