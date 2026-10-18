import 'reflect-metadata';
import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../database/prisma.provider';
import { PrismaAccountsRepository } from './accounts.prisma-repository';

const organizationId='72000000-0000-4000-8000-000000000001';
const userId='72000000-0000-4000-8000-000000000002';
const ownerId='72000000-0000-4000-8000-000000000003';

describe('member removal with retained Beauty position history',()=>{
  it('returns a controlled conflict before deleting a membership referenced by retained assignments',async()=>{
    const remove=vi.fn(async()=>{throw {code:'P2003'};});
    const revokeSessions=vi.fn(async()=>({count:0}));
    const audit=vi.fn(async()=>({}));
    const tx={
      $queryRaw:vi.fn(async()=>[{role:'STAFF'}]),
      beautyPositionAssignment:{count:vi.fn(async()=>1)},
      membership:{delete:remove},
      session:{updateMany:revokeSessions},
      auditLog:{create:audit},
    };
    const db={...tx,$transaction:vi.fn(async(fn:(inner:typeof tx)=>Promise<unknown>)=>fn(tx))};
    const repository=new PrismaAccountsRepository({db} as unknown as PrismaService);

    await expect(repository.removeMember({organizationId,userId,by:ownerId,roles:['MANAGER','STAFF']}))
      .rejects.toBeInstanceOf(ConflictException);

    expect(tx.beautyPositionAssignment.count).toHaveBeenCalledWith({where:{organizationId,userId}});
    expect(remove).not.toHaveBeenCalled();
    expect(revokeSessions).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });
});
