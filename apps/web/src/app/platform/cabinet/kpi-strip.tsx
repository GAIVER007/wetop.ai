import Link from 'next/link';

/**
 * Полоса цифр (владелец 30.10.2026, «везде как на Сайт wetop.ai» 01.11.2026): одна строка с разделителями, подпись сверху
 * в одну строку, пояснение рядом с цифрой. Ячейка со ссылкой ведёт к списку (например, фильтр клиентов).
 */
export interface KpiItem {
  id: string;
  label: string;
  value: string;
  hint?: string | undefined;
  tone?: 'success' | 'danger' | 'warning' | undefined;
  href?: string | undefined;
}

export function KpiStrip({ items, testId }: { items: KpiItem[]; testId: string }) {
  const base = testId.replace(/-strip$/, '');
  return (
    <dl className="kpi-strip" data-testid={testId}>
      {items.map((s) => {
        const body = (
          <>
            <dt>{s.label}</dt>
            <dd data-testid={`${base}-${s.id}-box`}>
              {/* число отдельным узлом: проверки и чтение экрана берут значение без подписи */}
              <b data-testid={`${base}-${s.id}`}>{s.value}</b>
              {s.hint && <small>{s.hint}</small>}
            </dd>
          </>
        );
        return (
          <div key={s.id} data-tone={s.tone}>
            {s.href ? (
              <Link className="kpi-strip__link" href={s.href} prefetch={false} data-testid={`${base}-${s.id}-link`}>
                {body}
              </Link>
            ) : (
              body
            )}
          </div>
        );
      })}
    </dl>
  );
}
