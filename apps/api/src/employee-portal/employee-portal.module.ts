import 'reflect-metadata';
import type { Response } from 'express';
import { Body, Controller, Delete, Get, Inject, Module, Param, Patch, Post, Put, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SITE_ASSET_LIMITS } from '@pms/domain';
import { Access } from '../auth/access.decorator';
import { Public } from '../auth/public.decorator';
import { PrismaService } from '../database/prisma.provider';
import { SITE_ASSET_STORAGE, siteAssetStorageFromEnv } from '../marketing-site/asset-storage';
import { EmployeePortalService } from './employee-portal.service';

@Controller('employee-portal/employees/:id')
@Access('staff')
export class EmployeePortalManagerController {
  constructor(@Inject(EmployeePortalService) private readonly service:EmployeePortalService) {}
  @Get() get(@Param('id') employeeId:string, @Query() q:Record<string,unknown>) { return this.service.get(employeeId,q); }
  @Patch('profile') profile(@Param('id') employeeId:string, @Body() b:unknown) { return this.service.mutate(employeeId,'profile',b); }
  @Delete('avatar') deleteAvatar(@Param('id') employeeId:string) { return this.service.mutate(employeeId,'delete-avatar',{}); }
  @Patch('portfolio/:workId') work(@Param('id') employeeId:string, @Param('workId') itemId:string, @Body() b:unknown) { return this.service.mutate(employeeId,'work',b,itemId); }
  @Delete('portfolio/:workId') deleteWork(@Param('id') employeeId:string, @Param('workId') itemId:string) { return this.service.mutate(employeeId,'delete-work',{},itemId); }
  @Put('publication') publication(@Param('id') employeeId:string, @Body() b:unknown) { return this.service.mutate(employeeId,'publication',b); }
  @Put('services') services(@Param('id') employeeId:string, @Body() b:unknown) { return this.service.mutate(employeeId,'services',b); }
  @Put('week') week(@Param('id') employeeId:string, @Body() b:unknown) { return this.service.mutate(employeeId,'week',b); }
  @Post('time-offs') timeOff(@Param('id') employeeId:string, @Body() b:unknown) { return this.service.mutate(employeeId,'time-off',b); }
  @Delete('time-offs/:timeOffId') deleteTimeOff(@Param('id') employeeId:string, @Param('timeOffId') itemId:string) { return this.service.mutate(employeeId,'delete-time-off',{},itemId); }
  @Put('account') account(@Param('id') employeeId:string, @Body() b:unknown) { return this.service.mutate(employeeId,'account',b); }
  @Delete('account') unlinkAccount(@Param('id') employeeId:string) { return this.service.mutate(employeeId,'unlink-account',{}); }
  @Put('pay-settings') paySettings(@Param('id') employeeId:string, @Body() b:unknown) { return this.service.mutate(employeeId,'pay-settings',b); }
  @Put('avatar')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize:SITE_ASSET_LIMITS.maxUploadBytes, files:1, fields:6 } }))
  avatar(@Param('id') employeeId:string, @UploadedFile() file:{buffer:Buffer}|undefined, @Body() raw:Record<string,unknown>) {
    const b={...raw}; for(const key of ['published','publicationConsent']) if(typeof b[key]==='string') { if(b[key]==='true')b[key]=true; else if(b[key]==='false')b[key]=false; }
    return this.service.upload(employeeId,'AVATAR',file,b);
  }
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
  @Get() get(@Query() q:Record<string,unknown>) { return this.service.get(null,q); }
  @Patch('profile') profile(@Body() b:unknown) { return this.service.mutate(null,'profile',b); }
  @Delete('avatar') deleteAvatar() { return this.service.mutate(null,'delete-avatar',{}); }
  @Patch('portfolio/:workId') work(@Param('workId') itemId:string, @Body() b:unknown) { return this.service.mutate(null,'work',b,itemId); }
  @Delete('portfolio/:workId') deleteWork(@Param('workId') itemId:string) { return this.service.mutate(null,'delete-work',{},itemId); }
  @Put('services') services(@Body() b:unknown) { return this.service.mutate(null,'services',b); }
  @Put('week') week(@Body() b:unknown) { return this.service.mutate(null,'week',b); }
  @Post('time-offs') timeOff(@Body() b:unknown) { return this.service.mutate(null,'time-off',b); }
  @Delete('time-offs/:timeOffId') deleteTimeOff(@Param('timeOffId') itemId:string) { return this.service.mutate(null,'delete-time-off',{},itemId); }
  @Put('avatar')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize:SITE_ASSET_LIMITS.maxUploadBytes, files:1, fields:6 } }))
  avatar(@UploadedFile() file:{buffer:Buffer}|undefined, @Body() raw:Record<string,unknown>) {
    const b={...raw}; for(const key of ['published','publicationConsent']) if(typeof b[key]==='string') { if(b[key]==='true')b[key]=true; else if(b[key]==='false')b[key]=false; }
    return this.service.upload(null,'AVATAR',file,b);
  }
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
  @Put('pay-policy') @Access('staff') policy(@Body() b:unknown) {return this.service.setPolicy(b);}
  @Get('public/:slug') @Public() publicProfile(@Res({passthrough:true}) response:Response,@Param('slug') slug:string,@Query('locationId') locationId?:string) {
    // Set before resolution so validation failures and unpublished 404 responses also cannot be cached.
    response.setHeader('Cache-Control','no-store');
    return this.service.publicProfile(slug,locationId);
  }
}
@Module({controllers:[EmployeePortalManagerController,EmployeePortalSelfController,EmployeePortalController],providers:[PrismaService,EmployeePortalService,{provide:SITE_ASSET_STORAGE,useFactory:()=>siteAssetStorageFromEnv()}],exports:[EmployeePortalService]})
export class EmployeePortalModule {}
