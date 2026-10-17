import { expect,it,vi } from 'vitest';
import { RestaurantOpeningService, parseOpening } from './opening';
import { withSignedInUser } from '../auth/request-context';
it('validates explicit local windows without wildcard weekdays or implicit overnight',()=>{
 const base={effectiveFrom:'2026-10-16',effectiveTo:'2026-10-20',intervals:[{weekday:5,localStart:'22:00',localEnd:'02:00',endsNextDay:true}],closures:[]};
 expect(parseOpening(base).intervals[0]?.endsNextDay).toBe(true);
 for(const interval of [{weekday:7,localStart:'09:00',localEnd:'10:00',endsNextDay:false},{weekday:1,localStart:'22:00',localEnd:'02:00',endsNextDay:false},{weekday:1,localStart:'25:00',localEnd:'02:00',endsNextDay:true}]) expect(()=>parseOpening({...base,intervals:[interval]})).toThrow();
 expect(()=>parseOpening({...base,effectiveFrom:'2026-02-30'})).toThrow();
});
it('requires settings authority even when called directly, and defaults off',async()=>{
 const db={location:{findFirst:vi.fn()}};
 const service=new RestaurantOpeningService({db} as never);
 await expect(service.confirm({})).rejects.toThrow();
 await expect(withSignedInUser({userId:'u',organizationId:'o',role:'STAFF'},()=>service.confirm({}))).rejects.toThrow();
 expect(db.location.findFirst).not.toHaveBeenCalled();
});
