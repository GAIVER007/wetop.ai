 'use server';
import { revalidatePath } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { currentMe, deskShell } from '../../lib/desk-shell';
import { mayAccess } from '../../lib/navigation';
import { openingApi, type OpeningInput, type OpeningState } from '../../lib/opening-api';
import { openingInput } from './opening-input';
import { msg } from '../../i18n';
import { serverT } from '../../i18n/server';
export async function loadOpening(): Promise<OpeningState> {
 if (process.env.RESTAURANT_CAPACITY_CAPTURE !== 'true' || process.env.RESTAURANT_OCCUPANCY_CAPTURE !== 'true') return {enabled:false,schedule:null};
 try { return {enabled:true,schedule:(await openingApi.read())[0] ?? null}; }
 catch (e) { unstable_rethrow(e); return {enabled:true,schedule:null,error:(await serverT())(msg('Расписание недоступно. Обновите страницу перед изменением.'))}; }
}
export async function saveOpening(scopeKey: string, raw: OpeningInput, confirmed: boolean): Promise<{error: string | null}> {
 try {
  if (process.env.RESTAURANT_CAPACITY_CAPTURE !== 'true' || process.env.RESTAURANT_OCCUPANCY_CAPTURE !== 'true') throw new Error(msg('Учёт физических часов отключён.'));
  const me = await currentMe(); const shell = await deskShell(); const c = me.context;
  if (!me.user || c?.vertical !== 'FOOD_SERVICE' || !c.businessId || !c.locationId || scopeKey !== `${c.businessId}:${c.locationId}`) throw new Error(msg('Выбран другой ресторан. Откройте настройки заново.'));
  if (shell.readOnly || !mayAccess(shell.access,'property')) throw new Error(msg('Нет права изменять настройки ресторана.'));
  if (!confirmed) throw new Error(msg('Подтвердите физические часы работы зала.'));
  await openingApi.confirm(openingInput(raw));
  revalidatePath('/restaurant-settings'); revalidatePath('/today');
  return {error:null};
 } catch (e) {
  unstable_rethrow(e);
  const message = e instanceof Error ? e.message : '';
  // свои тексты выше размечены `msg`, текст API без перевода остаётся как есть
  const t = await serverT();
  return {error:message.includes('LOCAL_TIME_NONEXISTENT_OR_AMBIGUOUS') ? t('Переход часов: указанное местное время отсутствует или неоднозначно. Исправьте часы.') : message ? t(message) : t('Не удалось сохранить. Проверьте результат перед повтором.')};
 }
}
