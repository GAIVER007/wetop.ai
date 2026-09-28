import 'reflect-metadata';
import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Injectable,
  Query,
} from '@nestjs/common';
import { MAX_CHESSBOARD_DAYS, daySpan, stayOffer } from '@pms/domain';
import { Access } from '../auth/access.decorator';
import { RESERVATIONS_UOW, type UnitOfWork } from './reservations.repository';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const addDays = (iso: string, n: number) => {
  const x = new Date(`${iso}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

export interface StayOfferDto {
  plans: number;
  totalMinor: string;
  perNightMinor: string;
  ratePlanCode: string;
}

export interface StayOffers {
  arrivalDate: string;
  departureDate: string;
  nights: number;
  guests: number;
  currency: string;
  /** По коду категории; null — ни один тариф не прошёл правило «от» или номер не вмещает всех гостей */
  byCategory: Record<string, StayOfferDto | null>;
}

/**
 * Цены «от» для экрана «Свободные места» (ADR-110, шаг AV2; правило — закрытый Q-204). Только чтение:
 * те же тарифы, цены и ограничения, по которым стойка потом создаст бронь, и тот же расчёт (`stayOffer`
 * поверх `priceStay` и `assertRestrictionsAllow`). Места сюда не входят — их отдаёт `GET /availability`.
 */
@Injectable()
export class StayOffersService {
  constructor(@Inject(RESERVATIONS_UOW) private readonly uow: UnitOfWork) {}

  async offers(arrival?: string, departure?: string, guestsRaw?: string): Promise<StayOffers> {
    if (
      !arrival ||
      !departure ||
      !ISO.test(arrival) ||
      !ISO.test(departure) ||
      Number.isNaN(Date.parse(arrival)) ||
      Number.isNaN(Date.parse(departure)) ||
      departure <= arrival
    )
      throw new BadRequestException(
        'arrival/departure должны быть датами YYYY-MM-DD, departure > arrival',
      );
    const nights = daySpan(arrival, addDays(departure, -1));
    if (nights > MAX_CHESSBOARD_DAYS)
      throw new BadRequestException(`Максимум ${MAX_CHESSBOARD_DAYS} ночей`);
    const guests = Number(guestsRaw ?? '1');
    if (!Number.isInteger(guests) || guests < 1 || guests > 99)
      throw new BadRequestException('guests — целое от 1 до 99');

    return this.uow.read(async (repo) => {
      const [property, plans, categories] = await Promise.all([
        repo.property(),
        repo.activeRatePlans(),
        repo.activeCategories(),
      ]);
      const byCategory: StayOffers['byCategory'] = {};
      for (const cat of categories) {
        const bed = cat.kind === 'DORM_BED';
        if (!bed && guests > cat.capacityAdults) {
          byCategory[cat.code] = null;
          continue;
        }
        const covering = [];
        for (const plan of plans)
          if (await repo.ratePlanCoversType(plan.id, cat.id)) covering.push(plan);
        const forStay = await Promise.all(
          covering.map(async (plan) => ({
            code: plan.code,
            currency: plan.currency,
            rates: await repo.nightRates(cat.id, plan.id, arrival, departure),
            restrictions: await repo.restrictionsFor(cat.id, plan.id, arrival, addDays(departure, 1)),
          })),
        );
        const offer = stayOffer({
          arrivalDate: arrival,
          departureDate: departure,
          categoryName: cat.name,
          occupancy: bed ? 1 : guests,
          units: bed ? guests : 1,
          currency: property.currency,
          plans: forStay,
        });
        byCategory[cat.code] = offer && {
          plans: offer.plans,
          totalMinor: offer.totalMinor.toString(),
          perNightMinor: offer.perNightMinor.toString(),
          ratePlanCode: offer.ratePlanCode,
        };
      }
      return {
        arrivalDate: arrival,
        departureDate: departure,
        nights: nights,
        guests,
        currency: property.currency,
        byCategory,
      };
    });
  }
}

@Access('desk')
@Controller('availability')
export class StayOffersController {
  constructor(@Inject(StayOffersService) private readonly service: StayOffersService) {}

  /** ?arrival=YYYY-MM-DD&departure=YYYY-MM-DD&guests=N — цены «от» по категориям на весь запрос */
  @Get('offers')
  offers(
    @Query('arrival') arrival?: string,
    @Query('departure') departure?: string,
    @Query('guests') guests?: string,
  ) {
    return this.service.offers(arrival, departure, guests);
  }
}
