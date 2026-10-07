import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..');
const fixed=['index.html','app.js','style.css','server.cjs','package.json','README.md','assets/library.json','assets/taxonomy.json','scripts/build-catalog.mjs','scripts/check.mjs','scripts/prepare-publication.mjs','docs/分类与流程.md'];
const catalog=JSON.parse(fs.readFileSync(path.join(root,'assets/library.json'),'utf8'));
const paths=new Set(fixed);
for(const item of catalog.filter(i=>i.shotId))for(const key of ['file','thumbnail','sourcePackage','breakdownFile'])if(item[key])paths.add(item[key]);
const files=[...paths].sort().map(file=>{
  const local=path.resolve(root,file);
  if(!local.startsWith(root+path.sep)||file.split('/').some(p=>p.startsWith('.')))throw new Error('Unsafe publication path: '+file);
  const bytes=fs.readFileSync(local);
  return {path:file,bytes:bytes.length,gitBlobSha:crypto.createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex'),sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
});
const out={repository:'zurenze1/zurenze-personal-lens',branch:'main',generatedAt:new Date().toISOString(),files};
const output=process.argv[2]?path.resolve(process.argv[2]):path.resolve(root,'../发布待上传清单.json');
fs.writeFileSync(output,JSON.stringify(out,null,2)+'\n');
console.log(`Prepared ${files.length} explicit paths (${(files.reduce((n,f)=>n+f.bytes,0)/1024/1024).toFixed(2)} MiB); no whole-folder upload.`);
