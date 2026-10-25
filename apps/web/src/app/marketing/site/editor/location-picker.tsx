'use client';
import { useState, useTransition } from 'react';
import { Badge, cx } from '../../../../components/ui';
import type { Loaded, SiteLocation, SiteStatus } from '../../../../lib/site-facts';
import { chooseSiteLocationAction } from './actions';
import { msg } from '../../../../i18n';
import { useT } from '../../../../i18n/locale-provider';

/**
 * Выбор филиала на первом экране «Сайт и SEO» (SITE-1, план §1 шаг 1): список филиалов организации с направлением и
 * статусом сайта, текущий филиал стойки отмечен. Выбор другого переключает стойку тем же действием, что переключатель
 * в шапке (`selectBranch`), и возвращает на этот экран: все запросы конструктора идут уже от выбранного филиала.
 */
const VERTICAL: Record<string, string> = { HOSPITALITY: msg('Гостиница'), BEAUTY: msg('Салон'), FOOD_SERVICE: msg('Ресторан') };
const STATUS: Record<SiteStatus, { label: string; tone: 'neutral' | 'info' | 'ok' | 'warn' }> = {
  NONE: { label: msg('Нет сайта'), tone: 'neutral' },
  DRAFT: { label: msg('Черновик'), tone: 'info' },
  PUBLISHED: { label: msg('Опубликован'), tone: 'ok' },
  ARCHIVED: { label: msg('В архиве'), tone: 'warn' },
};

export function LocationPicker({ locations, currentId }: { locations: Loaded<SiteLocation[]>; currentId: string | null }) {
  const t = useT();
  const [pending, start] = useTransition();
  const [target, setTarget] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const choose = (id: string) => {
    if (id === currentId || pending) return;
    setError(null);
    setTarget(id);
    window.dispatchEvent(new Event('wetop-scope-switch'));
    start(async () => {
      try {
        const reply = await chooseSiteLocationAction(id);
        setError(reply.message);
      } catch (e) {
        // переход Next (redirect) приходит как исключение действия: страница сменится сама
        if (e instanceof Error && /NEXT_REDIRECT/.test(e.message)) return;
        setError(t('Не удалось переключить филиал. Обновите страницу и повторите.'));
      }
      window.dispatchEvent(new Event('wetop-scope-switch-failed'));
      setTarget(null);
    });
  };
  return (
    <section className="site-start__locations" aria-labelledby="site-locations-title" data-testid="site-locations">
      <h3 id="site-locations-title" className="site-start__step">
        {t('Филиал')}
      </h3>
      {!locations.ok ? (
        <p className="muted" role="alert">
          {t('Список филиалов не загрузился: {message}', { message: locations.message })}
        </p>
      ) : (
        <ul className="site-locations">
          {locations.data.map((l) => {
            const current = l.id === currentId;
            const status = l.siteStatus ? STATUS[l.siteStatus] : null;
            return (
              <li key={l.id}>
                <button
                  type="button"
                  className={cx('site-location', current && 'is-current')}
                  aria-current={current ? 'true' : undefined}
                  aria-busy={target === l.id || undefined}
                  disabled={pending && target !== l.id}
                  onClick={() => choose(l.id)}
                  data-testid="site-location"
                >
                  <span className="site-location__name">{l.name}</span>
                  <span className="site-location__meta">
                    <span className="muted">{VERTICAL[l.vertical] ? t(VERTICAL[l.vertical]!) : l.vertical}</span>
                    {status && <Badge tone={status.tone}>{t(status.label)}</Badge>}
                    {current && <span className="site-location__current">{t('выбран')}</span>}
                    {target === l.id && <span className="muted">{t('Переключаем…')}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {error && (
        <p className="muted" role="alert" data-testid="site-locations-error">
          {error}
        </p>
      )}
    </section>
  );
}
