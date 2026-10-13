// Lab performance snapshot in Chromium with mobile throttling (approx. "Slow 4G" + 4x CPU). Not field Core Web Vitals.
// Usage: node tests/browser/perf.mjs http://localhost:8080
import {chromium} from 'playwright';
const base=process.argv[2]||'http://localhost:8080';const routes=['/','/projects/','/projects/quiet-majlis/','/quote/'];
const browser=await chromium.launch();
for(const [label,w] of [['mobile',390],['desktop',1440]])for(const r of routes){
 const ctx=await browser.newContext({viewport:{width:w,height:w<700?844:900},isMobile:w<700,hasTouch:w<700,deviceScaleFactor:w<700?3:1});const p=await ctx.newPage();
 const cdp=await ctx.newCDPSession(p);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 if(w<700){await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:1.6*1024*1024/8,uploadThroughput:750*1024/8});await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});}
 let bytes=0;cdp.on('Network.loadingFinished',e=>bytes+=e.encodedDataLength);
 await p.addInitScript(()=>{window.__lcp=0;window.__cls=0;new PerformanceObserver(l=>{for(const e of l.getEntries())window.__lcp=e.startTime;}).observe({type:'largest-contentful-paint',buffered:true});new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)window.__cls+=e.value;}).observe({type:'layout-shift',buffered:true});});
 await p.goto(base+r,{waitUntil:'load'});await p.waitForTimeout(1500);
 const m=await p.evaluate(()=>({lcp:Math.round(window.__lcp),cls:+window.__cls.toFixed(3),fcp:Math.round(performance.getEntriesByName('first-contentful-paint')[0]?.startTime||0),load:Math.round(performance.getEntriesByType('navigation')[0].loadEventEnd)}));
 console.log(label.padEnd(8),r.padEnd(24),'FCP',m.fcp,'ms  LCP',m.lcp,'ms  CLS',m.cls,' load',m.load,'ms  transferred',Math.round(bytes/1024),'KB');
 await ctx.close();}
await browser.close();
