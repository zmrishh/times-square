import test from 'node:test';
import assert from 'node:assert/strict';
process.env.PAPER_DATA_DIR=':memory:';
process.env.PAYMENT_MODE='simulation';
import {beginVideo} from '../src/server/video-uploads';
import {closeDatabase} from '../src/server/db';

test('signed upload tickets use the signed TUS route and direct storage host',async()=>{
  const nativeFetch=globalThis.fetch;
  process.env.SUPABASE_URL='https://upload-fixture.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY='isolated-fixture-key';
  let signedPath='';
  globalThis.fetch=async(input,init)=>{
    const request=new Request(input,init),url=new URL(request.url);
    assert.equal(url.hostname,'upload-fixture.supabase.co');
    assert.equal(request.method,'POST');
    assert.match(url.pathname,/^\/storage\/v1\/object\/upload\/sign\/paper-assets\/pending\/[a-f0-9-]+\.mp4$/);
    signedPath=url.pathname;
    return Response.json({url:url.pathname.replace('/storage/v1','')+'?token=fixture.signed.token'});
  };
  try {
    const ticket=await beginVideo(null,'isolated-upload-owner',8_801_922);
    assert.equal(ticket.endpoint,'https://upload-fixture.storage.supabase.co/storage/v1/upload/resumable/sign');
    assert.ok(signedPath.endsWith(ticket.path!));
    assert.equal(ticket.token,'fixture.signed.token');
  } finally {
    globalThis.fetch=nativeFetch;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    await closeDatabase();
  }
});
