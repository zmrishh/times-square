import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
process.env.PAPER_DATA_DIR=':memory:';
process.env.PAYMENT_MODE='simulation';
import {query,id,tx,database,closeDatabase} from '../src/server/db';
import {reserve,adjustPayment,applyEvidence,Order,PaymentEvidence} from '../src/server/auction';
import {startCheckout,simulatePayment} from '../src/server/payments';
import {submitCreative} from '../src/server/content';
import {placementQuote,videoCredit} from '../src/server/media-pricing';
import {EMPTY_CREATIVE} from '../src/lib/registry';
import {Account} from '../src/server/auth';
after(closeDatabase);
async function user(){const a:Account={id:id(),email:`${id()}@premium.example`,role:'advertiser',suspended:false};await query('INSERT INTO accounts(id,email) VALUES($1,$2)',[a.id,a.email]);return a;}
async function creative(a:Account,video=false,brandId?:string){
  const image=id(),poster=id();
  await query("INSERT INTO assets(id,account_id,owner_token,path,bytes) VALUES($1,$2,'fixture',$3,1000),($4,$2,'fixture',$5,100)",[image,a.id,`${image}.${video?'mp4':'webp'}`,poster,`${poster}.webp`]);
  return submitCreative(a,{...EMPTY_CREATIVE,name:'Premium test',url:'https://premium.example',mode:video?'video':'upload',image:`/api/assets/${image}`,poster:video?`/api/assets/${poster}`:''},brandId);
}
const quote=(a:Account,c:string,s:string,target?:number)=>tx(db=>placementQuote(db,c,a.id,s,target));
async function paid(a:Account,c:string,s:string,target?:number){const o=await startCheckout((await reserve(a,c,s,target)).id);await simulatePayment(o.id,a.id);return o;}
const state=async(s:string)=>(await query<{leader_brand:string;creative_id:string}>('SELECT * FROM slots WHERE id=$1',[s]))[0];
test('video costs 50% more; takeover is at least $10; fees never inflate ranking',async()=>{
 const a=await user(),b=await user(),v=await creative(a,true),photo=await creative(b),video=await creative(b,true);
 const q=await quote(a,v.creativeId,'tsq-001');assert.equal(q.target,5000);assert.equal(q.videoFee,2500);assert.equal(q.due,7500);
 const o=await paid(a,v.creativeId,'tsq-001');
 assert.equal((await query<{amount:number}>('SELECT amount FROM allocations WHERE payment_id=$1',[`sim_pay_${o.id}`]))[0].amount,5000);
 assert.equal((await quote(b,photo.creativeId,'tsq-001')).due,6000);
 assert.equal((await quote(b,video.creativeId,'tsq-001')).due,9000);
 await assert.rejects(()=>quote(b,photo.creativeId,'tsq-001',5999),/Target/);
 assert.equal((await quote(b,video.creativeId,'tsq-002',5001)).videoFee,2501);
});
test('image-to-video upgrade requires only the missing fee; refund restores paid image',async()=>{
 const a=await user(),image=await creative(a);const original=await paid(a,image.creativeId,'tsq-002');
 const v=await creative(a,true,image.brandId);
 assert.equal((await state('tsq-002')).creative_id,image.creativeId);
 const q=await quote(a,v.creativeId,'tsq-002');assert.equal(q.rankingDue,0);assert.equal(q.due,2500);assert.equal(q.target,5000);
 await assert.rejects(()=>quote(a,v.creativeId,'tsq-002',6000),/cannot increase/);
 const upgrade=await paid(a,v.creativeId,'tsq-002');
 assert.equal((await state('tsq-002')).creative_id,v.creativeId);
 await simulatePayment(upgrade.id,a.id);
 assert.equal((await query('SELECT * FROM allocations WHERE payment_id=$1',[`sim_pay_${upgrade.id}`])).length,1);
 assert.equal((await quote(a,v.creativeId,'tsq-002')).due,0);
 await adjustPayment(`sim_pay_${upgrade.id}`,2500,2500,false);
 assert.equal((await state('tsq-002')).creative_id,image.creativeId);
 assert.equal((await query<{amount:number}>('SELECT amount FROM totals WHERE slot_id=$1 AND brand_id=$2',['tsq-002',image.brandId]))[0].amount,original.due);
 assert.equal((await quote(a,v.creativeId,'tsq-002')).due,2500);
});
test('returning video credit is placement-local and cannot be bypassed through image edits',async()=>{
 const a=await user(),b=await user(),v=await creative(a,true),rival=await creative(b);
 await paid(a,v.creativeId,'tsq-007');await paid(b,rival.creativeId,'tsq-007');
 const q=await quote(a,v.creativeId,'tsq-007');assert.equal(q.target,7000);assert.equal(q.rankingDue,2000);assert.equal(q.videoFee,1000);assert.equal(q.due,3000);
 assert.equal((await quote(a,v.creativeId,'tsq-008',5000)).videoFee,2500);
 const image=await creative(a,false,v.brandId);await paid(a,image.creativeId,'tsq-007');
 const changed=await creative(a,true,v.brandId);
 assert.equal((await state('tsq-007')).creative_id,image.creativeId);
 const upgrade=await quote(a,changed.creativeId,'tsq-007');assert.equal(upgrade.rankingDue,0);assert.equal(upgrade.due,1000);
});
test('partial refunds reduce ranking and video credit proportionately, without rounding away coverage',async()=>{
 const a=await user(),v=await creative(a,true),o=await paid(a,v.creativeId,'tsq-008',5000);
 await adjustPayment(`sim_pay_${o.id}`,2500,2500,false);
 const amount=(await query<{amount:number}>('SELECT amount FROM totals WHERE slot_id=$1 AND brand_id=$2',['tsq-008',v.brandId]))[0].amount;
 assert.equal(amount,3333);assert.equal(await tx(db=>videoCredit(db,'tsq-008',v.brandId)),1667);
 assert.equal((await state('tsq-008')).creative_id,v.creativeId);
});
test('paying only the image amount cannot acquire a video; migration and fee snapshots preserve records',async()=>{
 const a=await user(),v=await creative(a,true),o=await startCheckout((await reserve(a,v.creativeId,'tsq-012',5000)).id);
 const e:PaymentEvidence={id:`forged_${o.id}`,orderId:o.id,sessionId:o.session_id,mode:'simulation',businessId:'local',productId:o.product_id,quantity:1,email:o.customer_email,customerId:'fixture',principal:5000,tax:0,cash:5000,currency:'USD',status:'succeeded',refundedPrincipal:0,refundedCash:0,disputed:false,raw:{}};
 assert.equal((await applyEvidence(e))?.delivered,false);assert.equal((await state('tsq-012')).leader_brand,null);
 const sql=await readFile('migrations/008_video_premium.sql','utf8');const db=(await database()).db;
 await (db as PGlite).exec(sql);await (db as PGlite).exec(sql);
 assert.equal((await query<Order>('SELECT * FROM orders WHERE id=$1',[o.id]))[0].video_fee,2500);
 await assert.rejects(()=>query('UPDATE orders SET video_fee=0 WHERE id=$1',[o.id]),/immutable/);
});
test('older paid videos are grandfathered and price changes require renewed checkout consent',async()=>{
 const a=await user(),v=await creative(a,true),orderId=id();
 const slot=(await query<{version:number}>('SELECT version FROM slots WHERE id=$1',['tsq-015']))[0];
 await query(`INSERT INTO orders(id,account_id,brand_id,creative_id,slot_id,slot_version,existing,target,due,rules,mode,product_id,business_id,customer_email,expires_at,cutoff_at,session_id,state)
   VALUES($1,$2,$3,$4,'tsq-015',$5,0,5000,5000,$6,'simulation','simulation-product','local',$7,now()+interval '10 minutes',now()+interval '12 minutes',$8,'checkout')`,[orderId,a.id,v.brandId,v.creativeId,slot.version,JSON.stringify({rulesVersion:'2026-09-v1'}),a.email,`sim_${orderId}`]);
 await simulatePayment(orderId,a.id);
 assert.equal((await state('tsq-015')).creative_id,v.creativeId);
 const edited=await creative(a,true,v.brandId);assert.equal((await state('tsq-015')).creative_id,edited.creativeId);
 assert.equal((await quote(a,edited.creativeId,'tsq-015')).due,0);
 const b=await user(),newVideo=await creative(b,true);
 await assert.rejects(()=>reserve(b,newVideo.creativeId,'tsq-016',5000,5000),/price changed/);
 assert.equal((await query('SELECT id FROM orders WHERE account_id=$1',[b.id])).length,0);
});
