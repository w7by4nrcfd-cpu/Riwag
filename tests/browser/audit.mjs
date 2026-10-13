// Visual + runtime audit across all routes at 320–1920px in real Chromium: horizontal overflow, console/JS errors,
// failed requests, broken images, unrendered placeholders. Saves full-page screenshots at 390 and 1440px.
// Usage: node tests/browser/audit.mjs http://localhost:8080 shots docs/routes.json
import {chromium} from 'playwright';
import {readFile,mkdir} from 'node:fs/promises';
const base=process.argv[2]||'http://localhost:8080', out=process.argv[3]||'shots', routesFile=process.argv[4];
await mkdir(out,{recursive:true});
const routes=JSON.parse(await readFile(routesFile,'utf8')).map(r=>r.path).concat(['/no-such-page/']);
const widths=[320,390,768,1024,1440,1920];const shotWidths=new Set([390,1440]);
const browser=await chromium.launch();const report=[];
for(const w of widths){const ctx=await browser.newContext({viewport:{width:w,height:w<700?844:900},deviceScaleFactor:1,isMobile:w<700,hasTouch:w<700});
 for(const r of routes){const page=await ctx.newPage();const issues=[];
  page.on('console',m=>{if(['error','warning'].includes(m.type())&&!(r==='/no-such-page/'&&m.text().includes('404')))issues.push('console.'+m.type()+': '+m.text());});
  page.on('pageerror',e=>issues.push('pageerror: '+e.message));
  page.on('requestfailed',q=>issues.push('requestfailed: '+q.url()));
  page.on('response',s=>{if(s.status()>=400&&!s.url().endsWith('/no-such-page/'))issues.push('HTTP '+s.status()+' '+s.url());});
  await page.goto(base+r,{waitUntil:'networkidle'});
  // scroll through to trigger lazy images and reveal animations
  await page.evaluate(async()=>{for(let y=0;y<document.body.scrollHeight;y+=400){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,30));}window.scrollTo(0,0);});
  await page.evaluate(async()=>{for(const i of document.images){i.loading='eager';}await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));});await page.waitForTimeout(2600);await page.waitForLoadState('networkidle');
  const m=await page.evaluate(()=>{const vw=document.documentElement.clientWidth;const over=[];for(const el of document.querySelectorAll('body *')){const b=el.getBoundingClientRect();if(b.width&&(b.right>vw+1||b.left<-1)){let p=el.parentElement,clipped=false;while(p){const s=getComputedStyle(p);if(['hidden','clip','auto','scroll'].includes(s.overflowX)&&p!==document.body&&p!==document.documentElement){clipped=true;break;}p=p.parentElement;}if(!clipped&&getComputedStyle(el).position!=='fixed')over.push(el.tagName.toLowerCase()+'.'+[...el.classList].join('.')+' ['+Math.round(b.left)+','+Math.round(b.right)+']');}}
   const broken=[...document.images].filter(i=>i.complete&&i.naturalWidth===0&&i.src).map(i=>i.src);
   const tiny=[...document.querySelectorAll('a,button,input,select,summary')].filter(e=>{const b=e.getBoundingClientRect();return b.width>0&&b.height>0&&(b.height<24||b.width<24)&&getComputedStyle(e).visibility!=='hidden';}).map(e=>(e.tagName+':'+(e.textContent||e.getAttribute('aria-label')||'').trim().slice(0,20)+' '+Math.round(e.getBoundingClientRect().width)+'x'+Math.round(e.getBoundingClientRect().height)));
   const hidden=[...document.querySelectorAll('.reveal')].filter(e=>getComputedStyle(e).opacity<0.5).length;
   return {sw:document.documentElement.scrollWidth,vw,over:over.slice(0,8),broken,tiny:tiny.slice(0,10),hiddenReveal:hidden,literal:document.body.innerText.includes('${')};});
  if(m.sw>m.vw)issues.push('HORIZONTAL SCROLL '+m.sw+'>'+m.vw);
  if(m.over.length)issues.push('overflowing: '+m.over.join(' | '));
  if(m.broken.length)issues.push('broken img: '+m.broken.join(','));
  if(m.hiddenReveal)issues.push('reveal still hidden: '+m.hiddenReveal);
  if(m.literal)issues.push('literal ${ in text');
  if(w===390&&m.tiny.length)issues.push('small targets: '+m.tiny.join(' | '));
  if(shotWidths.has(w)){const name=(r==='/'?'home':r.replace(/^\/|\/$/g,'').replace(/\//g,'_'))+'-'+w+'.png';await page.screenshot({path:out+'/'+name,fullPage:true});}
  report.push({w,r,issues});await page.close();}
 await ctx.close();}
await browser.close();
for(const x of report)if(x.issues.length)console.log(x.w,x.r,'\n  '+[...new Set(x.issues)].join('\n  '));
console.log('checked',report.length,'page-views;',report.filter(x=>x.issues.length).length,'with issues');
