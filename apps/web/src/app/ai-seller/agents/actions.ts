'use server';
import { revalidatePath } from 'next/cache';
import { sellerAgentsApi, ApiError } from '../../../lib/api';
export async function saveAgent(id: string, profile: Record<string, string>, updatedAt: string) {
  try {
    const result = await sellerAgentsApi.update(id, { profile, updatedAt });
    revalidatePath('/ai-seller/agents');
    return { ok: true as const, updatedAt: result.updatedAt };
  } catch (e) {
    if (e instanceof ApiError) return { ok: false as const, error: e.message };
    throw e;
  }
}

export async function createAgent(id: string, profile: Record<string, string>) {
  try {
    const result = await sellerAgentsApi.create(id, profile);
    revalidatePath('/ai-seller/agents');
    return { ok: true as const, id: result.id };
  } catch (e) {
    if (e instanceof ApiError) return { ok: false as const, error: e.message };
    throw e;
  }
}
