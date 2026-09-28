import Link from 'next/link';
import type { ReactNode } from 'react';
import { Badge, type BadgeTone } from '../../components/ui';

/** Строка «Систем» Главной (A2): название, состояние словом и подробности отдельными метками (§14) */
export function SystemRow({
  name,
  word,
  tone,
  details = [],
  testId,
  href,
}: {
  name: string;
  word: string;
  tone: BadgeTone;
  details?: ReactNode[];
  testId: string;
  href?: string;
}) {
  return (
    <li className="systems-row" data-testid={testId}>
      <span className="systems-row__head">
        {href ? (
          <Link className="systems-row__name" href={href}>
            {name}
          </Link>
        ) : (
          <span className="systems-row__name">{name}</span>
        )}
        <Badge tone={tone}>{word}</Badge>
      </span>
      {details.length > 0 && (
        <span className="systems-row__details">
          {details.map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </span>
      )}
    </li>
  );
}
