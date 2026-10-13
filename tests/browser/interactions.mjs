// Real-browser interaction checks (Chromium via Playwright). Usage: node tests/browser/interactions.mjs http://localhost:8080 [shots-dir]
// Exits non-zero on any failure. Requires `playwright` installed separately (not a project dependency).
import {chromium} from 'playwright';
import {execFileSync} from 'node:child_process';
const base=process.argv[2]||'http://localhost:8080',shots=process.argv[3]||'ix';
import {mkdirSync,readFileSync} from 'node:fs';mkdirSync(shots,{recursive:true});
const results=[];const ok=(name,cond,info='')=>{results.push([cond?'PASS':'FAIL',name,info]);};
const browser=await chromium.launch();
async function ctxFor(w){return browser.newContext({viewport:{width:w,height:w<700?844:900},isMobile:w<700,hasTouch:w<700,acceptDownloads:true,permissions:['clipboard-read','clipboard-write']});}
const errs=[];const watch=p=>{p.on('pageerror',e=>errs.push(p.url()+' '+e.message));p.on('console',m=>{if(m.type()==='error')errs.push(p.url()+' '+m.text());});};

// 1. Mobile menu
{const c=await ctxFor(390),p=await c.newPage();watch(p);await p.goto(base+'/');
 const t=p.locator('.menu-toggle');await t.click();ok('menu opens',await p.locator('#mobile-nav').isVisible());
 ok('menu aria-expanded',await t.getAttribute('aria-expanded')==='true');
 ok('body locked when open',await p.evaluate(()=>document.body.classList.contains('locked')&&getComputedStyle(document.body).overflow==='hidden'),await p.evaluate(()=>getComputedStyle(document.body).overflow));
 ok('focus moves into menu',await p.evaluate(()=>document.activeElement.closest('#mobile-nav')!==null));
 await p.screenshot({path:shots+'/menu-open-390.png'});
 const navBox=await p.locator('#mobile-nav').boundingBox();ok('menu fits viewport',navBox&&navBox.width<=390,JSON.stringify(navBox));
 await p.keyboard.press('Escape');ok('Escape closes menu',!(await p.locator('#mobile-nav').isVisible()));
 ok('focus returns to toggle',await p.evaluate(()=>document.activeElement.classList.contains('menu-toggle')));
 await t.click();await p.locator('#mobile-nav a').nth(1).click();await p.waitForURL('**/projects/');ok('menu link navigates',p.url().endsWith('/projects/'));
 // 2. Filter
 for(const [cat,n] of [['مجالس',1],['فلل',1],['صالات',1],['ديكورات جدارية',1],['الكل',4]]){await p.locator(`[data-filter="${cat}"]`).click();const vis=await p.locator('#projects-grid .project-card:visible').count();ok('filter '+cat,vis===n,'visible='+vis+' count='+await p.locator('#filter-count').textContent());}
 await p.locator('[data-filter="مجالس"]').click();await p.screenshot({path:shots+'/filter-majlis-390.png'});
 await c.close();}

// 3. Materials tabs + comparison (desktop)
{const c=await ctxFor(1440),p=await c.newPage();watch(p);await p.goto(base+'/');
 await p.locator('#tab-wood').click();ok('material tab click',(await p.locator('#material-description').textContent()).includes('ملمس دافئ'));
 await p.keyboard.press('ArrowLeft');ok('material ArrowLeft → next (RTL)',await p.evaluate(()=>document.activeElement.id)==='tab-textile');
 await p.keyboard.press('End');ok('material End',await p.evaluate(()=>document.activeElement.id)==='tab-light');
 const cmp=p.locator('.comparison');await cmp.scrollIntoViewIfNeeded();const box=await cmp.boundingBox();
 await p.locator('#compare-range').focus();for(let i=0;i<10;i++)await p.keyboard.press('ArrowRight');
 const v1=await p.locator('#compare-range').inputValue();ok('compare keyboard changes value',v1!=='50','value='+v1);
 // drag with mouse at 25% from left
 await p.mouse.move(box.x+box.width/2,box.y+box.height/2);await p.mouse.down();await p.mouse.move(box.x+box.width*0.2,box.y+box.height/2,{steps:8});await p.mouse.up();
 const v2=await p.locator('#compare-range').inputValue(),split=await cmp.evaluate(e=>e.style.getPropertyValue('--split'));
 const line=await p.locator('.compare-line').boundingBox();
 ok('compare drag updates split',split===v2+'%','value='+v2+' split='+split);
 ok('compare line follows pointer',line&&Math.abs((line.x+line.width/2)-(box.x+box.width*0.2))<box.width*0.06,'lineX='+(line&&Math.round(line.x+line.width/2))+' pointer='+Math.round(box.x+box.width*0.2));
 await cmp.screenshot({path:shots+'/compare-1440.png'});
 await c.close();}

// 3b. comparison touch on mobile
{const c=await ctxFor(390),p=await c.newPage();watch(p);await p.goto(base+'/');const cmp=p.locator('.comparison');await cmp.scrollIntoViewIfNeeded();const box=await cmp.boundingBox();
 await p.touchscreen.tap(box.x+box.width*0.8,box.y+box.height/2);await p.waitForTimeout(200);const v=await p.locator('#compare-range').inputValue();
 ok('compare responds to tap on mobile',v!=='50','value='+v);
 const line=await p.locator('.compare-line').boundingBox();ok('compare line at tap (mobile)',line&&Math.abs((line.x+line.width/2)-(box.x+box.width*0.8))<box.width*0.08,'lineX='+(line&&Math.round(line.x+line.width/2))+' tap='+Math.round(box.x+box.width*0.8));
 await cmp.screenshot({path:shots+'/compare-390.png'});await c.close();}

// 4. Gallery dialog
for(const w of [390,1440]){const c=await ctxFor(w),p=await c.newPage();watch(p);await p.goto(base+'/projects/quiet-majlis/');
 const opener=p.locator('[data-gallery-index="1"]');await opener.click();const d=p.locator('#gallery-dialog');
 ok(w+' dialog opens',await d.evaluate(e=>e.open));ok(w+' dialog counter',(await p.locator('#gallery-counter').textContent())==='2 / 3');
 ok(w+' counter reads left-to-right',await p.locator('#gallery-counter').getAttribute('dir')==='ltr');
 ok(w+' crop zooms toward its own side',await p.locator('#gallery-large').evaluate(i=>getComputedStyle(i).transformOrigin.startsWith(i.getBoundingClientRect().width+'px')||i.style.transformOrigin.startsWith('right')),await p.locator('#gallery-large').evaluate(i=>i.style.transformOrigin));
 await p.waitForTimeout(500);await p.screenshot({path:shots+`/dialog-${w}.png`});
 const db=await d.boundingBox();ok(w+' dialog within viewport',db&&db.x>=0&&db.x+db.width<=w&&db.height<=(w<700?844:900),JSON.stringify(db));
 await p.locator('[data-gallery-next]').click();await p.locator('[data-gallery-next]').click();ok(w+' next wraps',(await p.locator('#gallery-counter').textContent())==='1 / 3');
 await p.keyboard.press('ArrowRight');ok(w+' ArrowRight = previous (RTL)',(await p.locator('#gallery-counter').textContent())==='3 / 3');
 if(w<700){const ib=await p.locator('.dialog-image-wrap').boundingBox();const cdp=await c.newCDPSession(p);const y=ib.y+ib.height/2;const pts=[0.8,0.65,0.5,0.35,0.2].map(f=>ib.x+ib.width*f);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:pts[0],y}]});for(const x of pts.slice(1)){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y}]});await p.waitForTimeout(16);}await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(200);
 ok('touch swipe changes image',(await p.locator('#gallery-counter').textContent())!=='3 / 3',await p.locator('#gallery-counter').textContent());}
 await p.keyboard.press('Escape');ok(w+' Esc closes dialog',!(await d.evaluate(e=>e.open)));
 ok(w+' scroll unlocked',!(await p.evaluate(()=>document.body.classList.contains('locked'))));
 ok(w+' focus returned to opener',await p.evaluate(()=>document.activeElement?.dataset?.galleryIndex==='1'));
 // backdrop click
 await opener.click();await p.mouse.click(3,3);ok(w+' backdrop click closes',!(await d.evaluate(e=>e.open)));
 await c.close();}

// 5. Quote wizard (mobile full flow)
{const c=await ctxFor(390),p=await c.newPage();watch(p);await p.goto(base+'/quote/?service=majlis');
 ok('service preset from URL',await p.locator('#service').inputValue()==='majlis');
 await p.locator('#service').selectOption('');await p.locator('#quote-next').click();
 ok('empty step shows errors',await p.locator('#quote-errors').isVisible()&&(await p.locator('#error-service').textContent()).length>0);
 await p.screenshot({path:shots+'/quote-errors-390.png',fullPage:false});
 await p.locator('#service').selectOption('majlis');await p.locator('label.choice',{hasText:'مجلس'}).click();await p.locator('#city').fill('أبها');
 await p.locator('#quote-next').click();ok('step 2 reached',(await p.locator('#quote-status').textContent()).includes('2'));
 const hb=await p.locator('#quote-fields h2').boundingBox(),hdr=await p.locator('header.header').boundingBox();ok('step heading not hidden under sticky header',hb.y>=hdr.y+hdr.height-1,'h2.y='+Math.round(hb.y)+' header bottom='+Math.round(hdr.y+hdr.height));
 await p.locator('#area').fill('١٢٠');await p.locator('#description').fill('أرغب بتجهيز مجلس رجال مع إضاءة مخفية وجلسات أرضية.');
 await p.locator('#files').setInputFiles([{name:'tool.exe',mimeType:'application/x-msdownload',buffer:Buffer.from('MZ')}]);ok('rejects bad file type',(await p.locator('#error-files').textContent()).length>0);
 await p.locator('#files').setInputFiles([{name:'صورة-المجلس.jpg',mimeType:'image/jpeg',buffer:Buffer.from([0xff,0xd8,0xff,0xe0,0,16,0x4a,0x46,0x49,0x46,0,1,0xff,0xd9])},{name:'plan.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\n%%EOF\n')}]);ok('accepts 2 files',await p.locator('#file-list li').count()===2);
 await p.screenshot({path:shots+'/quote-step2-390.png',fullPage:true});
 await p.locator('#quote-next').click();
 await p.locator('#name').fill('يوسف');await p.locator('#phone').fill('0512');await p.locator('#quote-next').click();
 ok('invalid phone rejected',(await p.locator('#error-phone').textContent()).length>0);ok('consent required',(await p.locator('#error-consent').textContent()).length>0);
 await p.locator('#phone').fill('٠٥١٢٣٤٥٦٧٨');await p.locator('#consent').check();
 await p.locator('#quote-prev').click();ok('back keeps step-2 data',await p.locator('#area').inputValue()==='١٢٠'&&await p.locator('#file-list li').count()===2);
 await p.locator('#quote-next').click();ok('forward keeps step-3 data',await p.locator('#name').inputValue()==='يوسف'&&await p.locator('#consent').isChecked());
 await p.locator('#quote-next').click();ok('review step',(await p.locator('.review').textContent()).includes('المجالس السعودية'));
 await p.screenshot({path:shots+'/quote-review-390.png',fullPage:true});
 await p.locator('#quote-next').click();ok('output shown',await p.locator('#quote-output').isVisible());
 await p.waitForTimeout(900);const oh=await p.locator('#quote-output h2').boundingBox(),hh=await p.locator('header.header').boundingBox();ok('output heading visible below sticky header',oh.y>=hh.y+hh.height&&oh.y<600,'h2.y='+Math.round(oh.y));ok('focus on output heading',await p.evaluate(()=>document.activeElement.matches('#quote-output h2')));
 const text=await p.locator('#request-text').inputValue();ok('output text has data',text.includes('أبها')&&text.includes('120')&&text.includes('0512345678')&&text.includes('plan.pdf'));
 ok('whatsapp hidden (not configured)',!(await p.locator('#whatsapp-request').isVisible()));
 await p.locator('#copy-request').click();await p.waitForTimeout(300);const clip=await p.evaluate(()=>navigator.clipboard.readText());ok('copy to clipboard',clip===text,(await p.locator('#quote-action-status').textContent()));
 const [dl]=await Promise.all([p.waitForEvent('download'),p.locator('#download-request').click()]);await p.waitForTimeout(300);ok('focus returns to download button',await p.evaluate(()=>document.activeElement.id==='download-request'));const path=shots+'/quote.zip';await dl.saveAs(path);
 let zipInfo='';try{zipInfo=execFileSync('python3',['-I','-c','import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);print(z.testzip());print([(i.filename,i.file_size,i.date_time) for i in z.infolist()]);print(z.read("request.txt").decode()[:40])',path]).toString();}catch(e){zipInfo='ERR '+e.message;}
 ok('ZIP valid with 3 entries',zipInfo.startsWith('None')&&zipInfo.includes('plan.pdf')&&zipInfo.includes('صورة-المجلس.jpg'),zipInfo.replace(/\n/g,' | '));
 await p.screenshot({path:shots+'/quote-output-390.png',fullPage:true});
 await p.locator('#clear-request').click();ok('clear resets to step 1',(await p.locator('#quote-status').textContent()).includes('1')&&await p.locator('#service').inputValue()==='');
 await c.close();}

// 6. 404 status
{const c=await ctxFor(1440),p=await c.newPage();const r=await p.goto(base+'/nope/');ok('404 status + page',r.status()===404&&(await p.locator('h1').textContent()).includes('لنعد'));await c.close();}

// 7. Keyboard: skip link + focus visibility
{const c=await ctxFor(1440),p=await c.newPage();await p.goto(base+'/');await p.keyboard.press('Tab');const s=await p.evaluate(()=>{const a=document.activeElement;const b=a.getBoundingClientRect();return {cls:a.className,vis:b.top>=0&&b.height>0,outline:getComputedStyle(a).outlineStyle}});ok('skip link is first & visible on focus',s.cls==='skip'&&s.vis,JSON.stringify(s));
 await p.keyboard.press('Tab');const f=await p.evaluate(()=>{const a=document.activeElement,cs=getComputedStyle(a);return cs.outlineStyle+' '+cs.outlineWidth+' '+cs.boxShadow});ok('focus ring visible on brand link',!f.startsWith('none 0px none'),f);await c.close();}

await browser.close();
for(const r of results)console.log(r.join(' | '));
console.log('JS errors:',errs.length?errs:'none');
console.log(results.filter(r=>r[0]==='PASS').length+'/'+results.length+' passed');
if(errs.length||results.some(r=>r[0]==='FAIL'))process.exitCode=1;
