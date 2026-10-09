import 'reflect-metadata';
import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  Optional,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { assistant } from '@pms/integrations';
import { BAR_REPOSITORY, type BarRepository } from './bar.repository';
import { BAR_SCAN_BOT, type BarScanBot } from './scan.bot';

/** Что принимает скан: вход моделей через OpenAI-совместимый роутер; PDF придёт отдельным срезом (ADR-156) */
export const SCAN_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
/** 8 МБ файла в base64 (×4/3) с небольшим запасом; транспортный предел: `body-parsers.ts` */
export const SCAN_MAX_BASE64 = 11_200_000;
/** Потолок расхода одного скана; бюджетных таблиц, как у генерации сайта, нет */
const SCAN_BUDGET_TOKENS = 120_000;
const UNAVAILABLE = 'ИИ сейчас недоступен: попробуйте позже или заполните приход руками';
const UNREADABLE = 'Не удалось разобрать документ: попробуйте другое фото, ровнее и при свете, или заполните руками';

export interface BarScanLineOut {
  productId: string | null;
  name: string;
  barcode: string | null;
  quantityUnits: string;
  unitCostMinor: string;
}
export interface BarScanOut {
  supplierId: string | null;
  supplierName: string | null;
  documentNumber: string | null;
  documentDate: string | null;
  lines: BarScanLineOut[];
  warnings: string[];
}

/** Название для сопоставления: без регистра, пунктуации и лишних пробелов */
const normalized = (value: string) =>
  value.toLowerCase().replace(/[^a-zа-яё0-9]+/giu, ' ').replace(/\s+/g, ' ').trim();
const text = (value: unknown, max: number): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim().slice(0, max) : null;
/** Деньги из ответа модели: только строка в тенге, та же грамматика, что у форм стойки; float означает отказ строке */
const tengeToMinor = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  return (BigInt(match[1]!) * 100n + BigInt((match[2] ?? '').padEnd(2, '0') || '0')).toString();
};
const units = (value: unknown): string | null => {
  const raw = typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : typeof value === 'string' ? value.trim() : '';
  if (!/^\d{1,7}$/.test(raw) || BigInt(raw) <= 0n) return null;
  return BigInt(raw).toString();
};
const barcodeOf = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const digits = value.replace(/\s+/g, '');
  return /^\d{6,20}$/.test(digits) ? digits : null;
};
const dateOf = (value: unknown): string | null => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? null : value;
};

interface KnownProduct { id: string; code: string; name: string; barcode: string | null; active: boolean }
interface KnownSupplier { id: string; name: string; active: boolean }

@Injectable()
export class BarScanService {
  constructor(
    @Inject(BAR_REPOSITORY) private readonly repo: BarRepository,
    @Optional() @Inject(BAR_SCAN_BOT) private readonly bot: BarScanBot | null,
  ) {}

  async scanReceipt(raw: unknown): Promise<BarScanOut> {
    const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const mediaType = typeof body.mediaType === 'string' ? body.mediaType : '';
    const dataBase64 = typeof body.dataBase64 === 'string' ? body.dataBase64 : '';
    if (!SCAN_MEDIA_TYPES.includes(mediaType))
      throw new BadRequestException('Нужно фото накладной: JPG, PNG или WebP. PDF пока не принимается');
    if (dataBase64 === '' || dataBase64.length > SCAN_MAX_BASE64 || dataBase64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(dataBase64))
      throw new BadRequestException('Файл не прочитан: пришлите фото до 8 МБ ещё раз');
    if (!this.bot) throw new ServiceUnavailableException(UNAVAILABLE);
    const [productsRaw, suppliersRaw] = await Promise.all([this.repo.products(), this.repo.suppliers()]);
    const products = (productsRaw as KnownProduct[]).filter((product) => product.active);
    const suppliers = (suppliersRaw as KnownSupplier[]).filter((supplier) => supplier.active);
    let reply: unknown;
    try {
      reply = await this.bot.scan({
        schemaVersion: 'bar-receipt-scan/0',
        requestId: randomUUID(),
        document: { mediaType, dataBase64 },
        knownProducts: products.slice(0, 500).map((product) => ({ code: product.code, name: product.name, barcode: product.barcode })),
        knownSuppliers: suppliers.slice(0, 100).map((supplier) => supplier.name),
        budgetRemainingTokens: SCAN_BUDGET_TOKENS,
      });
    } catch (error) {
      if (error instanceof assistant.BotUnavailableError) throw new ServiceUnavailableException(UNAVAILABLE);
      if (error instanceof assistant.BotRejectedError) throw new BadGatewayException(`ИИ отклонил запрос: ${error.detail}`);
      throw error;
    }
    const answer = (reply && typeof reply === 'object' ? reply : {}) as Record<string, unknown>;
    if (answer.status !== 'ok') {
      const code = typeof answer.errorCode === 'string' ? answer.errorCode : '';
      if (code === 'SCHEMA_INVALID' || code === 'REJECTED_CONTENT') throw new UnprocessableEntityException(UNREADABLE);
      throw new ServiceUnavailableException(UNAVAILABLE);
    }
    return this.mapDocument(answer.spec, products, suppliers);
  }

  private mapDocument(spec: unknown, products: KnownProduct[], suppliers: KnownSupplier[]): BarScanOut {
    const doc = (spec && typeof spec === 'object' ? spec : {}) as Record<string, unknown>;
    const warnings: string[] = [];
    for (const warning of Array.isArray(doc.warnings) ? doc.warnings.slice(0, 10) : []) {
      const line = text(warning, 300);
      if (line) warnings.push(line);
    }
    const byBarcode = new Map(products.filter((product) => product.barcode).map((product) => [product.barcode!, product.id]));
    const byName = new Map(products.map((product) => [normalized(product.name), product.id]));
    const lines: BarScanLineOut[] = [];
    const rawLines = Array.isArray(doc.lines) ? doc.lines.slice(0, 100) : [];
    rawLines.forEach((rawLine, index) => {
      const line = (rawLine && typeof rawLine === 'object' ? rawLine : {}) as Record<string, unknown>;
      const name = text(line.name, 200);
      const quantityUnits = units(line.quantityUnits);
      const unitCostMinor = tengeToMinor(line.unitCost);
      if (!name || !quantityUnits || unitCostMinor === null) {
        warnings.push(`Строка ${index + 1} не разобрана и пропущена: проверьте её в документе`);
        return;
      }
      const barcode = barcodeOf(line.barcode);
      const productId = (barcode && byBarcode.get(barcode)) || byName.get(normalized(name)) || null;
      lines.push({ productId, name, barcode, quantityUnits, unitCostMinor });
    });
    const supplierName = text(doc.supplierName, 200);
    const supplierId = supplierName
      ? suppliers.find((supplier) => normalized(supplier.name) === normalized(supplierName))?.id ?? null
      : null;
    return {
      supplierId,
      supplierName,
      documentNumber: text(doc.documentNumber, 100),
      documentDate: dateOf(doc.documentDate),
      lines,
      warnings,
    };
  }
}
