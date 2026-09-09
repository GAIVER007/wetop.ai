'use client';
export function PrintButton() {
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
      Печать
    </button>
  );
}
