import { randomUUID } from 'node:crypto';
import type pg from 'pg';

const tables = [
  'bar_categories',
  'bar_products',
  'bar_receipt_lines',
  'bar_receipts',
  'bar_sale_lines',
  'bar_sales',
  'bar_stock_lots',
  'bar_stock_movements',
  'bar_supplier_payments',
  'bar_suppliers',
] as const;
export type BarTable = (typeof tables)[number];
export interface Side {
  org: string;
  property: string;
  secondProperty: string;
  spare: {
    product: string;
    receipt: string;
    line: string;
    sale: string;
    lot: string;
    unlinkedLine: string;
  };
  cash: string;
  unusedCash: string;
  folios: string[];
  charges: string[];
  rows: Record<BarTable, string>;
}

export function barProofFixture(client: pg.Client) {
  async function insert(table: string, data: Record<string, unknown>) {
    const cols = Object.keys(data);
    return client.query(
      `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(',')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(',')})`,
      Object.values(data),
    );
  }
  async function side(label: string): Promise<Side> {
    const org = randomUUID(),
      business = randomUUID(),
      location = randomUUID(),
      property = randomUUID(),
      cash = randomUUID();
    const rows = Object.fromEntries(tables.map((t) => [t, randomUUID()])) as Record<
      BarTable,
      string
    >;
    const now = '2026-10-05T00:00:00Z';
    await insert('organizations', { id: org, name: `BAR synthetic ${label}` });
    await insert('businesses', {
      id: business,
      organization_id: org,
      name: `BAR synthetic ${label}`,
      vertical: 'HOSPITALITY',
      updated_at: now,
    });
    await insert('locations', {
      id: location,
      business_id: business,
      name: `BAR synthetic ${label}`,
      timezone: 'Asia/Almaty',
      currency: 'KZT',
      updated_at: now,
    });
    await insert('properties', {
      id: property,
      organization_id: org,
      location_id: location,
      name: `BAR synthetic ${label}`,
      timezone: 'Asia/Almaty',
      currency: 'KZT',
      check_in_time: '14:00',
      check_out_time: '12:00',
      updated_at: now,
    });
    await insert('bar_categories', {
      id: rows.bar_categories,
      property_id: property,
      name: 'synthetic',
      default_markup_basis: 0,
    });
    await insert('bar_suppliers', {
      id: rows.bar_suppliers,
      property_id: property,
      name: 'synthetic',
      updated_at: now,
    });
    await insert('bar_products', {
      id: rows.bar_products,
      property_id: property,
      category_id: rows.bar_categories,
      code: 'synthetic',
      name: 'synthetic',
      sale_price: '100',
      updated_at: now,
    });
    await insert('bar_receipts', {
      id: rows.bar_receipts,
      property_id: property,
      supplier_id: rows.bar_suppliers,
      document_number: 'synthetic',
      document_date: '2026-10-05',
      received_date: '2026-10-05',
      currency: 'KZT',
      total_amount: '100',
      updated_at: now,
    });
    await insert('bar_receipt_lines', {
      id: rows.bar_receipt_lines,
      receipt_id: rows.bar_receipts,
      product_id: rows.bar_products,
      quantity_units: '1',
      unit_cost: '100',
      amount: '100',
      markup_basis: 0,
      calculated_price: '100',
    });
    await insert('bar_stock_lots', {
      id: rows.bar_stock_lots,
      property_id: property,
      product_id: rows.bar_products,
      receipt_line_id: rows.bar_receipt_lines,
      received_units: '1',
      remaining_units: '1',
      unit_cost: '100',
      received_at: now,
    });
    await insert('bar_stock_movements', {
      id: rows.bar_stock_movements,
      property_id: property,
      product_id: rows.bar_products,
      lot_id: rows.bar_stock_lots,
      kind: 'RECEIPT',
      units: '1',
      unit_cost: '100',
      source_type: 'BAR_SYNTHETIC',
      source_id: rows.bar_receipts,
    });
    await insert('cash_operations', {
      id: cash,
      property_id: property,
      kind: 'EXPENSE',
      method: 'CASH',
      amount: '100',
    });
    await insert('bar_supplier_payments', {
      id: rows.bar_supplier_payments,
      receipt_id: rows.bar_receipts,
      cash_operation_id: cash,
      amount: '100',
      paid_at: now,
    });
    await insert('bar_sales', {
      id: rows.bar_sales,
      property_id: property,
      idempotency_key: 'synthetic',
      currency: 'KZT',
      total_revenue: '100',
      total_cost: '100',
    });
    await insert('bar_sale_lines', {
      id: rows.bar_sale_lines,
      sale_id: rows.bar_sales,
      product_id: rows.bar_products,
      quantity_units: '1',
      sale_price: '100',
      revenue: '100',
      cost: '100',
    });
    const accommodation = randomUUID();
    await insert('accommodation_types', {
      id: accommodation,
      property_id: property,
      code: 'synthetic',
      name: 'synthetic',
      kind: 'PRIVATE_ROOM',
      capacity_adults: 1,
      updated_at: now,
    });
    const folios: string[] = [],
      charges: string[] = [];
    for (let i = 0; i < 2; i++) {
      const reservation = randomUUID(),
        item = randomUUID(),
        folio = randomUUID(),
        charge = randomUUID();
      await insert('reservations', {
        id: reservation,
        property_id: property,
        confirmation_number: reservation,
        status: 'CONFIRMED',
        source: 'DESK',
        arrival_date: '2026-10-05',
        departure_date: '2026-10-06',
        adults: 1,
        currency: 'KZT',
        total_amount: '100',
        updated_at: now,
      });
      await insert('reservation_items', {
        id: item,
        reservation_id: reservation,
        accommodation_type_id: accommodation,
        arrival_date: '2026-10-05',
        departure_date: '2026-10-06',
        price: '100',
        status: 'CONFIRMED',
        updated_at: now,
      });
      await insert('folios', { id: folio, reservation_item_id: item, currency: 'KZT' });
      await insert('charges', {
        id: charge,
        folio_id: folio,
        kind: 'SERVICE',
        description: 'synthetic',
        unit_price: '100',
        amount: '100',
      });
      folios.push(folio);
      charges.push(charge);
    }
    const unusedCash = randomUUID();
    await insert('cash_operations', {
      id: unusedCash,
      property_id: property,
      kind: 'EXPENSE',
      method: 'CASH',
      amount: '100',
    });
    const secondProperty = randomUUID(),
      secondLocation = randomUUID();
    await insert('locations', {
      id: secondLocation,
      business_id: business,
      name: 'synthetic second',
      timezone: 'Asia/Almaty',
      currency: 'KZT',
      updated_at: now,
    });
    await insert('properties', {
      id: secondProperty,
      organization_id: org,
      location_id: secondLocation,
      name: 'synthetic second',
      timezone: 'Asia/Almaty',
      currency: 'KZT',
      check_in_time: '14:00',
      check_out_time: '12:00',
      updated_at: now,
    });
    const spare = {
      product: randomUUID(),
      receipt: randomUUID(),
      line: randomUUID(),
      sale: randomUUID(),
      lot: randomUUID(),
      unlinkedLine: randomUUID(),
    };
    await insert('bar_products', {
      id: spare.product,
      property_id: property,
      code: 'spare',
      name: 'synthetic',
      sale_price: '100',
      updated_at: now,
    });
    await insert('bar_receipts', {
      id: spare.receipt,
      property_id: property,
      supplier_id: rows.bar_suppliers,
      document_number: 'spare',
      document_date: '2026-10-05',
      received_date: '2026-10-05',
      currency: 'KZT',
      total_amount: '100',
      updated_at: now,
    });
    await insert('bar_receipt_lines', {
      id: spare.line,
      receipt_id: spare.receipt,
      product_id: spare.product,
      quantity_units: '1',
      unit_cost: '100',
      amount: '100',
      markup_basis: 0,
      calculated_price: '100',
    });
    await insert('bar_receipt_lines', {
      id: spare.unlinkedLine,
      receipt_id: spare.receipt,
      product_id: rows.bar_products,
      quantity_units: '1',
      unit_cost: '100',
      amount: '100',
      markup_basis: 0,
      calculated_price: '100',
    });
    await insert('bar_stock_lots', {
      id: spare.lot,
      property_id: property,
      product_id: spare.product,
      receipt_line_id: spare.line,
      received_units: '1',
      remaining_units: '1',
      unit_cost: '100',
      received_at: now,
    });
    await insert('bar_sales', {
      id: spare.sale,
      property_id: property,
      idempotency_key: 'spare',
      currency: 'KZT',
      total_revenue: '100',
      total_cost: '100',
    });
    return { org, property, secondProperty, spare, cash, unusedCash, folios, charges, rows };
  }
  async function fixture(run: (a: Side, b: Side) => Promise<void>) {
    await client.query('BEGIN');
    try {
      await run(await side('A'), await side('B'));
    } finally {
      await client.query('ROLLBACK');
    }
  }
  async function asRole<T>(
    role: 'wetop_app' | 'wetop_service',
    org: string | null,
    run: () => Promise<T>,
  ): Promise<T> {
    await client.query('SAVEPOINT role_probe');
    try {
      await client.query(`SET LOCAL ROLE ${role}`);
      if (org !== null) await client.query(`SELECT set_config('app.org_id',$1,true)`, [org]);
      return await run();
    } finally {
      await client.query('ROLLBACK TO SAVEPOINT role_probe');
    }
  }

  return { insert, side, fixture, asRole };
}
