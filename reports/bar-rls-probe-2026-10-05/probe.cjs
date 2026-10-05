const { Client } = require('pg');
const {randomUUID}=require('node:crypto');
const assert=require('node:assert/strict');
(async()=>{
 const c=new Client({connectionString:'postgresql://postgres@127.0.0.1:55753/pmslocal',options:'-c search_path=pms_test,public'});await c.connect();
 const rows={};
 async function insert(table,data){const id=randomUUID();data={id,...data};const keys=Object.keys(data);await c.query(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map((_,i)=>'$'+(i+1)).join(',')})`,Object.values(data));if(table.startsWith('bar_')) rows[table]=id;return id;}
 try{
 await c.query('BEGIN');
 const {id:property,organization_id:org}=(await c.query('SELECT id,organization_id FROM properties ORDER BY created_at LIMIT 1')).rows[0];
 const category=await insert('bar_categories',{property_id:property,name:randomUUID(),default_markup_basis:0});
 const product=await insert('bar_products',{property_id:property,category_id:category,code:randomUUID(),name:'Synthetic RLS product',sale_price:200,updated_at:new Date()});
 const supplier=await insert('bar_suppliers',{property_id:property,name:randomUUID(),updated_at:new Date()});
 const receipt=await insert('bar_receipts',{property_id:property,supplier_id:supplier,document_number:randomUUID(),document_date:'2026-10-05',received_date:'2026-10-05',currency:'KZT',total_amount:100,updated_at:new Date()});
 const line=await insert('bar_receipt_lines',{receipt_id:receipt,product_id:product,quantity_units:1,unit_cost:100,amount:100,markup_basis:0,calculated_price:200});
 const lot=await insert('bar_stock_lots',{property_id:property,product_id:product,receipt_line_id:line,received_units:1,remaining_units:1,unit_cost:100,received_at:new Date()});
 await insert('bar_stock_movements',{property_id:property,product_id:product,lot_id:lot,kind:'RECEIPT',units:1,unit_cost:100,source_type:'test',source_id:receipt});
 const cash=await insert('cash_operations',{property_id:property,kind:'EXPENSE',method:'CASH',amount:100});
 await insert('bar_supplier_payments',{receipt_id:receipt,cash_operation_id:cash,amount:100,paid_at:new Date()});
 const sale=await insert('bar_sales',{property_id:property,idempotency_key:randomUUID(),currency:'KZT',total_revenue:200,total_cost:100});
 await insert('bar_sale_lines',{sale_id:sale,product_id:product,quantity_units:1,sale_price:200,revenue:200,cost:100});
 for(const [label,role,tenant,expected] of [['own','wetop_app',org,1],['foreign','wetop_app',randomUUID(),0],['missing','wetop_app','',0],['service','wetop_service','',1]]){
 await c.query('SAVEPOINT role_probe');await c.query('SET LOCAL ROLE '+role);await c.query("SELECT set_config('app.org_id',$1,true)",[tenant]);
 for(const [table,id] of Object.entries(rows)){const count=(await c.query(`SELECT count(*)::int AS n FROM ${table} WHERE id=$1`,[id])).rows[0].n;assert.equal(count,expected,`${label} ${table}`);console.log(`PASS ${label} ${table} ${count}`);}
 await c.query('ROLLBACK TO SAVEPOINT role_probe');}
 console.log('PASS 40 populated BAR role/table checks');
 }finally{await c.query('ROLLBACK');await c.end();console.log('ROLLBACK complete');}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
