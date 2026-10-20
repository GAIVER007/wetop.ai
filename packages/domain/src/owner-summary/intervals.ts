export type Range = [number, number];
export function union(rows: Range[]): Range[] {
 const out: Range[]=[];
 for(const row of rows.filter(r=>r[1]>r[0]).sort((a,b)=>a[0]-b[0])) {
  const last=out[out.length-1]; if(last && row[0]<=last[1]) last[1]=Math.max(last[1],row[1]); else out.push([...row]);
 }
 return out;
}
export function intersect(a:Range[],b:Range[]):Range[]{return union(a.flatMap(x=>b.map(y=>[Math.max(x[0],y[0]),Math.min(x[1],y[1])] as Range)));}
export function subtract(a:Range[],b:Range[]):Range[]{return b.reduce((rows,cut)=>rows.flatMap(r=>cut[1]<=r[0]||cut[0]>=r[1]?[r]:[[r[0],Math.min(r[1],cut[0])],[Math.max(r[0],cut[1]),r[1]]] as Range[]),a).filter(r=>r[1]>r[0]);}
export const duration=(rows:Range[])=>rows.reduce((sum,r)=>sum+BigInt(r[1]-r[0]),0n);
