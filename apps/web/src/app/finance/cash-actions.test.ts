import {it,expect,vi} from 'vitest';
vi.mock('../../i18n/server', async () => ({
  serverT: async () => (await import('../../i18n')).translator('ru'),
  currentLocale: async () => 'ru',
}));
const api=vi.hoisted(()=>({createCashOperation:vi.fn(),createCashTransfer:vi.fn(),createCashReconciliation:vi.fn()}));
vi.mock('../../lib/api',()=>({financeApi:api,ApiError:class extends Error{}}));
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}));
import {cashOperationAction,cashTransferAction,cashReconcileAction} from './cash-actions';
it.each([[cashOperationAction,'createCashOperation'],[cashTransferAction,'createCashTransfer'],[cashReconcileAction,'createCashReconciliation']] as const)('forwards stable intent through actual action %s',async(action,name)=>{
 const fd=new FormData();fd.set('idempotencyKey','synthetic-stable-intent');fd.set('amount','10');fd.set('counted','10');fd.set('kind','INCOME');
 await action({error:null,ok:0},fd);
 expect(api[name]).toHaveBeenLastCalledWith(expect.objectContaining({idempotencyKey:'synthetic-stable-intent'}));
});

it.each([
  [cashOperationAction, 'createCashOperation', 'amount', 'Укажите сумму'],
  [cashTransferAction, 'createCashTransfer', 'amount', 'Укажите сумму'],
  [cashReconcileAction, 'createCashReconciliation', 'counted', 'Укажите пересчитанную сумму'],
] as const)('пустая сумма: русская подсказка без запроса к API (аудит 22.10.2026 P1-23) %#', async (action, name, _field, text) => {
  api[name].mockClear();
  const fd = new FormData();
  fd.set('kind', 'EXPENSE');
  const r = await action({ error: null, ok: 0 }, fd);
  expect(r.error).toBe(text);
  expect(api[name]).not.toHaveBeenCalled();
});
