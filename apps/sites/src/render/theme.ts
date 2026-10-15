/**
 * Темы рантайма (SiteSpec v0 §5): документ выбирает значения из словарей, цвета и шрифты живут здесь. Все пресеты
 * светлые (`colorScheme` в v0 только `LIGHT`). Контраст каждого сочетания пресета и акцента проверяет тест
 * `theme.test.ts` (WCAG AA 4,5:1) один раз для библиотеки, а не на каждом сайте.
 */
export interface PresetTokens {
  bg: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
}

export const PRESETS: Record<string, PresetTokens> = {
  CALM: { bg: '#ffffff', surface: '#f3f5f7', text: '#1c2630', muted: '#4c5966', border: '#d5dce3' },
  WARM: { bg: '#fffaf4', surface: '#f6ede2', text: '#2a1f16', muted: '#5a4838', border: '#e5d5c2' },
  NIGHT: { bg: '#f4f6fb', surface: '#e6eaf3', text: '#101726', muted: '#465267', border: '#cbd3e2' },
  COAST: { bg: '#f6fbfc', surface: '#e6f1f4', text: '#11303a', muted: '#3e5d67', border: '#c8dfe5' },
};

export const ACCENTS: Record<string, { accent: string; onAccent: string }> = {
  TEAL: { accent: '#0d6a62', onAccent: '#ffffff' },
  INDIGO: { accent: '#3a3db0', onAccent: '#ffffff' },
  TERRACOTTA: { accent: '#9c4127', onAccent: '#ffffff' },
  FOREST: { accent: '#2c6537', onAccent: '#ffffff' },
  GRAPHITE: { accent: '#343c48', onAccent: '#ffffff' },
  GOLD: { accent: '#7d5200', onAccent: '#ffffff' },
};

export const TYPOGRAPHY: Record<string, string> = {
  MODERN: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  CLASSIC: 'Georgia, "Times New Roman", "PT Serif", serif',
  ROUNDED: 'ui-rounded, "SF Pro Rounded", "Nunito", system-ui, sans-serif',
};

export const RADIUS: Record<string, string> = { SHARP: '2px', SOFT: '10px', ROUND: '20px' };
export const DENSITY: Record<string, { section: string; gap: string }> = {
  COMPACT: { section: '40px', gap: '16px' },
  COMFORTABLE: { section: '72px', gap: '24px' },
};

/** Классы `<body>` по теме документа; неизвестное значение темы рантайм не рисует, это ошибка документа */
export function themeClasses(theme: Record<string, unknown>): string {
  const pick = (value: unknown, dict: Record<string, unknown>, prefix: string) => {
    if (typeof value !== 'string' || !(value in dict)) throw new Error(`theme:${prefix}:${String(value)}`);
    return `${prefix}-${value.toLowerCase()}`;
  };
  if (theme['colorScheme'] !== 'LIGHT') throw new Error(`theme:scheme:${String(theme['colorScheme'])}`);
  return [
    pick(theme['preset'], PRESETS, 'p'),
    pick(theme['accent'], ACCENTS, 'a'),
    pick(theme['typography'], TYPOGRAPHY, 't'),
    pick(theme['radius'], RADIUS, 'r'),
    pick(theme['density'], DENSITY, 'd'),
  ].join(' ');
}

const vars = (selector: string, pairs: Record<string, string>) =>
  `${selector}{${Object.entries(pairs).map(([k, v]) => `--${k}:${v}`).join(';')}}`;

export const SITE_CSS = [
  ...Object.entries(PRESETS).map(([k, t]) =>
    vars(`.p-${k.toLowerCase()}`, { bg: t.bg, surface: t.surface, text: t.text, muted: t.muted, border: t.border })),
  ...Object.entries(ACCENTS).map(([k, t]) =>
    vars(`.a-${k.toLowerCase()}`, { accent: t.accent, 'on-accent': t.onAccent })),
  ...Object.entries(TYPOGRAPHY).map(([k, f]) => vars(`.t-${k.toLowerCase()}`, { font: f })),
  ...Object.entries(RADIUS).map(([k, r]) => vars(`.r-${k.toLowerCase()}`, { radius: r })),
  ...Object.entries(DENSITY).map(([k, d]) => vars(`.d-${k.toLowerCase()}`, { section: d.section, gap: d.gap })),
  `*,*::before,*::after{box-sizing:border-box}
[hidden]{display:none!important}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth;scroll-padding-top:88px}
body{margin:0;background:var(--bg);color:var(--text);font-family:var(--font);font-size:17px;line-height:1.6;overflow-wrap:anywhere}
a{color:var(--accent)}
a:focus-visible,summary:focus-visible{outline:3px solid var(--accent);outline-offset:3px;border-radius:4px}
img{max-width:100%;height:auto}
.skip{position:absolute;left:-9999px;top:0}
.skip:focus{left:16px;top:16px;z-index:10;background:var(--bg);padding:12px 16px}
.wrap{width:100%;max-width:1120px;margin:0 auto;padding:0 20px}
.site-header{position:sticky;top:0;z-index:5;background:var(--bg);border-bottom:1px solid var(--border)}
.site-header .wrap{display:flex;flex-wrap:wrap;align-items:center;gap:8px 24px;padding-top:12px;padding-bottom:12px}
.brand{font-weight:700;font-size:20px;color:var(--text);text-decoration:none;min-height:44px;display:inline-flex;align-items:center}
.brand__logo{height:32px;width:auto;max-width:160px;margin-right:8px;object-fit:contain}
.nav{display:flex;flex-wrap:wrap;gap:4px 16px;margin-right:auto}
.nav a{color:var(--text);text-decoration:none;min-height:44px;display:inline-flex;align-items:center}
.nav a:hover{color:var(--accent);text-decoration:underline}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:12px 24px;border-radius:var(--radius);background:var(--accent);color:var(--on-accent);font-weight:600;text-decoration:none;border:2px solid var(--accent)}
.btn:hover{filter:brightness(1.08)}
.btn--ghost{background:transparent;color:var(--accent)}
main section{padding:var(--section) 0}
main section:nth-of-type(even){background:var(--surface)}
h1,h2,h3{line-height:1.2;margin:0 0 16px}
h1{font-size:clamp(32px,6vw,52px)}
h2{font-size:clamp(26px,4vw,36px)}
h3{font-size:20px}
p{margin:0 0 16px}
.lead{font-size:20px;color:var(--muted);max-width:720px}
.muted{color:var(--muted)}
.hero{padding:calc(var(--section) * 1.2) 0}
.actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:24px}
.grid{display:grid;gap:var(--gap);grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));margin-top:24px}
.card{background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);padding:24px}
main section:nth-of-type(odd) .card{background:var(--surface)}
.list{list-style:none;margin:24px 0 0;padding:0;display:grid;gap:12px}
.list--cols{grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))}
.item{display:flex;gap:12px;align-items:flex-start}
.icon{flex:none;width:28px;height:28px;color:var(--accent)}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 0;padding:0;list-style:none}
.chips li{border:1px solid var(--border);border-radius:999px;padding:4px 12px;font-size:15px}
.row{display:grid;gap:8px 24px;grid-template-columns:1fr;border-top:1px solid var(--border);padding:24px 0}
@media (min-width:800px){.row{grid-template-columns:1fr 2fr}}
.faq details{border-top:1px solid var(--border);padding:8px 0}
.faq summary{cursor:pointer;font-weight:600;min-height:44px;display:flex;align-items:center}
.contact-list{list-style:none;padding:0;margin:24px 0 0;display:grid;gap:12px}
.contact-list a{min-height:44px;display:inline-flex;align-items:center}
.cta-band{background:var(--accent);color:var(--on-accent)}
main section.cta-band{background:var(--accent)}
.cta-band .btn{background:var(--on-accent);color:var(--accent);border-color:var(--on-accent)}
.cta-band p{color:var(--on-accent)}
.booking-note{margin-top:16px}
#pms-booking{margin-top:24px}
.site-footer{border-top:1px solid var(--border);padding:40px 0;font-size:15px;color:var(--muted)}
.site-footer nav{display:flex;flex-wrap:wrap;gap:4px 20px;margin-bottom:16px}
.site-footer a{color:var(--text);min-height:44px;display:inline-flex;align-items:center}
.from-price{font-weight:700;font-size:19px;color:var(--text);margin:8px 0 0}
.pricing .row{align-items:center}
.page-title{padding-top:48px;margin-bottom:0}
.not-found{padding:96px 0}`,
].join('\n');
