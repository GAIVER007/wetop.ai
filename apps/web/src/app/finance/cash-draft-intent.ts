import { msg } from '../../i18n';

/** Persist only digest + random key: no form values, notes, or identity in storage. */
export async function cashDraftIntent(scope: string, command: string, fd: FormData) {
  if (!scope) throw new Error(msg('Сначала выберите объект'));
  const fields = Array.from(fd.entries()).filter(([k]) => !k.startsWith('$ACTION_') && k !== 'idempotencyKey').sort(([a],[b])=>a.localeCompare(b));
  const bytes = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([scope,command,fields])));
  const digest = Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');
  const slot = `wetop:hotel-cash:${digest}`;
  const key = sessionStorage.getItem(slot) || crypto.randomUUID();
  sessionStorage.setItem(slot,key);
  return {key, acknowledge:()=>sessionStorage.removeItem(slot)};
}
