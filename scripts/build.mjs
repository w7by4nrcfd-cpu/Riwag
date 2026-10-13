import {mkdir,writeFile,copyFile,readFile,rm,cp,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {site,projects,services} from '../src/config.js';
import {layout,home,projectsPage,projectPage,servicesPage,servicePage,aboutPage,quotePage,contactPage,privacyPage,notFoundPage} from '../src/views.js';

const root=resolve(import.meta.dirname,'..'),dist=resolve(root,process.env.OUT_DIR||'dist');

// Client preview: CLIENT=<folder in clients/> npm run build — swaps name, colors, logo and contact details.
const clientId=(process.env.CLIENT||'').trim();
let clientLogo=null;
if(clientId){
 if(!/^[a-z0-9-]+$/.test(clientId))throw new Error('CLIENT must be a folder name like al-itqan');
 const dir=resolve(root,'clients',clientId),c=JSON.parse(await readFile(resolve(dir,'client.json'),'utf8'));
 for(const key of ['name','englishName','descriptor','title','description','serviceAreas','social'])if(c[key]!==undefined)site[key]=c[key];
 site.theme={...site.theme,...(c.theme||{})};site.contact={...site.contact,...(c.contact||{})};
 if(c.contact?.whatsapp&&!/^9665\d{8}$/.test(c.contact.whatsapp))throw new Error('client whatsapp must look like 9665XXXXXXXX');
 for(const key of ['charcoal','ivory','sand','bronze','stone'])if(!/^#[0-9a-f]{6}$/i.test(site.theme[key]))throw new Error('theme.'+key+' must be a #rrggbb color');
 const logo=(await readdir(dir)).find(f=>/^logo\.(svg|png|webp|jpg)$/i.test(f));
 if(logo){clientLogo=[resolve(dir,logo),'client-'+logo.toLowerCase()];site.logo='/assets/'+clientLogo[1];}
 site.title=c.title||site.name+' — '+(site.descriptor||'');
 site.clientPreview=true;
}

// Final domain can be injected at build time without editing config.js (which is also shipped to the browser).
if(process.env.SITE_ORIGIN!==undefined)site.origin=process.env.SITE_ORIGIN.trim().replace(/\/+$/,'');
if(site.origin&&!/^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(site.origin))throw new Error('SITE_ORIGIN/site.origin must look like https://example.com — got: '+site.origin);

// Optional sub-path hosting (e.g. GitHub Pages project site): BASE_PATH=/Riwag npm run build
const base=(process.env.BASE_PATH||'').trim().replace(/\/+$/,'');
if(base&&!/^\/[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/.test(base))throw new Error('BASE_PATH must look like /Riwag — got: '+base);
site.base=base;
const withBase=html=>base?html.replace(/\b(href|src|srcset)="\/(?!\/)/g,'$1="'+base+'/').replace(/, \/assets\//g,', '+base+'/assets/'):html;

// Clean build: dist is generated output only. Static binaries (images, fonts) live in public/.
await rm(dist,{recursive:true,force:true});
await cp(resolve(root,'public'),dist,{recursive:true});
await mkdir(resolve(dist,'assets'),{recursive:true});

const routes=[
 {path:'/',title:'مساحات تُشبهك',body:home()},
 {path:'/about/',title:'فلسفتنا',image:'villa',body:aboutPage()},
 {path:'/projects/',title:'التصورات التصميمية',body:projectsPage()},
 {path:'/services/',title:'خدمات التصميم والتشطيبات',body:servicesPage()},
 {path:'/quote/',title:'طلب عرض سعر',body:quotePage()},
 {path:'/contact/',title:'تواصل معنا',image:'lounge',body:contactPage()},
 {path:'/privacy/',title:'الخصوصية وآلية الطلب',body:privacyPage()},
 ...projects.map(p=>({path:'/projects/'+p.id+'/',title:p.name,description:p.subtitle+' — تصور تصميمي توضيحي مولد.',image:p.image,body:projectPage(p)})),
 ...services.map(s=>({path:'/services/'+s.id+'/',title:s.name,description:s.intro,image:s.image,body:servicePage(s)})),
];
for(const route of routes){const dir=resolve(dist,'.'+route.path);await mkdir(dir,{recursive:true});await writeFile(resolve(dir,'index.html'),withBase(layout(route)));}
await writeFile(resolve(dist,'404.html'),withBase(layout({path:'/404.html',title:'صفحة غير موجودة',body:notFoundPage()})));

for(const file of ['app.js','config.js','quote-core.js','styles.css','fonts.css'])await copyFile(resolve(root,'src',file),resolve(dist,'assets',file));
if(clientId){
 // The browser reads site from config.js (name in the request text, WhatsApp number, cities): ship the client's values too.
 const {clientPreview,base:_b,...browserSite}=site;
 await writeFile(resolve(dist,'assets/config.js'),(await readFile(resolve(root,'src/config.js'),'utf8'))+'\n// Client preview overrides (generated)\nObject.assign(site,'+JSON.stringify(browserSite)+');\n');
 if(clientLogo)await copyFile(clientLogo[0],resolve(dist,'assets',clientLogo[1]));
}
await writeFile(resolve(dist,'assets/favicon.svg'),`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${site.theme.charcoal}"/><path d="M15 52V25a17 17 0 0 1 34 0v27M23 52V26a9 9 0 0 1 18 0v26M11 52h42" fill="none" stroke="${site.theme.ivory}" stroke-width="2"/></svg>`);

// Demo mode blocks indexing. A sitemap needs absolute URLs, so it is only written once the real origin is known.
const indexable=!site.demo&&site.origin&&!base;
await writeFile(resolve(dist,'robots.txt'),indexable?'User-agent: *\nAllow: /\nSitemap: '+site.origin+'/sitemap.xml\n':'User-agent: *\nDisallow: /\n');
if(site.origin)await writeFile(resolve(dist,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+routes.map(r=>'<url><loc>'+site.origin+base+r.path+'</loc></url>').join('')+'</urlset>');

// Security headers for hosts that read a _headers file (Cloudflare Pages, Netlify).
await writeFile(resolve(dist,'_headers'),[
 '/*',
 '  X-Content-Type-Options: nosniff',
 '  Referrer-Policy: strict-origin-when-cross-origin',
 '  Permissions-Policy: camera=(), microphone=(), geolocation=()',
 site.demo?'  X-Robots-Tag: noindex, nofollow':null,
 "  Content-Security-Policy: default-src 'self'; img-src 'self' data: blob:; font-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'",
 '/assets/*',
 '  Cache-Control: public, max-age=3600',
 '',
].filter(l=>l!==null).join('\n'));

if(!clientId)await writeFile(resolve(root,'docs/routes.json'),JSON.stringify(routes.map(r=>({path:r.path,title:r.title})),null,2));
console.log('Built '+routes.length+' complete pages + custom 404'+(clientId?' for client '+clientId:'')+(base?' under '+base:'')+(site.origin?' for '+site.origin:' (no origin set: canonical/sitemap omitted)')+'.');
