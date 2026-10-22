import { NextResponse } from 'next/server';
import { ApiError, marketingAdsApi } from '../../../../lib/api';

/**
 * Загрузка креатива-видео из мастера «Новая кампания с ИИ». Файл до 200 МБ не проходит через действие формы
 * (предел тела действий 11 МБ, next.config.ts), поэтому мастер шлёт его сюда отдельным запросом, а запуск потом
 * получает только номер креатива. Права, тип и размер проверяет API (`POST /marketing/ads/creatives`, право
 * `ads_launch`): здесь только пересылка с сессией человека.
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Файл не получен: повторите загрузку' }, { status: 400 });
  }
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'Выберите видео креатива' }, { status: 400 });
  }
  try {
    const creative = await marketingAdsApi.uploadCreative(file);
    return NextResponse.json({ id: creative.id });
  } catch (e) {
    if (e instanceof ApiError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: 'Не удалось сохранить видео, повторите позже' }, { status: 502 });
  }
}
