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
import { Icon, type IconName } from './icon';

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

/**
 * Легенда статусов. Глиф обязателен: смысл не держится только на цвете (DESIGN.md §1 п. 4, §9),
 * и те же глифы стоят на плашках шахматки — легенда читается как подпись к ним.
 */
export function Legend({
  items,
  ...rest
}: HTMLAttributes<HTMLDivElement> & {
  /** Глиф — символ текста, как на плашке; значок — из набора (§7), как в строке ячейки; без цвета — без образца */
  items: Array<{ color?: string; label: string; glyph?: string; icon?: IconName }>;
}) {
  return (
    <div className="legend" {...rest}>
      {items.map((i) => (
        <span key={i.label}>
          {i.color && <span className="legend__swatch" style={{ background: i.color }} />}
          {i.glyph && (
            <b className="legend__glyph" aria-hidden="true">
              {i.glyph}
            </b>
          )}
          {i.icon && (
            <b className="legend__glyph legend__icon" aria-hidden="true">
              <Icon name={i.icon} />
            </b>
          )}
          {i.label}
        </span>
      ))}
    </div>
  );
}

/**
 * Полоса состояния службы (21.09.2026): главный итог слева — число с тоном и фразой о том, требует ли
 * что-то человека, — и факты справа. Заменяет пару «ряд плиток с числами + панель фактов на четыре
 * колонки», которая занимала весь первый экран и повторяла числа списка под ней (DESIGN.md §8).
 *
 * Тон только у черты и числа: заливки у полосы нет — иначе она спорит с плашками статусов (§9).
 */
export function StateBar({
  tone = 'calm',
  label,
  value,
  summary,
  children,
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement> & {
  tone?: 'alarm' | 'warn' | 'calm' | undefined;
  label: ReactNode;
  value: ReactNode;
  summary?: ReactNode;
}) {
  return (
    <div className={cx('panel', 'state-bar', className)} {...rest}>
      <div className="state-bar__state" data-tone={tone}>
        <div className="fact__label">{label}</div>
        <p className="state-bar__value">{value}</p>
        {summary && <p className="state-bar__summary">{summary}</p>}
      </div>
      <dl className="state-bar__facts">{children}</dl>
    </div>
  );
}

/** Факт в полосе состояния: подпись и значение словами; `children` — пояснение под значением. */
export function StateFact({
  label,
  value,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { label: ReactNode; value: ReactNode }) {
  // внутри <dl> у группы могут быть только <dt> и <dd>: подстроки факта — ещё один <dd>
  // (axe «definition-list» на /channels, 21.09)
  return (
    <div {...rest}>
      <dt className="fact__label">{label}</dt>
      <dd className="fact__value">{value}</dd>
      {children && <dd className="fact__sub">{children}</dd>}
    </div>
  );
}

/**
 * Пустое состояние (DESIGN.md §8 и §14, B4): что пусто и что сделать. Заголовок — одна фраза о том,
 * чего нет; текст — следующий шаг; `actions` — ссылки или кнопки, которые его делают. Иконка — из
 * набора, 32 px, цвет акцента. На месте `.empty-state`, который экраны собирали каждый по-своему.
 */
export function EmptyState({
  icon,
  title,
  actions,
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLElement> & {
  icon?: ReactNode;
  title?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className={cx('empty-state', className)} {...rest}>
      {icon}
      {title && <h3 className="empty-state__title">{title}</h3>}
      {children && <p className="empty-state__text">{children}</p>}
      {actions && <div className="empty-state__actions">{actions}</div>}
    </section>
  );
}

/**
 * Скелетон: серая плашка формы будущего содержимого. Скрыт от читалки — о загрузке говорит
 * `LoadingState`; при `prefers-reduced-motion` не мигает (общее правило в CSS).
 */
export function Skeleton({
  variant = 'row',
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement> & {
  variant?: 'title' | 'stat' | 'row' | 'text' | undefined;
}) {
  return (
    <div
      aria-hidden="true"
      className={cx('skeleton', `skeleton-${variant}`, className)}
      {...rest}
    />
  );
}

/**
 * Состояние загрузки блока или экрана: `aria-busy` на области, живая подпись для читалки и скелетоны
 * той формы, что займёт содержимое (по умолчанию — строки таблицы). Слово, а не крутилка (§8).
 */
export function LoadingState({
  label = 'Загружаем данные…',
  rows = 3,
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { label?: string | undefined; rows?: number | undefined }) {
  return (
    <div className={cx('loading-state', className)} aria-busy="true" {...rest}>
      {children ?? Array.from({ length: rows }, (_, i) => <Skeleton key={i} />)}
      <span className="sr-only" role="status">
        {label}
      </span>
    </div>
  );
}
