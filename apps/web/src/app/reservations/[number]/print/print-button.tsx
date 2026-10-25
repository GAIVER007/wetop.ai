'use client';
import { useT } from '../../../../i18n/locale-provider';
export function PrintButton() {
  const t = useT();
  return (
    <button
      type="button"
      onClick={() => window.print()}
      style={{
        padding: '4px 10px',
        border: '1px solid #cbd0d6',
        borderRadius: 6,
        background: '#fff',
        cursor: 'pointer',
      }}
    >
      {t('Печать')}
    </button>
  );
}
