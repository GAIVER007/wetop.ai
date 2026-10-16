import {it,expect,vi} from 'vitest';
const api=vi.hoisted(()=>({createCashOperation:vi.fn(),createCashTransfer:vi.fn(),createCashReconciliation:vi.fn()}));
vi.mock('../../lib/api',()=>({financeApi:api,ApiError:class extends Error{}}));
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}));
import {cashOperationAction,cashTransferAction,cashReconcileAction} from './cash-actions';
it.each([[cashOperationAction,'createCashOperation'],[cashTransferAction,'createCashTransfer'],[cashReconcileAction,'createCashReconciliation']] as const)('forwards stable intent through actual action %s',async(action,name)=>{
 const fd=new FormData();fd.set('idempotencyKey','synthetic-stable-intent');fd.set('amount','10');fd.set('kind','INCOME');
 await action({error:null,ok:0},fd);
 expect(api[name]).toHaveBeenLastCalledWith(expect.objectContaining({idempotencyKey:'synthetic-stable-intent'}));
});
