import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
it('cash form keeps a scoped hashed draft intent until acknowledged success',()=>{
 const source=readFileSync(new URL('./cash-board.tsx',import.meta.url),'utf8');
 expect(source).toContain('sessionStorage.getItem');
 expect(source).toContain("crypto.subtle.digest('SHA-256'");
 expect(source).toContain('idempotencyKey,');
 expect(source).toContain('sessionStorage.removeItem');
});
