import type {
  ButtonHTMLAttributes,
  CSSProperties,
  HTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TableHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

/**
 * Примитивы интерфейса стойки (срез 10, ADR-027). Без клиентского JS: годятся и серверным, и
 * клиентским компонентам. Все `data-*`, `title`, `disabled` и прочие атрибуты проходят насквозь —
 * e2e держатся за `data-testid`, `role="alert"`, имена полей и тексты кнопок, они не меняются.
 * Внешний вид — только в `app/globals.css`.
 */

/** Склейка классов без зависимостей. */
export const cx = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ');

export function Help({ children, title = 'Подробнее' }: { children: ReactNode; title?: string }) {
  return (
    <details className="context-help">
      <summary>{title}</summary>
      <div>{children}</div>
    </details>
  );
}

export type ButtonTone =
  'primary' | 'secondary' | 'danger' | 'warning' | 'success' | 'info' | 'ghost';

export function Button({
  tone = 'primary',
  size,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: ButtonTone | undefined;
  size?: 'sm' | 'xs' | undefined;
}) {
  return (
    <button
      className={cx('btn', tone !== 'primary' && `btn--${tone}`, size && `btn--${size}`, className)}
      {...rest}
    />
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx('inp', className)} {...rest} />;
}

export function Select({ className, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx('inp', className)} {...rest} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx('inp', className)} {...rest} />;
}

/** Подпись над полем (или слева, `inline`). Текст подписи идёт первым — так поле находится по label. */
export function Field({
  label,
  inline,
  className,
  children,
  ...rest
}: LabelHTMLAttributes<HTMLLabelElement> & { label: ReactNode; inline?: boolean | undefined }) {
  return (
    <label className={cx('field', inline && 'field--inline', className)} {...rest}>
      {label}
      {children}
    </label>
  );
}

/** Белый блок с рамкой. Для форм используйте `className="panel"` прямо на `<form>`. */
export function Panel({
  title,
  size,
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLElement> & { title?: ReactNode; size?: 'lg' | undefined }) {
  return (
    <section className={cx('panel', size && `panel--${size}`, className)} {...rest}>
      {title && <b className={cx('panel__title', size && 'panel__title--lg')}>{title}</b>}
      {children}
    </section>
  );
}

export function PanelTitle({ children, size }: { children: ReactNode; size?: 'lg' | undefined }) {
  return <b className={cx('panel__title', size && 'panel__title--lg')}>{children}</b>;
}

export function SectionTitle({
  children,
  first,
  className,
  ...rest
}: HTMLAttributes<HTMLHeadingElement> & { first?: boolean | undefined }) {
  return (
    <h2 className={cx('section-title', first && 'section-title--first', className)} {...rest}>
      {children}
    </h2>
  );
}

/** Ряд карточек-показателей. `min` — минимальная ширина карточки в px. */
export function Stats({
  min,
  className,
  style,
  ...rest
}: HTMLAttributes<HTMLElement> & { min?: number | undefined }) {
  const vars = min ? ({ '--min': `${min}px` } as CSSProperties) : undefined;
  return <section className={cx('stats', className)} style={{ ...vars, ...style }} {...rest} />;
}

export function Stat({
  label,
  value,
  hint,
  hintTone,
  testId,
  tone,
  size,
  children,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  hintTone?: 'warn' | undefined;
  testId?: string | undefined;
  tone?: 'alarm' | 'warn' | undefined;
  size?: 'big' | 'compact' | undefined;
  children?: ReactNode;
}) {
  return (
    <div className={cx('stat', tone && `stat--${tone}`, size && `stat--${size}`)}>
      <div className="stat__label">{label}</div>
      <div className="stat__value" data-testid={testId}>
        {value}
      </div>
      {hint && <div className={cx('stat__hint', hintTone === 'warn' && 'warn-text')}>{hint}</div>}
      {children}
    </div>
  );
}

/** Подпись и значение внутри панели, без карточки: ключ сайта, «последнее событие» и подобное. */
export function Fact({
  label,
  value,
  testId,
}: {
  label: ReactNode;
  value: ReactNode;
  testId?: string | undefined;
}) {
  return (
    <div>
      <div className="fact__label">{label}</div>
      <div className="fact__value" data-testid={testId}>
        {value}
      </div>
    </div>
  );
}

export function Table({
  size,
  dense,
  nowrap,
  plain,
  className,
  ...rest
}: TableHTMLAttributes<HTMLTableElement> & {
  size?: 'sm' | undefined;
  dense?: boolean | undefined;
  nowrap?: boolean | undefined;
  plain?: boolean | undefined;
}) {
  return (
    <div
      className="table-scroll"
      tabIndex={0}
      role="region"
      aria-label={rest['aria-label'] || 'Таблица, прокрутка по горизонтали'}
    >
      <table
        className={cx(
          'tbl',
          size && `tbl--${size}`,
          dense && 'tbl--dense',
          nowrap && 'tbl--nowrap',
          plain && 'tbl--plain',
          className,
        )}
        {...rest}
      />
    </div>
  );
}

export type BadgeTone = 'neutral' | 'info' | 'ok' | 'warn' | 'danger';

export function Badge({
  tone = 'neutral',
  className,
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone | undefined }) {
  return (
    <span className={cx('badge', tone !== 'neutral' && `badge--${tone}`, className)} {...rest} />
  );
}

const STATUS_TONE: Record<string, BadgeTone> = {
  TENTATIVE: 'warn',
  CONFIRMED: 'info',
  CHECKED_IN: 'ok',
  CHECKED_OUT: 'neutral',
  CANCELLED: 'danger',
  NO_SHOW: 'danger',
};

/** Статус брони/проживания. Подпись даёт страница (у стойки свои слова: «ждём», «живёт»). */
export function StatusBadge({
  status,
  label,
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { status: string; label: string }) {
  return (
    <Badge tone={STATUS_TONE[status] ?? 'neutral'} {...rest}>
      {label}
    </Badge>
  );
}

/** Сообщение об ошибке: всегда `role="alert"` — на нём стоят e2e. `boxed` — баннер с рамкой. */
export function Alert({
  tone,
  boxed,
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement> & {
  tone?: 'warning' | 'success' | undefined;
  boxed?: boolean | undefined;
}) {
  return (
    <div
      role="alert"
      className={cx('alert', tone && `alert--${tone}`, boxed && 'alert--boxed', className)}
      {...rest}
    />
  );
}

/** Сообщение об успехе / подсказка результата — без роли alert. */
export function Notice({
  tone,
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { tone?: 'muted' | undefined }) {
  return <div className={cx('notice', tone && `notice--${tone}`, className)} {...rest} />;
}

export function Row({
  align,
  gap,
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { align?: 'end' | undefined; gap?: 'lg' | undefined }) {
  return (
    <div
      className={cx('row', align && `row--${align}`, gap && `row--${gap}`, className)}
      {...rest}
    />
  );
}

export function Stack({
  gap,
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { gap?: 'sm' | undefined }) {
  return <div className={cx('stack', gap && `stack--${gap}`, className)} {...rest} />;
}

/** Сетка «сколько влезет»: `min` — минимальная ширина колонки в px. */
export function Grid({
  min,
  gap,
  className,
  style,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { min?: number | undefined; gap?: 'sm' | undefined }) {
  const vars = min ? ({ '--min': `${min}px` } as CSSProperties) : undefined;
  return (
    <div
      className={cx('grid-auto', gap && `grid-auto--${gap}`, className)}
      style={{ ...vars, ...style }}
      {...rest}
    />
  );
}

export function Legend({ items }: { items: Array<{ color: string; label: string }> }) {
  return (
    <div className="legend">
      {items.map((i) => (
        <span key={i.label}>
          <span className="legend__swatch" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}
