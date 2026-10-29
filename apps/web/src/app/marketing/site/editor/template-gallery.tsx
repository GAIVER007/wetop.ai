'use client';
import { useEffect, useState } from 'react';
import type { SiteTemplate } from '@pms/domain';
import { Overlay } from '../../../../components/overlay';
import { Button, cx } from '../../../../components/ui';
import type { SiteFacts } from '../../../../lib/site-facts';
import { inertPreviewHtml, previewSpec } from '../../../../lib/site-preview-spec';
import { msg } from '../../../../i18n';
import { useT } from '../../../../i18n/locale-provider';

/**
 * Шаблоны готовых сайтов картинками (SITE-1, поручение владельца 15.10.2026: «шаблоны должны сразу отображаться, а
 * не текстом; каждый клиент может открыть, посмотреть, проверить и выбрать»). Карточка: живое мини-превью ровно того
 * сайта, который получится по шаблону из данных филиала (тот же рендер, что у опубликованного сайта, без ИИ и сети),
 * название, описание, «Посмотреть» (сайт целиком в окне, компьютер или телефон) и «Выбрать».
 */
type Renderer = typeof import('../../../../../../sites/src/draft-preview');
let renderer: Promise<Renderer> | null = null;
const loadRenderer = () => (renderer ??= import('../../../../../../sites/src/draft-preview'));

/** Разметка сайта по шаблону (только картинка: без скриптов и фокусируемого) */
function useTemplateHtml(facts: SiteFacts, templateId: string, spec?: Record<string, unknown> | null): string | null {
  const [html, setHtml] = useState<string | null>(null);
  useEffect(() => {
    let off = false;
    void loadRenderer().then((mod) => {
      if (off) return;
      const doc = spec ?? previewSpec(facts, templateId);
      const r = doc ? mod.renderDraftPreview({ spec: doc, pageId: null, locale: 'ru', assets: {} }) : null;
      setHtml(r?.ok ? inertPreviewHtml(r.html) : null);
    });
    return () => {
      off = true;
    };
  }, [facts, templateId, spec]);
  return html;
}

/**
 * Живое превью сайта по промту (владелец 29.10.2026): тот же документ и тот же рендер, что у опубликованного сайта;
 * перерисовывается, когда меняется текст промта
 */
export function PromptPreview({ facts, spec, label }: { facts: SiteFacts; spec: Record<string, unknown> | null; label: string }) {
  const html = useTemplateHtml(facts, '', spec);
  return html ? (
    <iframe className="site-prompt__frame" title={label} srcDoc={html} sandbox="allow-same-origin" tabIndex={-1} data-testid="site-prompt-frame" />
  ) : (
    <span className="site-prompt__frame site-design__frame--empty skeleton" />
  );
}

function Shot({ facts, template }: { facts: SiteFacts; template: SiteTemplate }) {
  const t = useT();
  const html = useTemplateHtml(facts, template.id);
  return (
    <span className="site-design__shot" aria-hidden="true">
      {html ? (
        <iframe className="site-design__frame" title={t('Превью: {name}', { name: t(template.name) })} srcDoc={html} sandbox="allow-same-origin" tabIndex={-1} data-testid="site-design-frame" />
      ) : (
        <span className="site-design__frame site-design__frame--empty skeleton" />
      )}
    </span>
  );
}

/** Окно «Посмотреть»: сайт по шаблону целиком, с прокруткой, в ширину компьютера или телефона */
function TemplateViewer({
  facts,
  template,
  chosen,
  onClose,
  onChoose,
  disabled,
}: {
  facts: SiteFacts;
  template: SiteTemplate;
  chosen: boolean;
  onClose: () => void;
  onChoose: () => void;
  disabled: boolean;
}) {
  const t = useT();
  const html = useTemplateHtml(facts, template.id);
  const [device, setDevice] = useState<'desktop' | 'phone'>('desktop');
  const name = t(template.name);
  return (
    <Overlay open onClose={onClose} title={t('Шаблон «{name}»', { name })} size="lg" trapFocus className="tpl-viewer">
      <div className="tpl-viewer__body" data-testid="tpl-viewer">
        <p className="muted tpl-viewer__text">
          {t('{description}. Так будет выглядеть ваш сайт с данными филиала из WETOP.', { description: t(template.description) })}
        </p>
        <div className="tpl-viewer__bar">
          <div className="ed-preview__device" role="group" aria-label={t('Ширина просмотра')}>
            {(
              [
                ['desktop', msg('Компьютер')],
                ['phone', msg('Телефон')],
              ] as const
            ).map(([key, label]) => (
              <button key={key} type="button" className={cx('ed-preview__device-btn', device === key && 'is-on')} aria-pressed={device === key} onClick={() => setDevice(key)}>
                {t(label)}
              </button>
            ))}
          </div>
          <span className="tpl-viewer__grow" />
          <Button type="button" tone="secondary" onClick={onClose}>
            {t('Закрыть')}
          </Button>
          <Button
            type="button"
            disabled={disabled || chosen}
            onClick={() => {
              onChoose();
              onClose();
            }}
            data-testid="tpl-viewer-choose"
          >
            {chosen ? t('Выбран') : t('Выбрать этот шаблон')}
          </Button>
        </div>
        <div className={cx('tpl-viewer__stage', device === 'phone' && 'is-phone')}>
          {html ? (
            <iframe className="tpl-viewer__frame" title={t('Сайт по шаблону «{name}»', { name })} srcDoc={html} sandbox="allow-same-origin" data-testid="tpl-viewer-frame" />
          ) : (
            <span className="tpl-viewer__frame skeleton" />
          )}
        </div>
      </div>
    </Overlay>
  );
}

export function TemplateGallery({
  facts,
  templates,
  chosen,
  onChoose,
  disabled,
  compact = false,
}: {
  facts: SiteFacts;
  templates: SiteTemplate[];
  chosen: string | null;
  onChoose: (id: string) => void;
  disabled: boolean;
  /** узкая колонка (простой экран): карточки в один столбец */
  compact?: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState<SiteTemplate | null>(null);
  return (
    <>
      <div
        className={cx('site-design__cards', compact && 'site-design__cards--compact')}
        role="radiogroup"
        aria-label={t('Шаблон сайта')}
        data-testid="site-designs"
        onKeyDown={(e) => {
          // стрелки как у группы радиокнопок: выбор соседнего шаблона и фокус на нём
          const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
          if (!step || disabled || !(e.target as HTMLElement).classList.contains('site-design__pick')) return;
          e.preventDefault();
          const i = templates.findIndex((x) => x.id === chosen);
          const next = templates[(i + step + templates.length) % templates.length]!;
          onChoose(next.id);
          const picks = e.currentTarget.querySelectorAll<HTMLButtonElement>('.site-design__pick');
          picks[templates.indexOf(next)]?.focus();
        }}
      >
        {templates.map((tpl) => {
          const on = chosen === tpl.id;
          return (
            <div key={tpl.id} className={cx('site-design', on && 'is-on', disabled && 'is-off')} data-testid="site-design-card" data-design={tpl.id}>
              <button
                type="button"
                className="site-design__pick"
                role="radio"
                aria-checked={on}
                tabIndex={on || (chosen === null && tpl === templates[0]) ? 0 : -1}
                aria-label={`${t(tpl.name)}: ${t(tpl.description)}`}
                disabled={disabled}
                onClick={() => onChoose(tpl.id)}
                data-testid="setup-template-option"
              >
                <Shot facts={facts} template={tpl} />
              </button>
              <span className="site-design__name">
                {t(tpl.name)}
                {on && <span className="site-design__badge">{t('Выбран')}</span>}
              </span>
              <span className="muted site-design__text">{t(tpl.description)}</span>
              <span className="site-design__actions">
                <Button type="button" tone="secondary" size="sm" onClick={() => setOpen(tpl)} data-testid="site-design-view">
                  {t('Посмотреть')}
                </Button>
                <Button type="button" size="sm" disabled={disabled || on} onClick={() => onChoose(tpl.id)} data-testid="site-design-choose">
                  {on ? t('Выбран') : t('Выбрать')}
                </Button>
              </span>
            </div>
          );
        })}
      </div>
      {open && (
        <TemplateViewer
          facts={facts}
          template={open}
          chosen={chosen === open.id}
          onClose={() => setOpen(null)}
          onChoose={() => onChoose(open.id)}
          disabled={disabled}
        />
      )}
    </>
  );
}
