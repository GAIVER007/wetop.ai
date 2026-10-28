import 'reflect-metadata';
import type { Response } from 'express';
import { Body, Controller, Delete, Get, Inject, Module, Param, Patch, Post, Put, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SITE_ASSET_LIMITS } from '@pms/domain';
import { Access } from '../auth/access.decorator';
import { BeautyAccess } from '../beauty/access.decorator';
import { Public } from '../auth/public.decorator';
import { PrismaService } from '../database/prisma.provider';
import { SITE_ASSET_STORAGE, siteAssetStorageFromEnv } from '../marketing-site/asset-storage';
import { EmployeePortalService } from './employee-portal.service';

@Controller('employee-portal/employees/:id')
@Access('staff')
export class EmployeePortalManagerController {
  constructor(@Inject(EmployeePortalService) private readonly service:EmployeePortalService) {}
  @BeautyAccess('employees','view') @Get() get(@Param('id') employeeId:string, @Query() q:Record<string,unknown>) { return this.service.get(employeeId,q); }
  @BeautyAccess('employees','update') @Get('account-options') accountOptions(@Param('id') employeeId:string) { return this.service.accountOptions(employeeId); }
  @BeautyAccess('employees','update') @Patch('profile') profile(@Param('id') employeeId:string, @Body() b:unknown) { return this.service.mutate(employeeId,'profile',b); }
  @BeautyAccess('employees','update') @Delete('avatar') deleteAvatar(@Param('id') employeeId:string) { return this.service.mutate(employeeId,'delete-avatar',{}); }
  @BeautyAccess('employees','update') @Patch('portfolio/:workId') work(@Param('id') employeeId:string, @Param('workId') itemId:string, @Body() b:unknown) { return this.service.mutate(employeeId,'work',b,itemId); }
  @BeautyAccess('employees','update') @Delete('portfolio/:workId') deleteWork(@Param('id') employeeId:string, @Param('workId') itemId:string) { return this.service.mutate(employeeId,'delete-work',{},itemId); }
  @BeautyAccess('employees','update') @Put('publication') publication(@Param('id') employeeId:string, @Body() b:unknown) { return this.service.mutate(employeeId,'publication',b); }
  @BeautyAccess('employees','update') @Put('services') services(@Param('id') employeeId:string, @Body() b:unknown) { return this.service.mutate(employeeId,'services',b); }
  @BeautyAccess('employees','update') @Put('week') week(@Param('id') employeeId:string, @Body() b:unknown) { return this.service.mutate(employeeId,'week',b); }
  @BeautyAccess('employees','update') @Post('time-offs') timeOff(@Param('id') employeeId:string, @Body() b:unknown) { return this.service.mutate(employeeId,'time-off',b); }
  @BeautyAccess('employees','update') @Delete('time-offs/:timeOffId') deleteTimeOff(@Param('id') employeeId:string, @Param('timeOffId') itemId:string) { return this.service.mutate(employeeId,'delete-time-off',{},itemId); }
  @BeautyAccess('employees','update') @Post('schedule-requests/:requestId/approve') approveRequest(@Param('id') employeeId:string, @Param('requestId') itemId:string) { return this.service.mutate(employeeId,'approve-schedule-request',{},itemId); }
  @BeautyAccess('employees','update') @Post('schedule-requests/:requestId/reject') rejectRequest(@Param('id') employeeId:string, @Param('requestId') itemId:string, @Body() b:unknown) { return this.service.mutate(employeeId,'reject-schedule-request',b,itemId); }
  @BeautyAccess('employees','update') @Put('account') account(@Param('id') employeeId:string, @Body() b:unknown) { return this.service.mutate(employeeId,'account',b); }
  @BeautyAccess('employees','update') @Delete('account') unlinkAccount(@Param('id') employeeId:string) { return this.service.mutate(employeeId,'unlink-account',{}); }
  @BeautyAccess('payroll','update') @Put('pay-settings') paySettings(@Param('id') employeeId:string, @Body() b:unknown) { return this.service.mutate(employeeId,'pay-settings',b); }
  @BeautyAccess('employees','update')
  @Put('avatar')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize:SITE_ASSET_LIMITS.maxUploadBytes, files:1, fields:6 } }))
  avatar(@Param('id') employeeId:string, @UploadedFile() file:{buffer:Buffer}|undefined, @Body() raw:Record<string,unknown>) {
    const b={...raw}; for(const key of ['published','publicationConsent']) if(typeof b[key]==='string') { if(b[key]==='true')b[key]=true; else if(b[key]==='false')b[key]=false; }
    return this.service.upload(employeeId,'AVATAR',file,b);
  }
  @BeautyAccess('employees','update')
  @Post('portfolio')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize:SITE_ASSET_LIMITS.maxUploadBytes, files:1, fields:6 } }))
  portfolio(@Param('id') employeeId:string, @UploadedFile() file:{buffer:Buffer}|undefined, @Body() raw:Record<string,unknown>) {
    const b={...raw}; for(const key of ['published','publicationConsent']) if(typeof b[key]==='string') { if(b[key]==='true')b[key]=true; else if(b[key]==='false')b[key]=false; }
    return this.service.upload(employeeId,'PORTFOLIO',file,b);
  }
}

@Controller('employee-portal/me')
@Access('self')
export class EmployeePortalSelfController {
  constructor(@Inject(EmployeePortalService) private readonly service:EmployeePortalService) {}
  @BeautyAccess('journal','view',{own:true,anyOf:['appointments','payroll','reviews']}) @Get() get(@Query() q:Record<string,unknown>) { return this.service.get(null,q); }
  @BeautyAccess('journal','update',{own:false}) @Patch('profile') profile(@Body() b:unknown) { return this.service.mutate(null,'profile',b); }
  @BeautyAccess('journal','update',{own:false}) @Delete('avatar') deleteAvatar() { return this.service.mutate(null,'delete-avatar',{}); }
  @BeautyAccess('journal','update',{own:false}) @Patch('portfolio/:workId') work(@Param('workId') itemId:string, @Body() b:unknown) { return this.service.mutate(null,'work',b,itemId); }
  @BeautyAccess('journal','update',{own:false}) @Delete('portfolio/:workId') deleteWork(@Param('workId') itemId:string) { return this.service.mutate(null,'delete-work',{},itemId); }
  @BeautyAccess('journal','update',{own:false}) @Put('services') services(@Body() b:unknown) { return this.service.mutate(null,'services',b); }
  @BeautyAccess('journal','update',{own:false}) @Put('week') week(@Body() b:unknown) { return this.service.mutate(null,'week',b); }
  @BeautyAccess('journal','update',{own:false}) @Post('time-offs') timeOff(@Body() b:unknown) { return this.service.mutate(null,'time-off',b); }
  @BeautyAccess('journal','update',{own:false}) @Delete('time-offs/:timeOffId') deleteTimeOff(@Param('timeOffId') itemId:string) { return this.service.mutate(null,'delete-time-off',{},itemId); }
  // запрос графика (SCHEDULE-REQUESTS-20261028): мастер видит свой кабинет, поэтому то же право, что и чтение
  @BeautyAccess('journal','view',{own:true,anyOf:['appointments','payroll','reviews']}) @Post('schedule-requests') scheduleRequest(@Body() b:unknown) { return this.service.mutate(null,'schedule-request',b); }
  @BeautyAccess('journal','view',{own:true,anyOf:['appointments','payroll','reviews']}) @Post('schedule-requests/:requestId/cancel') cancelRequest(@Param('requestId') itemId:string) { return this.service.mutate(null,'cancel-schedule-request',{},itemId); }
  @BeautyAccess('journal','update',{own:false})
  @Put('avatar')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize:SITE_ASSET_LIMITS.maxUploadBytes, files:1, fields:6 } }))
  avatar(@UploadedFile() file:{buffer:Buffer}|undefined, @Body() raw:Record<string,unknown>) {
    const b={...raw}; for(const key of ['published','publicationConsent']) if(typeof b[key]==='string') { if(b[key]==='true')b[key]=true; else if(b[key]==='false')b[key]=false; }
    return this.service.upload(null,'AVATAR',file,b);
  }
  @BeautyAccess('journal','update',{own:false})
  @Post('portfolio')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize:SITE_ASSET_LIMITS.maxUploadBytes, files:1, fields:6 } }))
  portfolio(@UploadedFile() file:{buffer:Buffer}|undefined, @Body() raw:Record<string,unknown>) {
    const b={...raw}; for(const key of ['published','publicationConsent']) if(typeof b[key]==='string') { if(b[key]==='true')b[key]=true; else if(b[key]==='false')b[key]=false; }
    return this.service.upload(null,'PORTFOLIO',file,b);
  }
}

@Controller('employee-portal')
export class EmployeePortalController {
  constructor(@Inject(EmployeePortalService) private readonly service:EmployeePortalService) {}
  @BeautyAccess('payroll','update') @Put('pay-policy') @Access('staff') policy(@Body() b:unknown) {return this.service.setPolicy(b);}
  @Get('public/:slug') @Public() publicProfile(@Res({passthrough:true}) response:Response,@Param('slug') slug:string,@Query('locationId') locationId?:string) {
    // Set before resolution so validation failures and unpublished 404 responses also cannot be cached.
    response.setHeader('Cache-Control','no-store');
    return this.service.publicProfile(slug,locationId);
  }
}
@Module({controllers:[EmployeePortalManagerController,EmployeePortalSelfController,EmployeePortalController],providers:[PrismaService,EmployeePortalService,{provide:SITE_ASSET_STORAGE,useFactory:()=>siteAssetStorageFromEnv()}],exports:[EmployeePortalService]})
export class EmployeePortalModule {}
