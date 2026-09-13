import { mkdir,readFile,writeFile,unlink } from 'node:fs/promises';
import path from 'node:path';
import { Account,supabase,rate } from './auth';
import { id,one,query,tx,job } from './db';
import { boundedBody } from './request-body';
import { prepareImage,prepareVideo } from './media';
import { MAX_VIDEO_BYTES,MAX_POSTER_BYTES } from '../lib/media';
type Session={id:string;poster_id:string;bytes:number;state:string;account_id:string|null;owner_token:string;result:Record<string,unknown>|null};
const directory=()=>process.env.PAPER_UPLOAD_DIR || path.join(process.cwd(),'.data','uploads');
const bucket=()=>supabase().storage.from(process.env.SUPABASE_STORAGE_BUCKET || 'paper-assets');
const sourceKey=(uploadId:string)=>`pending/${uploadId}.mp4`;
export async function beginVideo(a:Account|null,owner:string,size:number) {
  if(!Number.isSafeInteger(size)||size<=0||size>MAX_VIDEO_BYTES) throw new Error('Upload a video up to 50 MB.');
  const uploadId=id(),posterId=id();
  await tx(async db=>{
    await rate(db,`upload:${a?.id || owner}`,12,3600);
    await db.query('INSERT INTO media_uploads(id,poster_id,account_id,owner_token,bytes) VALUES($1,$2,$3,$4,$5)',[uploadId,posterId,a?.id||null,owner,size]);
  });
  if(process.env.SUPABASE_URL) {
    const {data,error}=await bucket().createSignedUploadUrl(sourceKey(uploadId),{upsert:false});
    if(error||!data) throw new Error('Video storage unavailable. Please try again.');
    // Signed tokens use Supabase's /sign route; the normal TUS route requires a user JWT.
    const endpoint=new URL('/storage/v1/upload/resumable/sign',process.env.SUPABASE_URL);
    if(endpoint.hostname.endsWith('.supabase.co')) endpoint.hostname=endpoint.hostname.replace('.supabase.co','.storage.supabase.co');
    return {id:uploadId,endpoint:endpoint.href,token:data.token,bucket:process.env.SUPABASE_STORAGE_BUCKET || 'paper-assets',path:sourceKey(uploadId)};
  }
  if(process.env.NODE_ENV==='production') throw new Error('Private video storage is required.');
  return {id:uploadId,localUrl:`/api/upload/local-source/${uploadId}`};
}
async function owned(uploadId:string,a:Account|null,owner:string) {
  const s=(await query<Session>("SELECT * FROM media_uploads WHERE id=$1 AND expires_at>now() AND state<>'expired' AND (account_id=$2 OR (account_id IS NULL AND owner_token=$3))",[uploadId,a?.id||null,owner]))[0];
  if(!s) throw new Error('Upload unavailable or expired. Select the video again.');
  return s;
}
export async function localVideoSource(req:Request,uploadId:string,a:Account|null,owner:string) {
  if(process.env.NODE_ENV==='production'||process.env.SUPABASE_URL) throw new Error('Direct storage upload required.');
  const s=await owned(uploadId,a,owner);
  if(s.state!=='pending') throw new Error('Upload already processing.');
  const bytes=await boundedBody(req,MAX_VIDEO_BYTES);
  if(bytes.length!==s.bytes) throw new Error('Video upload is incomplete.');
  await mkdir(path.join(directory(),'pending'),{recursive:true});
  await writeFile(path.join(directory(),sourceKey(uploadId)),bytes,{flag:'wx'});
}
export async function removeVideoKeys(keys:string[]) {
  const safe=keys.filter(k=>/^(pending\/)?[a-f0-9-]{36}\.(mp4|webp)$/.test(k));
  if(safe.length!==keys.length) throw new Error('Invalid cleanup key.');
  if(process.env.SUPABASE_URL) {
    const {error}=await bucket().remove(keys);if(error) throw new Error('Upload cleanup will retry.');
  } else if(process.env.NODE_ENV!=='production') {
    await Promise.all(keys.map(key=>unlink(path.join(directory(),key)).catch(e=>{if(e.code!=='ENOENT')throw e;})));
  }
}
export async function completeVideo(uploadId:string,poster:File,a:Account|null,owner:string) {
  const original=await owned(uploadId,a,owner);
  if(original.state==='ready') return original.result;
  if(!poster.size||poster.size>MAX_POSTER_BYTES) throw new Error('Upload a video with its preview frame.');
  const posterBytes=await prepareImage(Buffer.from(await poster.arrayBuffer()));
  const lease=id();
  const s=await tx(async db=>{
    const previous=await one<Session>(db,"SELECT * FROM media_uploads WHERE id=$1 AND (state='pending' OR (state='processing' AND lease_until<now())) FOR UPDATE",[uploadId]);
    if(!previous) throw new Error('This video is being processed. Retry shortly.');
    if(previous.result?.attempt) await job(db,`media-cleanup:${previous.result.attempt}`,'media-cleanup',{attempt:previous.result.attempt});
    return one<Session>(db,"UPDATE media_uploads SET state='processing',lease_until=now()+interval '2 minutes',result=jsonb_build_object('attempt',$2::text) WHERE id=$1 RETURNING *",[uploadId,lease]);
  });
  const keys=[`${lease}.webp`,`${lease}.mp4`];
  try {
    let bytes:Buffer;
    if(process.env.SUPABASE_URL) {
      const {data,error}=await bucket().createSignedUrl(sourceKey(uploadId),120);
      if(error||!data) throw new Error('Video upload is incomplete. Retry uploading.');
      const response=await fetch(data.signedUrl,{signal:AbortSignal.timeout(60000)});
      if(!response.ok) throw new Error('Video upload is incomplete. Retry uploading.');
      bytes=Buffer.from(await boundedBody(response,MAX_VIDEO_BYTES));
    } else if(process.env.NODE_ENV!=='production') bytes=await readFile(path.join(directory(),sourceKey(uploadId)));
    else throw new Error('Private video storage is required.');
    if(bytes.length!==s.bytes) throw new Error('Video upload size does not match. Select the video again.');
    const prepared=await prepareVideo(bytes);
    const files=[{id:s.poster_id,key:keys[0],bytes:posterBytes,mime:'image/webp'},{id:s.id,key:keys[1],bytes:prepared.bytes,mime:'video/mp4'}];
    for(const f of files) {
      if(process.env.SUPABASE_URL) {const {error}=await bucket().upload(f.key,f.bytes,{contentType:f.mime,upsert:false});if(error) throw new Error('Video storage unavailable.');}
      else if(process.env.NODE_ENV!=='production') {await mkdir(directory(),{recursive:true});await writeFile(path.join(directory(),f.key),f.bytes,{flag:'wx'});}
    }
    const result={url:`/api/assets/${s.id}`,poster:`/api/assets/${s.poster_id}`,kind:'video',width:prepared.width,height:prepared.height,duration:prepared.duration};
    await tx(async db=>{
      const lock=await one(db,"SELECT id FROM media_uploads WHERE id=$1 AND state='processing' AND result->>'attempt'=$2 FOR UPDATE",[s.id,lease]);
      if(!lock) throw new Error('Video processing was superseded. Retry shortly.');
      for(const f of files) await db.query('INSERT INTO assets(id,account_id,owner_token,path,bytes) VALUES($1,$2,$3,$4,$5)',[f.id,a?.id||null,owner,f.key,f.bytes.length]);
      await db.query("UPDATE media_uploads SET state='ready',result=$2,lease_until=NULL WHERE id=$1",[s.id,JSON.stringify(result)]);
    });
    await removeVideoKeys([sourceKey(s.id)]).catch(()=>{});
    return result;
  } catch(e) {
    // Delete only attempt-local objects that were never registered as assets.
    const published=await query('SELECT id FROM assets WHERE path=$1 OR path=$2',keys);
    if(!published.length) await removeVideoKeys(keys).catch(()=>{});
    await query("UPDATE media_uploads SET state='pending',lease_until=NULL WHERE id=$1 AND state='processing' AND result->>'attempt'=$2",[s.id,lease]);
    throw e;
  }
}
export async function cleanupVideos() {
  const expired=await query<Session>("SELECT * FROM media_uploads WHERE expires_at<now() AND (lease_until IS NULL OR lease_until<now()) AND state<>'expired' ORDER BY expires_at LIMIT 20");
  for(const s of expired) {
    await removeVideoKeys([sourceKey(s.id)]);
    if(s.state!=='ready' && typeof s.result?.attempt==='string') await removeVideoKeys([`${s.result.attempt}.mp4`,`${s.result.attempt}.webp`]);
    await query("UPDATE media_uploads SET state='expired' WHERE id=$1",[s.id]);
  }
}
