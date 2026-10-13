// Local static server that mimics Cloudflare Pages: pretty URLs, 404.html and _headers. Usage: npm run serve [-- dist 8080]
import http from 'node:http';import {readFile,stat} from 'node:fs/promises';import {join,extname} from 'node:path';
const root=process.argv[2]||'dist',port=+process.argv[3]||8080;
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.webp':'image/webp','.svg':'image/svg+xml','.ttf':'font/ttf','.woff2':'font/woff2','.xml':'application/xml','.txt':'text/plain','.png':'image/png'};
const rules=[];try{let cur;for(const line of (await readFile(join(root,'_headers'),'utf8')).split('\n')){if(!line.trim())continue;if(!/^\s/.test(line)){cur={pat:line.trim(),h:[]};rules.push(cur);}else{const i=line.indexOf(':');cur.h.push([line.slice(0,i).trim(),line.slice(i+1).trim()]);}}}catch{}
http.createServer(async(req,res)=>{let p=decodeURIComponent(new URL(req.url,'http://x').pathname);let f=join(root,p);let status=200;
 try{let s=await stat(f);if(s.isDirectory()){f=join(f,'index.html');await stat(f);}}catch{f=join(root,'404.html');status=404;}
 for(const r of rules){const re=new RegExp('^'+r.pat.replace(/\*/g,'.*')+'$');if(re.test(p))for(const[k,v]of r.h)res.setHeader(k,v);}
 res.setHeader('Content-Type',types[extname(f)]||'application/octet-stream');res.writeHead(status);res.end(await readFile(f));
}).listen(port,()=>console.log('serving',root,port));
