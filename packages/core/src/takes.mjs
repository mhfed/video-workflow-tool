import crypto from 'node:crypto';
import path from 'node:path';
import { invalidateFinal } from './invalidation.mjs';
import { ensureDir, nowIso } from './utils.mjs';

export const TAKE_KINDS=['voice','visual','video','clip'];

export function normalizeTakes(scene) {
  scene.takes ||= {};
  scene.selectedTakes ||= {};
  for(const kind of TAKE_KINDS){
    if(!Array.isArray(scene.takes[kind]))scene.takes[kind]=[];
    const artifact=scene.artifacts?.[kind];
    if(artifact&&!scene.takes[kind].some((take)=>take.path===artifact)){
      const legacy={id:`legacy-${kind}`,kind,path:artifact,cacheKey:scene.cache?.[kind==='visual'?'image':kind]||null,createdAt:null,label:'Imported take'};
      scene.takes[kind].push(legacy);
      scene.selectedTakes[kind]=legacy.id;
    }
    if(scene.selectedTakes[kind]&&!scene.takes[kind].some((take)=>take.id===scene.selectedTakes[kind]))delete scene.selectedTakes[kind];
    if(!scene.selectedTakes[kind]&&scene.takes[kind].length)scene.selectedTakes[kind]=scene.takes[kind].at(-1).id;
  }
  return scene;
}

export function createTakeTarget(sceneDirectory,kind,extension,cacheKey) {
  const id=`${kind}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
  const directory=ensureDir(path.join(sceneDirectory,'takes',kind));
  return {id,file:path.join(directory,`${id}-${String(cacheKey).slice(0,10)}.${extension}`)};
}

export function recordTake(scene,kind,{id,path:artifactPath=null,cacheKey=null,label=null,provider=null,durationMs=null,meta=null}={}) {
  normalizeTakes(scene);
  const take={id:id||`${kind}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,kind,path:artifactPath,cacheKey,createdAt:nowIso(),label:label||`Take ${scene.takes[kind].length+1}`,...(provider?{provider}:{}),...(durationMs?{durationMs}:{}),...(meta?{meta}: {})};
  scene.takes[kind].push(take);
  scene.selectedTakes[kind]=take.id;
  if(artifactPath)scene.artifacts[kind]=artifactPath;else delete scene.artifacts[kind];
  return take;
}

const drop=(object,key)=>{if(object)delete object[key];};

export function selectTake(project,scene,kind,takeId) {
  if(!TAKE_KINDS.includes(kind))throw new Error(`Unsupported take kind: ${kind}`);
  normalizeTakes(scene);
  const take=scene.takes[kind].find((item)=>item.id===takeId);
  if(!take)throw new Error('take not found');
  if(scene.selectedTakes[kind]===take.id&&scene.artifacts?.[kind]===take.path)return take;
  scene.selectedTakes[kind]=take.id;
  if(take.path)scene.artifacts[kind]=take.path;else drop(scene.artifacts,kind);
  const cacheKind=kind==='visual'?'image':kind;
  if(take.cacheKey)scene.cache[cacheKind]=take.cacheKey;else drop(scene.cache,cacheKind);
  if(kind==='voice'&&take.durationMs)scene.durationMs=take.durationMs;
  const downstream=kind==='voice'||kind==='visual'?['video','clip']:kind==='video'?['clip']:[];
  for(const item of downstream){drop(scene.cache,item);drop(scene.artifacts,item);drop(scene.selectedTakes,item);}
  if(kind==='voice'||kind==='visual'){scene.review[kind]='pending';scene.review.clip='stale';}
  if(kind==='video')scene.review.clip='stale';
  if(kind==='clip')scene.review.clip='pending';
  invalidateFinal(project);
  return take;
}
