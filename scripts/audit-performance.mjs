import {chromium,expect} from "@playwright/test";
import {readFile,readdir,writeFile} from "node:fs/promises";
import {gzipSync} from "node:zlib";
import os from "node:os";
import path from "node:path";
const canonical="https://paper-audit.example", base="http://127.0.0.1:3002";
const browser=await chromium.launch({channel:"msedge",headless:true});
const report={date:new Date().toISOString(),cpu:os.cpus()[0].model,cores:os.cpus().length,browser:browser.version(),conditions:"Production build, headless Edge on Windows, DPR 1, medium quality, laptop GPU. HTTPS origin routed to local HTTP test server through Playwright; no deployed TLS or real phone. WebGL counters instrumented. Cold request bodies are decoded sizes, not WAN transfer times.",samples:[],checks:[]};
async function context(viewport) {
  const c=await browser.newContext({viewport,deviceScaleFactor:1});
  await c.route(`${canonical}/**`,async route=>{
    const response=await route.fetch({url:route.request().url().replace(canonical,base)});
    await route.fulfill({response});
  });
  await c.addInitScript(()=>{
    const stats={calls:0,triangles:0,textures:new Set(),buffers:new Set()};
    globalThis.__auditGL=stats;
    for(const type of [WebGLRenderingContext,WebGL2RenderingContext]) {
      for(const [name,instances] of [["drawElements",false],["drawArrays",false],["drawElementsInstanced",true],["drawArraysInstanced",true]]) {
        const original=type.prototype[name];if(!original)continue;
        type.prototype[name]=function(...args){stats.calls++;if(args[0]===4)stats.triangles+=(args[name.startsWith("drawElements")?1:2]/3)*(instances?args.at(-1):1);return original.apply(this,args);};
      }
      for(const [suffix,key] of [["Texture","textures"],["Buffer","buffers"]]) {
        const make=type.prototype[`create${suffix}`], remove=type.prototype[`delete${suffix}`];
        type.prototype[`create${suffix}`]=function(...args){const v=make.apply(this,args);stats[key].add(v);return v;};
        type.prototype[`delete${suffix}`]=function(v){stats[key].delete(v);return remove.call(this,v);};
      }
    }
  });
  return c;
}
try {
  for(const viewport of [{width:1440,height:960},{width:390,height:844}]) {
    const c=await context(viewport),page=await c.newPage(),bytes=[];
    page.on("response",r=>{if(r.url().includes("/_next/static/"))bytes.push(r.body().then(b=>({url:r.url().split("/_next/")[1],bytes:b.length})).catch(()=>null));});
    const start=Date.now();
    await page.goto(canonical);
    await expect(page.locator(".scene canvas")).toBeVisible({timeout:30000});
    await expect(page.locator(".scene-loading")).not.toBeVisible({timeout:30000});
    const ready=Date.now()-start;
    await page.getByRole("button",{name:"Dismiss introduction"}).click();
    await page.waitForTimeout(1500);
    const metrics=await page.evaluate(async()=>{
      const gl=document.querySelector(".scene canvas").getContext("webgl2");
      const ext=gl.getExtension("WEBGL_debug_renderer_info"),frames=[],calls=[],triangles=[];
      let last=performance.now(),start=last,previousCalls=globalThis.__auditGL.calls,previousTriangles=globalThis.__auditGL.triangles;
      await new Promise(resolve=>{function frame(now){frames.push(now-last);last=now;calls.push(globalThis.__auditGL.calls-previousCalls);triangles.push(globalThis.__auditGL.triangles-previousTriangles);previousCalls=globalThis.__auditGL.calls;previousTriangles=globalThis.__auditGL.triangles;if(now-start<8000)requestAnimationFrame(frame);else resolve();}requestAnimationFrame(frame);});
      frames.sort((a,b)=>a-b);calls.sort((a,b)=>a-b);triangles.sort((a,b)=>a-b);
      return {fps:1000/(frames.reduce((a,b)=>a+b,0)/frames.length),p95FrameMs:frames[Math.floor(frames.length*.95)],medianDrawCalls:calls[Math.floor(calls.length/2)],medianTriangles:triangles[Math.floor(triangles.length/2)],textures:globalThis.__auditGL.textures.size,buffers:globalThis.__auditGL.buffers.size,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):"unavailable",heap:performance.memory?.usedJSHeapSize};
    });
    await page.screenshot({path:`artifacts/audit/production-${viewport.width}-opening.png`});
    const initialStaticBodyBytes=(await Promise.all(bytes)).filter(Boolean).reduce((s,r)=>s+r.bytes,0);
    for(const [name,id] of [["central","tsq-003"],["steps","tsq-012"]]) {
      await page.goto(`${canonical}/?billboard=${id}`,{waitUntil:"networkidle"});
      await page.getByRole("button",{name:"Close panel",exact:true}).click();
      if(name==="steps") {await page.mouse.move(viewport.width*.42,viewport.height*.42);await page.mouse.down();await page.mouse.move(viewport.width*.42,viewport.height*.42+185,{steps:15});await page.mouse.up();}
      await page.waitForTimeout(1200);
      await page.screenshot({path:`artifacts/audit/production-${viewport.width}-${name}.png`});
    }
    const client=await c.newCDPSession(page);
    await client.send("HeapProfiler.collectGarbage");
    const before=await page.evaluate(()=>({heap:performance.memory?.usedJSHeapSize,textures:globalThis.__auditGL.textures.size,buffers:globalThis.__auditGL.buffers.size}));
    for(let i=0;i<20;i++){await page.getByRole("button",{name:/Get a billboard/}).click();await page.waitForTimeout(100);await page.getByRole("button",{name:"Close panel",exact:true}).click();}
    await client.send("HeapProfiler.collectGarbage");
    const after=await page.evaluate(()=>({heap:performance.memory?.usedJSHeapSize,textures:globalThis.__auditGL.textures.size,buffers:globalThis.__auditGL.buffers.size}));
    const resources=(await Promise.all(bytes)).filter(Boolean);
    report.samples.push({viewport,sceneReadyMs:ready,...metrics,twentyPanelCycles:{before,after},initialStaticBodyBytes,staticBodyBytesAcrossThreeNavigations:resources.reduce((s,r)=>s+r.bytes,0)});
    console.log(JSON.stringify(report.samples.at(-1)));
    await c.close();
  }
  const c=await context({width:1366,height:960}),page=await c.newPage();
  await page.goto(canonical,{waitUntil:"networkidle"});
  await expect(page.locator(".scene-loading")).not.toBeVisible();
  await page.evaluate(()=>document.querySelector(".scene canvas").getContext("webgl2").getExtension("WEBGL_lose_context").loseContext());
  await expect(page.getByRole("heading",{name:"Around the square"})).toBeVisible();
  await page.getByRole("button",{name:"Close panel",exact:true}).click();
  await page.getByRole("button",{name:"Quality and controls"}).click();
  await page.getByRole("button",{name:"Try 3D again"}).click();
  await expect(page.locator(".scene canvas")).toBeVisible();
  await expect(page.locator(".scene-loading")).not.toBeVisible();
  report.checks.push("Actual WEBGL_lose_context â†’ HTML directory â†’ Try 3D again â†’ new working canvas.");
  await page.evaluate(()=>{Object.defineProperty(document,"hidden",{configurable:true,get:()=>true});document.dispatchEvent(new Event("visibilitychange"));});
  await page.waitForTimeout(500);
  const stopped=await page.evaluate(()=>globalThis.__auditGL.calls);
  await page.waitForTimeout(1000);
  expect(await page.evaluate(()=>globalThis.__auditGL.calls)).toBe(stopped);
  await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event("visibilitychange"));});
  await page.waitForTimeout(500);
  expect(await page.evaluate(()=>globalThis.__auditGL.calls)).toBeGreaterThan(stopped);
  report.checks.push("Injected hidden-tab event stops WebGL draw calls; visibility restoration resumes them.");
  await c.close();
  const disabled=await context({width:390,height:844});
  await disabled.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/.test(type)?null:get.call(this,type,...args);};});
  const noGL=await disabled.newPage();await noGL.goto(canonical);
  await expect(noGL.getByRole("heading",{name:"Around the square"})).toBeVisible({timeout:30000});
  await noGL.locator(".placement-card").first().click();
  await expect(noGL.getByRole("button",{name:/Claim this billboard|Outbid this brand/})).toBeVisible();
  await noGL.screenshot({path:"artifacts/audit/production-no-webgl-390.png"});
  report.checks.push("WebGL unavailable at startup: directory and HTML buying controls remain functional.");
  await disabled.close();
  const timings=[];
  for(let batch=0;batch<4;batch++) await Promise.all(Array.from({length:6},async()=>{
    const start=performance.now(),r=await fetch(`${base}/api/public`);expect(r.ok).toBe(true);await r.arrayBuffer();timings.push(performance.now()-start);
  }));
  timings.sort((a,b)=>a-b);
  report.api={requests:24,concurrency:6,poolConnections:1,p50Ms:timings[12],p95Ms:timings[22],note:"Bounded local read-only check; not managed PostgreSQL load capacity."};
  async function files(dir){return (await Promise.all((await readdir(dir,{withFileTypes:true})).map(e=>e.isDirectory()?files(path.join(dir,e.name)):path.join(dir,e.name)))).flat();}
  const assets=(await files(".next/static")).filter(p=>/\.(js|css|woff2)$/.test(p));
  report.productionAssets={files:assets.length,gzipBytes:(await Promise.all(assets.map(async f=>gzipSync(await readFile(f)).length))).reduce((a,b)=>a+b,0)};
}catch(e){report.failure=String(e);console.error(String(e));process.exitCode=1;}
finally{await writeFile("artifacts/audit/production-performance.json",JSON.stringify(report,null,2));await browser.close();}
