import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
test('demo videos remain unsold and proximity audio becomes audible only nearby',async({page,request})=>{
 test.setTimeout(120000);
 const initial=await(await request.get('/api/public')).json();
 expect(initial.mode).toBe('simulation');
 for(const id of ['tsq-026','tsq-009']) {const s=initial.slots.find((s:{id:string})=>s.id===id);expect(s.creative).toBeNull();expect(s.brandId).toBeNull();expect(s.total).toBe(0);}
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?billboard=tsq-026');
 await expect(page.getByText('VIDEO DEMO · AVAILABLE TO BUY')).toBeVisible();
 await expect(page.getByRole('button',{name:'Claim this billboard'})).toBeEnabled();
 await page.getByRole('button',{name:'Close panel',exact:true}).click();
 const canvas=page.locator('.scene canvas');
 const videos=async()=>JSON.parse(await canvas.getAttribute('data-videos')||'[]') as {slot:string;time:number;audioGain:number;audioRms:number;distance:number}[];
 await expect.poll(async()=>(await videos()).some(v=>v.slot==='tsq-026'&&v.time>0),{timeout:20000}).toBe(true);
 expect((await videos()).every(v=>v.audioGain===0)).toBe(true);
 await expect(page.getByRole('button',{name:'Mute all audio',exact:true})).toBeVisible();
 await expect.poll(async()=>(await videos()).find(v=>v.slot==='tsq-026')?.distance||999).toBeLessThan(100);
 await expect.poll(async()=>(await videos()).find(v=>v.slot==='tsq-026')?.distance||0).toBeGreaterThan(24);
 const far=await videos();expect(far.every(v=>v.audioGain===0)).toBe(true);
 await page.keyboard.down('w');
 try { await expect.poll(async()=>(await videos()).find(v=>v.slot==='tsq-026')?.distance||999,{timeout:15000}).toBeLessThan(19); }
 finally { await page.keyboard.up('w'); }
 await expect.poll(async()=>(await videos()).find(v=>v.slot==='tsq-026')?.audioGain||0,{timeout:20000}).toBeGreaterThan(0.05);
 await expect.poll(async()=>(await videos()).find(v=>v.slot==='tsq-026')?.audioRms||0,{timeout:20000}).toBeGreaterThan(0.0001);
 const near=await videos();
 await mkdir('artifacts/media',{recursive:true});await page.screenshot({path:'artifacts/media/proximity-demo-near.png'});
 await page.keyboard.down('s');
 try { await expect.poll(async()=>(await videos()).find(v=>v.slot==='tsq-026')?.distance||0,{timeout:15000}).toBeGreaterThan(25); }
 finally { await page.keyboard.up('s'); }
 await expect.poll(async()=>(await videos()).find(v=>v.slot==='tsq-026')?.audioGain||0).toBe(0);
 await page.getByRole('button',{name:'Mute all audio',exact:true}).click();
 await expect.poll(()=>page.locator('audio').evaluate((a:HTMLAudioElement)=>a.paused&&a.muted)).toBe(true);
 await expect.poll(async()=>(await videos()).every(v=>v.audioGain===0)).toBe(true);
 const after=await(await request.get('/api/public')).json();
 for(const id of ['tsq-026','tsq-009'])expect(after.slots.find((s:{id:string})=>s.id===id).brandId).toBeNull();
 await writeFile('artifacts/media/proximity-audio.json',JSON.stringify({far,near,afterMute:await videos(),errors},null,2));
 expect(errors).toEqual([]);
});
