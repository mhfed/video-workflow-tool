import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { ensureDir } from '../../../packages/core/src/utils.mjs';
import { invalidateScene } from '../../../packages/core/src/invalidation.mjs';

const TYPES=new Map([['image/png',{extension:'.png',signature:Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])}],['image/jpeg',{extension:'.jpg',signature:Buffer.from([0xff,0xd8,0xff])}]]);

const safeName=(value)=>{let decoded=String(value||'artwork');try{decoded=decodeURIComponent(decoded);}catch{}return decoded.split(/[\\/]/).at(-1).replace(/[\r\n]/g,' ').trim().slice(0,160)||'artwork';};

export async function storeArtworkUpload(req,projectRoot,{filename='artwork',contentType='',maxBytes=25*1024*1024}={}) {
  const rawType=String(contentType).split(';')[0].trim().toLowerCase(),type=rawType==='image/jpg'?'image/jpeg':rawType,format=TYPES.get(type);
  if(!format)throw new Error('Artwork must be a PNG or JPEG image.');
  const declared=Number(req.headers?.['content-length']||0);if(declared>maxBytes)throw new Error(`Artwork is too large (${declared} bytes; limit ${maxBytes}).`);
  const directory=ensureDir(path.join(projectRoot,'assets','artwork')),temporary=path.join(directory,`.upload-${crypto.randomBytes(8).toString('hex')}.part`),hash=crypto.createHash('sha256');let received=0;
  const limiter=new Transform({transform(chunk,encoding,callback){received+=chunk.length;if(received>maxBytes)return callback(new Error(`Artwork upload exceeded the ${maxBytes} byte limit.`));hash.update(chunk);callback(null,chunk);}});
  try {
    await pipeline(req,limiter,fs.createWriteStream(temporary,{flags:'wx'}));
    if(!received)throw new Error('Artwork upload is empty.');
    const signature=Buffer.alloc(format.signature.length),descriptor=fs.openSync(temporary,'r');try{fs.readSync(descriptor,signature,0,signature.length,0);}finally{fs.closeSync(descriptor);}
    if(!signature.equals(format.signature))throw new Error(`Artwork bytes do not match ${type}.`);
    const digest=hash.digest('hex'),target=path.join(directory,`artwork-${digest.slice(0,16)}${format.extension}`),relative=path.relative(projectRoot,target);
    if(fs.existsSync(target)){fs.rmSync(temporary,{force:true});return {path:relative,mime:type,size:received,originalName:safeName(filename),reused:true};}
    fs.renameSync(temporary,target);return {path:relative,mime:type,size:received,originalName:safeName(filename),reused:false};
  } finally { fs.rmSync(temporary,{force:true}); }
}

export function assignUploadedArtwork(project,scene,upload,{currentRenderer=null}={}) {
  if(!upload?.path)throw new Error('Uploaded artwork metadata is incomplete.');
  scene.artwork=upload.path;scene.artworkSource={originalName:upload.originalName,mime:upload.mime,size:upload.size};scene.renderer='draw-reveal';
  invalidateScene(project,scene,{visualChanged:true,rendererChanged:currentRenderer!=='draw-reveal'});return scene;
}

export function resolveArtworkFile(scene,projectRoot) {
  if(typeof scene?.artwork!=='string'||!scene.artwork)return null;
  const root=path.resolve(projectRoot),candidate=path.resolve(root,scene.artwork),extension=path.extname(candidate).toLowerCase();
  if(candidate===root||!candidate.startsWith(`${root}${path.sep}`)||!['.png','.jpg','.jpeg'].includes(extension))return null;
  try {const realRoot=fs.realpathSync(root),file=fs.realpathSync(candidate);if(!file.startsWith(`${realRoot}${path.sep}`)||!fs.statSync(file).isFile())return null;return {file,type:extension==='.png'?'image/png':'image/jpeg'};}catch{return null;}
}
