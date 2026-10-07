import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(root,'index.html'),'utf8');
const photos = JSON.parse(fs.readFileSync(path.join(root,'assets/photos.json'),'utf8'));
const assets = JSON.parse(fs.readFileSync(path.join(root,'assets/library.json'),'utf8'));
const taxonomy = JSON.parse(fs.readFileSync(path.join(root,'assets/taxonomy.json'),'utf8'));
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
const failures = [];
if(new Set(ids).size!==ids.length) failures.push('Duplicate HTML IDs');
if(photos.length!==29 || new Set(photos.map(p=>p.id)).size!==29) failures.push('Photo inventory mismatch');
for(const p of photos){
  for(const file of [p.image,p.thumbnail]) if(!fs.existsSync(path.join(root,file))) failures.push(`Missing media: ${file}`);
  if(!html.includes(`class="shot media-card" data-id="${p.id}"`)) failures.push(`Missing gallery photo: ${p.id}`);
}
if(assets.length<31 || new Set(assets.map(item=>item.id)).size!==assets.length) failures.push('Asset inventory mismatch');
const embedded=JSON.parse(html.match(/<script type="application\/json" id="asset-data">([\s\S]*?)<\/script>/)?.[1]||'[]');
if(JSON.stringify(embedded)!==JSON.stringify(assets)) failures.push('Embedded catalog is stale; run npm run build');
const categories=new Set(taxonomy.categories.map(c=>c.id));
const topics=new Set(taxonomy.topics.flatMap(g=>g.values));
for(const item of assets) {
  for(const key of ['file','thumbnail','sourcePackage','breakdownFile']) if(item[key] && !fs.existsSync(path.join(root,item[key])))failures.push(`Missing ${key}: ${item[key]}`);
  if(!html.includes(`class="shot media-card" data-id="${item.id}"`)) failures.push(`Missing gallery entry: ${item.id}`);
  if(item.shotId) {
    if(!categories.has(item.motionCategory))failures.push(`Unknown purpose: ${item.id}`);
    if(!Array.isArray(item.topics)||item.topics.some(t=>!topics.has(t)))failures.push(`Unknown content topic: ${item.id}`);
    if(!taxonomy.formats.includes(item.aspectRatio))failures.push(`Unknown aspect ratio: ${item.id}`);
    if(item.kind==='motion' && (!item.sourcePackage||!item.breakdownFile||!item.sha256||item.status!=='completed'))failures.push(`Incomplete reusable motion: ${item.id}`);
  }
}
for(const match of html.matchAll(/\b(?:href|src)="([^"]+)"/g)){
  const url=match[1];
  if(!url || /^(https?:|data:|mailto:)/.test(url)) continue;
  if(url.startsWith('#')) {if(url.length>1 && !ids.includes(url.slice(1))) failures.push(`Missing anchor ${url}`);continue;}
  if(!fs.existsSync(path.join(root,url))) failures.push(`Missing resource: ${url}`);
}
for(const file of ['assets/video/introduction.mp4','assets/video/military.mp4']) if(!fs.existsSync(path.join(root,file))) failures.push(`Missing video: ${file}`);
const publicText=new Set(['index.html','app.js','style.css','assets/photos.json','assets/library.json','assets/taxonomy.json','docs/分类与流程.md',...assets.filter(i=>i.breakdownFile).map(i=>i.breakdownFile)]);
for(const file of publicText) {
  const content=fs.readFileSync(path.join(root,file),'utf8');
  if(/\/Users\/|access_token|ghp_[A-Za-z0-9]+|github_pat_[A-Za-z0-9]+/.test(content)) failures.push(`Private data in public file: ${file}`);
}
if(failures.length) {console.error(failures.join('\n'));process.exit(1);}
console.log(`Passed: ${assets.length} unique entries, 29 original photos, 2 original videos, ${assets.filter(i=>i.kind==='motion').length} reusable motions; catalog, taxonomy, files, anchors, IDs and privacy.`);
