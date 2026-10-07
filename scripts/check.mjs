import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(root,'index.html'),'utf8');
const photos = JSON.parse(fs.readFileSync(path.join(root,'assets/photos.json'),'utf8'));
const assets = JSON.parse(fs.readFileSync(path.join(root,'assets/library.json'),'utf8'));
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
const failures = [];
if(new Set(ids).size!==ids.length) failures.push('Duplicate HTML IDs');
if(photos.length!==29 || new Set(photos.map(p=>p.id)).size!==29) failures.push('Photo inventory mismatch');
for(const p of photos){
  for(const file of [p.image,p.thumbnail]) if(!fs.existsSync(path.join(root,file))) failures.push(`Missing media: ${file}`);
  if(!html.includes(`class="shot media-card" data-id="${p.id}"`)) failures.push(`Missing gallery photo: ${p.id}`);
}
if(assets.length!==31 || new Set(assets.map(item=>item.id)).size!==31) failures.push('Asset inventory mismatch');
for(const item of assets) if(!fs.existsSync(path.join(root,item.file))) failures.push(`Missing library asset: ${item.file}`);
for(const match of html.matchAll(/\b(?:href|src)="([^"]+)"/g)){
  const url=match[1];
  if(!url || /^(https?:|data:|mailto:)/.test(url)) continue;
  if(url.startsWith('#')) {if(url.length>1 && !ids.includes(url.slice(1))) failures.push(`Missing anchor ${url}`);continue;}
  if(!fs.existsSync(path.join(root,url))) failures.push(`Missing resource: ${url}`);
}
for(const file of ['assets/video/introduction.mp4','assets/video/military.mp4']) if(!fs.existsSync(path.join(root,file))) failures.push(`Missing video: ${file}`);
for(const file of ['index.html','app.js','style.css','assets/photos.json','assets/library.json']) {
  const content=fs.readFileSync(path.join(root,file),'utf8');
  if(/\/Users\/|access_token|ghp_[A-Za-z0-9]+|github_pat_[A-Za-z0-9]+/.test(content)) failures.push(`Private data in public file: ${file}`);
}
if(failures.length) {console.error(failures.join('\n'));process.exit(1);}
console.log('Passed: 31 unique library entries, 29 photos, 2 videos, local assets, anchors, IDs, public-file privacy check.');
