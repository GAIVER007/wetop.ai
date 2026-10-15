'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authApi } from '../../../lib/api';
import { setScopeCookie } from '../../../lib/session';

export async function confirmRegistrationContext() {
  const context = await authApi.registrationContext();
  if (!context) redirect('/scope/resolve');
  await setScopeCookie(`business=${context.businessId};location=${context.locationId}`);
  revalidatePath('/', 'layout');
  redirect('/register/setup');
}
