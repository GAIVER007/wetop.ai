import 'reflect-metadata';
import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, Headers, Inject, Param, Post, Query, ServiceUnavailableException } from '@nestjs/common';
import { canAt, canWrite } from '@pms/domain';
import { PrismaService } from '../database/prisma.provider';
import { Access } from '../auth/access.decorator';
import { ScopeAware } from '../auth/scope-aware.decorator';
import { currentAssignments, currentLocationId, currentOrganizationId, currentRole, currentUserId, hasSignedInActor } from '../auth/request-context';
import { ExpenseIntentConflict, ExpenseStore, type ExpenseInput } from './expense-store';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function id(value: unknown): asserts value is string { if(typeof value!=='string'||!uuid.test(value)) throw new BadRequestException('Invalid identifier'); }
function body(value: unknown): Record<string,unknown> { if(!value||typeof value!=='object'||Array.isArray(value)) throw new BadRequestException('Invalid body'); return value as Record<string,unknown>; }
@Controller('expenses')
@ScopeAware()
@Access('reports')
export class ExpenseDocumentsController {
 constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
 private async store(write=false) {
  if(process.env.EXPENSE_LINKS_ENABLED!=='1') throw new ServiceUnavailableException('Expense linking is not enabled');
  const locationId=currentLocationId(), organizationId=currentOrganizationId();
  if(!hasSignedInActor()||!locationId||!organizationId) throw new ForbiddenException('Select an authorized location');
  const location=await this.prisma.db.location.findFirst({where:{id:locationId,business:{organizationId}},select:{businessId:true}});
  const permission=write?'settings':'reports';
  if(!location||!canAt(currentRole()??'STAFF',currentAssignments(),permission,{locationId,businessId:location.businessId})) throw new ForbiddenException('Expense access denied');
  const prisma=this.prisma;
  return {locationId,store:new ExpenseStore({transaction:fn=>prisma.db.$transaction(async tx=>{
   if(write){
    await tx.$queryRaw`SELECT id FROM organizations WHERE id=${organizationId}::uuid FOR SHARE`;
    const org=await tx.organization.findUnique({where:{id:organizationId},select:{status:true,trialEndsAt:true}});
    if(!org||!canWrite(org.status,org.trialEndsAt,new Date())) throw new ForbiddenException('Organization is read-only');
   }
   return fn((sql,values=[])=>tx.$queryRawUnsafe<unknown[]>(sql,...values));
  })})};
 }
 private async execute<T>(fn:()=>Promise<T>) {
  try { return await fn(); } catch(e) {
   if(e instanceof BadRequestException||e instanceof ForbiddenException||e instanceof ServiceUnavailableException) throw e;
   const error=e as {code?:string;meta?:{code?:string;message?:string}};
   const sqlCode=error?.code==='P2010'?error.meta?.code:error?.code;
   const domainMessages=['marketing source mismatch','marketing FX conflict','expense history immutable','expense has active payments','expense not active in scope','invalid canonical expense source','supplier payment required for this receipt','expense overpayment'];
   const knownDomain=sqlCode==='P0001'&&domainMessages.includes(error.meta?.message??'');
   if(e instanceof ExpenseIntentConflict||['23505','23503','23514'].includes(sqlCode??'')||knownDomain)
    throw new ConflictException('Expense intent or source conflicts with persisted accounting');
   // Never serialize error/message/meta: drivers may embed SQL, DSN or personal data.
   console.error('expense_write_unavailable');
   throw new ServiceUnavailableException('Expense service temporarily unavailable');
  }
 }
 @Get()
 async list(@Query('cursor') cursor?:string,@Query('limit') limit='50') {
  if(cursor) id(cursor); if(!/^(?:[1-9]|[1-9][0-9]|100)$/.test(limit)) throw new BadRequestException('Invalid limit');
  const {store,locationId}=await this.store();
  const data=await store.list(locationId,cursor??null,Number(limit));
  return {data,nextCursor:data.length===Number(limit)?(data.at(-1) as {id:string}).id:null};
 }
 @Post()
 @Access('settings')
 async create(@Body() value:unknown,@Headers('idempotency-key') key:string) {
  if(typeof key!=='string'||key.length>200||! /^[\x21-\x7e]+$/.test(key)) throw new BadRequestException('Invalid idempotency key');
  const p=body(value); id(p.categoryId);
  if(typeof p.title!=='string'||!p.title.trim()||p.title.length>500||typeof p.amountMinor!=='string'||! /^[1-9][0-9]{0,18}$/.test(p.amountMinor)||BigInt(p.amountMinor)>9223372036854775807n||typeof p.currency!=='string'||! /^[A-Z]{3}$/.test(p.currency)||typeof p.documentDate!=='string'||! /^\d{4}-\d{2}-\d{2}$/.test(p.documentDate)) throw new BadRequestException('Invalid expense document');
  if(p.supplierReceiptId!==undefined) id(p.supplierReceiptId);
  if(p.marketingExpenseId!==undefined) id(p.marketingExpenseId);
  if(p.payment!==undefined) throw new BadRequestException('New payments are not enabled');
  return this.execute(async()=>{const {store,locationId}=await this.store(true); return store.create(locationId,currentUserId(),key,p as ExpenseInput);});
 }
 @Post(':id/settlements')
 @Access('settings')
 async link(@Param('id') documentId:string,@Body() value:unknown,@Headers('idempotency-key') key:string) {
  if(typeof key!=='string'||key.length>200||! /^[\x21-\x7e]+$/.test(key)) throw new BadRequestException('Invalid idempotency key');
  id(documentId); const p=body(value); id(p.sourceOperationId);
  if(!['HOTEL_CASH','RESTAURANT_CASH'].includes(p.sourceType as string)||p.payment!==undefined||p.amountMinor!==undefined) throw new BadRequestException('Only existing canonical cash linkage is enabled');
  return this.execute(async()=>{const {store,locationId}=await this.store(true); return store.link(locationId,currentUserId(),key,documentId,p.sourceType as 'HOTEL_CASH'|'RESTAURANT_CASH',p.sourceOperationId as string);});
 }
}
