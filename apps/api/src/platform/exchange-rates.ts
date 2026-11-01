import 'reflect-metadata';
import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { parseNbkRates, type DailyRates } from '@pms/domain';
import { withServiceDatabase } from '../auth/request-context';
import { PrismaService } from '../database/prisma.provider';

/**
 * Курсы Нацбанка РК по дням (владелец 01.11.2026: «курс Нацбанка РК на каждый день, сам подтягивается, каждая сумма
 * по курсу своего дня»; миграция 180, ADR-OWNER-FX-20261101). Официальный источник
 * `https://nationalbank.kz/rss/get_rates.cfm?fdate=ДД.ММ.ГГГГ` (XML, тенге за `quant` единиц).
 *
 * Раз в час проверяет, есть ли курсы за сегодня и за последние `BACKFILL_DAYS` дней, и догружает недостающие дни по
 * одному запросу (не больше `PER_RUN` за проход, чтобы не нагружать источник). Строка дня пишется один раз. Сбой сети:
 * день остаётся пустым и догрузится в следующий проход; экран тогда берёт последний известный курс до дня.
 */
export const NBK_URL = 'https://nationalbank.kz/rss/get_rates.cfm';
const BACKFILL_DAYS = 200;
const PER_RUN = 40;
const CHECK_MS = 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 15_000;

export type NbkFetch = (date: string) => Promise<string>;

const nbkDate = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
const isoDay = (at: Date) => at.toISOString().slice(0, 10);
const almatyDay = (at: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty', year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);

export const fetchNbk: NbkFetch = async (date) => {
  const res = await fetch(`${NBK_URL}?fdate=${nbkDate(date)}`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Нацбанк ответил ${res.status}`);
  return res.text();
};

export const EXCHANGE_FETCH = Symbol('EXCHANGE_FETCH');

@Injectable()
export class ExchangeRatesService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(ExchangeRatesService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EXCHANGE_FETCH) private readonly fetchDay: NbkFetch,
  ) {}

  /** В тестах и при EXCHANGE_RATES=off таймера нет; первый проход через минуту после запуска */
  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test' || process.env.EXCHANGE_RATES?.trim() === 'off') return;
    const run = () => void this.sync().catch((e: unknown) => this.log.warn(`курсы Нацбанка не загружены: ${(e as Error).message}`));
    const first = setTimeout(run, 60_000);
    first.unref();
    this.timer = setInterval(run, CHECK_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Догрузить недостающие дни: сначала сегодня, потом назад. Возвращает, сколько дней записано */
  async sync(now: Date = new Date()): Promise<{ days: number; failed: number }> {
    if (this.running) return { days: 0, failed: 0 };
    this.running = true;
    try {
      return await withServiceDatabase(async () => {
        const db = this.prisma.db;
        const today = almatyDay(now);
        const from = new Date(Date.parse(`${today}T00:00:00Z`) - BACKFILL_DAYS * 86_400_000);
        const have = new Set(
          (
            await db.$queryRaw<Array<{ d: Date }>>`
              SELECT DISTINCT rate_date AS d FROM exchange_rates WHERE rate_date >= ${from}::date`
          ).map((r) => isoDay(r.d)),
        );
        const want: string[] = [];
        for (let i = 0; i <= BACKFILL_DAYS && want.length < PER_RUN; i++) {
          const day = isoDay(new Date(Date.parse(`${today}T00:00:00Z`) - i * 86_400_000));
          if (!have.has(day)) want.push(day);
        }
        let days = 0;
        let failed = 0;
        for (const day of want) {
          try {
            const parsed = parseNbkRates(await this.fetchDay(day));
            // Нацбанк отдаёт тот же день, что спросили; чужой день или пустой ответ не пишем
            if (parsed.date !== day || parsed.rates.length === 0) {
              failed += 1;
              continue;
            }
            await db.exchangeRate.createMany({
              data: parsed.rates
                .filter((r) => r.currency !== 'KZT')
                .map((r) => ({ rateDate: new Date(`${day}T00:00:00Z`), currency: r.currency, kztPerUnitMicro: r.kztPerUnitMicro })),
              skipDuplicates: true,
            });
            days += 1;
          } catch (e) {
            failed += 1;
            this.log.warn(`курс Нацбанка за ${day} не получен: ${(e as Error).message}`);
          }
        }
        if (days || failed) this.log.log(`курсы Нацбанка: дней записано ${days}, не получено ${failed}`);
        return { days, failed };
      });
    } finally {
      this.running = false;
    }
  }
}

/**
 * Курсы валют за период с запасом назад (последний известный курс до первого дня). Таблицы ещё нет (код выложен
 * раньше миграции 180) или чтение не удалось: null, экран показывает итог по валютам.
 */
export async function readDailyRates(
  db: PrismaService['db'],
  currencies: string[],
  from: string,
  to: string,
): Promise<DailyRates | null> {
  const list = [...new Set(currencies.filter((c) => c !== 'KZT'))];
  const rates: DailyRates = new Map();
  if (list.length === 0) return rates;
  try {
    // таблицы нет (код раньше миграции 180): проверка без ошибки, иначе сбой запроса испортил бы транзакцию запроса
    const [exists] = await db.$queryRaw<Array<{ ok: boolean }>>`SELECT to_regclass('exchange_rates') IS NOT NULL AS ok`;
    if (!exists?.ok) return null;
    const start = new Date(Date.parse(`${from}T00:00:00Z`) - 31 * 86_400_000);
    const rows = await db.exchangeRate.findMany({
      where: { currency: { in: list }, rateDate: { gte: start, lte: new Date(`${to}T00:00:00Z`) } },
      orderBy: [{ currency: 'asc' }, { rateDate: 'asc' }],
      select: { currency: true, rateDate: true, kztPerUnitMicro: true },
    });
    for (const r of rows) {
      const arr = rates.get(r.currency) ?? [];
      arr.push({ date: isoDay(r.rateDate), micro: r.kztPerUnitMicro });
      rates.set(r.currency, arr);
    }
    return rates;
  } catch {
    return null;
  }
}
