'use client';
import { useEffect, useState } from 'react';
import type { DesignDirection } from '@pms/domain';
import { cx } from '../../../../components/ui';
import type { SiteFacts } from '../../../../lib/site-facts';
import { inertPreviewHtml, previewSpec } from '../../../../lib/site-preview-spec';

/**
 * Карточки дизайна первого экрана (SITE-1): живое мини-превью первого экрана сайта филиала тем же рендером, что у
 * опубликованного сайта (`apps/sites/src/draft-preview`), без ИИ и без сети. Рамка `srcdoc` без скриптов и без
 * фокусируемых элементов внутри: выбирается карточка целиком (радиокнопка), превью только картинка для глаз.
 */
type Renderer = typeof import('../../../../../../sites/src/draft-preview');
let renderer: Promise<Renderer> | null = null;
const loadRenderer = () => (renderer ??= import('../../../../../../sites/src/draft-preview'));

export interface DesignOption {
  /** ключ выбора: `preset:<id>` или `ai:<runId>:<id>` */
  key: string;
  direction: DesignDirection;
  source: 'preset' | 'ai';
}

function DesignPreview({ facts, direction }: { facts: SiteFacts; direction: DesignDirection }) {
  const [html, setHtml] = useState<string | null>(null);
  useEffect(() => {
    let off = false;
    void loadRenderer().then((mod) => {
      if (off) return;
      const r = mod.renderDraftPreview({ spec: previewSpec(facts, direction), pageId: null, locale: 'ru', assets: {} });
      setHtml(r.ok ? inertPreviewHtml(r.html) : null);
    });
    return () => {
      off = true;
    };
  }, [facts, direction]);
  return (
    <span className="site-design__shot" aria-hidden="true">
      {html ? (
        <iframe className="site-design__frame" title={`Превью: ${direction.name}`} srcDoc={html} sandbox="allow-same-origin" tabIndex={-1} data-testid="site-design-frame" />
      ) : (
        <span className="site-design__frame site-design__frame--empty skeleton" />
      )}
    </span>
  );
}

export function DesignPicker({
  name,
  facts,
  options,
  chosen,
  onChoose,
  disabled,
}: {
  name: string;
  facts: SiteFacts;
  options: DesignOption[];
  chosen: string;
  onChoose: (key: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="site-design__cards" data-testid="site-designs">
      {options.map((o) => (
        <label key={o.key} className={cx('site-design', chosen === o.key && 'is-on', disabled && 'is-off')} data-testid="site-design-card" data-design={o.direction.id}>
          <input
            type="radio"
            name={name}
            value={o.key}
            checked={chosen === o.key}
            disabled={disabled}
            onChange={() => onChoose(o.key)}
            className="site-design__radio"
            aria-describedby={`${name}-${o.direction.id}-text`}
          />
          <DesignPreview facts={facts} direction={o.direction} />
          <span className="site-design__name">
            {o.direction.name}
            {o.source === 'ai' && <span className="badge badge--info site-design__badge">ИИ</span>}
          </span>
          <span id={`${name}-${o.direction.id}-text`} className="muted site-design__text">
            {o.direction.shortDescription}
          </span>
        </label>
      ))}
    </div>
  );
}
