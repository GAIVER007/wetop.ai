import 'reflect-metadata';
import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';
import { accessDeniedMessage, type MembershipRole } from '@pms/domain';
import { withSignedInUser } from '../auth/request-context';
import type { PrismaService } from '../database/prisma.provider';
import type { SiteAssetStorage } from '../marketing-site/asset-storage';
import type { HotelService } from './hotel.module';
import { PHOTOS_MAX, PropertyMediaService, safeFileName } from './property-media';

/** Фото и договор объекта (ADR-157, §32.3): права, хранилище, формат файла, замена договора */
const png = () =>
  sharp({ create: { width: 40, height: 30, channels: 3, background: '#336699' } }).png().toBuffer();
const pdf = Buffer.from('%PDF-1.4\n%вымышленный договор\n');

function setup(opts: { storage?: boolean; photos?: number; contract?: boolean } = {}) {
  const rows = {
    contract: opts.contract
      ? {
          id: '00000000-0000-4000-8000-000000000001',
          kind: 'CONTRACT',
          position: 0,
          fileName: 'Договор.pdf',
          mimeType: 'application/pdf',
          storageRef: 'property-media/p/1/x.pdf',
          byteSize: 10,
          width: null,
          height: null,
          alt: null,
          createdAt: new Date(),
        }
      : null,
  };
  const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
    ...data,
    alt: null,
    fileName: data['fileName'] ?? null,
    width: data['width'] ?? null,
    height: data['height'] ?? null,
    createdAt: new Date(),
  }));
  const updateMany = vi.fn().mockResolvedValue({ count: 1 });
  const audit = vi.fn().mockResolvedValue({});
  const db = {
    propertyMedia: {
      count: vi.fn().mockResolvedValue(opts.photos ?? 0),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue(rows.contract ? [rows.contract] : []),
      aggregate: vi.fn().mockResolvedValue({ _max: { position: null } }),
      create,
      updateMany,
      update: vi.fn().mockResolvedValue({}),
    },
    auditLog: { create: audit },
  };
  const prisma = {
    db: { ...db, $transaction: async (fn: (t: typeof db) => Promise<unknown>) => fn(db) },
  } as unknown as PrismaService;
  const hotel = { currentPropertyId: async () => 'prop-a' } as unknown as HotelService;
  const put = vi.fn().mockResolvedValue(undefined);
  const storage: SiteAssetStorage | null =
    opts.storage === false
      ? null
      : { put, delete: vi.fn(), signedGet: async (k) => `https://signed.example/${k}`, exists: vi.fn() };
  return { service: new PropertyMediaService(prisma, hotel, storage), create, updateMany, put, audit };
}
const as = <T>(role: MembershipRole, fn: () => Promise<T>) =>
  withSignedInUser({ userId: 'u1', organizationId: 'org-a', role }, fn);

describe('фото объекта', () => {
  it('владелец загружает фото: обработанная копия в хранилище, строка и журнал', async () => {
    const { service, create, put, audit } = setup();
    const r = await as('OWNER', async () => service.uploadPhoto({ buffer: await png() }));
    expect(r.created).toBe(true);
    expect(put).toHaveBeenCalledWith(
      expect.objectContaining({
        key: expect.stringMatching(/^property-media\/prop-a\/[0-9a-f-]{36}\/[0-9a-f]{64}\.webp$/),
        contentType: 'image/webp',
      }),
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kind: 'PHOTO', position: 0, mimeType: 'image/webp' }),
      }),
    );
    expect(audit).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'hotel.media.photo.added' }),
    });
  });
  it('администратор получает отказ словами, в хранилище ничего не ушло', async () => {
    const { service, put } = setup();
    await expect(
      as('STAFF', async () => service.uploadPhoto({ buffer: await png() })),
    ).rejects.toThrow(accessDeniedMessage('settings'));
    expect(put).not.toHaveBeenCalled();
  });
  it('без хранилища: 503 словами, а не молчаливое сохранение в никуда', async () => {
    const { service } = setup({ storage: false });
    await expect(
      as('OWNER', async () => service.uploadPhoto({ buffer: await png() })),
    ).rejects.toThrow(/Хранилище файлов не включено/);
  });
  it('не картинка и 21-е фото отклоняются', async () => {
    const { service, put } = setup();
    await expect(
      as('OWNER', async () => service.uploadPhoto({ buffer: Buffer.from('просто текст') })),
    ).rejects.toThrow(/JPEG, PNG и WebP/);
    expect(put).not.toHaveBeenCalled();
    const full = setup({ photos: PHOTOS_MAX });
    await expect(
      as('OWNER', async () => full.service.uploadPhoto({ buffer: await png() })),
    ).rejects.toThrow(/Не больше 20 фото/);
  });
});

describe('договор объекта', () => {
  it('PDF заменяет прежний договор: прежний получает deleted_at, имя файла очищено от пути', async () => {
    const { service, create, updateMany, put } = setup({ contract: true });
    const r = await as('MANAGER', () =>
      service.uploadContract({ buffer: pdf, originalname: 'C:\\папка\\Договор\u0007 Luxx.pdf' }),
    );
    expect(updateMany).toHaveBeenCalledWith({
      where: { propertyId: 'prop-a', kind: 'CONTRACT', deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kind: 'CONTRACT', fileName: 'Договор Luxx.pdf' }),
      }),
    );
    expect(put).toHaveBeenCalledWith(expect.objectContaining({ contentType: 'application/pdf' }));
    expect(r.contract.fileName).toBe('Договор Luxx.pdf');
  });
  it('не PDF по содержимому отклоняется, как бы файл ни назывался', async () => {
    const { service, put } = setup();
    await expect(
      as('OWNER', () =>
        service.uploadContract({ buffer: Buffer.from('MZ исполняемый'), originalname: 'договор.pdf' }),
      ),
    ).rejects.toThrow(/только в формате PDF/);
    expect(put).not.toHaveBeenCalled();
  });
  it('договор в списке видит только право settings', async () => {
    const { service } = setup({ contract: true });
    const owner = await as('OWNER', () => service.list());
    expect(owner.contract?.fileName).toBe('Договор.pdf');
    expect(owner.contract?.url).toMatch(/^https:\/\/signed\.example\//);
    const staff = await as('STAFF', () => service.list());
    expect(staff.contract).toBeNull();
  });
});

describe('имя файла', () => {
  it('без пути, управляющих знаков и длиннее 200', () => {
    expect(safeFileName('/etc/passwd')).toBe('passwd');
    expect(safeFileName('')).toBe('Договор.pdf');
    expect(safeFileName('я'.repeat(300))).toHaveLength(200);
  });
});
