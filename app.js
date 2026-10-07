(() => {
  'use strict';
  const builtins = JSON.parse(document.getElementById('asset-data').textContent);
  const taxonomy = JSON.parse(document.getElementById('taxonomy-data').textContent);
  const categoryLabel = Object.fromEntries(taxonomy.categories.map(c=>[c.id,c.label]));
  const kindLabel = {photo:'图片', video:'镜头', motion:'动效', audio:'音频', note:'拆解'};
  const mediaUrls = new Map();
  let localItems = [];
  let items = [...builtins];
  let filtered = items;
  let typeFilter = 'all';
  let tagFilter = '全部主题';
  let purposeFilter = '';
  let topicFilter = '';
  let formatFilter = '';
  let query = '';
  let sortOrder = 'kind';
  let activeId = null;
  let previousFocus = null;
  let editingId = null;
  let db = null;
  let toastTimer;
  const gallery = document.getElementById('gallery');
  const detail = document.getElementById('detail-dialog');
  const stage = document.getElementById('detail-stage');
  const importDialog = document.getElementById('import-dialog');
  const noteDialog = document.getElementById('note-dialog');
  const storage = {
    get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } }
  };
  const savedFavorites = storage.get('zurenze-lens-favorites', []);
  const favorites = new Set(Array.isArray(savedFavorites) ? savedFavorites : []);
  function escape(value) { return String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character])); }
  function tags(value) { return [...new Set(value.split(/[,，、\s]+/).map(tag => tag.trim()).filter(Boolean))].slice(0,12); }
  function notify(message) { clearTimeout(toastTimer); const toast=document.getElementById('toast');toast.textContent=message;toast.hidden=false;toastTimer=setTimeout(()=>{toast.hidden=true;},3200); }
  function fileUrl(item) {
    if (!item.local) return item.file;
    if (!mediaUrls.has(item.id) && item.blob) mediaUrls.set(item.id, URL.createObjectURL(item.blob));
    return mediaUrls.get(item.id) || '';
  }
  function allItems() { items = [...builtins, ...localItems]; }
  function visibleItems() {
    const result=items.filter(item => (typeFilter === 'trash' ? item.trash : !item.trash) && (['all','trash'].includes(typeFilter) || (typeFilter === 'favorites' ? favorites.has(item.id) : item.kind === typeFilter)) && (tagFilter === '全部主题' || item.tags.includes(tagFilter)) && (!purposeFilter || item.motionCategory===purposeFilter) && (!topicFilter || (item.topics||[]).includes(topicFilter)) && (!formatFilter || item.aspectRatio===formatFilter) && `${item.title} ${item.description} ${item.tags.join(' ')} ${(item.topics||[]).join(' ')} ${(item.styleTags||[]).join(' ')} ${categoryLabel[item.motionCategory]||''} ${item.shotId||''} ${kindLabel[item.kind]} ${item.fileName || ''}`.toLowerCase().includes(query));
    const priority={motion:0,video:1,note:2,photo:3,audio:4};
    return result.sort((a,b)=>sortOrder==='title'?a.title.localeCompare(b.title,'zh-CN'):sortOrder==='recent'?(Date.parse(b.created||'')||0)-(Date.parse(a.created||'')||0):priority[a.kind]-priority[b.kind]);
  }
  function resetMotionFilters() {
    purposeFilter=topicFilter=formatFilter='';
    for(const id of ['purpose-filter','topic-filter','format-filter'])document.getElementById(id).value='';
  }
  function renderTags() {
    const allTags = [...new Set(items.filter(i=>!i.trash).flatMap(item=>item.tags))];
    if (!allTags.includes(tagFilter)) tagFilter='全部主题';
    document.getElementById('tag-filters').innerHTML=['全部主题',...allTags].map(tag=>`<button class="tag-filter" type="button" data-tag="${escape(tag)}" aria-pressed="${tag===tagFilter}">${escape(tag)}</button>`).join('');
  }
  function card(item) {
    const number = String(items.indexOf(item)+1).padStart(2,'0');
    const saved = favorites.has(item.id);
    let cover;
    if(item.kind==='photo') cover=`<img src="${escape(item.local?fileUrl(item):item.thumbnail)}" alt="${escape(item.description||item.title)}" loading="lazy" decoding="async">`;
    else if(item.thumbnail) cover=`<img src="${escape(item.thumbnail)}" alt="${escape(item.title)}封面" loading="lazy"><span class="cover-play" aria-hidden="true">▶</span>`;
    else if(item.kind==='note') cover=`<div class="note-cover"><strong>拆解笔记 ↗</strong><p>${escape(item.description||'记录参考、制作思路与实现方法。')}</p></div>`;
    else cover=`<div class="audio-cover"><svg viewBox="0 0 80 80" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">${item.kind==='audio'?'<path d="M12 34v12m9-24v36m9-43v50m10-60v70m10-48v26m10-31v36m9-22v8"/>':'<rect x="10" y="17" width="60" height="46" rx="2"/><path d="m34 29 17 11-17 11Z"/>'}</svg></div>`;
    return `<figure class="shot media-card" data-id="${escape(item.id)}" data-kind="${item.kind}"><div class="shot-image"><button class="shot-open" type="button" data-open="${escape(item.id)}" aria-label="预览素材：${escape(item.title)}">${cover}<span class="preview-label" aria-hidden="true">打开预览 ↗</span></button><span class="media-type">${kindLabel[item.kind]}${item.duration?' / '+escape(item.duration):''}</span><button class="shot-favorite" type="button" data-favorite="${escape(item.id)}" aria-pressed="${saved}" aria-label="${saved?'取消收藏':'收藏'}：${escape(item.title)}">${saved?'♥':'♡'}</button></div><figcaption><div><h3>${escape(item.title)}</h3><small>${escape(item.tags.slice(0,3).join(' / ')||'未分类')}</small>${item.local?'<small class="local-label">仅此浏览器'+(item.trash?' · 回收站':'')+'</small>':item.localOnly?'<small class="local-label">本地镜头档案 · 未上传</small>':''}</div><div class="card-right"><span class="shot-number">${number}</span>${item.file||item.blob?`<a class="quick-take" href="${escape(fileUrl(item))}" download="${escape(item.fileName||item.file?.split('/').pop()||item.title)}" aria-label="取用素材：${escape(item.title)}">↓</a>`:''}</div></figcaption></figure>`;
  }
  function render() {
    allItems(); filtered=visibleItems(); gallery.innerHTML=filtered.map(card).join('');
    const alive=items.filter(item=>!item.trash);
    document.getElementById('total-count').textContent=alive.length;
    const label={all:'全部素材',favorites:'我的收藏',trash:'回收站'}[typeFilter]||kindLabel[typeFilter];
    document.getElementById('result-count').textContent=`${label} / ${filtered.length} 个条目`;
    document.getElementById('empty').hidden=filtered.length>0;
    document.getElementById('empty-message').textContent=query?'没有找到对应素材，换一个名称或标签试试。':typeFilter==='motion'?'还没有动效素材。导入自己制作的动效视频，或记下一个参考视频的拆解。':typeFilter==='note'?'遇到想学的画面，把来源、动效思路和实现方法记下来。':typeFilter==='favorites'?'点素材上的心形，收集下一条视频想用的画面。':typeFilter==='trash'?'回收站是空的。移入这里的本地素材可以恢复。':'当前主题下还没有素材，试试其他主题。';
    document.querySelectorAll('[data-type]').forEach(button=>{button.setAttribute('aria-pressed',String(button.dataset.type===typeFilter));const count=button.querySelector('sup');if(count) count.textContent=button.dataset.type==='all'?alive.length:button.dataset.type==='favorites'?alive.filter(i=>favorites.has(i.id)).length:alive.filter(i=>i.kind===button.dataset.type).length;});
    document.querySelectorAll('[data-tag]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.tag===tagFilter)));
    document.getElementById('trash-button').textContent=`回收站${localItems.filter(i=>i.trash).length?' · '+localItems.filter(i=>i.trash).length:''}`;
    if(activeId) syncDetailFavorite();
  }
  function syncDetailFavorite() { const button=document.getElementById('detail-favorite');const saved=favorites.has(activeId);button.setAttribute('aria-pressed',String(saved));button.textContent=saved?'♥ 已收藏':'♡ 收藏'; }
  function toggleFavorite(id) { favorites.has(id)?favorites.delete(id):favorites.add(id);const persisted=storage.set('zurenze-lens-favorites',[...favorites]);render();notify(persisted?(favorites.has(id)?'已收藏 · 保存在当前浏览器':'已取消收藏'):'收藏仅在本次页面有效，浏览器未允许保存'); }
  function cleanupMedia() { stage.querySelectorAll('video,audio').forEach(media=>{media.pause();media.removeAttribute('src');media.load();});stage.replaceChildren(); }
  function setActive(id) {
    const item=items.find(i=>i.id===id);if(!item)return;
    activeId=id;cleanupMedia();
    document.getElementById('detail-title').textContent=item.title;
    document.getElementById('detail-kind').textContent=`${kindLabel[item.kind]} / ${item.local?'仅此浏览器':item.localOnly?'本地镜头档案':'本站素材'}`;
    document.getElementById('detail-tags').textContent=item.tags.map(t=>'#'+t).join(' ');
    document.getElementById('detail-description').textContent=item.description||'暂无备注';
    document.getElementById('detail-info').textContent=item.local?`${item.fileName||'拆解笔记'}${item.size?' · '+(item.size/1024/1024).toFixed(2)+' MB':''} · ${item.created.slice(0,10)}`:item.localOnly?'本地镜头档案 · 未上传 · 文件保留在本机':item.shotId?`${item.shotId} · ${categoryLabel[item.motionCategory]} · ${(item.topics||[]).join(' / ')} · ${item.aspectRatio} · ${item.duration||''} · ${item.engine||''}${item.kind==='motion'?' · '+(item.hasAudio?'有音轨':'无音轨，可叠加口播'):''}`:item.kind==='photo'?'WebP 网页素材 · 点击取用后可用于个人视频制作':'完整原声视频 · 可拖动进度选择需要的段落';
    let media;
    if(item.kind==='photo'){media=document.createElement('img');media.src=fileUrl(item);media.alt=item.description||item.title;}
    else if(item.kind==='note'){if(item.file){const reference=document.createElement('video');reference.src=fileUrl(item);reference.controls=true;reference.preload='metadata';reference.setAttribute('playsinline','');if(item.thumbnail)reference.poster=item.thumbnail;stage.append(reference);}media=document.createElement('div');media.className='detail-note';media.textContent=item.description||'暂无拆解内容';}
    else{media=document.createElement(item.kind==='audio'?'audio':'video');media.controls=true;media.preload='metadata';media.setAttribute('playsinline','');media.src=fileUrl(item);if(item.thumbnail)media.poster=item.thumbnail;media.addEventListener('error',()=>{document.getElementById('detail-info').textContent='素材暂时无法播放，请检查文件格式或网络后重新打开。';});}
    stage.append(media);
    const take=document.getElementById('take-asset');take.hidden=item.kind==='note'&&!item.file;take.href=take.hidden?'#':fileUrl(item);take.download=item.fileName||item.file?.split('/').pop()||'素材';take.textContent=item.kind==='photo'?'取用图片 ↓':item.kind==='audio'?'取用音频 ↓':item.kind==='note'?'本地参考片 ↓':'取用视频 ↓';
    const source=document.getElementById('detail-source');source.hidden=!item.source;source.href=item.source||'#';source.textContent=item.localOnly&&item.kind==='note'?'查看完整拆解 ↗':item.kind==='note'?'打开参考视频 ↗':'查看素材来源 ↗';
    const reusable=document.getElementById('detail-package');reusable.hidden=!item.sourcePackage;reusable.href=item.sourcePackage||'#';reusable.download=(item.sourcePackage||'').split('/').pop();
    const breakdown=document.getElementById('detail-breakdown');breakdown.hidden=!item.breakdownFile;breakdown.href=item.breakdownFile||'#';
    document.getElementById('edit-item').hidden=!item.local;
    const trash=document.getElementById('trash-item');trash.hidden=!item.local;trash.textContent=item.trash?'恢复素材':'移到回收站';
    const collection=filtered.some(i=>i.id===id)?filtered:items.filter(i=>!i.trash);
    document.getElementById('detail-position').textContent=`${String(collection.findIndex(i=>i.id===id)+1).padStart(2,'0')} / ${String(collection.length).padStart(2,'0')}`;
    document.querySelectorAll('[data-direction]').forEach(button=>{button.disabled=collection.length<2;});syncDetailFavorite();
  }
  function openDetail(id) { previousFocus=document.activeElement;setActive(id);detail.showModal();document.body.style.overflow='hidden'; }
  function changeItem(step) { const collection=filtered.some(i=>i.id===activeId)?filtered:items.filter(i=>!i.trash);if(!collection.length)return;const index=collection.findIndex(i=>i.id===activeId);setActive(collection[(index+step+collection.length)%collection.length].id); }
  function openDialog(dialog,focus) { previousFocus=document.activeElement;dialog.showModal();document.body.style.overflow='hidden';focus?.focus(); }
  function writeItem(item) { return new Promise((resolve,reject)=>{if(!db){reject(new Error('素材存储不可用，请使用支持本地存储的浏览器。'));return;}const transaction=db.transaction('items','readwrite');transaction.objectStore('items').put(item);transaction.oncomplete=resolve;transaction.onerror=()=>reject(transaction.error);transaction.onabort=()=>reject(transaction.error||new Error('存储未完成'));}); }
  async function saveItem(item) { await writeItem(item);const index=localItems.findIndex(i=>i.id===item.id);if(index<0)localItems.push(item);else localItems[index]=item;allItems();renderTags();render(); }
  function safeSource(value) { if(!value.trim())return '';const url=new URL(value);if(!['https:','http:'].includes(url.protocol))throw new Error('参考链接须以 https:// 或 http:// 开头。');return url.href; }
  async function importFiles() {
    const files=[...document.getElementById('asset-files').files];const status=document.getElementById('import-status');const submit=document.getElementById('import-submit');
    if(!files.length){status.textContent='先选择要导入的文件。';return;}
    if(!db){status.textContent='当前浏览器未开放本地素材存储，无法导入。';return;}
    submit.disabled=true;let imported=0;let rejected=0;
    try {
      const sharedTags=tags(document.getElementById('import-tags').value);
      for(const file of files){
        const inferred=file.type.startsWith('image/')?'photo':file.type.startsWith('video/')?'video':file.type.startsWith('audio/')?'audio':null;
        if(!inferred){rejected++;continue;}
        const kind=document.getElementById('import-type').value==='motion' && ['photo','video'].includes(inferred)?'motion':inferred;
        const item={id:'local-'+crypto.randomUUID(),local:true,title:file.name.replace(/\.[^.]+$/,''),fileName:file.name,kind,mediaKind:inferred,tags:sharedTags.length?sharedTags:['我的素材'],description:document.getElementById('import-description').value.trim(),blob:file,size:file.size,mime:file.type,created:new Date().toISOString(),source:'',trash:false};
        if(kind==='motion' && inferred==='photo')item.kind='photo',item.tags=[...new Set([...item.tags,'动效参考'])];
        status.textContent=`正在保存 ${imported+1} / ${files.length}…`;await saveItem(item);imported++;
      }
      if(imported){importDialog.close();document.getElementById('import-form').reset();typeFilter='all';tagFilter='全部主题';query='';document.getElementById('search').value='';renderTags();render();notify(`已保存 ${imported} 个素材到此浏览器${rejected?'，跳过 '+rejected+' 个不支持的文件':''}`);}else status.textContent='没有可导入的文件。请选择图片、视频或音频。';
    }catch(error){status.textContent=`已保存 ${imported} 个；后续未完成：${error.name==='QuotaExceededError'?'浏览器空间不足，请保留原文件。':error.message||'浏览器未允许保存。'}`;}
    finally{submit.disabled=false;}
  }
  function openNote() { editingId=null;document.getElementById('note-form').reset();document.getElementById('note-heading').textContent='记录一个视频拆解';document.getElementById('note-source-field').hidden=false;document.getElementById('note-status').textContent='';openDialog(noteDialog,document.getElementById('note-title')); }
  function editItem() { const item=items.find(i=>i.id===activeId);if(!item?.local)return;editingId=item.id;detail.close();document.getElementById('note-heading').textContent='编辑素材信息';document.getElementById('note-title').value=item.title;document.getElementById('note-source').value=item.source;document.getElementById('note-source-field').hidden=item.kind!=='note';document.getElementById('note-tags').value=item.tags.join(' ');document.getElementById('note-body').value=item.description;document.getElementById('note-status').textContent='';openDialog(noteDialog,document.getElementById('note-title')); }
  async function saveNote() {
    const submit=document.getElementById('note-submit');const status=document.getElementById('note-status');submit.disabled=true;
    try{const title=document.getElementById('note-title').value.trim();if(!title)throw new Error('给这条素材写一个名称。');const existing=localItems.find(i=>i.id===editingId);const source=safeSource(document.getElementById('note-source').value);const item=existing?{...existing,title,source,description:document.getElementById('note-body').value.trim(),tags:tags(document.getElementById('note-tags').value)}:{id:'local-'+crypto.randomUUID(),local:true,kind:'note',title,source,tags:tags(document.getElementById('note-tags').value),description:document.getElementById('note-body').value.trim(),created:new Date().toISOString(),trash:false};await saveItem(item);noteDialog.close();notify(existing?'素材信息已更新':'拆解已保存到此浏览器');}
    catch(error){status.textContent=error.message||'保存未完成，请保留本页内容。';}finally{submit.disabled=false;}
  }
  function exportCatalog() {
    const catalog={name:'祖仁泽个人镜头素材清单',exportedAt:new Date().toISOString(),note:'此文件只包含目录、标签和笔记，不包含上传素材原件。请另行保留原始文件。',items:items.map(({blob,...item})=>({...item,favorite:favorites.has(item.id)}))};
    const blob=new Blob([JSON.stringify(catalog,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`祖仁泽素材清单-${new Date().toISOString().slice(0,10)}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('已导出目录与拆解笔记；素材原件请单独保留');
  }
  gallery.addEventListener('click',event=>{const favorite=event.target.closest('[data-favorite]');const open=event.target.closest('[data-open]');if(favorite)toggleFavorite(favorite.dataset.favorite);else if(open)openDetail(open.dataset.open);});
  document.querySelectorAll('[data-type]').forEach(button=>button.addEventListener('click',()=>{typeFilter=button.dataset.type;resetMotionFilters();if(button.classList.contains('side-link')){tagFilter='全部主题';query='';document.getElementById('search').value='';renderTags();document.getElementById('collection').scrollIntoView({block:'start'});}render();}));
  document.getElementById('purpose-filter').addEventListener('change',event=>{purposeFilter=event.target.value;render();});
  document.getElementById('topic-filter').addEventListener('change',event=>{topicFilter=event.target.value;render();});
  document.getElementById('format-filter').addEventListener('change',event=>{formatFilter=event.target.value;render();});
  document.getElementById('clear-motion-filters').addEventListener('click',()=>{resetMotionFilters();tagFilter='全部主题';query='';document.getElementById('search').value='';render();});
  document.getElementById('sort-order').addEventListener('change',event=>{sortOrder=event.target.value;render();});
  document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{gallery.dataset.view=button.dataset.view;storage.set('zurenze-lens-view',button.dataset.view);document.querySelectorAll('.view-button').forEach(control=>control.setAttribute('aria-pressed',String(control===button)));}));
  const view=storage.get('zurenze-lens-view','comfortable');
  if(['comfortable','compact'].includes(view)){gallery.dataset.view=view;document.querySelectorAll('.view-button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===view)));}
  document.getElementById('tag-filters').addEventListener('click',event=>{const button=event.target.closest('[data-tag]');if(button){tagFilter=button.dataset.tag;render();}});
  document.getElementById('search').addEventListener('input',event=>{query=event.target.value.trim().toLowerCase();render();});
  document.getElementById('reset-search').addEventListener('click',()=>{query='';typeFilter='all';tagFilter='全部主题';resetMotionFilters();document.getElementById('search').value='';renderTags();render();});
  document.querySelectorAll('[data-import]').forEach(button=>button.addEventListener('click',()=>{document.getElementById('import-status').textContent='';openDialog(importDialog);}));
  document.querySelectorAll('[data-note]').forEach(button=>button.addEventListener('click',openNote));
  document.getElementById('import-form').addEventListener('submit',event=>{event.preventDefault();importFiles();});
  document.getElementById('note-form').addEventListener('submit',event=>{event.preventDefault();saveNote();});
  document.getElementById('export-catalog').addEventListener('click',exportCatalog);
  document.getElementById('trash-button').addEventListener('click',()=>{typeFilter='trash';tagFilter='全部主题';query='';document.getElementById('search').value='';renderTags();render();});
  document.getElementById('detail-favorite').addEventListener('click',()=>toggleFavorite(activeId));
  document.getElementById('edit-item').addEventListener('click',editItem);
  document.getElementById('trash-item').addEventListener('click',async()=>{const item=localItems.find(i=>i.id===activeId);if(!item)return;try{await saveItem({...item,trash:!item.trash});detail.close();notify(item.trash?'素材已恢复':'已移到回收站，可随时恢复');}catch{notify('操作未完成，素材保持原状');}});
  document.querySelectorAll('[data-direction]').forEach(button=>button.addEventListener('click',()=>changeItem(Number(button.dataset.direction))));
  detail.addEventListener('keydown',event=>{if(event.target.matches('input,textarea,select,video,audio'))return;if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();changeItem(event.key==='ArrowRight'?1:-1);}});
  document.querySelectorAll('dialog').forEach(dialog=>{
    dialog.querySelector('[data-close]').addEventListener('click',()=>dialog.close());
    dialog.addEventListener('click',event=>{const bounds=dialog.getBoundingClientRect();if(event.target===dialog&&(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom))dialog.close();});
    dialog.addEventListener('close',()=>{document.body.style.overflow='';if(dialog===detail)cleanupMedia();if(previousFocus?.isConnected)previousFocus.focus();else if(activeId)gallery.querySelector(`[data-open="${CSS.escape(activeId)}"]`)?.focus();});
  });
  const preference=matchMedia('(prefers-reduced-motion: reduce)');let motionEnabled=storage.get('zurenze-lens-motion',!preference.matches)===true;
  function syncMotion(){document.body.dataset.motion=motionEnabled?'on':'off';document.getElementById('motion-toggle').setAttribute('aria-pressed',String(motionEnabled));document.getElementById('motion-label').textContent=motionEnabled?'动态 开':'动态 关';}
  document.getElementById('motion-toggle').addEventListener('click',()=>{motionEnabled=!motionEnabled;storage.set('zurenze-lens-motion',motionEnabled);syncMotion();});
  preference.addEventListener('change',event=>{if(event.matches){motionEnabled=false;syncMotion();}});
  syncMotion();renderTags();render();
  if(location.hash.startsWith('#asset=')) {
    const id=decodeURIComponent(location.hash.slice(7));
    if(builtins.some(item=>item.id===id))openDetail(id);
  }
  if(['localhost','127.0.0.1','::1'].includes(location.hostname)) {
    fetch('/local-library.json').then(response=>response.ok?response.json():[]).then(entries=>{if(!Array.isArray(entries))return;for(const entry of entries)if(entry.localOnly&&!builtins.some(item=>item.id===entry.id || (item.sha256&&item.sha256===entry.sha256)))builtins.push(entry);allItems();renderTags();render();}).catch(()=>{});
  }
  try {
    const request=indexedDB.open('zurenze-personal-lens',1);
    request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('items'))request.result.createObjectStore('items',{keyPath:'id'});};
    request.onsuccess=()=>{db=request.result;db.onversionchange=()=>{db.close();db=null;};const read=db.transaction('items','readonly').objectStore('items').getAll();read.onsuccess=()=>{localItems=read.result;allItems();renderTags();render();document.getElementById('storage-status').textContent='本地素材存储已就绪';};read.onerror=()=>{document.getElementById('storage-status').textContent='本地素材读取失败，请保留原文件并重新打开';};};
    request.onerror=()=>{document.getElementById('storage-status').textContent='当前浏览器未开放本地存储 · 仍可浏览本站素材';};
  } catch {document.getElementById('storage-status').textContent='当前浏览器未开放本地存储 · 仍可浏览本站素材';}
})();
