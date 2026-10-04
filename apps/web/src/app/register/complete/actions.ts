'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authApi } from '../../../lib/api';
import { SCOPE_COOKIE } from '../../../lib/scope-pointer';

export async function confirmRegistrationContext() {
  const context = await authApi.registrationContext();
  if (!context) throw new Error('Рабочее пространство недоступно');
  (await cookies()).set(
    SCOPE_COOKIE,
    `business=${context.businessId};location=${context.locationId}`,
    {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    },
  );
  revalidatePath('/', 'layout');
  redirect('/register/setup');
}
