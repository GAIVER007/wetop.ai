import {it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {cashDraftIntent} from './cash-draft-intent';
it('all actual HOTEL forms use persistent intent action wrapper',()=>{
 const source=readFileSync('apps/web/src/app/finance/cash.tsx','utf8');
 for(const action of ['cashOperationAction','cashTransferAction','cashReconcileAction']) expect(source).toContain(`useCashIntentAction(${action},`);
});
it('same draft survives transport failure/remount, isolates scopes, clears on acknowledged success without storing PII',async()=>{
 const rows=new Map<string,string>();vi.stubGlobal('sessionStorage',{getItem:(k:string)=>rows.get(k),setItem:(k:string,v:string)=>rows.set(k,v),removeItem:(k:string)=>rows.delete(k)});
 const fd=new FormData();fd.set('note','synthetic private note');fd.set('amount','10');
 const first=await cashDraftIntent('scope-a','operation',fd);
 expect((await cashDraftIntent('scope-a','operation',fd)).key).toBe(first.key);
 expect((await cashDraftIntent('scope-b','operation',fd)).key).not.toBe(first.key);
 expect(JSON.stringify([...rows])).not.toContain('synthetic private note');
 first.acknowledge();expect((await cashDraftIntent('scope-a','operation',fd)).key).not.toBe(first.key);
 vi.unstubAllGlobals();
});
