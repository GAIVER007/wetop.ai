import { describe, expect, it, vi } from 'vitest';
import { BeautyAppointmentsController } from './appointments';

const appointment={id:'visit',priceMinor:'1200',notes:'Private appointment note',customer:{id:'customer',name:'Synthetic Customer',phone:'+19995550123'}};
const day={location:{id:'branch',currency:'USD'},date:'2026-10-18',appointments:[appointment],services:[{id:'not-used-service',priceMinor:'777'}],columns:[{id:'master',name:'Synthetic Master',intervals:[{timeFrom:'09:00',timeTo:'18:00'}],timeOff:true,timeOffReason:'Private reason',serviceIds:['not-used-service']}],bounds:{fromMinutes:480,toMinutes:1200}};
describe('financial report projection',()=>{
  it('returns money and master names without private client notes, phone, staffing details or unused service prices',async()=>{
    const controller=new BeautyAppointmentsController({day:vi.fn().mockResolvedValue(day)} as never);
    const result=await controller.financeDay();
    expect(result.appointments[0]).toMatchObject({priceMinor:'1200',notes:null,customer:{name:'Synthetic Customer',phone:null}});
    expect(result.services).toEqual([]);
    expect(result.columns).toEqual([{id:'master',name:'Synthetic Master',intervals:[],timeOff:false,timeOffReason:null,serviceIds:[]}]);
  });
  it('applies the same privacy boundary to period reports',async()=>{
    const controller=new BeautyAppointmentsController({period:vi.fn().mockResolvedValue({period:{from:'2026-10-18',to:'2026-10-18'},appointments:[appointment]})} as never);
    expect((await controller.financePeriod('2026-10-18','2026-10-18')).appointments[0]).toMatchObject({notes:null,customer:{phone:null}});
  });
});
