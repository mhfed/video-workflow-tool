import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { ensureDir } from '../../../packages/core/src/utils.mjs';
import { invalidateScene } from '../../../packages/core/src/invalidation.mjs';
import { assertBrollDownloadUrl } from '../../../packages/providers/src/broll.mjs';

const SOURCE_HOSTS={pexels:['pexels.com'],pixabay:['pixabay.com']};
const clean=(value,max=300)=>String(value||'').replace(/[\r\n]+/g,' ').trim().slice(0,max);

function safeSourceUrl(provider,value) {
  if(!value)return '';
  let url;try{url=new URL(value);}catch{return '';}
  const roots=SOURCE_HOSTS[provider]||[];
  return url.protocol==='https:'&&!url.username&&!url.password&&roots.some((host)=>url.hostname===host||url.hostname.endsWith(`.${host}`))?url.href:'';
}

export function normalizeBrollSelection(value={}) {
  const provider=clean(value.provider,20),id=clean(value.id,80);
  const downloadUrl=assertBrollDownloadUrl(provider,value.downloadUrl).href;
  if(!id||!/^[a-zA-Z0-9_-]+$/.test(id))throw new Error('B-roll result ID is invalid.');
  return {provider,id,downloadUrl,sourceUrl:safeSourceUrl(provider,value.sourceUrl),creator:clean(value.creator,160),creatorUrl:safeSourceUrl(provider,value.creatorUrl),attribution:clean(value.attribution,240)};
}

export async function downloadBrollAsset(selection,projectRoot,{fetchImpl=fetch,signal=null,maxBytes=250*1024*1024}={}) {
  const item=normalizeBrollSelection(selection),directory=ensureDir(path.join(projectRoot,'assets','broll'));
  const digest=crypto.createHash('sha256').update(item.downloadUrl).digest('hex').slice(0,10);
  const filename=`${item.provider}-${item.id}-${digest}.mp4`,target=path.join(directory,filename),relative=path.relative(projectRoot,target);
  if(fs.existsSync(target)&&fs.statSync(target).isFile())return {path:relative,source:item,reused:true};
  const response=await fetchImpl(item.downloadUrl,{signal,redirect:'follow'});
  if(!response.ok)throw new Error(`${item.provider} video download failed (${response.status}).`);
  assertBrollDownloadUrl(item.provider,response.url||item.downloadUrl);
  const declared=Number(response.headers.get('content-length')||0);
  if(declared>maxBytes)throw new Error(`B-roll download is too large (${declared} bytes; limit ${maxBytes}).`);
  const type=response.headers.get('content-type')||'';
  if(type&&!type.startsWith('video/')&&type!=='application/octet-stream')throw new Error(`B-roll download returned unexpected content type: ${type}`);
  if(!response.body)throw new Error('B-roll download returned no response body.');
  const temporary=path.join(directory,`.${filename}.${crypto.randomBytes(4).toString('hex')}.part`);let received=0;
  const limiter=new Transform({transform(chunk,encoding,callback){received+=chunk.length;if(received>maxBytes)callback(new Error(`B-roll download exceeded the ${maxBytes} byte limit.`));else callback(null,chunk);}});
  try{
    const source=Readable.fromWeb(response.body),destination=fs.createWriteStream(temporary,{flags:'wx'});
    if(signal)await pipeline(source,limiter,destination,{signal});else await pipeline(source,limiter,destination);
    fs.renameSync(temporary,target);
  }finally{fs.rmSync(temporary,{force:true});}
  return {path:relative,source:{...item,downloadedAt:new Date().toISOString()},reused:false};
}

export function assignDownloadedBroll(project,scene,downloaded,{brollStartMs=0,currentRenderer=null}={}) {
  if(!downloaded?.path||!downloaded?.source)throw new Error('Downloaded B-roll metadata is incomplete.');
  const {downloadUrl,...source}=downloaded.source;
  scene.broll=downloaded.path;
  scene.brollSource=source;
  scene.brollStartMs=Math.max(0,Number(brollStartMs)||0);
  scene.renderer='cinematic-broll';
  invalidateScene(project,scene,{visualChanged:true,rendererChanged:currentRenderer!=='cinematic-broll'});
  return scene;
}
