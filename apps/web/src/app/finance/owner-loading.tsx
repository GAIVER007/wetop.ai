import { serverT } from '../../i18n/server';

export function OwnerPlaceholder({
  label,
  variant,
}: {
  label: string;
  variant: 'load' | 'today' | 'outlook';
}) {
  return (
    <div
      className={`owner-placeholder owner-placeholder--${variant}`}
      role="status"
      aria-label={label}
      aria-busy="true"
    >
      <span className="sr-only">{label}</span>
      <span className="owner-placeholder-title" aria-hidden="true" />
      <span className="owner-placeholder-value" aria-hidden="true" />
      <span className="owner-placeholder-line" aria-hidden="true" />
    </div>
  );
}

export async function AttentionPlaceholder() {
  const t = await serverT();
  return (
    <div className="owner-attention owner-attention-pending" role="status">
      {t('Проверяем события…')}
    </div>
  );
}
