import { BadRequestException, Body, Controller, Get, Inject, Injectable, Put, ServiceUnavailableException } from '@nestjs/common';
import { foodId, foodInt, foodObject } from '@pms/domain';
import { Access } from '../auth/access.decorator';
import { RequiresBusinessCapability } from '../auth/capability.decorator';
import { currentUserId } from '../auth/request-context';
import { PrismaService } from '../database/prisma.provider';
import { foodMay, foodScope, foodTransaction } from './scope';
export interface OpeningInput {
 areaId?:string; effectiveFrom:string;effectiveTo:string;
 intervals:{weekday:number;localStart:string;localEnd:string;endsNextDay:boolean}[];
 closures:{day:string;reason:string}[];
}
export function parseOpening(raw:unknown):OpeningInput {
 const b=foodObject(raw,['areaId','effectiveFrom','effectiveTo','intervals','closures']);
 const day=(x:unknown)=>{if(typeof x!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(x)||!Number.isFinite(+new Date(x))||new Date(x).toISOString().slice(0,10)!==x)throw new Error('INVALID_DATE');return x;};
 const clock=(x:unknown)=>{if(typeof x!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(x))throw new Error('INVALID_LOCAL_TIME');return x;};
 if(!Array.isArray(b.intervals)||b.intervals.length>100||!Array.isArray(b.closures)||b.closures.length>367)throw new Error('INVALID_OPENING_PAYLOAD');
 const effectiveFrom=day(b.effectiveFrom),effectiveTo=day(b.effectiveTo);
 if(effectiveTo<effectiveFrom||+new Date(effectiveTo)-+new Date(effectiveFrom)>366*86400000)throw new Error('INVALID_EFFECTIVE_DATES');
 return {...(b.areaId===undefined?{}:{areaId:foodId(b.areaId)}),effectiveFrom,effectiveTo,
 intervals:b.intervals.map(raw=>{const i=foodObject(raw,['weekday','localStart','localEnd','endsNextDay']);const localStart=clock(i.localStart),localEnd=clock(i.localEnd);if(typeof i.endsNextDay!=='boolean'||(i.endsNextDay?localEnd>localStart:localEnd<=localStart))throw new Error('EXPLICIT_ROLLOVER_REQUIRED');return {weekday:foodInt(i.weekday,0,6),localStart,localEnd,endsNextDay:i.endsNextDay};}),
 closures:b.closures.map(raw=>{const c=foodObject(raw,['day','reason']);if(typeof c.reason!=='string'||!c.reason.trim()||c.reason.length>500)throw new Error('CLOSURE_REASON_REQUIRED');return {day:day(c.day),reason:c.reason.trim()};})};
}
@Injectable()
export class RestaurantOpeningService {
 constructor(@Inject(PrismaService) private readonly prisma:PrismaService){}
 async read(){
  foodMay('reports');const s=await foodScope(this.prisma.db);
  return this.prisma.db.$queryRaw`SELECT s.*,coalesce((SELECT jsonb_agg(i) FROM restaurant_opening_intervals i WHERE i.schedule_id=s.id),'[]'::jsonb) AS intervals,coalesce((SELECT jsonb_agg(c) FROM restaurant_opening_closures c WHERE c.schedule_id=s.id),'[]'::jsonb) AS closures FROM restaurant_opening_schedules s WHERE s.location_id=${s.locationId}::uuid AND s.valid_to IS NULL`;
 }
 async confirm(raw:unknown){
  foodMay('property');
  if(process.env.RESTAURANT_CAPACITY_CAPTURE!=='true'||process.env.RESTAURANT_OCCUPANCY_CAPTURE!=='true')throw new ServiceUnavailableException('CAPTURE_DISABLED');
  let input:OpeningInput;try{input=parseOpening(raw);}catch(e){throw new BadRequestException(e instanceof Error?e.message:'INVALID_OPENING_PAYLOAD');}
  const s=await foodScope(this.prisma.db);
  return foodTransaction(this.prisma,s,async(tx,scope)=>{
   try{
    const rows=await tx.$queryRaw<{id:string}[]>`SELECT confirm_restaurant_opening(${scope.locationId}::uuid,${JSON.stringify(input)}::jsonb,${currentUserId()}::uuid) AS id`;
    return {id:rows[0]!.id};
   }catch(e){if(String(e).includes('LOCAL_TIME_NONEXISTENT_OR_AMBIGUOUS'))throw new BadRequestException('LOCAL_TIME_NONEXISTENT_OR_AMBIGUOUS');throw e;}
  });
 }
}
@Controller('food-service/opening-schedule')
@RequiresBusinessCapability('food.tables')
export class RestaurantOpeningController {
 constructor(@Inject(RestaurantOpeningService) private readonly service:RestaurantOpeningService){}
 @Get() @Access('reports') read(){return this.service.read();}
 /** Complete replacement; each confirmation creates a new observed immutable source version. Not retry-idempotent. */
 @Put() @Access('property') confirm(@Body() body:unknown){return this.service.confirm(body);}
}
