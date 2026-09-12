/**
 * Разрезать список на пачки. Массовые правки идут пачками, а не одним запросом: интерактивная
 * транзакция Prisma по умолчанию живёт 5 секунд, и через пулер в другом регионе (dev-БД в Сингапуре)
 * одна большая транзакция в него не укладывается — клиент бросает P2028 уже на коммите.
 */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1) throw new Error('размер пачки — целое число ≥ 1');
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
