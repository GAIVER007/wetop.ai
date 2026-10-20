import {readFileSync} from 'node:fs';
import {it,expect} from 'vitest';
it('uses only existing design tokens so card padding cannot silently collapse',()=>{
 const css=readFileSync('apps/web/src/app/today/unified-owner.css','utf8');
 const tokens=readFileSync('apps/web/src/app/tokens.css','utf8');
 const defined=new Set([...tokens.matchAll(/(--[\w-]+)\s*:/g),...css.matchAll(/(--[\w-]+)\s*:/g)].map(m=>m[1]));
 const missing=[...new Set([...css.matchAll(/var\((--[\w-]+)/g)].map(m=>m[1]).filter(name=>!defined.has(name)))];
 expect(missing).toEqual([]);
});
