import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { assignUploadedArtwork, resolveArtworkFile, storeArtworkUpload } from '../apps/web/src/artwork-media.mjs';

const png=Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),Buffer.from('fixture')]);
const request=(bytes)=>Object.assign(Readable.from(bytes),{headers:{'content-length':String(bytes.length)}});

test('artwork upload validates bytes and stores a deterministic project-local asset',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'vwt-artwork-upload-'));
  const first=await storeArtworkUpload(request(png),root,{filename:encodeURIComponent('../Màu sắc.png'),contentType:'image/png',maxBytes:100});
  assert.match(first.path,/^assets\/artwork\/artwork-[a-f0-9]{16}\.png$/);assert.equal(first.originalName,'Màu sắc.png');assert.equal(fs.readFileSync(path.join(root,first.path)).equals(png),true);
  const second=await storeArtworkUpload(request(png),root,{filename:'same.png',contentType:'image/png',maxBytes:100});assert.equal(second.reused,true);
  await assert.rejects(storeArtworkUpload(request(Buffer.from('not-png')),root,{contentType:'image/png',maxBytes:100}),/bytes do not match/);
  await assert.rejects(storeArtworkUpload(request(Buffer.alloc(101)),root,{contentType:'image/png',maxBytes:100}),/too large/);
  assert.equal(fs.readdirSync(path.join(root,'assets','artwork')).some((name)=>name.endsWith('.part')),false);
});

test('assigning uploaded artwork preserves voice, invalidates visual output, and resolves preview safely',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'vwt-artwork-assign-')),directory=path.join(root,'assets','artwork');fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(path.join(directory,'artwork-a.png'),png);
  const scene={id:'scene-001',cache:{voice:'voice',image:'old',video:'old',clip:'old'},artifacts:{voice:'voice.mp3',visual:'old.png',video:'old.mp4',clip:'old.mp4'}},project={status:'complete',artifacts:{final:'output/final.mp4'},scenes:[scene]};
  assignUploadedArtwork(project,scene,{path:'assets/artwork/artwork-a.png',originalName:'art.png',mime:'image/png',size:png.length},{currentRenderer:'simple'});
  assert.equal(scene.renderer,'draw-reveal');assert.equal(scene.cache.voice,'voice');assert.equal(scene.artifacts.voice,'voice.mp3');assert.equal(scene.cache.image,undefined);assert.equal(scene.cache.video,undefined);assert.equal(project.artifacts.final,undefined);
  assert.equal(resolveArtworkFile(scene,root).type,'image/png');assert.equal(resolveArtworkFile({artwork:'../secret.png'},root),null);
});
