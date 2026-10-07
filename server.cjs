const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = __dirname;
const localShots = path.resolve(root,'../shots');
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.md':'text/plain; charset=utf-8','.svg':'image/svg+xml','.mp4':'video/mp4','.xml':'application/xml; charset=utf-8'};
http.createServer((req,res) => {
  let requested;
  try { requested = decodeURIComponent(new URL(req.url,'http://localhost').pathname); } catch { res.writeHead(400); res.end(); return; }
  if (requested === '/local-library.json') {
    const recordPath = path.join(localShots,'M001-paper-fan','镜头档案.json');
    let entries=[];
    try {
      const record=JSON.parse(fs.readFileSync(recordPath,'utf8'));
      const policy=JSON.parse(fs.readFileSync(path.join(root,'assets/publication-policy.json'),'utf8'));
      const base='/local-shots/M001-paper-fan/';
      const notes=(record.phases||[]).map(phase=>`${phase.start}–${phase.end}s / ${phase.title}\n观察：${phase.observation}\n复用：${phase.method}`).join('\n\n');
      entries.push({id:'local-archive-M001',kind:'note',title:'M001 · 案例纸卡扇形展开',tags:['视频拆解','纸卡','错峰入场'],description:notes,file:base+'reference.mp4',fileName:'M001-本地参考.mp4',thumbnail:base+'poster.jpg',source:'http://127.0.0.1:5198'+base+'拆解网页.html',local:false,localOnly:true});
      for(const [directory,label] of [['reusable-personal','原纸卡版'],['reusable-personal-v2','真实照片版']]) {
        const version=directory==='reusable-personal'?'v1':'v2';
        if((policy.excludedVersions?.M001||[]).includes(version) || (policy.selectedVersions?.M001 && policy.selectedVersions.M001!==version)) continue;
        const reusable=path.join(localShots,'M001-paper-fan',directory);
        if(!fs.existsSync(reusable)) continue;
        for(const name of fs.readdirSync(reusable)) {
          if(path.extname(name).toLowerCase()!=='.mp4') continue;
          const file=path.join(reusable,name);
          const stat=fs.statSync(file);
          if(!stat.isFile() || !stat.size) continue;
          const thumbnail=fs.existsSync(path.join(reusable,'poster.jpg'))?base+directory+'/poster.jpg':undefined;
          entries.push({id:'local-motion-M001-'+(directory==='reusable-personal'?'':directory+'-')+name,kind:'motion',title:'M001 · '+label,tags:['个人开场',label,'自制动效'],description:'本地制作的个人开场动效。完成状态与具体参数以同目录交付说明为准。',file:base+directory+'/'+encodeURIComponent(name),fileName:name,thumbnail,created:stat.mtime.toISOString(),sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),source:'',local:false,localOnly:true});
        }
      }
    } catch { /* Local reference is optional and is never part of the public repository. */ }
    const body=JSON.stringify(entries);res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Content-Length':Buffer.byteLength(body),'Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:body);return;
  }
  const mounted=requested.startsWith('/local-shots/');
  const allowedRoot=mounted?localShots:root;
  const safePath=mounted?requested.slice('/local-shots'.length):requested;
  const file = path.resolve(allowedRoot, '.' + (safePath.endsWith('/') ? safePath + 'index.html' : safePath));
  if (!file.startsWith(allowedRoot + path.sep) || requested.split('/').some(part => part.startsWith('.'))) { res.writeHead(403); res.end(); return; }
  fs.stat(file,(error,stat) => {
    if(error || !stat.isFile()) { res.writeHead(404); res.end('Not found'); return; }
    const headers = {'Content-Type':mime[path.extname(file)] || 'application/octet-stream','Accept-Ranges':'bytes','Cache-Control':'no-cache'};
    let start=0,end=stat.size-1,status=200;
    if(req.headers.range){
      const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if(!match || (!match[1] && !match[2])) { res.writeHead(416,{'Content-Range':`bytes */${stat.size}`}); res.end(); return; }
      if(!match[1]) start=Math.max(0,stat.size-Number(match[2]));
      else { start=Number(match[1]); if(match[2]) end=Math.min(end,Number(match[2])); }
      if(start>end || start>=stat.size) { res.writeHead(416,{'Content-Range':`bytes */${stat.size}`}); res.end(); return; }
      status=206;headers['Content-Range']=`bytes ${start}-${end}/${stat.size}`;
    }
    headers['Content-Length']=end-start+1; res.writeHead(status,headers);
    if(req.method==='HEAD') res.end(); else fs.createReadStream(file,{start,end}).pipe(res);
  });
}).listen(5198,'127.0.0.1',() => console.log('Local preview: http://127.0.0.1:5198'));
