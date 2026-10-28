'use client';
import { useState } from 'react';
import { Input } from '../../components/ui';
import { useT } from '../../i18n/locale-provider';

/**
 * «Свой период» Главной (владелец 29.10.2026): кнопка открывает «от–до» с календарём (поле даты браузера),
 * «Показать» уходит на /today?from=&to=. Не длиннее 366 дней и не в будущем: проверяет и сервер.
 */
export function OwnerPeriodPicker({ from, to, today, active }: { from: string; to: string; today: string; active: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(from);
  const [end, setEnd] = useState(to);
  const bad = !start || !end || end < start || start > today;
  return (
    <span className="owner-period__custom" data-testid="owner-custom-period">
      <button type="button" className={active ? 'btn btn--secondary is-on' : 'btn btn--secondary'} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {t('Свой период')}
      </button>
      {open && (
        <form className="owner-period__form" method="get" action="/today" role="group" aria-label={t('Свой период')}>
          <label>
            <span>{t('С')}</span>
            <Input type="date" name="from" required max={today} value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label>
            <span>{t('По')}</span>
            <Input type="date" name="to" required min={start || undefined} value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
          <button type="submit" className="btn btn--primary" disabled={bad}>
            {t('Показать')}
          </button>
        </form>
      )}
    </span>
  );
}
