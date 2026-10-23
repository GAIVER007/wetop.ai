import type { TrackedSiteCard } from './api';

/**
 * Демо онлайн-брони гостиницы внутри стойки (живой аудит 21.10.2026). Адрес API наружу пускает только пути виджета,
 * поэтому `/w/demo` давал 404. Страница стойки `/website/booking/demo` собирает ту же страницу проверки: виджет с
 * адреса API по ключу сайта. Счётчик посещений сюда не ставится, чтобы проверка не попадала в отчёт о посещениях.
 */
export function bookingDemoHref(siteId: string): string {
  return `/website/booking/demo?site=${encodeURIComponent(siteId)}`;
}

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

const KEY_RE = /^pms_[0-9a-f]{12}$/;

/** Адрес скрипта виджета из кода установки: только https/http и только `.../w/widget.js` */
function widgetScript(code: string): string | null {
  const src = /<script[^>]*\ssrc="([^"]+)"/.exec(code)?.[1];
  if (!src) return null;
  try {
    const url = new URL(src);
    return (url.protocol === 'https:' || url.protocol === 'http:') && url.pathname.endsWith('/w/widget.js')
      ? url.href
      : null;
  } catch {
    return null;
  }
}

const STYLE =
  "*{box-sizing:border-box}body{font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;margin:0;padding:28px 20px 48px;color:#16213a;background:#f4f5f8;line-height:1.45;color-scheme:light}.wrap{max-width:640px;margin:0 auto}h1{font-size:23px;font-weight:800;margin:0 0 4px}.sub{font-size:13px;color:#6b7280;margin:0 0 18px}p{font-size:15px;color:#3d4656}a{color:#17399f}";

function page(title: string, body: string): string {
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title><style>${STYLE}</style></head><body><div class="wrap">${body}</div></body></html>`;
}

export function bookingDemoHtml(card: Pick<TrackedSiteCard, 'site' | 'snippet'> | null): string | null {
  if (!card)
    return page(
      'Демо брони недоступно',
      '<h1>Демо брони недоступно</h1><p>Сайт не найден. Включите «Принимать брони с сайта» и выберите тариф, затем откройте демо снова.</p><p><a href="/website/booking">Вернуться к настройкам бронирования</a></p>',
    );
  const { site, snippet } = card;
  const src = widgetScript(snippet.bookingCode);
  if (!site.bookingEnabled || !site.bookingRatePlan || !src || !KEY_RE.test(site.publicKey)) return null;
  return page(
    'Проверка бронирования с сайта',
    `<h1>Проверка бронирования с сайта</h1><p class="sub">Сайт: <b>${esc(site.name)}</b>. Ниже тот же виджет, что встанет на сайт по коду из карточки. Бронь отсюда настоящая: она появится на шахматке и в «Сегодня» с источником «сайт».</p><div id="pms-booking"></div><script async src="${esc(src)}" data-site="${site.publicKey}"></script><p><a href="/website/booking">Вернуться к настройкам бронирования</a></p>`,
  );
}
