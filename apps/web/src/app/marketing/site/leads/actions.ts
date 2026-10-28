'use server';
import { revalidatePath } from 'next/cache';
import { ApiError, siteLeadsApi, type SiteLeadStatus } from '../../../../lib/api';

/** Статус заявки с сайта (S3): ответ API словами, без падения экрана */
export async function leadStatusAction(id: string, status: SiteLeadStatus): Promise<{ error: string | null }> {
  try {
    await siteLeadsApi.setStatus(id, status);
    revalidatePath('/marketing/site/leads');
    return { error: null };
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e) };
  }
}
