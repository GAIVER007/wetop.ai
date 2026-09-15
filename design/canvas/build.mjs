// Генератор артбордов холста дизайна «WETOP — стойка» (план дизайн-системы, Д6 — запасной путь к Claude Design).
// Каждый артборд — статичный .dc.html из общих кусков (оболочка, шахматка, панель, окно), значения — ровно из
// design/tokens.json (светлая тема) и классов компонентов apps/web (premium.css, components.css).
// Запуск: `node design/canvas/build.mjs` → *.dc.html и canvas.json рядом; затем холст собирается и публикуется.
// Данные вымышленные (ADR-010). Скриншотов Exely здесь нет (Д7).
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const T = {
  bg: '#f4f7fb', surface: '#ffffff', surfaceMuted: '#f6f8fc', surfaceElevated: '#ffffff', border: '#e5eaf2', borderSoft: '#eef1f7',
  borderInput: '#dce3ee', text: '#101827', text2: '#536176', muted: '#596a80', primary: '#085fba', primaryHover: '#0966c8',
  primarySoft: '#eaf4ff', onPrimary: '#ffffff', success: '#06735e', successSoft: '#e5f7f0', warning: '#94600b', warningSoft: '#fff4df',
  warningBg: '#fffbf3', warningBorder: '#f1dfbc', danger: '#cc384e', dangerSoft: '#fff2f4', dangerBorder: '#f3ced5',
  stConfirmed: '#dcecff', stCheckedIn: '#d7f0e9', stCheckedOut: '#e9edf4', stTentative: '#faedcc', stBlocked: '#f7dde2',
  chipBg: '#edf1f7', chipFg: '#536176', rowHover: '#f2f7fd', sidebar: 'rgba(255,255,255,.88)', glass: 'rgba(255,255,255,.85)',
  overlay: 'rgba(11,23,44,.32)', shadow: '0 6px 24px rgba(26,45,78,.04)', shadowFloating: '0 20px 70px rgba(18,38,68,.16)',
  font: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
};

// ── значки: lucide, 1.7 px, 20 / 16 px ──
const paths = {
  today: '<rect x="3" y="3" width="7" height="9" rx="1"></rect><rect x="14" y="3" width="7" height="5" rx="1"></rect><rect x="14" y="12" width="7" height="9" rx="1"></rect><rect x="3" y="16" width="7" height="5" rx="1"></rect>',
  board: '<path d="M8 2v4M16 2v4"></path><rect x="3" y="4" width="18" height="18" rx="2"></rect><path d="M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"></path>',
  booking: '<path d="M8 2v4M16 2v4"></path><rect x="3" y="4" width="18" height="18" rx="2"></rect><path d="M3 10h18M9 16l2 2 4-4"></path>',
  guests: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"></path>',
  inventory: '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"></path><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2M10 6h4M10 10h4M10 14h4M10 18h4"></path>',
  rates: '<path d="m15 5 6.3 6.3a2.4 2.4 0 0 1 0 3.4L17 19"></path><path d="M9.586 5.586A2 2 0 0 0 8.172 5H3a1 1 0 0 0-1 1v5.172a2 2 0 0 0 .586 1.414L8.29 18.29a2.426 2.426 0 0 0 3.42 0l3.58-3.58a2.426 2.426 0 0 0 0-3.42z"></path><circle cx="6.5" cy="9.5" r=".5" fill="currentColor"></circle>',
  money: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"></path><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"></path>',
  channels: '<rect x="16" y="16" width="6" height="6" rx="1"></rect><rect x="2" y="16" width="6" height="6" rx="1"></rect><rect x="9" y="2" width="6" height="6" rx="1"></rect><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3M12 12V8"></path>',
  journal: '<path d="M12 7v14"></path><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"></path>',
  incidents: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"></path><path d="M12 9v4M12 17h.01"></path>',
  analytics: '<path d="M12 16v5M16 14v7M20 10v11M22 3l-8.646 8.646a.5.5 0 0 1-.708 0L9.354 8.354a.5.5 0 0 0-.708 0L2 15M4 18v3M8 14v7"></path>',
  search: '<circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path>',
  plus: '<path d="M5 12h14M12 5v14"></path>',
  down: '<path d="m6 9 6 6 6-6"></path>',
  chevron: '<path d="m9 18 6-6-6-6"></path>',
  left: '<path d="m15 18-6-6 6-6"></path>',
  close: '<path d="M18 6 6 18M6 6l12 12"></path>',
  bell: '<path d="M10.268 21a2 2 0 0 0 3.464 0"></path><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"></path>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>',
  bed: '<path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9"></path>',
  more: '<circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle>',
  check: '<path d="M20 6 9 17l-5-5"></path>',
  clock: '<circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path>',
  arrival: '<path d="m10 17 5-5-5-5"></path><path d="M15 12H3"></path><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>',
  departure: '<path d="m16 17 5-5-5-5"></path><path d="M21 12H9"></path><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>',
  refresh: '<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path><path d="M16 16h5v5"></path>',
  settings: '<path d="M20 7h-9M14 17H5"></path><circle cx="17" cy="17" r="3"></circle><circle cx="7" cy="7" r="3"></circle>',
  collapse: '<rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M9 3v18M16 15l-3-3 3-3"></path>',
  messages: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>',
  phone: '<path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384"></path>',
};
const icon = (n, s = 20, color = 'currentColor', extra = '') =>
  `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex: none; ${extra}">${paths[n]}</svg>`;

// ── компоненты (значения — premium.css / components.css) ──
const btn = (label, tone = 'primary', extra = '', ic = '') => {
  const tones = {
    primary: `background: ${T.primary}; color: ${T.onPrimary}; border: 1px solid ${T.primary};`,
    secondary: `background: ${T.surface}; color: ${T.text2}; border: 1px solid ${T.border};`,
    danger: `background: ${T.dangerSoft}; color: ${T.danger}; border: 1px solid ${T.dangerBorder};`,
    success: `background: ${T.successSoft}; color: ${T.success}; border: 1px solid transparent;`,
    info: `background: ${T.primarySoft}; color: ${T.primary}; border: 1px solid ${T.border};`,
    disabled: `background: ${T.primary}; color: ${T.onPrimary}; border: 1px solid ${T.primary}; opacity: .55;`,
  };
  return `<span style="display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 38px; padding: 0 14px; border-radius: 10px; font-size: 12px; font-weight: 550; white-space: nowrap; ${tones[tone]} ${extra}">${ic}${label}</span>`;
};
const iconBtn = (n, extra = '') => `<span style="display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 10px; color: ${T.text2}; border: 1px solid transparent; ${extra}">${icon(n)}</span>`;
const badge = (label, tone = 'neutral', extra = '') => {
  const tones = {
    neutral: `background: ${T.chipBg}; color: ${T.chipFg};`, info: `background: ${T.primarySoft}; color: ${T.primary};`,
    ok: `background: ${T.successSoft}; color: ${T.success};`, warn: `background: ${T.warningSoft}; color: ${T.warning};`,
    danger: `background: ${T.dangerSoft}; color: ${T.danger};`,
  };
  return `<span style="display: inline-flex; align-items: center; gap: 4px; border-radius: 6px; padding: 4px 8px; font-size: 12px; font-weight: 500; white-space: nowrap; ${tones[tone]} ${extra}">${label}</span>`;
};
const amount = (label, sum, tone) => {
  const tones = { danger: `background: ${T.dangerSoft}; color: ${T.danger};`, ok: `background: ${T.successSoft}; color: ${T.success};`, info: `background: ${T.primarySoft}; color: ${T.primary};`, warn: `background: ${T.warningSoft}; color: ${T.warning};` };
  return `<span style="display: inline-flex; align-items: baseline; gap: 4px; padding: 2px 8px; border-radius: 8px; font-size: 12px; line-height: 1.45; white-space: nowrap; ${tones[tone]}"><span>${label}</span>${sum ? `<b style="font-weight: 600; font-variant-numeric: tabular-nums;">${sum}</b>` : ''}</span>`;
};
const input = (value, extra = '', placeholder = false) =>
  `<span style="display: inline-flex; align-items: center; min-height: 38px; padding: 8px 12px; border: 1px solid ${T.borderInput}; border-radius: 10px; background: ${T.surface}; color: ${placeholder ? T.muted : T.text}; font-size: 12px; box-sizing: border-box; ${extra}">${value}</span>`;
const select = (value, extra = '') =>
  `<span style="display: inline-flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 38px; padding: 8px 12px; border: 1px solid ${T.borderInput}; border-radius: 10px; background: ${T.surface}; color: ${T.text}; font-size: 12px; box-sizing: border-box; ${extra}">${value}${icon('down', 14, T.muted)}</span>`;
const field = (label, control, extra = '') => `<label style="display: flex; flex-direction: column; gap: 6px; font-size: 12px; font-weight: 500; color: ${T.text2}; ${extra}">${label}${control}</label>`;
const panel = (inner, extra = '') => `<section style="background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 16px; padding: 20px; ${extra}">${inner}</section>`;
const stat = (label, value, hint, tone) => `<div style="flex: 1; min-width: 160px; background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 16px; padding: 20px;"><div style="color: ${T.muted}; font-size: 12px;">${label}</div><div style="color: ${tone === 'alarm' ? T.danger : T.text}; font-size: 28px; font-weight: 650; letter-spacing: -.02em; line-height: 1.25; margin: 6px 0 4px; font-variant-numeric: tabular-nums;">${value}</div><div style="font-size: 12px; color: ${tone === 'alarm' ? T.danger : T.muted};">${hint}</div></div>`;
const seg = (items, on) => `<span style="display: inline-flex; gap: 4px; background: ${T.surfaceMuted}; border: 1px solid ${T.border}; border-radius: 10px; padding: 4px;">${items.map((i) => `<span style="border-radius: 7px; font-size: 12px; padding: 7px 12px; ${i === on ? `background: ${T.surfaceElevated}; color: ${T.primary}; box-shadow: ${T.shadow};` : `color: ${T.muted};`}">${i}</span>`).join('')}</span>`;
const chip = (label, on = false) => `<span style="display: inline-flex; align-items: center; border: 1px solid ${on ? '#c9dbf0' : 'transparent'}; background: ${on ? T.primarySoft : 'transparent'}; color: ${on ? T.primary : T.muted}; padding: 7px 10px; border-radius: 8px; font-size: 12px;">${label}</span>`;
const toast = (text, tone, action) => {
  const c = { ok: T.success, danger: T.danger, warn: T.warning, info: T.primary }[tone];
  const ic = tone === 'ok' ? 'check' : tone === 'info' ? 'bell' : 'incidents';
  return `<div style="display: flex; align-items: center; gap: 8px; width: 360px; padding: 12px 16px; border: 1px solid ${T.border}; border-left: 4px solid ${c}; border-radius: 10px; background: ${T.surfaceElevated}; color: ${T.text}; font-size: 13px; line-height: 1.45; box-shadow: ${T.shadowFloating};">${icon(ic, 16, c)}<span style="flex: 1;">${text}</span>${action ? `<a href="#" style="flex: none; font-weight: 600; color: ${T.primary};">${action}</a>` : ''}<span style="display: inline-flex; width: 24px; height: 24px; align-items: center; justify-content: center; color: ${T.muted};">${icon('close', 14)}</span></div>`;
};
const dialog = ({ title, text, consequence, amountLabel, amountSum, confirm, tone = 'primary', pending }) => `
<div style="width: 440px; background: ${T.surfaceElevated}; border: 1px solid ${T.border}; border-radius: 20px; box-shadow: ${T.shadowFloating}; padding: 24px; display: flex; flex-direction: column; gap: 16px; color: ${T.text};">
  <h2 style="margin: 0; font-size: 18px; line-height: 1.25; font-weight: 600;">${title}</h2>
  <div style="font-size: 14px; line-height: 1.45; color: ${T.text2};"><p style="margin: 0;">${text}</p><p style="margin: 8px 0 0; color: ${T.text}; font-weight: 500;">${consequence}</p></div>
  <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 8px; padding: 12px 16px; border: 1px solid ${T.border}; border-radius: 10px; background: ${T.surfaceMuted}; font-size: 14px;"><span>${amountLabel}</span><b style="font-size: 18px; font-variant-numeric: tabular-nums;">${amountSum}</b></div>
  <div style="display: flex; justify-content: flex-end; gap: 8px;">${btn('Отмена', 'secondary')}${btn(pending ?? confirm, pending ? 'disabled' : tone)}</div>
</div>`;
const menu = (items, extra = '') => `<div style="width: 240px; padding: 4px; background: ${T.surfaceElevated}; border: 1px solid ${T.border}; border-radius: 10px; box-shadow: ${T.shadowFloating}; display: flex; flex-direction: column; ${extra}">${items.map((i) => `<div style="display: flex; align-items: center; gap: 8px; min-height: 36px; padding: 8px; border-radius: 8px; font-size: 13px; ${i.hover ? `background: ${T.rowHover};` : ''} ${i.danger ? `color: ${T.danger};` : i.disabled ? `color: ${T.muted}; opacity: .6;` : `color: ${T.text};`}">${icon(i.icon, 16)}<span style="display: flex; flex-direction: column;">${i.label}${i.hint ? `<small style="color: ${T.muted}; font-size: 12px;">${i.hint}</small>` : ''}</span></div>`).join('')}</div>`;

// ── оболочка ──
const NAV = [
  ['Рабочее место', [['today', 'Главная'], ['board', 'Шахматка'], ['booking', 'Брони'], ['guests', 'Гости']]],
  ['Управление', [['inventory', 'Номера'], ['settings', 'Настройки'], ['money', 'Оплаты']]],
  ['Продажи', [['channels', 'Менеджер каналов'], ['rates', 'Цены и ограничения'], ['analytics', 'Аналитика']]],
  ['Система', [['messages', 'Сообщения'], ['incidents', 'Неисправности'], ['journal', 'Журнал']]],
];
function shell({ active, content, freshness = { text: 'Exely 09:12 · Channex 09:10 · очередь 0', warn: false }, overlayHtml = '' }) {
  const links = NAV.map(([group, items]) => `<div style="color: ${T.muted}; font-size: 12px; margin: 20px 12px 6px;">${group}</div>` + items.map(([ic, label]) => {
    const on = label === active;
    return `<a href="#" style="position: relative; display: flex; align-items: center; gap: 10px; min-height: 38px; margin: 2px 0; padding: 8px 10px; border-radius: 10px; font-size: 12px; font-weight: 500; text-decoration: none; ${on ? `background: ${T.primarySoft}; color: ${T.primary};` : `color: ${T.text2};`}">${on ? `<span style="position: absolute; left: -12px; top: 11px; width: 3px; height: 16px; background: ${T.primary}; border-radius: 0 4px 4px 0;"></span>` : ''}${icon(ic, 18)}${label}</a>`;
  }).join('')).join('');
  return `
<div style="position: relative; width: 1440px; height: 1000px; display: flex; overflow: hidden; background: ${T.bg}; font-family: ${T.font}; color: ${T.text}; font-size: 12px; line-height: 1.45; box-sizing: border-box;">
  <aside style="width: 232px; flex: none; display: flex; flex-direction: column; background: ${T.sidebar}; border-right: 1px solid ${T.border}; padding: 24px 12px 12px; box-sizing: border-box;">
    <div style="display: flex; align-items: center; gap: 9px; padding: 0 4px;">
      <span style="display: inline-grid; place-items: center; width: 32px; height: 32px; border-radius: 10px; background: ${T.primary}; color: ${T.onPrimary}; font-weight: 750; font-size: 16px;">W</span>
      <span style="font-size: 18px; font-weight: 750; letter-spacing: -.6px; line-height: 1;">WETOP<span style="color: ${T.primary};">.AI</span></span>
      <span style="margin-left: auto; color: ${T.text2};">${icon('collapse', 18)}</span>
    </div>
    <div style="margin: 20px 0 0; padding: 12px; border: 1px solid ${T.border}; border-radius: 12px; background: ${T.surface}; display: flex; align-items: center; gap: 10px;">${icon('inventory', 18, T.primary)}<span style="display: flex; flex-direction: column;"><b style="font-size: 12px; font-weight: 600;">Luxx Aparts</b><span style="color: ${T.muted};">Толе би, 286/8</span></span></div>
    <nav style="flex: 1; display: flex; flex-direction: column;">${links}</nav>
    <div style="padding: 8px 12px 0; font-size: 12px; color: ${freshness.warn ? T.warning : T.muted};">${freshness.text}</div>
  </aside>
  <div style="flex: 1; min-width: 0; display: flex; flex-direction: column;">
    <header style="height: 72px; flex: none; display: flex; align-items: center; gap: 20px; padding: 0 28px; background: ${T.glass}; border-bottom: 1px solid ${T.border}; box-sizing: border-box;">
      <div style="display: flex; align-items: center; gap: 10px; width: 390px; color: ${T.muted}; font-size: 12px;">${icon('search', 18)}<span style="flex: 1;">Поиск гостя, брони, номера…</span><kbd style="border: 1px solid ${T.border}; background: ${T.surface}; border-radius: 5px; padding: 2px 6px; font-size: 12px; font-family: inherit;">⌘K</kbd></div>
      <div style="margin-left: auto; display: flex; align-items: center; gap: 12px;">${iconBtn('moon')}${iconBtn('bell')}<span style="display: flex; align-items: center; gap: 10px; padding-left: 16px; border-left: 1px solid ${T.border};"><span style="display: inline-grid; place-items: center; width: 34px; height: 34px; border-radius: 50%; background: ${T.primarySoft}; color: ${T.primary}; font-weight: 600;">АД</span><span style="display: flex; flex-direction: column; line-height: 1.3;"><b style="font-weight: 600;">Администратор</b><span style="color: ${T.muted};">Luxx Aparts</span></span>${icon('down', 16, T.muted)}</span></div>
    </header>
    <main style="flex: 1; min-height: 0; padding: 28px; overflow: hidden; display: flex; flex-direction: column; gap: 16px;">${content}</main>
  </div>
  ${overlayHtml}
</div>`;
}
const pageHead = (title, subtitle, actions = '') => `<div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;"><div><h1 style="margin: 0; font-size: 28px; font-weight: 650; line-height: 1.2; letter-spacing: -.04em;">${title}</h1><div style="margin-top: 7px; color: ${T.muted}; font-size: 12px;">${subtitle}</div></div><div style="display: flex; align-items: center; gap: 8px;">${actions}</div></div>`;

// ── шахматка ──
const DAYS = [['14', 'пн', true, false], ['15', 'вт'], ['16', 'ср'], ['17', 'чт'], ['18', 'пт'], ['19', 'сб', false, true], ['20', 'вс', false, true]];
const ST = { confirmed: [T.stConfirmed, 'ждём', 'booking'], checkedIn: [T.stCheckedIn, 'заселён', 'bed'], checkedOut: [T.stCheckedOut, 'выехал', 'departure'], tentative: [T.stTentative, 'не подтверждена', 'clock'] };
/** stay: { from: индекс дня, nights, status, name, extra?: html, focus?: bool } */
function stayBar(s, cw) {
  const [bg, word, ic] = ST[s.status];
  const w = s.nights * cw - 4;
  return `<a href="#" style="position: absolute; left: 2px; top: 7px; display: flex; align-items: center; gap: 6px; width: ${w}px; height: 32px; padding: 0 8px; box-sizing: border-box; border-radius: ${s.cont ? '0' : '8px'} 8px 8px ${s.cont ? '0' : '8px'}; background: ${bg}; color: ${T.text}; font-size: 12px; font-weight: 500; text-decoration: none; white-space: nowrap; overflow: hidden; ${s.focus ? `outline: 2px solid ${T.primary}; outline-offset: 2px;` : ''} ${s.dashed ? `outline: 2px dashed ${T.primary}; outline-offset: -2px;` : ''}">${icon(ic, 14, T.text2)}<span style="overflow: hidden; text-overflow: ellipsis;">${s.name}</span><span style="color: ${T.text2}; font-weight: 400;">· ${s.word ?? word}</span>${s.extra ?? ''}</a>`;
}
function board({ groups, cw = 136, freeCols, unassigned, todayCol = 0, weekend = true, extraTop = '' }) {
  const head = `<tr><th style="width: 200px; text-align: left; padding: 12px 16px; background: ${T.surfaceMuted}; border-bottom: 1px solid ${T.border}; border-right: 1px solid ${T.border}; font-weight: 500; color: ${T.text2};">Номер / койка<div style="color: ${T.muted}; font-weight: 400;">занято по дням</div></th>${DAYS.map(([d, wd, today, we], i) => `<th style="width: ${cw}px; padding: 10px 8px; text-align: center; background: ${i === todayCol ? T.primarySoft : T.surfaceMuted}; border-bottom: 1px solid ${T.border}; font-weight: 500;"><div style="font-size: 16px; font-weight: 600; color: ${i === todayCol ? T.primary : T.text};">${d}</div><div style="color: ${T.muted}; font-size: 12px; font-weight: 400;">${wd}${i === todayCol ? ' · сегодня' : ''}</div><div style="color: ${T.muted}; font-size: 12px;">${freeCols ? freeCols[i] : ''}</div></th>`).join('')}</tr>`;
  const rows = groups.map((g) => {
    const grp = `<tr><td style="height: 30px; padding: 0 16px; background: ${T.surfaceMuted}; border-bottom: 1px solid ${T.border}; border-right: 1px solid ${T.border}; color: ${T.muted}; font-size: 12px;"><span style="display: inline-flex; align-items: center; gap: 6px; color: ${T.text};">${icon('down', 14, T.muted)}${g.name}<span style="color: ${T.muted};">${g.count}</span></span></td>${g.free.map((f) => `<td style="height: 30px; text-align: center; background: ${T.surfaceMuted}; border-bottom: 1px solid ${T.border}; font-size: 12px; ${f === 0 ? `color: ${T.danger}; font-weight: 600;` : `color: ${T.muted};`}">${f === 0 ? '0 · нет' : f}</td>`).join('')}</tr>`;
    const units = (g.rows ?? []).map((r) => {
      const cells = DAYS.map((_, i) => {
        const s = (r.stays ?? []).find((x) => x.from === i);
        const blocked = (r.blocks ?? []).find((b) => i >= b.from && i < b.from + b.nights);
        return `<td style="position: relative; height: 46px; padding: 0; border-bottom: 1px solid ${T.borderSoft}; border-left: 1px solid ${T.borderSoft}; ${i === todayCol ? `background: ${T.rowHover};` : ''}">${s ? stayBar(s, cw) : ''}${blocked && i === blocked.from ? `<a href="#" style="position: absolute; left: 2px; top: 7px; display: flex; align-items: center; gap: 6px; width: ${blocked.nights * cw - 4}px; height: 32px; padding: 0 8px; box-sizing: border-box; border-radius: 8px; background: ${T.stBlocked}; background-image: repeating-linear-gradient(45deg, transparent 0 6px, ${T.dangerBorder} 6px 8px); color: ${T.text}; font-size: 12px; text-decoration: none; white-space: nowrap;">${icon('incidents', 14, T.danger)}${blocked.label}</a>` : ''}</td>`;
      }).join('');
      return `<tr><td style="height: 46px; padding: 4px 12px; border-bottom: 1px solid ${T.borderSoft}; border-right: 1px solid ${T.border}; background: ${T.surface};"><span style="display: inline-flex; align-items: center; gap: 6px; color: ${T.text}; font-weight: 500;">${icon(r.kind === 'bed' ? 'bed' : 'inventory', 16, T.text2)}${r.code}<span style="color: ${T.muted}; font-weight: 400;">${r.kind === 'bed' ? 'койка' : 'номер'}</span></span>${r.hk ? ` ${badge(r.hk[0], r.hk[1], 'margin-left: 6px; padding: 2px 6px;')}` : ''}</td>${cells}</tr>`;
    }).join('');
    return grp + units;
  }).join('');
  const un = unassigned ? `<div style="display: flex; align-items: center; gap: 10px; padding: 10px 14px; border: 1px solid ${T.border}; border-radius: 10px; background: ${T.surface}; font-size: 12px;">${icon('incidents', 16, T.warning)}<b style="color: ${T.warning};">Без ячейки: ${unassigned.length}</b>${unassigned.map((u) => `<span>${u.category} · <a href="#" style="color: ${T.primary}; text-decoration: underline;">${u.number}</a> · ${u.period} · ${u.status}</span>`).join('')}<span style="margin-left: auto;">${btn('Назначить', 'secondary', 'height: 30px; padding: 0 10px;')}</span></div>` : '';
  return `${extraTop}${un}<div style="border: 1px solid ${T.border}; border-radius: 14px; background: ${T.surface}; overflow: hidden;"><table style="border-collapse: separate; border-spacing: 0; width: 100%; font-size: 12px; table-layout: fixed;"><thead>${head}</thead><tbody>${rows}</tbody></table></div>`;
}
const FREE = ['42 / 88', '9 / 88', '8 / 88', '3 / 88', '2 / 88', '1 / 88', '0 / 88'];
const GROUPS = [
  { name: 'Двухместный номер', count: 16, free: [11, 10, 11, 14, 14, 16, 16], rows: [
    { code: 'R01', hk: ['грязно', 'warn'], stays: [{ from: 0, nights: 3, status: 'checkedIn', name: 'Гость Тестовый' }] },
    { code: 'R02', hk: ['убрано', 'ok'], stays: [{ from: 0, nights: 3, status: 'confirmed', name: 'Сериков Арман Болатұлы', extra: amount('к оплате', '16 000 ₸', 'danger') }] },
    { code: 'R04', stays: [{ from: 3, nights: 2, status: 'confirmed', name: 'Ким Дана' }] },
    { code: 'R06', hk: ['проверено', 'info'], stays: [{ from: 0, nights: 2, status: 'tentative', name: 'Әбдірахманова Гүлнұр Қайратқызы' }] },
    { code: 'R08', stays: [{ from: 3, nights: 2, status: 'confirmed', name: 'Müller-Lüdenscheidt Friedrich' }] },
    { code: 'R09', blocks: [{ from: 0, nights: 2, label: 'ремонт: кондиционер' }] },
  ] },
  { name: 'Мужской общий номер', count: 36, free: [0, 12, 14, 20, 23, 30, 36], rows: [
    { code: 'M03', kind: 'bed', stays: [{ from: 1, nights: 5, status: 'confirmed', name: 'Constantinopolous-Wentworth Alexandria' }] },
    { code: 'M04', kind: 'bed', stays: [{ from: 0, nights: 2, status: 'checkedIn', name: 'Оганесян-Петросянц Александра', cont: true }] },
    { code: 'M05', kind: 'bed', stays: [{ from: 0, nights: 1, status: 'checkedIn', name: 'Учебный Гость' }, { from: 2, nights: 2, status: 'confirmed', name: 'Пример Клиент' }] },
  ] },
  { name: 'Женский общий номер', count: 36, free: [31, 33, 33, 34, 35, 36, 36], rows: [
    { code: 'F02', kind: 'bed', stays: [{ from: 2, nights: 2, status: 'confirmed', name: 'Ким Дана' }] },
    { code: 'F03', kind: 'bed', stays: [{ from: 0, nights: 1, status: 'confirmed', name: 'Демо Посетитель' }] },
  ] },
];
const UNASSIGNED = [{ category: 'Мужской общий номер', number: '20260913-SHOWUN', period: '14.09 → 17.09.2026', status: 'ждём' }];
const boardToolbar = () => `
<div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
  ${seg(['Неделя', '14 дней', 'Месяц'], 'Неделя')}
  <span style="display: inline-flex; align-items: center; gap: 4px;">${iconBtn('left', `border-color: ${T.border}; width: 38px; height: 38px;`)}${input('14.09.2026', 'width: 130px;')}${iconBtn('chevron', `border-color: ${T.border}; width: 38px; height: 38px;`)}${btn('Сегодня', 'secondary')}</span>
  ${input(`${icon('search', 16, T.muted)}&nbsp; Номер, койка, гость или бронь`, 'width: 260px; gap: 6px;', true)}
  ${select('Все статусы', 'width: 150px;')}${select('Все источники', 'width: 160px;')}
  <span style="margin-left: auto; display: inline-flex; gap: 4px;">${chip('Все', true)}${chip('Свободные')}${chip('Занятые')}${chip('Уборка')}</span>
</div>
<div style="display: flex; gap: 14px; color: ${T.text2}; font-size: 12px; align-items: center;">${[['ждём', T.stConfirmed, 'booking'], ['заселён', T.stCheckedIn, 'bed'], ['выехал', T.stCheckedOut, 'departure'], ['не подтверждена', T.stTentative, 'clock'], ['блокировка', T.stBlocked, 'incidents']].map(([w, c, ic]) => `<span style="display: inline-flex; align-items: center; gap: 6px;"><span style="display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 6px; background: ${c}; color: ${T.text};">${icon(ic, 12, T.text2)}${w}</span></span>`).join('')}</div>`;

const chessboard = (opts = {}) => board({ groups: GROUPS, freeCols: FREE, unassigned: UNASSIGNED, ...opts });
const boardScreen = (extra = {}) => shell({ active: 'Шахматка', content: pageHead('Шахматка', '14 сент. — 20 сент. 2026 · Номера и койки · 88 мест', btn('Новая бронь', 'primary', '', icon('plus', 16))) + boardToolbar() + chessboard(), ...extra });

// ── карточка брони панелью ──
function drawer({ tab = 'Обзор', body, extraTop = '' }) {
  const tabs = ['Обзор', 'Счета', 'Действия', 'История'].map((t) => `<span style="padding: 12px 0; font-size: 12px; border-bottom: 2px solid ${t === tab ? T.primary : 'transparent'}; color: ${t === tab ? T.primary : T.muted}; margin-bottom: -1px;">${t}</span>`).join('');
  return `<div style="position: absolute; inset: 0; background: ${T.overlay};"></div>
<aside style="position: absolute; top: 0; right: 0; width: 480px; height: 1000px; background: ${T.surfaceElevated}; border-left: 1px solid ${T.border}; box-shadow: ${T.shadowFloating}; display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden;">
  <div style="display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; border-bottom: 1px solid ${T.border};"><b style="font-size: 15px; font-weight: 600;">Бронирование</b>${iconBtn('close')}</div>
  <div style="padding: 20px; display: flex; flex-direction: column; gap: 16px; overflow: hidden;">
    ${extraTop}
    <div><h2 style="margin: 0; font-size: 19px; font-weight: 650; letter-spacing: -.02em;">Бронь 20260913-SHOWTN</h2><div style="margin-top: 8px; display: flex; gap: 8px; align-items: center;">${badge(`${icon('clock', 12)}не подтверждена`, 'warn')}${badge(`${icon('channels', 12)}Booking.com`, 'neutral')}${amount('предоплата', '24 000 ₸', 'info')}</div></div>
    <div style="display: flex; align-items: center; gap: 12px;"><span style="display: inline-grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; background: ${T.primarySoft}; color: ${T.primary}; font-weight: 600;">ӘГ</span><span style="display: flex; flex-direction: column;"><b style="font-size: 16px; font-weight: 600;">Әбдірахманова Гүлнұр Қайратқызы</b><span style="color: ${T.muted};">гражданство KAZ · телефон не указан</span></span></div>
    <div style="display: flex; gap: 24px; border-bottom: 1px solid ${T.border};">${tabs}</div>
    ${body}
  </div>
</aside>`;
}
const facts = (rows) => `<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 16px; padding: 16px; border: 1px solid ${T.border}; border-radius: 16px; background: ${T.surface};">${rows.map(([k, v]) => `<div><div style="color: ${T.muted}; font-size: 12px;">${k}</div><div style="font-size: 14px; font-weight: 600; margin-top: 2px;">${v}</div></div>`).join('')}</div>`;
const overviewBody = (menuOpen = false) => `
${facts([['Заезд', '14.09.2026'], ['Выезд', '16.09.2026 · 2 ночи'], ['Категория', 'Двухместный номер · R06'], ['Гостей', '1']])}
<div style="display: flex; gap: 16px;"><div style="flex: 1;"><div style="color: ${T.muted};">Стоимость</div><b style="font-size: 16px;">24 000 ₸</b></div><div style="flex: 1;"><div style="color: ${T.muted};">Оплачено</div><b style="font-size: 16px;">24 000 ₸</b></div><div style="flex: 1;"><div style="color: ${T.muted};">К оплате</div><b style="font-size: 16px; color: ${T.success};">0 ₸</b></div></div>
<div style="position: relative; display: flex; gap: 8px; flex-wrap: wrap;">${btn('Заселить', 'primary', '', icon('arrival', 16))}${btn('Принять оплату', 'secondary')}${btn('Подтвердить', 'secondary', '', icon('check', 16))}<span style="position: relative;">${btn(`Действия ${icon('down', 16)}`, 'secondary', menuOpen ? `background: ${T.rowHover};` : '')}${menuOpen ? `<div style="position: absolute; right: 0; top: 42px; z-index: 2;">${menu([{ icon: 'bed', label: 'Переселить', hint: 'та же категория — без пересчёта', hover: true }, { icon: 'plus', label: 'Продлить на ночь' }, { icon: 'arrival', label: 'Заселить', hint: 'нет документа', disabled: true }, { icon: 'close', label: 'Отменить со штрафом', danger: true }])}</div>` : ''}</span></div>
<div style="padding: 12px 16px; border-radius: 10px; background: ${T.warningBg}; border: 1px solid ${T.warningBorder}; color: ${T.warning}; font-size: 12px;">Заметка Booking.com: тихая комната, поздний заезд около 23:00.</div>`;

// ── экраны ──
const artboards = {};
const note = (t) => `<div style="margin: 0 0 12px; padding: 8px 12px; border-radius: 8px; background: ${T.warningSoft}; color: ${T.warning}; font-size: 12px; display: inline-block;">${t}</div>`;

artboards['Main'] = boardScreen();

artboards['DeskSummary'] = shell({ active: 'Главная', content: pageHead('Обзор дня', '14.09.2026, понедельник · время объекта 09:12', `${input('14.09.2026', 'width: 130px;')}${btn('Показать', 'secondary')}`) +
  `<div style="display: flex; gap: 16px;">${stat('Проживают', '55', 'активных размещений')}${stat('Заезды сегодня', '24', '17 ожидают заселения')}${stat('Выезды сегодня', '27', '2 ожидают выезда')}${stat('Свободно', '33', 'номеров и коек')}${stat('Долг уезжающих', '16 000 ₸', '1 счёт', 'alarm')}</div>` +
  `<div style="display: flex; gap: 12px; align-items: center;"><span style="font-size: 14px; font-weight: 600;">Шахматка · неделя</span>${chip('Все', true)}${chip('Заезды 24')}${chip('Выезды 27')}${chip('Требуют внимания 2')}</div>` +
  chessboard({ extraTop: '' }) });

artboards['BookingCard'] = boardScreen({ overlayHtml: drawer({ body: overviewBody(true) }) });

artboards['ConfirmCancel'] = boardScreen({ overlayHtml: `<div style="position: absolute; inset: 0; background: ${T.overlay}; display: grid; place-items: center;">${dialog({ title: 'Отменить бронь 20260913-SHOWTN?', text: 'Гость Әбдірахманова Гүлнұр Қайратқызы, двухместный номер R06, 14.09 → 16.09.2026.', consequence: 'Штраф за первую ночь останется на счёте, место вернётся в продажу. Отмена необратима.', amountLabel: 'Штраф по тарифу', amountSum: '8 000 ₸', confirm: 'Отменить со штрафом', tone: 'danger' })}</div><div style="position: absolute; right: 16px; bottom: 16px;">${toast('Проживание Ким Дана продлено до 18.09.2026, +8 000 ₸ на счёт', 'ok', 'Открыть бронь')}</div>` });

// Channex
const rateRows = [['01.09 вт', '8 000 ₸', '10 000 ₸', '1', '—', '—', '—', '—'], ['02.09 ср', '8 000 ₸', '10 000 ₸', '1', '—', '—', '—', '—'], ['03.09 чт', '8 000 ₸', '10 000 ₸', '1', '—', '—', '—', '—'], ['04.09 пт', '8 000 ₸', '10 000 ₸', '1', '—', '—', '—', '—'], ['05.09 сб', '9 100 ₸', '11 000 ₸', '2', '—', 'закрыто', '—', '—'], ['06.09 вс', '9 100 ₸', '11 000 ₸', '2', '—', 'закрыто', '—', '—'], ['07.09 пн', '8 000 ₸', '10 000 ₸', '1', '—', '—', '—', '—'], ['08.09 вт', '8 000 ₸', '10 000 ₸', '1', '—', '—', '—', '—'], ['09.09 ср', '8 000 ₸', '10 000 ₸', '1', '—', '—', '—', '—'], ['10.09 чт', '8 000 ₸', '10 000 ₸', '1', '—', '—', '—', '—'], ['11.09 пт', '8 000 ₸', '10 000 ₸', '1', '—', '—', '—', '—'], ['12.09 сб', '9 100 ₸', '11 000 ₸', '2', '—', 'закрыто', '—', '—']];
const table = (head, rows, opts = {}) => `<div style="border: 1px solid ${T.border}; border-radius: 14px; background: ${T.surface}; overflow: hidden; ${opts.extra ?? ''}"><table style="border-collapse: collapse; width: 100%; font-size: 12px;"><thead><tr>${head.map((h, i) => `<th style="height: 42px; padding: 10px 16px; text-align: ${i >= (opts.numFrom ?? 99) ? 'right' : 'left'}; color: ${T.muted}; background: ${T.surfaceMuted}; font-weight: 500; border-bottom: 1px solid ${T.borderSoft};">${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r, ri) => `<tr style="${opts.rowStyle?.(ri) ?? ''}">${r.map((c, i) => `<td style="padding: 12px 16px; border-bottom: 1px solid ${T.borderSoft}; color: ${T.text2}; text-align: ${i >= (opts.numFrom ?? 99) ? 'right' : 'left'}; font-variant-numeric: tabular-nums; ${opts.cellStyle?.(ri, i) ?? ''}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;

artboards['Rates'] = shell({ active: 'Цены и ограничения', content: pageHead('Цены и ограничения', 'Двухместный номер · Базовый тариф · сентябрь 2026', `${select('Двухместный номер', 'width: 200px;')}${select('Базовый тариф (KZT)', 'width: 180px;')}${iconBtn('left', `border-color: ${T.border}; width: 38px; height: 38px;`)}${input('сентябрь 2026', 'width: 140px;')}${iconBtn('chevron', `border-color: ${T.border}; width: 38px; height: 38px;`)}`) +
  `<div style="display: flex; gap: 16px; align-items: flex-start; min-height: 0;">
    <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 12px;">
      ${table(['Дата', 'Цена, 1 гость', 'Цена, 2 гостя', 'Min stay', 'Max stay', 'Stop sell', 'CTA', 'CTD'], rateRows.map((r, i) => i === 4 ? [r[0], `<span style="display: inline-flex; align-items: center; gap: 6px;">${input('9 100', `width: 90px; min-height: 30px; padding: 4px 8px; border-color: ${T.primary}; box-shadow: 0 0 0 3px ${T.primarySoft};`)}<span style="color: ${T.muted};">Enter — сохранить, Esc — отмена</span></span>`, ...r.slice(2)] : r), { numFrom: 1, rowStyle: (i) => (i === 4 || i === 5 || i === 11 ? `background: ${T.warningBg};` : ''), cellStyle: (i, c) => (c === 5 && rateRows[i][5] === 'закрыто' ? `color: ${T.warning}; font-weight: 600;` : '') })}
      <div style="display: flex; align-items: center; gap: 8px; color: ${T.muted};">${icon('incidents', 14, T.warning)}Выходные: стоп-продажа включена словом в колонке, строка подсвечена — не только цветом</div>
    </div>
    ${panel(`<b style="font-size: 16px; font-weight: 600;">Массовое изменение</b>
      <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 16px;">${field('Категория', select('Двухместный номер'))}${field('Тариф', select('Базовый'))}${field('С даты', input('01.09.2026'))}${field('По дату', input('30.09.2026'))}</div>
      <div style="display: flex; gap: 4px; margin: 12px 0; flex-wrap: wrap;">${['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'].map((d, i) => chip(d, i >= 5)).join('')}</div>
      <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px;">${field('Цена за ночь', input('9 100'))}${field('Гостей', select('все'))}${field('Min stay', input('2'))}${field('Max stay', input('', '', true))}${field('Stop sell', select('включить'))}${field('Закрыт заезд (CTA)', select('не менять'))}</div>
      <div style="margin: 16px 0 8px;">${btn('Добавить в список', 'secondary', 'width: 100%;', icon('plus', 16))}</div>
      <div style="display: flex; flex-direction: column; gap: 6px; padding: 12px; border: 1px solid ${T.border}; border-radius: 10px; background: ${T.surfaceMuted}; font-size: 12px;"><div>1. Двухместный · Базовый · сб, вс 01.09 → 30.09 · цена 9 100 ₸ · stop sell</div><div>2. Мужской общий · Базовый · 20.09 → 22.09 · min stay 3</div><div>3. Женский общий · Базовый · 20.09 → 22.09 · min stay 3</div></div>
      <div style="margin-top: 12px; display: flex; justify-content: space-between; align-items: center;">${btn('Сохранить (3)')}<span style="color: ${T.muted};">уйдёт в Channex очередью</span></div>`, 'width: 400px; flex: none;')}
  </div>` });

artboards['Integration'] = shell({ active: 'Менеджер каналов', freshness: { text: 'Exely 09:12 · Channex 09:10 · очередь 2, ошибок 1', warn: true }, content: pageHead('Каналы продаж — Channex', 'Объект channex:ui-property · webhook зарегистрирован · последняя задача ui-task-4f2a', `${btn('Забрать брони из Channex', 'secondary')}${btn('Отправить очередь сейчас')}${btn('Полная выгрузка (500 дней)', 'secondary')}${btn('Проверить webhook', 'secondary')}`) +
  `<div style="display: flex; gap: 16px;">${stat('В очереди', '2', 'ждут отправки')}${stat('Отправлено', '405', 'за 24 часа')}${stat('Ошибок', '1', 'повтор через 5 мин', 'alarm')}</div>
  <div style="padding: 12px 16px; border-radius: 10px; background: ${T.dangerSoft}; border: 1px solid ${T.dangerBorder}; color: ${T.danger}; display: flex; gap: 10px; align-items: center;">${icon('incidents', 16)}<span><b>Каналы могут не знать об остатках.</b> Ошибок отправки: 1. Пока очередь не разошлась, каналы продают по старому остатку. Нажмите «Отправить очередь сейчас» и проверьте ключ Channex.</span></div>
  <div style="display: flex; gap: 16px; min-height: 0;">
    <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px;"><div style="display: flex; align-items: center; gap: 8px;"><b style="font-size: 14px; font-weight: 600;">Очередь в Channex</b>${chip('все', true)}${chip('ждёт')}${chip('ошибка')}</div>
      ${table(['Действие в интерфейсе', 'Что', 'Даты', 'Статус', 'Попыток', 'Task id', 'Время'], [
        ['цена 9 100 ₸, Двухместный', 'цены', '05.09 → 06.09', badge('отправлено', 'ok'), '1', 'ui-task-4f2a', '14.09 09:10'],
        ['бронь 20260913-SHOWDK со стойки', 'остатки', '14.09 → 15.09', badge('ждёт', 'info'), '0', '—', '14.09 09:11'],
        ['отмена 20260913-SHOWCX', 'остатки', '15.09 → 17.09', badge('ошибка', 'danger'), '3', '—', '14.09 08:58'],
        ['min stay 3, Мужской общий', 'ограничения', '20.09 → 22.09', badge('ждёт', 'info'), '0', '—', '14.09 09:12'],
      ], { numFrom: 4 })}
      <div style="color: ${T.muted};">Ошибка попытки 3: Channex ответил 422 «rate plan not found» — проверьте сопоставление тарифов ${btn('Обработать заново', 'secondary', 'height: 30px; padding: 0 10px; margin-left: 8px;')}</div></div>
    <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px;"><div style="display: flex; align-items: center; gap: 8px;"><b style="font-size: 14px; font-weight: 600;">Входящие события</b>${input(`${icon('search', 14, T.muted)}&nbsp; номер брони`, 'min-height: 30px; padding: 4px 8px; width: 160px;', true)}</div>
      ${table(['Событие', 'Тип', 'Как дошло', 'Статус', 'Получено', ''], [
        ['ui-rev-failed', 'booking_new', 'webhook', badge('ошибка', 'danger'), '14.09 05:12', btn('Обработать заново', 'secondary', 'height: 30px; padding: 0 10px;')],
        ['ui-rev-modified', 'booking_modification', 'webhook', badge('обработано', 'ok'), '14.09 04:58', ''],
        ['ui-rev-cancelled', 'booking_cancellation', 'опрос ленты', badge('обработано', 'ok'), '14.09 03:20', ''],
        ['ui-rev-new-2', 'booking_new', 'webhook', badge('обработано', 'ok'), '14.09 02:41', `<a href="#" style="color: ${T.primary};">20260913-SHOWTN</a>`],
      ])}
      <div style="padding: 10px 14px; border-radius: 10px; background: ${T.warningBg}; border: 1px solid ${T.warningBorder}; color: ${T.warning};">Входящая бронь требует разбора: несколько перенесённых броней подходят — 20260913-SHOWTN, 20260913-SHOWEX. Выберите, к какой привязать.</div>
      <div style="display: flex; justify-content: space-between; color: ${T.muted};"><span>показано 4 из 312</span><span>← 1 2 3 … 78 →</span></div></div>
  </div>` });

const chainCard = (title, inner, tone = 'neutral') => `<div style="flex: 1; min-width: 0; background: ${T.surface}; border: 1px solid ${tone === 'warn' ? T.warningBorder : T.border}; border-radius: 16px; padding: 16px; display: flex; flex-direction: column; gap: 10px;"><b style="font-size: 14px; font-weight: 600;">${title}</b>${inner}</div>`;
const arrow = () => `<div style="display: grid; place-items: center; color: ${T.muted}; padding: 0 4px;">${icon('chevron', 20)}</div>`;
artboards['Inbound'] = shell({ active: 'Менеджер каналов', content: pageHead('Приём брони из канала', 'Входящая ревизия → бронь → назначенная койка · время объекта (Алматы)') +
  `<div style="display: flex; align-items: stretch; gap: 8px;">
    ${chainCard('1 · Ревизия Channex', `${badge('booking_new', 'info')} ${badge('webhook · 1,7 с', 'neutral')}<div>Booking.com · получено 14.09.2026 02:41</div><div style="color: ${T.muted};">unique_id BDC-4821-7731 · revision a3f9…</div>${facts([['Категория', 'Мужской общий номер'], ['Даты', '14.09 → 16.09.2026'], ['Гость', 'Әбдірахманова Г. Қ.'], ['Оплата', 'предоплата канала 24 000 ₸']])}`)}
    ${arrow()}
    ${chainCard('2 · Бронь в PMS', `${badge('ждём', 'info')} <a href="#" style="color: ${T.primary}; font-weight: 600;">20260913-SHOWTN</a><div>создана 02:41 · счёт открыт</div>${facts([['Стоимость', '24 000 ₸'], ['Оплачено', '24 000 ₸ каналом'], ['К оплате', '0 ₸'], ['Источник', 'Booking.com']])}${amount('предоплата', '24 000 ₸', 'info')}`)}
    ${arrow()}
    ${chainCard('3 · Койка на шахматке', `${badge('M05 · Мужской общий', 'ok')}<div>назначена автоматически: первая свободная в категории (Q-094)</div><div style="position: relative; height: 46px; border: 1px solid ${T.borderSoft}; border-radius: 8px;">${stayBar({ from: 0, nights: 2, status: 'confirmed', name: 'Әбдірахманова Гүлнұр' }, 150)}</div><div style="color: ${T.muted};">остаток категории 11 → 10 ушёл в Channex через 8 с</div>`)}
  </div>
  <div style="display: flex; gap: 16px;">
    ${panel(`<b style="font-size: 14px; font-weight: 600;">Изменение · booking_modification</b><div style="margin-top: 10px; display: flex; flex-direction: column; gap: 8px;"><div>Даты <s style="color: ${T.muted};">14.09 → 16.09</s> → <b>15.09 → 17.09.2026</b> ${badge('изменено', 'warn')}</div><div>Койка M05 — та же</div><div>Счёт пересчитан: 24 000 ₸ → 24 000 ₸ (2 ночи по 12 000 ₸)</div><div>${toast('Бронь 20260913-SHOWTN изменена каналом: даты 15.09 → 17.09', 'info')}</div></div>`, 'flex: 1;')}
    ${panel(`<b style="font-size: 14px; font-weight: 600;">Отмена · booking_cancellation</b><div style="margin-top: 10px; display: flex; flex-direction: column; gap: 8px;"><div>${badge('отменена', 'danger')} 20260913-SHOWTN · 14.09.2026 03:20 · опрос ленты</div><div>Койка M05 освобождена, остаток категории 10 → 11 ушёл в Channex</div><div>Предоплата канала: удержание по политике канала, штраф не начисляется (ADR-022)</div><div>${toast('Бронь 20260913-SHOWTN отменена каналом, койка M05 свободна', 'warn', 'Открыть')}</div></div>`, 'flex: 1;')}
  </div>` });

// Действия управляющего
artboards['MoveStay'] = boardScreen({ overlayHtml: `<div style="position: absolute; inset: 0; background: ${T.overlay}; display: grid; place-items: center;">${dialog({ title: 'Переселить в двухместный номер R04?', text: 'Гость Ким Дана, бронь 20260913-SHOWOS, сейчас койка F02, 16.09 → 18.09.2026.', consequence: 'Счёт будет пересчитан по тарифу новой категории на весь срок проживания.', amountLabel: 'Новая сумма за 2 ночи', amountSum: '30 000 ₸ (было 16 000 ₸)', confirm: 'Переселить и пересчитать' })}</div><div style="position: absolute; left: 260px; top: 890px;">${note('Внутри категории окна нет: перетащили F02 → F05 — сразу уведомление «Переселена на F05»')}</div>` });

artboards['Extend'] = boardScreen({ overlayHtml: drawer({ tab: 'Обзор', body: `${facts([['Заезд', '14.09.2026'], ['Выезд', '16.09.2026 · 2 ночи'], ['Категория', 'Двухместный номер · R06'], ['Тариф', 'Базовый · 8 000 ₸/ночь']])}
<div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">${btn('Продлить на ночь', 'primary', '', icon('plus', 16))}<span style="color: ${T.muted};">→ до 17.09.2026, +8 000 ₸ на счёт, без формы</span></div>
<div style="display: flex; gap: 8px; align-items: center; position: relative;">${btn('Продлить на ночь', 'disabled', '', icon('plus', 16))}<span style="position: absolute; left: 0; top: 46px; padding: 4px 8px; border-radius: 8px; background: ${T.text}; color: ${T.surface}; font-size: 12px; white-space: nowrap;">R06 занят 17.09: Müller-Lüdenscheidt · есть «Переселить и продлить»</span></div>
<div style="margin-top: 24px; padding: 12px 16px; border-radius: 10px; background: ${T.warningBg}; border: 1px solid ${T.warningBorder}; color: ${T.warning};">Бронь перенесена из Exely без тарифа: перед продлением выберите тариф ${select('Базовый тариф (KZT)', 'min-height: 30px; padding: 4px 8px; margin-left: 8px;')}</div>` }) + `<div style="position: absolute; right: 500px; bottom: 16px;">${toast('Проживание продлено до 17.09.2026, +8 000 ₸ на счёт', 'ok', 'Открыть бронь')}</div>` });

artboards['Tentative'] = shell({ active: 'Шахматка', content: pageHead('Шахматка', '14 сент. — 20 сент. 2026 · Номера и койки · 88 мест', btn('Новая бронь', 'primary', '', icon('plus', 16))) + boardToolbar() + board({ groups: [GROUPS[0]], freeCols: FREE, extraTop: `<div style="padding: 10px 14px; border-radius: 10px; background: ${T.warningBg}; border: 1px solid ${T.warningBorder}; color: ${T.warning}; display: flex; align-items: center; gap: 10px;">${icon('incidents', 16)}<span><b>Входящая бронь требует разбора.</b> Ревизия Booking.com подходит к двум перенесённым броням: 20260913-SHOWTN, 20260913-SHOWEX. Место второй раз не продаётся — остаток категории уже учитывает бронь.</span><span style="margin-left: auto;">${btn('Разобрать', 'secondary', 'height: 30px; padding: 0 10px;')}</span></div>` }) + `<div style="display: flex; gap: 16px;">${panel(`<b style="font-size: 14px; font-weight: 600;">На клетке</b><div style="margin-top: 10px; position: relative; height: 46px; border: 1px solid ${T.borderSoft}; border-radius: 8px;">${stayBar({ from: 0, nights: 2, status: 'tentative', name: 'Әбдірахманова Гүлнұр' }, 200)}</div><div style="color: ${T.muted}; margin-top: 8px;">перенесена из Exely, статус TENTATIVE — словом «не подтверждена» и цветом внимания (Q-130, вариант а)</div>`, 'flex: 1;')}${panel(`<b style="font-size: 14px; font-weight: 600;">В карточке</b><div style="margin-top: 10px; display: flex; gap: 8px; align-items: center;">${badge(`${icon('clock', 12)}не подтверждена`, 'warn')}${btn('Подтвердить', 'primary', 'height: 30px; padding: 0 10px;', icon('check', 14))}${btn('Отменить со штрафом', 'danger', 'height: 30px; padding: 0 10px;')}</div><div style="color: ${T.muted}; margin-top: 8px;">после «Подтвердить» — «ждём», уведомление «Бронь подтверждена»</div>`, 'flex: 1;')}</div>` });

artboards['Conflict'] = shell({ active: 'Шахматка', content: pageHead('Шахматка', '14 сент. — 20 сент. 2026 · Номера и койки · 88 мест', btn('Новая бронь', 'primary', '', icon('plus', 16))) + boardToolbar() + board({ groups: [{ ...GROUPS[1], free: [0, 12, 14, 20, 23, 30, 36] }], freeCols: FREE, unassigned: UNASSIGNED, extraTop: `<div style="padding: 10px 14px; border-radius: 10px; background: ${T.warningBg}; border: 1px solid ${T.warningBorder}; color: ${T.warning}; display: flex; align-items: center; gap: 10px;">${icon('incidents', 16)}<span><b>Мужской общий номер на ночь 14.09: сверх мест, 37 на 36.</b> Число пришло из канала. Двух броней на одной койке не бывает — одна осталась без ячейки.</span><span style="margin-left: auto;">${btn('Разрешить', 'primary', 'height: 30px; padding: 0 10px;')}</span></div>` }) + `<div style="position: absolute; left: 700px; top: 330px; z-index: 2;">${menu([{ icon: 'bed', label: 'Назначить койку', hint: 'свободных сегодня: 0, завтра: 12', hover: true }, { icon: 'inventory', label: 'Переселить в другую категорию', hint: 'Женский общий — 31 свободно · сумма пересчитается' }, { icon: 'close', label: 'Отменить со штрафом', danger: true }])}</div><div style="position: absolute; right: 16px; bottom: 16px;">${toast('Бекболатов Дәулет переселён в женский общий F04, счёт пересчитан', 'ok', 'Открыть')}</div>` });

// Компоненты и токены
const row = (title, inner) => `<div style="display: flex; gap: 24px; padding: 16px 0; border-bottom: 1px solid ${T.borderSoft};"><div style="width: 200px; flex: none; font-size: 13px; font-weight: 600; color: ${T.text};">${title}</div><div style="flex: 1; display: flex; flex-wrap: wrap; gap: 12px; align-items: center;">${inner}</div></div>`;
artboards['Components'] = `<div style="width: 1440px; min-height: 1560px; padding: 32px 40px; box-sizing: border-box; background: ${T.surface}; font-family: ${T.font}; color: ${T.text}; font-size: 12px; line-height: 1.45;">
  <h1 style="margin: 0; font-size: 28px; font-weight: 650; letter-spacing: -.04em;">Компоненты WETOP — стойка</h1>
  <div style="margin: 7px 0 12px; color: ${T.muted};">Значения из design/tokens.json и классов apps/web. Имена — как в DESIGN.md §8. Макеты собираются из этих кусков: копировать между артбордами.</div>
  ${row('Кнопка', `${btn('Принять оплату')}${btn('Второстепенная', 'secondary')}${btn('Отменить со штрафом', 'danger')}${btn('Заселить', 'success')}${btn('Сегодня', 'info')}${btn('Принимаю…', 'disabled')}${btn('Новая бронь', 'primary', '', icon('plus', 16))}${iconBtn('refresh', `border-color: ${T.border};`)}`)}
  ${row('Поле, select, чип', `${input('Әбдірахманова', 'width: 200px;')}${input('Поиск гостя, брони, номера…', 'width: 240px;', true)}${input('%%%', `width: 120px; border-color: ${T.danger}; box-shadow: 0 0 0 3px ${T.dangerSoft};`)}${select('Все статусы', 'width: 150px;')}${chip('Все', true)}${chip('Свободные')}${chip('Занятые')}`)}
  ${row('Бейдж статуса и канала', `${badge(`${icon('clock', 12)}не подтверждена`, 'warn')}${badge(`${icon('booking', 12)}ждём`, 'info')}${badge(`${icon('bed', 12)}заселён`, 'ok')}${badge(`${icon('departure', 12)}выехал`)}${badge(`${icon('close', 12)}отменена`, 'danger')}${badge(`${icon('channels', 12)}Booking.com`)}${badge(`${icon('channels', 12)}Trip.com`)}${badge(`${icon('phone', 12)}стойка`)}`)}
  ${row('Уборка и блокировка', `${badge('грязно', 'warn')}${badge('убрано', 'ok')}${badge('проверено', 'info')}${badge('ремонт: кондиционер', 'danger')}`)}
  ${row('Плашка суммы', `${amount('к оплате', '16 000 ₸', 'danger')}${amount('оплачено', '', 'ok')}${amount('предоплата', '24 000 ₸', 'info')}${amount('штраф', '8 000 ₸', 'danger')}${amount('к возврату', '1 234,50 ₸', 'warn')}`)}
  ${row('Клетка брони', `<div style="position: relative; width: 300px; height: 46px; border: 1px solid ${T.borderSoft}; border-radius: 8px;">${stayBar({ from: 0, nights: 2, status: 'confirmed', name: 'Сериков Арман' }, 150)}</div><div style="position: relative; width: 300px; height: 46px; border: 1px solid ${T.borderSoft}; border-radius: 8px;">${stayBar({ from: 0, nights: 2, status: 'checkedIn', name: 'Ким Дана', extra: amount('к оплате', '16 000 ₸', 'danger') }, 150)}</div><div style="position: relative; width: 300px; height: 46px; border: 1px solid ${T.borderSoft}; border-radius: 8px;">${stayBar({ from: 0, nights: 2, status: 'tentative', name: 'Әбдірахманова Гүлнұр', focus: true }, 150)}</div>`)}
  ${row('Плитка сводки дня', `<div style="display: flex; gap: 16px; width: 100%;">${stat('Проживают', '55', 'активных размещений')}${stat('Заезды сегодня', '24', '17 ожидают заселения')}${stat('Долг уезжающих', '16 000 ₸', '1 счёт', 'alarm')}</div>`)}
  ${row('Переключатель вида и выбор даты', `${seg(['Неделя', '14 дней', 'Месяц'], 'Неделя')}${iconBtn('left', `border-color: ${T.border}; width: 38px; height: 38px;`)}${input('14.09.2026', 'width: 130px;')}${iconBtn('chevron', `border-color: ${T.border}; width: 38px; height: 38px;`)}${btn('Сегодня', 'secondary')}`)}
  ${row('Плашка-объявление', `<div style="display: flex; flex-direction: column; gap: 8px; width: 100%;"><div style="padding: 12px 16px; border-radius: 10px; background: ${T.dangerSoft}; border: 1px solid ${T.dangerBorder}; color: ${T.danger};">Не удалось сохранить: место уже занято. Выберите другую ячейку.</div><div style="padding: 12px 16px; border-radius: 10px; background: ${T.warningBg}; border: 1px solid ${T.warningBorder}; color: ${T.warning};">Каналы могут не знать об остатках: ошибок отправки 1. Нажмите «Отправить очередь сейчас».</div><div style="padding: 12px 16px; border-radius: 10px; background: ${T.successSoft}; color: ${T.success};">Полная выгрузка отправлена: 500 дней, 3 задачи.</div></div>`)}
  ${row('Меню действий', menu([{ icon: 'bed', label: 'Переселить', hint: 'та же категория — без пересчёта', hover: true }, { icon: 'plus', label: 'Продлить на ночь' }, { icon: 'arrival', label: 'Заселить', hint: 'нет документа', disabled: true }, { icon: 'close', label: 'Отменить со штрафом', danger: true }]))}
  ${row('Уведомление', `<div style="display: flex; flex-direction: column; gap: 8px;">${toast('Проживание продлено до 17.09.2026', 'ok', 'Открыть бронь')}${toast('Не удалось отправить остаток в Channex: очередь ждёт повтора', 'danger')}${toast('Отправляем остаток в Channex…', 'info')}</div>`)}
  ${row('Окно подтверждения', dialog({ title: 'Отменить бронь 20260913-SHOWTN?', text: 'Гость Әбдірахманова Гүлнұр Қайратқызы, двухместный номер R06, 14.09 → 16.09.2026.', consequence: 'Штраф за первую ночь останется на счёте, место вернётся в продажу.', amountLabel: 'Штраф по тарифу', amountSum: '8 000 ₸', confirm: 'Отменить со штрафом', tone: 'danger' }))}
  ${row('Подсказка', `<span style="position: relative; display: inline-flex;">${iconBtn('guests', `border-color: ${T.border}; outline: 2px solid ${T.primary}; outline-offset: 3px;`)}<span style="position: absolute; left: 50%; transform: translateX(-50%); top: calc(100% + 6px); padding: 4px 8px; border-radius: 8px; background: ${T.text}; color: ${T.surface}; font-size: 12px; white-space: nowrap;">Открыть карточку гостя</span></span><span style="color: ${T.muted}; margin-left: 140px;">открывается наведением и фокусом, Escape закрывает</span>`)}
  ${row('Пустое состояние и скелетон', `<div style="display: flex; flex-direction: column; align-items: center; text-align: center; padding: 24px; border: 1px dashed ${T.border}; border-radius: 16px; width: 380px; color: ${T.muted};">${icon('check', 32, T.primary)}<h3 style="margin: 8px 0; font-size: 15px; font-weight: 600; color: ${T.text};">Заездов на сегодня нет</h3><p style="margin: 4px 0 16px;">Следующий заезд — завтра, 15.09.2026: 12 проживаний.</p>${btn('Открыть завтра', 'secondary', 'height: 30px; padding: 0 10px;')}</div><div style="display: flex; flex-direction: column; gap: 8px; width: 380px;"><span style="display: block; height: 34px; width: 240px; border-radius: 8px; background: ${T.primarySoft};"></span><span style="display: block; height: 42px; border-radius: 8px; background: ${T.primarySoft};"></span><span style="display: block; height: 42px; border-radius: 8px; background: ${T.primarySoft};"></span></div>`)}
</div>`;

const swatch = (name, hex, dark) => `<div style="border: 1px solid ${T.border}; border-radius: 8px; padding: 8px; font-size: 12px; width: 150px; box-sizing: border-box;"><i style="display: block; height: 36px; margin-bottom: 6px; border-radius: 8px; border: 1px solid ${T.borderSoft}; background: ${hex};"></i><b style="font-weight: 600;">--${name}</b><div style="color: ${T.muted}; font-variant-numeric: tabular-nums;">${hex}${dark ? ` · тёмная ${dark}` : ''}</div></div>`;
const SW = [['bg', '#f4f7fb', '#060b14'], ['surface', '#ffffff', '#0b1524'], ['surface-muted', '#f6f8fc', '#0d192a'], ['border', '#e5eaf2', '#1b2a3d'], ['border-input', '#dce3ee', '#2b3d53'], ['text', '#101827', '#f7f9fc'], ['text-2', '#536176', '#a8b3c5'], ['muted', '#596a80', '#899ab1'], ['primary', '#085fba', '#48a5ff'], ['primary-soft', '#eaf4ff', '#102c49'], ['success', '#06735e', '#38d2ae'], ['success-soft', '#e5f7f0', '#10352f'], ['warning', '#94600b', '#f6ba52'], ['warning-soft', '#fff4df', '#392d19'], ['danger', '#cc384e', '#ff7a87'], ['danger-soft', '#fff2f4', '#34202b'], ['st-confirmed', '#dcecff', '#163958'], ['st-checked-in', '#d7f0e9', '#16443f'], ['st-checked-out', '#e9edf4', '#243044'], ['st-tentative', '#faedcc', '#46361c'], ['st-blocked', '#f7dde2', '#472936'], ['chip-bg', '#edf1f7', '#1b293b'], ['row-hover', '#f2f7fd', '#112137'], ['ring-color', '#eaf4ff', '#102c49']];
artboards['Tokens'] = `<div style="width: 1440px; min-height: 720px; padding: 32px 40px; box-sizing: border-box; background: ${T.surface}; font-family: ${T.font}; color: ${T.text}; font-size: 12px; line-height: 1.45;">
  <h1 style="margin: 0; font-size: 28px; font-weight: 650; letter-spacing: -.04em;">Токены — цвета, шрифт, шкалы</h1>
  <div style="margin: 7px 0 16px; color: ${T.muted};">design/tokens.json (DTCG 2025.10) → tokens.css. Светлая тема и значение тёмной. Границы и кольцо фокуса ниже 3:1 — исключение до 21.09 (DESIGN.md §10).</div>
  <div style="display: flex; flex-wrap: wrap; gap: 8px;">${SW.map(([n, h, d]) => swatch(n, h, d)).join('')}</div>
  <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; margin-top: 24px;">
    <div><b style="font-size: 14px; font-weight: 600;">Шрифт</b><div style="margin-top: 8px; display: flex; flex-direction: column; gap: 4px;"><span style="font-size: 28px; font-weight: 650; letter-spacing: -.04em;">28 · заголовок экрана</span><span style="font-size: 22px; font-weight: 600;">22 · заголовок раздела</span><span style="font-size: 18px; font-weight: 600;">18 · подзаголовок</span><span style="font-size: 16px;">16 · крупный текст, значения</span><span style="font-size: 14px;">14 · основной текст</span><span style="font-size: 13px;">13 · плотные таблицы, бейджи</span><span style="font-size: 12px;">12 · подписи, ничего мельче</span><span style="font-variant-numeric: tabular-nums;">0000 1111 · 12 500 ₸ · 15 688 018 ₸</span></div></div>
    <div><b style="font-size: 14px; font-weight: 600;">Отступы и радиусы</b><div style="margin-top: 8px; display: flex; align-items: flex-end; gap: 8px;">${[4, 8, 16, 24, 32, 40, 48, 64].map((s) => `<span style="display: flex; flex-direction: column; align-items: center; gap: 4px; color: ${T.muted};"><i style="display: block; width: ${s}px; height: ${s}px; background: ${T.primarySoft}; border: 1px solid ${T.primary};"></i>${s}</span>`).join('')}</div><div style="margin-top: 16px; display: flex; gap: 12px;">${[['8', 'контрол'], ['10', 'поле'], ['16', 'карточка'], ['20', 'окно']].map(([r, n]) => `<span style="display: flex; flex-direction: column; align-items: center; gap: 4px; color: ${T.muted};"><i style="display: block; width: 56px; height: 40px; border: 1px solid ${T.primary}; border-radius: ${r}px; background: ${T.surface};"></i>${r} · ${n}</span>`).join('')}</div></div>
    <div><b style="font-size: 14px; font-weight: 600;">Тень и слои</b><div style="margin-top: 8px; display: flex; gap: 16px;"><span style="display: grid; place-items: center; width: 140px; height: 70px; border: 1px solid ${T.border}; border-radius: 16px; background: ${T.surface}; color: ${T.muted};">плоский блок</span><span style="display: grid; place-items: center; width: 140px; height: 70px; border: 1px solid ${T.border}; border-radius: 16px; background: ${T.surface}; box-shadow: ${T.shadowFloating}; color: ${T.muted};">слой над страницей</span></div><div style="margin-top: 12px; color: ${T.muted};">z: base 0 → raised 10 → sticky 20 → dropdown 30 → drawer 40 → modal 50 → toast 60 · движение 120 / 180 мс, ease-out</div></div>
  </div>
</div>`;

// ── запись ──
const doc = (body) => `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <style>
    body { margin: 0; background: ${T.bg}; }
    a { color: ${T.primary}; } a:hover { color: ${T.primaryHover}; }
  </style>
</helmet>
${body}
</x-dc>
</body>
</html>
`;
for (const [name, body] of Object.entries(artboards)) writeFileSync(join(here, `${name}.dc.html`), doc(body));

const W = 1440, H = 1000, GX = 120, GY = 160;
const place = (names, page, y0 = 0, h = H) => names.map((n, i) => ({ file: `${n}.dc.html`, x: i * (W + GX), y: y0, w: W, h, page }));
const canvas = {
  pages: [{ id: 'desk', name: 'Стойка' }, { id: 'channex', name: 'Channex' }, { id: 'actions', name: 'Действия управляющего' }, { id: 'kit', name: 'Компоненты и токены' }],
  artboards: [
    ...place(['Main', 'DeskSummary'], 'desk', 0).map((a, i) => ({ ...a, title: i === 0 ? 'В1-а · Шахматка (два экрана)' : 'В1-б · Сводка над шахматкой' })),
    ...place(['BookingCard', 'ConfirmCancel'], 'desk', H + GY).map((a, i) => ({ ...a, title: i === 0 ? 'Карточка брони и меню действий' : 'Окно подтверждения и уведомление' })),
    ...place(['Rates', 'Integration', 'Inbound'], 'channex', 0).map((a, i) => ({ ...a, title: ['04-1 · Цены и ограничения', '04-2 · Журнал интеграции', '04-3 · Приём брони'][i] })),
    ...place(['MoveStay', 'Extend'], 'actions', 0).map((a, i) => ({ ...a, title: ['05-1 · Переселение с новой суммой', '05-2 · Продлить на ночь'][i] })),
    ...place(['Tentative', 'Conflict'], 'actions', H + GY).map((a, i) => ({ ...a, title: ['05-3 · Не подтверждена (Q-130)', '05-4 · Конфликт и «Разрешить» (Д3)'][i] })),
    { file: 'Components.dc.html', x: 0, y: 0, w: W, h: 1560, page: 'kit', title: 'Компоненты — 31 по DESIGN.md §8', print: 'flow' },
    { file: 'Tokens.dc.html', x: W + GX, y: 0, w: W, h: 720, page: 'kit', title: 'Токены' },
  ],
  annotations: [
    { id: 'v1-question', x: 0, y: -130, w: 720, page: 'desk', text: 'Вопрос В1 (промпт 01): В1-а — два экрана, «Обзор дня» и «Шахматка» (как сейчас в WETOP); В1-б — сводка одной строкой плиток над шахматкой (как в документе ментора). Выберите вариант и напишите причину в чат.' },
    { id: 'review', x: 780, y: -130, w: 640, page: 'desk', text: 'Разбор перед передачей — design/prompts/06-review.md: контраст и размер текста, одна главная кнопка, имена компонентов из DESIGN.md, смысл не только цветом, цели нажатия ≥ 24 px, четыре состояния экрана, форматы дат и денег.' },
    { id: 'channex-note', x: 0, y: -100, w: 720, page: 'channex', text: 'Три рабочих экрана для созвона сертификации Channex. Отдельного экрана «для сертификации» нет — Channex такой приём отклоняет. Проверяющий попросит «поменять цену на 250 и min stay на 3»: правка в ячейке таблицы и массовое изменение справа.' },
    { id: 'actions-note', x: 0, y: -100, w: 720, page: 'actions', text: 'Четыре действия управляющего — его список болей, удобно ли вышло, решает он. Каждый макет: до → действие → подтверждение → результат уведомлением.' },
    { id: 'kit-note', x: 0, y: -100, w: 720, page: 'kit', text: 'Компоненты собраны из тех же значений, что и код стойки (design/tokens.json, components.css). Новый компонент — сначала строка в DESIGN.md §8, потом сюда.' },
  ],
  launch: { view: 'canvas', page: 'desk' },
};
writeFileSync(join(here, 'canvas.json'), JSON.stringify(canvas, null, 2) + '\n');
console.log(`артбордов: ${Object.keys(artboards).length}`);
