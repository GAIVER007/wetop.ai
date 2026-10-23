import { NextResponse } from 'next/server';
import { analyticsApi } from '../../../../lib/api';
import { bookingDemoHtml } from '../../../../lib/booking-demo';

export const dynamic = 'force-dynamic';

/**
 * Демо онлайн-брони внутри стойки (живой аудит 21.10.2026). «Открыть демо» вело на `api.wetop.ai/w/demo`, а туннель
 * этот путь наружу не пускает (`deploy/cloudflared.example.yml`), и владелец видел пустую страницу 404. Эта страница
 * открыта только вошедшему: карточку сайта API отдаёт по правам стойки, виджет грузится с адреса API как на сайте
 * гостя, а цены и бронь API принимает с адреса стойки (`appDemoHost`).
 */
export async function GET(request: Request): Promise<Response> {
  const id = new URL(request.url).searchParams.get('site') ?? '';
  const card = id ? await analyticsApi.card(id).catch(() => null) : null;
  const html = card ? bookingDemoHtml(card) : null;
  return new NextResponse(html ?? bookingDemoHtml(null), {
    status: html ? 200 : 404,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}
