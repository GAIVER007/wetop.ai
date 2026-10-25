'use client';
import qrcode from 'qrcode-generator';
import { useT } from '../../i18n/locale-provider';

/** Пять звёзд выбором (§39, §40): та же разметка на планшете смены и на телефоне гостя */
export function StarsInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const t = useT();
  return (
    <div className="rest-stars" role="radiogroup" aria-label={t('Звёзды')}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={t('{n} из 5', { n })}
          className="rest-star"
          data-on={n <= value}
          onClick={() => onChange(n)}
        >
          {n <= value ? '★' : '☆'}
        </button>
      ))}
    </div>
  );
}

/**
 * QR-код ссылки (§40). Всегда тёмным по светлому, и в тёмной теме: перевёрнутый код читают не все камеры,
 * поэтому обёртка берёт токены светлой темы.
 */
export function QrCode({ text, label }: { text: string; label: string }) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  let d = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.isDark(y, x)) d += `M${x} ${y}h1v1h-1z`;
  return (
    <div className="rest-qr" data-theme="light">
      <svg viewBox={`-4 -4 ${n + 8} ${n + 8}`} role="img" aria-label={label} shapeRendering="crispEdges">
        <path d={d} fill="currentColor" />
      </svg>
    </div>
  );
}
