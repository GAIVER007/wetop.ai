import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';
import '../app/summary-line.css';

/**
 * Итоги экрана одной строкой вместо ряда плиток (владелец против KPI-плиток везде, аудит гостиницы 22.10.2026:
 * шахматка, «Гости», «Номерной фонд»). Части через запятую (DESIGN.md §14: без «·»), число жирным с прежним testid,
 * часть со ссылкой ведёт к своему списку, как раньше плитка.
 */
export interface SummaryPart {
  key: string;
  /** подпись перед числом: «заезд», «требует внимания» */
  label: ReactNode;
  value: ReactNode;
  testId?: string;
  /** слова после числа: «из 5» */
  after?: ReactNode;
  href?: string;
}

export function SummaryLine({
  parts,
  label,
  testId,
  className,
}: {
  parts: SummaryPart[];
  /** имя группы для чтения с экрана и проверок: «Сегодня на объекте» */
  label: string;
  testId?: string;
  className?: string;
}) {
  return (
    <p
      className={className ? `summary-line ${className}` : 'summary-line'}
      role="group"
      aria-label={label}
      data-testid={testId}
    >
      {parts.map((part, i) => {
        const body = (
          <>
            {part.label} <b data-testid={part.testId}>{part.value}</b>
            {part.after}
          </>
        );
        return (
          <Fragment key={part.key}>
            {part.href ? (
              <Link href={part.href} className="summary-line__part summary-line__link">
                {body}
              </Link>
            ) : (
              <span className="summary-line__part">{body}</span>
            )}
            {i < parts.length - 1 && ', '}
          </Fragment>
        );
      })}
    </p>
  );
}
