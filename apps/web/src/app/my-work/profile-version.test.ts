import { beforeEach, describe, expect, it, vi } from 'vitest';
import { savePortal } from './actions';
import { employeePortalApi } from '../../lib/employee-portal-api';
import { ApiError } from '../../lib/api-error';
vi.mock('next/navigation',()=>({unstable_rethrow:vi.fn()}));
vi.mock('../../lib/scope-pointer',()=>({requestScopeHeader:async()=>({'x-wetop-scope':'synthetic-scope'})}));
vi.mock('../../lib/employee-portal-api',()=>({employeePortalApi:{load:vi.fn(),profile:vi.fn()}}));
const original='2026-01-01T00:00:00.123456Z';
function form() {
  const f=new FormData();f.set('name','Draft');f.set('expectedRevision','7');f.set('expectedProfileRevision',original);return f;
}
describe('Portal profile original-version boundary',()=>{
  beforeEach(()=>{vi.clearAllMocks();vi.mocked(employeePortalApi.load).mockResolvedValue({access:'MANAGER',employee:{profileRevision:'2026-01-01T00:00:00.999999Z'},profile:{revision:'9'}} as never);});
  it('forwards both browser originals, never fresh versions from the authorization read',async()=>{
    vi.mocked(employeePortalApi.profile).mockResolvedValue({} as never);
    await savePortal({employeeId:'synthetic'},'synthetic-scope','profile',form());
    expect(employeePortalApi.profile).toHaveBeenCalledWith({employeeId:'synthetic'},expect.objectContaining({expectedRevision:'7',expectedProfileRevision:original,name:'Draft'}));
  });
  it('rejects an old form without an employee source version before writing',async()=>{
    const f=form();f.delete('expectedProfileRevision');
    const r=await savePortal({employeeId:'synthetic'},'synthetic-scope','profile',f);
    expect(r.error).toBeTruthy();expect(employeePortalApi.profile).not.toHaveBeenCalled();
  });
  it('returns conflict without a replacement DTO or modifying the submitted draft',async()=>{
    const f=form();vi.mocked(employeePortalApi.profile).mockRejectedValue(new ApiError(409,'Conflict'));
    const r=await savePortal({employeeId:'synthetic'},'synthetic-scope','profile',f);
    expect(r.error).toBe('Conflict');expect(r.data).toBeUndefined();expect(f.get('name')).toBe('Draft');expect(f.get('expectedProfileRevision')).toBe(original);
  });
});
