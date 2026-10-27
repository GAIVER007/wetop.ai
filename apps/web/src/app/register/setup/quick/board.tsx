'use client';
import { useMemo, useRef, useState, useTransition, type ClipboardEvent } from 'react';
import type { BranchPaymentMethod } from '@pms/domain';
import { Alert, Button, Input, Select } from '../../../../components/ui';
import { msg } from '../../../../i18n';
import { useT } from '../../../../i18n/locale-provider';
import { createQuickSalon, type QuickResult } from './actions';
import { QuickDone } from './done';
import {
  emptyQuickStart,
  parseRows,
  quickIssues,
  type QuickIssue,
  type QuickPay,
  type QuickSection,
  type QuickStart,
} from './model';

/** Быстрый запуск салона, вариант Г (владелец 27.10.2026): плитки разделов, поля в окне, одна кнопка «Создать» */
const SECTIONS: Array<{ id: Exclude<QuickSection, 'salon'> | 'salon'; title: string }> = [
  { id: 'salon', title: msg('Салон') },
  { id: 'services', title: msg('Услуги') },
  { id: 'masters', title: msg('Мастера') },
  { id: 'staff', title: msg('Сотрудники') },
  { id: 'products', title: msg('Бар') },
];
const DAYS: Array<[number, string]> = [
  [1, msg('Пн')],
  [2, msg('Вт')],
  [3, msg('Ср')],
  [4, msg('Чт')],
  [5, msg('Пт')],
  [6, msg('Сб')],
  [0, msg('Вс')],
];
/** способы без привязки к стране (владелец: Катар, без Kaspi) */
const PAYMENTS: Array<[BranchPaymentMethod, string]> = [
  ['CASH', msg('Наличные')],
  ['CARD_TERMINAL', msg('Карта')],
  ['BANK_TRANSFER_LEGAL', msg('Перевод на счёт компании')],
  ['BANK_TRANSFER_PERSON', msg('Перевод на личный счёт')],
  ['OTHER', msg('Другое')],
];
const PAY: Array<[QuickPay, string]> = [
  ['PERCENT', msg('Процент')],
  ['FIXED', msg('Оклад')],
  ['FIXED_PLUS_PERCENT', msg('Оклад и процент')],
];
const EMPTY = {
  services: { category: '', name: '', minutes: '', price: '' },
  masters: { name: '', email: '', phone: '', services: [] as string[], timeFrom: '', timeTo: '', pay: 'PERCENT' as QuickPay, fixed: '', percent: '' },
  staff: { name: '', email: '', phone: '', role: 'STAFF' as const },
  products: { category: '', name: '', price: '' },
};

export function QuickStartBoard({ currency, timezone, name }: { currency: string; timezone: string; name: string }) {
  const t = useT();
  const [q, setQ] = useState<QuickStart>(() => {
    const start = emptyQuickStart(currency, timezone);
    return { ...start, salon: { ...start.salon, name }, services: [{ ...EMPTY.services }], masters: [{ ...EMPTY.masters }] };
  });
  const [open, setOpen] = useState<QuickSection>('salon');
  const [result, setResult] = useState<QuickResult | null>(null);
  const [pending, start] = useTransition();
  const attempt = useRef(crypto.randomUUID());
  const issues = useMemo(() => quickIssues(q), [q]);
  const errors = issues.filter((i) => i.level === 'error');
  const of = (section: QuickSection, row: number, field: string) =>
    issues.find((i) => i.section === section && i.row === row && i.field === field);
  const cls = (section: QuickSection, row: number, field: string) => {
    const i = of(section, row, field);
    return i ? (i.level === 'error' ? 'quick-cell is-error' : 'quick-cell is-warning') : 'quick-cell';
  };
  const rows = <K extends 'services' | 'masters' | 'staff' | 'products'>(k: K) => q[k];
  const setRow = <K extends 'services' | 'masters' | 'staff' | 'products'>(k: K, i: number, patch: Partial<QuickStart[K][number]>) =>
    setQ((prev) => {
      const list = [...prev[k]] as QuickStart[K];
      list[i] = { ...list[i]!, ...patch } as QuickStart[K][number];
      return { ...prev, [k]: list };
    });
  const addRow = (k: 'services' | 'masters' | 'staff' | 'products') =>
    setQ((prev) => ({ ...prev, [k]: [...prev[k], { ...EMPTY[k] }] }));
  const removeRow = (k: QuickSection, i: number) =>
    k !== 'salon' && setQ((prev) => ({ ...prev, [k]: prev[k].filter((_, n) => n !== i) }));
  const salon = (patch: Partial<QuickStart['salon']>) => setQ((prev) => ({ ...prev, salon: { ...prev.salon, ...patch } }));

  const apply = (issue: QuickIssue, choice?: NonNullable<QuickIssue['choices']>[number]) => {
    if (choice) {
      if (choice.kind === 'salon-until')
        salon(issue.field === 'timeTo' ? { timeTo: choice.value } : { timeFrom: choice.value });
      else setRow('masters', issue.row, issue.field === 'timeTo' ? { timeTo: choice.value } : { timeFrom: choice.value });
      return;
    }
    if (issue.fix?.kind === 'remove-row') removeRow(issue.section, issue.row);
    else if (issue.fix?.kind === 'set' && issue.section !== 'salon')
      setRow(issue.section as 'masters', issue.row, { [issue.field]: issue.fix.value } as never);
  };

  /** вставка нескольких строк сразу: колонки раскладываются по полям раздела */
  const paste = (k: 'services' | 'masters' | 'staff' | 'products') => (e: ClipboardEvent<HTMLTableSectionElement>) => {
    const text = e.clipboardData.getData('text');
    if (!text.includes('\t') && !text.includes('\n')) return;
    e.preventDefault();
    const cols = { services: 4, masters: 4, staff: 3, products: 3 }[k];
    const data = parseRows(text, cols);
    setQ((prev) => {
      const kept = prev[k].filter((r) => Object.values(r).some((v) => (Array.isArray(v) ? v.length : String(v).trim())));
      const added = data.map((c) =>
        k === 'services'
          ? { category: c[0]!, name: c[1]!, minutes: c[2]!, price: c[3]! }
          : k === 'masters'
            ? { ...EMPTY.masters, name: c[0]!, email: c[1]!, phone: c[2]!, services: c[3] ? c[3].split(/\s*,\s*/).filter(Boolean) : [] }
            : k === 'staff'
              ? { ...EMPTY.staff, name: c[0]!, email: c[1]!, phone: c[2]! }
              : { category: c[0]!, name: c[1]!, price: c[2]! },
      );
      return { ...prev, [k]: [...kept, ...added] };
    });
  };

  const count = (k: QuickSection) =>
    k === 'salon' ? (q.salon.name.trim() ? 1 : 0) : rows(k).filter((r) => Object.values(r).some((v) => (Array.isArray(v) ? v.length : String(v).trim()))).length;
  const state = (k: QuickSection) =>
    issues.some((i) => i.section === k && i.level === 'error') ? 'error' : issues.some((i) => i.section === k) ? 'warning' : count(k) ? 'done' : 'empty';
  const serviceNames = q.services.map((s) => s.name.trim()).filter(Boolean);

  const submit = () =>
    start(async () => {
      setResult(await createQuickSalon(q, attempt.current));
    });

  if (result?.ok && result.summary) return <QuickDone summary={result.summary} warnings={result.warnings} />;

  const issueList = issues.filter((i) => i.section === open);
  return (
    <section className="quick" data-testid="quick-start" aria-label={t('Запуск салона')}>
      <div className="quick-tiles" role="tablist">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={open === s.id}
            className={`quick-tile is-${state(s.id)}${open === s.id ? ' is-open' : ''}`}
            onClick={() => setOpen(s.id)}
          >
            <b>{count(s.id)}</b>
            <span>{t(s.title)}</span>
            <small>
              {state(s.id) === 'done'
                ? t('готово')
                : state(s.id) === 'empty'
                  ? s.id === 'staff' || s.id === 'products'
                    ? t('можно позже')
                    : t('заполнить')
                  : t('проверить')}
            </small>
          </button>
        ))}
      </div>

      <div className="quick-panel" role="tabpanel">
        {open === 'salon' && (
          <div className="quick-salon">
            <label className={cls('salon', 0, 'name')}>
              <span>{t('Название')}</span>
              <Input value={q.salon.name} maxLength={200} onChange={(e) => salon({ name: e.target.value })} />
            </label>
            <label className="quick-cell quick-wide">
              <span>{t('Адрес')}</span>
              <Input value={q.salon.address} maxLength={500} onChange={(e) => salon({ address: e.target.value })} />
            </label>
            <label className="quick-cell">
              <span>{t('Телефон')}</span>
              <Input type="tel" value={q.salon.phone} maxLength={50} onChange={(e) => salon({ phone: e.target.value })} />
            </label>
            <div className={cls('salon', 0, 'days')}>
              <span>{t('Дни работы')}</span>
              <div className="quick-chips">
                {DAYS.map(([d, label]) => (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={q.salon.days.includes(d)}
                    className="quick-chip"
                    onClick={() =>
                      salon({ days: q.salon.days.includes(d) ? q.salon.days.filter((x) => x !== d) : [...q.salon.days, d] })
                    }
                  >
                    {t(label)}
                  </button>
                ))}
              </div>
            </div>
            <div className={cls('salon', 0, 'hours')}>
              <span>{t('Часы')}</span>
              <div className="quick-pair">
                <Input type="time" aria-label={t('С')} value={q.salon.timeFrom} onChange={(e) => salon({ timeFrom: e.target.value })} />
                <Input type="time" aria-label={t('До')} value={q.salon.timeTo} onChange={(e) => salon({ timeTo: e.target.value })} />
              </div>
            </div>
            <div className={cls('salon', 0, 'payments')}>
              <span>{t('Оплата')}</span>
              <div className="quick-chips">
                {PAYMENTS.map(([m, label]) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={q.salon.payments.includes(m)}
                    className="quick-chip"
                    onClick={() =>
                      salon({
                        payments: q.salon.payments.includes(m)
                          ? q.salon.payments.filter((x) => x !== m)
                          : [...q.salon.payments, m],
                      })
                    }
                  >
                    {t(label)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {open === 'services' && (
          <table className="quick-table">
            <thead>
              <tr>
                <th scope="col">{t('Категория')}</th>
                <th scope="col">{t('Услуга')}</th>
                <th scope="col">{t('Минут')}</th>
                <th scope="col">{t('Цена')}</th>
                <th scope="col"><span className="sr-only">{t('Убрать')}</span></th>
              </tr>
            </thead>
            <tbody onPaste={paste('services')}>
              {q.services.map((r, i) => (
                <tr key={i}>
                  <td><Input aria-label={t('Категория')} value={r.category} onChange={(e) => setRow('services', i, { category: e.target.value })} /></td>
                  <td className={cls('services', i, 'name')}><Input aria-label={t('Услуга')} value={r.name} onChange={(e) => setRow('services', i, { name: e.target.value })} /></td>
                  <td className={cls('services', i, 'minutes')}><Input aria-label={t('Минут')} inputMode="numeric" value={r.minutes} onChange={(e) => setRow('services', i, { minutes: e.target.value })} /></td>
                  <td className={cls('services', i, 'price')}><Input aria-label={t('Цена')} inputMode="decimal" value={r.price} onChange={(e) => setRow('services', i, { price: e.target.value })} /></td>
                  <td><Button type="button" tone="ghost" size="sm" aria-label={t('Убрать')} onClick={() => removeRow('services', i)}>×</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {open === 'masters' && (
          <table className="quick-table quick-table--masters">
            <thead>
              <tr>
                <th scope="col">{t('Имя')}</th>
                <th scope="col">{t('Почта')}</th>
                <th scope="col">{t('Телефон')}</th>
                <th scope="col">{t('Услуги')}</th>
                <th scope="col">{t('Часы')}</th>
                <th scope="col">{t('Зарплата')}</th>
                <th scope="col"><span className="sr-only">{t('Убрать')}</span></th>
              </tr>
            </thead>
            <tbody onPaste={paste('masters')}>
              {q.masters.map((m, i) => (
                <tr key={i}>
                  <td className={cls('masters', i, 'name')}><Input aria-label={t('Имя')} value={m.name} onChange={(e) => setRow('masters', i, { name: e.target.value })} /></td>
                  <td className={cls('masters', i, 'email')}><Input aria-label={t('Почта')} type="email" value={m.email} onChange={(e) => setRow('masters', i, { email: e.target.value })} /></td>
                  <td><Input aria-label={t('Телефон')} type="tel" value={m.phone} onChange={(e) => setRow('masters', i, { phone: e.target.value })} /></td>
                  <td className={cls('masters', i, 'services')}>
                    <div className="quick-chips">
                      {serviceNames.map((n) => (
                        <button
                          key={n}
                          type="button"
                          aria-pressed={m.services.includes(n)}
                          className="quick-chip"
                          onClick={() =>
                            setRow('masters', i, {
                              services: m.services.includes(n) ? m.services.filter((x) => x !== n) : [...m.services, n],
                            })
                          }
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className={of('masters', i, 'timeTo') || of('masters', i, 'timeFrom') ? cls('masters', i, of('masters', i, 'timeTo') ? 'timeTo' : 'timeFrom') : 'quick-cell'}>
                    <div className="quick-pair">
                      <Input type="time" aria-label={t('С')} value={m.timeFrom || q.salon.timeFrom} onChange={(e) => setRow('masters', i, { timeFrom: e.target.value })} />
                      <Input type="time" aria-label={t('До')} value={m.timeTo || q.salon.timeTo} onChange={(e) => setRow('masters', i, { timeTo: e.target.value })} />
                    </div>
                  </td>
                  <td className={cls('masters', i, 'pay')}>
                    <div className="quick-pay">
                      <Select aria-label={t('Зарплата')} value={m.pay} onChange={(e) => setRow('masters', i, { pay: e.target.value as QuickPay })}>
                        {PAY.map(([v, label]) => (
                          <option key={v} value={v}>{t(label)}</option>
                        ))}
                      </Select>
                      {m.pay !== 'PERCENT' && (
                        <Input aria-label={t('Оклад')} placeholder={t('Оклад')} inputMode="decimal" value={m.fixed} onChange={(e) => setRow('masters', i, { fixed: e.target.value })} />
                      )}
                      {m.pay !== 'FIXED' && (
                        <Input aria-label={t('Процент')} placeholder="%" inputMode="numeric" value={m.percent} onChange={(e) => setRow('masters', i, { percent: e.target.value })} />
                      )}
                    </div>
                  </td>
                  <td><Button type="button" tone="ghost" size="sm" aria-label={t('Убрать')} onClick={() => removeRow('masters', i)}>×</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {open === 'staff' && (
          <table className="quick-table">
            <thead>
              <tr>
                <th scope="col">{t('Имя')}</th>
                <th scope="col">{t('Почта')}</th>
                <th scope="col">{t('Телефон')}</th>
                <th scope="col">{t('Роль')}</th>
                <th scope="col"><span className="sr-only">{t('Убрать')}</span></th>
              </tr>
            </thead>
            <tbody onPaste={paste('staff')}>
              {q.staff.map((p, i) => (
                <tr key={i}>
                  <td className={cls('staff', i, 'name')}><Input aria-label={t('Имя')} value={p.name} onChange={(e) => setRow('staff', i, { name: e.target.value })} /></td>
                  <td className={cls('staff', i, 'email')}><Input aria-label={t('Почта')} type="email" value={p.email} onChange={(e) => setRow('staff', i, { email: e.target.value })} /></td>
                  <td><Input aria-label={t('Телефон')} type="tel" value={p.phone} onChange={(e) => setRow('staff', i, { phone: e.target.value })} /></td>
                  <td>
                    <Select aria-label={t('Роль')} value={p.role} onChange={(e) => setRow('staff', i, { role: e.target.value as 'STAFF' | 'MANAGER' })}>
                      <option value="STAFF">{t('Администратор')}</option>
                      <option value="MANAGER">{t('Управляющий')}</option>
                    </Select>
                  </td>
                  <td><Button type="button" tone="ghost" size="sm" aria-label={t('Убрать')} onClick={() => removeRow('staff', i)}>×</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {open === 'products' && (
          <table className="quick-table">
            <thead>
              <tr>
                <th scope="col">{t('Категория')}</th>
                <th scope="col">{t('Товар')}</th>
                <th scope="col">{t('Цена, 0 бесплатно')}</th>
                <th scope="col"><span className="sr-only">{t('Убрать')}</span></th>
              </tr>
            </thead>
            <tbody onPaste={paste('products')}>
              {q.products.map((p, i) => (
                <tr key={i}>
                  <td><Input aria-label={t('Категория')} value={p.category} onChange={(e) => setRow('products', i, { category: e.target.value })} /></td>
                  <td className={cls('products', i, 'name')}><Input aria-label={t('Товар')} value={p.name} onChange={(e) => setRow('products', i, { name: e.target.value })} /></td>
                  <td className={cls('products', i, 'price')}><Input aria-label={t('Цена, 0 бесплатно')} inputMode="decimal" value={p.price} onChange={(e) => setRow('products', i, { price: e.target.value })} /></td>
                  <td><Button type="button" tone="ghost" size="sm" aria-label={t('Убрать')} onClick={() => removeRow('products', i)}>×</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {open !== 'salon' && (
          <Button type="button" tone="secondary" onClick={() => addRow(open)}>
            {t('+ Добавить строку')}
          </Button>
        )}

        {issueList.length > 0 && (
          <ul className="quick-issues" data-testid="quick-issues">
            {issueList.map((i, n) => (
              <li key={n} className={i.level === 'error' ? 'quick-fix is-error' : 'quick-fix is-warning'}>
                <span>
                  {i.section !== 'salon' && <b>{rowName(q, i)} </b>}
                  {t(i.text, i.params ?? {})}
                </span>
                {i.fix && (
                  <Button type="button" tone="secondary" size="sm" onClick={() => apply(i)}>
                    {i.fix.kind === 'set' ? i.fix.label : t(i.fix.label)}
                  </Button>
                )}
                {i.choices?.map((c) => (
                  <Button key={c.kind} type="button" tone="secondary" size="sm" onClick={() => apply(i, c)}>
                    {t(c.label, { time: c.value })}
                  </Button>
                ))}
              </li>
            ))}
          </ul>
        )}
      </div>

      {result?.error && <Alert>{result.error}</Alert>}
      <div className="quick-actions">
        <span className="hint">{t('Каждому с почтой придёт приглашение')}</span>
        <Button type="button" className="quick-go" disabled={pending || errors.length > 0} onClick={submit}>
          {pending ? t('Создаём…') : t('Создать салон')}
        </Button>
      </div>
    </section>
  );
}

function rowName(q: QuickStart, i: QuickIssue): string {
  if (i.section === 'salon') return '';
  const row = q[i.section][i.row] as { name?: string } | undefined;
  return row?.name?.trim() ? `${row.name.trim()}:` : '';
}
