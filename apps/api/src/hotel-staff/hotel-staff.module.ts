import 'reflect-metadata';
import { Body, Controller, Get, HttpCode, Inject, Module, Param, Post, Put, Query } from '@nestjs/common';
import { Access } from '../auth/access.decorator';
import { RequiresBusinessCapability } from '../auth/capability.decorator';
import { PrismaService } from '../database/prisma.provider';
import { FoodModule } from '../food-service/food.module';
import { RestaurantService } from '../food-service/restaurant.service';
import { HotelStaffService } from './hotel-staff.service';

const HOTEL = ['HOSPITALITY'] as const;

/** Кабинет горничной и ресепшена (решение 22.10.2026): только своё, право `self` с принудительной привязкой к себе */
@Controller('hotel-staff/me')
@Access('self')
@RequiresBusinessCapability('hospitality.inventory')
export class HotelStaffSelfController {
  constructor(@Inject(HotelStaffService) private readonly service: HotelStaffService) {}
  @Get() cabinet(@Query() q: Record<string, unknown>) {
    return this.service.cabinet(q);
  }
  @Post('units/:code/clean') @HttpCode(200) clean(@Param('code') code: string) {
    return this.service.clean(code);
  }
  @Post('tasks/:id/done') @HttpCode(200) taskDone(@Param('id') id: string) {
    return this.service.taskDone(id);
  }
}

/** Сотрудники и график гостиницы: тот же код, что у ресторана, со своим направлением */
@Controller('hotel-staff')
@Access('desk')
@RequiresBusinessCapability('hospitality.inventory')
export class HotelStaffController {
  constructor(
    @Inject(HotelStaffService) private readonly service: HotelStaffService,
    @Inject(RestaurantService) private readonly restaurant: RestaurantService,
  ) {}
  @Get('employees') employees() {
    return this.service.employees();
  }
  @Post('employees') @Access('staff') createEmployee(@Body() b: unknown) {
    return this.restaurant.createEmployee(b, HOTEL);
  }
  @Get('shifts') shifts() {
    return this.restaurant.shifts(HOTEL);
  }
  @Put('employees/:id/working-hours') @Access('staff') setShifts(@Param('id') id: string, @Body() b: unknown) {
    return this.restaurant.setShifts(id, b, HOTEL);
  }
}

@Module({
  imports: [FoodModule],
  controllers: [HotelStaffSelfController, HotelStaffController],
  providers: [PrismaService, HotelStaffService],
})
export class HotelStaffModule {}
