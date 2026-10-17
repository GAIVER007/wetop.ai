import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../apps/web/src/lib/api-error';
const mocks = vi.hoisted(() => ({ create: vi.fn(), me: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('../../apps/web/src/lib/api', () => ({ ApiError, authApi: { me: mocks.me }, beautyApi: { createAppointment: mocks.create } }));
import { createAppointment } from '../../apps/web/src/app/beauty/journal-actions';
const scope = { organizationId: 'org-A', businessId: 'business-A', locationId: 'location-A' };
function form() { const f = new FormData(); f.set('scopeKey', JSON.stringify(scope)); return f; }
beforeEach(() => { vi.resetAllMocks(); mocks.me.mockResolvedValue({ user: { organizationId: scope.organizationId }, context: scope }); mocks.create.mockResolvedValue({ appointments: [{ id: 'new' }] }); });
describe('F02 appointment command outcomes', () => {
  it('rejects a changed organization before POST', async () => {
    mocks.me.mockResolvedValue({ user: { organizationId: 'other' }, context: scope });
    expect((await createAppointment(null, form())).error).toContain('Контекст изменён'); expect(mocks.create).not.toHaveBeenCalled();
  });
  it('fails closed when initial scope is absent', async () => { expect((await createAppointment(null,new FormData())).error).toBeTruthy(); expect(mocks.create).not.toHaveBeenCalled(); });
  it('fails closed on business or location mismatch and failed scope verification', async () => {
    for (const context of [{...scope,businessId:'other'},{...scope,locationId:'other'}]) {
      mocks.me.mockResolvedValue({user:{organizationId:scope.organizationId},context});
      expect((await createAppointment(null,form())).error).toContain('Контекст изменён');
    }
    mocks.me.mockRejectedValue(new Error('offline')); expect((await createAppointment(null,form())).error).toBeTruthy(); expect(mocks.create).not.toHaveBeenCalled();
  });
  it('distinguishes a definitive conflict from unknown transport outcome', async () => {
    mocks.create.mockRejectedValue(new ApiError(409,'Занято'));
    expect(await createAppointment(null,form())).toMatchObject({error:'Занято', outcome:'rejected'});
    mocks.create.mockRejectedValue(new ApiError(503,'Нет ответа API'));
    expect(await createAppointment(null,form())).toMatchObject({outcome:'unknown'});
  });
  it('does not call an empty successful response confirmed success', async () => {
    mocks.create.mockResolvedValue({}); expect(await createAppointment(null,form())).toMatchObject({outcome:'unknown'});
  });
});
