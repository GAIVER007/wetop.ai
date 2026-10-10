'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { parseAgentInput, type AgentInputField } from '@pms/domain';
import { ApiError, businessAgentsApi } from '../../../lib/api';

/**
 * Создание AI-продавца-черновика (SA2). Организацию и автора называет сервер из вошедшего: форма передаёт только название,
 * Business, филиал и ключ повтора. Ответ — слова для человека; введённое остаётся в форме при любой ошибке.
 */
export interface CreateAgentResult {
  error: string | null;
  /** Ошибка относится к полю — остальным ничего не мешает */
  field: AgentInputField | null;
  values: { name: string; businessId: string; locationId: string };
  attempt: number;
}

const text = (fd: FormData, name: string) => String(fd.get(name) ?? '');

export async function createAgentAction(
  prev: CreateAgentResult | null,
  fd: FormData,
): Promise<CreateAgentResult> {
  const values = { name: text(fd, 'name'), businessId: text(fd, 'businessId'), locationId: text(fd, 'locationId') };
  const attempt = (prev?.attempt ?? 0) + 1;
  const parsed = parseAgentInput(values);
  if (!parsed.ok) {
    const field = (['name', 'businessId', 'locationId'] as const).find((f) => parsed.errors[f]) ?? null;
    return { error: field ? (parsed.errors[field] ?? null) : null, field, values, attempt };
  }
  let id: string;
  try {
    id = (await businessAgentsApi.create(text(fd, 'idempotencyKey'), parsed.value)).id;
  } catch (e) {
    const error = e instanceof ApiError || e instanceof Error ? e.message : String(e);
    return { error, field: null, values, attempt };
  }
  revalidatePath('/ai-agents');
  redirect(`/ai-agents/${encodeURIComponent(id)}`);
}
