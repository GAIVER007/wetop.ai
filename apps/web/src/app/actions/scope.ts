'use server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { cookieSecure } from '../../lib/session-cookie';
import {
  SCOPE_COOKIE,
  SCOPE_COOKIE_MAX_AGE_SECONDS,
  scopePointerValue,
} from '../../lib/scope-pointer';

/**
 * Выбор филиала (Platform P3, ADR-130; правило куки — ADR-120, Q-214): кука `wetop_scope` — намерение человека, не
 * право. Стойка пересылает её API заголовком, API проверяет на каждом запросе и чужой или архивный выбор тихо
 * сводит к организации целиком. Макет перечитывается целиком: объект в шапке, меню и экран — уже выбранного филиала.
 */
export async function switchScopeAction(form: FormData): Promise<void> {
  const raw = String(form.get('scope') ?? '');
  const [businessId = '', locationId = ''] = raw.split('/');
  const value = scopePointerValue(businessId, locationId);
  const jar = await cookies();
  if (!value) {
    jar.delete(SCOPE_COOKIE);
  } else {
    jar.set(SCOPE_COOKIE, value, {
      httpOnly: true,
      sameSite: 'lax',
      secure: cookieSecure(process.env),
      path: '/',
      maxAge: SCOPE_COOKIE_MAX_AGE_SECONDS,
    });
  }
  revalidatePath('/', 'layout');
}
