'use client';
import { useEffect, useState } from 'react';
import type { SiteTemplate } from '@pms/domain';
import { cx } from '../../../../components/ui';
import type { SiteFacts } from '../../../../lib/site-facts';
import { inertPreviewHtml, previewSpec } from '../../../../lib/site-preview-spec';

/**
 * Карточки шаблонов готовых сайтов (SITE-1): живое мини-превью ровно того сайта, который создастся по шаблону, тем же
 * рендером, что у опубликованного сайта (`apps/sites/src/draft-preview`), без ИИ и без сети. Рамка `srcdoc` без
 * скриптов и без фокусируемых элементов внутри: выбирается карточка целиком (радиокнопка), превью только картинка.
 */
type Renderer = typeof import('../../../../../../sites/src/draft-preview');
let renderer: Promise<Renderer> | null = null;
const loadRenderer = () => (renderer ??= import('../../../../../../sites/src/draft-preview'));

function TemplatePreview({ facts, template }: { facts: SiteFacts; template: SiteTemplate }) {
  const [html, setHtml] = useState<string | null>(null);
  useEffect(() => {
    let off = false;
    void loadRenderer().then((mod) => {
      if (off) return;
      const spec = previewSpec(facts, template.id);
      const r = spec ? mod.renderDraftPreview({ spec, pageId: null, locale: 'ru', assets: {} }) : null;
      setHtml(r?.ok ? inertPreviewHtml(r.html) : null);
    });
    return () => {
      off = true;
    };
  }, [facts, template]);
  return (
    <span className="site-design__shot" aria-hidden="true">
      {html ? (
        <iframe className="site-design__frame" title={`Превью: ${template.name}`} srcDoc={html} sandbox="allow-same-origin" tabIndex={-1} data-testid="site-design-frame" />
      ) : (
        <span className="site-design__frame site-design__frame--empty skeleton" />
      )}
    </span>
  );
}

export function TemplatePicker({
  name,
  facts,
  templates,
  chosen,
  onChoose,
  disabled,
}: {
  name: string;
  facts: SiteFacts;
  templates: SiteTemplate[];
  chosen: string;
  onChoose: (id: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="site-design__cards" data-testid="site-designs">
      {templates.map((tpl) => (
        <label key={tpl.id} className={cx('site-design', chosen === tpl.id && 'is-on', disabled && 'is-off')} data-testid="site-design-card" data-design={tpl.id}>
          <input
            type="radio"
            name={name}
            value={tpl.id}
            checked={chosen === tpl.id}
            disabled={disabled}
            onChange={() => onChoose(tpl.id)}
            className="site-design__radio"
            aria-describedby={`${name}-${tpl.id}-text`}
          />
          <TemplatePreview facts={facts} template={tpl} />
          <span className="site-design__name">{tpl.name}</span>
          <span id={`${name}-${tpl.id}-text`} className="muted site-design__text">
            {tpl.description}
          </span>
        </label>
      ))}
    </div>
  );
}
