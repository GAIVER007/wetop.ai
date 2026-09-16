import { SetMetadata } from '@nestjs/common';

/** Метка «этот маршрут доступен без входа»: счётчик сайта, виджет бронирования, webhook Channex. */
export const PUBLIC_ROUTE = 'wetop:public-route';

export const Public = () => SetMetadata(PUBLIC_ROUTE, true);
