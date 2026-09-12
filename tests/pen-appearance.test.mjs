import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { normalizePenAppearance, validatePenAppearance } from '../packages/core/src/pen-settings.mjs';
import { createPenAsset, penAppearanceSignature } from '../packages/renderers/src/pen-appearance.mjs';
import { applyPenAppearance } from '../apps/web/src/project-settings.mjs';

test('pen appearance normalizes legacy projects and validates editable settings',()=>{
  assert.deepEqual(normalizePenAppearance(),{label:'NÉT VIỆT',color:'#FFFFFF'});
  assert.deepEqual(validatePenAppearance({label:'  CUTROOM  ',color:'#2458a6'}),{label:'CUTROOM',color:'#2458A6'});
  assert.throws(()=>validatePenAppearance({label:'CUTROOM',color:'blue'}),/#RRGGBB/);
  assert.throws(()=>validatePenAppearance({label:'1234567890123456789',color:'#FFFFFF'}),/at most 18/);
});

test('pen settings participate in render identity and produce a transparent recolored asset',async()=>{
  const white={settings:{pen:{label:'NÉT VIỆT',color:'#FFFFFF'}}},blue={settings:{pen:{label:'CUTROOM',color:'#2458A6'}}};
  assert.notEqual(penAppearanceSignature(white),penAppearanceSignature(blue));
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'vwt-pen-')),output=path.join(root,'blue.png');
  await createPenAsset({project:blue,outputFile:output});
  const image=sharp(output),metadata=await image.metadata(),{data,info}=await image.ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.equal(metadata.hasAlpha,true);assert.equal(metadata.width,1068);assert.equal(metadata.height,1473);
  let bluePixels=0;
  for(let index=0;index<data.length;index+=info.channels)if(data[index+2]>data[index]*1.35&&data[index+2]>data[index+1]*1.08&&data[index+3]>200)bluePixels++;
  assert.ok(bluePixels>30000,`expected a blue marker body, found ${bluePixels} blue pixels`);
  fs.rmSync(root,{recursive:true,force:true});
});

test('project pen edits invalidate only scenes that use the generated pen',()=>{
  const ready=(id,renderer,extra={})=>({id,renderer,...extra,status:'ready',cache:{voice:`${id}-voice`,image:`${id}-image`,video:`${id}-video`,clip:`${id}-clip`},artifacts:{voice:`${id}.mp3`,visual:`${id}.png`,video:`${id}.mp4`,clip:`${id}-clip.mp4`},review:{clip:'approved'}});
  const whiteboard=ready('whiteboard','whiteboard'),simple=ready('simple','simple'),custom=ready('custom','draw-reveal',{drawReveal:{handAsset:'assets/own-hand.png'}});
  const project={settings:{renderer:'simple',pen:{label:'NÉT VIỆT',color:'#FFFFFF'}},scenes:[whiteboard,simple,custom],artifacts:{final:'output/final.mp4'},status:'complete'};
  assert.equal(applyPenAppearance(project,{label:'CUTROOM',color:'#2458a6'},{}),true);
  assert.deepEqual(project.settings.pen,{label:'CUTROOM',color:'#2458A6'});
  assert.equal(whiteboard.cache.video,undefined);assert.equal(whiteboard.cache.clip,undefined);assert.equal(whiteboard.cache.voice,'whiteboard-voice');assert.equal(whiteboard.cache.image,'whiteboard-image');
  assert.equal(simple.cache.video,'simple-video');assert.equal(custom.cache.video,'custom-video');assert.equal(project.artifacts.final,undefined);
  assert.equal(applyPenAppearance(project,{label:'CUTROOM',color:'#2458A6'},{}),false);
});
