import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  Inject,
  Ip,
  NotFoundException,
  Post,
  Query,
} from '@nestjs/common';
import { normalizeHost, SITE_KEY_RE } from '@pms/domain';
import { clientIp } from './client-ip';
import { WebBookingService, type RequestContext } from './web-booking.service';

/** Скрипт виджета читается один раз при старте; отдаётся как есть. */
export const WIDGET_JS = readFileSync(resolve(import.meta.dirname, 'widget.js'), 'utf-8');

function hostOf(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return normalizeHost(new URL(value).hostname);
  } catch {
    return null;
  }
}

function context(h: {
  origin?: string | undefined;
  referer?: string | undefined;
  host?: string | undefined;
  ip?: string | undefined;
}): RequestContext {
  return {
    originHost: hostOf(h.origin) ?? hostOf(h.referer),
    ownHost: h.host ? normalizeHost(h.host) : null,
    ip: h.ip ?? null,
  };
}

/**
 * Публичная часть бронирования с сайта (срез 9): скрипт виджета, цены и места, бронь, демо-страница.
 * CORS для доменов сайта — middleware модуля. Ошибки бизнес-правил (нет мест, ограничение, нет цены)
 * возвращаются как есть текстом — виджет показывает их гостю.
 */
@Controller('w')
export class WebBookingController {
  constructor(@Inject(WebBookingService) private readonly service: WebBookingService) {}

  @Get('widget.js')
  @Header('Content-Type', 'application/javascript; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=3600')
  script(): string {
    return WIDGET_JS;
  }

  @Get('availability')
  availability(
    @Query() query: Record<string, string>,
    @Headers('origin') origin?: string,
    @Headers('referer') referer?: string,
    @Headers('host') host?: string,
  ) {
    return this.service.quote(query, context({ origin, referer, host }));
  }

  @Post('book')
  @HttpCode(201)
  book(
    @Body() body: unknown,
    @Ip() socketIp: string,
    @Headers('cf-connecting-ip') cfConnectingIp?: string,
    @Headers('origin') origin?: string,
    @Headers('referer') referer?: string,
    @Headers('host') host?: string,
  ) {
    const ip = clientIp(socketIp, cfConnectingIp) ?? undefined;
    return this.service.book(body, context({ origin, referer, host, ip }));
  }

  /** Страница с виджетом (и счётчиком) на адресе API — проверить бронирование, ничего не вставляя на сайт. */
  @Get('demo')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  async demo(@Query('k') key?: string): Promise<string> {
    const site = key && SITE_KEY_RE.test(key) ? await this.service.siteForDemo(key) : null;
    if (!site) throw new NotFoundException('сайт не найден или бронирование с сайта выключено');
    return demoPage(site.name, site.publicKey);
  }
}

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

function demoPage(siteName: string, key: string): string {
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Проверка бронирования с сайта</title>
<script async src="/a/pms.js" data-site="${key}"></script>
<style>*{box-sizing:border-box}body{font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;margin:0;padding:28px 20px 48px;color:#16213a;background:#f4f5f8;line-height:1.45;color-scheme:light}.wrap{max-width:640px;margin:0 auto}h1{font-size:23px;font-weight:800;letter-spacing:-.01em;margin:0 0 4px}.sub{font-size:13px;color:#6b7280;margin:0 0 18px}p,li{font-size:15px;color:#3d4656}code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;background:#e8eefc;color:#17399f;padding:2px 6px;border-radius:4px}.card{background:#fff;border:1px solid #e3e5e8;border-radius:14px;padding:18px}</style></head>
<body><div class="wrap"><h1>Проверка бронирования с сайта</h1>
<p class="sub">Сайт: <b>${esc(siteName)}</b> — ниже тот же виджет, что встанет на сайт по коду с карточки сайта. Бронь отсюда настоящая: она появится на шахматке и в «Сегодня» с источником «сайт».</p>
<div id="pms-booking"></div>
<script async src="/w/widget.js" data-site="${key}"></script>
</div></body></html>`;
}
