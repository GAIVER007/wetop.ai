import { randomUUID } from 'node:crypto';
import { createPrismaClient, type Db } from '@pms/database';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isLocalDatabase } from '../tools/seed-local';

const url=process.env.DATABASE_URL;
const schema=process.env.DATABASE_SCHEMA||'public';

describe.skipIf(!url)('employee account link lock-order diagnostic',()=>{
  let db:Db;
  let probe:pg.Client;

  beforeAll(async()=>{
    if(!isLocalDatabase(url!))throw new Error('Employee account lock diagnostic requires an isolated localhost PostgreSQL');
    db=createPrismaClient(url!,schema);
    probe=new pg.Client({connectionString:url,options:`-c search_path=${schema},public`});
    await probe.connect();
  });

  afterAll(async()=>{
    await probe?.end();
    await db?.$disconnect();
  });

  it('does not retain a user row lock after Prisma upsert with an empty update',async()=>{
    const userId=randomUUID();
    const email=`employee-lock-${userId}@example.test`;
    await db.user.create({data:{id:userId,email,status:'ACTIVE'}});

    let ready!:()=>void;
    let release!:()=>void;
    const reached=new Promise<void>(resolve=>{ready=resolve;});
    const continueTx=new Promise<void>(resolve=>{release=resolve;});
    const rollback=new Error('ROLLBACK_EMPLOYEE_ACCOUNT_LOCK_DIAGNOSTIC');
    const held=db.$transaction(async tx=>{
      await tx.user.upsert({
        where:{email},
        create:{email,status:'ACTIVE'},
        update:{},
        select:{id:true},
      });
      ready();
      await continueTx;
      throw rollback;
    });

    try {
      await Promise.race([
        reached,
        held.then(()=>{throw new Error('Diagnostic transaction ended before the lock probe');}),
      ]);
      await expect(probe.query('SELECT id FROM users WHERE id=$1 FOR UPDATE NOWAIT',[userId]))
        .resolves.toMatchObject({rowCount:1});
    } finally {
      release();
      await expect(held).rejects.toBe(rollback);
      await db.user.delete({where:{id:userId}});
    }
  });
});
