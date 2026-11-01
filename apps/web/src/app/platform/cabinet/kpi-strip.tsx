/** Плитки «B» (владелец 30.10.2026): одна полоса цифр с разделителями, подпись сверху, пояснение рядом с цифрой */
export interface KpiItem {
  id: string;
  label: string;
  value: string;
  hint?: string | undefined;
  tone?: 'success' | 'danger' | undefined;
}

export function KpiStrip({ items, testId }: { items: KpiItem[]; testId: string }) {
  return (
    <dl className="kpi-strip" data-testid={testId}>
      {items.map((s) => (
        <div key={s.id} data-tone={s.tone}>
          <dt>{s.label}</dt>
          <dd data-testid={`${testId.replace(/-strip$/, '')}-${s.id}-box`}>
            {/* число отдельным узлом: проверки и чтение экрана берут сумму без подписи */}
            <b data-testid={`${testId.replace(/-strip$/, '')}-${s.id}`}>{s.value}</b>
            {s.hint && <small>{s.hint}</small>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
