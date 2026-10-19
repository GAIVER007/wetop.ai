/**
 * Стойка как приложение на телефоне (PWA1, plans/pwa1-install-2026-10-19.md). Цвета повторяют токены `--primary` и
 * `--bg` (design/tokens.json → tokens.css): манифест читает браузер без CSS, поэтому значения здесь, а совпадение с
 * токенами держит `app/manifest.test.ts`.
 */
export const PWA_THEME = { light: '#085fba', dark: '#48a5ff', background: '#e9f0f8' } as const; // slop-allow: color-literal манифест и ImageResponse читаются без CSS, токены недоступны

/** Синий фон знака из `app/icon.svg` и его буква «W» */
const MARK_FILL = '#2646df'; // slop-allow: color-literal манифест и ImageResponse читаются без CSS, токены недоступны
const MARK_INK = '#fff'; // slop-allow: color-literal манифест и ImageResponse читаются без CSS, токены недоступны
const MARK_W = 'm10 14 5 21h5l4-13 4 13h5l5-21h-5l-3 14-4-14h-4l-4 14-3-14Z';

/**
 * Знак WETOP для `ImageResponse`. Обычный значок со скруглением, как вкладка; маскируемый (`maskable`) заливает
 * квадрат целиком и держит букву в безопасной зоне 80 %, иначе система обрежет её своей маской.
 */
export function Mark({ size, maskable = false }: { size: number; maskable?: boolean }) {
  const glyph = maskable ? size * 0.6 : size;
  return (
    <div
      style={{ // slop-allow: inline-style ImageResponse рисует только inline-стили
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: MARK_FILL,
        borderRadius: maskable ? 0 : size * 0.27,
      }}
    >
      <svg width={glyph} height={glyph} viewBox="0 0 48 48">
        <path d={MARK_W} fill={MARK_INK} />
      </svg>
    </div>
  );
}
