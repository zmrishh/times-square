import {test,expect,APIRequestContext} from '@playwright/test';
import sharp from 'sharp';
const origin=process.env.PAPER_TEST_ORIGIN || 'http://localhost:3001';
async function post(r:APIRequestContext,path:string,data:unknown){const response=await r.post(`/api/${path}`,{headers:{Origin:origin},data});const result=await response.json();expect(response.ok(),JSON.stringify(result)).toBe(true);return result;}
async function login(r:APIRequestContext,email:string){const code=await post(r,'auth/send',{email});await post(r,'auth/verify',{email,code:code.localCode});}
test('current image sponsor reviews and pays a $25 video upgrade on a $50 ranking',async({page,browser,request})=>{
 const initial=await(await request.get('/api/public')).json();expect(initial.mode).toBe('simulation');
 const placement=initial.slots.find((s:{id:string;brandId:string|null;reserved:boolean})=>!s.brandId&&!s.reserved&&!['tsq-026','tsq-009'].includes(s.id)).id;
 await login(page.request,`upgrade-${Date.now()}@test.example`);
 const image=await sharp({create:{width:256,height:128,channels:3,background:'#e95c30'}}).png().toBuffer();
 const uploaded=await(await page.request.post('/api/upload',{headers:{Origin:origin},multipart:{file:{name:'image.png',mimeType:'image/png',buffer:image}}})).json();
 const data={name:'Video upgrade proof',url:'https://example.com',tagline:'',description:'',category:'Technology',social:'',mode:'upload',bg:'#ffffff',fg:'#183b4b',headline:'',subline:'',logo:'',image:uploaded.url,fit:'cover',cropX:50,cropY:50};
 const creative=await post(page.request,'creatives',{creative:data});
 const first=await post(page.request,'checkout',{creativeId:creative.creativeId,slotId:placement,target:5000,expectedDue:5000,accepted:true});
 await post(page.request,'checkout/simulate',{orderId:first.id});
 await page.goto(`/?billboard=${placement}`);await page.getByRole('button',{name:'Outbid this brand',exact:true}).click();
 await page.getByLabel('Reuse a brand').selectOption(creative.creativeId);
 await page.getByRole('button',{name:'Looping video',exact:true}).click();
 const upload=page.waitForResponse(r=>r.url().endsWith('/api/upload/complete'));
 await page.getByLabel('Upload video',{exact:true}).setInputFiles('tests/fixtures/loop.mp4');expect((await upload).ok()).toBe(true);
 await page.getByRole('button',{name:'Review changes',exact:true}).click();
 await expect(page.locator('.checkout-review .due').last()).toContainText('$25');
 await expect(page.getByText('Video format fee (50%)',{exact:true})).toBeVisible();
 const before=await(await request.get('/api/public')).json();expect(before.slots.find((s:{id:string})=>s.id===placement).creativeId).toBe(creative.creativeId);
 await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Continue to payment simulation',exact:true}).click();
 await expect(page).toHaveURL(/checkout=/);
 const upgradeId=new URL(page.url()).searchParams.get('checkout')!;
 await page.getByRole('button',{name:'Simulate successful payment',exact:true}).click();
 await expect(page.getByText('You’re up in the square.',{exact:true})).toBeVisible();
 const receipt=await(await page.request.get(`/api/receipt/${upgradeId}`)).json();expect(receipt.records[0].video_fee).toBe(2500);expect(receipt.records[0].ranking_contribution).toBe(0);
 const after=await(await request.get('/api/public')).json(),slot=after.slots.find((s:{id:string})=>s.id===placement);expect(slot.total).toBe(5000);expect(slot.creative.mode).toBe('video');
 const operator=await browser.newContext({baseURL:origin});await login(operator.request,'operator@paper.local');
 const me=await(await page.request.get('/api/me')).json();const order=me.orders.find((o:{id:string})=>o.id===upgradeId);
 await post(operator.request,'admin/refund',{paymentId:order.payment_id,reason:'Isolated upgrade regression'});await post(operator.request,'admin/jobs',{});
 const restored=await(await request.get('/api/public')).json();expect(restored.slots.find((s:{id:string})=>s.id===placement).creativeId).toBe(creative.creativeId);
 // Also return the initial fixture placement to unsold state.
 const original=me.orders.find((o:{id:string})=>o.id===first.id);await post(operator.request,'admin/refund',{paymentId:original.payment_id,reason:'Isolated fixture cleanup'});await post(operator.request,'admin/jobs',{});
 await operator.close();
});
