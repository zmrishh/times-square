type Ticket={id:string;endpoint?:string;token?:string;bucket?:string;path?:string;localUrl?:string;uploaded?:boolean};
type Media={url:string;poster:string;kind:'video'};
const tickets=new WeakMap<File,Ticket>();
async function result<T>(r:Response):Promise<T> {const d=await r.json().catch(()=>({error:'Upload interrupted. Please retry.'}));if(!r.ok) throw new Error(d.error || 'Upload failed.');return d;}
export async function uploadVideo(file:File,poster:Blob,signal:AbortSignal,progress:(value:string)=>void):Promise<Media> {
  let ticket=tickets.get(file);
  if(!ticket) {
    ticket=await result<Ticket>(await fetch('/api/upload/init',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({bytes:file.size}),signal}));
    tickets.set(file,ticket);
  }
  if(!ticket.uploaded) {
    if(ticket.localUrl) {
      progress('Uploading video...');
      await result(await fetch(ticket.localUrl,{method:'POST',body:file,signal}));
    } else {
      const {Upload}=await import('tus-js-client');
      const t=ticket;
      await new Promise<void>((resolve,reject)=>{
        const stop=()=>{void upload.abort().catch(()=>{});reject(new DOMException('Upload cancelled','AbortError'));};
        const done=(error?:Error)=>{signal.removeEventListener('abort',stop);if(error)reject(new Error('Video upload interrupted. Retry to resume.'));else resolve();};
        const upload=new Upload(file,{
          endpoint:t.endpoint,headers:{'x-signature':t.token!,'x-upsert':'false'},
          chunkSize:6*1024*1024,retryDelays:[0,1000,3000,5000,10000],
          uploadDataDuringCreation:true,removeFingerprintOnSuccess:true,
          fingerprint:()=>Promise.resolve(`paper-video:${t.id}`),
          metadata:{bucketName:t.bucket!,objectName:t.path!,contentType:'video/mp4',cacheControl:'3600'},
          onProgress:(sent,total)=>progress(`Uploading video: ${Math.round(sent/total*100)}%`),
          onError:e=>done(e),onSuccess:()=>done(),
        });
        signal.addEventListener('abort',stop,{once:true});
        if(signal.aborted){stop();return;}
        void upload.findPreviousUploads().then(previous=>{
          if(signal.aborted)return;
          if(previous[0])upload.resumeFromPreviousUpload(previous[0]);
          upload.start();
        }).catch(()=>done(new Error('Unable to resume upload.')));
      });
    }
    ticket.uploaded=true;
  }
  progress('Checking video and preparing playback...');
  const form=new FormData();form.append('id',ticket.id);form.append('poster',poster,'poster.jpg');
  const media=await result<Media>(await fetch('/api/upload/complete',{method:'POST',body:form,signal:AbortSignal.any([signal,AbortSignal.timeout(115000)])}));
  tickets.delete(file);
  return media;
}
