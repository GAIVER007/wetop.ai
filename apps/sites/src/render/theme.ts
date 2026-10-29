import { siteFontsCss } from './fonts';

/**
 * Темы рантайма (SiteSpec v0 §5): документ выбирает значения из словарей, цвета и шрифты живут здесь. Пресеты светлые,
 * кроме NOIR (схема `DARK`, пилот «Тёмная роскошь» 28.10.2026: светлые акценты CHAMPAGNE и ROSE только на нём). Контраст каждого сочетания пресета и акцента проверяет тест
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
  NOIR: { bg: '#0d0b0a', surface: '#17130f', text: '#efe6da', muted: '#b3a594', border: '#2e2721' },
  PEACH: { bg: '#fff6f0', surface: '#ffe9dc', text: '#1a1033', muted: '#4a3d63', border: '#1a1033' },
  SAGE: { bg: '#f5f2ec', surface: '#ebe6dc', text: '#26302b', muted: '#56625b', border: '#dcd5c8' },
};
/** Пресеты тёмной схемы и акценты для тёмного фона: то же правило, что у валидатора домена */
export const DARK_PRESETS = new Set(['NOIR']);
export const DARK_ACCENTS = new Set(['CHAMPAGNE', 'ROSE']);

export const ACCENTS: Record<string, { accent: string; onAccent: string }> = {
  TEAL: { accent: '#0d6a62', onAccent: '#ffffff' },
  INDIGO: { accent: '#3a3db0', onAccent: '#ffffff' },
  TERRACOTTA: { accent: '#9c4127', onAccent: '#ffffff' },
  FOREST: { accent: '#2c6537', onAccent: '#ffffff' },
  GRAPHITE: { accent: '#343c48', onAccent: '#ffffff' },
  GOLD: { accent: '#7d5200', onAccent: '#ffffff' },
  FUCHSIA: { accent: '#c8155a', onAccent: '#ffffff' },
  MOSS: { accent: '#3f5b48', onAccent: '#ffffff' },
  CHAMPAGNE: { accent: '#c9a46a', onAccent: '#140f08' },
  ROSE: { accent: '#e8a7b5', onAccent: '#1f0d12' },
};

export const TYPOGRAPHY: Record<string, string> = {
  MODERN: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  CLASSIC: 'Georgia, "Times New Roman", "PT Serif", serif',
  ROUNDED: 'ui-rounded, "SF Pro Rounded", "Nunito", system-ui, sans-serif',
  LUXE: '"Jost", "Futura", "Century Gothic", system-ui, sans-serif',
  BOLD: '"Manrope", system-ui, -apple-system, "Segoe UI", sans-serif',
  CLEAN: '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif',
};
/** Шрифт заголовков: у LUXE своя антиква, у остальных тот же, что текст */
export const HEADING_FONT: Record<string, string> = {
  LUXE: '"Cormorant Garamond", "Cormorant", Georgia, "Times New Roman", serif',
  BOLD: '"Unbounded", "Manrope", system-ui, sans-serif',
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
  const scheme = theme['colorScheme'];
  if (scheme !== 'LIGHT' && scheme !== 'DARK') throw new Error(`theme:scheme:${String(scheme)}`);
  const dark = scheme === 'DARK';
  if (DARK_PRESETS.has(String(theme['preset'])) !== dark) throw new Error(`theme:scheme:${String(theme['preset'])}`);
  if (DARK_ACCENTS.has(String(theme['accent'])) !== dark) throw new Error(`theme:accent:${String(theme['accent'])}`);
  return [
    pick(theme['preset'], PRESETS, 'p'),
    pick(theme['accent'], ACCENTS, 'a'),
    pick(theme['typography'], TYPOGRAPHY, 't'),
    pick(theme['radius'], RADIUS, 'r'),
    pick(theme['density'], DENSITY, 'd'),
    ...(dark ? ['s-dark'] : []),
  ].join(' ');
}

const vars = (selector: string, pairs: Record<string, string>) =>
  `${selector}{${Object.entries(pairs).map(([k, v]) => `--${k}:${v}`).join(';')}}`;

export const SITE_CSS = [
  ...Object.entries(PRESETS).map(([k, t]) =>
    vars(`.p-${k.toLowerCase()}`, { bg: t.bg, surface: t.surface, text: t.text, muted: t.muted, border: t.border })),
  ...Object.entries(ACCENTS).map(([k, t]) =>
    vars(`.a-${k.toLowerCase()}`, { accent: t.accent, 'on-accent': t.onAccent })),
  ...Object.entries(TYPOGRAPHY).map(([k, f]) => vars(`.t-${k.toLowerCase()}`, { font: f, 'font-heading': HEADING_FONT[k] ?? f })),
  ...Object.entries(RADIUS).map(([k, r]) => vars(`.r-${k.toLowerCase()}`, { radius: r })),
  ...Object.entries(DENSITY).map(([k, d]) => vars(`.d-${k.toLowerCase()}`, { section: d.section, gap: d.gap })),
  siteFontsCss(),
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
h1,h2,h3{line-height:1.2;margin:0 0 16px;font-family:var(--font-heading,var(--font));overflow-wrap:break-word;text-wrap:balance}
h1{font-size:clamp(32px,6vw,52px)}
h2{font-size:clamp(26px,4vw,36px)}
h3{font-size:20px}
p{margin:0 0 16px}
p.lead{font-size:20px;color:var(--muted);max-width:720px}
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
.not-found{padding:96px 0}
.group-title{margin-top:32px}
.catalog-item{display:grid;gap:8px 24px;align-items:center}
@media (min-width:800px){.catalog .row.catalog-item{grid-template-columns:2fr 1fr}}
.item-side{display:flex;flex-wrap:wrap;align-items:center;gap:12px 20px}
.item-meta{display:flex;flex-wrap:wrap;gap:4px 16px;margin:0;color:var(--muted)}
.price{font-weight:700;color:var(--text);white-space:nowrap}
.dish{display:grid;grid-template-columns:1fr auto;gap:8px 16px;align-items:start}
.dish img{grid-column:1/-1;border-radius:var(--radius);aspect-ratio:4/3;object-fit:cover;width:100%}
.dish h4{margin:0 0 4px;font-size:18px}
.person img{border-radius:var(--radius);aspect-ratio:1;object-fit:cover;width:100%;margin-bottom:12px}
.hours{border-collapse:collapse;margin-top:24px;min-width:min(100%,360px)}
.hours th,.hours td{text-align:left;padding:10px 24px 10px 0;border-top:1px solid var(--border);font-weight:400}
.hours th{color:var(--muted)}
.hours-compact{list-style:none;padding:0;margin:24px 0 0;display:grid;gap:8px}
.lead-form{margin-top:24px;max-width:560px;display:grid;gap:4px}
.lead-form fieldset{border:0;margin:0;padding:0;display:grid;gap:4px;min-width:0}
.lead--card .lead-form{background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);padding:24px}
.field{display:grid;gap:6px;margin:0 0 12px}
.field label{font-weight:600}
.field input,.field select,.field textarea{font:inherit;color:var(--text);background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);min-height:48px;padding:10px 14px;width:100%}
.field input:focus-visible,.field select:focus-visible,.field textarea:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
.lead-form button[disabled]{opacity:.6;cursor:progress}
.lead-status{min-height:1.6em;margin:8px 0 0}
.hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
.mobile-bar{position:fixed;left:0;right:0;bottom:0;z-index:6;display:flex;gap:8px;padding:10px 12px calc(10px + env(safe-area-inset-bottom));background:var(--bg);border-top:1px solid var(--border)}
.mobile-bar .btn{flex:1}
body.has-mobile-bar{padding-bottom:80px}
@media (min-width:800px){.mobile-bar{display:none}body.has-mobile-bar{padding-bottom:0}}
.hero--image_full{position:relative;isolation:isolate;min-height:min(88vh,760px);display:flex;align-items:flex-end;padding:calc(var(--section) * 2) 0 var(--section);color:#fff}
.hero--image_full img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:-2}
.hero--image_full::after{content:'';position:absolute;inset:0;z-index:-1;background:linear-gradient(90deg,rgba(0,0,0,.72) 0%,rgba(0,0,0,.45) 55%,rgba(0,0,0,.25) 100%)}
.hero--image_full .wrap{position:static}
.hero--image_full .lead{color:rgba(255,255,255,.86)}
.hero--image_full h1{max-width:820px}
.hero--image_side .wrap{display:grid;gap:32px;align-items:center}
@media (min-width:800px){.hero--image_side .wrap{grid-template-columns:1.1fr 1fr}.hero--image_side .wrap>img{grid-column:2;grid-row:1/span 4;width:100%;aspect-ratio:4/5;object-fit:cover;border-radius:var(--radius)}}
.s-dark{color-scheme:dark}
.s-dark .site-header{background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(8px)}
.s-dark main section:nth-of-type(even){background:var(--surface)}
.s-dark .btn--ghost{color:var(--accent);border-color:var(--accent)}
.s-dark .cta-band,.s-dark main section.cta-band{background:var(--surface);color:var(--text);border-top:1px solid var(--border);border-bottom:1px solid var(--border)}
.s-dark .cta-band .btn{background:var(--accent);color:var(--on-accent);border-color:var(--accent)}
.s-dark .cta-band p{color:var(--muted)}
/* общая доводка 28.10.2026: ритм секций, заголовки, шапка, контакты, часы, подвал */
main section>.wrap>h2{max-width:22ch}
.site-header .btn{min-height:44px;padding:10px 20px}
.catalog .row.catalog-item h3{margin:0}
.contact-list{grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:16px}
.contact-list li{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:18px 20px;display:flex;flex-direction:column;gap:4px;color:var(--muted);font-size:15px}
main section:nth-of-type(even) .contact-list li{background:var(--bg)}
.contact-list li a{color:var(--text);font-weight:600;font-size:17px;min-height:0}
.hours-compact li{font-size:19px}
.hours-compact b{display:inline-block;min-width:96px;color:var(--muted);font-weight:500}
.cta-band .wrap{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px 32px}
.cta-band h2{margin:0}
.cta-band .actions{margin:0}
.site-footer .wrap{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px 32px}
.site-footer p{margin:0}
.lead--card .lead-form{max-width:640px}
.lead-form .field{margin:0 0 14px}
@media (min-width:800px){.lead-form fieldset{grid-template-columns:1fr 1fr;column-gap:16px}.lead-form fieldset>*{grid-column:1/-1}.lead-form fieldset>.field:has(input[type=date]),.lead-form fieldset>.field:has(select[name=startsAt]),.lead-form fieldset>.field:has(input[type=time]),.lead-form fieldset>.field:has(input[name=name]),.lead-form fieldset>.field:has(input[type=tel]){grid-column:auto}}
@media (min-width:800px){.grid:has(> .person){grid-template-columns:repeat(auto-fill,minmax(260px,320px))}}
.room-row__pics img{display:block;width:100%;aspect-ratio:3/2;object-fit:cover;border-radius:var(--radius)}
.room-row__pics img+img{display:none}
@media (min-width:800px){.row.room-row{grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:24px 56px;align-items:center;padding:40px 0}.row.room-row:nth-child(even) .room-row__pics{order:2}}
.card>img{display:block;width:calc(100% + 48px);max-width:none;margin:-24px -24px 16px;aspect-ratio:3/2;object-fit:cover;border-radius:var(--radius) var(--radius) 0 0}
.card>img+img{display:none}
.lead--card .lead-form{max-width:720px}
@media (min-width:800px){.t-bold .hero--image_side h1{font-size:clamp(40px,4.6vw,64px)}}
p:has(> button[data-beauty-refresh]:empty),p[data-beauty-details]:empty{display:none}
button.btn{font:inherit;font-weight:600;cursor:pointer}
.lead-form .btn[type=submit]{min-width:200px;margin-top:4px}
.row.person{display:flex;align-items:center;gap:20px}
.row.person img{width:96px;flex:none;margin:0}
.row.person h3{margin:0}
.row.person .muted{margin:0}

.hero--image_full::after{background:linear-gradient(90deg,rgba(0,0,0,.82) 0%,rgba(0,0,0,.6) 45%,rgba(0,0,0,.2) 100%)}
.hours-compact{display:flex;flex-wrap:wrap;gap:12px 40px}
.t-luxe h1{font-size:clamp(44px,7.5vw,92px);font-weight:500;line-height:1.02;letter-spacing:-.01em}
.t-luxe h2{font-size:clamp(34px,5vw,56px);font-weight:500;letter-spacing:-.005em}
.t-luxe h3{font-size:24px;font-weight:500}
.t-luxe .room-row h3{font-size:clamp(28px,3vw,38px)}
.t-luxe body,.t-luxe{font-weight:300}
.t-luxe .btn{font-weight:500;letter-spacing:.14em;text-transform:uppercase;font-size:14px}
.t-luxe .nav a{letter-spacing:.12em;text-transform:uppercase;font-size:14px}
.t-luxe .brand{font-family:var(--font-heading);font-weight:500;font-size:26px;letter-spacing:.02em}
.t-luxe .catalog .row{border-top-color:var(--border)}
.t-luxe .price{color:var(--accent);font-weight:400;font-size:20px}
.t-luxe .group-title{font-family:var(--font);font-size:13px;font-weight:500;letter-spacing:.24em;text-transform:uppercase;color:var(--accent);margin-top:40px}
.t-luxe .catalog .list{gap:0}
.t-luxe .catalog .row.catalog-item{padding:20px 0;border-top:0;border-bottom:1px solid var(--border)}
.t-luxe .catalog-item h3{font-size:26px;margin:0}
.t-luxe .catalog .btn--ghost{min-height:40px;padding:8px 16px;font-size:12px}
.t-luxe .person img{aspect-ratio:4/5;filter:grayscale(.25)}
.t-luxe .person h3{font-size:28px;margin:4px 0 0}
.t-luxe .person .muted{letter-spacing:.16em;text-transform:uppercase;font-size:13px}
.t-luxe .faq summary{font-family:var(--font-heading);font-size:22px;font-weight:500}
.t-bold h1{font-size:clamp(36px,6vw,76px);font-weight:800;line-height:.98;letter-spacing:-.035em}
.t-bold h2{font-size:clamp(32px,4.6vw,54px);font-weight:800;letter-spacing:-.03em}
.t-bold h3{font-weight:800;letter-spacing:-.01em}
.t-bold .brand{font-family:var(--font-heading);font-weight:800;letter-spacing:-.03em}
.t-bold .btn{font-weight:800;border-radius:999px;box-shadow:0 5px 0 var(--text);border-color:var(--text)}
.t-bold .btn:active{transform:translateY(3px);box-shadow:0 2px 0 var(--text)}
.t-bold .btn--ghost{background:var(--bg);color:var(--text);box-shadow:none;border-width:2px}
.t-bold .site-header{border-bottom:2px solid var(--text)}
.t-bold .card,.t-bold .lead--card .lead-form,.t-bold .contact-list li{border:2px solid var(--text)}
.t-bold .card{box-shadow:6px 6px 0 var(--text)}
.t-bold .price{display:inline-block;background:color-mix(in srgb,var(--accent) 12%,var(--bg));color:var(--accent);border-radius:999px;padding:4px 12px;font-weight:800}
.t-bold .catalog .grid,.t-bold .catalog .list.grid{gap:24px}
.t-bold .group-title{display:inline-block;background:var(--text);color:var(--bg);border-radius:999px;padding:6px 16px;font-size:15px;font-weight:800}
.t-bold .person img{border-radius:50%;border:3px solid var(--text);width:min(100%,180px);aspect-ratio:1;object-fit:cover}
.t-bold .row.person img{width:96px}
.t-bold .hero--image_side .wrap>img{border:3px solid var(--text);transform:rotate(2deg);box-shadow:10px 10px 0 var(--accent)}
.t-bold .cta-band,.t-bold main section.cta-band{background:var(--text);color:var(--bg)}
.t-bold .cta-band .btn{background:var(--accent);color:var(--on-accent);border-color:var(--bg);box-shadow:0 5px 0 var(--bg)}
.t-bold .field input,.t-bold .field select,.t-bold .field textarea{border:2px solid var(--text);border-radius:14px}
.t-bold .item-meta span{font-weight:700}
/* ---------- стиль В: CLEAN (эко-минимал) ---------- */
.t-clean h1{font-size:clamp(40px,5.6vw,64px);font-weight:600;line-height:1.04;letter-spacing:-.04em}
.t-clean h2{font-size:clamp(30px,3.8vw,42px);font-weight:600;letter-spacing:-.035em}
.t-clean h3{font-weight:600;letter-spacing:-.01em}
.t-clean .brand{font-weight:600;letter-spacing:-.02em}
.t-clean .brand::before{content:'';width:10px;height:10px;border-radius:50%;background:var(--accent);margin-right:10px}
.t-clean .btn{border-radius:12px;font-weight:600}
.t-clean main section:nth-of-type(even){background:var(--surface)}
.t-clean .catalog .list:not(.grid){background:var(--bg);border-radius:22px;padding:4px 28px;border:1px solid var(--border)}
.t-clean main section:nth-of-type(odd) .catalog .list:not(.grid){background:#fff}
.t-clean .catalog .row.catalog-item{border-top:0;border-bottom:1px solid var(--border);padding:20px 0}
.t-clean .catalog .row.catalog-item:last-child{border-bottom:0}
.t-clean .group-title{font-size:14px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:600}
.t-clean .card{border:0;border-radius:20px;background:#fff}
.t-clean .person img{border-radius:16px;aspect-ratio:4/5}
.t-clean .lead--card .lead-form{border:0;background:var(--accent);color:var(--on-accent);border-radius:24px;padding:32px}
.t-clean .lead--card .lead-form label{color:var(--on-accent)}
.t-clean .lead--card .lead-form .field input,.t-clean .lead--card .lead-form .field select,.t-clean .lead--card .lead-form .field textarea{background:#fff;border-color:transparent;color:var(--text)}
.t-clean .lead--card .lead-form .btn{background:#fff;color:var(--accent);border-color:#fff;width:100%}
.t-clean .hero--image_side .wrap>img{border-radius:28px}
.t-clean .cta-band,.t-clean main section.cta-band{background:var(--accent)}
.t-clean .contact-list li{background:#fff;border:0}
@media (min-width:800px){.t-luxe .catalog .row.catalog-item{grid-template-columns:1fr auto}}`,
].join('\n');
