import 'reflect-metadata';
import { readEmployeeCommon, writeEmployeeCommon } from './employee-common';
import { createHash, randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import type { Db, DbTx, EmployeeMedia } from '@pms/database';
import { can, canWrite, roleAt, parsePaySettings, payrollTotals, parseWorkingHoursWeek, fitsSchedule, parseTimeOffInput, timeOffWindow, weekTemplate, localDate, type EmployeePortalDto, type PublicEmployeeDto, type PortalPay, type PortalPercentBasis } from '@pms/domain';
import { currentBusinessId, currentLocationId, currentOrganizationId, currentUserId, currentRole, currentAssignments, withOrganizationScope, withServiceDatabase } from '../auth/request-context';
import { PrismaService } from '../database/prisma.provider';
import { SITE_ASSET_STORAGE, type SiteAssetStorage } from '../marketing-site/asset-storage';
import { processSiteImage, AssetImageError } from '../marketing-site/asset-image';
import { objectInput, revision, profileInput, publicationInput, portfolioInput, policyInput, UUID } from './boundary';
import { employeeBookingTarget } from './booking-target';

const fingerprint = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const clock = (d: Date) => d.toISOString().slice(11,16);
const dateOnly = (d: Date) => d.toISOString().slice(0,10);
const id = (v: unknown): string => { if (typeof v !== 'string' || !UUID.test(v)) throw new BadRequestException('Invalid ID'); return v; };
const parsed = <T>(fn:()=>T):T => { try { return fn(); } catch(e) { throw new BadRequestException(e instanceof Error ? e.message : 'Invalid input'); } };

@Injectable()
export class EmployeePortalService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(SITE_ASSET_STORAGE) private readonly storage: SiteAssetStorage | null) {}

  private async business(db: Db | DbTx) {
    const organizationId=currentOrganizationId(), businessId=currentBusinessId(), userId=currentUserId();
    if (!organizationId || !businessId || !userId) throw new ForbiddenException('Choose an authorized business and sign in');
    const b=await db.business.findFirst({where:{id:businessId,organizationId,status:'ACTIVE',vertical:{in:['BEAUTY','FOOD_SERVICE']}}});
    if (!b) throw new ForbiddenException('Business unavailable');
    const membership=await db.membership.findFirst({where:{organizationId,userId,status:'ACTIVE',user:{status:'ACTIVE',emailVerifiedAt:{not:null}}}});
    if (!membership || !roleAt(currentRole()!,currentAssignments(),{businessId, ...(currentLocationId()?{locationId:currentLocationId()!}:{})})) throw new ForbiddenException('Business access denied');
    return b;
  }
  private manager() { if (!can(currentRole(),'staff')) throw new ForbiddenException('Manager only'); }
  private async writable(db:Db|DbTx,lock=false) {
    const organizationId=currentOrganizationId(),businessId=currentBusinessId(),locationId=currentLocationId();
    if(!organizationId||!currentUserId())throw new ForbiddenException('Войдите в организацию');
    if(lock) {
      // Same lock order as beautyTransaction, before the employee lock or any write.
      await db.$queryRaw`SELECT id FROM organizations WHERE id=${organizationId}::uuid FOR SHARE`;
      if(businessId)await db.$queryRaw`SELECT id FROM businesses WHERE id=${businessId}::uuid FOR UPDATE`;
      if(locationId)await db.$queryRaw`SELECT id FROM locations WHERE id=${locationId}::uuid FOR UPDATE`;
    }
    const org=await db.organization.findUnique({where:{id:organizationId},select:{status:true,trialEndsAt:true}});
    if(!org||!canWrite(org.status,org.trialEndsAt,new Date()))throw new ForbiddenException('Организация доступна только для чтения');
  }
  private async resolve(db: Db | DbTx, employeeId: string | null) {
    const business=await this.business(db);
    if (employeeId !== null) this.manager();
    const rows=await db.employee.findMany({where:{businessId:business.id,...(employeeId===null?{userId:currentUserId(),status:'ACTIVE'}:{id:id(employeeId)})},include:{locations:{include:{location:true}}}});
    if (rows.length!==1) throw new NotFoundException('Employee not found or account mapping ambiguous');
    const employee=rows[0]!;
    const selected=currentLocationId();
    const locations=employee.locations.map(x=>x.location).filter(l=>l.status==='ACTIVE');
    if (selected && !locations.some(l=>l.id===selected)) throw new ForbiddenException('Employee not assigned to selected branch');
    const location=selected?locations.find(l=>l.id===selected)!:locations.length===1?locations[0]!:null;
    return {business,employee,location,access:employeeId===null?'SELF' as const:'MANAGER' as const};
  }
  private async profile(db:Db | DbTx,employeeId:string) {
    const existing=await db.employeePublicProfile.findUnique({where:{employeeId}});
    if(existing)return existing;
    await this.writable(db);
    return db.employeePublicProfile.upsert({where:{employeeId},create:{employeeId,slug:randomUUID()},update:{}});
  }
  private async image(media: EmployeeMedia) {
    if (!this.storage) throw new ServiceUnavailableException('Image storage is not configured');
    return {id:media.id,url:await this.storage.signedGet(media.storageRef,60),width:media.width,height:media.height};
  }
  private async pay(db:Db|DbTx, employeeId:string, businessId:string, vertical:string, viewingLocation:{currency:string;timezone:string}|null, month:string):Promise<PortalPay> {
    if(vertical==='FOOD_SERVICE'&&!viewingLocation) {
      const setting=await db.employeePaySetting.findUnique({where:{employeeId}});
      return {status:'SELECT_LOCATION',month,currency:setting?.currency??'',model:setting?.model??null,fixedMinor:setting?.fixedMinor.toString()??null,percent:setting?.percent??null,percentBasis:null,policyRevision:null,earnedMinor:null,bonusMinor:null,penaltyMinor:null,paidMinor:null,remainingMinor:null,adjustments:[],explanation:'Выберите филиал в общем переключателе филиалов, чтобы увидеть расчёт за месяц в его часовом поясе и валюте. Сохранённые условия оплаты доступны без выбора филиала.'};
    }
    const currency=viewingLocation?.currency??'KZT', timezone=viewingLocation?.timezone??'UTC';
    const period=new Date(`${month}-01T00:00:00Z`);
    const [setting,policy,adjustments,payout]=await Promise.all([
      db.employeePaySetting.findUnique({where:{employeeId}}),db.beautyPayrollPolicy.findUnique({where:{businessId}}),
      db.employeePayAdjustment.findMany({where:{employeeId,period},orderBy:{createdAt:'asc'}}),
      db.restaurantCashOperation.aggregate({where:{employeeId,period,status:'COMPLETED',location:{businessId}},_sum:{amount:true}}),
    ]);
    const adj=adjustments.map(a=>a.amountMinor),bonus=adj.filter(v=>v>0n).reduce((a,b)=>a+b,0n),penalty=adj.filter(v=>v<0n).reduce((a,b)=>a+b,0n), paid=payout._sum.amount??0n;
    const out:PortalPay={status:!setting||!policy?'NOT_CONFIGURED':'UNSUPPORTED_POLICY',month,currency:setting?.currency??currency,model:setting?.model??null,fixedMinor:setting?.fixedMinor.toString()??null,percent:setting?.percent??null,percentBasis:(policy?.percentBasis as PortalPercentBasis)??null,policyRevision:policy?String(policy.revision):null,earnedMinor:null,bonusMinor:bonus.toString(),penaltyMinor:penalty.toString(),paidMinor:paid.toString(),remainingMinor:null,explanation:'Расчёт зарплаты салона пока недоступен. Показаны реальные условия, корректировки и выплаты. Автоначисления включаются только после поддержки выбранной политики, истории ставок и возвратов за закрытые периоды.',adjustments:adjustments.map(a=>({id:a.id,amountMinor:a.amountMinor.toString(),reason:a.reason}))};
    if(vertical==='FOOD_SERVICE') {
      const next=new Date(period);next.setUTCMonth(next.getUTCMonth()+1); next.setUTCDate(0);
      const w=timeOffWindow({dateFrom:`${month}-01`,dateTo:dateOnly(next),timezone});
      const orders=await db.restaurantOrder.aggregate({where:{waiterId:employeeId,location:{businessId},status:'CLOSED',closedAt:{gte:w.fromUtc,lt:w.toUtcExclusive}},_sum:{total:true}});
      const s=setting??{model:'FIXED' as const,fixedMinor:0n,percent:0};
      const t=payrollTotals(s,orders._sum.total??0n,adj);
      Object.assign(out,{status:'AVAILABLE',currency,percentBasis:null,policyRevision:null,earnedMinor:t.total.toString(),remainingMinor:(t.total-paid).toString(),explanation:'Расчёт ресторана: действующие условия оплаты, закрытые заказы во всех филиалах бизнеса, корректировки и проведённые выплаты.'});
    }
    return out;
  }
  async get(employeeId:string|null, query:Record<string,unknown>):Promise<EmployeePortalDto> {
    objectInput(query,['date','month']);
    const db=this.prisma.db, s=await this.resolve(db,employeeId), {employee:e,business:b,location:l}=s;
    const timezone=l?.timezone??'UTC';
    const date=query.date??localDate(new Date(),timezone), month=query.month??String(date).slice(0,7);
    if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(`${date}T00:00:00Z`))||dateOnly(new Date(`${date}T00:00:00Z`))!==date) throw new BadRequestException('Invalid date');
    if(typeof month!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new BadRequestException('Invalid month');
    const [p,media,works,services,skills,hours,timeOffs]=await Promise.all([
      this.profile(db,e.id),db.employeeMedia.findMany({where:{employeeId:e.id},orderBy:{createdAt:'desc'}}),
      db.employeePortfolioItem.findMany({where:{employeeId:e.id},include:{media:true},orderBy:{createdAt:'desc'}}),
      db.beautyService.findMany({where:{businessId:b.id},include:{locations:l?{where:{locationId:l.id}}:true},orderBy:{id:'asc'}}),
      db.employeeService.findMany({where:{employeeId:e.id},orderBy:{serviceId:'asc'}}),
      db.workingHours.findMany({where:{employeeId:e.id,...(l?{locationId:l.id}:{locationId:{in:[]}})},orderBy:[{weekday:'asc'},{timeFrom:'asc'}]}),
      db.timeOff.findMany({where:{employeeId:e.id},orderBy:{dateFrom:'asc'}}),
    ]);
    const w=timeOffWindow({dateFrom:date,dateTo:date,timezone});
    const [appointments,orders]=await Promise.all([
      l?db.appointment.findMany({where:{employeeId:e.id,locationId:l.id,startsAt:{gte:w.fromUtc,lt:w.toUtcExclusive}},include:{customer:{select:{firstName:true,lastName:true}},service:{select:{name:true}}},orderBy:{startsAt:'asc'}}):[],
      b.vertical==='FOOD_SERVICE'?db.restaurantOrder.findMany({where:{waiterId:e.id,location:{businessId:b.id},...(l?{locationId:l.id}:{}),openedAt:{gte:w.fromUtc,lt:w.toUtcExclusive}},include:{table:{select:{name:true}}},orderBy:{openedAt:'desc'}}):[],
    ]);
    const checkedFrom=new Date();
    const assignedLocations=e.locations.map(x=>x.location).filter(x=>x.status==='ACTIVE'&&x.businessId===b.id);
    const assignedIds=assignedLocations.map(x=>x.id);
    // Read only this employee's upcoming busy appointments, never branch-wide customer data.
    // The extra row makes an incomplete bounded check explicit rather than a false all-clear.
    const [upcoming,allHours]=b.vertical==='BEAUTY'?await Promise.all([
      db.appointment.findMany({where:{employeeId:e.id,locationId:{in:assignedIds},location:{businessId:b.id},status:{in:['BOOKED','CONFIRMED','IN_PROGRESS','DONE']},endsAt:{gt:checkedFrom}},select:{id:true,locationId:true,startsAt:true,endsAt:true,service:{select:{name:true}}},orderBy:[{startsAt:'asc'},{id:'asc'}],take:501}),
      db.workingHours.findMany({where:{employeeId:e.id,locationId:{in:assignedIds}}}),
    ]):[[],[]];
    const conflicts:EmployeePortalDto['scheduleConflicts']['items']=[];
    for(const a of upcoming.slice(0,500)) {
      const branch=assignedLocations.find(x=>x.id===a.locationId)!;
      const fit=fitsSchedule({startsAt:a.startsAt,endsAt:a.endsAt,timezone:branch.timezone,workingHours:allHours.filter(h=>h.locationId===a.locationId).map(h=>({weekday:h.weekday,timeFrom:clock(h.timeFrom),timeTo:clock(h.timeTo)})),timeOffs:timeOffs.map(t=>({dateFrom:dateOnly(t.dateFrom),dateTo:dateOnly(t.dateTo)}))});
      if(!fit.ok)conflicts.push({id:a.id,date:localDate(a.startsAt,branch.timezone),startsAt:a.startsAt.toISOString(),endsAt:a.endsAt.toISOString(),locationId:branch.id,locationName:branch.name,timezone:branch.timezone,serviceName:a.service.name,reason:fit.reason});
    }
    const avatar=media.find(m=>m.kind==='AVATAR');
    const intervals=hours.map(h=>({weekday:h.weekday,timeFrom:clock(h.timeFrom),timeTo:clock(h.timeTo)}));
    const common=(await readEmployeeCommon(db,b.id)).find(row=>row.id===e.id);
    if(!common)throw new NotFoundException('Employee not found');
    return {access:s.access,employee:{id:e.id,name:common.name,phone:common.phone,email:common.email,profileRevision:common.profileRevision,active:common.status==='ACTIVE',accountLinked:!!e.userId},business:{id:b.id,name:b.name,vertical:b.vertical as 'BEAUTY'|'FOOD_SERVICE'},location:l?{id:l.id,name:l.name,timezone:l.timezone,currency:l.currency}:null,
      profile:{headline:p.headline,biography:p.biography,practiceSinceYear:p.practiceSinceYear,slug:p.slug,published:p.published,publicationConsent:p.publicationConsent,revision:String(p.revision)},avatar:avatar?await this.image(avatar):null,
      portfolio:await Promise.all(works.map(async x=>({id:x.id,title:x.title,description:x.description,serviceId:x.serviceId,published:x.published,publicationConsent:x.publicationConsent,image:await this.image(x.media)}))),
      services:services.map(x=>{const ls=l?x.locations[0]:undefined;return {id:x.id,name:x.name,durationMinutes:ls?.durationOverride??x.durationMinutes,priceMinor:(ls?.priceOverride??x.price).toString(),currency:l?.currency??x.currency,assigned:skills.some(k=>k.serviceId===x.id),available:!!l&&x.active&&!!ls?.enabled&&(ls.priceOverride!==null||x.currency===l.currency)};}),servicesRevision:fingerprint(skills.map(x=>x.serviceId)),week:weekTemplate(intervals),weekRevision:l?fingerprint(intervals):null,
      timeOffs:timeOffs.map(t=>({id:t.id,dateFrom:dateOnly(t.dateFrom),dateTo:dateOnly(t.dateTo),reason:t.reason})),appointments:appointments.map(a=>({id:a.id,date,startsAt:a.startsAt.toISOString(),endsAt:a.endsAt.toISOString(),customerName:[a.customer.firstName,a.customer.lastName].filter(Boolean).join(' '),serviceName:a.service.name,status:a.status,priceMinor:a.price.toString(),currency:a.currency})),orders:orders.map(o=>({id:o.id,number:String(o.number),status:o.status,totalMinor:o.total.toString(),currency:o.currency,tableName:o.table?.name??null})),
      scheduleConflicts:{items:conflicts,checkedFrom:checkedFrom.toISOString(),checkedCount:Math.min(upcoming.length,500),truncated:upcoming.length>500},
      pay:await this.pay(db,e.id,b.id,b.vertical,l,month)};
  }
  async mutate(employeeId:string|null, action:string, raw:unknown, itemId?:string):Promise<EmployeePortalDto> {
    await this.prisma.db.$transaction(async tx=>{
      await this.writable(tx,true);
      const s=await this.resolve(tx,employeeId),e=s.employee;
      // All portal writes serialize on the same identity, including revision checks and account links.
      await tx.$queryRaw`SELECT id FROM employees WHERE id=${e.id}::uuid FOR UPDATE`;
      const p=await this.profile(tx,e.id);
      if(['publication','account','unlink-account','pay-settings'].includes(action)) {if(employeeId===null) throw new ForbiddenException('Manager endpoint required');this.manager();}
      if(action==='profile') {
        const input=profileInput(raw);
        const {expectedRevision,expectedProfileRevision,name,phone,email,...profile}=input;
        revision(expectedRevision,String(p.revision));
        await writeEmployeeCommon(tx,s.business.id,e.id,expectedProfileRevision,{...(name!==undefined?{name}:{}),...(phone!==undefined?{phone}:{}),...(email!==undefined?{email}:{})});
        await tx.employeePublicProfile.update({where:{employeeId:e.id},data:{...profile,...(s.access==='SELF'?{published:false}:{}),revision:{increment:1}}});
      } else if(action==='publication') {
        const input=publicationInput(raw);revision(input.expectedRevision,String(p.revision));
        await tx.employeePublicProfile.update({where:{employeeId:e.id},data:{published:input.published,publicationConsent:input.publicationConsent,revision:{increment:1}}});
      } else if(action==='services') {
        const input=objectInput(raw,['serviceIds','expectedRevision']);
        if(!Array.isArray(input.serviceIds)||input.serviceIds.length>500) throw new BadRequestException('Invalid services');
        const ids=[...new Set(input.serviceIds.map(id))];
        const old=await tx.employeeService.findMany({where:{employeeId:e.id},orderBy:{serviceId:'asc'}});revision(input.expectedRevision,fingerprint(old.map(x=>x.serviceId)));
        if(await tx.beautyService.count({where:{id:{in:ids},businessId:s.business.id,active:true}})!==ids.length) throw new BadRequestException('Service outside business catalog');
        await tx.employeeService.deleteMany({where:{employeeId:e.id}});await tx.employeeService.createMany({data:ids.map(serviceId=>({employeeId:e.id,serviceId}))});
      } else if(action==='week') {
        const input=objectInput(raw,['intervals','expectedRevision']); if(!s.location) throw new BadRequestException('Select assigned branch');
        const result=parseWorkingHoursWeek(input);if(!result.ok) throw new BadRequestException(result.reason);
        const old=await tx.workingHours.findMany({where:{employeeId:e.id,locationId:s.location.id},orderBy:[{weekday:'asc'},{timeFrom:'asc'}]});
        revision(input.expectedRevision,fingerprint(old.map(h=>({weekday:h.weekday,timeFrom:clock(h.timeFrom),timeTo:clock(h.timeTo)}))));
        await tx.workingHours.deleteMany({where:{employeeId:e.id,locationId:s.location.id}});
        await tx.workingHours.createMany({data:result.value.map(h=>({employeeId:e.id,locationId:s.location!.id,weekday:h.weekday,timeFrom:new Date(`1970-01-01T${h.timeFrom}:00Z`),timeTo:new Date(`1970-01-01T${h.timeTo}:00Z`)}))});
      } else if(action==='time-off') {
        const input=objectInput(raw,['dateFrom','dateTo','reason']);const result=parseTimeOffInput(input);if(!result.ok)throw new BadRequestException(result.reason);
        await tx.timeOff.create({data:{employeeId:e.id,dateFrom:new Date(`${result.value.dateFrom}T00:00:00Z`),dateTo:new Date(`${result.value.dateTo}T00:00:00Z`),reason:result.value.reason}});
      } else if(action==='delete-time-off') {
        if(!(await tx.timeOff.deleteMany({where:{id:id(itemId),employeeId:e.id}})).count) throw new NotFoundException('Time off not found');
      } else if(action==='account') {
        const input=objectInput(raw,['userId']),userId=id(input.userId);
        // Lock the target user too, preventing two concurrent employee bindings in this business.
        await tx.$queryRaw`SELECT id FROM users WHERE id=${userId}::uuid FOR UPDATE`;
        const existing=await tx.employee.findUnique({where:{id:e.id},select:{userId:true}});
        if(existing?.userId && existing.userId!==userId)throw new ConflictException('Unlink existing account first');
        const member=await tx.membership.findFirst({where:{userId,organizationId:s.business.organizationId,status:'ACTIVE',user:{status:'ACTIVE',emailVerifiedAt:{not:null}}}});
        const scopes=await tx.membershipScope.findMany({where:{userId,organizationId:s.business.organizationId}});
        const assignments=scopes.filter(r=>r.role!=='OWNER').map(r=>({role:r.role as 'MANAGER'|'STAFF',businessId:r.businessId,locationId:r.locationId}));
        if(!member || !roleAt(member.role,assignments,{businessId:s.business.id,...(s.location?{locationId:s.location.id}:{})}))throw new ForbiddenException('Account must be a verified authorized member');
        if(await tx.employee.count({where:{businessId:s.business.id,userId,id:{not:e.id}}}))throw new ConflictException('Account already bound');
        await tx.employee.update({where:{id:e.id},data:{userId}});
      } else if(action==='unlink-account') {
        objectInput(raw,[]); await tx.employee.update({where:{id:e.id},data:{userId:null}});
      } else if(action==='pay-settings') {
        const input=objectInput(raw,['model','fixedMinor','percent','currency']);
        const currency=s.location?.currency; if(!currency)throw new BadRequestException('Select assigned branch currency');
        if(input.currency!==undefined&&input.currency!==currency)throw new BadRequestException('Currency mismatch');
        const fixed=input.fixedMinor; if(typeof fixed!=='string'||!/^\d{1,16}$/.test(fixed)||BigInt(fixed)>BigInt(Number.MAX_SAFE_INTEGER))throw new BadRequestException('Invalid fixed minor units');
        const setting=parsed(()=>parsePaySettings({model:input.model,fixedMinor:Number(fixed),percent:input.percent}));
        await tx.employeePaySetting.upsert({where:{employeeId:e.id},create:{employeeId:e.id,...setting,currency,updatedById:currentUserId()},update:{...setting,currency,updatedById:currentUserId()}});
      } else if(action==='work'||action==='delete-work') {
        const work=await tx.employeePortfolioItem.findFirst({where:{id:id(itemId),employeeId:e.id}});if(!work)throw new NotFoundException('Work not found');
        if(action==='delete-work')await tx.employeePortfolioItem.delete({where:{id:work.id}});
        else {const input=portfolioInput(raw);if(input.serviceId && !await tx.beautyService.count({where:{id:input.serviceId,businessId:s.business.id}}))throw new BadRequestException('Service outside business');await tx.employeePortfolioItem.update({where:{id:work.id},data:{...input,...(s.access==='SELF'?{published:false}:{})}});}
        await tx.employeePublicProfile.update({where:{employeeId:e.id},data:{...(s.access==='SELF'?{published:false}:{}),revision:{increment:1}}});
      } else if(action==='delete-avatar') {
        objectInput(raw,[]);await tx.employeeMedia.deleteMany({where:{employeeId:e.id,kind:'AVATAR'}});
        await tx.employeePublicProfile.update({where:{employeeId:e.id},data:{...(s.access==='SELF'?{published:false}:{}),revision:{increment:1}}});
      } else throw new BadRequestException('Unknown portal action');
      await tx.auditLog.create({data:{organizationId:s.business.organizationId,userId:currentUserId(),entityType:'employee',entityId:e.id,action:`employee_portal.${action}`,after:{employeeId:e.id}}});
    });
    return this.get(employeeId,{});
  }
  async setPolicy(raw:unknown) {
    this.manager();const input=policyInput(raw);
    return this.prisma.db.$transaction(async tx=>{
      await this.writable(tx,true);
      const b=await this.business(tx);if(b.vertical!=='BEAUTY')throw new BadRequestException('Beauty policy only');
      await tx.$queryRaw`SELECT id FROM businesses WHERE id=${b.id}::uuid FOR UPDATE`;
      const old=await tx.beautyPayrollPolicy.findUnique({where:{businessId:b.id}});
      if(input.expectedRevision!==undefined)revision(input.expectedRevision,String(old?.revision??0));
      const p=await tx.beautyPayrollPolicy.upsert({where:{businessId:b.id},create:{businessId:b.id,percentBasis:input.percentBasis},update:{percentBasis:input.percentBasis,revision:{increment:1}}});
      await tx.auditLog.create({data:{organizationId:b.organizationId,userId:currentUserId(),entityType:'business',entityId:b.id,action:'employee_portal.pay-policy',after:{percentBasis:p.percentBasis,revision:p.revision}}});
      return {percentBasis:p.percentBasis,revision:String(p.revision)};
    });
  }
  async upload(employeeId:string|null,kind:'AVATAR'|'PORTFOLIO',file:{buffer:Buffer}|undefined,raw:unknown):Promise<EmployeePortalDto> {
    // Resolve before decoding or storing any bytes. Never turn absent storage into successful upload.
    await this.resolve(this.prisma.db,employeeId);
    await this.writable(this.prisma.db);
    if(!this.storage)throw new ServiceUnavailableException('Image storage is not configured');
    if(!file?.buffer)throw new BadRequestException('file required');
    const input=kind==='PORTFOLIO'?portfolioInput(raw):objectInput(raw,[]);
    let image;try{image=await processSiteImage(file.buffer,'IMAGE');}catch(e){if(e instanceof AssetImageError)throw new BadRequestException(e.message);throw e;}
    const key=`employee-portal/${randomUUID()}.webp`;
    await this.storage.put({key,body:image.bytes,contentType:image.mimeType});
    let duplicate=false;
    try {
      await this.prisma.db.$transaction(async tx=>{
        await this.writable(tx,true);
        const s=await this.resolve(tx,employeeId);await tx.$queryRaw`SELECT id FROM employees WHERE id=${s.employee.id}::uuid FOR UPDATE`;
        if(kind==='PORTFOLIO'&&input.serviceId&&!await tx.beautyService.count({where:{id:id(input.serviceId),businessId:s.business.id}}))throw new BadRequestException('Service outside business');
        // Processed content and work metadata define a retry within this employee only.
        // Approval/consent are current state: a lost-response retry must not revoke a later manager decision.
        const existing=kind==='AVATAR'
          ?await tx.employeeMedia.findFirst({where:{employeeId:s.employee.id,kind,sha256:image.sha256},select:{id:true}})
          :await tx.employeePortfolioItem.findFirst({where:{employeeId:s.employee.id,title:String(input.title),description:String(input.description??''),serviceId:typeof input.serviceId==='string'?input.serviceId:null,media:{employeeId:s.employee.id,kind:'PORTFOLIO',sha256:image.sha256}},select:{id:true}});
        if(existing){duplicate=true;return;}
        if(kind==='AVATAR')await tx.employeeMedia.deleteMany({where:{employeeId:s.employee.id,kind}});
        const media=await tx.employeeMedia.create({data:{employeeId:s.employee.id,kind,storageRef:key,mimeType:image.mimeType,width:image.width,height:image.height,byteSize:image.byteSize,sha256:image.sha256}});
        if(kind==='PORTFOLIO')await tx.employeePortfolioItem.create({data:{employeeId:s.employee.id,mediaId:media.id,title:String(input.title),description:String(input.description??''),serviceId:typeof input.serviceId==='string'?input.serviceId:null,publicationConsent:input.publicationConsent===true,published:s.access==='MANAGER'&&input.published===true&&input.publicationConsent===true}});
        await this.profile(tx,s.employee.id);await tx.employeePublicProfile.update({where:{employeeId:s.employee.id},data:{...(s.access==='SELF'?{published:false}:{}),revision:{increment:1}}});
        await tx.auditLog.create({data:{organizationId:s.business.organizationId,userId:currentUserId(),entityType:'employee',entityId:s.employee.id,action:'employee_portal.media',after:{kind,mediaId:media.id}}});
      });
    }catch(e){await this.storage.delete(key);throw e;}
    // Only this request's unused object is removed; the original persisted image remains intact.
    if(duplicate)await this.storage.delete(key);
    return this.get(employeeId,{});
  }
  async publicProfile(slug:string,locationId?:string):Promise<PublicEmployeeDto> {
    if(typeof slug!=='string'||slug.length>200||!/^[a-zA-Z0-9-]+$/.test(slug))throw new NotFoundException('Profile not found');
    if(locationId!==undefined)id(locationId);
    // Narrow SECURITY DEFINER resolver returns only published identity and tenant, not a private Employee scan.
    const rows=await withServiceDatabase(()=>this.prisma.db.$queryRaw<Array<{employee_id:string;organization_id:string}>>`SELECT * FROM resolve_public_employee(${slug})`);
    if(rows.length!==1)throw new NotFoundException('Profile not found');
    const resolved=rows[0]!;
    return withOrganizationScope(resolved.organization_id,async()=>{
      const db=this.prisma.db;
      const p=await db.employeePublicProfile.findFirst({where:{employeeId:resolved.employee_id,published:true,publicationConsent:true,employee:{status:'ACTIVE',business:{status:'ACTIVE',organization:{status:{in:['ACTIVE','TRIAL']}}}}},select:{slug:true,headline:true,biography:true,practiceSinceYear:true,employee:{select:{id:true,name:true,business:{select:{name:true,vertical:true,organization:{select:{status:true,trialEndsAt:true}}}},locations:{where:{location:{status:'ACTIVE'}},select:{location:{select:{id:true,name:true,currency:true}}}},portalMedia:{where:{kind:'AVATAR'},orderBy:{createdAt:'desc'},take:1},portfolio:{where:{published:true,publicationConsent:true},select:{id:true,title:true,description:true,media:true}},services:{where:{service:{active:true}},select:{service:{select:{id:true,name:true,price:true,currency:true,durationMinutes:true,locations:{where:{enabled:true},select:{locationId:true,priceOverride:true,durationOverride:true}}}}}}}}}});
      if(!p)throw new NotFoundException('Profile not found');const e=p.employee,locations=e.locations.map(x=>x.location);
      const selected=locationId?locations.find(l=>l.id===locationId):locations.length===1?locations[0]:undefined;
      if(locationId&&!selected)throw new NotFoundException('Profile not found');
      const services=selected?e.services.flatMap(({service:s})=>{const l=s.locations.find(l=>l.locationId===selected.id);return l&&(l.priceOverride!==null||s.currency===selected.currency)?[{id:s.id,name:s.name,durationMinutes:l.durationOverride??s.durationMinutes,priceMinor:(l.priceOverride??s.price).toString(),currency:selected.currency}]:[];}):[];
      const bookingSite=selected&&services.length>0&&e.business.vertical==='BEAUTY'&&canWrite(e.business.organization.status,e.business.organization.trialEndsAt,new Date())
        ?await db.marketingSite.findUnique({where:{locationId:selected.id},select:{id:true,locationId:true,state:true,publishedVersion:{select:{siteId:true,spec:true,specHash:true}},trackedSite:{select:{locationId:true,status:true,publicKey:true,hosts:true}},domains:{where:{status:'ACTIVE',isPrimary:true},take:2,select:{host:true}}}}):null;
      const bookingUrl=selected?employeeBookingTarget(bookingSite,selected.id,e.id):null;
      return {name:e.name,headline:p.headline,biography:p.biography,practiceSinceYear:p.practiceSinceYear,slug:p.slug,businessName:e.business.name,avatar:e.portalMedia[0]?await this.image(e.portalMedia[0]):null,portfolio:await Promise.all(e.portfolio.map(async w=>({id:w.id,title:w.title,description:w.description,image:await this.image(w.media)}))),locations,locationId:selected?.id??null,services,bookingUrl};
    });
  }
}
