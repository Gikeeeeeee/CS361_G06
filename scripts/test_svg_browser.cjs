// Live Chromium UI regression. Start the existing frontend at localhost:5173 first.
// Run: node scripts/test_svg_browser.cjs
// Requires installed Playwright Chromium, or BROWSER_EXECUTABLE for another Chromium.
// Uses CDP with normal browser security. No intercepted requests/responses, AWS writes,
// security bypasses, no-cors fetches, or cache-busting query strings.
// A fresh isolated profile and disabled HTTP cache are used. Gzip is diagnostic only;
// exit status is based on the DEFAULT browser encoding results, never the control.
﻿const fs = require('node:fs');
const cp = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'scratch', 'issue272-browser');
const browserRoot = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');
const browserDir = (fs.existsSync(browserRoot) ? fs.readdirSync(browserRoot) : []).filter(n => /^chromium-\d+$/.test(n)).sort((a,b) => Number(b.split('-')[1])-Number(a.split('-')[1]))[0];
const executable = process.env.BROWSER_EXECUTABLE || path.join(browserRoot, browserDir, 'chrome-win64', 'chrome.exe');
const envText = fs.readFileSync(path.join(root, 'frontend', '.env'), 'utf8');
const apiBase = envText.match(/^VITE_API_BASE_URL=(.+)$/m)?.[1].trim().replace(/\/$/, '');
if (!apiBase) throw new Error('VITE_API_BASE_URL is required in frontend/.env');
fs.mkdirSync(out,{recursive:true});
class CDP {
 constructor(ws) { this.ws=ws; this.id=0; this.pending=new Map(); this.events=[]; ws.addEventListener('message',e=>{let m=JSON.parse(e.data); if(m.id){let p=this.pending.get(m.id);this.pending.delete(m.id);if(m.error)p.reject(Error(JSON.stringify(m.error)));else p.resolve(m.result);}else {this.events.push(m);if(m.method==='Network.loadingFailed')console.log('FAIL',JSON.stringify(m.params));}}); }
 send(method,params={},sessionId){return new Promise((resolve,reject)=>{let id=++this.id;this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});}
 async evaluate(expression,s){let r=await this.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},s); if(r.exceptionDetails) return {exception:r.exceptionDetails}; return r.result.value;}
}
(async()=>{
 const browser=cp.spawn(executable,['--headless=new',...(process.argv.includes('--http1')?['--disable-http2']:[]),'--remote-debugging-port=0','--user-data-dir='+out+'/profile-'+Date.now(),'--no-first-run','--no-default-browser-check','about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
 let endpoint=await new Promise((resolve,reject)=>{let text='';browser.stderr.on('data',d=>{text+=d;let m=text.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(m)resolve(m[1]);});browser.on('error',reject);setTimeout(()=>reject(Error('browser launch timeout')),15000).unref();});
 const ws=new WebSocket(endpoint); await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve);ws.addEventListener('error',reject);}); const c=new CDP(ws);
 const version=await c.send('Browser.getVersion'); console.log('VERSION',version.product);
 const {targetId}=await c.send('Target.createTarget',{url:'about:blank'}); const {sessionId:s}=await c.send('Target.attachToTarget',{targetId,flatten:true});
 await c.send('Network.enable',{},s);await c.send('Page.enable',{},s);await c.send('Runtime.enable',{},s);
 await c.send('Page.navigate',{url:'http://localhost:5173'},s);
 await new Promise(r=>setTimeout(r,6000));
 console.log('PAGE',await c.evaluate('({url:location.href,title:document.title,sw:!!navigator.serviceWorker.controller})',s));

 await c.send('Emulation.setDeviceMetricsOverride',{width:1280,height:1400,deviceScaleFactor:1,mobile:false},s);
 await c.send('Network.setCacheDisabled',{cacheDisabled:true},s);
 const buildings=await c.evaluate(`fetch('${apiBase}/api/v1/buildings').then(r=>r.json()).then(d=>d.buildings.map(b=>({id:b.id,code:b.code})))`,s);
 console.log('BUILDINGS',buildings);

 const results=[];
 async function until(expression) {
  const deadline=Date.now()+20000;
  while(Date.now()<deadline) { if(await c.evaluate(expression,s)) return; await new Promise(r=>setTimeout(r,200)); }
  throw Error('UI did not settle: '+expression);
 }

 const modes = process.argv.includes('--normal-only') ? ['normal'] : ['normal','gzip-control'];
 for (const mode of modes) {
  if(mode==='gzip-control') await c.send('Network.setAcceptedEncodings',{encodings:['gzip']},s);
  for (const code of ['LC3','LC4']) {
   const building=buildings.find(b=>b.code===code);
   await c.send('Page.navigate',{url:'http://localhost:5173/buildings/'+building.id},s);
   await until(`location.pathname==='/buildings/${building.id}' && document.readyState==='complete' && Array.from(document.querySelectorAll('button')).some(b=>b.innerText==='Map View')`);
   await c.evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.innerText==='Map View')?.click()`,s);
   for(let floor=1;floor<=(code==='LC3'?2:3);floor++){
    await c.evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.innerText==='Floor ${floor}')?.click()`,s);
    await until(`document.body.innerText.includes('${code} - Floor ${floor}') && (document.querySelector('.svg-map-container svg') || document.body.innerText.includes('Failed to load floor plan'))`);
    const state=await c.evaluate(`({url:location.href,svgCount:document.querySelectorAll('.svg-map-container svg').length,roomCount:document.querySelectorAll('.svg-map-container [id^="room-"]').length,error:document.body.innerText.includes('Failed to load floor plan')})`,s);
    results.push({mode,code,floor,...state});console.log('UI_RESULT',JSON.stringify(results.at(-1)));
    const shot=await c.send('Page.captureScreenshot',{format:'png'},s);fs.writeFileSync(out+'/'+mode+'-'+code+'-'+floor+'.png',Buffer.from(shot.data,'base64'));
   }
  }
 }
 console.log('RESULTS',JSON.stringify(results));

 const svgIds=new Set(c.events.filter(e=>e.method==='Network.requestWillBeSent' && e.params.request.url.includes('/floor-plan/')).map(e=>e.params.requestId));
 const events=c.events.filter(e=>svgIds.has(e.params?.requestId));
 fs.writeFileSync(out+'/ui-matrix.json',JSON.stringify({version,results,events},null,2));
 const failures=results.filter(r=>r.mode==='normal' && (r.svgCount!==1 || r.error));
 console.log('DEFAULT_BROWSER_RESULT', (5-failures.length)+'/5');
 if(failures.length) process.exitCode=1;

 const screenshot=await c.send('Page.captureScreenshot',{format:'png'},s);fs.writeFileSync(out+'/initial.png',Buffer.from(screenshot.data,'base64'));
 await c.send('Browser.close');ws.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
