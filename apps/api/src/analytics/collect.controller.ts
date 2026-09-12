import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  Body,
  Catch,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  Inject,
  NotFoundException,
  Post,
  Query,
  UseFilters,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';
import { SITE_KEY_RE } from '@pms/domain';
import { CollectService } from './collect.service';

/** Скрипт счётчика читается один раз при старте; отдаётся как есть (план среза 8 §4). */
export const TRACKER_JS = readFileSync(resolve(import.meta.dirname, 'tracker.js'), 'utf-8');

/**
 * Публичный приёмник не должен ни отдавать ошибки наружу, ни засорять журнал по каждому кривому
 * запросу (тело больше 4 КБ → PayloadTooLargeError и стек в логе на каждый вызов). Всегда 204.
 */
@Catch()
class QuietFilter implements ExceptionFilter {
  catch(_e: unknown, host: ArgumentsHost): void {
    host.switchToHttp().getResponse<Response>().status(204).end();
  }
}

/**
 * Публичная часть аналитики сайта: скрипт и приёмник. Пути `/a/pms.js` и `/a/hit` без стоп-слов
 * блокировщиков (analytics, collect, track). На публичном адресе наружу должны смотреть только они
 * и webhook Channex (Q-112).
 */
@Controller('a')
export class CollectController {
  constructor(@Inject(CollectService) private readonly collect: CollectService) {}

  @Get('pms.js')
  @Header('Content-Type', 'application/javascript; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=3600')
  script(): string {
    return TRACKER_JS;
  }

  /** Всегда 204 и сразу: что не по форме, не с того домена или сверх лимита — молча не сохраняется. */
  @Post('hit')
  @HttpCode(204)
  @UseFilters(new QuietFilter())
  async hit(
    @Body() body: unknown,
    @Headers('user-agent') userAgent?: string,
    @Headers('origin') origin?: string,
    @Headers('referer') referer?: string,
    @Headers('host') host?: string,
  ): Promise<void> {
    await this.collect.accept(body, { userAgent, origin, referer, host });
  }

  /**
   * Страница со счётчиком на адресе самого API: открыть с телефона, нажать кнопки — и увидеть события
   * на /analytics/setup, ничего не вставляя на сайт. Ключ — из кода счётчика (не секрет).
   */
  @Get('demo')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  async demo(@Query('k') key?: string, @Query('p') page?: string): Promise<string> {
    const site = key && SITE_KEY_RE.test(key) ? await this.collect.siteByKey(key) : null;
    if (!site) throw new NotFoundException('сайт с таким ключом не найден');
    return demoPage(site.name, site.publicKey, page === '2');
  }
}

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

function demoPage(siteName: string, key: string, second: boolean): string {
  const title = second ? 'Вторая страница' : 'Проверка счётчика PMS';
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title>
<script async src="/a/pms.js" data-site="${key}"></script>
<style>body{font-family:system-ui,sans-serif;margin:0;padding:24px;max-width:560px;color:#1a1a1a;background:#f6f7f9}h1{font-size:20px}p,li{font-size:15px;line-height:1.5}button{display:block;width:100%;margin:8px 0;padding:12px;font-size:16px;border-radius:8px;border:1px solid #2a78d6;background:#fff;color:#2a78d6}a.btn{display:block;margin:8px 0;padding:12px;text-align:center;border-radius:8px;background:#2a78d6;color:#fff;text-decoration:none}code{background:#eef0f3;padding:2px 4px;border-radius:4px}#log{font-size:13px;color:#166534;min-height:1.5em}</style></head>
<body><h1>${esc(title)}</h1>
<p>Сайт: <b>${esc(siteName)}</b>, ключ <code>${key}</code>.</p>
<p>${
    second
      ? 'Это второй просмотр в той же сессии. Вернитесь назад или нажмите кнопки — события уйдут в PMS.'
      : 'Эта страница уже отправила просмотр. Нажмите кнопки, затем на странице «Подключение счётчика» в PMS нажмите «Проверить счётчик» или откройте отчёт за сегодня.'
  }</p>
<button type="button" onclick="pms('event', 'search', {arrival:'2026-10-01', departure:'2026-10-03', adults:2}); log('поиск дат 01–03.10.2026')">Поиск дат (search)</button>
<button type="button" onclick="pms('event', 'phone_click'); log('клик по телефону')">Клик по телефону (phone_click)</button>
<button type="button" onclick="pms('event', 'whatsapp_click'); log('клик по WhatsApp')">Клик по WhatsApp (whatsapp_click)</button>
<a class="btn" href="/a/demo?k=${key}&amp;p=${second ? '1' : '2'}">${second ? 'Назад на первую страницу' : 'Вторая страница (ещё один просмотр)'}</a>
<div id="log"></div>
<p style="color:#666;font-size:13px">Счётчик не собирает персональные данные: без cookies, IP и имён. Источник у этой страницы — «прямой заход», если вы открыли её по ссылке из мессенджера — «соцсети».</p>
<script>function log(t){document.getElementById('log').textContent='Отправлено: '+t+' — '+new Date().toLocaleTimeString('ru-RU')}</script>
</body></html>`;
}
