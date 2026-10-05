'use server';
import { formValues } from '../../../lib/form-values';
import { revalidatePath } from 'next/cache';
import { ApiError, guestsApi } from '../../../lib/api';

export interface GuestActionResult {
  error: string | null;
  values?: Record<string, string>;
  attempt?: number;
}
const describe = (e: unknown) =>
  e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e);
const s = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' ? v.trim() : '';
};

export async function updateGuestAction(
  id: string,
  _prev: GuestActionResult,
  fd: FormData,
): Promise<GuestActionResult> {
  try {
    // Только поля, которые есть в форме: пока база не в Казахстане, форма показывает гражданство и пол (ADR-072)
    const body: Record<string, string | null> = {
      firstName: s(fd, 'firstName'),
      lastName: s(fd, 'lastName'),
      middleName: s(fd, 'middleName') || null,
      birthDate: s(fd, 'birthDate') || null,
      citizenship: s(fd, 'citizenship') || null,
      gender: s(fd, 'gender') || 'UNKNOWN',
      phone: s(fd, 'phone') || null,
      email: s(fd, 'email') || null,
      notes: s(fd, 'notes') || null,
    };
    await guestsApi.update(id, Object.fromEntries(Object.entries(body).filter(([k]) => fd.has(k))));
  } catch (e) {
    return {
      error: describe(e),
      values: formValues(fd, [
        'firstName',
        'lastName',
        'middleName',
        'birthDate',
        'citizenship',
        'gender',
        'phone',
        'email',
        'notes',
      ]),
      attempt: (_prev?.attempt ?? 0) + 1,
    };
  }
  revalidatePath(`/guests/${id}`);
  revalidatePath('/reservations', 'layout');
  return { error: null };
}
export async function addDocumentAction(
  id: string,
  _prev: GuestActionResult,
  fd: FormData,
): Promise<GuestActionResult> {
  try {
    await guestsApi.addDocument(id, {
      type: s(fd, 'type'),
      number: s(fd, 'number'),
      issueCountry: s(fd, 'issueCountry') || null,
      issuedAt: s(fd, 'issuedAt') || null,
      expiresAt: s(fd, 'expiresAt') || null,
    });
  } catch (e) {
    return {
      error: describe(e),
      values: formValues(fd, ['type', 'number', 'issueCountry', 'issuedAt', 'expiresAt']),
      attempt: (_prev?.attempt ?? 0) + 1,
    };
  }
  revalidatePath(`/guests/${id}`);
  return { error: null };
}
export async function deleteDocumentAction(
  id: string,
  documentId: string,
): Promise<GuestActionResult> {
  try {
    await guestsApi.deleteDocument(id, documentId);
  } catch (e) {
    return { error: describe(e) };
  }
  revalidatePath(`/guests/${id}`);
  return { error: null };
}
