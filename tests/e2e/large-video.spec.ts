import {test,expect} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const origin=process.env.PAPER_TEST_ORIGIN || 'http://localhost:3001';
test('8 MB video resumes interrupted TUS upload and is validated privately by the real API',async({page,request})=>{
 test.setTimeout(150000);
 expect((await(await request.get('/api/public')).json()).mode).toBe('simulation');
 execFileSync(process.execPath,['scripts/create-video-test-fixture.mjs'],{windowsHide:true});
 const bytes=await readFile('artifacts/large-video-fixture.mp4');expect(bytes.length).toBeGreaterThan(4_500_000);
 let sourceUrl='',uploadId='',received=Buffer.alloc(0),interrupted=false,heads=0,patches=0;
 // Only the storage protocol is simulated. The real initializer, owner check,
 // validator, immutable output, poster and private asset routes are exercised.
 await page.route('**/api/upload/init',async route=>{
  const response=await route.fetch();const ticket=await response.json();
  expect(response.ok()).toBeTruthy();sourceUrl=ticket.localUrl;uploadId=ticket.id;
  await route.fulfill({json:{id:ticket.id,endpoint:`${origin}/__test_tus__/${ticket.id}`,token:'isolated-signature',bucket:'fixture',path:`pending/${ticket.id}.mp4`}});
 });
 await page.route('**/__test_tus__/**',async route=>{
  const req=route.request(),method=req.method(),headers={'Tus-Resumable':'1.0.0','Upload-Offset':String(received.length),'Upload-Length':String(bytes.length),'Cache-Control':'no-store'};
  if(method==='HEAD'){heads++;await route.fulfill({status:200,headers});return;}
  expect(req.headers()['x-signature']).toBe('isolated-signature');
  if(method==='PATCH'){
    patches++;
    if(!interrupted){interrupted=true;await route.fulfill({status:503,headers});return;}
    expect(Number(req.headers()['upload-offset'])).toBe(received.length);
  }
  const chunk=req.postDataBuffer() || Buffer.alloc(0);
  expect(chunk.length).toBeGreaterThan(0);
  expect(chunk.equals(bytes.subarray(received.length,received.length+chunk.length))).toBeTruthy();
  received=Buffer.concat([received,chunk]);
  if(received.length===bytes.length) {
    const stored=await page.request.post(sourceUrl,{headers:{Origin:origin,'Content-Type':'video/mp4'},data:received});expect(stored.ok()).toBeTruthy();
  }
  await route.fulfill({status:method==='POST'?201:204,headers:{...headers,Location:`${origin}/__test_tus__/${uploadId}`,'Upload-Offset':String(received.length)}});
 });
 await page.goto('/?billboard=tsq-024');await page.getByRole('button',{name:/Claim this billboard|Outbid this brand/}).click();
 await page.getByRole('button',{name:'Looping video',exact:true}).click();
 await expect(page.getByText(/up to 30 seconds · 50 MB/)).toBeVisible();
 const complete=page.waitForResponse(r=>r.url().endsWith('/api/upload/complete')&&r.request().method()==='POST');
 await page.getByLabel('Upload video',{exact:true}).setInputFiles('artifacts/large-video-fixture.mp4');
 const response=await complete,media=await response.json();expect(response.ok(),JSON.stringify(media)).toBeTruthy();
 expect(received.equals(bytes)).toBe(true);expect(interrupted).toBe(true);expect(heads).toBeGreaterThan(0);expect(patches).toBeGreaterThan(1);
 expect((await request.get(media.url)).status()).toBe(404);expect((await request.get(media.poster)).status()).toBe(404);
 const range=await page.request.get(media.url,{headers:{Range:'bytes=0-99'}});expect(range.status()).toBe(206);expect((await range.body()).length).toBe(100);
 const repeat=await page.request.post('/api/upload/complete',{headers:{Origin:origin},multipart:{id:uploadId,poster:{name:'poster.png',mimeType:'image/png',buffer:await readFile('tests/fixtures/loop-poster.png')}}});
 expect(await repeat.json()).toEqual(media);
 const foreign=await request.post('/api/upload/complete',{headers:{Origin:origin},multipart:{id:uploadId,poster:{name:'poster.png',mimeType:'image/png',buffer:await readFile('tests/fixtures/loop-poster.png')}}});expect(foreign.status()).toBe(400);
 await page.screenshot({path:'artifacts/media/large-video-editor.png'});
 await writeFile('artifacts/media/resumable-upload.json',JSON.stringify({bytes:bytes.length,received:received.length,heads,patches,interrupted,privateBeforePayment:true,idempotentFinalization:true,storageProtocol:'isolated TUS fixture; real app validation'},null,2));
});
