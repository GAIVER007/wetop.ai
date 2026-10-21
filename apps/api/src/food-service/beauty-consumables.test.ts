import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { withSignedInUser, withVerifiedBeautyOperation } from '../auth/request-context';
import { StockService } from './stock.service';
import { FoodStockController } from './food.module';
import { BUSINESS_CAPABILITY } from '../auth/capability.decorator';
import { BEAUTY_ACCESS } from '../beauty/access.decorator';

it('exposes the same consumables used by Beauty techcards in the selected branch stock screen', async()=>{
  const db={business:{findFirst:vi.fn().mockResolvedValue({id:'salon'})},location:{findFirst:vi.fn().mockResolvedValue({id:'branch',timezone:'UTC',currency:'USD'})},kitchenProduct:{findMany:vi.fn().mockResolvedValue([{id:'shampoo',name:'Тестовый шампунь',unit:'мл',minQty:'100',active:true}])},kitchenStockLot:{findMany:vi.fn().mockResolvedValue([])}};
  const result=await withSignedInUser({userId:'owner',organizationId:'org',role:'OWNER',scope:'LOCATION',businessId:'salon',locationId:'branch',vertical:'BEAUTY'},()=>withVerifiedBeautyOperation({section:'stock',action:'view',legacy:'desk'},()=>new StockService({db} as never).products()));
  expect(result.items).toEqual([expect.objectContaining({id:'shampoo',onHand:'0',unit:'мл'})]);
  expect(db.kitchenProduct.findMany).toHaveBeenCalledWith(expect.objectContaining({where:{businessId:'salon'}}));
  expect(db.kitchenStockLot.findMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({locationId:'branch'})}));
});

it('opens the same kitchen stock to a hotel branch (ADR-STOCK-ALL)', async()=>{
  const db={business:{findFirst:vi.fn().mockResolvedValue({id:'hotel'})},location:{findFirst:vi.fn().mockResolvedValue({id:'branch',timezone:'UTC',currency:'KZT'})},kitchenProduct:{findMany:vi.fn().mockResolvedValue([{id:'flour',name:'Мука',unit:'г',minQty:'1000',active:true}])},kitchenStockLot:{findMany:vi.fn().mockResolvedValue([])}};
  const result=await withSignedInUser({userId:'owner',organizationId:'org',role:'OWNER',scope:'LOCATION',businessId:'hotel',locationId:'branch',vertical:'HOSPITALITY'},()=>new StockService({db} as never).products());
  expect(result.items).toEqual([expect.objectContaining({id:'flour',unit:'г'})]);
  expect(db.business.findFirst).toHaveBeenCalledWith({where:expect.objectContaining({vertical:'HOSPITALITY'})});
});

describe('shared consumables route boundaries',()=>{
  it('uses a shared stock capability without granting restaurant menu or order capabilities',()=>{
    expect(Reflect.getMetadata(BUSINESS_CAPABILITY,FoodStockController)).toBe('branch.stock');
  });
  it.each([['products','view'],['lots','view'],['movements','view'],['createProduct','create'],['updateProduct','update'],['receipt','create'],['reverse','delete'],['writeOff','update'],['inventory','update']])('requires stock.%s for %s', (method,action)=>{
    expect(Reflect.getMetadata(BEAUTY_ACCESS,(FoodStockController.prototype as unknown as Record<string,object>)[method!]!)).toEqual({section:'stock',action});
  });
});
