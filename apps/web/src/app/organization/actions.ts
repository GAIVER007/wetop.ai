'use server';
import { revalidatePath } from 'next/cache';
import { parseBranchInput, type BranchInputField } from '@pms/domain';
import { ApiError, organizationApi, type OrganizationBranch } from '../../lib/api';
import { formValues } from '../../lib/form-values';

export interface BranchActionResult {
  error: string | null;
  field?: BranchInputField | undefined;
  saved?: OrganizationBranch;
  values?: Record<string, string>;
  attempt?: number;
}

const FIELDS = ['name', 'address', 'phone', 'email', 'timezone', 'currency'] as const;

/**
 * Новый филиал (Platform P3, ADR-130): проверка, той же функцией домена, что у API, поэтому причина одна и стоит у
 * поля; API проверяет ещё раз (владелец, «только чтение», тёзка, 409 с полем). Введённое при отказе не теряется.
 */
export async function createBranchAction(
  prev: BranchActionResult | null,
  form: FormData,
  defaults: { timezone: string; currency: string },
): Promise<BranchActionResult> {
  const body = {
    name: String(form.get('name') ?? ''),
    address: String(form.get('address') ?? ''),
    phone: String(form.get('phone') ?? ''),
    email: String(form.get('email') ?? ''),
    timezone: String(form.get('timezone') ?? ''),
    currency: String(form.get('currency') ?? ''),
  };
  const fail = (error: string, field?: BranchInputField): BranchActionResult => ({
    error,
    field,
    values: formValues(form, FIELDS),
    attempt: (prev?.attempt ?? 0) + 1,
  });
  const parsed = parseBranchInput(body, defaults);
  if (!parsed.ok) return fail(parsed.reason, parsed.field);
  try {
    const saved = await organizationApi.createBranch(body);
    revalidatePath('/organization');
    revalidatePath('/', 'layout');
    return { error: null, saved };
  } catch (e) {
    if (e instanceof ApiError) return fail(e.message, e.status === 409 ? 'name' : undefined);
    return fail(e instanceof Error ? e.message : String(e));
  }
}
